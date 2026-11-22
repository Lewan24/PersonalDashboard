# Korekta interfejsu — 2026-11-23

## Zachowanie

- Usunięto widoczny nagłówek Dashboard, nawigacyjną zakładkę Zadania i globalny przycisk Edytuj. Klik linku zawsze otwiera adres.
- Zakładki są wyrównane w poziomie; przy nadmiarze przewija się sam pasek. Kontrolki mieszczą się w jednej linii zakładki.
- Linki, sekcje, zakładki, zadania i kolumny mają menu PPM oraz przycisk `…`. Menu Radix obsługuje strzałki, Enter i Escape. Edycja, wygląd i przenoszenie są dostępne bez trybu edycji. Działają też uchwyty myszy.
- Sekcje domyślnie zajmują 100% szerokości. Select w nagłówku daje 25/33/50/66/75/100%; zapis odbywa się w API z expectedVersion. Na tablecie wąskie sekcje mają co najmniej połowę szerokości, na telefonie całą szerokość. Węższe sekcje automatycznie ograniczają liczbę kolumn linków, by nie ściskać treści.
- Moduł zadań znajduje się pod sekcjami i nie znika przy zmianie zakładki. Zawiera pełne kolumny, filtry, szybkie dodawanie, Today/Overdue/Next7 i archiwum. Filtry zaawansowane rozwija się osobno. Dawny `/tasks?...` przekierowuje do `/?...#tasks`.
- Zmniejszono nagłówek, odstępy, wysokość linków i kart zadań. Akcje kart są zebrane z prawej strony; na komputerze ujawniają się po najechaniu lub fokusie, na telefonie przycisk menu jest widoczny stale.
- Domyślny akcent to #cc0000, tła są neutralne. Własne akcenty zakładek, ikon sekcji/linków i kolumn mają widoczny efekt.

## Pliki

- `src/personal-hub-web/src/App.tsx`, `pages/Dashboard.tsx`, `pages/Tasks.tsx`: nawigacja i kompozycja modułów.
- `features/dashboard/*`: osobne karty sekcji/linków i wspólne akcje.
- `features/tasks/*`, `components/TaskCard.tsx`: kompaktowe zadania i kolumny.
- `components/ActionMenu.tsx`, `MoveDialog.tsx`, `ConfirmDelete.tsx`, `EntityEditor.tsx`: menu, przenoszenie i formularze.
- `dashboard.css`, `appearance.ts`, `pl.json`: układ, kontrast i teksty PL.
- `Features/Dashboard/Models.cs`, `DashboardEndpoints.cs`, `Features/Backup/TransferService.cs`: trwała szerokość i walidacja także podczas importu.
- Migracja `20261122231236_SectionWidth`: pełna szerokość istniejących sekcji i zamiana poprzedniego domyślnego akcentu na czerwony.
- `dashboard.test.tsx`, `DashboardAppearanceTests.cs`, `tests/e2e/hub.spec.ts`: testy nowych zachowań.

## Weryfikacja wykonana

| Polecenie / kontrola | Wynik |
|---|---|
| `npm test --prefix src/personal-hub-web` | PASS: 27/27 w 3 plikach. Nowe testy: menu linku, klawiatura, wygląd sekcji, zapis szerokości, zadania po zmianie zakładki, legacy redirect. |
| `dotnet test tests/PersonalHub.Api.Tests --no-restore` | PASS: 25/25. Nowe testy: migracja pierwszego schematu, 100% dla istniejących sekcji, zachowanie własnego koloru, walidacja szerokości i export/import. |
| `npm run build --prefix src/personal-hub-web` | PASS, obejmuje TypeScript strict i produkcyjny build Vite. |
| `dotnet build src/PersonalHub.Api -c Release --no-restore` | PASS, 0 błędów; 4 ostrzeżenia audytu istniejących zależności NuGet (Microsoft.OpenApi, SQLitePCLRaw.lib.e_sqlite3, System.Security.Cryptography.Pkcs). Nie usunięto ich w tej korekcie UI. |
| Start Release na istniejącej lokalnej bazie | PASS: migracja zastosowana, snapshot pre-migration utworzony, `/health/ready` odpowiada ready. |
| Odczyt bootstrapu po migracji | PASS: accent #cc0000, trzy istniejące sekcje mają widthPercent=100. |
| `node scripts/openapi-contract.mjs --check` | PASS, nadal 58 operacji. |
| `npm run e2e --prefix src/personal-hub-web` | NIE URUCHOMIONO: 4 testy wykryte, start workera blokuje spawn EPERM. |
| Chromium / natywny podgląd | NIE URUCHOMIONO: spawn EPERM / brak native pipe. Bez zatwierdzonych screenshotów i wizualnego odbioru. |

## Dane i ograniczenia

Migracja nie kasuje sekcji ani zadań. API przed migracją istniejącej bazy wykonuje snapshot SQLite. Własne kolory inne niż poprzedni domyślny #a5c8ae pozostają zachowane. Poprzednie JSON bez WidthPercent importują się z domyślnym 100%; nowe eksporty zawierają szerokości.

Nie zmieniano ograniczeń pierwszego wdrożenia dotyczących natywnego DnD, podzbioru Markdown i braku pełnego pickera ikon. Nie można potwierdzić wyglądu w prawdziwej przeglądarce, gestów dotykowych, axe ani Lighthouse w tym środowisku. Obsługa menu jest sprawdzona w jsdom, co nie zastępuje pełnego E2E.
