import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { dateInZone, safeUrl } from "./api";
import { Markdown } from "./components/Markdown";
import { Dialog } from "./components/Dialog";
import { t } from "./i18n";
import { accentInk, contrast, textOnAccent } from "./appearance";
afterEach(cleanup);
describe("bezpieczeństwo i semantyka", () => {
  it.each(["#a5c8ae", "#000000", "#ffffff"])(
    "zapewnia kontrast akcentu %s",
    (accent) => {
      expect(
        contrast(accentInk(accent, true), "#ffffff"),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(accentInk(accent, false), "#151918"),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, textOnAccent(accent))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );
  it.each([
    "javascript:alert(1)",
    "data:text/html,evil",
    "file:///test",
    "ssh://host",
    "not-url",
  ])("odrzuca %s", (url) => expect(safeUrl(url)).toBe(false));
  it.each(["https://example.com", "http://localhost:8080"])(
    "akceptuje %s",
    (url) => expect(safeUrl(url)).toBe(true),
  );
  it.each([
    ["2026-03-28T22:59:59Z", "2026-03-28"],
    ["2026-03-28T23:00:00Z", "2026-03-29"],
    ["2026-03-29T01:00:00Z", "2026-03-29"],
    ["2026-10-24T22:00:00Z", "2026-10-25"],
    ["2026-10-25T01:00:00Z", "2026-10-25"],
    ["2026-10-25T23:00:00Z", "2026-10-26"],
  ])("strefa Warszawy %s", (instant, day) =>
    expect(dateInZone("Europe/Warsaw", new Date(instant))).toBe(day),
  );
  it("Markdown nie tworzy HTML ani linków javascript", () => {
    const { container } = render(
      <Markdown
        text={
          "<img src=x onerror=alert(1)>\n[evil](javascript:evil)\n**ważne** [dobry](https://example.com)"
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("strong")?.textContent).toBe("ważne");
    expect(container.textContent).toContain("<img");
  });
  it("stosuje polskie liczby mnogie", () => {
    expect(t("count", { count: 1 })).toBe("1 zadanie");
    expect(t("count", { count: 2 })).toBe("2 zadania");
    expect(t("count", { count: 5 })).toBe("5 zadań");
  });
  it("dialog ma nazwę i poprawną semantykę", () => {
    render(
      <Dialog title="Edycja" onClose={() => {}}>
        <input aria-label="Nazwa" data-dialog-input />
      </Dialog>,
    );
    expect(
      screen.getByRole("dialog").getAttribute("aria-labelledby"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeTruthy();
  });
});
