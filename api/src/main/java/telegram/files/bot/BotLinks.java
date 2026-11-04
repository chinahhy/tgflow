package telegram.files.bot;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class BotLinks {
    private static final Pattern URL = Pattern.compile("https?://[^\\s<>\"\\p{Cntrl}]+", Pattern.CASE_INSENSITIVE);
    private BotLinks() {}

    public static List<String> extract(JsonObject message) {
        var links = new LinkedHashSet<String>();
        for (String field : List.of("text", "caption")) {
            String text = message.getString(field, "");
            JsonArray entities = message.getJsonArray(field.equals("text") ? "entities" : "caption_entities", new JsonArray());
            var spans = new java.util.ArrayList<int[]>();
            for (Object item : entities) {
                JsonObject entity = (JsonObject) item;
                if ("url".equals(entity.getString("type"))) {
                    int start = entity.getInteger("offset", -1), length = entity.getInteger("length", 0);
                    // Telegram offsets and Java substring both count UTF-16 code units, including emoji pairs.
                    if (start >= 0 && length > 0 && start <= text.length() && length <= text.length() - start) {
                        add(links, text.substring(start, start + length));
                        spans.add(new int[]{start, start + length});
                    }
                }
            }
            var matcher = URL.matcher(text);
            while (matcher.find()) {
                int start = matcher.start();
                if (spans.stream().noneMatch(span -> start >= span[0] && start < span[1]))
                    add(links, matcher.group().replaceAll("[。，、；！？」』】>.,;!?]+$", ""));
            }
            for (Object item : entities) {
                JsonObject entity = (JsonObject) item;
                if ("text_link".equals(entity.getString("type"))) add(links, entity.getString("url", ""));
            }
        }
        // A channel forward carries its source message even without a URL/caption.
        JsonObject origin = message.getJsonObject("forward_origin");
        if (origin != null && "channel".equals(origin.getString("type"))) {
            JsonObject chat = origin.getJsonObject("chat", new JsonObject());
            Long id = chat.getLong("id");
            Long messageId = origin.getLong("message_id");
            if (id != null && messageId != null && messageId > 0) {
                String username = chat.getString("username");
                if (username != null && username.matches("[A-Za-z0-9_]+"))
                    add(links, "https://t.me/" + username + "/" + messageId);
                else if (id.toString().startsWith("-100"))
                    add(links, "https://t.me/c/" + id.toString().substring(4) + "/" + messageId);
            }
        }
        return List.copyOf(links);
    }

    private static void add(LinkedHashSet<String> links, String value) {
        try {
            URI uri = URI.create(value);
            if (List.of("http", "https").contains(uri.getScheme().toLowerCase(Locale.ROOT))
                    && uri.getHost() != null && uri.getUserInfo() == null && value.length() <= 4096) links.add(value);
        } catch (IllegalArgumentException | NullPointerException ignored) { }
    }

    public static boolean telegram(String link) {
        String host = URI.create(link).getHost().toLowerCase(Locale.ROOT);
        return List.of("t.me", "www.t.me", "telegram.me", "www.telegram.me").contains(host);
    }
}
