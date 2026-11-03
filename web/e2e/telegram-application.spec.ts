import { test, expect } from "./auth.fixture";
import { installDevApi } from "./dev-api.fixture";
import path from "node:path";

test("application credentials can be saved, kept on reload and edited without revealing the hash", async ({
  page,
  csrfToken,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const api = await installDevApi(page, { applicationConfigured: false });
  await page.goto("/accounts");
  await expect(page.getByText("未配置", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加账号", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "开始初始化", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("link", { name: "请先配置 Telegram 应用凭据" })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("API ID", { exact: true }).fill("654321");
  await page
    .getByLabel("API Hash", { exact: true })
    .fill("disposable-test-hash");
  await page.getByRole("button", { name: "保存应用凭据" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Telegram 应用凭据已保存" }),
  ).toBeVisible();
  await expect(page.getByLabel("API Hash", { exact: true })).toHaveValue("");
  expect(
    api.writes.find((write) => write.path === "/telegram/application")?.csrf,
  ).toBe(csrfToken);
  await page.reload();
  await expect(page.getByLabel("API ID", { exact: true })).toHaveValue(
    "654321",
  );
  await expect(page.getByLabel("API Hash", { exact: true })).toHaveAttribute(
    "placeholder",
    "已保存，留空则保持不变",
  );
  await page.getByText("高级设置", { exact: true }).click();
  await page.getByLabel("Telegram 日志级别").fill("2");
  await page.getByRole("button", { name: "保存应用凭据" }).click();
  await expect
    .poll(
      () =>
        api.writes.filter((write) => write.path === "/telegram/application")
          .length,
    )
    .toBe(2);
  const update = api.writes.filter(
    (write) => write.path === "/telegram/application",
  )[1]!;
  expect(update.body).toEqual({ apiId: 654321, logLevel: 2 });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.TGFLOW_SCREENSHOT_DIR,
        "dev-telegram-application-mobile.png",
      ),
      fullPage: true,
      animations: "disabled",
    });
  expect(errors).toEqual([]);
});

test("account login retains proxy, phone, verification code, password and QR controls", async ({
  page,
}) => {
  const api = await installDevApi(page);
  await page.goto("/accounts");
  await page.getByRole("button", { name: "添加账号", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "代理", exact: true }).click();
  const proxies = page.getByRole("dialog", { name: "代理", exact: true });
  await expect(proxies).toBeVisible();
  await proxies.getByRole("button", { name: "关闭", exact: true }).click();
  await dialog.getByRole("button", { name: "开始初始化", exact: true }).click();
  await expect
    .poll(() => api.writes.some((write) => write.path === "/telegram/create"))
    .toBe(true);
  api.authorize(306402531);
  await expect(dialog.getByLabel("手机号码", { exact: true })).toBeVisible();
  api.authorize(52643073);
  await expect(dialog.locator("#code")).toBeVisible();
  api.authorize(112238030);
  await expect(dialog.locator("#password")).toHaveAttribute("type", "password");
  api.authorize(860166378, { link: "tg://login?token=disposable-test-token" });
  await expect(
    dialog.getByText("使用已登录的 Telegram 应用扫码。", { exact: true }),
  ).toBeVisible();
});
