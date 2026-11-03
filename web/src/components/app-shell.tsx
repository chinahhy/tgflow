"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Home,
  Folder,
  Download,
  FileCheck,
  Workflow,
  Users,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  Send,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import ThemeToggleButton from "@/components/theme-toggle-button";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/hooks/use-admin-session";
import { TooltipWrapper } from "@/components/ui/tooltip";

const navigation = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/chats", label: "Chat files", icon: Folder },
  { href: "/downloads", label: "Download tasks", icon: Download },
  { href: "/files", label: "Downloaded files", icon: FileCheck },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/accounts", label: "Account management", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  useLocale();
  const pathname = usePathname();
  const search = useSearchParams();
  const [collapsed, setCollapsed] = useLocalStorage(
    "tgflow.sidebar.collapsed",
    false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAdminSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const activePath =
    pathname === "/accounts" && search.has("id") ? "/chats" : pathname;
  const links = (compact: boolean) => (
    <nav aria-label={t("Main navigation")} className="flex flex-col gap-3 px-3">
      {navigation.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          aria-current={activePath === href ? "page" : undefined}
          title={compact ? t(label) : undefined}
          className={cn(
            "flex h-[52px] items-center gap-4 rounded-lg px-4 text-base transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:text-lg",
            activePath === href && "bg-primary/10 font-medium text-primary",
            compact && "justify-center px-2",
          )}
        >
          <Icon
            className="size-5 shrink-0"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <span className={compact ? "sr-only" : "truncate"}>{t(label)}</span>
        </Link>
      ))}
    </nav>
  );
  const brand = (compact: boolean) => (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-3"
      aria-label="TGFlow"
    >
      <Send className="size-8 shrink-0 text-primary" strokeWidth={2.3} />
      {!compact && (
        <span className="text-[26px] font-bold tracking-tight">TGFlow</span>
      )}
    </Link>
  );
  return (
    <div className="tgflow-shell flex min-h-dvh bg-background text-foreground">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-[hsl(var(--sidebar))] transition-[width] md:flex",
          collapsed ? "w-[76px]" : "w-[292px]",
        )}
      >
        <div
          className={cn(
            "flex h-24 items-center justify-between gap-2 px-7",
            collapsed && "flex-col justify-center gap-1 px-2",
          )}
        >
          {brand(collapsed)}
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>
        </div>
        {links(collapsed)}
        <p
          className={cn(
            "mt-auto p-7 text-xs text-muted-foreground",
            collapsed && "px-2 text-center",
          )}
        >
          <span>{collapsed ? "dev" : "TGFlow · dev"}</span>
        </p>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between gap-3 px-5 md:h-12 md:justify-end md:px-11">
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("Open navigation")}
              >
                <Menu />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="left-0 top-0 flex h-dvh w-[292px] max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">
                {t("Main navigation")}
              </DialogTitle>
              <div className="flex h-24 items-center px-7">{brand(false)}</div>
              {links(false)}
            </DialogContent>
          </Dialog>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggleButton />
            <TooltipWrapper content={t("Log out")}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Log out")}
                disabled={loggingOut}
                onClick={() => {
                  setLoggingOut(true);
                  void logout().finally(() => setLoggingOut(false));
                }}
              >
                <LogOut />
              </Button>
            </TooltipWrapper>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1680px] px-5 pb-10 md:px-11"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight md:text-[44px] md:leading-[1.25]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-lg">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
