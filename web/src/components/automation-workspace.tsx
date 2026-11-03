"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { LoaderCircle } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useTelegramAccount } from "@/hooks/use-telegram-account";
import { useTelegramChat } from "@/hooks/use-telegram-chat";
import { t, translateError } from "@/lib/i18n";
import { POST } from "@/lib/api";
import {
  defaultAutomation,
  automationValidationError,
} from "@/lib/automation-settings";
import type { Auto } from "@/lib/types";
import AccountSelect from "@/components/account-select";
import ChatSelect from "@/components/chat-select";
import AutomationForm from "@/components/automation-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const emptyAuto = defaultAutomation();

export function AutomationWorkspace() {
  useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const accountContext = useTelegramAccount();
  const { chat, isLoading, reload } = useTelegramChat();
  const { mutate } = useSWRConfig();
  const [draft, setDraft] = useState<{ key: string; auto: Auto }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const accountId = params.get("id");
  const key = `${accountId}:${chat?.id}`;
  const auto = draft?.key === key ? draft.auto : (chat?.auto ?? emptyAuto);
  const accounts = accountContext.getAccounts("active");

  function select(name: "id" | "chatId", value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(name, value);
    if (name === "id") next.delete("chatId");
    next.set("tab", "rules");
    setError("");
    router.replace(`/automations?${next}`, { scroll: false });
  }

  async function save() {
    if (!accountId || !chat) return;
    const validation = automationValidationError(auto);
    if (validation) {
      setError(t(validation));
      return;
    }
    setSaving(true);
    setError("");
    setSavedKey("");
    try {
      await POST(
        `/${accountId}/file/update-auto-settings?telegramId=${accountId}&chatId=${chat.id}`,
        auto,
      );
      await Promise.all([reload(), mutate("/automations/chats")]);
      setDraft(undefined);
      setSavedKey(key);
    } catch (failure) {
      setError(
        translateError(
          failure instanceof Error
            ? failure.message
            : "Unable to save automation settings",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="automation-editor" className="mb-8 scroll-mt-4">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t("Configure automation")}
        </CardTitle>
        <CardDescription>
          {t(
            "Choose a Telegram account and chat, then configure and save its rules here.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!accountContext.isLoading && accounts.length === 0 ? (
          <div className="rounded-md border border-dashed p-5">
            <p className="mb-3 text-sm text-muted-foreground">
              {t(
                "Sign in to a Telegram account before configuring automation.",
              )}
            </p>
            <Button asChild>
              <Link href="/accounts">{t("Go to account management")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <AccountSelect
                {...accountContext}
                disabled={saving}
                ariaLabel={t("Telegram account")}
                handleAccountChange={(id) => select("id", id)}
              />
              <ChatSelect
                disabled={!accountId || saving}
                onChatChange={(id) => select("chatId", id)}
              />
            </div>
            {chat && accountId ? (
              <>
                <div className="border-t pt-6">
                  <h2 className="mb-4 font-semibold">{chat.name || chat.id}</h2>
                  <fieldset disabled={saving} className="min-w-0">
                    <AutomationForm
                      auto={auto}
                      onChange={(value) => {
                        setDraft({ key, auto: value });
                        setSavedKey("");
                      }}
                    />
                  </fieldset>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {savedKey === key && (
                  <p role="status" className="text-sm">
                    {t("Automation settings saved")}
                  </p>
                )}
                <Button
                  className="self-start"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving && <LoaderCircle className="animate-spin" />}
                  {t("Save automation settings")}
                </Button>
              </>
            ) : (
              <p className="rounded-md bg-muted/40 p-5 text-sm text-muted-foreground">
                {isLoading
                  ? t("Loading...")
                  : t(
                      "Select an account and chat above to start configuring automation.",
                    )}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
