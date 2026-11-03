package telegram.files;

import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class TelegramApplicationSettingsTest {
    @TempDir Path root;
    private static final String HASH = "disposable-test-application-hash";

    @Test
    void startsWithoutEnvironmentAndPersistsMaskedCredentialsAcrossRecreation() throws Exception {
        var settings = new TelegramApplicationSettings(root, Map.of());
        assertFalse(settings.current().configured());
        var saved = settings.save(new JsonObject().put("apiId", 123456).put("apiHash", HASH).put("logLevel", 3));
        assertTrue(saved.configured());
        assertFalse(saved.publicJson().containsKey("apiHash"));
        assertFalse(saved.toString().contains(HASH));
        var reloaded = new TelegramApplicationSettings(root, Map.of("TELEGRAM_API_ID", "1", "TELEGRAM_API_HASH", "old"));
        assertEquals(123456, reloaded.current().apiId());
        assertEquals(HASH, reloaded.current().apiHash());
        assertEquals(3, reloaded.current().logLevel());
        assertEquals("saved", reloaded.current().source());
        Path file = root.resolve("telegram-application.json");
        if (Files.getFileAttributeView(file, PosixFileAttributeView.class) != null) {
            assertEquals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE), Files.getPosixFilePermissions(file));
        }
    }

    @Test
    void importsEnvironmentAndKeepsBlankHashOnlyForTheSameApplication() throws Exception {
        var settings = new TelegramApplicationSettings(root, Map.of("TELEGRAM_API_ID", "42", "TELEGRAM_API_HASH", HASH));
        assertEquals("environment", settings.current().source());
        settings.save(new JsonObject().put("apiId", 42).put("apiHash", "").put("logLevel", 2));
        assertEquals(HASH, settings.current().apiHash());
        assertEquals("saved", settings.current().source());
        assertThrows(IllegalArgumentException.class, () -> settings.save(new JsonObject().put("apiId", 43)));
        assertThrows(IllegalArgumentException.class, () -> settings.save(new JsonObject().put("apiId", 42).put("logLevel", 1024)));
        assertThrows(IllegalArgumentException.class, () -> settings.save(new JsonObject().put("apiId", 42.5)));
        assertEquals(42, settings.current().apiId());
        assertEquals(2, settings.current().logLevel());
    }

    @Test
    void damagedStorageCanBeRecoveredWithoutExposingItsContents() throws Exception {
        Files.writeString(root.resolve("telegram-application.json"), "broken-json-" + HASH);
        var settings = new TelegramApplicationSettings(root, Map.of());
        assertFalse(settings.current().configured());
        assertTrue(settings.current().storageError());
        assertFalse(settings.current().toString().contains(HASH));
        settings.save(new JsonObject().put("apiId", 42).put("apiHash", HASH));
        assertFalse(new TelegramApplicationSettings(root, Map.of()).current().storageError());
    }

    @Test
    void failedDiskWriteDoesNotReplaceTheCurrentSettings() throws Exception {
        Path regularFile = Files.writeString(root.resolve("not-a-directory"), "fixture");
        var settings = new TelegramApplicationSettings(regularFile, Map.of());
        assertThrows(java.io.IOException.class, () -> settings.save(new JsonObject().put("apiId", 42).put("apiHash", HASH)));
        assertFalse(settings.current().configured());
    }
}
