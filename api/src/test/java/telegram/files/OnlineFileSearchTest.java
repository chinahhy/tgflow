package telegram.files;

import io.vertx.core.Future;
import org.drinkless.tdlib.TdApi;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class OnlineFileSearchTest {
    @Test
    void continuesPastEmptyFilteredPagesWithoutLosingTheTelegramCursor() {
        var request = new TdApi.SearchChatMessages();
        request.limit = 2;
        AtomicInteger calls = new AtomicInteger();
        var result = OnlineFileSearch.search(request, Map.of("extensions", "mkv"), query -> {
            int page = calls.incrementAndGet();
            assertEquals((page - 1) * 100L, query.fromMessageId);
            var found = new TdApi.FoundChatMessages();
            found.totalCount = 1000;
            found.nextFromMessageId = page * 100L;
            found.messages = new TdApi.Message[]{TestMessages.file(page, page < 3 ? "skip.zip" : "keep.MKV", 100, false)};
            return Future.succeededFuture(found);
        }).toCompletionStage().toCompletableFuture().join();
        assertEquals(4, calls.get());
        assertEquals(2, result.messages.length);
        assertEquals(3, result.messages[0].id);
        assertEquals(400, result.nextFromMessageId);
    }

    @Test
    void boundsSparseScansButRetainsContinuationAndSupportsDecimalRanges() {
        var request = new TdApi.SearchChatMessages();
        request.limit = 20;
        AtomicInteger calls = new AtomicInteger();
        var result = OnlineFileSearch.search(request, Map.of("sizeRange", "1.5,2", "sizeUnit", "GB"), query -> {
            calls.incrementAndGet();
            var found = new TdApi.FoundChatMessages();
            found.nextFromMessageId = query.fromMessageId + 1;
            found.messages = new TdApi.Message[]{TestMessages.file(1, "small.zip", 10, false)};
            return Future.succeededFuture(found);
        }).toCompletionStage().toCompletableFuture().join();
        assertEquals(8, calls.get());
        assertEquals(0, result.messages.length);
        assertEquals(8, result.nextFromMessageId);
        assertArrayEquals(new long[]{1610612736L, 2147483648L}, FileSearchFilter.sizeRange(Map.of("sizeRange", "1.5,2", "sizeUnit", "GB")));
        assertThrows(IllegalArgumentException.class, () -> FileSearchFilter.extensions("mp4,%' OR 1=1"));
        assertThrows(IllegalArgumentException.class, () -> FileSearchFilter.sizeRange(Map.of("sizeRange", "2,1")));
    }
}
