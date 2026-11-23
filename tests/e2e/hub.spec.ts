import {
  test,
  expect,
} from "../../src/personal-hub-web/node_modules/@playwright/test/index";

test("kompaktowy dashboard, menu i trwała szerokość sekcji", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Zadania", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edytuj", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Dodaj zakładkę", exact: true })
    .click();
  const name = "E2E " + Date.now();
  await page
    .getByRole("dialog")
    .getByLabel("Nazwa", { exact: true })
    .fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zapisz", exact: true })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .locator(".dashboard-navigation-actions")
    .getByRole("button", { name: "Dodaj sekcję", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nazwa", { exact: true })
    .fill("Sekcja " + name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zapisz", exact: true })
    .click();
  const width = page.getByRole("combobox", {
    name: "Szerokość sekcji · Sekcja " + name,
  });
  await expect(width).toHaveValue("100");
  await width.selectOption("50");
  await expect(width).toHaveValue("50");
  await page.reload();
  await expect(width).toHaveValue("50");
  await expect(
    page.getByRole("heading", { name: "Zadania", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Sekcja " + name, exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Dostosuj wygląd…", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Kolor akcentu"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("zadania pod linkami, Today, zakończenie i wyszukiwanie", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Zadania", exact: true }).waitFor();
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog");
  const title = "E2E zadanie " + Date.now();
  await dialog.getByLabel("Tytuł", { exact: true }).fill(title);
  const bootstrap = await (await page.request.get("/api/v1/bootstrap")).json();
  await dialog.getByLabel("Termin", { exact: true }).fill(bootstrap.today);
  await dialog.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: /^Dzisiaj/ }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Zakończ " + title, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Wszystkie", exact: true }).click();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox", {
    name: "Szukaj linków i zadań…",
  });
  await expect(search).toBeFocused();
  await search.fill(title);
  await expect(
    page.locator(".task-card").filter({ hasText: title }),
  ).toHaveAttribute("data-search-match", "true");
  await page.keyboard.press("Escape");
});

test("dawny adres tasks przenosi do dashboardu", async ({ page }) => {
  await page.goto("/tasks?due=overdue");
  await expect(page).toHaveURL(/\/\?due=overdue#tasks$/);
  await expect(
    page.getByRole("heading", { name: "Zadania", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Zadania", exact: true }),
  ).toHaveCount(0);
});

test("komputer i telefon bez przewijania całej strony w poziomie", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("heading", { name: "Zadania", exact: true }).waitFor();
  const nav = page.getByRole("navigation", { name: "Zakładki" });
  const quick = page.getByRole("heading", { name: "Szybki dostęp" });
  expect((await quick.boundingBox())!.y).toBeLessThan(
    (await nav.boundingBox())!.y,
  );
  const tabs = await nav.boundingBox();
  expect(Math.abs(tabs!.x + tabs!.width / 2 - 720)).toBeLessThan(2);

  const grid = page.locator(".dashboard-section .section-items").first();
  const columns = () =>
    grid.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
  expect(await columns()).toBe(4);
  await page.setViewportSize({ width: 900, height: 844 });
  expect(await columns()).toBe(2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "../../docs/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "../../docs/mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Akcje: Personal Hub", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Dodaj zakładkę", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/nie-ma");
  await expect(
    page.getByRole("heading", { name: "Nie znaleziono strony" }),
  ).toBeVisible();
});

test("szybkie dodawanie zachowuje fokus i pokazuje miejsce upuszczenia zadania", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Szybko dodaj zadanie" });
  const prefix = "Szybkie zadanie " + Date.now();
  await input.fill(prefix + " A");
  await input.press("Enter");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await input.fill(prefix + " B");
  const first = page
    .locator(".task-card:not(.drag-preview)")
    .filter({ hasText: prefix + " A" });
  const second = page
    .locator(".task-card:not(.drag-preview)")
    .filter({ hasText: prefix + " B" });
  await expect(first).toBeVisible();
  await expect(input).toHaveValue(prefix + " B");
  await input.press("Enter");
  await expect(second).toBeVisible();
  await expect(input).toBeFocused();
  await input.press("Escape");
  await expect(input).not.toBeFocused();
  await expect(
    page.getByRole("button", { name: "Najbliższe 7 dni" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bez terminu" })).toHaveCount(
    0,
  );

  const cardTitle = second.getByRole("button", {
    name: prefix + " B",
    exact: true,
  });
  await cardTitle.hover();
  const source = (await cardTitle.boundingBox())!;
  const destination = (await first.boundingBox())!;
  const x = destination.x + destination.width / 2;
  const y = destination.y + 4;
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(x, y);
  await expect(second).toHaveAttribute("data-dragging", "true");
  await expect(page.locator(".drag-preview")).toBeVisible();
  await expect(first.locator("..")).toHaveAttribute(
    "data-drop-position",
    "top",
  );
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(first.locator("..")).not.toHaveAttribute("data-drop-position");
  await expect
    .poll(async () => {
      const cards = await page
        .locator(".task-card .task-title")
        .allTextContents();
      return cards.filter((title) => title.startsWith(prefix));
    })
    .toEqual([prefix + " B", prefix + " A"]);
  await cardTitle.click();
  await expect(
    page.getByRole("dialog", { name: "Edytuj zadanie" }),
  ).toBeVisible();
});

test("edytor zadania zapisuje i ponownie otwiera checklistę, tagi oraz linki", async ({
  page,
}) => {
  const tag = "Etykieta " + Date.now();
  const response = await page.request.post("/api/v1/tags", {
    headers: { "X-PersonalHub-Client": "1" },
    data: { name: tag, color: "#cc0000" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await page
    .locator(".task-module-actions")
    .getByRole("button", { name: "Nowe zadanie", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const title = "Edycja szczegółów " + Date.now();
  await dialog.getByLabel("Tytuł", { exact: true }).fill(title);
  await dialog.getByRole("button", { name: "Dodaj krok" }).click();
  const step = dialog.getByRole("textbox", { name: "Krok 1", exact: true });
  await expect(step).toBeFocused();
  await step.fill("Sprawdź szczegóły");
  await dialog
    .getByRole("checkbox", { name: "Oznacz krok 1 jako wykonany" })
    .check();
  await dialog.getByRole("checkbox", { name: tag, exact: true }).check();
  await dialog.getByRole("button", { name: "Dodaj link do zadania" }).click();
  await dialog.getByLabel("Nazwa linku").fill("Dokumentacja");
  await dialog.getByLabel("Adres URL").fill("https://example.com");
  await dialog.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(step).toHaveValue("Sprawdź szczegóły");
  await expect(
    dialog.getByRole("checkbox", { name: tag, exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "Oznacz krok 1 jako wykonany" }),
  ).toBeChecked();
  await expect(dialog.getByLabel("Adres URL")).toHaveValue(
    "https://example.com",
  );
  await step.fill("Sprawdź ponownie");
  await dialog.getByRole("button", { name: "Dodaj krok" }).click();
  await dialog
    .getByRole("textbox", { name: "Krok 2", exact: true })
    .fill("Drugi krok");
  await dialog
    .getByRole("button", { name: "Usuń link 1", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Dodaj link do zadania" }).click();
  await dialog.getByLabel("Nazwa linku").fill("Nowy link");
  await dialog.getByLabel("Adres URL").fill("https://example.org");
  await dialog.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(step).toHaveValue("Sprawdź ponownie");
  await expect(
    dialog.getByRole("textbox", { name: "Krok 2", exact: true }),
  ).toHaveValue("Drugi krok");
  await expect(dialog.getByLabel("Adres URL")).toHaveValue(
    "https://example.org",
  );
});

test("kolorowe tagi linku, widoczny URL i podświetlenie w innej zakładce", async ({
  page,
}) => {
  const suffix = String(Date.now());
  const tagName = "Żółty " + suffix;
  await page.goto("/settings");
  const newTag = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Tagi", exact: true }),
  });
  await newTag.getByLabel("Nowy tag").fill(tagName);
  await newTag.getByLabel("Kolor tagu", { exact: true }).fill("#f5c518");
  await newTag.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(newTag.getByText(tagName, { exact: true })).toHaveCSS(
    "background-color",
    "rgb(245, 197, 24)",
  );
  const headers = { "X-PersonalHub-Client": "1" };
  const bootstrap = await (await page.request.get("/api/v1/bootstrap")).json();
  const tag = bootstrap.tags.find(
    (entry: { name: string }) => entry.name === tagName,
  );
  const tab = bootstrap.tabs[1];
  const section = bootstrap.sections.find(
    (entry: { tabId: string }) => entry.tabId === tab.id,
  );
  const title = "Materiały " + suffix;
  const url = "https://example.test/materialy";
  const response = await page.request.post("/api/v1/items", {
    headers,
    data: { title, sectionId: section.id, url, tagIds: [tag.id] },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  const search = page.getByRole("searchbox", {
    name: "Szukaj linków i zadań…",
  });
  await search.fill("zolty " + suffix);
  const card = page
    .locator(".dashboard-item")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
  await expect(card).toHaveAttribute("data-search-match", "true");
  await expect(card.getByText(tagName, { exact: true })).toHaveCSS(
    "background-color",
    "rgb(245, 197, 24)",
  );
  await expect(
    page
      .locator(".dashboard-section .dashboard-item[data-search-match=false]")
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: tab.name, exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(card.getByText(url, { exact: true })).toHaveCount(0);

  await card.getByRole("link").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edytuj", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Ikona" })).toBeVisible();
  const advanced = dialog.locator("details");
  await expect(advanced.getByLabel("Typ karty")).toBeHidden();
  await expect(
    advanced.getByRole("combobox", { name: "Sekcja", exact: true }),
  ).toBeHidden();
  await dialog.getByText("Opcje zaawansowane").click();
  await expect(advanced.getByLabel("Typ karty")).toHaveValue("compact-link");
  await expect(
    advanced.getByRole("combobox", { name: "Sekcja", exact: true }),
  ).toBeVisible();

  await expect(
    dialog.getByRole("checkbox", { name: tagName, exact: true }),
  ).toBeChecked();
  await dialog
    .getByRole("checkbox", { name: "Pokaż adres URL na karcie" })
    .check();
  await dialog.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(card.getByText(url, { exact: true })).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await page.getByRole("button", { name: tab.name, exact: true }).click();
  await page.reload();
  await expect(card.getByText(url, { exact: true })).toBeVisible();

  await page.context().route(url, (route) => route.fulfill({ body: "Opened" }));
  const link = card.getByRole("link");
  const other = page.locator(".dashboard-section .dashboard-item").filter({
    has: page.getByRole("link", { name: "OWASP", exact: true }),
  });
  const start = (await link.boundingBox())!;
  const end = (await other.boundingBox())!;
  await page.mouse.move(start.x + 8, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + 4, end.y + end.height / 2);
  await expect(card).toHaveAttribute("data-dragging", "true");
  await expect(other).toHaveAttribute("data-drop-position", "left");
  await page.mouse.up();
  await expect
    .poll(() =>
      page
        .locator(".dashboard-section .dashboard-item a")
        .first()
        .getAttribute("aria-label"),
    )
    .toBe(title);
  expect(page.context().pages()).toHaveLength(1);

  const opened = page.waitForEvent("popup");
  await link.click();
  const popup = await opened;
  await expect(popup).toHaveURL(url);
  await popup.close();
});

test("przytrzymanie dotykiem podnosi kartę zadania", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const bootstrap = await (
      await page.request.get("/api/v1/bootstrap")
    ).json();
    const prefix = "Dotyk " + Date.now();
    for (const letter of ["A", "B"]) {
      const response = await page.request.post("/api/v1/tasks", {
        headers: { "X-PersonalHub-Client": "1" },
        data: {
          title: prefix + " " + letter,
          columnId: bootstrap.columns[0].id,
        },
      });
      expect(response.ok()).toBe(true);
    }
    await page.reload();
    const first = page.getByRole("button", {
      name: prefix + " A",
      exact: true,
    });
    const second = page.getByRole("button", {
      name: prefix + " B",
      exact: true,
    });
    await second.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    const source = (await second.boundingBox())!;
    const target = (await first
      .locator("xpath=ancestor::article")
      .boundingBox())!;
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: source.x + source.width / 2, y: source.y + source.height / 2 },
      ],
    });
    await expect(page.locator(".drag-preview")).toBeVisible();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: target.x + target.width / 2, y: target.y + 4 }],
    });
    await expect(first.locator("xpath=ancestor::article/..")).toHaveAttribute(
      "data-drop-position",
      "top",
    );
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(async () => {
        const cards = await page
          .locator(".task-card .task-title")
          .allTextContents();
        return cards.filter((title) => title.startsWith(prefix));
      })
      .toEqual([prefix + " B", prefix + " A"]);
  } finally {
    await context.close();
  }
});

test("importuje pliki Homepage z podglądem i automatyczną ikoną karty", async ({
  page,
}) => {
  const site = "https://homepage-import.example";
  await page.route(site + "/favicon.ico", (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      ),
    }),
  );
  await page.goto("/settings");
  await page.getByLabel("Wybierz pliki Homepage").setInputFiles([
    {
      name: "settings.yaml",
      mimeType: "text/yaml",
      buffer: Buffer.from(
        "layout:\n  Biblioteka:\n    tab: Homepage E2E\n    style: row\n    columns: 5",
      ),
    },
    {
      name: "bookmarks.yaml",
      mimeType: "text/yaml",
      buffer: Buffer.from(
        "- Biblioteka:\n  - Materiały z Homepage:\n    - href: " +
          site +
          "/read\n      description: Opis importowanej zakładki",
      ),
    },
  ]);
  const preview = page.getByRole("dialog", {
    name: "Podgląd importu Homepage",
  });
  await expect(preview.getByText("Homepage E2E")).toBeVisible();
  await preview.getByRole("button", { name: "Importuj linki" }).click();
  await expect(preview).toBeHidden();
  await expect(page.getByText(/Dodane zakładki.*linki: 1/)).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Homepage E2E", exact: true }).click();
  const link = page.getByRole("link", { name: "Materiały z Homepage" });
  await expect(link).toHaveAttribute("href", site + "/read");
  await expect(link.getByText("Opis importowanej zakładki")).toBeVisible();
  await link.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edytuj", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const icon = dialog.getByRole("combobox", { name: "Ikona" });
  await expect(icon).toHaveValue("auto:favicon");
  await icon.selectOption("lucide:book-open");
  await dialog.getByRole("button", { name: "Zapisz" }).click();
  await expect(link.locator("img")).toHaveCount(0);
  await expect(link.locator("svg.lucide-book-open")).toBeVisible();
});
