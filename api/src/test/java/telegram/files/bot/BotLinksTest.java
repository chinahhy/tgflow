package telegram.files.bot;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BotLinksTest {
    @Test void honorsTelegramUrlEntityBoundariesAfterEmojiAndInsideParentheses() {
        String url = "https://youtu.be/example";
        String text = "🎬（" + url + "）";
        assertEquals(List.of(url), BotLinks.extract(new JsonObject().put("text", text)
                .put("entities", new JsonArray().add(new JsonObject().put("type", "url")
                        .put("offset", 3).put("length", url.length())))));
    }

    @Test void extractsCaptionHiddenLinksAndPublicAndPrivateChannelForwards() {
        assertEquals(List.of("https://youtu.be/one", "https://www.bilibili.com/video/BVexample"), BotLinks.extract(
                new JsonObject().put("caption", "分享 https://youtu.be/one， https://youtu.be/one")
                        .put("caption_entities", new JsonArray().add(new JsonObject().put("type", "text_link")
                                .put("url", "https://www.bilibili.com/video/BVexample")))));
        JsonObject origin = new JsonObject().put("type", "channel").put("message_id", 15L)
                .put("chat", new JsonObject().put("id", -1001234567890L));
        assertEquals(List.of("https://t.me/c/1234567890/15"), BotLinks.extract(new JsonObject().put("forward_origin", origin)));
        origin.getJsonObject("chat").put("username", "example_channel");
        assertEquals(List.of("https://t.me/example_channel/15"), BotLinks.extract(new JsonObject().put("forward_origin", origin)));
        assertTrue(BotLinks.telegram("https://t.me/c/123/15"));
        assertFalse(BotLinks.telegram("https://t.me.example.com/video"));
    }

    @Test void rejectsCredentialUrlsAndNonHttpHiddenLinks() {
        JsonArray entities = new JsonArray();
        for (String link : List.of("file:///etc/passwd", "javascript:alert(1)", "https://user:password@example.com/"))
            entities.add(new JsonObject().put("type", "text_link").put("url", link));
        assertTrue(BotLinks.extract(new JsonObject().put("entities", entities)).isEmpty());
    }

    @Test void disabledByDefaultAndEnabledBotRequiresAllowlistWithoutLeakingToken() {
        assertNull(BotConfiguration.from(Map.of()));
        var failure = assertThrows(IllegalArgumentException.class,
                () -> BotConfiguration.from(Map.of("TGFLOW_BOT_TOKEN", "12345:private-fixture")));
        assertFalse(failure.getMessage().contains("private-fixture"));
        assertFalse(BotServiceTest.config().toString().contains("test-only-placeholder"));
        var options = TelegramBotApi.proxy("socks5://test%2Buser:test%3Apass@127.0.0.1:1080");
        assertEquals("test+user", options.getUsername());
        assertEquals("test:pass", options.getPassword());
    }
}
