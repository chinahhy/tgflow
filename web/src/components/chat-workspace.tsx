"use client";

import { useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/app-shell";
import AccountSelect from "@/components/account-select";
import ChatSelect from "@/components/chat-select";
import AutomationDialog from "@/components/automation-dialog";
import ParseLinkButton from "@/components/parse-link";
import Files from "@/components/files";
import { useTelegramAccount } from "@/hooks/use-telegram-account";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export function ChatWorkspace() {
  useLocale();
  const accounts = useTelegramAccount();
  const params = useSearchParams();
  const accountId = params.get("id");
  const chatId = params.get("chatId");
  const thread = params.get("messageThreadId");
  const link = params.get("link") ?? undefined;
  return (
    <div>
      <PageHeading
        title={t("Chat files")}
        description={t("Select an account and chat, or paste a Telegram link.")}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AccountSelect {...accounts} />
        <ChatSelect disabled={!accountId} />
        {chatId && !thread && <AutomationDialog />}
        {accountId && <ParseLinkButton accountId={accountId} />}
      </div>
      {accountId && (chatId || link) ? (
        <Files
          accountId={accountId}
          chatId={chatId ?? "-1"}
          messageThreadId={thread ? Number(thread) : undefined}
          link={link}
        />
      ) : (
        <p className="flex min-h-64 items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("Select a chat to view files")}
        </p>
      )}
    </div>
  );
}
