package telegram.files;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.drinkless.tdlib.TdApi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import telegram.files.repository.FileRecord;
import telegram.files.repository.TelegramRecord;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(VertxExtension.class)
class TelegramStorageFlowTest {
    @AfterEach
    void clear(Vertx vertx, VertxTestContext context) {
        DataVerticleTest.clear(vertx).onComplete(context.succeedingThenComplete());
    }

    @Test
    void retryPauseResumeCompletionPreviewAndRemovalKeepOneConsistentFile(Vertx vertx, VertxTestContext context) throws Exception {
        Path account = Files.createDirectories(Path.of(Config.TELEGRAM_ROOT, "flow-account"));
        Path staging = DownloadStorage.configured().filesDirectory(account.toString());
        Path source = Files.write(staging.resolve("tdlib-internal-name"), new byte[]{1, 2, 3});
        TdApi.Message message = TestMessages.file(901, "Original name.MKV", 3, false);
        TdApi.File file = TdApiHelp.getFileHandler(message).orElseThrow().getFile();
        file.local = new TdApi.LocalFile();
        file.local.path = source.toString();
        file.local.canBeDeleted = true;
        file.local.canBeDownloaded = true;
        var gateway = new ScriptedTelegramGateway(request -> {
            if (request instanceof TdApi.GetFile) return file;
            if (request instanceof TdApi.AddFileToDownloads) return file;
            if (request instanceof TdApi.GetMessage) return message;
            if (request instanceof TdApi.GetMessageThread) return null;
            return new TdApi.Ok();
        });
        var record = TdApiHelp.getFileHandler(message).orElseThrow().convertFileRecord(1);
        var telegram = new TelegramVerticle(new TelegramRecord(1, "test", account.toString(), null), () -> gateway);
        telegram.init(vertx, vertx.getOrCreateContext());
        telegram.initializeTelegramGateway();
        telegram.client = gateway; // Exercise the application paths after the gateway readiness boundary.
        telegram.authorized = true;

        vertx.deployVerticle(new DataVerticle())
                .compose(_ -> DataVerticle.fileRepository.create(record))
                .compose(_ -> DataVerticle.fileRepository.updateDownloadStatus(file.id, file.remote.uniqueId,
                        null, FileRecord.DownloadStatus.error, null))
                .compose(_ -> DownloadFailures.save(record.uniqueId(), "DOWNLOAD_START_FAILED", new RuntimeException("fixture failure")))
                .compose(_ -> telegram.startDownload(message.chatId, message.id, file.id))
                .compose(_ -> DataVerticle.fileRepository.getByUniqueId(record.uniqueId()))
                .compose(current -> {
                    context.verify(() -> assertTrue(current.isDownloadStatus(FileRecord.DownloadStatus.downloading)));
                    return telegram.togglePauseDownload(file.id, true);
                })
                .compose(_ -> DataVerticle.fileRepository.getByUniqueId(record.uniqueId()))
                .compose(current -> {
                    context.verify(() -> assertTrue(current.isDownloadStatus(FileRecord.DownloadStatus.paused)));
                    return telegram.togglePauseDownload(file.id, false);
                })
                .compose(_ -> {
                    file.local.isDownloadingCompleted = true;
                    file.local.isDownloadingActive = false;
                    file.local.downloadedSize = 3;
                    // A cached download can be incomplete on disk; every completion entry point
                    // must persist the error instead of leaving the task marked as downloading.
                    return vertx.executeBlocking(() -> Files.write(source, new byte[]{1, 2}))
                            .compose(_ -> telegram.startDownload(message.chatId, message.id, file.id))
                            .transform(attempt -> {
                                context.verify(() -> assertTrue(attempt.failed()));
                                return DownloadFailures.enrich(java.util.List.of(
                                        new io.vertx.core.json.JsonObject().put("uniqueId", record.uniqueId())));
                            })
                            .compose(failures -> {
                                context.verify(() -> assertEquals("FILE_STORAGE_FAILED", failures.getFirst().getString("errorCode")));
                                return DataVerticle.fileRepository.getByUniqueId(record.uniqueId());
                            })
                            .compose(failed -> {
                                context.verify(() -> assertTrue(failed.isDownloadStatus(FileRecord.DownloadStatus.error)));
                                return vertx.executeBlocking(() -> Files.write(source, new byte[]{1, 2, 3}));
                            })
                            .compose(_ -> telegram.startDownload(message.chatId, message.id, file.id));
                })
                .compose(_ -> telegram.loadPreview(record.uniqueId()))
                .compose(preview -> {
                    context.verify(() -> {
                        assertEquals("Original name.MKV", Path.of(preview.v1).getFileName().toString());
                        assertTrue(DownloadStorage.configured().isFinalized(preview.v1));
                        assertFalse(Files.exists(source));
                    });
                    return telegram.removeFile(file.id, record.uniqueId()).map(preview.v1);
                })
                .compose(published -> {
                    context.verify(() -> assertFalse(Files.exists(Path.of(published))));
                    return DataVerticle.fileRepository.getByUniqueId(record.uniqueId());
                })
                .onComplete(context.succeeding(current -> context.verify(() -> {
                    assertNull(current);
                    context.completeNow();
                })));
    }

    @Test
    void tdlibReceivesSeparateDatabaseAndFileDirectories(Vertx vertx, VertxTestContext context) throws Exception {
        Path account = Files.createDirectories(Path.of(Config.TELEGRAM_ROOT, "parameters-account"));
        var gateway = new ScriptedTelegramGateway(_ -> new TdApi.Ok());
        var telegram = new TelegramVerticle(account.toString(), () -> gateway);
        telegram.init(vertx, vertx.getOrCreateContext());
        telegram.initializeTelegramGateway();
        gateway.emit(new TdApi.UpdateAuthorizationState(new TdApi.AuthorizationStateWaitTdlibParameters()));
        context.verify(() -> {
            var parameters = gateway.requests().stream().filter(TdApi.SetTdlibParameters.class::isInstance)
                    .map(TdApi.SetTdlibParameters.class::cast).findFirst().orElseThrow();
            assertEquals(account.toString(), parameters.databaseDirectory);
            assertTrue(Path.of(parameters.filesDirectory).startsWith(Path.of(Config.DOWNLOAD_ROOT)));
            assertNotEquals(parameters.databaseDirectory, parameters.filesDirectory);
            context.completeNow();
        });
    }
}
