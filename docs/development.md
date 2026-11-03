# 开发和验证

技术栈保持上游：JDK 23、Gradle Wrapper、Vert.x 5、TDLib、Next.js 16、React 19。使用锁文件安装前端依赖，不随意升级核心依赖。

## 前端

在 `web` 目录运行：

```bash
npm ci
export NEXT_PUBLIC_API_URL=http://localhost:8028
export NEXT_PUBLIC_WS_URL=ws://localhost:8028/ws
npm run check
npx playwright install chromium
npm run test:e2e
npm run dev
```

默认语言是简体中文。继承的英文测试显式选择英文；新增国际化测试验证默认中文、切换、持久化、刷新和表单状态保留。浏览器测试中的 API 响应为模拟数据，不代表实际 Telegram 账号已验证。

`t()` 使用英文源文案作为资源键，资源集中在 `src/locales/`。组件用 `useLocale()` 订阅语言变化；不要将翻译结果用作接口参数、状态枚举、存储键或 React key。静态元数据保留资源键，在显示处翻译；依赖文案的 memo 应包含语言依赖。语言更新不会 remount 根 Provider。

前端正式导出：

```bash
NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_WS_URL=/ws NEXT_TELEMETRY_DISABLED=1 npm run build
```

输出在 `web/out`。生产前端与 API 使用同一来源，保留上游 CSRF 与会话认证机制。

## 后端与 Docker

需要 JDK 23。测试使用与宿主系统匹配的 TDLib JNI，Linux CI 沿用上游 glibc 测试运行库；镜像使用仓库中的 `tdlib/linux_amd64/libtdjni.so`。

设置测试用 `APP_ENV=prod`、独立 `APP_ROOT`、占位 `TELEGRAM_API_ID=1`、`TELEGRAM_API_HASH=test-only-placeholder` 和测试 `TDLIB_PATH`，然后在 `api` 目录运行。Gradle 测试任务将数据隔离到 `api/build/test-data`；清理 SQLite 测试数据不会删除编译产物：

```bash
./gradlew test jacocoTestReport shadowJar --no-daemon
mkdir -p ../.docker-artifacts
cp build/libs/telegram-files.jar ../.docker-artifacts/api.jar
jdeps --print-module-deps --ignore-missing-deps ../.docker-artifacts/api.jar > ../.docker-artifacts/dependencies.txt
```

完成前端正式构建后，从仓库根目录准备并构建：

```bash
mkdir -p .docker-artifacts/web
cp -R web/out/. .docker-artifacts/web/
test -s .docker-artifacts/api.jar
test -s .docker-artifacts/dependencies.txt
test -s .docker-artifacts/web/index.html
docker buildx build --platform linux/amd64 --load -t tgflow:local .
```

完整自动验证流程见 `.github/workflows/ci.yml` 和 `docker-publish.yml`。本地没有 Docker/JDK 时，不把静态检查当作镜像或后端验证；应核对 GitHub Actions 的实际结果。
