"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/app-shell";
import { FileLibrary } from "@/components/file-library";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export default function DownloadsPage() {
  useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const choices = [
    { value: "all", label: "All tasks" },
    { value: "downloading", label: "Downloading" },
    { value: "paused", label: "Paused" },
    { value: "error", label: "Download failed" },
    { value: "completed", label: "Completed" },
  ];
  return (
    <div>
      <PageHeading
        title={t("Download tasks")}
        description={t("Control downloads and inspect recorded failures.")}
      />
      <Tabs
        className="mb-6"
        value={params.get("downloadStatus") ?? "all"}
        onValueChange={(status) => {
          const next = new URLSearchParams(params.toString());
          next.delete("downloadStatus");
          if (status !== "all") next.set("downloadStatus", status);
          router.replace(`/downloads?${next.toString()}`, { scroll: false });
        }}
      >
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {choices.map((choice) => (
            <TabsTrigger key={choice.value} value={choice.value}>
              {t(choice.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <FileLibrary tasks />
    </div>
  );
}
