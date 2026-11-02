"use client";
import { useSearchParams } from "next/navigation";
import { ChatWorkspace } from "@/components/chat-workspace";
import { AccountList } from "@/components/account-list";
import { AccountDialog } from "@/components/account-dialog";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/app-shell";
import { useTelegramAccount } from "@/hooks/use-telegram-account";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { Plus } from "lucide-react";

export default function AccountsPage() {
  useLocale();
  const params = useSearchParams();
  const { getAccounts, handleAccountChange, isLoading } = useTelegramAccount();
  if (params.has("id")) return <ChatWorkspace />;
  const accounts = getAccounts();
  return (
    <div>
      <PageHeading
        title={t("Account management")}
        description={t("Manage Telegram accounts and their connections.")}
      >
        <AccountDialog isAdd>
          <Button>
            <Plus data-icon="inline-start" />
            {t("Add account")}
          </Button>
        </AccountDialog>
      </PageHeading>
      {isLoading ? (
        <p className="text-muted-foreground">{t("Loading...")}</p>
      ) : accounts.length ? (
        <AccountList
          accounts={accounts}
          onSelectAccount={handleAccountChange}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("Add a Telegram account to start browsing files.")}
        </p>
      )}
    </div>
  );
}
