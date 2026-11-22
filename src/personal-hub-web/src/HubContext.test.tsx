import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubProvider, useHub } from "./HubContext";
import { api } from "./api";
import type { Bootstrap } from "./types";
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: vi.fn(),
}));
const request = vi.mocked(api);
const fixture: Bootstrap = {
  tabs: [],
  sections: [],
  items: [],
  tags: [],
  columns: [],
  today: "2026-03-28",
  todayTasks: [],
  taskSummary: { todayCount: 0, overdueCount: 0, next7Count: 0 },
  settings: {
    timezone: "Europe/Warsaw",
    theme: "dark",
    accent: "#a5c8ae",
    density: "compact",
    radius: 12,
    width: 1440,
    columns: 3,
    clockVisible: true,
    clockSeconds: false,
    clockFormat: "24",
    dateFormat: "long",
    iconSize: 24,
    language: "pl",
    showOverdueInToday: false,
    quickAccess: true,
    externalSearch: "",
  },
};
function Probe() {
  const { data, mutate, error, status } = useHub();
  return (
    <>
      <span data-testid="day">{data.today}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{error}</span>
      <button
        onClick={() =>
          void mutate({
            path: "/failure",
            body: {},
            optimistic: (d) => ({ ...d, today: "optimistic" }),
          }).catch(() => {})
        }
      >
        Zmień
      </button>
    </>
  );
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <HubProvider>
        <Probe />
      </HubProvider>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("zapis i zmiana dnia", () => {
  it("przywraca stan po błędzie zapisu i pokazuje błąd", async () => {
    let rejectWrite: (error: Error) => void = () => {};
    request.mockImplementation(async (path) =>
      path === "/bootstrap"
        ? structuredClone(fixture)
        : new Promise((_, reject) => {
            rejectWrite = reject;
          }),
    );
    mount();
    await screen.findByTestId("day");
    fireEvent.click(screen.getByText("Zmień"));
    await waitFor(() =>
      expect(screen.getByTestId("day").textContent).toBe("optimistic"),
    );
    act(() => rejectWrite(new Error("Awaria zapisu")));
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("Awaria zapisu"),
    );
    expect(screen.getByTestId("day").textContent).toBe(fixture.today);
    expect(screen.getByTestId("status").textContent).toBe("saveError");
  });
  it("odświeża dane po północy w skonfigurowanej strefie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T22:59:59Z"));
    request.mockResolvedValue(structuredClone(fixture));
    mount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const before = request.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(request.mock.calls.length).toBeGreaterThan(before);
  });
});
