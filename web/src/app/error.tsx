"use client";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export default function PageError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useLocale();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <LanguageSwitcher />
      <h1 className="text-2xl font-semibold">
        {t("Unable to load this page")}
      </h1>
      <p className="text-muted-foreground">
        {t("Please try again.")}
      </p>
      <Button onClick={reset}>{t("Retry")}</Button>
    </main>
  );
}
