package telegram.files.bot;

import cn.hutool.log.Log;
import cn.hutool.log.LogFactory;
import io.vertx.core.json.JsonObject;

import java.util.ArrayList;
import java.util.List;

/** Independent polling, download and durable notification loops prevent slow downloads blocking the bot. */
public final class BotService implements AutoCloseable {
    private static final Log log = LogFactory.get();
    private static final String HELP = "发送或转发视频链接即可后台下载，支持 Telegram、YouTube、B站等 yt-dlp 支持的网站。\n"
            + "也可直接转发频道消息。每条消息最多 10 个链接；文件保存在服务器，完成和失败都会通知。\n"
            + "/status 查看最近任务；/help 查看帮助。";
    private final BotConfiguration config;
    private final BotTaskStore store;
    private final BotApi api;
    private final BotDownloader downloader;
    private final List<Thread> threads = new ArrayList<>();
    private volatile boolean closed;

    public BotService(BotConfiguration config, BotTaskStore store, BotApi api, BotDownloader downloader) {
        this.config = config;
        this.store = store;
        this.api = api;
        this.downloader = downloader;
    }

    public void start() {
        threads.add(Thread.ofVirtual().name("tgflow-bot-poll").start(() -> loop(() -> {
            var updates = api.updates(store.offset());
            for (Object item : updates) {
                if (closed) return;
                ingest((JsonObject) item);
            }
        }, 0)));
        threads.add(Thread.ofVirtual().name("tgflow-bot-download").start(() -> loop(this::workOnce, 500)));
        threads.add(Thread.ofVirtual().name("tgflow-bot-notify").start(() -> loop(this::notifyOnce, 1000)));
    }

    private void loop(Action action, long interval) {
        while (!closed && !Thread.currentThread().isInterrupted()) {
            try {
                action.run();
                if (interval > 0) Thread.sleep(interval);
            } catch (InterruptedException failure) { Thread.currentThread().interrupt(); return; }
            catch (Exception failure) {
                // Never log incoming updates, URLs, bot tokens, cookies or underlying HTTP exceptions.
                log.warn("Telegram Bot operation will retry ({})", failure.getClass().getSimpleName());
                long delay = failure instanceof TelegramBotApi.ApiFailure apiFailure ? apiFailure.retryAfter * 1000L : 5000L;
                try { Thread.sleep(delay); }
                catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); return; }
            }
        }
    }

    void ingest(JsonObject update) throws Exception {
        long updateId = update.getLong("update_id");
        if (updateId < store.offset()) return;
        JsonObject message = update.getJsonObject("message");
        JsonObject from = message == null ? null : message.getJsonObject("from");
        JsonObject chat = message == null ? null : message.getJsonObject("chat");
        if (from == null || chat == null || !"private".equals(chat.getString("type"))
                || from.getBoolean("is_bot", false) || !config.allowedUsers().contains(from.getLong("id"))) {
            store.advance(updateId);
            return;
        }
        long chatId = chat.getLong("id"), userId = from.getLong("id"), messageId = message.getLong("message_id");
        String text = message.getString("text", "").strip();
        if (text.matches("/(start|help)(@[A-Za-z0-9_]+)?")) {
            api.send(chatId, messageId, HELP);
            store.advance(updateId);
            return;
        }
        if (text.matches("/status(@[A-Za-z0-9_]+)?")) {
            var own = store.jobs().stream().filter(j -> j.getLong("userId") == userId).toList();
            StringBuilder status = new StringBuilder("最近任务：\n");
            own.stream().skip(Math.max(0, own.size() - 10)).forEach(j -> status.append(j.getString("id"))
                    .append(" · ").append(label(j.getString("status"))).append('\n'));
            if (own.isEmpty()) status.append("暂无任务");
            api.send(chatId, messageId, status.toString());
            store.advance(updateId);
            return;
        }
        List<String> links = BotLinks.extract(message);
        if (links.isEmpty() || links.size() > 10) {
            api.send(chatId, messageId, links.isEmpty()
                    ? "没有找到视频链接。请发送 http(s) 链接，或转发带来源的频道消息。\n/help 查看帮助。"
                    : "每条消息最多接收 10 个链接，请分批发送。");
            store.advance(updateId);
        } else if (!store.enqueue(updateId, chatId, userId, messageId, links, config.queueLimit())) {
            api.send(chatId, messageId, "下载队列已满，请稍后重新发送链接。");
            store.advance(updateId);
        }
    }

    void workOnce() throws Exception {
        JsonObject job = store.jobs().stream().filter(j -> !BotTaskStore.terminal(j)).findFirst().orElse(null);
        if (job == null) return;
        String id = job.getString("id");
        if (!config.allowedUsers().contains(job.getLong("userId"))) {
            store.update(id, j -> j.put("status", "FAILED").put("result", "使用权限已撤销")
                    .put("announced", true).put("notified", true));
            return;
        }
        store.update(id, j -> j.put("status", "RUNNING"));
        String result;
        String status;
        try {
            result = downloader.download(job);
            status = "SUCCEEDED";
        } catch (InterruptedException failure) { throw failure; }
        catch (Exception failure) {
            result = safeFailure(failure);
            status = "FAILED";
        }
        String finalStatus = status, finalResult = limit(result, 2800);
        store.update(id, j -> j.put("status", finalStatus).put("result", finalResult)
                .put("finishedAt", System.currentTimeMillis()));
    }

    void notifyOnce() throws Exception {
        for (JsonObject job : store.jobs()) {
            if (closed) return;
            String id = job.getString("id");
            if (!config.allowedUsers().contains(job.getLong("userId"))) {
                if (BotTaskStore.terminal(job) && !job.getBoolean("notified", false))
                    store.update(id, j -> j.put("announced", true).put("notified", true));
                continue;
            }
            if (job.getLong("notifyAfter", 0L) > System.currentTimeMillis()) continue;
            try {
                if (!job.getBoolean("announced", false)) {
                    api.send(job.getLong("chatId"), job.getLong("messageId"), "已加入下载队列 · " + id);
                    store.update(id, j -> j.put("announced", true));
                }
                if (BotTaskStore.terminal(job) && !job.getBoolean("notified", false)) {
                    api.send(job.getLong("chatId"), job.getLong("messageId"),
                            ("SUCCEEDED".equals(job.getString("status")) ? "✅ 下载成功" : "❌ 下载失败")
                                    + " · " + id + "\n" + job.getString("result", ""));
                    store.update(id, j -> j.put("notified", true));
                }
            } catch (TelegramBotApi.ApiFailure failure) {
                if (failure.code == 429) throw failure; // Telegram's rate limit applies across sends.
                store.update(id, j -> j.put("notifyAfter", System.currentTimeMillis() + 60_000));
                // A blocked recipient must not prevent other users from receiving their results.
            }
        }
    }

    private static String safeFailure(Exception failure) {
        // Only our own deliberate, credential-free errors are suitable for persistence and delivery.
        if (failure instanceof BotDownloadException) return failure.getMessage();
        return "下载处理失败，请检查网络、下载目录权限及账号连接后重新发送链接";
    }

    private static String limit(String text, int length) {
        return text == null ? "" : text.substring(0, Math.min(text.length(), length));
    }

    private static String label(String status) {
        return switch (status) {
            case "QUEUED" -> "排队中";
            case "RUNNING" -> "下载中";
            case "SUCCEEDED" -> "成功";
            default -> "失败";
        };
    }

    @Override public void close() {
        closed = true;
        threads.forEach(Thread::interrupt);
        api.close();
        for (Thread thread : threads) {
            try { thread.join(5000); }
            catch (InterruptedException failure) { Thread.currentThread().interrupt(); return; }
        }
    }

    @FunctionalInterface private interface Action { void run() throws Exception; }
}
