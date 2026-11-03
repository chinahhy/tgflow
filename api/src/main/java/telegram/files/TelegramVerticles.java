package telegram.files;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.convert.Convert;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.NumberUtil;
import cn.hutool.log.Log;
import cn.hutool.log.LogFactory;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.VertxException;
import telegram.files.repository.TelegramRecord;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class TelegramVerticles {
    private static final Log log = LogFactory.get();

    private static final List<TelegramVerticle> telegramVerticles = new ArrayList<>();

    private static TelegramGatewayFactory telegramGatewayFactory = TelegramGatewayFactory.tdlib();
    private static Future<Void> restoring;

    static void configureTelegramGatewayFactory(TelegramGatewayFactory factory) {
        telegramGatewayFactory = Objects.requireNonNull(factory, "factory");
    }

    static void resetTelegramGatewayFactory() {
        telegramGatewayFactory = TelegramGatewayFactory.tdlib();
    }

    public static TelegramVerticle create(String rootPath) {
        return new TelegramVerticle(rootPath, telegramGatewayFactory);
    }

    public static TelegramVerticle create(TelegramRecord record) {
        return new TelegramVerticle(record, telegramGatewayFactory);
    }

    public static synchronized Future<Void> initTelegramVerticles(Vertx vertx) {
        if (!TelegramApplicationSettings.instance().current().configured()) return Future.succeededFuture();
        if (restoring != null && !restoring.isComplete()) return restoring;
        restoring = DataVerticle.telegramRepository.getAll()
                .compose(telegramRecords -> {
                    var loadedPaths = telegramVerticles.stream().map(item -> accountPathIdentity(item.rootPath)).collect(java.util.stream.Collectors.toSet());
                    var verifiedPaths = telegramRecords.stream().map(record -> accountPathIdentity(record.rootPath())).collect(java.util.stream.Collectors.toSet());
                    File telegramRoot = FileUtil.file(Config.TELEGRAM_ROOT);
                    List<String> uncertifiedPaths = FileUtil.loopFiles(telegramRoot, 1, null)
                            .stream()
                            .filter(f -> f.isDirectory() && !verifiedPaths.contains(accountPathIdentity(f.getAbsolutePath())))
                            .map(File::getAbsolutePath)
                            .toList();
                    List<Future<String>> futures = new ArrayList<>();
                    for (TelegramRecord telegramRecord : telegramRecords) {
                        if (loadedPaths.contains(accountPathIdentity(telegramRecord.rootPath()))) continue;
                        TelegramVerticle telegramVerticle = create(telegramRecord);
                        if (!telegramVerticle.check()) {
                            continue;
                        }
                        telegramVerticles.add(telegramVerticle);
                        futures.add(vertx.deployVerticle(telegramVerticle));
                    }
                    if (CollUtil.isNotEmpty(uncertifiedPaths)) {
                        for (String uncertifiedPath : uncertifiedPaths) {
                            if (loadedPaths.contains(accountPathIdentity(uncertifiedPath))) continue;
                            TelegramVerticle telegramVerticle = create(uncertifiedPath);
                            if (!telegramVerticle.check()) {
                                continue;
                            }
                            telegramVerticles.add(telegramVerticle);
                            futures.add(vertx.deployVerticle(telegramVerticle));
                        }
                    }
                    return Future.all(futures);
                })
                .onSuccess(r -> log.info("Successfully deployed %d telegram verticles".formatted(r.size())))
                .onFailure(err -> log.error("Failed to deploy telegram verticles: %s".formatted(err.getMessage())))
                .mapEmpty();
        return restoring;
    }

    public static void add(TelegramVerticle telegramVerticle) {
        telegramVerticles.add(telegramVerticle);
    }

    public static void remove(TelegramVerticle telegramVerticle) {
        telegramVerticles.remove(telegramVerticle);
    }

    static String accountPathIdentity(String rootPath) {
        Path path = Path.of(rootPath).toAbsolutePath().normalize();
        try {
            return path.toRealPath().toString();
        } catch (IOException ignored) {
            return path.toString();
        }
    }

    public static List<TelegramVerticle> getAll() {
        return telegramVerticles;
    }

    public static boolean hasAuthorized() {
        return telegramVerticles.stream().anyMatch(TelegramVerticle::isAvailable);
    }

    public static void refreshIdlePolicies() {
        telegramVerticles.forEach(TelegramVerticle::refreshIdlePolicy);
    }

    public static Optional<TelegramVerticle> get(String telegramId) {
        Object id = NumberUtil.isNumber(telegramId) ? Convert.toLong(telegramId) : telegramId;
        return telegramVerticles.stream()
                .filter(t -> Objects.equals(t.getId(), id))
                .findFirst();
    }

    public static TelegramVerticle getOrElseThrow(String telegramId) {
        return get(telegramId)
                .orElseThrow(() -> VertxException.noStackTrace("Telegram account not found!"));
    }

    public static Optional<TelegramVerticle> get(long telegramId) {
        return telegramVerticles.stream()
                .filter(t -> t.telegramRecord != null && t.telegramRecord.id() == telegramId)
                .findFirst();
    }

    public static TelegramVerticle getOrElseThrow(long telegramId) {
        return get(telegramId)
                .orElseThrow(() -> VertxException.noStackTrace("Telegram account not found!"));
    }
}
