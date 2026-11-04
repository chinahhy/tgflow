package telegram.files.bot;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import telegram.files.DataVerticle;
import telegram.files.TelegramVerticle;
import telegram.files.TelegramVerticles;
import telegram.files.repository.FileRecord;
import telegram.files.repository.FileRepository;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TelegramLinkDownloaderTest {
    @TempDir Path temp;

    @Test void waitsForActualDownloadedFileAndReusesExistingTask() throws Exception {
        var previous = new ArrayList<>(TelegramVerticles.getAll());
        var previousRepository = DataVerticle.fileRepository;
        TelegramVerticle account = mock(TelegramVerticle.class);
        FileRepository repository = mock(FileRepository.class);
        String link = "https://t.me/example/15";
        try {
            TelegramVerticles.getAll().clear();
            TelegramVerticles.add(account);
            DataVerticle.fileRepository = repository;
            when(account.isAvailable()).thenReturn(true);
            when(account.parseLink(link)).thenReturn(Future.succeededFuture(new JsonObject().put("files", new JsonArray()
                    .add(new JsonObject().put("id", 9).put("chatId", -100123L).put("messageId", 15L).put("uniqueId", "file-unique")))));
            var completed = mock(FileRecord.class);
            when(completed.isDownloadStatus(FileRecord.DownloadStatus.completed)).thenReturn(true);
            when(completed.localPath()).thenReturn(Files.writeString(temp.resolve("video.mp4"), "video-fixture").toString());
            when(completed.fileName()).thenReturn("原始视频.mp4");
            when(repository.getByUniqueId("file-unique")).thenReturn(Future.succeededFuture(null), Future.succeededFuture(completed));
            when(account.startDownload(-100123L, 15L, 9)).thenReturn(Future.succeededFuture(completed));
            var downloader = new TelegramLinkDownloader(BotServiceTest.config());
            assertTrue(downloader.download(new JsonObject().put("url", link)).contains("原始视频.mp4"));
            verify(account).startDownload(-100123L, 15L, 9);

            reset(repository, account);
            when(account.isAvailable()).thenReturn(true);
            when(account.parseLink(link)).thenReturn(Future.succeededFuture(new JsonObject().put("files", new JsonArray()
                    .add(new JsonObject().put("id", 9).put("chatId", -100123L).put("messageId", 15L).put("uniqueId", "file-unique")))));
            var downloading = mock(FileRecord.class);
            when(downloading.isDownloadStatus(FileRecord.DownloadStatus.downloading)).thenReturn(true);
            when(repository.getByUniqueId("file-unique")).thenReturn(Future.succeededFuture(downloading), Future.succeededFuture(completed));
            downloader.download(new JsonObject().put("url", link));
            verify(account, never()).startDownload(any(), any(), any());
        } finally {
            TelegramVerticles.getAll().clear();
            TelegramVerticles.getAll().addAll(previous);
            DataVerticle.fileRepository = previousRepository;
        }
    }
}
