"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { LoaderCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useTelegramApplication,
  type TelegramApplicationStatus,
} from "@/hooks/use-telegram-application";
import { useLocale } from "@/hooks/use-locale";
import { request } from "@/lib/api";
import { t, translateError } from "@/lib/i18n";

export function TelegramApplicationSettings() {
  useLocale();
  const { data, error, isLoading, mutate } = useTelegramApplication();
  const { mutate: refresh } = useSWRConfig();
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [logLevel, setLogLevel] = useState("0");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !dirty) {
      setApiId(data.apiId ? String(data.apiId) : "");
      setLogLevel(String(data.logLevel ?? 0));
    }
  }, [data, dirty]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const status = await request<TelegramApplicationStatus>(
        "/telegram/application",
        {
          method: "POST",
          body: JSON.stringify({
            apiId: Number(apiId),
            ...(apiHash.trim() ? { apiHash: apiHash.trim() } : {}),
            logLevel: Number(logLevel),
          }),
        },
      );
      setApiHash("");
      setDirty(false);
      await mutate(status, false);
      setSaved(true);
      void refresh("/telegrams");
    } catch (failure) {
      setSaveError(
        translateError(
          failure instanceof Error
            ? failure.message
            : "Unable to save Telegram application settings",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="telegram-application" className="mb-8 max-w-4xl">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{t("Telegram application credentials")}</CardTitle>
          {data && (
            <Badge variant={data.configured ? "secondary" : "outline"}>
              {t(data.configured ? "Configured" : "Not configured")}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t(
            "Save one API ID and Hash for all Telegram accounts. No Docker environment variables are required.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>{t("Loading...")}</p>
        ) : error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p>{translateError(error.message)}</p>
            <Button variant="outline" onClick={() => void mutate()}>
              {t("Retry")}
            </Button>
          </div>
        ) : data ? (
          <form onSubmit={save} className="flex flex-col gap-5">
            {data.storageError && (
              <p role="alert" className="text-sm text-destructive">
                {t(
                  "Saved Telegram settings could not be read. Enter and save the credentials again.",
                )}
              </p>
            )}
            {data.source === "environment" && (
              <p className="text-sm text-muted-foreground">
                {t(
                  "Existing environment credentials are available. Save once to keep them on the configuration volume.",
                )}
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="telegram-api-id">{t("API ID")}</Label>
                <Input
                  id="telegram-api-id"
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  required
                  value={apiId}
                  onChange={(event) => {
                    setApiId(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="telegram-api-hash">{t("API Hash")}</Label>
                <Input
                  id="telegram-api-hash"
                  type="password"
                  autoComplete="new-password"
                  required={!data.apiHashConfigured}
                  maxLength={256}
                  value={apiHash}
                  placeholder={
                    data.apiHashConfigured
                      ? t("Saved; leave blank to keep unchanged")
                      : ""
                  }
                  onChange={(event) => {
                    setApiHash(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                "Obtain these application credentials at my.telegram.org. Phone number, verification code and two-step password are entered separately when signing in.",
              )}{" "}
              <a
                className="underline"
                href="https://my.telegram.org"
                target="_blank"
                rel="noreferrer"
              >
                {t("Open my.telegram.org")}
              </a>
            </p>
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t("Advanced settings")}
              </summary>
              <div className="mt-4 flex max-w-sm flex-col gap-2">
                <Label htmlFor="telegram-log-level">
                  {t("Telegram log level")}
                </Label>
                <Input
                  id="telegram-log-level"
                  type="number"
                  min={0}
                  max={1023}
                  step={1}
                  value={logLevel}
                  onChange={(event) => {
                    setLogLevel(event.target.value);
                    setDirty(true);
                    setSaved(false);
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Default 0. Logging changes apply when a Telegram connection is initialized.",
                  )}
                </p>
              </div>
            </details>
            <p className="text-sm text-muted-foreground">
              {t(
                "Saved on the configuration volume and kept after container recreation. Changes apply to new or reconnected accounts without interrupting current downloads.",
              )}
            </p>
            {saveError && (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            )}
            {saved && (
              <p role="status" className="text-sm">
                {t("Telegram application settings saved")}
              </p>
            )}
            <Button type="submit" disabled={saving} className="self-start">
              {saving && <LoaderCircle className="animate-spin" />}
              {t("Save application settings")}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
