package telegram.files;

import cn.hutool.core.util.StrUtil;
import org.drinkless.tdlib.TdApi;
import telegram.files.repository.FileRecord;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class FileSearchFilter {
    private FileSearchFilter() {}

    public static List<String> extensions(String raw) {
        if (StrUtil.isBlank(raw)) return List.of();
        List<String> result = Arrays.stream(raw.toLowerCase(Locale.ROOT).split("[,;\\s]+"))
                .map(s -> s.startsWith(".") ? s.substring(1) : s)
                .filter(s -> !s.isBlank()).distinct().toList();
        if (result.size() > 32 || result.stream().anyMatch(s -> !s.matches("[a-z0-9][a-z0-9_-]{0,15}"))) {
            throw new IllegalArgumentException("Invalid file extensions");
        }
        return result;
    }

    public static boolean matchesExtensions(String name, List<String> extensions) {
        if (extensions == null || extensions.isEmpty()) return true;
        String lower = StrUtil.nullToEmpty(name).toLowerCase(Locale.ROOT);
        return extensions.stream().anyMatch(extension -> lower.endsWith("." + extension));
    }

    public static long[] sizeRange(Map<String, String> filter) {
        String raw = filter.get("sizeRange");
        if (StrUtil.isBlank(raw)) return new long[]{0, Long.MAX_VALUE};
        String[] parts = raw.split(",", -1);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid size range");
        long multiplier = switch (filter.getOrDefault("sizeUnit", "MB")) {
            case "KB" -> 1024L;
            case "MB" -> 1024L * 1024;
            case "GB" -> 1024L * 1024 * 1024;
            default -> throw new IllegalArgumentException("Invalid size unit");
        };
        try {
            long min = parts[0].isBlank() ? 0 : new java.math.BigDecimal(parts[0]).multiply(java.math.BigDecimal.valueOf(multiplier)).setScale(0, java.math.RoundingMode.CEILING).longValueExact();
            long max = parts[1].isBlank() ? Long.MAX_VALUE : new java.math.BigDecimal(parts[1]).multiply(java.math.BigDecimal.valueOf(multiplier)).setScale(0, java.math.RoundingMode.FLOOR).longValueExact();
            if (min < 0 || max < min) throw new IllegalArgumentException("Invalid size range");
            return new long[]{min, max};
        } catch (ArithmeticException | NumberFormatException invalid) {
            throw new IllegalArgumentException("Invalid size range", invalid);
        }
    }

    public static boolean hasMetadataFilter(Map<String, String> filter) {
        return StrUtil.isNotBlank(filter.get("sizeRange")) || StrUtil.isNotBlank(filter.get("extensions"));
    }

    public static boolean matches(TdApi.Message message, Map<String, String> filter) {
        return TdApiHelp.getFileHandler(message).map(handler -> {
            FileRecord file = handler.convertFileRecord(0);
            long[] range = sizeRange(filter);
            return file.size() >= range[0] && file.size() <= range[1]
                    && matchesExtensions(file.fileName(), extensions(filter.get("extensions")));
        }).orElse(false);
    }
}
