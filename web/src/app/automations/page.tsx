"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/app-shell";
import { AutomationOverview } from "@/components/automation-overview";
import { AutomationGuide } from "@/components/automation-guide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
export default function AutomationsPage() {
  useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "guide" ? "guide" : "rules";
  return (
    <div>
      <PageHeading
        title={t("Automations")}
        description={t("Manage chat rules and learn how to configure them.")}
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.replace(`/automations?tab=${value}`, { scroll: false })
        }
      >
        <TabsList className="mb-6">
          <TabsTrigger value="rules">{t("Configured chats")}</TabsTrigger>
          <TabsTrigger value="guide">{t("Setup guide")}</TabsTrigger>
        </TabsList>
        <TabsContent value="rules">
          <AutomationOverview />
        </TabsContent>
        <TabsContent value="guide">
          <AutomationGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
}
