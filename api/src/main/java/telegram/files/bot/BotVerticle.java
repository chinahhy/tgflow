package telegram.files.bot;

import io.vertx.core.AbstractVerticle;
import io.vertx.core.Promise;
import telegram.files.Config;

import java.nio.file.Path;

public final class BotVerticle extends AbstractVerticle {
    private BotService service;

    @Override public void start(Promise<Void> promise) {
        vertx.<Void>executeBlocking(() -> {
            BotConfiguration config = BotConfiguration.from(System.getenv());
            if (config == null) return null;
            BotTaskStore store = new BotTaskStore(Path.of(Config.APP_ROOT, "bot", config.botId()));
            BotApi api = new TelegramBotApi(vertx, config);
            var web = new WebVideoDownloader(config, Path.of(Config.DOWNLOAD_ROOT, "bot", config.botId()));
            var telegram = new TelegramLinkDownloader(config);
            service = new BotService(config, store, api,
                    job -> BotLinks.telegram(job.getString("url")) ? telegram.download(job) : web.download(job));
            service.start();
            return null;
        }).onComplete(promise);
    }

    @Override public void stop(Promise<Void> promise) {
        vertx.<Void>executeBlocking(() -> {
            if (service != null) service.close();
            return null;
        }).onComplete(promise);
    }
}
