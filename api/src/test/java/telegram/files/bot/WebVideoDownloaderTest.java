package telegram.files.bot;

import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WebVideoDownloaderTest {
    @TempDir Path temp;

    private BotConfiguration config(Path executable, int timeout) {
        return BotConfiguration.from(Map.of("TGFLOW_BOT_TOKEN", "12345:test-only-placeholder",
                "TGFLOW_BOT_ALLOWED_USER_IDS", "42", "TGFLOW_BOT_YTDLP_PATH", executable.toString(),
                "TGFLOW_BOT_TIMEOUT_SECONDS", Integer.toString(timeout)));
    }

    private Path executable(String body) throws Exception {
        Path script = Files.writeString(temp.resolve("fake-downloader"), "#!/bin/sh\n" + body);
        assertTrue(script.toFile().setExecutable(true));
        return script;
    }

    @Test void invokesWithoutShellAndRequiresRealNonemptyOutputInTaskDirectory() throws Exception {
        Path root = Files.createDirectories(temp.resolve("downloads/bot/12345"));
        Path script = executable("while [ \"$1\" != '--paths' ]; do shift; done\nshift\n"
                + "printf 'video fixture' > \"$1/video.mp4\"\nprintf 'TGFlowFile:\"%s/video.mp4\"\\n' \"$1\"\n");
        var downloader = new WebVideoDownloader(config(script, 10), root);
        String url = "https://example.com/video?x=$(touch%20unexpected)&y=1";
        var command = downloader.command(url, root.resolve("1-0"));
        assertEquals("--", command.get(command.size() - 2));
        assertEquals(url, command.getLast());
        assertEquals("bot/12345/1-0/video.mp4", downloader.download(new JsonObject().put("id", "1-0").put("url", url)));
        assertFalse(Files.exists(temp.resolve("unexpected")));
        assertTrue(Files.size(root.resolve("1-0/video.mp4")) > 0);
    }

    @Test void failuresDoNotReturnRawDownloaderOutputAndTimeoutKillsProcess() throws Exception {
        Path root = temp.resolve("downloads/bot/12345");
        Path failedScript = executable("printf 'ERROR: cookies token=private-fixture\\n'\nexit 1\n");
        Exception error = assertThrows(IllegalStateException.class, () -> new WebVideoDownloader(config(failedScript, 10), root)
                .download(new JsonObject().put("id", "1-0").put("url", "https://example.com/video")));
        assertTrue(error.getMessage().contains("Cookies"));
        assertFalse(error.getMessage().contains("private-fixture"));
        Path script = executable("sleep 30\n");
        var downloader = new WebVideoDownloader(config(script, 1), root);
        long start = System.nanoTime();
        Exception timeout = assertThrows(IllegalStateException.class, () -> downloader.download(
                new JsonObject().put("id", "2-0").put("url", "https://example.com/video")));
        assertTrue(timeout.getMessage().contains("超时"));
        assertTrue(System.nanoTime() - start < java.util.concurrent.TimeUnit.SECONDS.toNanos(10));
    }
}
