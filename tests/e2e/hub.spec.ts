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
  await page.getByRole("button", { name: "Dodaj sekcję", exact: true }).click();
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
    .check();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").getByRole("searchbox").fill(title);
  await expect(
    page.getByRole("dialog").getByRole("button").filter({ hasText: title }),
  ).toBeVisible();
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
  await page.screenshot({ path: "../../docs/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
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
