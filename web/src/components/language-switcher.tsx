"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { setLocale, t } from "@/lib/i18n";

export function LanguageSwitcher() {
  const locale = useLocale();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0 gap-1.5"
      aria-label={t("Switch language")}
      title={t("Switch language")}
      onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
    >
      <Languages aria-hidden="true" />
      <span>{locale === "zh-CN" ? "English" : "简体中文"}</span>
    </Button>
  );
}
