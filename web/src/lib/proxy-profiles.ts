import type { Proxy } from "@/lib/types";

/** Read older empty/array settings without losing valid profiles or exposing secrets in errors. */
export function parseProxyProfiles(value: unknown): {
  items: Proxy[];
  invalid: boolean;
} {
  if (value == null || value === "") return { items: [], invalid: false };
  let decoded: unknown = value;
  if (typeof value === "string") {
    try {
      decoded = JSON.parse(value);
    } catch {
      return { items: [], invalid: true };
    }
  }
  if (decoded == null) return { items: [], invalid: false };
  const entries = Array.isArray(decoded)
    ? decoded
    : typeof decoded === "object"
      ? (decoded as { items?: unknown }).items
      : undefined;
  if (entries == null && typeof decoded === "object" && !Array.isArray(decoded))
    return { items: [], invalid: false };
  if (!Array.isArray(entries)) return { items: [], invalid: true };
  const items: Proxy[] = [];
  const names = new Set<string>();
  let invalid = false;
  for (const item of entries) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      typeof item.server !== "string" ||
      !item.server.trim() ||
      !["http", "socks5", "mtproto"].includes(item.type) ||
      !Number.isInteger(Number(item.port)) ||
      Number(item.port) < 1 ||
      Number(item.port) > 65535 ||
      names.has(item.name)
    ) {
      invalid = true;
      continue;
    }
    names.add(item.name);
    items.push({
      ...item,
      port: Number(item.port),
      username: typeof item.username === "string" ? item.username : "",
      password: typeof item.password === "string" ? item.password : "",
      secret: typeof item.secret === "string" ? item.secret : "",
    });
  }
  return { items, invalid };
}
