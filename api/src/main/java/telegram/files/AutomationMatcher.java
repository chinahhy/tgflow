package telegram.files;

import cn.hutool.core.util.StrUtil;
import org.drinkless.tdlib.TdApi;
import telegram.files.repository.FileRecord;
import telegram.files.repository.SettingAutoRecords;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** The same eligibility rules are used for historical scans and incoming messages. */
public final class AutomationMatcher {
    private AutomationMatcher() {}

    public static String normalizeType(String type) {
        if (type == null) return "";
        return switch (type) {
            case "图片" -> "photo";
            case "视频" -> "video";
            case "音频" -> "audio";
            case "文件" -> "file";
            default -> type;
        };
    }

    public static List<String> fileTypes(SettingAutoRecords.DownloadRule rule) {
        if (rule == null || rule.fileTypes == null || rule.fileTypes.isEmpty()) {
            return List.of("photo", "video", "audio", "file");
        }
        return rule.fileTypes.stream().map(AutomationMatcher::normalizeType).distinct().toList();
    }

    public static boolean matches(TdApi.Message message, SettingAutoRecords.DownloadRule rule) {
        var handler = TdApiHelp.getFileHandler(message);
        if (handler.isEmpty()) return false;
        FileRecord file = handler.get().convertFileRecord(0);
        if (!fileTypes(rule).contains(file.type())) return false;
        if (rule == null) return true;
        if (rule.minSize != null && file.size() < rule.minSize) return false;
        if (rule.maxSize != null && file.size() > rule.maxSize) return false;
        if (!FileSearchFilter.matchesExtensions(file.fileName(), rule.extensions)) return false;
        if (StrUtil.isNotBlank(rule.query)) {
            String searchable = (StrUtil.nullToEmpty(file.fileName()) + " " + StrUtil.nullToEmpty(file.caption()))
                    .toLowerCase(Locale.ROOT);
            if (Arrays.stream(rule.query.trim().toLowerCase(Locale.ROOT).split("\\s+"))
                    .anyMatch(word -> !searchable.contains(word))) return false;
        }
        try {
            return MessageFilter.filter(rule.filterExpr).test(message);
        } catch (RuntimeException invalidExpression) {
            return false;
        }
    }

    public static void validate(SettingAutoRecords.DownloadRule rule) {
        if (rule == null) throw new IllegalArgumentException("Download rules are required");
        if ((rule.minSize != null && rule.minSize < 0)
                || (rule.maxSize != null && rule.maxSize < (rule.minSize == null ? 0 : rule.minSize))) {
            throw new IllegalArgumentException("Invalid size range");
        }
        List<String> types = fileTypes(rule);
        if (!List.of("photo", "video", "audio", "file").containsAll(types)) throw new IllegalArgumentException("Invalid file types");
        rule.fileTypes = types;
        if (rule.extensions != null) rule.extensions = FileSearchFilter.extensions(String.join(",", rule.extensions));
        if (StrUtil.isNotBlank(rule.filterExpr)) MessageFilter.getExpression(rule.filterExpr);
    }
}
