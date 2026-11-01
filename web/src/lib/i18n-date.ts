import {
  formatDistanceToNow as distance,
  type FormatDistanceToNowOptions,
} from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { getLocale } from "@/lib/i18n";

export function formatDistanceToNow(
  date: Date | number | string,
  options?: FormatDistanceToNowOptions,
) {
  return distance(date, {
    ...options,
    locale: getLocale() === "zh-CN" ? zhCN : enUS,
  });
}
