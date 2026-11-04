package telegram.files.bot;

/** A deliberate diagnostic safe to persist and send to the authorized requester. */
public final class BotDownloadException extends IllegalStateException {
    public BotDownloadException(String message) { super(message); }
}
