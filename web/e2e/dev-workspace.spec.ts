import { test, expect } from "./auth.fixture";
import { installDevApi } from "./dev-api.fixture";
import path from "node:path";

test("sharing stays absent with old enabled settings and cache, including its direct URL", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (
      message.text().includes("404") &&
      message.location().url.endsWith("/share")
    )
      return;
    errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem("telegram-files:share-enabled", "true");
  });
  const api = await installDevApi(page, { shareEnabled: "true" });
  await page.setViewportSize({ width: 1505, height: 1045 });
  await page.goto("/");
  await expect(page).toHaveTitle("TGFlow");
  await expect(
    page.getByRole("heading", { name: "概览", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link"),
  ).toHaveCount(7);
  await expect(page.locator('a[href="/share"]')).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "已下载", exact: true })
    .click();
  await expect(page).toHaveURL(/\/files/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "已下载", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "分享到 telegram-seed", exact: true }),
  ).toHaveCount(0);
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.TGFLOW_SCREENSHOT_DIR,
        "dev-sharing-disabled-desktop.png",
      ),
      fullPage: true,
      animations: "disabled",
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("navigation", { name: "主导航" })
      .getByRole("link"),
  ).toHaveCount(7);
  await expect(page.locator('a[href="/share"]')).toHaveCount(0);
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.TGFLOW_SCREENSHOT_DIR,
        "dev-sharing-disabled-mobile.png",
      ),
      fullPage: true,
      animations: "disabled",
    });
  const response = await page.goto("/share");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "页面不存在", exact: true }),
  ).toBeVisible();
  expect(
    api.requests.filter((url) => url.pathname.startsWith("/share/")),
  ).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("sparse online matches allow explicit continuation without scanning endlessly", async ({
  page,
}) => {
  const api = await installDevApi(page, { sparse: true });
  await page.goto("/chats?id=1&chatId=-100&view=list&extensions=mkv");
  await expect(
    page.getByText("这批消息中暂无匹配文件，可继续查找更早的消息。", {
      exact: true,
    }),
  ).toBeVisible();
  const searches = () =>
    api.requests.filter((url) => url.pathname.endsWith("/chat/-100/files"));
  expect(searches()).toHaveLength(1);
  await page.getByRole("button", { name: "继续加载", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "山间漫步.mkv", exact: true }),
  ).toBeVisible();
  expect(
    searches().some((url) => url.searchParams.get("fromMessageId") === "900"),
  ).toBe(true);
});

test("desktop routes, collapse, recorded failures and task control use live API state", async ({
  page,
  csrfToken,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const api = await installDevApi(page);
  await page.setViewportSize({ width: 1505, height: 1045 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "概览", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("磁盘空间不足", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link"),
  ).toHaveCount(7);
  await page.getByRole("button", { name: "折叠侧栏", exact: true }).click();
  await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible();
  await page.getByRole("button", { name: "展开侧栏" }).click();
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.TGFLOW_SCREENSHOT_DIR,
        "dev-overview-desktop.png",
      ),
      fullPage: true,
    });
  await page.getByRole("button", { name: "暂停", exact: true }).first().click();
  await expect
    .poll(() =>
      api.writes.some(
        (write) =>
          write.path.endsWith("toggle-pause-download") &&
          write.body.isPaused === true &&
          write.csrf === csrfToken,
      ),
    )
    .toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "下载任务", exact: true })
    .click();
  await page.getByRole("tab", { name: "下载失败", exact: true }).click();
  await expect(page).toHaveURL(/downloadStatus=error/);
  await page.reload();
  await expect(page.getByText("磁盘空间不足", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "设置", exact: true })
    .click();
  await page.getByRole("tab", { name: "存储", exact: true }).click();
  await expect(page).toHaveURL(/tab=storage/);
  await expect(page.getByText("/downloads", { exact: true })).toBeVisible();
  await expect(page.getByText("/app/data", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "存储", exact: true }),
  ).toHaveAttribute("data-state", "active");
  expect(errors).toEqual([]);
});

test("Chinese automation saves raw types, byte limits and extension rules", async ({
  page,
  csrfToken,
}) => {
  const api = await installDevApi(page);
  await page.goto("/chats?id=1&chatId=-100");
  await page.getByRole("button", { name: "自动化设置", exact: true }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByRole("switch", { name: "启用自动下载", exact: true }).click();
  await page.getByLabel("最小大小（MB）").fill("100");
  await page.getByLabel("最大大小（MB）").fill("2048");
  await page.getByLabel("文件扩展名", { exact: true }).fill("mp4, mkv");
  await page.getByRole("button", { name: "高级设置", exact: true }).click();
  await page
    .getByRole("combobox", { name: "筛选文件类型", exact: true })
    .click();
  await page.getByRole("option", { name: "视频", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "下载历史文件", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "提交", exact: true }).click();
  await expect
    .poll(
      () =>
        api.writes.find((write) => write.path.endsWith("update-auto-settings"))
          ?.body,
    )
    .toBeTruthy();
  const saved = api.writes.find((write) =>
    write.path.endsWith("update-auto-settings"),
  )!;
  expect(saved.csrf).toBe(csrfToken);
  expect(saved.body.download).toMatchObject({
    enabled: true,
    rule: {
      fileTypes: ["video"],
      minSize: 104857600,
      maxSize: 2147483648,
      extensions: ["mp4", "mkv"],
      downloadHistory: false,
    },
  });
});

test("online size and format filters survive refresh and mobile navigation works", async ({
  page,
}) => {
  const api = await installDevApi(page);
  await page.goto("/chats?id=1&chatId=-100&view=grid");
  await page.getByRole("button", { name: /^筛选/ }).click();
  await page.getByLabel("文件扩展名", { exact: true }).fill("mkv");
  await page.getByText("文件大小范围", { exact: true }).click();
  await page.getByRole("button", { name: "GB", exact: true }).click();
  await page.getByLabel("最大大小", { exact: true }).fill("4");
  await page.getByLabel("最小大小", { exact: true }).fill("1");
  await page.getByRole("button", { name: "应用筛选", exact: true }).click();
  await expect(page).toHaveURL(/extensions=mkv/);
  await expect
    .poll(() =>
      api.requests.some(
        (url) =>
          url.pathname.includes("/chat/-100/files") &&
          url.searchParams.get("extensions") === "mkv" &&
          url.searchParams.get("sizeUnit") === "GB",
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page).toHaveURL(/sizeRange=1%2C4/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "自动化", exact: true })
    .click();
  await page.getByRole("tab", { name: "配置指南", exact: true }).click();
  await expect(
    page.getByText("1. 建立可搜索的索引", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.TGFLOW_SCREENSHOT_DIR,
        "dev-mobile-guide.png",
      ),
      fullPage: true,
    });
});
