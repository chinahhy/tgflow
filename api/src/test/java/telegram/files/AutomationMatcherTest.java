package telegram.files;

import org.junit.jupiter.api.Test;
import telegram.files.repository.SettingAutoRecords;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AutomationMatcherTest {
    @Test
    void typesSizesExtensionsAndKeywordsApplyToTheSameMessage() {
        var rule = new SettingAutoRecords.DownloadRule();
        rule.fileTypes = List.of("视频"); // Repair settings saved by the earlier translated select.
        rule.minSize = 100L;
        rule.maxSize = 200L;
        rule.extensions = List.of("mp4");
        rule.query = "example Movie";
        rule.filterExpr = "f.size() >= 100";
        assertTrue(AutomationMatcher.matches(TestMessages.file(1, "Movie.MP4", 150, true), rule));
        assertFalse(AutomationMatcher.matches(TestMessages.file(2, "Movie.MP4", 99, true), rule));
        assertFalse(AutomationMatcher.matches(TestMessages.file(3, "Movie.MP4", 201, true), rule));
        assertFalse(AutomationMatcher.matches(TestMessages.file(4, "Other.MP4", 150, true), rule));
        assertFalse(AutomationMatcher.matches(TestMessages.file(5, "Movie.MKV", 150, true), rule));
        assertFalse(AutomationMatcher.matches(TestMessages.file(6, "Movie.MP4", 150, false), rule));
    }

    @Test
    void documentVideosCanBeMatchedByExtensionAndInvalidExpressionsDoNotDownload() {
        var rule = new SettingAutoRecords.DownloadRule();
        rule.extensions = List.of("mkv");
        assertTrue(AutomationMatcher.matches(TestMessages.file(1, "Film.mkv", 1024, false), rule));
        rule.filterExpr = "not valid (";
        assertFalse(AutomationMatcher.matches(TestMessages.file(1, "Film.mkv", 1024, false), rule));
    }
}
