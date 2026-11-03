import { describe, expect, it } from "vitest";
import { parseProxyProfiles } from "./proxy-profiles";

const profile = {
  name: "LAN",
  server: "192.0.2.10",
  port: 1080,
  type: "socks5",
  username: "fixture",
  password: "disposable",
  secret: "",
};
describe("saved proxy compatibility", () => {
  it("accepts absent settings and old empty values without crashing", () => {
    for (const value of [
      undefined,
      null,
      "",
      "null",
      "{}",
      "[]",
      '{"items":null}',
      '{"items":[]}',
    ])
      expect(parseProxyProfiles(value)).toEqual({ items: [], invalid: false });
  });
  it("preserves credentials in wrapped, decoded and legacy array profiles", () => {
    for (const value of [
      JSON.stringify({ items: [profile] }),
      { items: [profile] },
      [profile],
    ])
      expect(parseProxyProfiles(value)).toEqual({
        items: [profile],
        invalid: false,
      });
  });
  it("keeps usable profiles but flags corrupt data so it cannot be silently overwritten", () => {
    expect(parseProxyProfiles("{broken-disposable-secret")).toEqual({
      items: [],
      invalid: true,
    });
    expect(
      parseProxyProfiles({ items: [profile, { name: "broken" }] }),
    ).toEqual({ items: [profile], invalid: true });
    expect(parseProxyProfiles({ items: "invalid" }).invalid).toBe(true);
  });
});
