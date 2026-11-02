"use client";
import FileList from "@/components/mobile/file-list";
import { FileTable } from "@/components/file-table";
import { FileLibrary } from "@/components/file-library";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useIsMobile from "@/hooks/use-is-mobile";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Grid2X2, List } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export default function Files(props: {
  accountId: string;
  chatId: string;
  messageThreadId?: number;
  link?: string;
}) {
  useLocale();
  const mobile = useIsMobile();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("view");
  const view =
    requested === "grid" || requested === "list"
      ? requested
      : pathname === "/files"
        ? "grid"
        : "list";
  return (
    <Tabs
      value={view}
      onValueChange={(nextView) => {
        const next = new URLSearchParams(params.toString());
        next.set("view", nextView);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
    >
      <TabsList className="mb-4">
        <TabsTrigger value="grid" className="gap-2">
          <Grid2X2 className="size-4" />
          {t("Cover wall")}
        </TabsTrigger>
        <TabsTrigger value="list" className="gap-2">
          <List className="size-4" />
          {t("List view")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="grid">
        <FileLibrary {...props} />
      </TabsContent>
      <TabsContent value="list">
        {mobile ? <FileList {...props} /> : <FileTable {...props} />}
      </TabsContent>
    </Tabs>
  );
}
