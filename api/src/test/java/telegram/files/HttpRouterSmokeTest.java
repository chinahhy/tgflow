package telegram.files;

import io.vertx.core.Vertx;
import io.vertx.core.http.HttpMethod;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(VertxExtension.class)
class HttpRouterSmokeTest {
    @Test
    void routerStartsAndServesHealthWithAdaptiveSessionHandler(Vertx vertx, VertxTestContext context) {
        var http = new HttpVerticle();
        http.init(vertx, vertx.getOrCreateContext());
        var router = http.initRouter();
        vertx.createHttpServer().requestHandler(router).listen(0, "127.0.0.1")
                .compose(server -> vertx.createHttpClient().request(HttpMethod.GET,
                                server.actualPort(), "127.0.0.1", "/health")
                        .compose(request -> request.send()))
                .compose(response -> response.body().map(body -> {
                    context.verify(() -> assertEquals(200, response.statusCode(), body.toString()));
                    return body;
                }))
                .onComplete(context.succeedingThenComplete());
    }
}
