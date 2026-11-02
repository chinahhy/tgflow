package telegram.files;

import org.drinkless.tdlib.TdApi;

final class TestMessages {
    private TestMessages() {}

    static TdApi.Message file(long messageId, String name, long size, boolean video) {
        TdApi.File file = new TdApi.File();
        file.id = (int) messageId;
        file.size = size;
        file.remote = new TdApi.RemoteFile();
        file.remote.uniqueId = "test-file-" + messageId;
        TdApi.Message message = new TdApi.Message();
        message.id = messageId;
        message.chatId = -100;
        if (video) {
            TdApi.Video media = new TdApi.Video();
            media.video = file;
            media.fileName = name;
            media.mimeType = "video/mp4";
            TdApi.MessageVideo content = new TdApi.MessageVideo();
            content.video = media;
            content.caption = new TdApi.FormattedText("Example caption", new TdApi.TextEntity[0]);
            message.content = content;
        } else {
            TdApi.Document document = new TdApi.Document();
            document.document = file;
            document.fileName = name;
            document.mimeType = "application/octet-stream";
            TdApi.MessageDocument content = new TdApi.MessageDocument();
            content.document = document;
            content.caption = new TdApi.FormattedText("Example caption", new TdApi.TextEntity[0]);
            message.content = content;
        }
        return message;
    }
}
