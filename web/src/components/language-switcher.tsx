"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/utils";
import { setLocale, t } from "@/lib/i18n";

export function LanguageSwitcher({
  compact = false,
  fullWidth = false,
}: {
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const locale = useLocale();
  return (
    <Button
      type="button"
      size={compact ? "icon" : "sm"}
      variant="outline"
      className={cn(
        "shrink-0 gap-1.5",
        fullWidth && "h-10 w-full justify-start gap-3",
      )}
      aria-label={t("Switch language")}
      title={t("Switch language")}
      onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
    >
      <Languages aria-hidden="true" />
      <span className={compact ? "sr-only" : undefined}>
        {locale === "zh-CN" ? "English" : "简体中文"}
      </span>
    </Button>
  );
}
