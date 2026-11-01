# TGFlow

基于 [Telegram Files](https://github.com/jarvis2f/telegram-files) 的独立维护版本，用于 Telegram 文件管理、链接解析、下载和自动化任务。默认简体中文，支持随时切换英文。

TGFlow 不采用 GitHub Fork 关系。保留上游完整 Git 历史、MIT 许可证及原作者 **jarvis2f** 的版权声明。当前基线为稳定版 **0.4.0**，上游提交为 [`e48cee9f3509b574f7a69cc3a2a45a8bfe13f589`](https://github.com/jarvis2f/telegram-files/commit/e48cee9f3509b574f7a69cc3a2a45a8bfe13f589)，来源记录见 [UPSTREAM.json](UPSTREAM.json)。

## 功能

- 多 Telegram 账号管理，支持手机验证码、两步验证和扫码登录。
- 浏览聊天文件，按名称、类型、标签、时间、大小及下载状态筛选。
- Telegram 链接解析，文件下载、暂停、继续、取消和批量操作。
- 图片及视频预览、下载速度和文件统计。
- 预加载、按规则自动下载、下载后转移及重复文件处理。
- 管理员初始化、会话认证及移动端界面。
- 保留上游可选的 telegram-seed 分享模块；默认关闭，基础下载不依赖它。

## 语言

管理员登录页、首页及页面工具栏提供语言切换按钮。默认 `zh-CN`，点击 **English** 切换英文，点击 **简体中文** 切回中文。语言偏好保存在当前浏览器的 `tgflow.locale.v1` 中，刷新后保留，无需重新登录。

源码中的语言资源集中在 `web/src/locales/zh-CN.json` 与 `en.json`。翻译覆盖账号登录、文件管理、下载控制、自动化、设置、代理、统计、预览、分享及常见错误。日期、相对时间和日历跟随语言变化。文件名、路径、账号身份、数据库字段和 API 参数保持原值；远端自定义内容及未知错误的原始诊断信息保留原文。

## 分支与镜像

| 分支 | 用途 | Docker Hub 标签 |
| --- | --- | --- |
| `main` | 稳定汉化版，优先同步上游稳定版本 | `<用户名>/tgflow:latest` |
| `dev` | 从已验证的 main 创建，用于后续自定义开发 | `<用户名>/tgflow:dev` |

两条分支独立发布，dev 不会覆盖 latest，也不会自动合并回 main。目前不增加额外业务功能。

**镜像是否已发布，请以 [Actions](https://github.com/chinahhy/tgflow/actions/workflows/docker-publish.yml) 的发布步骤及实际 Docker Hub 仓库为准。** 未设置 Docker Hub 凭据时，工作流仍执行测试、构建和容器检查，并明确跳过推送。

## Docker Compose 部署

适用于极空间 Z4Pro、Dockge 及一般 AMD64 Linux 主机：单容器、SQLite、端口 `6543`、时区 `Asia/Shanghai`、`restart: unless-stopped`。不需要 PostgreSQL、MySQL 或 qBittorrent。

1. 在新的部署目录放入 [docker-compose.yaml](docker-compose.yaml) 和 [.env.example](.env.example)，将后者复制为 `.env`。
2. 填写实际 Docker Hub 用户名、Telegram API ID / Hash，并确认镜像已经发布。
3. 检查 `HTTP_ALLOWED_ORIGINS` 与实际访问地址一致。
4. 启动：

```bash
cp .env.example .env
# 编辑 .env，填写凭据；不要将它提交到 Git。
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose logs -f tgflow
```

Dockge 可直接使用仓库根目录的 Compose 文件和环境变量。示例访问地址为 `http://10.0.0.104:6543`。若已有服务占用端口，请为 TGFlow 选择另一个端口，并同步修改 `HTTP_ALLOWED_ORIGINS`。

**已有官方 Telegram Files 实例时，请使用新的 Compose 项目名和独立数据目录。不要让两个实例同时写入同一 SQLite 数据库或 Telegram 会话目录。** 本项目的仓库构建不需要操作已有 NAS 容器。

### HTTP 与 HTTPS 登录

Compose 中保留：

```yaml
HTTP_SECURE_COOKIES: "false"
```

这适用于受信任局域网内的 **HTTP**。HTTP 无法发送 Secure Cookie，错误开启会导致登录后仍提示 `Authentication is required`。

对外访问请使用 HTTPS，将 Compose 中该项改为 `"true"`，把 `HTTP_ALLOWED_ORIGINS` 设为实际的 `https://域名`，并确保反向代理正确传递 `X-Real-IP`、`X-Forwarded-Host`、`X-Forwarded-Proto`。不要把 HTTP 下的 Cookie 配置直接用于公网部署。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `DOCKERHUB_USERNAME` | 实际 Docker Hub 用户名，仅用于选择镜像，不假定与 GitHub 相同 |
| `IMAGE_TAG` | `latest` 或 `dev`，默认 `latest` |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | 必填，Telegram 应用凭据 |
| `PORT` | 主机端口，默认 `6543` |
| `DATA_DIR` | 持久化目录，默认 `./data` |
| `HTTP_ALLOWED_ORIGINS` | 实际访问来源，多个值用逗号分隔 |
| `LOG_LEVEL` | 默认 `INFO` |
| `TELEGRAM_LOG_LEVEL` | 默认 `0` |
| `PUID` / `PGID` | 可选，挂载目录对应的用户和组 ID，默认 `0` |

Compose 还固定配置 `TZ=Asia/Shanghai`、`APP_ENV=prod`、`APP_ROOT=/app/data`、`DB_TYPE=sqlite`、`SHARE_ENABLED=false`。`HTTP_SECURE_COOKIES` 在 Compose 中按访问协议配置。

上游仍支持外部数据库（`DB_TYPE`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`）以及可选分享和 AI 配置；精简示例不会自动启用这些功能。完整运行参数以 `api/src/main/java/telegram/files/Config.java` 及 `share/ShareConfiguration.java` 为准。

### 获取 Telegram API ID / Hash

登录 [my.telegram.org](https://my.telegram.org)，打开 **API development tools**，创建应用并保存 `api_id` 和 `api_hash`。将两项写入本地 `.env`。它们不是 Bot Token，不能相互替代，也不要写入 README、Issues 或 Git。

### 首次管理员初始化

首次启动时，后端日志会输出有效期 **15 分钟**的一次性初始化码。通过本机或同一私有局域网访问页面，输入该码，创建管理员用户名和密码。

- 用户名为 3–64 位小写字母、数字、点、下划线或连字符。
- 密码为 12–256 个字符。
- 完成后使用管理员账号登录，初始化码失效。
- 初始化仅对本机和私有局域网来源开放；不要在完成初始化前暴露服务。

忘记密码时使用上游提供的本地维护命令，按命令提示完成恢复；恢复会撤销已有管理员会话：

```bash
docker compose exec tgflow tfm admin reset-password <管理员用户名>
docker compose exec -it tgflow tfm admin apply-reset <管理员用户名>
```

### 登录 Telegram 账号

管理员登录后点击“添加账号”，按需选择代理，启动初始化。可输入含国家或地区代码的手机号及 Telegram 验证码；启用两步验证时还需密码。也可使用已登录的 Telegram 官方客户端扫码。登录状态由 TDLib 保存在持久化目录中，不受界面语言切换影响。

### 数据目录与升级

`DATA_DIR` 整体挂载到 `/app/data`，包含 SQLite `data.db`、`account/` 下的账号会话及账号文件、`logs/` 等运行数据。账号实际目录可在“设置 → 存储”查看；自定义自动转移目录若位于 `/app/data` 之外，需要单独配置挂载并备份。

升级前，在自己的维护窗口停止 TGFlow 并备份**整个持久化目录**及 `.env`，避免复制正在写入的 SQLite 数据库。随后：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

不要删除数据卷，不要覆盖现有数据库，不要删除 `account/`。不要在两个版本间共享正在写入的数据目录；回退前先确认数据库兼容性并使用相应备份。

## 构建与发布

[TGFlow CI and Docker](.github/workflows/docker-publish.yml) 支持 main/dev 推送、PR 和手动触发，复用 [验证工作流](.github/workflows/ci.yml)：

1. 使用 JDK 23 / Gradle Wrapper 运行后端测试并生成 `shadowJar`。
2. 使用 Node.js 22 / 锁文件运行 ESLint、TypeScript、Vitest、Playwright 及 Next.js 静态构建。
3. 生成 `.docker-artifacts/api.jar`、`dependencies.txt`、`web/`。
4. 以官方 Dockerfile 和仓库内 AMD64 TDLib 构建镜像，启动容器检查健康接口、首页和初始化状态。
5. 凭据齐全时，将**同一个已测试镜像**推送到对应分支标签。

仓库 `Settings → Secrets and variables → Actions` 需要配置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Variable | `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| Secret | `DOCKERHUB_TOKEN` | 有权推送该账号下 tgflow 镜像的令牌 |

PR 不执行镜像发布。`main` 只发布 `latest`，`dev` 只发布 `dev`。当前发布目标仅为 `linux/amd64`；上游保留的其他 TDLib 架构不代表 TGFlow 已验证这些平台。

本地开发见 [docs/development.md](docs/development.md)。**不要在缺少 `.docker-artifacts` 时直接运行 Docker 构建。**

## 同步官方稳定版本

采用“上游稳定版本 → 临时同步分支 / PR → 汉化适配 → 完整验证 → main → latest → 合并 main 到 dev → dev 镜像”的流程。dev 自定义功能不得反向自动合并进 main。

详见 [docs/upstream-sync.md](docs/upstream-sync.md)。来源由 Git 历史和 `UPSTREAM.json` 共同记录。同步脚本只准备临时分支，不会直接推送或合并 main。

## 常见问题

**登录后仍要求认证？** 检查访问协议与 `HTTP_SECURE_COOKIES`、允许来源、代理转发头及浏览器 Cookie 是否一致。

**为什么镜像拉取失败？** 检查 Docker Hub 用户名、标签及 Actions 发布记录。测试成功但缺少发布凭据时不会产生镜像。

**为什么无法下载或登录 Telegram？** 检查 API ID / Hash、验证码、两步验证、代理和 NAS 到 Telegram 的网络连接。浏览器语言设置不会改变 Telegram 网络路由。

**为什么分享相关功能不可用？** 默认 `SHARE_ENABLED=false`。此任务保留上游模块，但不会部署 telegram-seed 或 qBittorrent。

**中文设置没有保存？** 检查浏览器是否允许本地存储，以及是否使用同一个来源地址。禁用存储时仍可切换，但新页面无法恢复偏好。

## 许可证

沿用 [MIT License](LICENSE)。原作者版权：**Copyright (c) 2024 jarvis2f**。TGFlow 是独立维护的衍生项目，并非 Telegram Files 官方发行版。
