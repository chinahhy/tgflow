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

async function screenshot(page: Page, name: string) {
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(process.env.TGFLOW_SCREENSHOT_DIR, name),
      animations: "disabled",
    });
}

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
