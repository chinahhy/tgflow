import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LanguageProvider } from "@/components/language-provider";
import { useLocale } from "@/hooks/use-locale";
import {
  DEFAULT_LOCALE,
  getLocale,
  LOCALE_STORAGE_KEY,
  setLocale,
  t,
  translateError,
} from "@/lib/i18n";
import en from "@/locales/en.json";
import zhCN from "@/locales/zh-CN.json";

afterEach(() => {
  cleanup();
  localStorage.clear();
  setLocale(DEFAULT_LOCALE, false);
});

describe("TGFlow internationalization", () => {
  it("has matching nonempty resources and interpolation parameters", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhCN).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(zhCN[key].trim(), key).not.toBe("");
      const tokens = (value: string) =>
        [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(tokens(zhCN[key]), key).toEqual(tokens(en[key]));
    }
  });

  it("defaults to Chinese, interpolates values once, and preserves unknown technical values", () => {
    setLocale(DEFAULT_LOCALE, false);
    expect(getLocale()).toBe("zh-CN");
    expect(t("Sign in")).toBe("登录");
    expect(t("Download {count} selected files", { count: 3 })).toBe(
      "下载选中的 3 个文件",
    );
    expect(t("/data/file.mp4")).toBe("/data/file.mp4");
    expect(t("constructor")).toBe("constructor");
    expect(t("{action} action completed", { action: "{count}" })).toBe(
      "{count}操作已完成",
    );
    expect(translateError("Invalid username or password")).toBe(
      "用户名或密码错误",
    );
  });

  it("switches reactively without remounting form state and persists the preference", () => {
    setLocale(DEFAULT_LOCALE, false);
    function Form() {
      useLocale();
      const [value, setValue] = useState("");
      return (
        <>
          <LanguageSwitcher />
          <label>
            {t("Username")}
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <p>{t("Downloading")}</p>
        </>
      );
    }
    render(<Form />);
    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "unchanged-account" },
    });
    fireEvent.click(screen.getByRole("button", { name: "切换语言" }));
    expect(screen.getByLabelText("Username")).toHaveValue("unchanged-account");
    expect(screen.getByText("Downloading")).toBeVisible();
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    act(() => setLocale("zh-CN"));
    expect(screen.getByLabelText("用户名")).toHaveValue("unchanged-account");
  });

  it("restores stored language and synchronizes another tab", () => {
    setLocale(DEFAULT_LOCALE, false);
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    render(
      <LanguageProvider>
        <LanguageSwitcher />
      </LanguageProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Switch language" }),
    ).toBeVisible();
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: LOCALE_STORAGE_KEY,
          newValue: "zh-CN",
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "切换语言" })).toBeVisible();
  });
});
