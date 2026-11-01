"use client";
import { t, translateError } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

import { SWRConfig } from "swr";
import React from "react";
import { useToast } from "@/hooks/use-toast";
import { request, RequestParsedError } from "@/lib/api";

export const SWRProvider = ({ children }: { children: React.ReactNode }) => {
  useLocale();
  const { toast } = useToast();
  return (
    <SWRConfig
      value={{
        // provider: localStorageProvider,
        refreshInterval: 0,
        errorRetryCount: 1,
        fetcher: request,
        onError: (err: Error, key: string) => {
          let message;
          let isHtml = false;
          if (err instanceof RequestParsedError) {
            const responseText = err.responseText;
            if (/<\/?[a-z][\s\S]*>/i.test(responseText)) {
              isHtml = true;
              message = (
                <div dangerouslySetInnerHTML={{ __html: responseText }}></div>
              );
            } else {
              message = translateError(responseText);
            }
          } else {
            message = translateError(err.message);
          }

          const displayKey = key.startsWith("http")
            ? new URL(key).pathname
            : key;

          toast({
            variant: "error",
            title: t("Request Failed"),
            description: (
              <div className="space-y-2">
                <div className="line-clamp-2 break-all text-xs text-muted-foreground">
                  <strong className="text-foreground">{t("Key:")}</strong>{" "}
                  {displayKey}
                </div>
                {isHtml ? (
                  message
                ) : (
                  <div className="line-clamp-3 text-wrap">{message}</div>
                )}
              </div>
            ),
          });
        },
      }}
    >
      {children}
    </SWRConfig>
  );
};
