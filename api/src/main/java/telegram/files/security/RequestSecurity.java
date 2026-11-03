package telegram.files.security;

import java.util.Locale;

/** Resolve the browser-facing origin without requiring a deployment-specific URL. */
public record RequestSecurity(String peer, String directScheme, String host,
                              String forwardedScheme, String forwardedHost) {
    public String scheme() {
        String scheme = OriginPolicy.isLoopback(peer) ? clean(forwardedScheme) : "";
        if (scheme.equals("http") || scheme.equals("https")) return scheme;
        return "https".equalsIgnoreCase(directScheme) || "wss".equalsIgnoreCase(directScheme) ? "https" : "http";
    }

    public boolean isSameOrigin(String origin) {
        if (origin == null || origin.isBlank()) return true;
        String authority = OriginPolicy.isLoopback(peer) && forwardedHost != null && !forwardedHost.isBlank()
                ? forwardedHost.trim() : host;
        return authority != null && OriginPolicy.sameOrigin(origin, scheme() + "://" + authority);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    public enum CookieMode {
        AUTO, ALWAYS, NEVER;

        public static CookieMode parse(String value) {
            return switch (clean(value)) {
                case "", "auto" -> AUTO;
                case "true" -> ALWAYS;
                case "false" -> NEVER;
                default -> throw new IllegalArgumentException("HTTP_SECURE_COOKIES must be auto, true or false");
            };
        }

        public boolean secureFor(String scheme) {
            return this == ALWAYS || this == AUTO && "https".equalsIgnoreCase(scheme);
        }
    }
}
