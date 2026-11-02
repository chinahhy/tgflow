package telegram.files;

import io.vertx.core.Future;
import org.drinkless.tdlib.TdApi;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Bounded scanning preserves Telegram's cursor even when an entire page is filtered out. */
public final class OnlineFileSearch {
    private OnlineFileSearch() {}

    public static Future<TdApi.FoundChatMessages> search(TdApi.SearchChatMessages request,
                                                       Map<String, String> filter,
                                                       Function<TdApi.SearchChatMessages, Future<TdApi.FoundChatMessages>> fetch) {
        FileSearchFilter.sizeRange(filter);
        FileSearchFilter.extensions(filter.get("extensions"));
        return scan(request, filter, fetch, new ArrayList<>(), Math.max(1, Math.min(request.limit, 100)), 0);
    }

    private static Future<TdApi.FoundChatMessages> scan(TdApi.SearchChatMessages request,
                                                       Map<String, String> filter,
                                                       Function<TdApi.SearchChatMessages, Future<TdApi.FoundChatMessages>> fetch,
                                                       List<TdApi.Message> matches, int target, int pages) {
        request.limit = target - matches.size();
        long previousCursor = request.fromMessageId;
        return fetch.apply(request).compose(found -> {
            for (TdApi.Message message : found.messages) {
                if (!FileSearchFilter.matches(message, filter)) continue;
                if ("idle".equals(filter.get("downloadStatus"))) {
                    var file = TdApiHelp.getFileHandler(message).map(TdApiHelp.FileHandler::getFile).orElse(null);
                    if (file == null || (file.local != null && (file.local.isDownloadingActive
                            || file.local.isDownloadingCompleted || file.local.downloadedSize > 0))) continue;
                }
                matches.add(message);
            }
            long next = found.nextFromMessageId == previousCursor ? 0 : found.nextFromMessageId;
            if (matches.size() >= target || next == 0 || pages >= 7) {
                found.messages = matches.toArray(TdApi.Message[]::new);
                found.nextFromMessageId = next;
                return Future.succeededFuture(found);
            }
            request.fromMessageId = next;
            return scan(request, filter, fetch, matches, target, pages + 1);
        });
    }
}
