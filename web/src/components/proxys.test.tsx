import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Proxys from "@/components/proxys";

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({
    settings: {
      proxys: JSON.stringify({
        items: [
          { name: "LAN", server: "192.0.2.10", port: 1080, type: "socks5" },
          { name: "Backup", server: "192.0.2.11", port: 8080, type: "http" },
        ],
      }),
    },
    updateSettings: vi.fn(),
    isLoading: false,
  }),
}));
vi.mock("swr/mutation", () => ({
  default: () => ({ trigger: vi.fn(), isMutating: false }),
}));
vi.mock("@/components/proxy-ping", () => ({ default: () => null }));

afterEach(cleanup);

it("selects the saved proxy when account data arrives after the first render", () => {
  const view = render(<Proxys telegramId="1" enableSelect />);
  expect(screen.getByRole("checkbox", { name: /LAN$/ })).not.toBeChecked();
  view.rerender(<Proxys telegramId="1" proxyName="LAN" enableSelect />);
  expect(screen.getByRole("checkbox", { name: /LAN$/ })).toBeChecked();
});

it("keeps an explicit selection when saved account data refreshes", () => {
  const view = render(<Proxys telegramId="1" proxyName="LAN" enableSelect />);
  fireEvent.click(screen.getByRole("checkbox", { name: /Backup$/ }));
  view.rerender(<Proxys telegramId="1" proxyName="" enableSelect />);
  expect(screen.getByRole("checkbox", { name: /Backup$/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /LAN$/ })).not.toBeChecked();
});
