import type { Auto } from "@/lib/types";

export function defaultAutomation(): Auto {
  return {
    preload: { enabled: false },
    download: {
      enabled: false,
      rule: {
        query: "",
        fileTypes: [],
        downloadHistory: false,
        downloadCommentFiles: false,
        filterExpr: "",
      },
    },
    transfer: {
      enabled: false,
      rule: {
        transferHistory: false,
        destination: "",
        transferPolicy: "GROUP_BY_CHAT",
        duplicationPolicy: "SKIP",
        useCaptionName: false,
        extra: {},
      },
    },
  };
}

export function automationValidationError(auto: Auto): string | undefined {
  const rule = auto.download.rule;
  if (
    (rule.minSize !== undefined &&
      (!Number.isFinite(rule.minSize) || rule.minSize < 0)) ||
    (rule.maxSize !== undefined &&
      (!Number.isFinite(rule.maxSize) || rule.maxSize < (rule.minSize ?? 0)))
  )
    return "Maximum size must be greater than or equal to minimum size.";
  if (
    auto.transfer.enabled &&
    (!auto.transfer.rule.destination ||
      !/^[\/\\]?(?:[^<>:"|?*\/\\]+[\/\\]?)*$/.test(
        auto.transfer.rule.destination,
      ))
  )
    return "Please enter a valid destination folder path";
}
