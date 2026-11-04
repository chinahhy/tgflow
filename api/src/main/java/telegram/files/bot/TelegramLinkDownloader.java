package telegram.files.bot;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import telegram.files.DataVerticle;
import telegram.files.TelegramVerticle;
import telegram.files.TelegramVerticles;
import telegram.files.repository.FileRecord;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Run on the bot worker, never on a Vert.x event loop. Completion means an actual file on disk. */
public final class TelegramLinkDownloader implements BotDownloader {
    private final BotConfiguration config;

    public TelegramLinkDownloader(BotConfiguration config) { this.config = config; }

    @Override public String download(JsonObject job) throws Exception {
        TelegramVerticle account;
        if (!config.telegramId().isBlank()) {
            account = TelegramVerticles.get(config.telegramId()).filter(TelegramVerticle::isAvailable)
                    .orElseThrow(() -> new BotDownloadException("指定的 Telegram 账号未登录，请在 TGFlow 账号管理中登录"));
        } else {
            var available = TelegramVerticles.getAll().stream().filter(TelegramVerticle::isAvailable).toList();
            if (available.size() != 1) throw new BotDownloadException("请登录一个 Telegram 账号；多账号时配置 TGFLOW_BOT_TELEGRAM_ID");
            account = available.getFirst();
        }
        JsonArray files;
        try { files = await(account.parseLink(job.getString("url"))).getJsonArray("files"); }
        catch (InterruptedException failure) { throw failure; }
        catch (Exception failure) { throw new BotDownloadException("Telegram 链接解析失败，请确认账号有权访问该聊天和消息"); }
        if (files == null || files.isEmpty()) throw new BotDownloadException("该 Telegram 消息没有可下载的附件");
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(config.timeoutSeconds());
        List<String> saved = new ArrayList<>();
        for (Object item : files) {
            JsonObject file = (JsonObject) item;
            String uniqueId = file.getString("uniqueId");
            FileRecord existing = await(DataVerticle.fileRepository.getByUniqueId(uniqueId));
            if (existing == null || (!existing.isDownloadStatus(FileRecord.DownloadStatus.completed)
                    && !existing.isDownloadStatus(FileRecord.DownloadStatus.downloading))) {
                try { await(account.startDownload(file.getLong("chatId"), file.getLong("messageId"), file.getInteger("id"))); }
                catch (InterruptedException failure) { throw failure; }
                catch (Exception failure) { throw new BotDownloadException("Telegram 下载无法启动，请检查账号连接和文件权限"); }
            }
            while (true) {
                FileRecord record = await(DataVerticle.fileRepository.getByUniqueId(uniqueId));
                if (record != null && record.isDownloadStatus(FileRecord.DownloadStatus.error))
                    throw new BotDownloadException("Telegram 文件下载失败，请在 TGFlow 下载页面查看原因（部分附件可能已保存）");
                if (record != null && record.isDownloadStatus(FileRecord.DownloadStatus.paused))
                    throw new BotDownloadException("Telegram 文件下载已暂停，请在 TGFlow 中继续或重新发送链接");
                if (record != null && record.isDownloadStatus(FileRecord.DownloadStatus.completed)
                        && record.localPath() != null && Files.isRegularFile(Path.of(record.localPath()))) {
                    saved.add(record.fileName());
                    break;
                }
                if (System.nanoTime() >= deadline)
                    throw new BotDownloadException("等待 Telegram 下载超时，任务可能仍在 TGFlow 中继续，请查看下载页面");
                Thread.sleep(1000);
            }
        }
        return "已保存 " + saved.size() + " 个附件：" + String.join("、", saved);
    }

    private static <T> T await(Future<T> future) throws Exception {
        return future.toCompletionStage().toCompletableFuture().get(60, TimeUnit.SECONDS);
    }
}
