import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Bootstrap } from "./types";
import { automaticIcon, Icon } from "./components/Icon";
import Dashboard from "./pages/Dashboard";
import App from "./App";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  setTask: vi.fn(),
  data: null as Bootstrap | null,
}));
vi.mock("./HubContext", () => ({
  useHub: () => ({
    data: mocks.data,
    mutate: mocks.mutate,
    setTask: mocks.setTask,
    status: "saved",
    error: "",
    retry: vi.fn(),
    task: null,
  }),
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  api: vi.fn(async (path: string) =>
    path === "/icons"
      ? [{ id: "icon-1", fileName: "logo.png", sizeBytes: 1024 }]
      : { today: "2026-11-23", tasks: [], total: 0, nextCursor: null },
  ),
}));
function fixture(): Bootstrap {
  const base = { version: 1, sortOrder: 0 };
  return {
    tabs: [
      {
        ...base,
        id: "tab-1",
        name: "Praca",
        iconKey: "lucide:folder",
        accentColor: "#cc0000",
        isHidden: false,
      },
      {
        ...base,
        id: "tab-2",
        name: "Prywatne",
        iconKey: "lucide:folder",
        accentColor: "#cc0000",
        isHidden: false,
      },
    ],
    sections: [
      {
        ...base,
        id: "section-1",
        tabId: "tab-1",
        name: "Narzędzia",
        description: "",
        iconKey: "lucide:folder",
        accentColor: "#cc0000",
        isCollapsed: false,
        layoutMode: "grid",
        desktopColumns: 4,
        tabletColumns: 2,
        mobileColumns: 1,
        widthPercent: 100,
      },
    ],
    items: [
      {
        ...base,
        id: "item-1",
        sectionId: "section-1",
        title: "Repozytorium",
        url: "https://example.com",
        description: "",
        itemType: "compact-link",
        iconKey: "lucide:link",
        accentColor: "#cc0000",
        openInNewTab: true,
        isFavorite: false,
        tags: [],
      },
    ],
    columns: [
      {
        ...base,
        id: "column-1",
        name: "W trakcie",
        color: "#cc0000",
        isDone: false,
        isArchived: false,
        wipLimit: null,
      },
    ],
    tags: [],
    today: "2026-11-23",
    todayTasks: [],
    taskSummary: { todayCount: 0, overdueCount: 0, next7Count: 0 },
    settings: {
      timezone: "Europe/Warsaw",
      theme: "dark",
      accent: "#cc0000",
      density: "compact",
      radius: 10,
      width: 1440,
      columns: 3,
      clockVisible: true,
      clockSeconds: false,
      clockFormat: "24",
      dateFormat: "long",
      iconSize: 24,
      language: "pl",
      showOverdueInToday: false,
      quickAccess: false,
      externalSearch: "",
    },
  };
}
function mount(element = <Dashboard />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  mocks.data = fixture();
  mocks.mutate.mockReset().mockResolvedValue({});
  mocks.setTask.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
describe("kompaktowy dashboard", () => {
  it("pobiera favicon spod domeny linku i używa symbolu linku po błędzie", () => {
    const { container, rerender } = render(
      <Icon name={automaticIcon} url="https://example.org/docs?view=2" />,
    );
    const image = container.querySelector("img")!;
    expect(image.getAttribute("src")).toBe("https://example.org/favicon.ico");
    expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    fireEvent.error(image);
    expect(container.querySelector("svg.lucide-link")).toBeTruthy();
    rerender(<Icon name="lucide:book-open" url="https://example.org/docs" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.lucide-book-open")).toBeTruthy();
  });
  it("nie wymaga trybu edycji i zachowuje moduł zadań po zmianie zakładki", async () => {
    mount();
    await screen.findByRole("heading", { name: "Zadania" });
    expect(screen.queryByRole("heading", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edytuj" })).toBeNull();
    const link = screen.getByRole("link", { name: "Repozytorium" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.closest(".dashboard-section")?.getAttribute("style")).toContain(
      "--section-span: 12",
    );
    fireEvent.click(screen.getByRole("button", { name: "Prywatne" }));
    expect(screen.queryByRole("link", { name: "Repozytorium" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Zadania" })).toBeTruthy();
  });
  it("otwiera menu linku prawym przyciskiem i edycję z menu", async () => {
    mount();
    const link = screen.getByRole("link", { name: "Repozytorium" });
    fireEvent.contextMenu(link, { clientX: 20, clientY: 20 });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edytuj" })).toBeTruthy();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edytuj" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      (within(dialog).getByLabelText("URL") as HTMLInputElement).value,
    ).toBe("https://example.com");
    const icon = within(dialog).getByRole("combobox", { name: "Ikona" });
    expect(icon.closest("details")).toBeNull();
    const advanced = dialog.querySelector("details")!;
    expect(advanced.open).toBe(false);
    fireEvent.click(within(dialog).getByText("Opcje zaawansowane"));
    expect(advanced.open).toBe(true);
    const type = within(advanced).getByRole("combobox", {
      name: "Typ karty",
    }) as HTMLSelectElement;
    expect(type.value).toBe("compact-link");
    expect(
      within(advanced).getByRole("combobox", { name: "Sekcja" }),
    ).toBeTruthy();
    fireEvent.change(type, {
      target: { value: "note" },
    });
    expect(within(dialog).getByText(/Tekst w formacie Markdown/)).toBeTruthy();
    expect(within(dialog).queryByLabelText("URL", { exact: true })).toBeNull();
  });
  it("zapisuje szerokość sekcji przez API z kontrolą wersji", () => {
    mount();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Szerokość sekcji · Narzędzia" }),
      { target: { value: "50" } },
    );
    expect(mocks.mutate).toHaveBeenCalledWith({
      path: "/sections/section-1",
      method: "PATCH",
      body: { widthPercent: 50, expectedVersion: 1 },
    });
  });
  it("otwiera dostosowanie wyglądu sekcji z rozwiniętymi opcjami", async () => {
    mount();
    fireEvent.contextMenu(screen.getByRole("heading", { name: "Narzędzia" }), {
      clientX: 20,
      clientY: 20,
    });
    const menu = await screen.findByRole("menu");
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Dostosuj wygląd…" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("details")?.open).toBe(true);
    expect(within(dialog).getByLabelText("Kolor akcentu")).toBeTruthy();
    const icon = within(dialog).getByRole("combobox", { name: "Ikona" });
    await within(icon).findByRole("option", { name: "logo.png" });
    fireEvent.change(icon, { target: { value: "icon:icon-1" } });
    expect(dialog.querySelector(".icon-field img")?.getAttribute("src")).toBe(
      "/api/v1/icons/icon-1",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/sections/section-1",
          body: expect.objectContaining({ iconKey: "icon:icon-1" }),
        }),
      ),
    );
  });
  it("menu obsługuje nawigację klawiaturą", async () => {
    mount();
    fireEvent.contextMenu(screen.getByRole("link", { name: "Repozytorium" }), {
      clientX: 20,
      clientY: 20,
    });
    const menu = await screen.findByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    await waitFor(() =>
      expect(document.activeElement?.getAttribute("role")).toBe("menuitem"),
    );
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    await screen.findByRole("dialog");
  });
  it("zachowuje stary adres tasks jako przekierowanie do modułu pod linkami", async () => {
    function Location() {
      const location = useLocation();
      return (
        <output data-testid="location">
          {location.pathname + location.search + location.hash}
        </output>
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/tasks?due=overdue"]}>
          <App />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { name: "Zadania" });
    expect(screen.getByTestId("location").textContent).toBe(
      "/?due=overdue#tasks",
    );
    expect(screen.queryByRole("link", { name: "Zadania" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edytuj" })).toBeNull();
  });
});
