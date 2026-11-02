package telegram.files;

import telegram.files.repository.FileRecord;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;

/** TDLib staging and final media live on the download volume; account databases do not. */
public final class DownloadStorage {
    private final Path root;
    private final List<Path> sourceRoots;

    public DownloadStorage(Path root, List<Path> legacyRoots) {
        this.root = root.toAbsolutePath().normalize();
        var roots = new java.util.ArrayList<Path>();
        roots.add(this.root);
        legacyRoots.forEach(path -> roots.add(path.toAbsolutePath().normalize()));
        this.sourceRoots = List.copyOf(roots);
    }

    public static DownloadStorage configured() {
        return Configured.INSTANCE;
    }

    private static final class Configured {
        private static final DownloadStorage INSTANCE = new DownloadStorage(Path.of(Config.DOWNLOAD_ROOT),
                List.of(Path.of(Config.TELEGRAM_ROOT)));
    }

    public Path filesDirectory(String accountRoot) throws IOException {
        Path directory = root.resolve(".tdlib").resolve(digest(Path.of(accountRoot).getFileName().toString()));
        Files.createDirectories(directory);
        requireInside(directory, root);
        return directory;
    }

    public boolean isFinalized(String path) {
        if (path == null) return false;
        try {
            return Files.isRegularFile(Path.of(path)) && Path.of(path).toRealPath().startsWith(root.resolve("files").toRealPath());
        } catch (IOException ignored) {
            return false;
        }
    }

    public synchronized String publish(FileRecord record, String sourcePath) throws IOException {
        if ("thumbnail".equals(record.type())) return sourcePath;
        if (isFinalized(record.localPath())) return record.localPath();
        if (sourcePath == null || sourcePath.isBlank()) throw new IOException("Downloaded file path is missing");
        Path source = Path.of(sourcePath).toAbsolutePath().normalize();
        Path directory = root.resolve("files").resolve(Long.toString(record.telegramId()))
                .resolve(Long.toString(record.chatId()))
                .resolve(record.messageId() + "-" + digest(record.uniqueId()));
        Files.createDirectories(directory);
        requireInside(directory, root);
        Path target = directory.resolve(safeFileName(record.fileName(), source.getFileName().toString()));
        if (Files.exists(target)) {
            requireInside(target, root);
            if (record.size() > 0 && Files.size(target) != record.size()) {
                throw new IOException("An existing destination file has a different size; it was not overwritten");
            }
            return target.toString();
        }
        boolean allowed = false;
        for (Path allowedRoot : sourceRoots) {
            if (Files.isDirectory(allowedRoot) && source.toRealPath().startsWith(allowedRoot.toRealPath())) allowed = true;
        }
        if (!allowed || !Files.isRegularFile(source)) throw new IOException("Downloaded file is outside the configured storage roots");
        if (record.size() > 0 && Files.size(source) != record.size()) throw new IOException("Downloaded file size does not match the attachment");
        Files.move(source, target);
        return target.toString();
    }

    private static void requireInside(Path path, Path root) throws IOException {
        if (!path.toRealPath().startsWith(root.toRealPath())) throw new IOException("Storage path escapes the configured download directory");
    }

    public static String safeFileName(String original, String fallback) {
        String name = original == null || original.isBlank() ? fallback : original;
        name = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").replaceAll("[. ]+$", "").strip();
        if (name.isBlank() || name.equals(".") || name.equals("..")) name = "attachment";
        int dot = name.lastIndexOf('.');
        String suffix = dot > 0 && name.length() - dot < 20 ? name.substring(dot) : "";
        String stem = suffix.isEmpty() ? name : name.substring(0, dot);
        while ((stem + suffix).getBytes(StandardCharsets.UTF_8).length > 240) {
            stem = stem.substring(0, stem.offsetByCodePoints(stem.length(), -1));
        }
        return stem + suffix;
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8))).substring(0, 16);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
