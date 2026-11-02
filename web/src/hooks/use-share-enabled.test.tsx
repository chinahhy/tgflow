import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsContext } from "@/hooks/use-settings";
import { useShareEnabled } from "@/hooks/use-share-enabled";
import type { Settings } from "@/lib/types";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("optional sharing flag", () => {
  it("stays disabled until settings are known", () => {
    expect(renderHook(useShareEnabled).result.current).toBe(false);
  });
  it.each([false, "false", true, "true"])(
    "parses server value %s explicitly",
    (value) => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <SettingsContext.Provider
          value={{
            isLoading: false,
            settings: { shareEnabled: value } as unknown as Settings,
            setSetting: async () => {},
            updateSettings: async () => {},
          }}
        >
          {children}
        </SettingsContext.Provider>
      );
      expect(renderHook(useShareEnabled, { wrapper }).result.current).toBe(
        value === true || value === "true",
      );
    },
  );
  it("does not treat a cached string false as enabled", () => {
    localStorage.setItem(
      "telegram-files:share-enabled",
      JSON.stringify("false"),
    );
    expect(renderHook(useShareEnabled).result.current).toBe(false);
  });
});
