package telegram.files.bot;

import io.vertx.core.json.JsonObject;

@FunctionalInterface
public interface BotDownloader {
    /** Return a short human-readable result. Throw only credential-free diagnostics. */
    String download(JsonObject job) throws Exception;
}
