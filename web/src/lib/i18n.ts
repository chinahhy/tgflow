import en from "@/locales/en.json";
import zhCN from "@/locales/zh-CN.json";

export type Locale = "zh-CN" | "en";
export const DEFAULT_LOCALE: Locale = "zh-CN";
export const LOCALE_STORAGE_KEY = "tgflow.locale.v1";
const messages: Record<Locale, Record<string, string>> = { en, "zh-CN": zhCN };
let locale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

export function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en";
}

export function getLocale(): Locale {
  return locale;
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocale(value: Locale, persist = true) {
  if (!isLocale(value)) return;
  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, value);
    } catch {
      /* Storage may be disabled. */
    }
  }
  if (typeof document !== "undefined") document.documentElement.lang = value;
  if (locale === value) return;
  locale = value;
  listeners.forEach((listener) => listener());
}

/** English source phrases are stable resource keys. Values and API identifiers are never translated. */
export function t(
  key: string,
  values?: Record<string, string | number>,
  language: Locale = locale,
): string {
  const message = Object.hasOwn(messages[language], key)
    ? messages[language][key]!
    : Object.hasOwn(messages.en, key)
      ? messages.en[key]!
      : key;
  return message.replace(/\{(\w+)\}/g, (token, name: string) =>
    values?.[name] === undefined ? token : String(values[name]),
  );
}

export function formatDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(
    locale,
    options ?? { dateStyle: "medium", timeStyle: "medium" },
  ).format(new Date(value));
}

export function translateError(message: string): string {
  if (Object.hasOwn(messages[locale], message)) return t(message);
  // Keep server diagnostics intact while providing a localized explanation.
  return locale === "en"
    ? message
    : t("Operation failed: {detail}", { detail: message });
}
