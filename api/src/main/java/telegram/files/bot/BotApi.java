package telegram.files.bot;

import io.vertx.core.json.JsonArray;

public interface BotApi extends AutoCloseable {
    JsonArray updates(long offset) throws Exception;
    void send(long chatId, long messageId, String text) throws Exception;
    @Override void close();
}
