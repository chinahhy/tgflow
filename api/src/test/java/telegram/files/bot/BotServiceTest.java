package telegram.files.bot;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BotServiceTest {
    @TempDir Path temp;

    static BotConfiguration config() {
        return BotConfiguration.from(Map.of("TGFLOW_BOT_TOKEN", "12345:test-only-placeholder",
                "TGFLOW_BOT_ALLOWED_USER_IDS", "42"));
    }

    static JsonObject update(long id, long user, String type, String text) {
        return new JsonObject().put("update_id", id).put("message", new JsonObject()
                .put("message_id", id + 10).put("from", new JsonObject().put("id", user))
                .put("chat", new JsonObject().put("id", user).put("type", type)).put("text", text));
    }

    @Test void persistsBeforeAcknowledgingDeduplicatesUpdatesAndRecoversRunningTasks() throws Exception {
        var api = new FakeApi();
        var store = new BotTaskStore(temp);
        var service = new BotService(config(), store, api, _ -> "bot/video.mp4");
        JsonObject update = update(100, 42, "private", "https://youtu.be/example");
        service.ingest(update);
        service.ingest(update);
        assertEquals(1, store.jobs().size());
        assertEquals(101, store.offset());
        assertTrue(api.messages.isEmpty());
        service.notifyOnce();
        assertTrue(api.messages.getFirst().contains("已加入"));
        store.update("100-0", j -> j.put("status", "RUNNING"));
        var recovered = new BotTaskStore(temp);
        assertEquals("QUEUED", recovered.jobs().getFirst().getString("status"));
        var restarted = new BotService(config(), recovered, api, _ -> "bot/video.mp4");
        restarted.workOnce();
        restarted.notifyOnce();
        assertEquals("SUCCEEDED", recovered.jobs().getFirst().getString("status"));
        assertTrue(api.messages.getLast().contains("下载成功"));
        int sent = api.messages.size();
        new BotService(config(), new BotTaskStore(temp), api, _ -> fail("must not rerun")).notifyOnce();
        assertEquals(sent, api.messages.size());
    }

    @Test void retriesNotificationsWithoutRedownloadingAndReportsFailures() throws Exception {
        var api = new FakeApi();
        var store = new BotTaskStore(temp);
        int[] runs = {0};
        var service = new BotService(config(), store, api, _ -> {
            runs[0]++;
            throw new BotDownloadException("网站要求登录，请配置 Cookies");
        });
        service.ingest(update(1, 42, "private", "https://www.bilibili.com/video/BVexample"));
        service.workOnce();
        api.fail = true;
        assertThrows(Exception.class, service::notifyOnce);
        assertFalse(store.jobs().getFirst().getBoolean("notified"));
        api.fail = false;
        service.notifyOnce();
        service.workOnce();
        assertEquals(1, runs[0]);
        assertTrue(api.messages.getLast().contains("下载失败"));
        assertTrue(api.messages.getLast().contains("Cookies"));
    }

    @Test void rejectsNonAllowlistedUsersGroupsAndOversizedBatches() throws Exception {
        var api = new FakeApi();
        var store = new BotTaskStore(temp);
        var service = new BotService(config(), store, api, _ -> fail("unauthorized"));
        service.ingest(update(1, 7, "private", "https://youtu.be/example"));
        service.ingest(update(2, 42, "group", "https://youtu.be/example"));
        assertTrue(api.messages.isEmpty());
        assertTrue(store.jobs().isEmpty());
        service.ingest(update(3, 42, "private", String.join(" ", java.util.stream.IntStream.range(0, 11)
                .mapToObj(i -> "https://youtu.be/" + i).toList())));
        assertTrue(store.jobs().isEmpty());
        assertTrue(api.messages.getLast().contains("最多"));
        assertEquals(4, store.offset());
    }

    @Test void boundsQueueIncludingUnsentResultsAndDoesNotAdvanceOnFullUntilReplySent() throws Exception {
        var api = new FakeApi();
        var store = new BotTaskStore(temp);
        var config = BotConfiguration.from(Map.of("TGFLOW_BOT_TOKEN", "12345:test-only-placeholder",
                "TGFLOW_BOT_ALLOWED_USER_IDS", "42", "TGFLOW_BOT_QUEUE_LIMIT", "1"));
        var service = new BotService(config, store, api, _ -> "file.mp4");
        service.ingest(update(1, 42, "private", "https://youtu.be/one"));
        service.workOnce();
        api.fail = true;
        assertThrows(Exception.class, () -> service.ingest(update(2, 42, "private", "https://youtu.be/two")));
        assertEquals(2, store.offset());
        api.fail = false;
        service.ingest(update(2, 42, "private", "https://youtu.be/two"));
        assertEquals(1, store.jobs().size());
        assertTrue(api.messages.getLast().contains("队列已满"));
    }

    @Test void doesNotPersistUnexpectedExceptionSecrets() throws Exception {
        var store = new BotTaskStore(temp);
        var service = new BotService(config(), store, new FakeApi(), _ -> {
            throw new java.io.IOException("https://api.telegram.org/bot12345:secret-test-fixture/getUpdates");
        });
        service.ingest(update(1, 42, "private", "https://youtu.be/example"));
        service.workOnce();
        assertFalse(store.jobs().getFirst().getString("result").contains("secret-test-fixture"));
    }

    @Test void blockedRecipientDoesNotStarveOtherUsersAndRateLimitRemainsGlobal() throws Exception {
        var config = BotConfiguration.from(Map.of("TGFLOW_BOT_TOKEN", "12345:test-only-placeholder",
                "TGFLOW_BOT_ALLOWED_USER_IDS", "42,43"));
        var api = new FakeApi() {
            @Override public void send(long chatId, long messageId, String text) throws Exception {
                if (chatId == 42) throw new TelegramBotApi.ApiFailure(403, 5);
                super.send(chatId, messageId, text);
            }
        };
        var store = new BotTaskStore(temp);
        var service = new BotService(config, store, api, _ -> "video.mp4");
        service.ingest(update(1, 42, "private", "https://youtu.be/one"));
        service.ingest(update(2, 43, "private", "https://youtu.be/two"));
        service.workOnce();
        service.workOnce();
        service.notifyOnce();
        assertFalse(store.jobs().getFirst().getBoolean("notified"));
        assertTrue(store.jobs().getLast().getBoolean("notified"));
        assertTrue(api.messages.getLast().contains("下载成功"));
        var limited = new BotService(config, store, new FakeApi() {
            @Override public void send(long chatId, long messageId, String text) throws Exception {
                throw new TelegramBotApi.ApiFailure(429, 7);
            }
        }, _ -> "video.mp4");
        store.update("1-0", j -> j.put("notifyAfter", 0L));
        var failure = assertThrows(TelegramBotApi.ApiFailure.class, limited::notifyOnce);
        assertEquals(7, failure.retryAfter);
    }

    @Test void failedSnapshotWriteCannotAcknowledgeAnUnqueuedUpdate() throws Exception {
        var store = new BotTaskStore(temp);
        Path stateFile = temp.resolve("tasks.json");
        java.nio.file.Files.delete(stateFile);
        java.nio.file.Files.createDirectory(stateFile);
        java.nio.file.Files.writeString(stateFile.resolve("prevent-replacement"), "fixture");
        assertThrows(java.io.IOException.class, () -> store.enqueue(1, 42, 42, 15, List.of("https://youtu.be/one"), 10));
        assertEquals(0, store.offset());
        assertTrue(store.jobs().isEmpty());
    }

    static class FakeApi implements BotApi {
        final List<String> messages = new ArrayList<>();
        boolean fail;
        @Override public JsonArray updates(long offset) { return new JsonArray(); }
        @Override public void send(long chatId, long messageId, String text) throws Exception {
            if (fail) throw new Exception("offline fixture");
            messages.add(text);
        }
        @Override public void close() { }
    }
}
