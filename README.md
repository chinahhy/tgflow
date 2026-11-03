# TGFlow

基于 [Telegram Files](https://github.com/jarvis2f/telegram-files) 的独立维护版本，用于 Telegram 文件管理、链接解析、下载和自动化任务。默认简体中文，支持随时切换英文。

TGFlow 不采用 GitHub Fork 关系。保留上游完整 Git 历史、MIT 许可证及原作者 **jarvis2f** 的版权声明。当前基线为稳定版 **0.4.0**，上游提交为 [`e48cee9f3509b574f7a69cc3a2a45a8bfe13f589`](https://github.com/jarvis2f/telegram-files/commit/e48cee9f3509b574f7a69cc3a2a45a8bfe13f589)，来源记录见 [UPSTREAM.json](UPSTREAM.json)。

## dev 自定义版本

当前分支实现了可折叠侧栏和七个独立页面、原名落盘、SSD／HDD 双目录、下载失败原因、大小与扩展名筛选，以及自动化配置指南。部署和使用步骤见 **[dev 使用指南](docs/dev-guide.md)**。

## 功能

- 多 Telegram 账号管理，支持手机验证码、两步验证和扫码登录。
- 浏览聊天文件，按名称、类型、标签、时间、大小及下载状态筛选。
- Telegram 链接解析，文件下载、暂停、继续、取消和批量操作。
- 图片及视频预览、下载速度和文件统计。
- 预加载、按规则自动下载、下载后转移及重复文件处理。
- 管理员初始化、会话认证及移动端界面。
- dev 永久禁用 telegram-seed 平台分享、BT 下载与做种；普通 Telegram 下载不受影响。

## 语言

管理员登录页、首页及页面工具栏提供语言切换按钮。默认 `zh-CN`，点击 **English** 切换英文，点击 **简体中文** 切回中文。语言偏好保存在当前浏览器的 `tgflow.locale.v1` 中，刷新后保留，无需重新登录。

源码中的语言资源集中在 `web/src/locales/zh-CN.json` 与 `en.json`。翻译覆盖账号登录、文件管理、下载控制、自动化、设置、代理、统计、预览、分享及常见错误。日期、相对时间和日历跟随语言变化。文件名、路径、账号身份、数据库字段和 API 参数保持原值；远端自定义内容及未知错误的原始诊断信息保留原文。

## 分支与镜像

| 分支 | 用途 | Docker Hub 标签 |
| --- | --- | --- |
| `main` | 稳定汉化版，优先同步上游稳定版本 | `hoya0803/tgflow:latest` |
| `dev` | 原名下载、双盘存储、新界面与扩展筛选 | `hoya0803/tgflow:dev` |

两条分支独立发布，dev 不会覆盖 latest，也不会自动合并回 main。本分支的自定义功能见上方 dev 使用指南。

**镜像是否已发布，请以 [Actions](https://github.com/chinahhy/tgflow/actions/workflows/docker-publish.yml) 的发布步骤及实际 Docker Hub 仓库为准。** 未设置 Docker Hub 凭据时，工作流仍执行测试、构建和容器检查，并明确跳过推送。

## Docker Compose 部署

适用于极空间 Z4Pro、Dockge 及一般 AMD64 Linux 主机：单容器、SQLite、默认端口 `8026`、时区 `Asia/Shanghai`、`restart: unless-stopped`。基础 Telegram 下载不需要 PostgreSQL、MySQL 或 qBittorrent。

1. 在新的部署目录放入 [docker-compose.yaml](docker-compose.yaml) 和 [.env.example](.env.example)，将后者复制为 `.env`。
2. 镜像地址固定为 `hoya0803/tgflow:dev`，只需调整实际存储路径；Telegram 凭据在启动后的 WebUI 中配置。
3. 确认 `PORT` 对应的主机端口可用；普通 HTTP 或 HTTPS 反代无需填写来源和 Cookie 参数。
4. 启动：

```bash
cp .env.example .env
# 按需编辑 .env 中的主机路径。
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose logs -f tgflow
```

Dockge 可直接使用仓库根目录的 Compose 文件和环境变量。示例访问地址为 `http://NAS地址:8026`。若已有服务占用端口，修改 `PORT` 并让反代使用该主机端口即可，容器内部仍为 `8026`。

**已有官方 Telegram Files 实例时，请使用新的 Compose 项目名和独立数据目录。不要让两个实例同时写入同一 SQLite 数据库或 Telegram 会话目录。** 本项目的仓库构建不需要操作已有 NAS 容器。

### HTTP 与 HTTPS 登录

默认自动识别协议与当前访问来源，无需填写 `HTTP_ALLOWED_ORIGINS` 或 `HTTP_SECURE_COOKIES`。局域网 HTTP 使用普通 Cookie，HTTPS 域名使用 Secure Cookie；账号会话与旧的 Telegram Web 会话采用一致策略。即使以前配置过局域网来源，新域名下的同源访问也会自动放行。

容器入口是 **HTTP 8026**，默认映射 **8026 → 8026**。Lucky 等外层反代负责 HTTPS，目标填写 `http://NAS地址:8026`；同一 Docker 网络中可使用 `http://tgflow:8026`。外层代理应保留原始 Host 或 `X-Forwarded-Host`（含端口）、设置实际 `X-Forwarded-Proto`，并支持 WebSocket。容器会保留有效的协议和原始主机信息。

`HTTP_ALLOWED_ORIGINS` 只用于额外跨域前端；`HTTP_SECURE_COOKIES=true/false` 仍可显式覆盖自动策略。正常自用部署可省略它们。旧部署升级时，将 `6543:80` 改为 `8026:8026`；若想保留旧主机端口，可改为 `6543:8026`；健康检查由新镜像自带，无需在 Compose 重复填写。原来固定的 Cookie 参数建议删除或改为 `auto`。详见 [反向代理配置](docs/dev-guide.md#https-反向代理)。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `PORT` | 主机端口，默认 `8026`，容器入口 `8026` |
| `CONFIG_DIR` | 应用状态目录，示例 `./config`，建议 SSD |
| `DOWNLOAD_DIR` | 下载暂存与完成文件目录，默认 `./downloads`，建议 HDD |
| `DATA_DIR` | 兼容旧配置；未设置 CONFIG_DIR 时作为应用状态目录 |
| `PUID` / `PGID` | 可选，挂载目录对应的用户和组 ID，默认 `0` |

镜像内置 `APP_ROOT=/app/data`、`DOWNLOAD_ROOT=/downloads`，程序日志默认 `INFO`，Compose 无需再写这三项。镜像地址直接写为 `hoya0803/tgflow:dev`，修改 `volumes` 左侧的主机路径或 `.env` 中的 `CONFIG_DIR` / `DOWNLOAD_DIR` 即可分配 SSD 与 HDD。高级使用如需改变容器内目录或日志级别，须在 Compose 的 `environment` 显式覆盖。

镜像自带 Docker 健康检查：每 30 秒请求容器自身的 `/api/health`，超时 10 秒，启动宽限 60 秒，连续失败 3 次标记为 `unhealthy`。它不访问外网，不需要在应用或 NAS 定时任务中重复添加；单凭 `unhealthy` 状态不会自动重启容器。

需要额外跨域前端或固定 Cookie 策略时，在 Compose 的 `environment` 中显式添加 `HTTP_ALLOWED_ORIGINS` 或 `HTTP_SECURE_COOKIES`；精简文件不再转发这两个变量，仅写入宿主机 `.env` 不会生效。dev 已移除分享后台的启动和下载接入，`SHARE_ENABLED=true`、旧数据库设置或 qBittorrent 环境变量均无法开启。详见 [分享与 BT 禁用说明](docs/dev-guide.md#分享与-bt-永久禁用)。

仍可按上游方式配置外部数据库（`DB_TYPE`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`）和 AI；dev 的平台分享与 BT 模块固定禁用。完整运行参数以 `api/src/main/java/telegram/files/Config.java` 及 `share/ShareConfiguration.java` 为准。

### 获取 Telegram API ID / Hash

登录 [my.telegram.org](https://my.telegram.org)，打开 **API development tools**，创建应用并保存 `api_id` 和 `api_hash`。启动容器并登录管理员后，在“账号管理 → Telegram 应用凭据”填写并保存。它们不是 Bot Token，不能相互替代，也不要写入 README、Issues 或 Git。

API ID / Hash 是所有 Telegram 账号共用的应用凭据，与每个账号的手机号、验证码、两步验证密码不同。保存内容位于配置卷 `/app/data/telegram-application.json`，重建容器后保留；API Hash 不会通过查询接口回显，修改其他字段时可留空保持原值。日志级别默认 `0`，可在同一页面的高级设置中调整，连接初始化时生效。

旧 Compose 中的 `TELEGRAM_API_ID`、`TELEGRAM_API_HASH`、`TELEGRAM_LOG_LEVEL` 仍作为兼容后备，页面保存值优先。升级时可先保留原环境变量启动新镜像，在页面点击保存完成导入，再移除这三项；若已移除，重新填写原来的凭据即可，已有账号记录和会话目录仍保留，保存后自动恢复连接。仅在宿主机 `.env` 中填写旧变量不会自动传入精简 Compose。

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

管理员登录后，先在“账号管理 → Telegram 应用凭据”保存 API ID / Hash，再点击“添加账号”，按需选择代理，启动初始化。可输入含国家或地区代码的手机号及 Telegram 验证码；启用两步验证时还需密码。也可使用已登录的 Telegram 官方客户端扫码。登录状态由 TDLib 保存在持久化目录中，不受界面语言切换影响。

### 数据目录与升级

`CONFIG_DIR` 挂载到 `/app/data`，保存数据库、账号会话、索引、配置与日志；`DOWNLOAD_DIR` 挂载到 `/downloads`，保存下载暂存与新完成的原名附件。历史有效文件不批量迁移。目录含义、双硬盘示例与回退要求见 [dev 使用指南](docs/dev-guide.md)。

升级前，在自己的维护窗口停止 TGFlow 并备份**完整配置目录和下载目录**及 `.env`，避免复制正在写入的 SQLite 数据库。随后：

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

**登录后仍要求认证？** 默认模式下先检查旧配置是否还固定了 `HTTP_SECURE_COOKIES=true/false`，以及反代是否传递原始主机和协议。自动模式无需手写域名来源。

**为什么镜像拉取失败？** 检查 Docker Hub 用户名、标签及 Actions 发布记录。测试成功但缺少发布凭据时不会产生镜像。

**为什么无法下载或登录 Telegram？** 检查 API ID / Hash、验证码、两步验证、代理和 NAS 到 Telegram 的网络连接。浏览器语言设置不会改变 Telegram 网络路由。

**为什么没有分享与 BT 功能？** dev 在代码中永久禁用平台绑定、资源发布、BT 下载和做种；没有可开启的环境变量或界面开关。普通 Telegram 下载、自动化和本地预览仍可使用。

**中文设置没有保存？** 检查浏览器是否允许本地存储，以及是否使用同一个来源地址。禁用存储时仍可切换，但新页面无法恢复偏好。

## 许可证

沿用 [MIT License](LICENSE)。原作者版权：**Copyright (c) 2024 jarvis2f**。TGFlow 是独立维护的衍生项目，并非 Telegram Files 官方发行版。
