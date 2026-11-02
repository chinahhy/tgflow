import type { FileFilter } from "@/lib/types";

const FILTER_KEYS = [
  "search",
  "type",
  "downloadStatus",
  "transferStatus",
  "offline",
  "seedOnly",
  "tags",
  "dateType",
  "dateRange",
  "sizeRange",
  "sizeUnit",
  "sort",
  "order",
  "extensions",
] as const;

export function readFileFilters(
  params: URLSearchParams,
  pathname: string,
  global: boolean,
): FileFilter {
  const filter: FileFilter = {
    search: params.get("search") ?? "",
    type: "all",
    offline: global || params.get("offline") === "true",
    seedOnly: params.get("seedOnly") === "true",
    tags: params.get("tags")?.split(",").filter(Boolean) ?? [],
  };
  const accepted: Record<string, readonly string[]> = {
    type: ["all", "media", "video", "photo", "audio", "file"],
    downloadStatus: ["idle", "downloading", "paused", "completed", "error"],
    transferStatus: ["idle", "transferring", "completed", "error"],
    dateType: ["sent", "downloaded"],
    sizeUnit: ["KB", "MB", "GB"],
    sort: ["date", "size", "completion_date", "reaction_count"],
    order: ["asc", "desc"],
  };
  for (const [key, values] of Object.entries(accepted)) {
    const value = params.get(key);
    if (value && values.includes(value))
      Object.assign(filter, { [key]: value });
  }
  if (pathname === "/files") {
    filter.downloadStatus = "completed";
    filter.sort ??= "completion_date";
    filter.order ??= "desc";
  }
  const sizes = params.get("sizeRange")?.split(",").map(Number);
  if (
    sizes?.length === 2 &&
    sizes.every((n) => Number.isFinite(n) && n >= 0) &&
    sizes[0]! <= sizes[1]!
  ) {
    filter.sizeRange = [sizes[0]!, sizes[1]!];
  }
  const dates = params.get("dateRange")?.split(",");
  if (dates?.length === 2 && dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
    filter.dateRange = [dates[0]!, dates[1]!];
  filter.extensions = params.get("extensions") ?? "";
  return filter;
}

export function writeFileFilters(
  current: URLSearchParams,
  filter: FileFilter,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of FILTER_KEYS) {
    next.delete(key);
    const value = filter[key];
    if (
      value !== undefined &&
      value !== false &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0)
    ) {
      next.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
  }
  return next;
}
