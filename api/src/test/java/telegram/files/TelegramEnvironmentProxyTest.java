package telegram.files;

import io.vertx.core.json.JsonObject;
import org.drinkless.tdlib.TdApi;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TelegramEnvironmentProxyTest {
    @Test
    void submitsParametersWithoutWaitingForTdlibsQueuedRequests() {
        var offline = io.vertx.core.Promise.<TdApi.Ok>promise();
        var enabled = io.vertx.core.Promise.<TdApi.AddedProxy>promise();
        var parameters = io.vertx.core.Promise.<TdApi.Ok>promise();
        var calls = new java.util.ArrayList<TdApi.Function<?>>();
        TelegramGateway gateway = mock(TelegramGateway.class);
        when(gateway.execute(any())).thenAnswer(invocation -> {
            TdApi.Function<?> method = invocation.getArgument(0);
            calls.add(method);
            if (method instanceof TdApi.AddProxy) return enabled.future();
            if (method instanceof TdApi.SetTdlibParameters) return parameters.future();
            if (method instanceof TdApi.SetNetworkType network && network.type instanceof TdApi.NetworkTypeNone)
                return offline.future();
            return io.vertx.core.Future.succeededFuture(new TdApi.Ok());
        });
        var result = TelegramEnvironmentProxy.fromUrl("http://192.0.2.10:6666")
                .initialize(gateway, new TdApi.SetTdlibParameters());
        assertEquals(3, calls.size());
        assertInstanceOf(TdApi.SetTdlibParameters.class, calls.get(2));
        assertFalse(result.isComplete());
        parameters.complete(new TdApi.Ok());
        offline.complete(new TdApi.Ok());
        assertEquals(3, calls.size());
        enabled.complete(new TdApi.AddedProxy());
        assertTrue(result.succeeded());
        var online = assertInstanceOf(TdApi.SetNetworkType.class, calls.getLast());
        assertInstanceOf(TdApi.NetworkTypeOther.class, online.type);
    }

    @Test
    void emptyEnvironmentPreservesExistingBehavior() {
        assertNull(TelegramEnvironmentProxy.fromUrl(null));
        assertNull(TelegramEnvironmentProxy.fromUrl("  "));
        ScriptedTelegramGateway gateway = new ScriptedTelegramGateway(_ -> new TdApi.Ok());
        TelegramVerticle account = account(gateway, null);
        assertTrue(account.initializeTdlibParameters(new TdApi.SetTdlibParameters()).succeeded());
        assertInstanceOf(TdApi.SetTdlibParameters.class, gateway.requests().getFirst());
        assertEquals(1, gateway.requests().size());
    }

    @Test
    void httpConnectProxyIsEnabledBeforeLoginParametersAndOnReinitialization() {
        var proxy = TelegramEnvironmentProxy.fromUrl("http://192.0.2.10:6666");
        ScriptedTelegramGateway gateway = new ScriptedTelegramGateway(method ->
                method instanceof TdApi.AddProxy ? new TdApi.AddedProxy() : new TdApi.Ok());
        TelegramVerticle account = account(gateway, proxy);
        for (int initialization = 0; initialization < 2; initialization++) {
            account.initializeTelegramGateway();
            assertTrue(account.initializeTdlibParameters(new TdApi.SetTdlibParameters()).succeeded());
            var offline = assertInstanceOf(TdApi.SetNetworkType.class, gateway.requests().get(initialization * 4));
            assertInstanceOf(TdApi.NetworkTypeNone.class, offline.type);
            var add = assertInstanceOf(TdApi.AddProxy.class, gateway.requests().get(initialization * 4 + 1));
            assertTrue(add.enable);
            assertEquals("192.0.2.10", add.proxy.server);
            assertEquals(6666, add.proxy.port);
            assertFalse(assertInstanceOf(TdApi.ProxyTypeHttp.class, add.proxy.type).httpOnly);
            assertInstanceOf(TdApi.SetTdlibParameters.class, gateway.requests().get(initialization * 4 + 2));
            var online = assertInstanceOf(TdApi.SetNetworkType.class, gateway.requests().get(initialization * 4 + 3));
            assertInstanceOf(TdApi.NetworkTypeOther.class, online.type);
        }
        assertTrue(account.toggleProxy(new JsonObject().put("proxyName", "web-profile")).failed());
        assertEquals(8, gateway.requests().size());
    }

    @Test
    void proxyFailureDoesNotStartADirectTelegramConnection() {
        var proxy = TelegramEnvironmentProxy.fromUrl("http://192.0.2.10:6666");
        ScriptedTelegramGateway gateway = new ScriptedTelegramGateway(method ->
                method instanceof TdApi.AddProxy ? new TdApi.Error(400, "proxy rejected") : new TdApi.Ok());
        TelegramVerticle account = account(gateway, proxy);
        assertTrue(account.initializeTdlibParameters(new TdApi.SetTdlibParameters()).failed());
        assertEquals(3, gateway.requests().size());
        assertInstanceOf(TdApi.AddProxy.class, gateway.requests().get(1));
        assertFalse(gateway.requests().stream().anyMatch(method -> method instanceof TdApi.SetNetworkType network
                && network.type instanceof TdApi.NetworkTypeOther));
    }

    @Test
    void socksCredentialsAreDecodedWithoutExposingThem() {
        var proxy = TelegramEnvironmentProxy.fromUrl("socks5://user+name:p%40ss%3Aword@[::1]:1080/");
        ScriptedTelegramGateway gateway = new ScriptedTelegramGateway(_ -> new TdApi.AddedProxy());
        proxy.enable(gateway);
        var add = assertInstanceOf(TdApi.AddProxy.class, gateway.requests().getFirst());
        var type = assertInstanceOf(TdApi.ProxyTypeSocks5.class, add.proxy.type);
        assertEquals("::1", add.proxy.server);
        assertEquals("user+name", type.username);
        assertEquals("p@ss:word", type.password);
        assertFalse(proxy.toString().contains("p@ss"));
        assertFalse(proxy.toString().contains("user+name"));
    }

    @Test
    void invalidUrlsFailWithARedactedConfigurationError() {
        for (String url : new String[]{"http://user:secret@host", "https://host:443", "socks5://host:0",
                "http://host:65536", "http://host:6666/path", "http://host:6666?token=secret", "http://user:%ZZ@host:6666"}) {
            var error = assertThrows(IllegalArgumentException.class, () -> TelegramEnvironmentProxy.fromUrl(url));
            assertTrue(error.getMessage().contains("TELEGRAM_PROXY_URL"));
            assertFalse(error.getMessage().contains("secret"));
            assertNull(error.getCause());
        }
    }

    private static TelegramVerticle account(ScriptedTelegramGateway gateway, TelegramEnvironmentProxy proxy) {
        TelegramVerticle account = new TelegramVerticle("/tmp/environment-proxy-fixture", () -> gateway) {
            @Override TelegramEnvironmentProxy environmentProxy() { return proxy; }
        };
        account.initializeTelegramGateway();
        return account;
    }
}
