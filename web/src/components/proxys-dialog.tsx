"use client";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EarthLock } from "lucide-react";
import Proxys, { type ProxysProps } from "@/components/proxys";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { TooltipWrapper } from "@/components/ui/tooltip";

type ProxysDialogProps = {
  className?: string;
} & ProxysProps;

export default function ProxysDialog({
  className,
  telegramId,
  ...proxyProps
}: ProxysDialogProps) {
  useLocale();
  const { data, isLoading } = useSWR<{
    success: boolean;
  }>(telegramId ? `/telegram/${telegramId}/test-network` : undefined);

  const triggerTooltipContent = useMemo(() => {
    if (!telegramId) {
      return t("You can add proxys for telegram connection.");
    }
    return (
      <>
        {isLoading && "Testing network..."}
        {!isLoading && data?.success && "Successfully connect to telegram"}
        {!isLoading && !data?.success && "Failed to connect to telegram"}
      </>
    );
  }, [data, isLoading, telegramId]);

  const triggerClassName = telegramId
    ? cn(
        isLoading &&
          "animate-pulse border-4 border-blue-400 text-blue-400 dark:border-blue-500 dark:text-blue-500",
        !isLoading &&
          data?.success &&
          "border-4 border-green-400 text-green-400 dark:border-green-500 dark:text-green-500",
        !isLoading &&
          !data?.success &&
          "border-4 border-red-400 text-red-400 dark:border-red-500 dark:text-red-500",
      )
    : "";

  return (
    <Dialog>
      <TooltipWrapper content={triggerTooltipContent}>
        <DialogTrigger asChild>
          <Button
            aria-label={t("Proxys")}
            variant="ghost"
            size="default"
            className={cn(
              "bg-primary px-3 text-accent hover:bg-primary/90 hover:text-accent",
              triggerClassName,
              className,
            )}
          >
            <EarthLock className="h-4 w-4" />
            <span>{t("Proxys")}</span>
          </Button>
        </DialogTrigger>
      </TooltipWrapper>
      <DialogContent
        className="flex h-dvh w-full max-w-full flex-col overflow-hidden md:h-3/4 md:w-2/3"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{t("Proxys")}</DialogTitle>
        </VisuallyHidden>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <Proxys inDialog telegramId={telegramId} {...proxyProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
