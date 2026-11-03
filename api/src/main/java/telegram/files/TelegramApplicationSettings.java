package telegram.files;

import io.vertx.core.json.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Map;
import java.util.Set;

/** Administrator-managed application credentials, kept on the configuration volume. */
public final class TelegramApplicationSettings {
    private static final class Holder {
        private static final TelegramApplicationSettings INSTANCE =
                new TelegramApplicationSettings(Path.of(Config.APP_ROOT), System.getenv());
    }

    public static TelegramApplicationSettings instance() {
        return Holder.INSTANCE;
    }

    public record Values(int apiId, String apiHash, int logLevel, String source, boolean storageError) {
        public boolean configured() {
            return apiId > 0 && apiHash != null && !apiHash.isBlank();
        }

        public JsonObject publicJson() {
            return new JsonObject()
                    .put("apiId", apiId > 0 ? apiId : null)
                    .put("apiHashConfigured", configured())
                    .put("configured", configured())
                    .put("logLevel", logLevel)
                    .put("source", source)
                    .put("storageError", storageError);
        }

        @Override
        public String toString() {
            return publicJson().encode();
        }
    }

    private final Path file;
    private volatile Values values;

    TelegramApplicationSettings(Path root, Map<String, String> environment) {
        file = root.resolve("telegram-application.json");
        int apiId = environmentInteger(environment.get("TELEGRAM_API_ID"), 0, 0, Integer.MAX_VALUE);
        String hash = environment.getOrDefault("TELEGRAM_API_HASH", "").trim();
        int logLevel = environmentInteger(environment.get("TELEGRAM_LOG_LEVEL"), 0, 0, 1023);
        Values fallback = new Values(apiId, hash, logLevel,
                apiId > 0 && !hash.isBlank() ? "environment" : "none", false);
        values = fallback;
        if (Files.exists(file)) {
            try {
                if (Files.size(file) > 8192) throw new IOException();
                JsonObject stored = new JsonObject(Files.readString(file, StandardCharsets.UTF_8));
                values = validate(stored, new Values(0, "", logLevel, "none", false));
            } catch (IOException | RuntimeException failure) {
                // Parser errors can contain the secret input. Expose only a recovery flag.
                values = new Values(fallback.apiId(), fallback.apiHash(), fallback.logLevel(), fallback.source(), true);
            }
        }
    }

    public Values current() {
        return values;
    }

    public synchronized Values save(JsonObject input) throws IOException {
        Values next = validate(input, values);
        Files.createDirectories(file.getParent());
        Path temporary = Files.createTempFile(file.getParent(), ".telegram-application-", ".json");
        try {
            if (Files.getFileAttributeView(temporary, PosixFileAttributeView.class) != null) {
                Files.setPosixFilePermissions(temporary,
                        Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
            }
            JsonObject stored = new JsonObject().put("apiId", next.apiId())
                    .put("apiHash", next.apiHash()).put("logLevel", next.logLevel());
            Files.writeString(temporary, stored.encodePrettily(), StandardCharsets.UTF_8);
            try {
                Files.move(temporary, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException failure) {
                Files.move(temporary, file, StandardCopyOption.REPLACE_EXISTING);
            }
            values = next;
            return next;
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private static Values validate(JsonObject input, Values previous) {
        if (input == null) throw new IllegalArgumentException("Telegram application settings are required");
        int id = integer(input.getValue("apiId"), "Telegram API ID must be a positive integer");
        if (id <= 0) throw new IllegalArgumentException("Telegram API ID must be a positive integer");
        Object rawHash = input.getValue("apiHash");
        if (rawHash != null && !(rawHash instanceof String)) {
            throw new IllegalArgumentException("Telegram API Hash is invalid");
        }
        String hash = rawHash == null ? "" : ((String) rawHash).trim();
        if (hash.isEmpty()) {
            if (id != previous.apiId() || !previous.configured()) {
                throw new IllegalArgumentException("Telegram API Hash is required");
            }
            hash = previous.apiHash();
        }
        if (hash.length() > 256 || hash.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("Telegram API Hash is invalid");
        }
        int level = input.containsKey("logLevel")
                ? integer(input.getValue("logLevel"), "Telegram log level must be between 0 and 1023")
                : previous.logLevel();
        if (level < 0 || level > 1023) {
            throw new IllegalArgumentException("Telegram log level must be between 0 and 1023");
        }
        return new Values(id, hash, level, "saved", false);
    }

    private static int integer(Object value, String message) {
        try {
            if (value instanceof Number number) {
                long parsed = number.longValue();
                if (parsed < Integer.MIN_VALUE || parsed > Integer.MAX_VALUE || number.doubleValue() != parsed) {
                    throw new IllegalArgumentException(message);
                }
                return (int) parsed;
            }
            if (value instanceof String string && string.matches("[0-9]+")) return Integer.parseInt(string);
        } catch (NumberFormatException ignored) {
            // Keep validation errors free of the submitted value.
        }
        throw new IllegalArgumentException(message);
    }

    private static int environmentInteger(String value, int fallback, int minimum, int maximum) {
        try {
            int parsed = Integer.parseInt(value);
            return parsed >= minimum && parsed <= maximum ? parsed : fallback;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}
