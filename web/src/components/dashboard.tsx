"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronRight, FolderOpen, LoaderCircle } from "lucide-react";
import { PageHeading } from "@/components/app-shell";
import { FileCoverGrid, TaskList } from "@/components/file-library";
import FileViewer from "@/components/file-viewer";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { t, translateError } from "@/lib/i18n";
import type { TelegramFile } from "@/lib/types";

type FilePage = { files: TelegramFile[] };
type Counts = {
  downloading: number;
  completed: number;
  error: number;
  paused: number;
};

export function Dashboard() {
  useLocale();
  const options = { refreshInterval: 5000 };
  const counts = useSWR<Counts>("/files/count", options);
  const tasks = useSWR<FilePage>(
    "/files?type=all&taskOnly=true&limit=5",
    options,
  );
  const recent = useSWR<FilePage>(
    "/files?type=all&downloadStatus=completed&sort=completion_date&order=desc&limit=6",
    options,
  );
  const [preview, setPreview] = useState<TelegramFile>();
  const [open, setOpen] = useState(false);
  const show = (file: TelegramFile) => {
    setPreview(file);
    setOpen(true);
  };
  const refresh = () => {
    void counts.mutate();
    void tasks.mutate();
    void recent.mutate();
  };
  const metrics = [
    {
      key: "downloading",
      label: "Downloading",
      href: "/downloads?downloadStatus=downloading",
      color: "text-primary",
    },
    { key: "completed", label: "Completed", href: "/files", color: "" },
    {
      key: "error",
      label: "Download failed",
      href: "/downloads?downloadStatus=error",
      color: "text-destructive",
    },
    {
      key: "paused",
      label: "Paused",
      href: "/downloads?downloadStatus=paused",
      color: "text-muted-foreground",
    },
  ] as const;
  const error = counts.error ?? tasks.error ?? recent.error;
  return (
    <div className="flex flex-col gap-9">
      <div>
        <PageHeading
          title={t("Overview")}
          description={t("Monitor downloads and recently completed files.")}
        />
        <div className="grid grid-cols-2 gap-y-7 md:grid-cols-4">
          {metrics.map(({ key, label, href, color }) => (
            <Link
              href={href}
              key={key}
              className="flex flex-col gap-2 border-l px-5 first:border-0 first:pl-0 md:px-8"
            >
              <span className="text-base text-muted-foreground lg:text-lg">
                {t(label)}
              </span>
              <strong
                className={`text-4xl font-semibold tabular-nums lg:text-5xl ${color}`}
              >
                {counts.isLoading ? "—" : (counts.data?.[key] ?? "—")}
              </strong>
            </Link>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {translateError(error.message)}
        </p>
      )}
      <section className="flex flex-col gap-4">
        <SectionTitle title={t("Download tasks")} href="/downloads" />
        {tasks.isLoading ? (
          <Loading />
        ) : tasks.data?.files.length ? (
          <TaskList
            files={tasks.data.files}
            onChange={refresh}
            onPreview={show}
          />
        ) : (
          <EmptyPanel text={t("No download tasks yet")} />
        )}
      </section>
      <section className="flex flex-col gap-4">
        <SectionTitle title={t("Recently completed")} href="/files" />
        {recent.isLoading ? (
          <Loading />
        ) : recent.data?.files.length ? (
          <FileCoverGrid files={recent.data.files} onPreview={show} />
        ) : (
          <EmptyPanel text={t("Completed files will appear here.")} />
        )}
      </section>
      {preview && (
        <FileViewer
          open={open}
          onOpenChange={setOpen}
          file={preview}
          onFileChange={setPreview}
          hasMore={false}
          isLoading={false}
          handleLoadMore={async () => {}}
        />
      )}
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
        {title}
      </h2>
      <Button variant="link" asChild>
        <Link href={href}>
          {t("View all")}
          <ChevronRight data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
}
function Loading() {
  return (
    <div className="flex min-h-40 items-center justify-center text-muted-foreground">
      <LoaderCircle
        className="size-5 animate-spin"
        aria-label={t("Loading...")}
      />
    </div>
  );
}
function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
      <FolderOpen className="size-7" />
      <p className="text-sm">{text}</p>
      <Button variant="link" asChild>
        <Link href="/chats">{t("Browse chat files")}</Link>
      </Button>
    </div>
  );
}
