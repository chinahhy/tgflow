"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export default function NotFound() {
  useLocale();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <LanguageSwitcher />
      <h1 className="text-2xl font-semibold">{t("Page not found")}</h1>
      <p className="text-muted-foreground">
        {t("The requested page does not exist.")}
      </p>
      <Button asChild>
        <Link href="/">{t("Return home")}</Link>
      </Button>
    </main>
  );
}
