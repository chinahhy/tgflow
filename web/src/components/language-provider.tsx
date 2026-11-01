"use client";

import { useEffect, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  setLocale,
} from "@/lib/i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      setLocale(isLocale(saved) ? saved : DEFAULT_LOCALE, false);
    } catch {
      setLocale(DEFAULT_LOCALE, false);
    }
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY)
        setLocale(
          isLocale(event.newValue) ? event.newValue : DEFAULT_LOCALE,
          false,
        );
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return children;
}
