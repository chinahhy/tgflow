package telegram.files;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DownloadStorageTest {
    @TempDir Path temporary;

    @Test
    void separatesAccountStateAndStagingAndPreservesNamesWithoutOverwriting() throws Exception {
        Path state = Files.createDirectories(temporary.resolve("ssd/account"));
        Path downloads = temporary.resolve("hdd/downloads");
        var storage = new DownloadStorage(downloads, List.of(state));
        Path staging = storage.filesDirectory(state.toString());
        assertTrue(staging.startsWith(downloads));
        assertFalse(staging.startsWith(state));
        for (int id = 1; id <= 2; id++) {
            Path source = Files.write(staging.resolve("tdlib-" + id), new byte[]{(byte) id, 2, 3});
            var record = TdApiHelp.getFileHandler(TestMessages.file(id, "原始名称.MKV", 3, false)).orElseThrow().convertFileRecord(5);
            String published = storage.publish(record, source.toString());
            assertEquals("原始名称.MKV", Path.of(published).getFileName().toString());
            assertTrue(storage.isFinalized(published));
            assertEquals(id, Files.readAllBytes(Path.of(published))[0]);
            assertFalse(Files.exists(source));
            assertEquals(published, storage.publish(record, source.toString())); // Crash/restart retry.
        }
    }

    @Test
    void rejectsTruncatedAndEscapingSourcesAndSanitizesNames() throws Exception {
        Path downloads = Files.createDirectories(temporary.resolve("downloads"));
        var storage = new DownloadStorage(downloads, List.of());
        var record = TdApiHelp.getFileHandler(TestMessages.file(1, "../bad/name.mkv", 5, false)).orElseThrow().convertFileRecord(5);
        Path truncated = Files.write(downloads.resolve("partial"), new byte[]{1});
        assertThrows(IOException.class, () -> storage.publish(record, truncated.toString()));
        assertTrue(Files.exists(truncated));
        Path outside = Files.write(temporary.resolve("outside"), new byte[5]);
        assertThrows(IOException.class, () -> storage.publish(record, outside.toString()));
        assertEquals(".._bad_name.mkv", DownloadStorage.safeFileName("../bad/name.mkv", "fallback"));
        String longName = DownloadStorage.safeFileName("中".repeat(200) + ".mkv", "fallback");
        assertTrue(longName.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 240);
        assertTrue(longName.endsWith(".mkv"));
    }
}
