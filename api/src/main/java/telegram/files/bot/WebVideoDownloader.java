package telegram.files.bot;

import io.vertx.core.json.JsonObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** yt-dlp is invoked directly, with no shell, user config, plugins or user-supplied flags. */
public final class WebVideoDownloader implements BotDownloader {
    private final BotConfiguration config;
    private final Path root;

    public WebVideoDownloader(BotConfiguration config, Path root) {
        this.config = config;
        this.root = root.toAbsolutePath().normalize();
    }

    List<String> command(String url, Path directory) {
        var args = new ArrayList<>(List.of(config.executable(), "--ignore-config", "--no-plugin-dirs",
                "--no-playlist", "--playlist-items", "1", "--match-filters", "!is_live",
                "--no-progress", "--no-colors", "--socket-timeout", "30", "--retries", "3",
                "--fragment-retries", "3", "--js-runtimes", "node", "--no-remote-components",
                "--max-filesize", config.maxFileSize(), "--windows-filenames", "--trim-filenames", "180",
                "--paths", directory.toString(), "--output", "%(title).150B [%(id)s].%(ext)s",
                "--print", "after_move:TGFlowFile:%(filepath)j"));
        if (!config.proxy().isBlank()) { args.add("--proxy"); args.add(config.proxy()); }
        if (config.cookies() != null) { args.add("--cookies"); args.add(config.cookies().toString()); }
        args.add("--");
        args.add(url);
        return args;
    }

    @Override public String download(JsonObject job) throws Exception {
        Path directory = root.resolve(job.getString("id")).normalize();
        if (!directory.startsWith(root)) throw new BotDownloadException("下载任务目录无效");
        Files.createDirectories(directory);
        if (!directory.toRealPath().startsWith(root.toRealPath())) throw new BotDownloadException("下载任务目录无效");
        if (config.cookies() != null && !Files.isRegularFile(config.cookies()))
            throw new BotDownloadException("Cookies 文件不存在，请检查 Compose 挂载");
        // yt-dlp writes its cookie jar on exit. Copy a read-only mounted jar into a private temporary file.
        Path cookieJar = null;
        List<String> args = command(job.getString("url"), directory);
        if (config.cookies() != null) {
            cookieJar = Files.createTempFile("tgflow-cookies-", ".txt");
            try { Files.write(cookieJar, Files.readAllBytes(config.cookies())); }
            catch (Exception failure) { Files.deleteIfExists(cookieJar); throw failure; }
            args.set(args.indexOf("--cookies") + 1, cookieJar.toString());
        }
        Process process;
        try {
            var builder = new ProcessBuilder(args).redirectErrorStream(true);
            builder.environment().keySet().removeIf(key -> key.startsWith("TGFLOW_BOT_")
                    || key.contains("TOKEN") || key.contains("PASSWORD") || key.contains("API_KEY") || key.contains("API_HASH"));
            process = builder.start();
        } catch (java.io.IOException failure) {
            if (cookieJar != null) Files.deleteIfExists(cookieJar);
            throw new BotDownloadException("无法启动 yt-dlp，请检查镜像或 TGFLOW_BOT_YTDLP_PATH");
        }
        AtomicReference<String> output = new AtomicReference<>();
        AtomicReference<String> error = new AtomicReference<>("网站下载失败，请检查链接、站点限制或 Cookies");
        Thread reader = Thread.ofVirtual().start(() -> {
            try (var stream = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = stream.readLine()) != null) {
                    if (line.startsWith("TGFlowFile:")) output.set(line.substring("TGFlowFile:".length()));
                    // Raw output may contain signed URLs or credentials. Keep only predefined diagnostics.
                    if (line.contains("Unsupported URL")) error.set("yt-dlp 暂不支持这个视频链接");
                    if (line.contains("Sign in") || line.contains("cookies") || line.contains("HTTP Error 403"))
                        error.set("网站要求登录或拒绝访问，请配置有效 Cookies 后重新发送链接");
                    if (line.contains("No space left")) error.set("下载目录空间不足");
                    if (line.contains("larger than max-filesize")) error.set("视频超过配置的文件大小上限");
                }
            } catch (java.io.IOException ignored) { }
        });
        try {
            if (!process.waitFor(config.timeoutSeconds(), TimeUnit.SECONDS))
                throw new BotDownloadException("网页视频下载超时，请检查网络或增加下载超时设置");
            reader.join(5000);
            if (process.exitValue() != 0 || output.get() == null) throw new BotDownloadException(error.get());
            String path = io.vertx.core.json.Json.decodeValue(output.get(), String.class);
            Path completed = Path.of(path).toRealPath();
            if (!completed.startsWith(directory.toRealPath()) || !Files.isRegularFile(completed) || Files.size(completed) == 0)
                throw new BotDownloadException("下载器未生成有效视频文件");
            return root.getParent().getParent().toRealPath().relativize(completed).toString();
        } finally {
            // ffmpeg may be a child; terminate children before the parent on shutdown/timeout.
            process.descendants().forEach(child -> { if (child.isAlive()) child.destroyForcibly(); });
            if (process.isAlive()) process.destroyForcibly();
            reader.interrupt();
            if (cookieJar != null) Files.deleteIfExists(cookieJar);
        }
    }
}
