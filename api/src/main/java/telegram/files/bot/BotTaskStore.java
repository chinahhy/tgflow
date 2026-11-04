package telegram.files.bot;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** Atomic snapshots couple the polling cursor with queued jobs; failed writes leave memory unchanged. */
public final class BotTaskStore {
    private final Path file;
    private JsonObject state;

    public BotTaskStore(Path directory) throws IOException {
        Files.createDirectories(directory);
        file = directory.resolve("tasks.json");
        try {
            state = Files.exists(file) ? new JsonObject(Files.readString(file))
                    : new JsonObject().put("offset", 0L).put("jobs", new JsonArray());
        } catch (RuntimeException failure) {
            throw new IOException("Invalid bot task state; restore the configuration volume");
        }
        if (state.getLong("offset") == null || state.getJsonArray("jobs") == null)
            throw new IOException("Invalid bot task state; restore the configuration volume");
        // Running yt-dlp jobs resume in their original directory; Telegram jobs reattach to existing downloads.
        change(copy -> copy.getJsonArray("jobs").forEach(item -> {
            JsonObject job = (JsonObject) item;
            if ("RUNNING".equals(job.getString("status"))) job.put("status", "QUEUED");
        }));
    }

    public synchronized long offset() { return state.getLong("offset"); }

    public synchronized List<JsonObject> jobs() {
        List<JsonObject> result = new ArrayList<>();
        state.getJsonArray("jobs").forEach(item -> result.add(((JsonObject) item).copy()));
        return result;
    }

    public synchronized boolean enqueue(long updateId, long chatId, long userId, long messageId,
                                        List<String> links, int limit) throws IOException {
        if (updateId < offset()) return true;
        long pending = jobs().stream().filter(j -> !terminal(j) || !j.getBoolean("notified", false)).count();
        if (pending + links.size() > limit) return false;
        change(copy -> {
            // Bound retained history while keeping every unnotified result and active task.
            JsonArray history = copy.getJsonArray("jobs");
            while (history.size() > 200) {
                int removable = -1;
                for (int i = 0; i < history.size(); i++) {
                    JsonObject job = history.getJsonObject(i);
                    if (terminal(job) && job.getBoolean("notified", false)) { removable = i; break; }
                }
                if (removable < 0) break;
                history.remove(removable);
            }
            for (int i = 0; i < links.size(); i++) history.add(new JsonObject()
                    .put("id", updateId + "-" + i).put("chatId", chatId).put("userId", userId)
                    .put("messageId", messageId).put("url", links.get(i)).put("status", "QUEUED")
                    .put("announced", false).put("notified", false).put("createdAt", System.currentTimeMillis()));
            copy.put("offset", updateId + 1);
        });
        return true;
    }

    public synchronized void advance(long updateId) throws IOException {
        if (updateId >= offset()) change(copy -> copy.put("offset", updateId + 1));
    }

    public synchronized void update(String id, Consumer<JsonObject> update) throws IOException {
        change(copy -> copy.getJsonArray("jobs").forEach(item -> {
            JsonObject job = (JsonObject) item;
            if (id.equals(job.getString("id"))) update.accept(job);
        }));
    }

    private void change(Consumer<JsonObject> update) throws IOException {
        JsonObject copy = state.copy();
        update.accept(copy);
        Path temp = Files.createTempFile(file.getParent(), "tasks-", ".tmp");
        try {
            Files.writeString(temp, copy.encode(), StandardOpenOption.TRUNCATE_EXISTING);
            try (FileChannel channel = FileChannel.open(temp, StandardOpenOption.WRITE)) { channel.force(true); }
            Files.move(temp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            state = copy;
        } finally { Files.deleteIfExists(temp); }
    }

    public static boolean terminal(JsonObject job) {
        return List.of("SUCCEEDED", "FAILED").contains(job.getString("status"));
    }
}
