"use client";

import useSWR from "swr";

export type TelegramApplicationStatus = {
  configured: boolean;
  apiId: number | null;
  apiHashConfigured: boolean;
  logLevel: number;
  source: "saved" | "environment" | "none";
  storageError: boolean;
};

export function useTelegramApplication() {
  return useSWR<TelegramApplicationStatus>("/telegram/application");
}
