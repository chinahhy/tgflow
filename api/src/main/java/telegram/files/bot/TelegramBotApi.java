package telegram.files.bot;

import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpClient;
import io.vertx.core.http.HttpClientOptions;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.net.ProxyOptions;
import io.vertx.core.net.ProxyType;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/** Bot API exceptions deliberately omit request URLs, token and remote response bodies. */
public final class TelegramBotApi implements BotApi {
    private final HttpClient client;
    private final String token;

    public TelegramBotApi(Vertx vertx, BotConfiguration config) {
        this(vertx, config, options(config));
    }

    TelegramBotApi(Vertx vertx, BotConfiguration config, HttpClientOptions options) {
        this.token = config.token();
        client = vertx.createHttpClient(options);
    }

    private static HttpClientOptions options(BotConfiguration config) {
        HttpClientOptions options = new HttpClientOptions().setSsl(true).setDefaultHost("api.telegram.org")
                .setDefaultPort(443).setConnectTimeout(15000).setIdleTimeout(60);
        if (!config.proxy().isBlank()) options.setProxyOptions(proxy(config.proxy()));
        return options;
    }

    static ProxyOptions proxy(String value) {
        try {
            URI uri = URI.create(value);
            ProxyType type = switch (uri.getScheme()) {
                case "http" -> ProxyType.HTTP;
                case "socks5", "socks5h" -> ProxyType.SOCKS5;
                default -> throw new IllegalArgumentException();
            };
            if (uri.getHost() == null || uri.getPort() < 1 || uri.getPort() > 65535
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || (!uri.getPath().isEmpty() && !uri.getPath().equals("/"))) throw new IllegalArgumentException();
            var options = new ProxyOptions().setType(type).setHost(uri.getHost()).setPort(uri.getPort());
            if (uri.getRawUserInfo() != null) {
                String[] parts = uri.getRawUserInfo().split(":", 2);
                options.setUsername(decode(parts[0])).setPassword(parts.length > 1 ? decode(parts[1]) : "");
            }
            return options;
        } catch (RuntimeException failure) {
            throw new IllegalArgumentException("Bot proxy must use http://host:port or socks5://host:port");
        }
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    @Override public JsonArray updates(long offset) throws Exception {
        return call("getUpdates", new JsonObject().put("offset", offset).put("timeout", 25)
                .put("limit", 20).put("allowed_updates", new JsonArray().add("message"))).getJsonArray("result");
    }

    @Override public void send(long chatId, long messageId, String text) throws Exception {
        call("sendMessage", new JsonObject().put("chat_id", chatId).put("text", text)
                .put("link_preview_options", new JsonObject().put("is_disabled", true))
                .put("reply_parameters", new JsonObject().put("message_id", messageId).put("allow_sending_without_reply", true)));
    }

    private JsonObject call(String method, JsonObject body) throws Exception {
        try {
            JsonObject result = client.request(HttpMethod.POST, "/bot" + token + "/" + method)
                    .compose(request -> request.putHeader("Content-Type", "application/json")
                            .send(Buffer.buffer(body.encode())))
                    .compose(response -> response.body()).map(Buffer::toJsonObject)
                    .toCompletionStage().toCompletableFuture().get(45, TimeUnit.SECONDS);
            if (!result.getBoolean("ok", false)) {
                int retry = result.getJsonObject("parameters", new JsonObject()).getInteger("retry_after", 5);
                throw new ApiFailure(result.getInteger("error_code", 0), retry);
            }
            return result;
        } catch (ApiFailure failure) { throw failure; }
        catch (InterruptedException failure) { throw failure; }
        catch (Exception failure) { throw new ApiFailure(0, 5); }
    }

    @Override public void close() { client.close(); }

    static final class ApiFailure extends Exception {
        final int code;
        final int retryAfter;
        ApiFailure(int code, int retryAfter) {
            super("Telegram Bot API unavailable (code " + code + ")");
            this.code = code;
            this.retryAfter = Math.max(1, Math.min(retryAfter, 3600));
        }
    }
}
