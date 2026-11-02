"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";
import type { AutoDownloadRule } from "@/lib/types";

export function AutomationFileRules({
  value,
  onChange,
}: {
  value: AutoDownloadRule;
  onChange: (value: AutoDownloadRule) => void;
}) {
  useLocale();
  const [extensionsDraft, setExtensionsDraft] = useState(
    value.extensions?.join(", ") ?? "",
  );
  useEffect(() => {
    setExtensionsDraft(value.extensions?.join(", ") ?? "");
  }, [value.extensions]);
  const sizeChange = (field: "minSize" | "maxSize", raw: string) => {
    const number = Number(raw);
    onChange({
      ...value,
      [field]:
        raw === "" ? undefined : Math.max(0, Math.round(number * 1024 * 1024)),
    });
  };
  return (
    <fieldset className="flex flex-col gap-4 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("File matching rules")}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="auto-min-size">{t("Minimum size (MB)")}</Label>
          <Input
            id="auto-min-size"
            type="number"
            min="0"
            step="any"
            value={
              value.minSize === undefined ? "" : value.minSize / 1024 / 1024
            }
            onChange={(e) => sizeChange("minSize", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="auto-max-size">{t("Maximum size (MB)")}</Label>
          <Input
            id="auto-max-size"
            type="number"
            min={value.minSize === undefined ? 0 : value.minSize / 1024 / 1024}
            step="any"
            value={
              value.maxSize === undefined ? "" : value.maxSize / 1024 / 1024
            }
            onChange={(e) => sizeChange("maxSize", e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="auto-extensions">{t("File extensions")}</Label>
        <Input
          id="auto-extensions"
          placeholder={t("e.g. mp4, mkv, zip")}
          value={extensionsDraft}
          onChange={(e) => setExtensionsDraft(e.target.value)}
          onBlur={() =>
            onChange({
              ...value,
              extensions: extensionsDraft
                .split(/[,;\s]+/)
                .map((v) => v.toLowerCase().replace(/^\./, ""))
                .filter(Boolean),
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t(
            "Blank means unrestricted. Rules apply to historical and new files.",
          )}
        </p>
      </div>
    </fieldset>
  );
}
