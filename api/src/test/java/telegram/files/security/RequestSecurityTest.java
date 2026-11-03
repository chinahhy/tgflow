package telegram.files.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RequestSecurityTest {
    @Test
    void detectsDirectHttpAndNormalizesDefaultPorts() {
        var request = new RequestSecurity("192.168.1.20", "http", "nas.example.test:80", null, null);
        assertTrue(request.isSameOrigin("http://nas.example.test"));
        assertTrue(request.isSameOrigin(null));
        assertFalse(request.isSameOrigin("https://nas.example.test"));
        assertFalse(request.isSameOrigin("http://nas.example.test.attacker.invalid"));
        assertFalse(RequestSecurity.CookieMode.AUTO.secureFor(request.scheme()));
    }

    @Test
    void detectsProxyHttpsAndRetainsThePublicPortWhenHostIsRewritten() {
        var request = new RequestSecurity("127.0.0.1", "http", "backend:8026", "https", "files.example.test:6270");
        assertTrue(request.isSameOrigin("https://files.example.test:6270"));
        assertFalse(request.isSameOrigin("https://files.example.test"));
        assertTrue(RequestSecurity.CookieMode.AUTO.secureFor(request.scheme()));
        assertFalse(request.isSameOrigin("https://other.example.test:6270"));
    }

    @Test
    void ignoresForwardedHeadersFromDirectNonLoopbackPeers() {
        var request = new RequestSecurity("192.168.1.20", "http", "nas.example.test:8026", "https", "other.example.test");
        assertEquals("http", request.scheme());
        assertTrue(request.isSameOrigin("http://nas.example.test:8026"));
        assertFalse(request.isSameOrigin("https://other.example.test"));
    }

    @Test
    void handlesIpv6AndInvalidProxyValuesWithoutAcceptingMalformedOrigins() {
        var request = new RequestSecurity("::1", "http", "[::1]:8026", "invalid", "");
        assertTrue(request.isSameOrigin("http://[::1]:8026"));
        assertFalse(request.isSameOrigin("null"));
        assertFalse(request.isSameOrigin("https://user:password@[::1]:8026"));
        assertFalse(request.isSameOrigin("https://[::1]:8026/path"));
        assertFalse(new OriginPolicy(java.util.List.of()).isAllowed("null"));
    }

    @Test
    void supportsAutomaticAndExplicitCookieModes() {
        assertEquals(RequestSecurity.CookieMode.AUTO, RequestSecurity.CookieMode.parse(null));
        assertEquals(RequestSecurity.CookieMode.AUTO, RequestSecurity.CookieMode.parse(" AUTO "));
        assertTrue(RequestSecurity.CookieMode.parse("true").secureFor("http"));
        assertFalse(RequestSecurity.CookieMode.parse("false").secureFor("https"));
        assertTrue(new RequestSecurity("192.168.1.20", "https", "files.example.test", null, null)
                .isSameOrigin("https://files.example.test:443/"));
        assertThrows(IllegalArgumentException.class, () -> RequestSecurity.CookieMode.parse("unknown"));
    }
}
