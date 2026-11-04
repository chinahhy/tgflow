"use client";

import useSWR from "swr";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/app-shell";
import SettingsForm from "@/components/settings-form";
import FileStatistics from "@/components/file-statistics";
import Proxys from "@/components/proxys";
import About from "@/components/about";
import DebugTelegramMethod from "@/components/debug-telegram-method";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AccountSelect from "@/components/account-select";
import { Button } from "@/components/ui/button";
import { useTelegramAccount } from "@/hooks/use-telegram-account";
import { useLocale } from "@/hooks/use-locale";
import { t, translateError } from "@/lib/i18n";

export default function SettingsPage() {
  useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const accounts = useTelegramAccount();
  const proxyAccounts = accounts.getAccounts();
  const proxyAccount =
    proxyAccounts.find((account) => account.id === accounts.accountId) ??
    (proxyAccounts.length === 1 ? proxyAccounts[0] : undefined);
  const storage = useSWR<{
    appRoot: string;
    downloadRoot: string;
    filesRoot: string;
  }>("/storage");
  const choices = [
    { value: "general", label: "General" },
    { value: "storage", label: "Storage" },
    { value: "statistics", label: "Statistics" },
    { value: "proxys", label: "Proxys" },
    { value: "api", label: "API" },
    { value: "about", label: "About" },
  ];
  const tab = choices.some((choice) => choice.value === params.get("tab"))
    ? params.get("tab")!
    : "general";
  const navigate = (change: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(change).forEach(([key, value]) => next.set(key, value));
    router.replace(`/settings?${next.toString()}`, { scroll: false });
  };
  return (
    <div>
      <PageHeading
        title={t("Settings")}
        description={t(
          "Manage storage, download behavior and account preferences.",
        )}
      />
      <Tabs value={tab} onValueChange={(value) => navigate({ tab: value })}>
        <TabsList className="mb-6 h-auto max-w-full flex-wrap justify-start">
          {choices.map((choice) => (
            <TabsTrigger key={choice.value} value={choice.value}>
              {t(choice.label)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general">
          <SettingsForm inline />
        </TabsContent>
        <TabsContent value="storage">
          <Card className="max-w-4xl">
            <CardHeader>
              <CardTitle>{t("Storage")}</CardTitle>
              <CardDescription>
                {t(
                  "Keep application state on SSD and downloaded media on HDD.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {storage.error ? (
                <p role="alert">{translateError(storage.error.message)}</p>
              ) : (
                <dl className="flex flex-col gap-5">
                  {[
                    { key: "appRoot", name: "Application state directory" },
                    { key: "downloadRoot", name: "Download directory" },
                    { key: "filesRoot", name: "Completed file directory" },
                  ].map((item) => (
                    <div key={item.key}>
                      <dt className="mb-2 text-sm text-muted-foreground">
                        {t(item.name)}
                      </dt>
                      <dd className="break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
                        {storage.data?.[
                          item.key as keyof typeof storage.data
                        ] ?? t("Loading...")}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(
                  "These are container paths. Configure the SSD and HDD host mounts in Docker Compose. Download staging also uses the download volume.",
                )}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="statistics">
          <div className="mb-6">
            <AccountSelect
              {...accounts}
              handleAccountChange={(id) => navigate({ id })}
            />
          </div>
          {accounts.accountId ? (
            <FileStatistics telegramId={accounts.accountId} />
          ) : (
            <p>{t("Please select an account to view statistics")}</p>
          )}
        </TabsContent>
        <TabsContent value="proxys">
          <div className="mb-6 flex flex-col gap-2">
            <AccountSelect
              {...accounts}
              includeInactive
              accountId={proxyAccount?.id}
              account={proxyAccount}
              ariaLabel={t("Telegram account")}
              handleAccountChange={(id) => navigate({ id })}
            />
            <p className="text-sm text-muted-foreground">
              {accounts.isLoading
                ? t("Loading...")
                : proxyAccounts.length === 0
                  ? t(
                      "Save a proxy profile, then choose it when adding a Telegram account.",
                    )
                  : proxyAccount
                    ? t(
                        "Apply the selected proxy to {name}. Accounts awaiting login are supported.",
                        { name: proxyAccount.name },
                      )
                    : t("Select an account before applying a proxy.")}
            </p>
            {!accounts.isLoading && proxyAccounts.length === 0 && (
              <Button asChild variant="outline" className="w-fit">
                <Link href="/accounts">{t("Go to account management")}</Link>
              </Button>
            )}
          </div>
          <Proxys
            key={`${proxyAccount?.id ?? "profiles"}:${proxyAccount?.proxy ?? ""}`}
            telegramId={proxyAccount?.id}
            proxyName={proxyAccount?.proxy}
            enableSelect
          />
        </TabsContent>
        <TabsContent value="api">
          <DebugTelegramMethod />
        </TabsContent>
        <TabsContent value="about">
          <About />
        </TabsContent>
      </Tabs>
    </div>
  );
}
