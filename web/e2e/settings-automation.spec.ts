import type { Page } from "@playwright/test";
import { test, expect } from "./auth.fixture";
import { installDevApi } from "./dev-api.fixture";
import path from "node:path";

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function screenshot(page: Page, name: string, fullPage = false) {
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(process.env.TGFLOW_SCREENSHOT_DIR, name),
      animations: "disabled",
      fullPage,
    });
}

const proxyProfiles = JSON.stringify({
  items: [
    { name: "LAN", server: "192.0.2.10", port: 1080, type: "socks5" },
    { name: "Backup", server: "192.0.2.11", port: 8080, type: "http" },
  ],
});

test("a single account is selected automatically and proxy application persists", async ({
  page,
  csrfToken,
}) => {
  const errors = observeErrors(page);
  const api = await installDevApi(page, { proxyValue: proxyProfiles });
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/settings?tab=proxys");
  await expect(
    page.getByRole("combobox", { name: "Telegram 账号" }),
  ).toContainText("测试账号");
  await page.getByRole("checkbox", { name: "选择 LAN", exact: true }).click();
  const apply = page.getByRole("button", { name: "应用代理", exact: true });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect
    .poll(() =>
      api.writes.filter((write) => write.path === "/telegram/1/toggle-proxy"),
    )
    .toHaveLength(1);
  expect(
    api.writes.find((write) => write.path.endsWith("/toggle-proxy")),
  ).toMatchObject({ body: { proxyName: "LAN" }, csrf: csrfToken });
  await expect(
    page.getByRole("status").filter({ hasText: "已使用代理 LAN" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "选择 LAN", exact: true }),
  ).toBeChecked();
  await screenshot(page, "proxy-mobile-applied.png", true);
  await page.getByRole("checkbox", { name: "选择 LAN", exact: true }).click();
  await apply.click();
  await expect
    .poll(
      () =>
        api.writes.filter((write) => write.path.endsWith("/toggle-proxy"))
          .length,
    )
    .toBe(2);
  expect(
    api.writes.filter((write) => write.path.endsWith("/toggle-proxy"))[1]?.body,
  ).toEqual({ proxyName: "" });
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "选择 LAN", exact: true }),
  ).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("proxy settings include accounts awaiting login and keep each account selection separate", async ({
  page,
  csrfToken,
}) => {
  const errors = observeErrors(page);
  const api = await installDevApi(page, {
    proxyValue: proxyProfiles,
    accounts: [
      {
        id: "pending",
        name: "待登录账号",
        status: "inactive",
        rootPath: "/data/pending",
        phoneNumber: "",
        proxy: "Backup",
      },
      {
        id: "2",
        name: "第二账号",
        status: "active",
        rootPath: "/data/second",
        phoneNumber: "",
        proxy: "LAN",
      },
    ],
  });
  await page.goto("/settings?tab=proxys");
  const apply = page.getByRole("button", { name: "应用代理", exact: true });
  await expect(apply).toBeDisabled();
  await expect(
    page.getByText("请先选择要使用代理的 Telegram 账号。", { exact: true }),
  ).toBeVisible();
  const selector = page.getByRole("combobox", { name: "Telegram 账号" });
  await selector.click();
  await page.getByRole("option").filter({ hasText: "待登录账号" }).click();
  await expect(page).toHaveURL(/settings\?tab=proxys&id=pending/);
  await expect(
    page.getByRole("checkbox", { name: "选择 Backup", exact: true }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "选择 LAN", exact: true }).click();
  await apply.click();
  await expect
    .poll(() =>
      api.writes.find(
        (write) => write.path === "/telegram/pending/toggle-proxy",
      ),
    )
    .toMatchObject({ body: { proxyName: "LAN" }, csrf: csrfToken });
  expect(
    api.requests.some((url) => url.pathname === "/telegram/pending/chats"),
  ).toBe(false);
  await selector.click();
  await page.getByRole("option").filter({ hasText: "第二账号" }).click();
  await expect(
    page.getByRole("checkbox", { name: "选择 LAN", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "选择 Backup", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "选择 Backup", exact: true })
    .click();
  await apply.click();
  await expect
    .poll(() =>
      api.writes.find((write) => write.path === "/telegram/2/toggle-proxy"),
    )
    .toMatchObject({ body: { proxyName: "Backup" } });
  await page.reload();
  await expect(selector).toContainText("第二账号");
  await expect(
    page.getByRole("checkbox", { name: "选择 Backup", exact: true }),
  ).toBeChecked();
  expect(errors).toEqual([]);
});

test("proxy profiles without an account explain how to set up a proxied login", async ({
  page,
}) => {
  const api = await installDevApi(page, {
    noAccounts: true,
    proxyValue: proxyProfiles,
  });
  await page.goto("/settings?tab=proxys");
  await expect(
    page.getByText("先保存代理配置，再到账号管理添加账号时选择该代理。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "添加代理", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "应用代理", exact: true }),
  ).toBeDisabled();
  expect(api.writes.some((write) => write.path.endsWith("/toggle-proxy"))).toBe(
    false,
  );
  await page.getByRole("link", { name: "前往账号管理" }).click();
  await expect(page).toHaveURL(/\/accounts/, { timeout: 30_000 });
  await page.getByRole("button", { name: "添加账号", exact: true }).click();
  const accountDialog = page.getByRole("dialog");
  await accountDialog
    .getByRole("button", { name: "代理", exact: true })
    .click();
  const proxies = page.getByRole("dialog", { name: "代理", exact: true });
  await proxies
    .getByRole("checkbox", { name: "选择 LAN", exact: true })
    .click();
  await proxies.getByRole("button", { name: "应用代理", exact: true }).click();
  await proxies.getByRole("button", { name: "关闭", exact: true }).click();
  await accountDialog
    .getByRole("button", { name: "开始初始化", exact: true })
    .click();
  await expect
    .poll(() => api.writes.find((write) => write.path === "/telegram/create"))
    .toMatchObject({ body: { proxyName: "LAN" } });
});

test("proxy settings accept an empty saved object and persist add, edit and delete", async ({
  page,
  csrfToken,
}) => {
  const errors = observeErrors(page);
  const api = await installDevApi(page, { proxyValue: "{}" });
  await page.goto("/settings?tab=proxys");
  await expect(page.getByText("尚未添加代理", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加代理", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByText("SOCKS5", { exact: true }).click();
  await editor.getByLabel("名称", { exact: true }).fill("LAN");
  await editor.getByLabel("服务器", { exact: true }).fill("192.0.2.10");
  await editor.getByLabel("端口", { exact: true }).fill("1080");
  await editor.getByLabel("用户名", { exact: true }).fill("fixture");
  await editor
    .getByLabel("密码", { exact: true })
    .fill("disposable-test-password");
  await editor.getByRole("button", { name: "添加代理", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(
    page.getByText("192.0.2.10:1080", { exact: true }),
  ).toBeVisible();
  expect(
    api.writes.find((write) => write.path === "/settings/create")?.csrf,
  ).toBe(csrfToken);
  await page.reload();
  await page.getByRole("button", { name: "编辑 LAN", exact: true }).click();
  await expect(editor.getByLabel("密码", { exact: true })).toHaveValue(
    "disposable-test-password",
  );
  await editor.getByLabel("端口", { exact: true }).fill("1081");
  await editor.getByRole("button", { name: "保存代理", exact: true }).click();
  await expect(
    page.getByText("192.0.2.10:1081", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "dev-proxy-settings-fixed.png");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "删除 LAN", exact: true }).click();
  await expect(page.getByText("尚未添加代理", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("corrupt proxy data stays unchanged until an explicit reset", async ({
  page,
}) => {
  const api = await installDevApi(page, { proxyValue: "{broken" });
  await page.goto("/settings?tab=proxys");
  await expect(
    page.getByRole("alert").filter({ hasText: "原始数据未改动" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "添加代理", exact: true }),
  ).toBeDisabled();
  expect(
    api.writes.filter((write) => write.path === "/settings/create"),
  ).toHaveLength(0);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "重置代理列表" }).click();
  await expect(
    page.getByRole("button", { name: "添加代理", exact: true }),
  ).toBeEnabled();
  expect(
    api.writes.find((write) => write.path === "/settings/create")?.body.proxys,
  ).toBe('{"items":[]}');
});

test("automation can be configured directly from an empty overview and survives reload", async ({
  page,
  csrfToken,
}) => {
  const errors = observeErrors(page);
  const api = await installDevApi(page);
  await page.setViewportSize({ width: 1505, height: 1045 });
  await page.goto("/automations");
  await expect(
    page.getByRole("heading", { name: "配置自动化", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Telegram 账号", exact: true })
    .click();
  await page.getByRole("option").filter({ hasText: "测试账号" }).click();
  await page.getByRole("combobox", { name: "选择聊天…", exact: true }).click();
  await page.getByRole("option").filter({ hasText: "测试频道" }).click();
  await expect(page).toHaveURL(/\/automations\?.*chatId=-100/);
  await page.getByRole("switch", { name: "启用自动下载", exact: true }).click();
  await page.getByLabel("最小大小（MB）").fill("100");
  await page.getByLabel("最大大小（MB）").fill("2048");
  await page.getByLabel("文件扩展名", { exact: true }).fill("mp4, mkv");
  await page
    .getByRole("button", { name: "保存自动化规则", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "自动化规则已保存" }),
  ).toBeVisible();
  const saved = api.writes.find((write) =>
    write.path.endsWith("update-auto-settings"),
  )!;
  expect(saved.csrf).toBe(csrfToken);
  expect(saved.body.download).toMatchObject({
    enabled: true,
    rule: {
      minSize: 104857600,
      maxSize: 2147483648,
      extensions: ["mp4", "mkv"],
      downloadHistory: false,
    },
  });
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "启用自动下载", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("最小大小（MB）")).toHaveValue("100");
  await expect(
    page.getByRole("table").getByText("测试频道", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "dev-automation-editor-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screenshot(page, "dev-automation-editor-mobile.png");
  expect(errors).toEqual([]);
});

test("automation without an account provides a working setup entry", async ({
  page,
}) => {
  await installDevApi(page, { noAccounts: true });
  await page.goto("/automations");
  await expect(
    page.getByText("请先登录 Telegram 账号，再配置自动化规则。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "前往账号管理" }).click();
  await expect(page).toHaveURL(/\/accounts/, { timeout: 30_000 });
});

test("sidebar controls work when expanded, collapsed and mobile, and theme follows system changes", async ({
  page,
  csrfToken,
}) => {
  const errors = observeErrors(page);
  const api = await installDevApi(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const sidebar = page.getByRole("complementary");
  const controls = sidebar.getByRole("group", { name: "应用操作" });
  await expect(
    controls.getByRole("button", { name: "切换语言" }),
  ).toBeVisible();
  await expect(
    controls.getByRole("button", { name: "退出登录" }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("button", { name: "选择主题" }),
  ).toHaveCount(0);
  await controls.getByRole("button", { name: "选择主题" }).click();
  await page.getByRole("menuitemradio", { name: "浅色", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await controls.getByRole("button", { name: "选择主题" }).click();
  await page
    .getByRole("menuitemradio", { name: "跟随系统", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "折叠侧栏" }).click();
  await expect(
    controls.getByRole("button", { name: "切换语言" }),
  ).toBeVisible();
  await expect(
    controls.getByRole("button", { name: "选择主题" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("navigation").getByRole("link")).toHaveCount(7);
  for (const height of [664, 568, 430]) {
    await page.setViewportSize({ width: 390, height });
    const settings = drawer.getByRole("link", { name: "设置", exact: true });
    await settings.scrollIntoViewIfNeeded();
    const linkBox = await settings.boundingBox();
    const controlBox = await drawer
      .getByRole("group", { name: "应用操作" })
      .boundingBox();
    expect(linkBox!.y + linkBox!.height).toBeLessThanOrEqual(controlBox!.y);
    await expect(
      drawer.getByRole("button", { name: "退出登录", exact: true }),
    ).toBeInViewport();
    await expect(
      drawer.getByRole("button", { name: "关闭", exact: true }),
    ).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 664 });
  await screenshot(page, "sidebar-mobile-compact.png");
  await drawer.getByRole("link", { name: "设置", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page).toHaveURL(/\/settings/);
  await page.getByRole("button", { name: "打开导航" }).click();
  const mobile = page
    .getByRole("dialog")
    .getByRole("group", { name: "应用操作" });
  await expect(
    mobile.getByRole("button", { name: "退出登录" }),
  ).toBeInViewport();
  await screenshot(page, "dev-sidebar-controls-mobile.png");
  await mobile.getByRole("button", { name: "退出登录" }).click();
  await expect
    .poll(() =>
      api.writes.some(
        (write) => write.path === "/auth/logout" && write.csrf === csrfToken,
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
