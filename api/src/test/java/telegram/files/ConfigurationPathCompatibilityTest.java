package telegram.files;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import telegram.files.security.SafePathResolver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ConfigurationPathCompatibilityTest {
    @TempDir Path temporary;

    @Test
    void oldAccountAndMediaPathsResolveToOneAccountAndKeepTheSameDownloadStaging() throws Exception {
        Path data = Files.createDirectory(temporary.resolve("data"));
        Path account = Files.createDirectories(data.resolve("account/saved-account"));
        Path media = Files.writeString(account.resolve("old-video.mp4"), "fixture");
        Path app = Files.createDirectory(temporary.resolve("app"));
        Path legacyData = Files.createSymbolicLink(app.resolve("data"), data);
        Path oldAccount = legacyData.resolve("account/saved-account");
        Path oldMedia = oldAccount.resolve("old-video.mp4");

        assertEquals(TelegramVerticles.accountPathIdentity(account.toString()),
                TelegramVerticles.accountPathIdentity(oldAccount.toString()),
                "A saved old path and a discovered /data path must not restore duplicate clients");
        var resolver = new SafePathResolver(List.of(data.resolve("account")));
        assertEquals(media.toRealPath(), resolver.requireAllowedRegularFile(oldMedia));
        var storage = new DownloadStorage(temporary.resolve("downloads"), List.of(data.resolve("account")));
        assertEquals(storage.filesDirectory(account.toString()), storage.filesDirectory(oldAccount.toString()),
                "Existing download staging must not be discarded after changing the configuration mount");
    }
}
