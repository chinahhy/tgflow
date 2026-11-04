package telegram.files.bot;

import java.nio.file.Path;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Opt-in, Compose-managed credentials. Never include this object in diagnostics. */
public record BotConfiguration(String token, Set<Long> allowedUsers, String telegramId,
                               String proxy, String executable, Path cookies,
                               int queueLimit, int timeoutSeconds, String maxFileSize) {
    public static BotConfiguration from(Map<String, String> env) {
        String token = env.getOrDefault("TGFLOW_BOT_TOKEN", "").strip();
        if (token.isEmpty()) return null;
        if (!token.matches("[0-9]+:[A-Za-z0-9_-]+"))
            throw new IllegalArgumentException("TGFLOW_BOT_TOKEN has an invalid format");
        try {
            Set<Long> users = Arrays.stream(env.getOrDefault("TGFLOW_BOT_ALLOWED_USER_IDS", "").split(","))
                    .map(String::strip).filter(s -> !s.isEmpty()).map(Long::parseLong).collect(Collectors.toUnmodifiableSet());
            if (users.isEmpty() || users.stream().anyMatch(id -> id <= 0)) throw new IllegalArgumentException();
            String cookies = env.getOrDefault("TGFLOW_BOT_COOKIES_FILE", "").strip();
            String maxSize = env.getOrDefault("TGFLOW_BOT_MAX_FILE_SIZE", "10G");
            if (!maxSize.matches("[1-9][0-9]*[KMG]?")) throw new IllegalArgumentException();
            return new BotConfiguration(token, users, env.getOrDefault("TGFLOW_BOT_TELEGRAM_ID", "").strip(),
                    env.getOrDefault("TGFLOW_BOT_PROXY_URL", env.getOrDefault("TELEGRAM_PROXY_URL", "")).strip(),
                    env.getOrDefault("TGFLOW_BOT_YTDLP_PATH", "/opt/yt-dlp/bin/yt-dlp"),
                    cookies.isEmpty() ? null : Path.of(cookies),
                    positive(env, "TGFLOW_BOT_QUEUE_LIMIT", 100, 1000),
                    positive(env, "TGFLOW_BOT_TIMEOUT_SECONDS", 3600, 86400), maxSize);
        } catch (IllegalArgumentException failure) {
            throw new IllegalArgumentException("Bot requires positive TGFLOW_BOT_ALLOWED_USER_IDS and valid download limits");
        }
    }

    private static int positive(Map<String, String> env, String key, int fallback, int maximum) {
        int value = Integer.parseInt(env.getOrDefault(key, Integer.toString(fallback)));
        if (value < 1 || value > maximum) throw new IllegalArgumentException();
        return value;
    }

    public String botId() { return token.substring(0, token.indexOf(':')); }

    @Override public String toString() { return "BotConfiguration[configured]"; }
}
