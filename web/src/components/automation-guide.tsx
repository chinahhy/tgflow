"use client";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AutomationGuide() {
  useLocale();
  const sections = [
    {
      title: "1. Build a searchable index",
      text: "Open a chat and its automation settings. Enable Preload, and leave Auto Download and Transfer off. Preload indexes file information without downloading attachments.",
    },
    {
      title: "2. Match the files you need",
      text: "Enable Auto Download. Set minimum and maximum size in MB and extensions such as mp4, mkv. Empty fields mean unrestricted. File-type selection refers to Telegram attachment types; choose Video and File if videos are also sent as documents.",
    },
    {
      title: "3. Choose history or new files",
      text: "Turn Download History off to start with new messages. Turn it on to scan older files as well. Keep comment downloads off unless you need discussion attachments. The same rules apply to both history and new files.",
    },
    {
      title: "4. Keep storage and names predictable",
      text: "Files download directly to the configured download volume. Completed files keep their original names in account/chat/message folders. Auto Transfer is optional; its destination must be a writable path mounted inside the container. Leave Add caption to file name off to retain names.",
    },
    {
      title: "5. Verify a small example",
      text: "Start with one chat and 1–2 concurrent downloads. Check a matching file and a non-matching file, confirm the disk location, and test pause, resume and restart before enabling a large historical scan. Download time limits are shared settings; 00:00–00:00 means unrestricted.",
    },
  ];
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{t(section.title)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            {t(section.text)}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("Advanced filter expression")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>{t("Example: attachments of at least 100 MiB.")}</p>
          <code className="overflow-x-auto rounded-md bg-muted p-3">
            {"f.size() >= 104857600"}
          </code>
          <p className="text-muted-foreground">
            {t(
              "The expression is optional and is combined with the visual rules.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
