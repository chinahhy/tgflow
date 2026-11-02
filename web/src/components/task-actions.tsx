"use client";

import { useState } from "react";
import { Pause, Play, Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { POST } from "@/lib/api";
import { t, translateError } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";
import { useToast } from "@/hooks/use-toast";
import type { TelegramFile } from "@/lib/types";

export function TaskActions({
  file,
  onChange,
}: {
  file: TelegramFile;
  onChange?: () => void;
}) {
  useLocale();
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const paused = file.downloadStatus === "paused";
  const active = file.downloadStatus === "downloading" || paused;
  const label = active
    ? paused
      ? t("Resume")
      : t("Pause")
    : file.downloadStatus === "error"
      ? t("Retry")
      : t("Download");
  const run = async () => {
    setPending(true);
    try {
      const action = active ? "toggle-pause-download" : "start-download";
      const descriptor = {
        fileId: file.id,
        telegramId: file.telegramId,
        uniqueId: file.uniqueId,
        chatId: file.chatId,
        messageId: file.messageId,
      };
      await POST(
        file.source === "SEED"
          ? `/files/${action}-multiple`
          : `/${file.telegramId}/file/${action}`,
        file.source === "SEED"
          ? { files: [descriptor], ...(active && { isPaused: !paused }) }
          : { ...descriptor, ...(active && { isPaused: !paused }) },
      );
      onChange?.();
    } catch (error) {
      toast({
        variant: "error",
        description: translateError(
          error instanceof Error ? error.message : String(error),
        ),
      });
    } finally {
      setPending(false);
    }
  };
  if (file.downloadStatus === "completed") return null;
  return (
    <Button
      type="button"
      size={active ? "icon" : "sm"}
      variant="outline"
      disabled={pending || !file.uniqueId}
      aria-label={label}
      title={label}
      onClick={() => void run()}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : active ? (
        paused ? (
          <Play />
        ) : (
          <Pause />
        )
      ) : file.downloadStatus === "error" ? (
        label
      ) : (
        <>
          <Download />
          {label}
        </>
      )}
    </Button>
  );
}
