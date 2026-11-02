import { describe, expect, it } from "vitest";
import { readFileFilters, writeFileFilters } from "@/lib/file-filter-url";

describe("file filter addresses", () => {
  it("preserves the account, chat and view when updating filters and survives a new parse", () => {
    const address = new URLSearchParams(
      "id=1&chatId=-100&view=grid&extensions=MKV&sizeRange=1.5,2&sizeUnit=GB",
    );
    const filter = readFileFilters(address, "/chats", false);
    const saved = writeFileFilters(address, {
      ...filter,
      search: "original name",
    });
    expect(saved.get("id")).toBe("1");
    expect(saved.get("chatId")).toBe("-100");
    expect(saved.get("view")).toBe("grid");
    expect(readFileFilters(saved, "/chats", false)).toEqual({
      ...filter,
      search: "original name",
    });
  });
  it("keeps the completed library scoped and ignores malformed size ranges and enums", () => {
    const filter = readFileFilters(
      new URLSearchParams(
        "downloadStatus=error&type=invalid&sizeRange=Infinity,-1",
      ),
      "/files",
      true,
    );
    expect(filter.downloadStatus).toBe("completed");
    expect(filter.type).toBe("all");
    expect(filter.offline).toBe(true);
    expect(filter.sizeRange).toBeUndefined();
    expect(filter.sort).toBe("completion_date");
  });
});
