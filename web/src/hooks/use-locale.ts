"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getLocale, subscribeLocale } from "@/lib/i18n";

/** Subscribe without remounting providers, forms, Telegram sessions, or download tasks. */
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE);
}
