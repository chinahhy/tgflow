package telegram.files;

import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(VertxExtension.class)
class DevFileRepositoryTest {
    @AfterEach
    void cleanup(Vertx vertx, VertxTestContext context) {
        DataVerticleTest.clear(vertx).onComplete(context.succeedingThenComplete());
    }

    @Test
    void filtersDocumentExtensionsAndPersistsFailureAcrossDatabaseRestart(Vertx vertx, VertxTestContext context) {
        vertx.deployVerticle(new DataVerticle()).compose(deployment -> {
            var first = TdApiHelp.getFileHandler(TestMessages.file(1, "film.MKV", 1610612736L, false)).orElseThrow().convertFileRecord(5);
            var other = TdApiHelp.getFileHandler(TestMessages.file(2, "other.mp4", 10, true)).orElseThrow().convertFileRecord(5);
            return DataVerticle.fileRepository.create(first)
                    .compose(_ -> DataVerticle.fileRepository.create(other))
                    .compose(_ -> DataVerticle.fileRepository.getFiles(0,
                            Map.of("extensions", "MKV", "sizeRange", "1.5,2", "sizeUnit", "GB", "type", "all")))
                    .compose(page -> {
                        context.verify(() -> {
                            assertEquals(1, page.v1.size());
                            assertEquals(first.uniqueId(), page.v1.getFirst().uniqueId());
                            assertEquals(1, page.v3);
                        });
                        return DownloadFailures.save(first.uniqueId(), "FILE_STORAGE_FAILED", new java.io.IOException("Disk full"));
                    })
                    .compose(_ -> vertx.undeploy(deployment))
                    .compose(_ -> vertx.deployVerticle(new DataVerticle()))
                    .compose(_ -> DownloadFailures.enrich(List.of(new JsonObject().put("uniqueId", first.uniqueId()))))
                    .compose(files -> {
                        context.verify(() -> {
                            assertEquals("Disk full", files.getFirst().getString("errorMessage"));
                            assertEquals("FILE_STORAGE_FAILED", files.getFirst().getString("errorCode"));
                            assertTrue(files.getFirst().getLong("errorAt") > 0);
                        });
                        return DownloadFailures.clear(first.uniqueId());
                    })
                    .compose(_ -> DownloadFailures.enrich(List.of(new JsonObject().put("uniqueId", first.uniqueId()))))
                    .onSuccess(files -> context.verify(() -> assertFalse(files.getFirst().containsKey("errorMessage"))))
                    .mapEmpty();
        }).onComplete(context.succeedingThenComplete());
    }
}
