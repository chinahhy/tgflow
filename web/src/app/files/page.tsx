"use client";
import Files from "@/components/files";
import { PageHeading } from "@/components/app-shell";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
export default function DownloadedPage() {
  useLocale();
  return (
    <div>
      <PageHeading
        title={t("Downloaded files")}
        description={t(
          "Browse completed files without changing their original names.",
        )}
      />
      <Files accountId="-1" chatId="-1" />
    </div>
  );
}
