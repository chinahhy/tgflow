package telegram.files;

import io.vertx.core.Future;
import org.drinkless.tdlib.TdApi;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Compose-managed Telegram proxy; credentials never appear in diagnostics. */
public final class TelegramEnvironmentProxy {
    private final TdApi.Proxy proxy;

    private TelegramEnvironmentProxy(TdApi.Proxy proxy) {
        this.proxy = proxy;
    }

    public static TelegramEnvironmentProxy fromUrl(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if ((!scheme.equals("http") && !scheme.equals("socks5"))
                    || uri.getHost() == null || uri.getPort() < 1 || uri.getPort() > 65535
                    || (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/"))
                    || uri.getRawQuery() != null || uri.getRawFragment() != null) {
                throw new IllegalArgumentException();
            }
            String username = "";
            String password = "";
            if (uri.getRawUserInfo() != null) {
                String[] credentials = uri.getRawUserInfo().split(":", 2);
                username = decode(credentials[0]);
                password = credentials.length == 2 ? decode(credentials[1]) : "";
            }
            String host = uri.getHost();
            if (host.startsWith("[") && host.endsWith("]")) host = host.substring(1, host.length() - 1);
            TdApi.ProxyType type = scheme.equals("http")
                    ? new TdApi.ProxyTypeHttp(username, password, false)
                    : new TdApi.ProxyTypeSocks5(username, password);
            return new TelegramEnvironmentProxy(new TdApi.Proxy(host, uri.getPort(), type));
        } catch (IllegalArgumentException failure) {
            throw new IllegalArgumentException("TELEGRAM_PROXY_URL must be http://host:port or socks5://host:port (optional user:password)");
        }
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    public Future<TdApi.AddedProxy> enable(TelegramGateway gateway) {
        return gateway.execute(new TdApi.AddProxy(proxy, true, "Docker environment"));
    }

    public Future<TdApi.Ok> initialize(TelegramGateway gateway, TdApi.SetTdlibParameters parameters) {
        // TDLib queues these requests until parameters are supplied. Submit all three
        // without awaiting the queued proxy; keep networking disabled until it succeeds.
        var offline = gateway.execute(new TdApi.SetNetworkType(new TdApi.NetworkTypeNone()));
        var enabled = enable(gateway);
        var initialized = gateway.execute(parameters);
        return Future.all(offline, enabled, initialized)
                .compose(_ -> gateway.execute(new TdApi.SetNetworkType(new TdApi.NetworkTypeOther())));
    }

    @Override
    public String toString() {
        return "TelegramEnvironmentProxy[configured]";
    }
}
