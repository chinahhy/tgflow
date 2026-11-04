package telegram.files.bot;

import io.vertx.core.Vertx;
import io.vertx.core.http.HttpClientOptions;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class TelegramBotApiTest {
    @Test void postsPollingCursorAndReplyParametersAndRedactsApiFailures() throws Exception {
        Vertx vertx = Vertx.vertx();
        var lastBody = new AtomicReference<JsonObject>();
        var server = vertx.createHttpServer().requestHandler(request -> request.body().onSuccess(buffer -> {
            lastBody.set(buffer.toJsonObject());
            JsonObject response;
            if (request.path().endsWith("getUpdates")) {
                response = new JsonObject().put("ok", true).put("result", new JsonArray().add(new JsonObject().put("update_id", 101)));
            } else if (buffer.toJsonObject().getString("text").equals("rate-limit-fixture")) {
                response = new JsonObject().put("ok", false).put("error_code", 429)
                        .put("description", "secret-token-fixture").put("parameters", new JsonObject().put("retry_after", 7));
            } else response = new JsonObject().put("ok", true).put("result", new JsonObject().put("message_id", 1));
            request.response().putHeader("Content-Type", "application/json").end(response.encode());
        })).listen(0, "127.0.0.1").toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        var api = new TelegramBotApi(vertx, BotServiceTest.config(), new HttpClientOptions()
                .setDefaultHost("127.0.0.1").setDefaultPort(server.actualPort()).setSsl(false));
        try {
            assertEquals(101, api.updates(100).getJsonObject(0).getInteger("update_id"));
            assertEquals(100, lastBody.get().getLong("offset"));
            assertEquals(new JsonArray().add("message"), lastBody.get().getJsonArray("allowed_updates"));
            api.send(42, 15, "完成 <video>");
            assertEquals(42, lastBody.get().getLong("chat_id"));
            assertEquals(15, lastBody.get().getJsonObject("reply_parameters").getLong("message_id"));
            assertTrue(lastBody.get().getJsonObject("reply_parameters").getBoolean("allow_sending_without_reply"));
            assertFalse(lastBody.get().containsKey("parse_mode"));
            var failure = assertThrows(TelegramBotApi.ApiFailure.class, () -> api.send(42, 15, "rate-limit-fixture"));
            assertEquals(7, failure.retryAfter);
            assertFalse(failure.toString().contains("secret-token-fixture"));
            assertNull(failure.getCause());
        } finally {
            api.close();
            vertx.close().toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);
        }
    }
}
