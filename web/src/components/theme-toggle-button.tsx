"use client";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const modes = [
  { value: "system", label: "Follow system", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];
export default function ThemeToggleButton({
  compact = true,
}: {
  compact?: boolean;
}) {
  useLocale();
  const { theme, setTheme } = useTheme();
  const current = modes.find((mode) => mode.value === theme) ?? modes[0]!;
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "default"}
          aria-label={t("Choose theme")}
          title={t("Choose theme")}
          className={cn(!compact && "w-full justify-start gap-3")}
        >
          <Icon aria-hidden="true" />
          {!compact && (
            <span>{t("Theme: {mode}", { mode: t(current.label) })}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuRadioGroup value={current.value} onValueChange={setTheme}>
          {modes.map(({ value, label, icon: ModeIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <ModeIcon className="mr-2 size-4" aria-hidden="true" />
              {t(label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
