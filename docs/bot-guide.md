# connent：Telegram Bot 后台下载

`connent` 从 `dev` 分支开发。在 Bot 私聊发送或转发链接，后台排队下载到服务器；Bot 先回复任务编号，完成或失败后再回复结果。文件不回传 Telegram，不受 Bot 上传文件大小限制。

支持：

- YouTube、B站等 [yt-dlp 支持的网站](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)，可从正文、转发说明和隐藏链接提取地址。
- `t.me` / `telegram.me` 消息链接及带频道来源的转发消息，包括可还原来源的私有频道消息。使用 TGFlow 已登录账号下载，账号必须有权访问来源。隐藏来源的私人聊天转发需改发原始消息链接。
- 一条消息最多 10 个不同链接；每个链接一个任务，默认依次下载。默认只下载单个视频，不展开播放列表，拒绝直播；一个 Telegram 相册会保存全部附件。
- `/start`、`/help` 查看用法，`/status` 查看自己的最近 10 个任务。

## 构建与启动

本分支的代码需要单独构建，现有 `hoya0803/tgflow:dev` 镜像不含 Bot 功能。按 [开发指南](development.md#后端与-docker) 准备后端和前端 `.docker-artifacts`，然后在本分支根目录执行：

```bash
docker buildx build --platform linux/amd64 --load -t tgflow:connent-local .
cp .env.example .env
```

编辑本机 `.env`（已被 Git 忽略）：

```dotenv
TGFLOW_BOT_TOKEN=填写从BotFather取得的Token
TGFLOW_BOT_ALLOWED_USER_IDS=填写自己的Telegram数字用户ID
TGFLOW_BOT_TELEGRAM_ID=
TELEGRAM_PROXY_URL=http://代理地址:端口
```

1. 向 [BotFather](https://t.me/BotFather) 发送 `/newbot` 创建独立 Bot，将 Token 保存在本机 `.env`，不要发送到聊天、Issues 或提交到 Git。
2. `TGFLOW_BOT_ALLOWED_USER_IDS` 填写允许使用的数字用户 ID，多个用英文逗号分隔。用户 ID 与手机号、用户名、Bot ID 不同。只接受白名单用户的私聊，群聊与其他用户消息忽略。启用 Bot 后白名单不能为空。
3. 网页视频无需登录 TGFlow 的 Telegram 账号。下载 Telegram 链接时，先在 WebUI 登录有访问权限的 Telegram 账号；只有一个可用账号时自动选择。多个账号时，填写账号管理中的 TGFlow 账号数字 ID 到 `TGFLOW_BOT_TELEGRAM_ID`。
4. 如无需代理，留空 `TELEGRAM_PROXY_URL`。Bot API 和 yt-dlp 默认复用该代理，也可在 Compose 显式设置独立 `TGFLOW_BOT_PROXY_URL`。支持 HTTP CONNECT 与 SOCKS5。原生 TDLib 仍使用 `TELEGRAM_PROXY_URL`。
5. 运行 `docker compose up -d`，在 Telegram 中私聊自己的 Bot，点击 Start，然后发送视频链接。

Compose 使用本地构建的 `tgflow:connent-local`。镜像内置 Python、固定版本 yt-dlp（包含 EJS）、Node.js 22+、FFmpeg / ffprobe。更新 yt-dlp 需重新构建镜像，可用构建参数 `--build-arg YTDLP_VERSION=版本号`，没有自动自更新任务。

## 存储、通知与恢复

- 网页视频：`/downloads/bot/<Bot数字ID>/<任务编号>/视频标题 [视频ID].扩展名`，通过 Compose 的下载卷保存。网页任务可在 Bot `/status` 查询；当前 WebUI 的 Telegram 文件列表不展示网页视频。
- Telegram 附件：复用既有下载存储、原名落盘与 WebUI 下载状态。
- 队列、结果、通知状态和 Bot 轮询位置：`/data/bot/<Bot数字ID>/tasks.json`。Bot Token 不写入任务文件；任务文件包含接收者 ID 和源链接，应随配置卷妥善保管。
- 原子保存队列后才确认收到的 Telegram 更新，避免重复更新产生重复任务。容器重启后，排队任务继续；执行中网页任务在原目录尝试断点续传，Telegram 任务重新关联现有下载。更换 Bot 时使用独立状态目录。
- 通知发送失败会重试。通知采用“至少一次”投递：若在 Telegram 已收到通知但本地确认尚未保存时断电，重启后可能再收到一次。重复通知不会重新触发下载。
- 默认最多 100 个未完成或尚未通知的任务。已完成且已通知的旧任务记录按约 200 条保留，下载文件保留。没有自动删除已下载文件的功能。
- 下载失败会给出登录/Cookies、站点不支持、空间不足、超时等可安全显示的原因。下载器原始输出、签名媒体地址和凭据不写日志或通知。Telegram 相册失败时可能已有部分附件保存。

## 高级参数与 Cookies

以下参数需要显式添加到 Compose 的 `environment`，仅写入 `.env` 不会自动传入：

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `TGFLOW_BOT_PROXY_URL` | `TELEGRAM_PROXY_URL` | Bot API 与网页下载代理；显式空值表示直连 |
| `TGFLOW_BOT_COOKIES_FILE` | 未设置 | Netscape 格式 Cookies 文件的容器内路径 |
| `TGFLOW_BOT_TIMEOUT_SECONDS` | `3600` | 每个任务的下载等待上限，1–86400 秒 |
| `TGFLOW_BOT_MAX_FILE_SIZE` | `10G` | 网页视频大小上限；未知大小的视频仍可能下载，磁盘需留足空间 |
| `TGFLOW_BOT_QUEUE_LIMIT` | `100` | 未完成或待通知任务上限，1–1000 |
| `TGFLOW_BOT_YTDLP_PATH` | `/opt/yt-dlp/bin/yt-dlp` | 下载器可执行文件，主要用于本地开发 |

需要网站登录时，将自己的 Cookies 文件放在 Git 仓库之外或已忽略的配置目录中，以只读方式挂载。例如，在 Compose 中增加：

```yaml
    environment:
      TGFLOW_BOT_COOKIES_FILE: /data/private/cookies.txt
```

将文件保存到主机 `./tgflow/private/cookies.txt`，限制读取权限。下载器使用权限受限的临时副本，任务结束后删除，不会修改原文件。Cookies 过期后替换文件并重新发送失败链接。

未配置 Token 时 Bot 完全关闭，不创建队列或访问 Bot API。同一 Token 只运行一个轮询实例；已被其他服务设置 webhook 的 Bot 需先在原服务解除 webhook。本程序不会擅自删除 webhook 或丢弃历史消息。

站点支持随 yt-dlp 和网站变化；登录、地区限制、反爬或付费权限仍可能阻止下载。需要实机网络、有效 Token 和站点链接才能完成真实验收。

## 实现参考

参考 [tropicoo/yt-dlp-bot](https://github.com/tropicoo/yt-dlp-bot) 的链接任务与结果通知，以及 [nonoo/yt-dlp-telegram-bot](https://github.com/nonoo/yt-dlp-telegram-bot) 的串行队列思路。TGFlow 中独立实现，复用现有 Java / Vert.x 与 TDLib；没有引入其 PostgreSQL、RabbitMQ 或代码。Bot 接口按 [Telegram Bot API](https://core.telegram.org/bots/api#getupdates) 实现；YouTube 依赖按 [yt-dlp EJS 指南](https://github.com/yt-dlp/yt-dlp/wiki/EJS) 配置。
