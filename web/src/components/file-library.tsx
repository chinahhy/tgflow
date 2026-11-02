"use client";

import { useState } from "react";
import prettyBytes from "pretty-bytes";
import { FileSearch, LoaderCircle } from "lucide-react";
import FilePreview from "@/components/file-image";
import FileViewer from "@/components/file-viewer";
import FileFilters from "@/components/file-filters";
import { Button } from "@/components/ui/button";
import { TaskActions } from "@/components/task-actions";
import { useFiles } from "@/hooks/use-files";
import { useLocale } from "@/hooks/use-locale";
import { t, translateError, formatDate } from "@/lib/i18n";
import type { TelegramFile } from "@/lib/types";

export function TaskStatus({ file }: { file: TelegramFile }) {
  useLocale();
  const percentage =
    file.size > 0
      ? Math.max(
          0,
          Math.min(100, Math.floor((file.downloadedSize / file.size) * 100)),
        )
      : 0;
  const names = {
    idle: "Not Download",
    downloading: "Downloading",
    paused: "Paused",
    completed: "Completed",
    error: "Download failed",
  };
  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      <span>{t(names[file.downloadStatus])}</span>
      {file.downloadStatus === "downloading" && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={t("Download progress")}
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{percentage}%</span>
        </div>
      )}
      {file.downloadStatus === "error" && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="break-words">
            {file.errorMessage
              ? translateError(file.errorMessage)
              : t("No failure reason was recorded")}
          </span>
          {file.errorAt ? (
            <time dateTime={new Date(file.errorAt).toISOString()}>
              {formatDate(file.errorAt, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TaskList({
  files,
  onChange,
  onPreview,
}: {
  files: TelegramFile[];
  onChange?: () => void;
  onPreview?: (file: TelegramFile) => void;
}) {
  useLocale();
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="hidden grid-cols-[minmax(0,3.7fr)_1.6fr_minmax(0,4fr)_80px] gap-5 border-b bg-muted/40 px-5 py-4 text-base text-muted-foreground md:grid">
        <span>{t("File")}</span>
        <span>{t("Size")}</span>
        <span>{t("Status")}</span>
        <span className="text-right">{t("Actions")}</span>
      </div>
      <ul>
        {files.map((file) => (
          <li
            key={file.uniqueId}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b px-4 py-4 last:border-0 md:grid-cols-[minmax(0,3.7fr)_1.6fr_minmax(0,4fr)_80px] md:gap-5 md:px-5"
          >
            <button
              className="flex min-w-0 items-center gap-4 text-left hover:text-primary"
              onClick={() => onPreview?.(file)}
              title={file.fileName}
            >
              <div className="tgflow-cover h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                <FilePreview
                  file={file}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="min-w-0 truncate text-base font-medium">
                {file.fileName || t("Unnamed attachment")}
              </span>
            </button>
            <span className="hidden text-base md:block">
              {prettyBytes(file.size || 0)}
            </span>
            <div className="col-span-2 min-w-0 md:col-span-1">
              <TaskStatus file={file} />
            </div>
            <div className="col-start-2 row-start-1 flex justify-end md:col-auto md:row-auto">
              <TaskActions file={file} onChange={onChange} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FileCoverGrid({
  files,
  onPreview,
}: {
  files: TelegramFile[];
  onPreview: (file: TelegramFile) => void;
}) {
  useLocale();
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
      {files.map((file) => (
        <button
          key={file.uniqueId}
          onClick={() => onPreview(file)}
          className="group min-w-0 text-left"
          title={file.fileName}
        >
          <div className="tgflow-cover mb-3 aspect-video overflow-hidden rounded-lg bg-muted transition-shadow group-hover:shadow-md">
            <FilePreview
              file={file}
              isGalleryLayout
              className="h-full w-full object-cover"
            />
          </div>
          <p className="truncate text-base font-medium group-hover:text-primary">
            {file.fileName || t("Unnamed attachment")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {prettyBytes(file.size || 0)}
          </p>
        </button>
      ))}
    </div>
  );
}

export function FileLibrary({
  accountId = "-1",
  chatId = "-1",
  messageThreadId,
  link,
  tasks = false,
}: {
  accountId?: string;
  chatId?: string;
  messageThreadId?: number;
  link?: string;
  tasks?: boolean;
}) {
  useLocale();
  const model = useFiles(accountId, chatId, messageThreadId, link);
  const [preview, setPreview] = useState<TelegramFile>();
  const [open, setOpen] = useState(false);
  const showPreview = (file: TelegramFile) => {
    setPreview(file);
    setOpen(true);
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {t("Found {count} files", { count: model.loadedCount })}
          {model.totalCount !== undefined ? ` / ${model.totalCount}` : ""}
        </span>
        <FileFilters
          telegramId={accountId}
          chatId={chatId}
          filters={model.filters}
          onFiltersChange={model.handleFilterChange}
          clearFilters={model.clearFilters}
        />
      </div>
      {!model.isLoading && model.files.length === 0 && (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <FileSearch className="size-8" />
          <p>{t("No files match the current filters")}</p>
          {model.hasMore && (
            <p className="text-sm">
              {t("More Telegram messages can still be scanned.")}
            </p>
          )}
        </div>
      )}
      {model.files.length > 0 &&
        (tasks ? (
          <TaskList
            files={model.files}
            onChange={() => void model.refresh()}
            onPreview={showPreview}
          />
        ) : (
          <FileCoverGrid files={model.files} onPreview={showPreview} />
        ))}
      {model.error && (
        <p role="alert" className="text-sm text-destructive">
          {translateError(model.error.message)}
        </p>
      )}
      {(model.hasMore || model.isLoading) && (
        <Button
          variant="outline"
          className="self-center"
          disabled={model.isLoading}
          onClick={() => void model.handleLoadMore()}
        >
          {model.isLoading ? (
            <>
              <LoaderCircle className="animate-spin" />
              {t("Loading...")}
            </>
          ) : (
            t("Load more")
          )}
        </Button>
      )}
      {preview && (
        <FileViewer
          open={open}
          onOpenChange={setOpen}
          file={preview}
          onFileChange={setPreview}
          {...model}
        />
      )}
    </div>
  );
}
