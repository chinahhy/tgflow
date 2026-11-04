"use client";
import { t, translateError } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

import React, { useRef, useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Copy,
  Network,
  Plus,
  SquarePen,
  Trash,
  Unplug,
} from "lucide-react";
import { type Proxy } from "@/lib/types";
import { parseProxyProfiles } from "@/lib/proxy-profiles";
import { cn, parseProxyString } from "@/lib/utils";
import useSWRMutation from "swr/mutation";
import { request } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import ProxyPing from "@/components/proxy-ping";
import { Label } from "./ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { mutate } from "swr";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ProxysProps {
  inDialog?: boolean;
  enableSelect?: boolean;
  telegramId?: string;
  proxyName?: string;
  onProxyNameChange?: (name: string) => void;
}

export default function Proxys({
  inDialog = false,
  enableSelect,
  telegramId,
  proxyName,
  onProxyNameChange,
}: ProxysProps) {
  useLocale();
  const { settings, updateSettings, isLoading } = useSettings();
  const [innerProxyName, setInnerProxyName] = useState(proxyName ?? "");
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const proxyNameInput = useRef<HTMLInputElement>(null);
  const [formState, setFormState] = useState<Proxy>({
    name: "",
    server: "",
    port: 0,
    username: "",
    password: "",
    secret: "",
    type: "http",
  });
  const { trigger: triggerProxy, isMutating: isToggleProxyMutating } =
    useSWRMutation<{ id: string }, Error>(
      telegramId ? `/telegram/${telegramId}/toggle-proxy` : undefined,
      async (key: string) => {
        return await request(key, {
          method: "POST",
          body: JSON.stringify({
            proxyName: innerProxyName,
          }),
        });
      },
      {
        onSuccess: () => {
          void mutate(`/telegrams`);
          toast({
            variant: "success",
            description: innerProxyName
              ? t("Proxy is set to {name}", { name: innerProxyName })
              : t("Proxy is disabled"),
          });
        },
      },
    );

  const { items: proxys, invalid: invalidProxys } = parseProxyProfiles(
    settings?.proxys,
  );
  const [saving, setSaving] = useState(false);
  const saveProfiles = async (items: Proxy[]) => {
    setSaving(true);
    try {
      await updateSettings({ proxys: JSON.stringify({ items }) });
      return true;
    } catch {
      toast({
        variant: "error",
        description: t("Unable to save proxy settings"),
      });
      return false;
    } finally {
      setSaving(false);
    }
  };
  // Open dialog for adding or editing proxy
  const handleOpenDialog = (proxy: Proxy | null = null): void => {
    setEditingProxy(proxy);
    setFormState(
      proxy ?? {
        name: "",
        server: "",
        port: 0,
        username: "",
        password: "",
        secret: "",
        type: "http",
      },
    );
    setDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = (): void => {
    setDialogOpen(false);
    setEditingProxy(null);
  };

  // Delete proxy with confirmation
  const handleDeleteProxy = async (proxy: Proxy) => {
    if (
      !invalidProxys &&
      confirm(
        t("Are you sure you want to delete the proxy {name}?", {
          name: proxy.name,
        }),
      )
    )
      await saveProfiles(proxys.filter((item) => item.name !== proxy.name));
  };

  const handleSaveProxy = async () => {
    if (invalidProxys) return;
    if (parseProxyProfiles({ items: [formState] }).invalid) {
      toast({
        variant: "warning",
        description: t(
          "Enter a proxy name, server and a port between 1 and 65535.",
        ),
      });
      return;
    }
    if (
      proxys.some(
        (item) =>
          item.name === formState.name && item.name !== editingProxy?.name,
      )
    ) {
      toast({
        variant: "warning",
        description: t("Proxy name already exists"),
      });
      return;
    }
    const items = editingProxy
      ? proxys.map((item) =>
          item.name === editingProxy.name ? formState : item,
        )
      : [...proxys, formState];
    if (await saveProfiles(items)) handleCloseDialog();
  };

  // Handle form input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: name === "port" ? parseInt(value, 10) : value,
    }));
  };

  const handleProxySubmit = async () => {
    try {
      if (telegramId) {
        await triggerProxy();
      } else {
        onProxyNameChange?.(innerProxyName);
      }
    } catch (error) {
      toast({
        variant: "error",
        description:
          error instanceof Error
            ? translateError(error.message)
            : t("Unable to apply proxy"),
      });
    }
  };
  const proxyCountLabel = t("{count} proxies", { count: proxys.length });

  return (
    <div className="relative flex h-full flex-col gap-4">
      {invalidProxys && (
        <div role="alert" className="rounded-md border p-4 text-sm">
          <p>
            {t(
              "Saved proxy settings could not be read. The original data has not been changed.",
            )}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (
                confirm(
                  t("Resetting will clear the saved proxy list. Continue?"),
                )
              )
                void saveProfiles([]);
            }}
          >
            {t("Reset proxy list")}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <Network className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal">
                {t("Proxies")}
              </h1>
              <Badge variant="secondary">{proxyCountLabel}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Manage saved proxy profiles for Telegram connections.")}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {telegramId && <ProxyPing accountId={telegramId} />}
          <Button
            onClick={() => handleOpenDialog()}
            disabled={isLoading || saving || invalidProxys}
          >
            <Plus />
            {t("Add proxy")}
          </Button>
        </div>
      </div>
      {proxys.length === 0 && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Unplug className="size-5" />
          </span>
          <div>
            <p className="font-medium">{t("No proxies added yet")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Add a proxy profile or paste one from your clipboard.")}
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {proxys.map((proxy) => (
          <Card
            key={proxy.name}
            className={cn(
              "relative border bg-card shadow-sm transition-colors hover:bg-accent/40",
              enableSelect && "cursor-pointer",
              enableSelect &&
                innerProxyName === proxy.name &&
                "border-primary bg-accent/50",
            )}
            onClick={() => {
              if (!enableSelect) {
                return;
              }
              if (innerProxyName === proxy.name) {
                setInnerProxyName("");
              } else {
                setInnerProxyName(proxy.name);
              }
            }}
          >
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-start justify-between gap-3 text-base">
                <span className="min-w-0 truncate font-semibold">
                  {proxy.name}
                </span>
                {enableSelect && (
                  <Checkbox
                    checked={innerProxyName === proxy.name}
                    aria-label={t("Select {name}", { name: proxy.name })}
                  />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline">{proxy.type.toUpperCase()}</Badge>
                <p className="truncate font-mono text-sm text-muted-foreground">{`${proxy.server}:${proxy.port}`}</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-1 border-t px-2 py-1.5">
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Edit {name}", { name: proxy.name })}
                disabled={saving || invalidProxys}
                className="size-8"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenDialog(proxy);
                }}
              >
                <SquarePen />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Delete {name}", { name: proxy.name })}
                disabled={saving || invalidProxys}
                className="size-8 text-destructive hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDeleteProxy(proxy);
                }}
              >
                <Trash />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      {enableSelect && (
        <div className="mt-auto flex flex-col-reverse items-center justify-end gap-2 border-t bg-background/95 pt-3 backdrop-blur sm:flex-row">
          {inDialog && (
            <DialogClose asChild>
              <Button
                className="w-full md:w-auto"
                variant="outline"
                type="button"
              >
                {t("Cancel")}
              </Button>
            </DialogClose>
          )}
          <Button
            className="w-full md:w-auto"
            disabled={
              isToggleProxyMutating ||
              saving ||
              invalidProxys ||
              (!!innerProxyName &&
                !proxys.some((proxy) => proxy.name === innerProxyName)) ||
              (!telegramId && !onProxyNameChange)
            }
            onClick={() => handleProxySubmit()}
          >
            <Check />
            {t("Apply proxy")}
          </Button>
        </div>
      )}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            proxyNameInput.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{editingProxy ? t("Edit proxy") : t("Add proxy")}</span>
              <ProxyParser onParsed={(proxy) => setFormState(proxy)} />
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("Type")}</Label>
              <RadioGroup
                value={formState.type}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    type: value as Proxy["type"],
                  }))
                }
                className="grid grid-cols-3 gap-2"
              >
                {["http", "socks5", "mtproto"].map((type) => (
                  <label
                    key={type}
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      formState.type === type
                        ? "border-primary bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/40",
                    )}
                  >
                    <RadioGroupItem value={type} className="sr-only" />
                    {type.toUpperCase()}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="proxy-name">{t("Name")}</Label>
              <Input
                id="proxy-name"
                ref={proxyNameInput}
                name="name"
                value={formState.name}
                onChange={handleInputChange}
                placeholder={t("Enter proxy name")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("Proxy server")}</Label>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="proxy-server"
                    className="text-xs text-muted-foreground"
                  >
                    {t("Server")}
                  </Label>
                  <Input
                    id="proxy-server"
                    name="server"
                    value={formState.server}
                    onChange={handleInputChange}
                    placeholder={t("Enter server address")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="proxy-port"
                    className="text-xs text-muted-foreground"
                  >
                    {t("Port")}
                  </Label>
                  <Input
                    id="proxy-port"
                    name="port"
                    type="number"
                    value={formState.port}
                    onChange={handleInputChange}
                    placeholder={t("Enter port number")}
                  />
                </div>
              </div>
            </div>
            <Label>{t("Authentication (optional)")}</Label>
            {formState.type === "mtproto" ? (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="proxy-secret"
                  className="text-xs text-muted-foreground"
                >
                  {t("Secret")}
                </Label>
                <Input
                  id="proxy-secret"
                  name="secret"
                  value={formState.secret}
                  onChange={handleInputChange}
                  placeholder={t("Enter secret")}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="proxy-username"
                    className="text-xs text-muted-foreground"
                  >
                    {t("Username")}
                  </Label>
                  <Input
                    id="proxy-username"
                    name="username"
                    value={formState.username}
                    onChange={handleInputChange}
                    placeholder={t("Enter username")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="proxy-password"
                    className="text-xs text-muted-foreground"
                  >
                    {t("Password")}
                  </Label>
                  <Input
                    id="proxy-password"
                    name="password"
                    type="password"
                    value={formState.password}
                    onChange={handleInputChange}
                    placeholder={t("Enter password")}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCloseDialog} variant="outline">
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => void handleSaveProxy()}
              disabled={isLoading || saving || invalidProxys}
            >
              {editingProxy ? t("Save proxy") : t("Add proxy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProxyParser({ onParsed }: { onParsed: (proxys: Proxy) => void }) {
  useLocale();
  const handleParseProxy = async () => {
    const clipboardText = await navigator.clipboard.readText();
    if (!clipboardText || clipboardText.trim().length === 0) {
      return;
    }
    const proxy = parseProxyString(clipboardText);
    if (proxy) {
      toast({
        variant: "success",
        description: t("Proxy string is parsed successfully"),
      });
      onParsed(proxy);
    } else {
      toast({
        variant: "error",
        description: t("Invalid proxy string format"),
      });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="xs"
            variant="ghost"
            aria-label={t("Parse a proxy string from the clipboard")}
            onClick={() => handleParseProxy()}
          >
            <Copy />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex max-w-80 flex-col gap-2 p-2">
            <p className="text-sm font-semibold">
              {t("Parse a proxy string from the clipboard")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("The proxy should be in the following format:")}
              <br />
              <code>http://username:password@server:port</code>
              <br />
              <code>socks://username:password@server:port</code>
              <br />
              <code>mtproto://server:port?secret=your_secret</code>
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
