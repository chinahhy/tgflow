import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Browser plugin not available: use the repository's existing Playwright harness.
async function mockApi(page: Page, bootstrap = false) {
  let authenticated = false;
  let writes = 0;
  const headers = {
    "access-control-allow-origin": "http://localhost:3000",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-csrf-token",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "content-type": "application/json",
  };
  await page.context().addCookies([
    {
      name: "tf_csrf",
      value: "test-csrf",
      url: "http://localhost:3000",
      sameSite: "Strict",
    },
  ]);
  await page.routeWebSocket("ws://localhost:18028/**", () => {});
  await page.route("http://localhost:18028/**", async (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    let status = 200;
    let body: unknown = {};
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (req.method() !== "GET") writes++;
    if (pathname === "/auth/bootstrap/status")
      body = { required: bootstrap && !authenticated };
    else if (
      pathname === "/auth/login" ||
      pathname === "/auth/bootstrap" ||
      pathname === "/auth/session"
    ) {
      if (pathname !== "/auth/session") authenticated = true;
      if (authenticated)
        body = {
          authenticated: true,
          username: "admin",
          idleExpiresAt: Date.now() + 60000,
          absoluteExpiresAt: Date.now() + 120000,
        };
      else {
        status = 401;
        body = {
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Authentication is required",
          },
        };
      }
    } else if (
      pathname === "/telegrams" ||
      pathname === "/automations" ||
      pathname === "/automations/chats"
    )
      body = [];
    else if (pathname === "/files/count")
      body = { downloading: 2, completed: 3, downloadedSize: 1024 };
    else if (pathname === "/settings")
      body = {
        shareEnabled: "false",
        speedUnits: "bytes",
        tags: "",
        autoDownloadLimit: "5",
        avgSpeedInterval: "60",
        tdlibIdleTimeoutMinutes: "10",
      };
    else if (pathname.includes("/files")) body = { files: [], total: 0 };
    await route.fulfill({ status, headers, body: JSON.stringify(body) });
  });
  return () => writes;
}

async function screenshot(page: Page, name: string) {
  if (process.env.TGFLOW_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(process.env.TGFLOW_SCREENSHOT_DIR, name),
      fullPage: true,
    });
}

test("Chinese is default; switching preserves the form and administrator session, and survives refresh", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const writes = await mockApi(page);
  await page.goto("/");
  await expect(page).toHaveTitle("TGFlow");
  await expect(page.getByText("管理员登录", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  expect(
    await page
      .getByLabel("用户名", { exact: true })
      .evaluate((element) => (element as HTMLInputElement).validationMessage),
  ).toBe("此项为必填项");
  await page.getByLabel("用户名", { exact: true }).fill("admin");
  await page
    .getByLabel("密码", { exact: true })
    .fill("correct-horse-battery-staple");
  await screenshot(page, "tgflow-zh-desktop.png");
  await page.getByRole("button", { name: "切换语言" }).click();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "admin",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "correct-horse-battery-staple",
  );
  expect(writes()).toBe(0);
  await screenshot(page, "tgflow-en-desktop.png");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const beforeSwitch = writes();
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.getByRole("heading", { name: "概览" })).toBeVisible();
  expect(writes()).toBe(beforeSwitch);
  await page.reload();
  await expect(page.getByRole("heading", { name: "概览" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(pageErrors).toEqual([]);
});

test("mobile bootstrap translates and fits the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, true);
  await page.goto("/");
  await expect(page.getByText("创建首个管理员", { exact: true })).toBeVisible();
  await expect(page.locator("input")).toHaveCount(2);
  await expect(page.getByLabel("一次性初始化码")).toHaveCount(0);
  await page.getByLabel("用户名", { exact: true }).fill("admin");
  await page
    .getByLabel("密码", { exact: true })
    .fill("correct-horse-battery-staple");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await screenshot(page, "tgflow-zh-mobile.png");
  await page.getByRole("button", { name: "创建管理员", exact: true }).click();
  await expect(page.getByRole("heading", { name: "概览" })).toBeVisible();
  await page.getByRole("button", { name: "打开导航" }).click();
  await page.getByRole("button", { name: "切换语言" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
