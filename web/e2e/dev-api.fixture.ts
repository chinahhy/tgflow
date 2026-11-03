import type { Page, WebSocketRoute } from "@playwright/test";
import type { Auto, TelegramFile } from "../src/lib/types";

export function devFiles(): TelegramFile[] {
  return [
    {
      id: 1,
      fileName: "海边日落.mp4",
      size: 1200000000,
      downloadStatus: "downloading",
      downloadedSize: 552000000,
    },
    {
      id: 2,
      fileName: "山间漫步.mkv",
      size: 2400000000,
      downloadStatus: "paused",
      downloadedSize: 480000000,
    },
    {
      id: 3,
      fileName: "雨夜街景.mp4",
      size: 800000000,
      downloadStatus: "error",
      downloadedSize: 0,
      errorCode: "FILE_STORAGE_FAILED",
      errorMessage: "Disk full",
      errorAt: 1793628000000,
    },
    {
      id: 4,
      fileName: "海边日落.mp4",
      size: 1200000000,
      downloadStatus: "completed",
      downloadedSize: 1200000000,
    },
    {
      id: 5,
      fileName: "山间漫步.mkv",
      size: 2400000000,
      downloadStatus: "completed",
      downloadedSize: 2400000000,
    },
    {
      id: 6,
      fileName: "云海雪山.mp4",
      size: 950000000,
      downloadStatus: "completed",
      downloadedSize: 950000000,
    },
  ].map((file) => ({
    ...file,
    telegramId: 1,
    chatId: -100,
    messageId: file.id * 100,
    uniqueId: `file-${file.id}`,
    type: "video",
    mimeType: "video/mp4",
    date: 1793620000,
    formatDate: "",
    caption: "",
    localPath:
      file.downloadStatus === "completed"
        ? `/downloads/files/${file.fileName}`
        : "",
    completionDate: 1793620000000 + file.id,
    startDate: 1793610000000,
    hasSensitiveContent: false,
    loaded: true,
    originalDeleted: false,
    source: "TELEGRAM",
    threadChatId: 0,
    messageThreadId: 0,
    reactionCount: 0,
    thumbnailFile: {
      uniqueId: `thumb-${file.id}`,
      mimeType: "image/svg+xml",
      extra: { width: 640, height: 360 },
    },
  })) as TelegramFile[];
}

export async function installDevApi(
  page: Page,
  options: {
    sparse?: boolean;
    shareEnabled?: boolean | string;
    applicationConfigured?: boolean;
    proxyValue?: unknown;
    noAccounts?: boolean;
  } = {},
) {
  let application = {
    apiId: options.applicationConfigured === false ? null : 123456,
    apiHashConfigured: options.applicationConfigured !== false,
    configured: options.applicationConfigured !== false,
    logLevel: 0,
    source: options.applicationConfigured === false ? "none" : "saved",
    storageError: false,
  };
  const sockets: WebSocketRoute[] = [];
  let proxys: unknown = options.proxyValue ?? null;
  const files = devFiles();
  const writes: {
    path: string;
    body: Record<string, unknown>;
    csrf?: string;
  }[] = [];
  const requests: URL[] = [];
  let auto: Auto = {
    preload: { enabled: false },
    download: {
      enabled: false,
      rule: {
        query: "",
        fileTypes: [],
        downloadHistory: false,
        downloadCommentFiles: false,
        filterExpr: "",
      },
    },
    transfer: {
      enabled: false,
      rule: {
        destination: "",
        transferHistory: false,
        duplicationPolicy: "SKIP",
        transferPolicy: "GROUP_BY_CHAT",
        useCaptionName: false,
        extra: {},
      },
    },
  };
  await page.routeWebSocket("ws://localhost:8028/**", (socket) => {
    sockets.push(socket);
  });
  await page.route("http://localhost:8028/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    requests.push(url);
    const headers = {
      "access-control-allow-origin": "http://localhost:3000",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type,x-csrf-token",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "content-type": "application/json",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() === "POST") {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      writes.push({ path, body, csrf: request.headers()["x-csrf-token"] });
      if (path === "/telegram/application") {
        application = {
          ...application,
          apiId: Number(body.apiId),
          apiHashConfigured: true,
          configured: true,
          logLevel: Number(body.logLevel ?? 0),
          source: "saved",
        };
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify(application),
        });
        return;
      }
      if (path === "/telegram/create") {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ id: "2" }),
        });
        return;
      }
      if (path === "/settings/create" && "proxys" in body) proxys = body.proxys;
      if (path.endsWith("update-auto-settings")) auto = body as unknown as Auto;
      if (path.endsWith("toggle-pause-download")) {
        const file = files.find((item) => item.id === body.fileId);
        if (file)
          file.downloadStatus = body.isPaused ? "paused" : "downloading";
      }
      await route.fulfill({ status: 200, headers, body: "{}" });
      return;
    }
    if (path.includes("/file/thumb-")) {
      const sky =
        path.endsWith("4") || path.endsWith("1")
          ? "#fb923c"
          : path.endsWith("5") || path.endsWith("2")
            ? "#86b87f"
            : "#8faed0";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#d9e5ed"/></linearGradient></defs><rect width="640" height="360" fill="url(#s)"/><circle cx="460" cy="115" r="44" fill="#fff4cf"/><path d="M0 360V250L160 130L300 265L420 160L640 290V360Z" fill="#475f70"/><path d="M0 360V290L180 230L340 320L500 250L640 310V360Z" fill="#233e4b"/></svg>`;
      await route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "image/svg+xml" },
        body: svg,
      });
      return;
    }
    let body: unknown = {};
    if (path === "/auth/session")
      body = {
        authenticated: true,
        username: "test-admin",
        idleExpiresAt: Date.now() + 3600000,
        absoluteExpiresAt: Date.now() + 7200000,
      };
    else if (path === "/auth/bootstrap/status") body = { required: false };
    else if (path === "/telegram/application") body = application;
    else if (path === "/telegrams")
      body = options.noAccounts
        ? []
        : [
            {
              id: "1",
              name: "测试账号",
              phoneNumber: "+10000000000",
              status: "active",
              rootPath: "/data/account/test",
            },
          ];
    else if (path === "/telegram/1/chats")
      body = [{ id: "-100", name: "测试频道", type: "channel", auto }];
    else if (path === "/settings")
      body = {
        proxys,
        shareEnabled: options.shareEnabled ?? false,
        speedUnits: "bytes",
        tags: "",
        autoDownloadLimit: "2",
        avgSpeedInterval: "60",
        tdlibIdleTimeoutMinutes: "10",
      };
    else if (path === "/storage")
      body = {
        appRoot: "/data",
        downloadRoot: "/downloads",
        filesRoot: "/downloads/files",
      };
    else if (path.endsWith("/files/count"))
      body =
        path === "/files/count"
          ? {
              downloading: 2,
              completed: 12,
              error: 1,
              paused: 1,
              downloadedSize: 4550000000,
            }
          : { media: 6, photo: 0, video: 6, audio: 0, file: 0 };
    else if (path === "/files" || path.endsWith("/files")) {
      let selected = files;
      const status = url.searchParams.get("downloadStatus");
      if (status)
        selected = selected.filter((file) => file.downloadStatus === status);
      if (url.searchParams.get("taskOnly"))
        selected = selected.filter(
          (file) => file.downloadStatus !== "completed",
        );
      if (url.searchParams.get("extensions"))
        selected = selected.filter((file) => file.fileName.endsWith(".mkv"));
      if (url.searchParams.get("fromMessageId")) selected = [];
      body = {
        files: selected,
        count: selected.length,
        nextFromMessageId: 0,
        hasMore: false,
      };
      if (
        options.sparse &&
        path.includes("/chat/") &&
        url.searchParams.get("extensions")
      ) {
        body = url.searchParams.has("fromMessageId")
          ? {
              files: [files[4]],
              count: null,
              nextFromMessageId: 0,
              hasMore: false,
            }
          : { files: [], count: null, nextFromMessageId: 900, hasMore: true };
      }
    } else if (path === "/automations/chats")
      body =
        auto.download.enabled || auto.preload.enabled || auto.transfer.enabled
          ? [
              {
                telegramId: "1",
                accountName: "测试账号",
                chatId: "-100",
                chatName: "测试频道",
                chatType: "channel",
                chatAvatar: "",
                auto: { ...auto, state: 0 },
              },
            ]
          : [];
    else if (path === "/automations" || path === "/proxys") body = [];
    await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });
  return {
    writes,
    requests,
    authorize: (constructor: number, extra: Record<string, unknown> = {}) => {
      for (const socket of sockets)
        socket.send(
          JSON.stringify({
            type: 1,
            data: { constructor, ...extra },
            timestamp: Date.now(),
          }),
        );
    },
  };
}
