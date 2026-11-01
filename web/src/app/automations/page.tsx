"use client";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

import { AutomationOverview } from "@/components/automation-overview";
import { PlatformTelegramIcon } from "@/components/platform-telegram-icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import ThemeToggleButton from "@/components/theme-toggle-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AutomationsPage() {
  useLocale();
  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative flex items-center justify-between gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft data-icon="inline-start" />
                {t("Home")}
              </Link>
            </Button>

            <div className="flex min-w-0 items-center gap-2">
              <PlatformTelegramIcon className="size-6 shrink-0" />
              <h3 className="truncate text-lg font-semibold">
                {t("Automation Overview")}
              </h3>
            </div>

            <LanguageSwitcher />
            <ThemeToggleButton />
          </div>
        </CardContent>
      </Card>

      <AutomationOverview />
    </div>
  );
}
