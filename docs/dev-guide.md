# TGFlow dev 使用与部署指南

这份指南对应 `dev` 分支和 `hoya0803/tgflow:dev`。`main` / `latest` 继续作为稳定汉化版；只有简体中文和英文两种界面语言。dev 的改动不会自动合并进 main。

## 页面入口

| 地址 | 内容 |
| --- | --- |
| `/` | 正在下载、已完成、失败、暂停的数量，近期任务和已完成封面墙 |
| `/chats?id=<账号ID>&chatId=<聊天ID>` | Telegram 聊天文件、链接解析、在线／本地索引搜索、该聊天的自动化设置 |
| `/downloads` | 所有已开始的任务；按状态、名称、大小、格式等筛选，暂停、继续和重试 |
| `/files` | 已下载文件库；封面／列表、预览与下载，保留原有列表批量操作 |
| `/automations` | 已配置聊天和五步配置指南 |
| `/accounts` | 配置应用凭据，添加、登录和管理 Telegram 账号 |
| `/settings` | 常规、存储、统计、代理、API、关于 |

侧栏可以折叠并记住偏好；手机使用导航抽屉。设置页签保存在 `?tab=storage` 等地址里。文件的筛选、排序和封面／列表选择也保存在 URL，刷新或分享给同一服务的管理员后可恢复。例如：

```text
/chats?id=1&chatId=-100&view=grid&type=all&extensions=mp4,mkv&sizeRange=100,2048&sizeUnit=MB
/downloads?downloadStatus=error
/files?view=grid&extensions=mkv
```

这些 ID 只是示例，必须使用自己账号中的实际聊天。已下载页固定查询已完成文件；下载任务页只包含开始过的任务。聊天页保留原有文件列表、批量操作、预览和链接解析。

## SSD 与 HDD 分开存储

复制仓库的 `.env.example` 为 `.env`。将下列示例路径换成主机的实际路径，不要直接照抄磁盘名称：

```dotenv
CONFIG_DIR=/path/on/ssd/tgflow-dev/config
DOWNLOAD_DIR=/path/on/hdd/tgflow-dev/downloads
PORT=8026
```

Compose 中的两处绑定挂载为：

```yaml
volumes:
  - ${CONFIG_DIR:-${DATA_DIR:-./data}}:/app/data
  - ${DOWNLOAD_DIR:-./downloads}:/downloads
```

| 主机目录 | 容器路径 | 保存内容 |
| --- | --- | --- |
| `CONFIG_DIR`，建议 SSD | `/app/data` | SQLite 数据库、TDLib 账号会话与索引、设置、日志 |
| `DOWNLOAD_DIR`，建议 HDD | `/downloads` | TDLib 下载暂存、缩略图缓存和最终附件 |

程序同时设置 TDLib 的 `databaseDirectory` 和 `filesDirectory`，所以大文件的下载暂存也位于 HDD。下载根目录内的结构为：

```text
/downloads/
  .tdlib/<账号目录摘要>/...           # TDLib 管理的暂存／缓存
  files/<账号ID>/<聊天ID>/<消息ID>-<文件摘要>/<原始文件名>
```

正常文件名（包括中文、空格、大小写和扩展名）原样保留，不加说明文字或消息编号。不同消息里的同名文件通过父目录隔离。无文件名的附件采用 Telegram／TDLib 提供的后备名称；路径分隔符、控制字符等不适用于文件名的字符会替换，过长名称按 UTF-8 长度裁剪，并尽量保留扩展名。同一文件的重复完成通知可重入，不覆盖另一个大小不符的目标。

“设置 → 存储”显示实际容器目录，主机路径仍在 Compose 修改。使用非 root 的 `PUID/PGID` 时，两个专用目录及已有子目录须允许该 UID/GID 读写；启动脚本只调整下载挂载根目录的所有者，不递归改动整个 HDD。

确认访问地址和目录后，在该部署目录执行：

```bash
docker compose -p tgflow-dev config --quiet
docker compose -p tgflow-dev pull
docker compose -p tgflow-dev up -d
docker compose -p tgflow-dev logs -f tgflow
```

按 README 的步骤初始化管理员，然后添加 Telegram 账号。当前镜像验证平台是 `linux/amd64`。

### 在 WebUI 配置 Telegram

容器无需 Telegram 环境变量即可启动。完成管理员初始化并登录后，打开“账号管理 → Telegram 应用凭据”，填写从 [my.telegram.org](https://my.telegram.org) 获取的 API ID / Hash 并保存，然后再添加账号。手机号、验证码、两步验证密码、扫码登录及账号代理选项继续保留。

API ID / Hash 供所有账号共用；Telegram 日志级别在“高级设置”中调整，默认 `0`，连接初始化时生效。配置文件保存在 SSD 配置卷的 `telegram-application.json` 中，重建容器后保留。Hash 保存后不回显，留空会保留原值；更换 API ID 时需要同时填写匹配的新 Hash。当前下载不会因保存设置而被强制重连。

旧环境变量仍兼容，WebUI 保存值优先。已有实例建议先保留旧变量更新镜像，在页面点击保存导入后，再从 Compose 删除 `TELEGRAM_API_ID`、`TELEGRAM_API_HASH`、`TELEGRAM_LOG_LEVEL`。直接换用精简 Compose 时，在页面重新填写原凭据即可；原账号记录和会话保留，保存后会恢复连接。

### 已有实例与回退

建议给 dev 使用独立项目名、端口、配置目录和下载目录。不要让 main、dev 或原项目同时写同一数据库、账号会话或下载目录。

`DATA_DIR` 保留为配置目录的兼容后备；如果 `.env` 同时配置了 `CONFIG_DIR`，以它为准。已有部署不要误指向一个新空目录而以为账号丢失。升级前停止自己的 TGFlow 实例，备份完整配置目录、下载目录及 `.env`；恢复时使用同一次备份。

本版本不会批量重命名或迁移历史已完成文件，原有效路径继续可用；新完成的下载才进入新的原名目录。正在下载的旧任务及旧文件的处理应先在独立备份上验证。直接切回旧镜像不能保证旧版理解 dev 的文件路径；回退应恢复对应镜像与匹配的数据备份。开发和发布本身不操作 NAS 上的现有容器。

## HTTPS 反向代理

容器和主机默认都使用 HTTP `8026`。Lucky 负责外层 HTTPS，后端填 `http://NAS地址:8026`；同网络容器间可用 `http://tgflow:8026`。Java 的 `8080` 仍是内部 API。外部域名监听 `6270` 等其他端口也可以，与容器端口不必相同。

日常自用部署无需写 `HTTP_ALLOWED_ORIGINS`、`HTTP_SECURE_COOKIES`：

- 来源默认根据本次请求的原始主机、端口和协议自动识别。更换域名或改主机端口不再需要更新白名单。已有的局域网来源列表也不会阻止新域名的同源访问。
- Cookie 默认为自动：HTTP 使用普通 Cookie，HTTPS 使用 Secure Cookie；管理员会话、CSRF Cookie 和 Telegram Web 会话保持一致。局域网 IP 的 HTTP 登录与域名的 HTTPS 登录可各自使用。
- 外层反代保留 Host 或 `X-Forwarded-Host`（含端口），设置实际 `X-Forwarded-Proto` 并转发 WebSocket。容器保留有效的外部主机和协议，应用只接受本机 Nginx 传来的这些信息。

Compose 使用固定镜像 `hoya0803/tgflow:dev`。`APP_ROOT=/app/data`、`DOWNLOAD_ROOT=/downloads` 已作为镜像默认值，日志默认为 `INFO`，无需在 Compose 填写。只修改挂载的主机路径，配置和下载仍分别落在 SSD 与 HDD。程序继续采用生产模式、SQLite 与自动来源 / Cookie 策略。

镜像自带 Docker 定期健康检查，每 30 秒访问本容器的 `/api/health`，仅标记服务状态，不会单凭 `unhealthy` 自动重启。旧 Compose 中重复的 `healthcheck` 可以删除，无需另建应用或 NAS 定时任务。

如有特殊需求，可选参数仍兼容；请在 Compose 的 `environment` 中显式添加，仅写在宿主机 `.env` 不会传入容器：

| 参数 | 用途 |
| --- | --- |
| `HTTP_ALLOWED_ORIGINS` | 额外允许的跨域前端，多个来源以逗号分隔；不再作为当前同源地址的强制白名单 |
| `HTTP_SECURE_COOKIES=auto` | 默认行为；可以直接省略 |
| `HTTP_SECURE_COOKIES=true/false` | 显式固定 Cookie 属性；旧配置继续生效 |

保留了登录、CSRF 与其他网站来源的拒绝规则，省去的是日常手填部署参数。

### 从旧 dev 升级

旧 Compose 的 `6543:80` 必须对齐新的容器端口：推荐改为 `8026:8026`，也可用 `6543:8026` 保留原来的主机端口。相应更新 Lucky 的后端目标，并删除旧 Compose 中重复的 `healthcheck`；新镜像自带健康检查。端口调整不迁移或改写下载文件与数据库。

删除旧部署中固定的 `HTTP_SECURE_COOKIES=true/false`，或改为 `auto`，即可使用自动模式。`HTTP_ALLOWED_ORIGINS` 可以删除；保留旧值也不会阻挡同源域名。修改部署配置后重新部署容器以应用环境变量，仅点普通重启不会更新变量。

CI 对同一镜像分别测试默认自动模式、显式 true、显式 false，走真实 TLS 代理，并覆盖 Host 被外层改写、外部非默认端口、HTTP/HTTPS 登录、Cookie 属性、会话、CSRF 和 WS/WSS。显式模式还验证已有来源列表与自动同源访问能同时工作。

## 分享与 BT 永久禁用

dev 在代码中固定禁用 telegram-seed 平台分享、节点绑定、BT 下载和做种。启动链路已移除分享后台，不启动平台心跳、任务轮询或 qBittorrent 客户端；Telegram 下载、暂停、继续和取消直接走 TDLib。

`SHARE_ENABLED=true`、`SEED_PLATFORM_URL`、`QBITTORRENT_*` 等旧环境变量不会启用这些功能；旧数据库中的 `shareEnabled=true` 和浏览器缓存也不生效。Compose 无需填写 `SHARE_ENABLED`，代码层固定禁用，不能通过参数重新开启。分享 API 返回 `SHARE_DISABLED`，界面入口及 `/share` 页面已移除。

正常 Telegram 下载、自动化、已下载文件的本地预览与浏览器下载保留。数据库中的历史分享记录和已有文件不删除。此限制只针对 dev；main / latest 保持原有行为。

更新自己的容器到包含此改动的 dev 镜像后生效。此项目不会管理或停止独立 qBittorrent 实例中的既有任务。

## 自动化怎么配置

原项目的自动化按聊天配置，包含三个独立开关：

1. **自动预加载**：只建立文件索引，不下载附件。先在“聊天文件”选择账号、聊天，点“自动化设置 → 编辑”，启用预加载，保持自动下载／转移关闭。建立索引后，可用本地模式查询。
2. **自动下载**：按规则将附件放入下载盘。首次建议只在一个聊天启用。填写大小和扩展名，例如最小 `100` MB、最大 `2048` MB、`mp4, mkv`。空字段代表不限；大小按 1024 进制换算（1 MB = 1,048,576 字节）。
3. 在“高级”选择 Telegram 附件类型。某些视频以文档发送，应同时选“视频”和“文件”，或保持类型为空表示全部。搜索词、大小、扩展名、类型与高级表达式共同限定范围。历史扫描和新消息使用相同判断；修复了中文类型值误传给 API 的问题。
4. 先关闭“下载历史文件”，只观察新消息；需要补下载时再打开。修改历史下载规则并保存后，会重新扫描旧消息，已有下载记录会去重。讨论区附件是额外功能，初次配置可关闭。
5. **自动转移**：可选的下载后整理功能。保留文件原名时关闭“把说明添加到文件名”。初次关闭转移即可；需要时将目标设在可写的容器挂载内，例如 `/downloads/organized`，重复策略建议“跳过”。

最后点“提交”。“自动化”页面内也提供上述指南。先用一个匹配文件和一个不匹配文件核对规则、磁盘位置、暂停与继续，再扩大范围。并发先设为 1–2；下载时间限制是共享设置，`00:00–00:00` 表示不限。

高级表达式可留空。例如至少 100 MiB：

```java
f.size() >= 104857600
```

下载与落盘的明确失败会记录原因和发生时间，刷新／重启后仍可查看并重试。旧记录未保存的原因会显示未知，不推测；网络短暂断开且 TDLib 仍在重试时，不会凭空标记成失败。

## 聊天文件的大小与格式筛选

在线 Telegram 模式和本地索引模式都支持大小范围、扩展名（忽略大小写，可用逗号分隔）。类型指 Telegram 附件分类，扩展名指文件名称后缀；输入扩展名时先使用全部类型，再按需收窄。

Telegram 没有通用的大小／后缀组合搜索接口，在线模式会向前扫描消息并筛选。一次请求最多扫描 8 页，保留真实游标；当这批没有匹配而尚未查完时，点击“继续加载”继续查更早的消息。未知总数不会显示成精确总量。本地模式只查已建立的索引，不代表频道全部历史。

## 验证范围

新增测试覆盖规则一致性、稀疏分页、SQLite 组合筛选、错误持久化、原名与重名落盘，以及下载失败→重试→暂停→恢复→完成→预览→删除的应用链路。TDLib 网关在这些测试中使用可控实现；浏览器使用合成 API 数据验证保存请求、CSRF、路由、语言、筛选与手机导航。

CI 另执行完整回归、正式前端导出、AMD64 镜像构建和带两处独立挂载的容器检查，再推送同一个镜像。上述证据不等于真实 Telegram 下载或 NAS 验收；首次接入自己的账号后仍需完成上面的少量文件核对。
