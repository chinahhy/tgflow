"use client";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { createContext, useContext, useMemo, useState } from "react";
import { type TelegramChat } from "@/lib/types";
import useSWR from "swr";
import { useDebouncedCallback } from "use-debounce";
import { type KeyedMutator } from "swr/_internal";
import { useTelegramAccount } from "@/hooks/use-telegram-account";

interface TelegramChatContextType {
  isLoading: boolean;
  reload: KeyedMutator<TelegramChat[]>;
  chatId: string | undefined;
  chat?: TelegramChat;
  chats: TelegramChat[];
  query: string;
  archived: boolean;
  handleChatChange: (chatId: string) => void;
  handleQueryChange: (search: string) => void;
  handleArchivedChange: (archived: boolean) => void;
}

const TelegramChatContext = createContext<TelegramChatContextType | undefined>(
  undefined,
);

interface TelegramChatProviderProps {
  children: React.ReactNode;
}

export const TelegramChatProvider: React.FC<TelegramChatProviderProps> = ({
  children,
}) => {
  useLocale();
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id") ?? "";
  const { getAccounts } = useTelegramAccount();
  const account = getAccounts().find((item) => item.id === accountId);
  const chatId = searchParams.get("chatId") ?? "";

  const handleQueryChange = useDebouncedCallback((search: string) => {
    setQuery(search);
  }, 500);

  const {
    data: chats,
    isLoading,
    mutate,
  } = useSWR<TelegramChat[]>(
    account?.status === "active"
      ? `/telegram/${accountId}/chats?query=${query}&archived=${archived}&chatId=${chatId ?? ""}`
      : null,
  );

  const chat = useMemo(
    () => chats?.find((c) => c.id === chatId),
    [chatId, chats],
  );

  const handleChatChange = (newChatId: string) => {
    if (newChatId === chatId) {
      return;
    }
    const chat = chats?.find((c) => c.id === newChatId);
    if (!chat) {
      toast({ variant: "error", description: t("Failed to switch chat") });
      return;
    }
    router.push(`/chats?id=${accountId}&chatId=${newChatId}`);
  };

  return (
    <TelegramChatContext.Provider
      value={{
        isLoading,
        reload: mutate,
        chatId,
        chat,
        chats: chats ?? [],
        query,
        archived,
        handleChatChange,
        handleQueryChange: handleQueryChange,
        handleArchivedChange: setArchived,
      }}
    >
      {children}
    </TelegramChatContext.Provider>
  );
};

export function useTelegramChat() {
  useLocale();
  const context = useContext(TelegramChatContext);
  if (!context) {
    throw new Error(
      "useTelegramChat must be used within a TelegramChatProvider",
    );
  }
  return context;
}

export function useMaybeTelegramChat() {
  useLocale();
  const context = useContext(TelegramChatContext);
  if (!context) {
    return undefined;
  }
  return context;
}
