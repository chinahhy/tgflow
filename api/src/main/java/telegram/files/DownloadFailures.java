package telegram.files;

import io.vertx.core.Future;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.SqlClient;
import io.vertx.sqlclient.templates.SqlTemplate;
import telegram.files.repository.Definition;
import telegram.files.security.SensitiveDataRedactor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/** Separate additive table keeps existing FileRecord and upstream database columns compatible. */
public final class DownloadFailures implements Definition {
    @Override
    public String getScheme() {
        return """
                CREATE TABLE IF NOT EXISTS download_failure (
                    unique_id VARCHAR(255) PRIMARY KEY,
                    error_code VARCHAR(64),
                    error_message VARCHAR(1024),
                    occurred_at BIGINT
                )
                """;
    }

    public static Future<Void> save(String uniqueId, String code, Throwable error) {
        if (DataVerticle.pool == null) return Future.succeededFuture();
        String message = SensitiveDataRedactor.redact(error.getMessage());
        if (message == null || message.isBlank()) message = error.getClass().getSimpleName();
        String safeMessage = message.substring(0, Math.min(message.length(), 1000));
        return DataVerticle.pool.withTransaction(connection ->
                clear(connection, uniqueId).compose(_ -> SqlTemplate.forUpdate(connection, """
                        INSERT INTO download_failure(unique_id, error_code, error_message, occurred_at)
                        VALUES (#{id}, #{code}, #{message}, #{time})
                        """).execute(Map.of("id", uniqueId, "code", code, "message", safeMessage,
                        "time", System.currentTimeMillis())).mapEmpty()));
    }

    public static Future<Void> clear(String uniqueId) {
        return DataVerticle.pool == null ? Future.succeededFuture() : clear(DataVerticle.pool, uniqueId);
    }

    private static Future<Void> clear(SqlClient client, String uniqueId) {
        return SqlTemplate.forUpdate(client, "DELETE FROM download_failure WHERE unique_id = #{id}")
                .execute(Map.of("id", uniqueId)).mapEmpty();
    }

    public static Future<List<JsonObject>> enrich(List<JsonObject> files) {
        if (files.isEmpty() || DataVerticle.pool == null) return Future.succeededFuture(files);
        Map<String, Object> params = new HashMap<>();
        String ids = IntStream.range(0, files.size()).mapToObj(index -> {
            params.put("id" + index, files.get(index).getString("uniqueId"));
            return "#{id" + index + "}";
        }).collect(java.util.stream.Collectors.joining(","));
        return SqlTemplate.forQuery(DataVerticle.pool, "SELECT * FROM download_failure WHERE unique_id IN (" + ids + ")")
                .execute(params).map(rows -> {
                    Map<String, JsonObject> errors = new HashMap<>();
                    rows.forEach(row -> errors.put(row.getString("unique_id"), new JsonObject()
                            .put("errorCode", row.getString("error_code"))
                            .put("errorMessage", row.getString("error_message"))
                            .put("errorAt", row.getLong("occurred_at"))));
                    files.forEach(file -> {
                        JsonObject failure = errors.get(file.getString("uniqueId"));
                        if (failure != null) file.mergeIn(failure);
                    });
                    return files;
                });
    }
}
