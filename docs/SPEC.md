# Personal Hub — specyfikacja aplikacji (dashboard + Kanban)

> Status: specyfikacja implementacyjna, **source of truth dla agenta programistycznego**.
> Wersja specyfikacji: 2.0
> Język interfejsu: polski (architektura i18n od pierwszego dnia).
> Główna zasada: **cała codzienna konfiguracja w UI, bez edytowania YAML**.

## 0. Jak używać tego pliku

- Plik jest dostarczany jako `README.md`. **W kroku A agent przenosi go do `docs/SPEC.md`** (`git mv`, jeśli jest repo) i tworzy nowy, użytkowy `README.md` produktu. Specyfikacji nie wolno nadpisać ani usunąć.
- Kolejność pracy i format raportu opisuje `AGENT_PROMPT.md`. Wymagania produktu opisuje ten plik.
- **Reguła pierwszeństwa:** w razie sprzeczności ta specyfikacja wygrywa nad intuicją agenta, a `AGENT_PROMPT.md` wygrywa w sprawach procesu pracy i raportu. Każdą wykrytą sprzeczność lub samodzielną decyzję agent zapisuje w `docs/DECISIONS.md` (jedna linia: problem → decyzja → powód).
- Słowa „musi / nie wolno” są wiążące. „Powinno / zalecane” oznaczają domyślny wybór, od którego wolno odejść z zapisem w `DECISIONS.md`.
- Decyzje oznaczone **[DECYZJA]** są już podjęte, agent ich nie otwiera ponownie.

## 1. Cel

Szybka, responsywna, self-hosted aplikacja do codziennego użytku. Łączy:
- stronę startową typu Homepage (zakładki, sekcje, linki, karty usług),
- wizualny edytor typu Homarr (edycja w UI, DnD),
- moduł zadań Kanban inspirowany Trello, z inteligentnym widokiem „Dzisiaj”.

### Priorytety
1. Wygodny dashboard działający jako strona startowa przeglądarki.
2. Wszystkie zmiany z UI, trwały zapis w SQLite.
3. Sensowny drag & drop z dostępnością klawiaturową i obsługą dotyku.
4. Pełny moduł Kanban z widokiem „Dzisiaj”.
5. Jeden kontener runtime; bez Redis/PostgreSQL/MySQL i bez Node w produkcji.
6. Szybkość, bezpieczeństwo, prostota utrzymania, kompletny backup/restore.

### Referencja wizualna
- Screenshot istniejącego dashboardu: `docs/reference/dashboard.png` (dostarcza użytkownik). **Jeśli pliku nie ma, agent opiera się wyłącznie na opisie poniżej i zapisuje to w `DECISIONS.md`.**
- Opis: ciemne, stonowane tło; kompaktowy pasek górny z zegarem i wyszukiwarką; nawigacja zakładkowa; grupy linków (sekcje) w kilku kolumnach; opcjonalne większe karty usług.
- To inspiracja, nie szablon 1:1. Poprawiamy odstępy, kontrast i zachowanie mobilne. Bez ciężkich gradientów, losowych emoji i zbędnych ozdobników.

## 2. Decyzja architektoniczna **[DECYZJA]**

React + TypeScript + Vite + Tailwind CSS (frontend), ASP.NET Core 10 Minimal API (backend), EF Core 10 + SQLite. Jeden wieloetapowy obraz Docker.

- Node.js jest używany **wyłącznie w buildzie** frontendu. Produkcyjnie `dotnet` serwuje statyczne SPA i API `/api/v1/*`.
- Brak SSR, SignalR, Redis. Cache serwerowy niepotrzebny na starcie.
- Dane w wolumenie `/app/data`: baza `dashboard.db`, kopie w `/app/data/backups`. **Ikony własne są przechowywane w SQLite jako BLOB** (patrz 7), żeby kopia bazy była kompletna i atomowa. Nie ma katalogu `uploads`.
- Backend: modular monolith (`Features/Dashboard`, `Features/Tasks`, `Features/Settings`, `Features/Backup`, `Infrastructure/Persistence`, `Common`).
- `/health/live` (bez DB) i `/health/ready` (sprawdza DB i zastosowane migracje).
- Build `linux/amd64`, opcjonalnie `linux/arm64`.
- Dlaczego nie Blazor Interactive Server: bardzo interaktywny UI (DnD, złożony Kanban) lepiej obsługuje ekosystem React/dnd-kit, a drugi kontener nie daje korzyści.

## 3. Stack i biblioteki

| Warstwa | Wybór |
|---|---|
| API | ASP.NET Core 10, Minimal API, DI, DTO, walidacja (FluentValidation lub wbudowana), `Microsoft.AspNetCore.OpenApi` |
| Baza | SQLite + EF Core 10 migrations, `Microsoft.Data.Sqlite` |
| Front | React, Vite, TypeScript `strict`, React Router |
| Styling | Tailwind CSS (aktualna stabilna wersja), tokeny theme jako CSS variables |
| UI | shadcn/ui + Radix primitives, lucide-react |
| DnD | **aktualny `@dnd-kit/react`** (sprawdź API wersji przed implementacją; nie jest wymienny z `@dnd-kit/core`) |
| Dane | TanStack Query + cienki własny klient fetch; typy generowane z OpenAPI (`openapi-typescript`), wygenerowany plik jest w repo, skrypt sprawdza jego aktualność **[DECYZJA]** |
| Formularze | React Hook Form + Zod |
| Markdown | `react-markdown` + `rehype-sanitize`, bez surowego HTML |
| i18n | `i18next` + `react-i18next`, słownik `pl` w JSON, poprawne liczby mnogie PL (`_one/_few/_many/_other`) |
| Daty | `Intl.DateTimeFormat` z `timeZone` + date-fns lub Luxon; nigdy lokalna strefa przeglądarki |
| Testy | xUnit + `WebApplicationFactory`; Vitest + Testing Library; Playwright + `@axe-core/playwright` |
| Ikony | Lucide, Simple Icons (ładowane leniwie), własne ikony (BLOB) |
| Menedżer pakietów | npm, `package-lock.json` w repo **[DECYZJA]** |

Zasady wersji: wybieraj stabilne, zgodne wersje na dzień implementacji, przypnij je lockfile'ami, w buildzie użyj aktualnego Node LTS i obrazów `dotnet/sdk:10.0` oraz `dotnet/aspnet:10.0`. Wersje narzędzi zapisz w `docs/ARCHITECTURE.md`.

## 4. Konwencje techniczne **[DECYZJA]**

- ID: `Guid.CreateVersion7()` (porządkowalne w czasie) we wszystkich encjach.
- JSON: `camelCase`, enumy jako stringi, `DateOnly` jako `YYYY-MM-DD`, znaczniki czasu UTC w ISO 8601.
- Czasy audytowe (`CreatedAt`, `UpdatedAt`, `CompletedAt`) w UTC. Lokalne „dzisiaj” liczone w skonfigurowanej strefie IANA. W SQLite zapisuj UTC jako `DateTime` (Kind=Utc) lub konwerter na ticks, bez sortowania po `DateTimeOffset`.
- Wszystkie mutowalne encje mają `Version` (int, +1 przy każdej zmianie). Zadania wymagają `expectedVersion` w PATCH/move; pozostałe encje przyjmują je opcjonalnie. Niezgodność daje `409` z aktualnym stanem encji w body.
- Błędy: `ProblemDetails` (RFC 9457) z polem `errors` dla walidacji; spójne kody: 400, 404, 409, 413, 415, 422 (walidacja domenowa).
- Zegar: cały kod zależny od czasu używa wstrzykiwanego `TimeProvider` (testy z `FakeTimeProvider`).
- Strefa czasowa: **autorytetem jest `AppSetting.timezone`** (domyślnie `Europe/Warsaw`). Zmienna `TZ` w kontenerze służy tylko logom.
- PATCH jest częściowy. Tablice podane w PATCH (`tagIds`, `checklist`, `links`) **zastępują** całą kolekcję; elementy checklisty z `id` są zachowane, bez `id` tworzone.
- Zakładki, sekcje, karty, kolumny: kolejność przez `SortOrder` (int), renumerowany per kontener w transakcji.

## 5. Strony i nawigacja

Trasy SPA: `/` (dashboard), `/tasks`, `/settings`. Nieznana trasa SPA pokazuje stronę 404 w aplikacji.

### 5.1 Dashboard `/`

- **Nagłówek:** data i godzina w skonfigurowanej strefie (odświeżane co sekundę lub minutę wg ustawień), konfigurowalny format, przełącznik Przeglądaj/Edytuj, wyszukiwarka.
- **Command palette** `Ctrl/Cmd+K` (z `preventDefault`) i skrót `/`: szuka linków, zakładek, sekcji (po stronie klienta z bootstrapu) oraz zadań (`GET /api/v1/tasks?q=`). W pełni klawiaturowa. Wyszukiwanie zewnętrzne: opcjonalne, domyślnie wyłączone, szablon URL z `{q}` w ustawieniach, uruchamiane tylko po zatwierdzeniu tekstu.
- **Zakładki:** dowolne nazwy, ikony, kolory, kolejność; tworzenie, edycja, usuwanie, ukrywanie. Dane przykładowe: „Praca”, „Cybersecurity”, „Prywatne”.
- **Szybki dostęp [DECYZJA]:** wirtualna sekcja nad zakładkami będąca **projekcją kart z `IsFavorite = true`** (jak Today dla zadań; brak osobnej encji, jedna karta jest jednym rekordem). Widoczna niezależnie od aktywnej zakładki, wyłączalna w ustawieniach.
- **Sekcje:** tytuł, ikona, opcjonalny opis, kolor akcentu, `IsCollapsed`, layout, liczba kolumn na desktop/tablet/mobile. Karty można przenosić w sekcji, między sekcjami i między zakładkami; sekcje między zakładkami.
- **Typy kart (MVP):**
  - `compact-link`: jednowierszowy link,
  - `detailed-link`: tytuł + opis,
  - `service-card`: większa **statyczna** karta (ikona, tytuł, opis, link); bez metryk na żywo w MVP,
  - `note`: notatka, treść w `Description` (Markdown, bezpiecznie renderowany), `Url` pusty,
  - `spacer`: opcjonalnie.
  - Bez plugin-platformy w MVP.
- **Linki:** etykieta, URL, opis, ikona (Lucide / Simple Icons / własna), kolor, tagi, ulubione, `openInNewTab` (z `rel="noopener noreferrer"`).
- **Responsywność:** siatka mobile/tablet/desktop, brak poziomego przewijania strony.
- **Tryb Przeglądaj / Edytuj:** uchwyty, menu edytora, placeholdery i przyciski dodawania tylko w edycji. W przeglądaniu klik karty otwiera link; w edycji otwiera formularz.
- **Zapis:** po każdej skutecznej akcji, optimistic update z rollbackiem, toast błędu, stały wskaźnik „Zapisywanie… / Zapisano / Błąd zapisu — ponów”. Mutacje na jednym kontenerze są kolejkowane (bez wyścigów rollbacku).
- Aktywna zakładka może być pamiętana w `localStorage` (wyłącznie preferencja klienta).
- **Mini-Kanban na dole [DECYZJA]:** stały panel pod linkami, niezależny od aktywnej zakładki, zwijany do paska podsumowania (nigdy usuwany). Zawiera: liczniki (Dzisiaj / Zaległe / Najbliższe 7 dni), listę zadań na dziś z odhaczaniem (zakończenie/ponowne otwarcie), pole szybkiego dodawania (tytuł, Enter; opcjonalnie termin dziś) oraz link „Otwórz pełną tablicę” → `/tasks`. Pełne kolumny, filtry i edycja wyłącznie w `/tasks`; klik zadania otwiera ten sam modal edycji.

### 5.2 Kanban `/tasks`

- Dowolne kolumny statusowe (np. „Backlog”, „Do zrobienia”, „W trakcie”, „Weryfikacja”, „Zrobione”): nazwa, kolor, kolejność, opcjonalny limit WIP, znacznik `isDone`. Logika ukończenia **nie** zależy od nazwy kolumny.
- **Limit WIP jest miękki [DECYZJA]:** przekroczenie pokazuje ostrzeżenie na nagłówku kolumny, nie blokuje przenoszenia.
- Widoki: „Wszystkie”, „Dzisiaj”, „Zaległe”, „Najbliższe 7 dni” (patrz 6). Filtry: wyszukiwanie, status, tag, priorytet, termin, zakończone; sortowanie; ukrywanie zakończonych; widok archiwum.
- **Zadanie:** tytuł (wymagany), opis Markdown, status, priorytet (`none/low/medium/high/urgent`), tagi (tagi pełnią też rolę kategorii), `dueDate`, opcjonalne `dueTime`, opcjonalne `startDate`, checklista, linki (`TaskLink`), opcjonalne `relatedDashboardItemId` (skrót „Otwórz usługę” na karcie), archiwum.
- **Edycja w modalu/drawerze:** czytelne pola, przycisk Zapisz z wyraźnym stanem lub autozapis z debounce (wybierz jedno i opisz), checklista, duplikowanie, przenoszenie, archiwizacja, potwierdzenie trwałego usunięcia, focus trap, `Esc`.
- Skrót `N` otwiera nowe zadanie (poza polami tekstowymi).
- Zadania cykliczne: etap 2 (patrz 13).

### 5.3 Ustawienia `/settings`

- **Wygląd:** motyw dark/light/system, akcent, compact/comfortable, promień narożników, szerokość, liczba kolumn, zegar (widoczność, format), format daty, rozmiar ikon, język, strefa czasowa (IANA), `showOverdueInToday`, Szybki dostęp wł./wył., zewnętrzna wyszukiwarka.
- **Dane:** eksport JSON, import JSON (podgląd → commit, patrz 11), pobranie świeżej kopii SQLite, kopie na serwerze (utwórz, lista, pobierz), przywrócenie danych przykładowych (**wyłącznie addytywne**, nigdy niszczące).
- **Ikony:** lista własnych ikon, upload, usuwanie, limity.
- **Administracja:** status DB (rozmiar, wersja schematu), wersja aplikacji, test zapisu, ostrzeżenie o braku uwierzytelniania.

## 6. Semantyka zadań (normatywna)

```text
Task.ColumnId        = status workflow (jeden na zadanie)
Task.DueDate         = data kalendarzowa (DateOnly), "dziś" liczone w AppSetting.timezone
Task.CompletedAt     = ukończone / nieukończone
Task.IsArchived      = archiwum

Aktywne zadanie      = IsArchived = false AND kolumna nie jest zarchiwizowana
Dzisiaj              = aktywne AND DueDate == today AND CompletedAt IS NULL
Zaległe              = aktywne AND DueDate <  today AND CompletedAt IS NULL
Najbliższe 7 dni     = aktywne AND today <= DueDate <= today+6 AND CompletedAt IS NULL
```

**Niezmienniki i reguły:**
1. Today/Overdue/Najbliższe 7 dni to **projekcje wyliczane w zapytaniu**. Nie istnieje kolumna ani rekord „Dzisiaj”, zadania nie są duplikowane w bazie. Ta sama karta może być widoczna w dwóch miejscach UI (status i Dzisiaj), ale rekord jest jeden. Karta zachowuje oryginalny status i umożliwia przejście do jego kolumny.
2. `DueTime` jest informacyjny. O „po terminie” decyduje wyłącznie data **[DECYZJA]**.
3. Zadanie w kolumnie `isDone` ⇔ `CompletedAt IS NOT NULL`. Zawsze musi istnieć co najmniej jedna kolumna `isDone` (API odrzuca usunięcie/zarchiwizowanie ostatniej).
4. `POST /tasks/{id}/complete` przenosi zadanie na początek pierwszej (wg `SortOrder`) kolumny `isDone`, ustawia `CompletedAt` i zapamiętuje poprzednią kolumnę w `LastActiveColumnId`.
5. `POST /tasks/{id}/reopen` zeruje `CompletedAt` i przenosi zadanie do `LastActiveColumnId`, a jeśli ta nie istnieje lub jest `isDone`, do pierwszej kolumny nie-`isDone`.
6. Drag do wirtualnego Today ustawia `DueDate = today` i **nie zmienia** `ColumnId`. Przeciąganie z/do Today nie może przypadkowo zmienić statusu; gdy akcja bywa niejasna, pokaż opis lub menu. Drag zadania ukończonego do Today jest niedozwolony.
7. Drag między statusami zmienia `ColumnId` i `SortOrder`, **nie zmienia** `DueDate`. Drag z Today do statusu zmienia tylko status.
8. Drag do kolumny `isDone` ustawia `CompletedAt` (jeśli puste); z `isDone` do aktywnej usuwa `CompletedAt`.
9. Kolejność w wirtualnym Today jest wyliczana (priorytet malejąco, potem `DueTime` rosnąco z pustymi na końcu, potem tytuł), nie jest persystowana, DnD wewnątrz Today jest wyłączony.
10. Zakończone i zarchiwizowane zadania nie trafiają do Today/Overdue. Ponowne otwarcie przywraca je do widoków zależnie od terminu.
11. `showOverdueInToday` (domyślnie false): gdy włączone, Today dodatkowo pokazuje zaległe. Niezależnie nad Today jest licznik zaległych i szybki filtr „Zaległe”. Karty zaległych mają badge ostrzegawczy.
12. Klient **musi** przeliczać „dziś” w skonfigurowanej strefie i ponownie pobierać widoki po przekroczeniu północy w tej strefie (timer oraz zdarzenia `visibilitychange`/`focus`), bo dashboard bywa otwarty całą dobę.
13. Usunięcie kolumny z zadaniami wymaga `moveTasksTo={columnId}` lub potwierdzonego `archiveTasks=true`; zadania nigdy nie są kasowane niejawnie.

## 7. Model danych SQLite

Wszystkie encje: `Id` (Guid v7), `CreatedAt`, `UpdatedAt`, `Version` (poza tabelami łączącymi). Wszystkie FK jawne, indeksy poniżej obowiązkowe.

```text
DashboardTab(Id, Name, IconKey, AccentColor, SortOrder, IsHidden)
DashboardSection(Id, TabId, Name, Description, IconKey, AccentColor, SortOrder,
                 IsCollapsed, LayoutMode, DesktopColumns, TabletColumns, MobileColumns)
DashboardItem(Id, SectionId, ItemType, Title, Url NULL, Description, IconKey,
              AccentColor, OpenInNewTab, IsFavorite, SortOrder, WidgetConfigJson NULL)
IconAsset(Id, FileName, ContentType, Data BLOB, Sha256, SizeBytes)
Tag(Id, Name UNIQUE NOCASE, Color)                 -- jedna wspólna pula tagów dla kart i zadań
DashboardItemTag(DashboardItemId, TagId)           -- PK złożony
TaskColumn(Id, Name, Color, SortOrder, IsDone, WipLimit NULL, IsArchived)
Task(Id, ColumnId, Title, DescriptionMarkdown, Priority, DueDate NULL, DueTime NULL,
     StartDate NULL, CompletedAt NULL, IsArchived, SortOrder, LastActiveColumnId NULL,
     RelatedDashboardItemId NULL)
TaskTag(TaskId, TagId)                             -- PK złożony
TaskChecklistItem(Id, TaskId, Title, IsChecked, SortOrder)
TaskLink(Id, TaskId, Title, Url, SortOrder)
AppSetting(Key, ValueJson, UpdatedAt)
SchemaMetadata(Key, Value)                         -- m.in. SeedCompletedAt, AppVersion
```

`IconKey` ma format `lucide:<nazwa>`, `si:<slug>` lub `icon:<IconAsset.Id>`.

**ON DELETE [DECYZJA]:**

| Relacja | Zachowanie |
|---|---|
| Tab → Section | Usunięcie zakładki z sekcjami wymaga `?cascade=true` (UI pyta o potwierdzenie), inaczej 409 |
| Section → Item | Jak wyżej: `?cascade=true` albo 409 |
| Item → Task.RelatedDashboardItemId | `SET NULL` |
| Item/Task ↔ Tag (tabele łączące) | `CASCADE` po stronie encji, usunięcie tagu usuwa powiązania |
| Task → Checklist/Links/TaskTag | `CASCADE` |
| TaskColumn → Task | `RESTRICT` (patrz reguła 13 w sekcji 6) |
| IconAsset | Usunięcie ikony używanej przez karty zamienia `IconKey` tych kart na wartość domyślną |

**Indeksy:** `(TabId, SortOrder)`, `(SectionId, SortOrder)`, `(ColumnId, SortOrder)`, `(DueDate)` z filtrem na nieukończone, `(IsArchived, CompletedAt)`, `(IsFavorite)`, unikalny `Tag.Name NOCASE`.

**Limity walidacji [DECYZJA]:** nazwa zakładki/sekcji ≤ 80; tytuł karty ≤ 120; opis karty ≤ 500 (notatka ≤ 5000); URL ≤ 2048; tytuł zadania ≤ 200; opis zadania ≤ 20 000; checklista ≤ 100 pozycji po ≤ 200 znaków; linki zadania ≤ 20; tagi na zadanie ≤ 20, nazwa tagu ≤ 40; zakładek ≤ 50; sekcji na zakładkę ≤ 100; kart na sekcję ≤ 200; kolumn ≤ 20; zadań łącznie ≤ 20 000; ikona ≤ 256 KB, łącznie ≤ 50 MB; domyślny limit body JSON 1 MB, import ≤ 25 MB.

**Kolejność i DnD:** żądanie ruchu zawiera `id`, `targetContainerId`, `targetIndex`, opcjonalnie `expectedVersion`. Serwer w jednej transakcji waliduje, aktualizuje pozycje w kontenerze źródłowym i docelowym i zwraca nowy porządek obu kontenerów (klient uzgadnia stan). Nie wysyłaj pełnego stanu bazy przy każdym przeciągnięciu. Po odświeżeniu układ jest identyczny.

**SQLite:** `PRAGMA foreign_keys=ON` (na każdym połączeniu), `busy_timeout=5000`, `journal_mode=WAL` (po sprawdzeniu zgodności z filesystemem; zalecany `synchronous=NORMAL`). Nie umieszczaj DB na sieciowym filesystemie bez weryfikacji lockingu. Krótkie, niezależne operacje DbContext. Jedna replika serwera. Backup wyłącznie przez SQLite backup API lub `VACUUM INTO`, **nigdy kopiowanie na żywo samego `.db`**. Pliki `-wal`/`-shm` uwzględnione w procedurze restore. Mapowanie `DateOnly` → TEXT `yyyy-MM-dd`.

**Migracje:** uruchamiane przy starcie jedynej instancji. Jeśli są oczekujące migracje i baza nie jest pusta, najpierw automatyczny snapshot do `/app/data/backups/pre-migration-<wersja>-<timestamp>.db`. Jeśli schemat bazy jest nowszy niż aplikacja, aplikacja odmawia startu z czytelnym komunikatem.

**Seed [DECYZJA]:** na pustej bazie (brak `SchemaMetadata.SeedCompletedAt`) tworzone są: domyślne ustawienia, kolumny Kanban (Backlog, Do zrobienia, W trakcie, Zrobione z `isDone`), jawnie oznaczone dane przykładowe (3 zakładki, kilka sekcji i kart). Po seedzie ustawiany jest `SeedCompletedAt`; **kolejne starty nigdy nie seedują ponownie**, nawet jeśli użytkownik usunął całą zawartość.

## 8. REST API v1

Minimalny kontrakt; uzupełnij o DTO odczytu i walidację. Brak N+1 w odczytach.

```text
GET    /api/v1/bootstrap                        -> tabs, sections, items, tags, settings, task summary, today
Zakładki:  GET/POST /tabs, PATCH/DELETE /tabs/{id}[?cascade=true], POST /tabs/reorder {orderedIds}
Sekcje:    GET /sections?tabId=, POST /sections, PATCH/DELETE /sections/{id}[?cascade=true],
           POST /sections/move {sectionId, targetTabId, targetIndex}
Karty:     GET /items?sectionId=, POST /items, PATCH/DELETE /items/{id},
           POST /items/move {itemId, targetSectionId, targetIndex}, POST /items/{id}/duplicate
Zadania:   GET /tasks?q=&status=&priority=&tag=&due=today|overdue|next7|none
                     &completed=&archived=&limit=&cursor=
           POST /tasks, GET/PATCH/DELETE /tasks/{id},
           POST /tasks/{id}/move {targetColumnId, targetIndex, expectedVersion}
           POST /tasks/{id}/complete | /reopen | /archive | /unarchive | /duplicate
           GET  /tasks/today, GET /tasks/overdue, GET /tasks/summary
           (odpowiedzi zawierają pole `today` z datą wg strefy serwera; brak parametru date w kontrakcie publicznym)
Kolumny:   GET/POST /task-columns, PATCH /task-columns/{id},
           DELETE /task-columns/{id}?moveTasksTo={id} | ?archiveTasks=true,
           POST /task-columns/reorder {orderedIds}
Tagi:      GET/POST /tags, PATCH/DELETE /tags/{id}
Ikony:     GET /icons (lista), POST /icons (multipart), GET /icons/{id} (binarnie), DELETE /icons/{id}
Ustawienia: GET/PUT /settings
System:    GET /system/status
Dane:      GET /export/json, POST /import/preview, POST /import/commit
Backup:    GET /backup/sqlite (świeży snapshot do pobrania), POST /backup/create (zapis w /app/data/backups,
           retencja: ostatnie 10), GET /backup/list
Zdrowie:   GET /health/live, GET /health/ready   (poza prefiksem /api/v1)
```

- Domyślnie `limit=200` (max 500) dla `GET /tasks`.
- OpenAPI: `/openapi/v1.json` zawsze; interaktywny UI dokumentacji tylko w Development lub gdy `ENABLE_API_DOCS=true`.
- Nieznane ścieżki `/api/*` zwracają JSON 404 (ProblemDetails), nigdy `index.html`.
- CORS niepotrzebny (same-origin) i domyślnie wyłączony; nie jest mechanizmem kontroli dostępu.
- Strukturalne logi, bez tokenów i treści zadań na poziomie Info.

## 9. Interakcje, i18n, dostępność, wydajność

- **Szybkie dodanie linku:** modal z URL + nazwą (Zapisz); host jako domyślna etykieta, ikona fallback, **bez pobierania metadanych z sieci**. Zaawansowane opcje rozwijane.
- **Walidacja URL:** tylko `http:`/`https:`; blokada `javascript:`, `data:` i innych. Dodatkowe schematy (`ssh`, `smb`) to etap 2. Walidacja po stronie klienta **i** serwera.
- **Skróty:** `Ctrl/Cmd+K`, `/`, `N`, `E` (przełącz edycję); tooltip ze skrótami.
- **DnD:** wyraźny drag handle, animowane miejsce docelowe, `activationConstraint` (dystans/opóźnienie), by drag nie blokował kliknięcia linków; `touch-action: none` tylko na uchwycie (nie psuje przewijania); tryb klawiaturowy; komunikaty czytników ekranu po polsku (live region); alternatywa bez przeciągania: menu „Przenieś wyżej / niżej / do sekcji / do zakładki / do kolumny”.
- **UX:** skeletony, empty states (pierwszy link, pierwsza kolumna), toasty, undo dla wybranych akcji, potwierdzenia destrukcyjnych akcji, focus management w modalach, kontrast WCAG AA, `prefers-reduced-motion`.
- **i18n:** wszystkie teksty UI w słowniku (`pl`), brak tekstów na sztywno w komponentach, formatowanie dat/liczb przez `Intl`, liczby mnogie przez i18next. Glosariusz PL: Zakładka, Sekcja, Karta, Link, Zadanie, Kolumna, Status, Dzisiaj, Po terminie, Najbliższe 7 dni, Archiwum, Tryb edycji, Szybki dostęp.
- **Ikony:** lazy-loading (dynamic import / podzbiór); nie wciągaj pełnego Simple Icons do głównego bundla. Favicony z zewnętrznych serwisów: domyślnie wyłączone (wyciek odwiedzanych hostów), tylko za jawną zgodą.
- **Wydajność (cele do zmierzenia):** początkowy JS ≤ 250 KB gzip, code splitting tras `/tasks` i `/settings`; `bootstrap` < 150 ms przy ~500 kartach i ~1000 zadaniach; Lighthouse ≥ 90 (dostępność, desktop), ≥ 80 (wydajność, mobile). Wyniki trafiają do raportu. Jeśli pomiar jest niemożliwy, raport to mówi.
- **Cache statyków:** pliki z hashem `Cache-Control: immutable`, `index.html` `no-cache`; kompresja Brotli/gzip.
- Brak połączeń na żywo dla każdego linku. Monitoring usług jest opcjonalny (etap 3) i wyłącznie serwerowy z allowlistą.

## 10. Bezpieczeństwo (brak logowania w MVP)

**Aplikacja nie ma uwierzytelniania: każdy, kto ma do niej dostęp sieciowy, może czytać, zmieniać i usuwać wszystkie dane oraz pobrać pełny eksport i backup.** Nie wolno twierdzić, że to bezpieczne w internecie. Zalecane: localhost, LAN/VPN, firewall, reverse proxy z uwierzytelnianiem i HTTPS. `EDIT_PIN`/własne logowanie jest **poza MVP** (etap 2).

Wymagane zabezpieczenia domyślne:
- **Ochrona CSRF bez cookies/auth [DECYZJA]:** każde żądanie zapisu (POST/PUT/PATCH/DELETE) wymaga `Content-Type: application/json` (lub `multipart/form-data` dla ikon) **oraz** niestandardowego nagłówka `X-PersonalHub-Client: 1`; serwer odrzuca (403) zapisy z `Origin`/`Referer` innym niż host aplikacji (z uwzględnieniem skonfigurowanych forwarded headers).
- **Walidacja `Host` (`AllowedHosts`):** domyślnie `localhost;127.0.0.1;[::1]`; przy dostępie z LAN użytkownik jawnie ustawia nazwę/IP. Chroni to przed DNS rebinding na aplikacji bindowanej do localhost.
- Nagłówki: CSP (`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` ograniczone.
- Konfigurowalne trusted forwarded headers / known proxies (domyślnie wyłączone).
- Walidacja wszystkich danych wejściowych (limity z sekcji 7), bezpieczny Markdown (sanitize, bez surowego HTML, linki tylko http/https), brak wykonywania kodu/widgetów JS od użytkownika, brak `dangerouslySetInnerHTML` poza sanitizerem.
- **Ikony:** whitelist rzeczywistego typu pliku (PNG, JPEG, WebP, GIF, ICO; sprawdzanie magic bytes, nie tylko MIME/rozszerzenia), limit rozmiaru, **SVG zabronione w MVP**, serwowanie ze stałym `Content-Type` i `nosniff`, brak ścieżek plikowych (BLOB), brak path traversal z definicji.
- **SSRF:** backend nie pobiera dowolnych URL w MVP. Jeśli w przyszłości (health checks/favicony), blokuj loopback, link-local, metadata endpoints i prywatne IP domyślnie, allowlista hostów, kontrola redirectów i DNS rebinding.
- Nie zapisuj sekretów widgetów w JSON eksportowanym do przeglądarki. Nie loguj tokenów. Brak iframe dowolnych aplikacji w MVP.
- Import: limit rozmiaru, walidacja schematu i wszystkich pól przed commitem, ochrona przed zip-bombami (JSON, nie archiwum; limit głębokości).
- Kontener: użytkownik nieuprzywilejowany, `read_only` rootfs z `tmpfs /tmp`, `cap_drop: ALL`, `no-new-privileges`.
- Ostrzeżenie o braku auth widoczne w `/settings → Administracja`.
- No authentication = brak separacji użytkowników i brak prywatności zakładek/zadań.
- Opisz zagrożenia i mitygacje w `docs/SECURITY.md`, a konfigurację LAN/VPN/reverse proxy w `docs/DEPLOYMENT.md` (przykłady Caddy, nginx lub Traefik z uwierzytelnianiem).

## 11. Backup, restore, import/eksport

- **Eksport JSON:** wersjonowany (`schemaVersion`), zawiera zakładki, sekcje, karty, tagi, kolumny, zadania (z checklistami i linkami), ustawienia oraz **własne ikony zakodowane base64** (`includeIcons`, domyślnie true). Kolejność zachowana.
- **Import (MVP: tryb `replace`) [DECYZJA]:** `POST /import/preview` waliduje cały plik, zwraca liczniki i listę błędów oraz jednorazowy `previewToken` (ważny 10 min, w pamięci); `POST /import/commit` z tokenem wymaga potwierdzenia w UI. Przed commitem serwer tworzy automatyczny backup. Rekord błędny blokuje commit (nic nie jest zapisywane częściowo; jedna transakcja). ID są zachowywane. Tryb `merge` to etap 2.
- **Backup SQLite:** `GET /backup/sqlite` zwraca świeży, spójny snapshot (`VACUUM INTO` / backup API) zawierający także ikony (jeden plik). `POST /backup/create` zapisuje snapshot w `/app/data/backups` (retencja 10 ostatnich + snapshoty pre-migration nie są rotowane automatycznie).
- **Restore z pliku SQLite w MVP: procedura offline** w `docs/BACKUP_RESTORE.md` (zatrzymaj kontener → podmień `dashboard.db` → usuń stare `-wal`/`-shm` → uruchom → sprawdź `/health/ready`). Przywracanie z poziomu UI odbywa się przez import JSON (z potwierdzeniem). Restore SQLite z UI to etap 2.
- **Aktualizacja bez utraty danych:** `docker compose pull/up --build -d` na tym samym wolumenie; migracje automatyczne z snapshotem pre-migration; procedura w `docs/BACKUP_RESTORE.md`.

## 12. Wdrożenie Docker / Portainer

Układ repozytorium:

```text
personal-hub/
  README.md                 # nowy, użytkowy README produktu
  AGENT_PROMPT.md
  src/
    PersonalHub.Api/
    personal-hub-web/
  tests/
    PersonalHub.Api.Tests/
    personal-hub-web.tests/   (lub testy obok kodu, Vitest)
    e2e/
  scripts/                    # dev, generowanie typów OpenAPI, sprawdzanie ich aktualności
  Dockerfile
  compose.yaml
  compose.image.yaml          # wariant z gotowym obrazem z registry (Portainer bez kontekstu builda)
  .env.example
  .dockerignore
  .gitignore
  docs/
    SPEC.md                   # ta specyfikacja (przeniesiona z README.md)
    ARCHITECTURE.md  API.md  BACKUP_RESTORE.md  SECURITY.md  DEPLOYMENT.md
    DECISIONS.md  PROGRESS.md  TESTING.md
    reference/dashboard.png   # screenshot od użytkownika
```

`.env.example`:

```text
HOST_PORT=8088
BIND_ADDRESS=127.0.0.1
ALLOWED_HOSTS=localhost;127.0.0.1;[::1]
TZ=Europe/Warsaw
```

Wzorzec `compose.yaml` (agent dostarcza działającą, **zweryfikowaną** wersję):

```yaml
services:
  personal-hub:
    build: .
    image: personal-hub:local
    container_name: personal-hub
    restart: unless-stopped
    ports:
      - "${BIND_ADDRESS:-127.0.0.1}:${HOST_PORT:-8088}:8080"
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: "http://+:8080"
      TZ: "${TZ:-Europe/Warsaw}"
      ConnectionStrings__Default: "Data Source=/app/data/dashboard.db"
      AllowedHosts: "${ALLOWED_HOSTS:-localhost;127.0.0.1;[::1]}"
    volumes:
      - personal_hub_data:/app/data
    read_only: true
    tmpfs:
      - /tmp
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 30s
    healthcheck:
      test: ["CMD", "dotnet", "PersonalHub.Api.dll", "--healthcheck"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

volumes:
  personal_hub_data:
```

**Dockerfile (multi-stage):** etap `node` (aktualny LTS) buduje `dist` (`npm ci`), etap `dotnet/sdk:10.0` publikuje API i kopiuje `dist` do `wwwroot`, runtime `dotnet/aspnet:10.0` zawiera tylko output API. Działa jako użytkownik nieuprzywilejowany (`USER app`), `/app/data` utworzony z właściwym właścicielem, żeby nowy wolumen był zapisywalny. Port wewnętrzny 8080.

**Healthcheck [DECYZJA]:** tryb `--healthcheck` w `PersonalHub.Api.dll` (obsłużony w `Program.cs` przed zbudowaniem hosta) odpytuje `http://127.0.0.1:8080/health/ready` i zwraca kod wyjścia 0/1. Obraz runtime nie ma `curl`/`wget`; nie zakładaj ich obecności.

Dodatkowe wymagania:
- Sprawdź przy starcie, że `TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw")` działa w obrazie (w razie braku `tzdata` dodaj je lub zgłoś błąd startu z czytelnym komunikatem).
- SPA fallback **nie może** przechwytywać `/api/*`, `/health/*` ani `/openapi/*`.
- Jeśli używane są funkcje Data Protection, klucze trzymaj w `/app/data/keys`.
- Dostęp z LAN: użytkownik zmienia `BIND_ADDRESS` oraz `ALLOWED_HOSTS` (jawnie, z ostrzeżeniem) i dodaje firewall/reverse proxy z auth.
- Portainer: stack z repozytorium Git może używać `build: .`; edytor webowy nie ma kontekstu builda, wtedy `compose.image.yaml` z obrazem z registry (`image:` jako placeholder do uzupełnienia). Instrukcje w `docs/DEPLOYMENT.md`.
- Pozostałe ustawienia i wzorzec są wymaganiami kontraktu; jeśli któreś nie działa w praktyce, agent poprawia i opisuje w `DECISIONS.md`.

## 13. Zakres: MVP, etap 2, etap 3

**MVP (konieczne):** dashboard, zakładki, sekcje, karty i linki (w tym `note`), Szybki dostęp (projekcja), tryb edycji, DnD z alternatywą klawiaturową, SQLite, motyw i ustawienia, wyszukiwarka/command palette, pełny Kanban, Today/Overdue/Najbliższe 7 dni, pola zadań/checklisty/tagi/linki, archiwum, duplikowanie zadań, mini-Kanban na dole dashboardu, własne ikony (BLOB), eksport/import (replace), backup SQLite, Docker/compose, i18n PL, testy, dokumentacja.

**Etap 2:** zadania cykliczne (atomowe generowanie następnego wystąpienia przy zakończeniu, zabezpieczenie przed duplikacją, jawna semantyka końca miesiąca), import w trybie merge, restore SQLite z UI, dodatkowe schematy URL, `EDIT_PIN`/uwierzytelnianie, duplikowanie sekcji, szablony sekcji, historia ukończeń, przypinanie zadań, favicon picker, szybkie dodawanie przez Ctrl+K.

**Etap 3:** widgety systemowe (CPU/RAM/dysk) z backendowym źródłem i TTL, monitor HTTP z allowlistą, zewnętrzne wyszukiwarki, import zakładek HTML, integracje (Portainer, Uptime Kuma, Wazuh) przez bezpieczne adaptery serwerowe, PWA, prosty kalendarz. Bez silnika pluginów i realtime sync w MVP.

## 14. Testy i scenariusze odbiorowe

**Wymagane warstwy:** xUnit (jednostkowe + integracyjne API na tymczasowej bazie SQLite, `FakeTimeProvider`), Vitest + Testing Library, Playwright E2E (z `axe`) przeciwko zbudowanemu obrazowi lub produkcyjnemu buildowi. Testy DST: granice Europe/Warsaw, np. 2026-03-29 (przejście na czas letni) i 2026-10-25 (na zimowy), oraz przejście północy.

### Scenariusze (must pass)
1. Pierwsze uruchomienie na pustej bazie: migracje, seed/onboarding; dane użytkownika nie są nadpisywane, a po usunięciu całej zawartości restart nie seeduje ponownie.
2. Dodaję zakładkę, sekcję i link wyłącznie w UI; po odświeżeniu przeglądarki i restarcie kontenera dane i kolejność są zachowane.
3. Przenoszę link między sekcjami i zakładkami oraz zmieniam kolejność sekcji; zapis trwały, rollback przy błędzie API.
4. W trybie przeglądania klik otwiera link; w trybie edycji otwiera formularz.
5. Tworzę kolumny zadań, przenoszę zadania i zmieniam kolejność kolumn; po refresh stan identyczny.
6. Zadanie z terminem dziś i statusem „W trakcie” jest widoczne w statusie i w Today; w DB jest **jedna** encja.
7. Zadanie z datą wczoraj bez `completedAt` ma badge „Po terminie”, zostaje w swoim statusie i jest w filtrze zaległych.
8. Przeniesienie do Today ustawia termin na dziś bez zmiany statusu; przeniesienie między statusami nie zmienia terminu.
9. Zakończenie usuwa zadanie z Today/Overdue; ponowne otwarcie przywraca je (do poprzedniej kolumny).
10. Granice dnia o północy Europe/Warsaw i zmiana czasu: `DueDate` zachowuje datę kalendarzową; otwarty dashboard przelicza Today po północy bez odświeżania strony.
11. Zadanie z opisem i checklistą: edycja, archiwizacja, wyszukiwanie bez utraty danych.
12. Import JSON odrzuca błędne rekordy przed commitem; eksport/import na czystej instalacji odtwarza zawartość, kolejność i własne ikony.
13. Backup SQLite utworzony podczas pracy jest spójny i daje się odtworzyć; żadne dane nie giną przez WAL.
14. Niebezpieczny schemat URL, XSS w Markdown i złośliwy plik ikony są odrzucane lub neutralizowane.
15. Dashboard obsługiwalny na telefonie i z klawiatury; DnD ma alternatywne akcje przenoszenia; brak krytycznych naruszeń `axe`.
16. `docker compose up --build -d` uruchamia dokładnie jedną usługę runtime, bez zewnętrznych baz; kontener ma status `healthy`.
17. Testy backend/frontend/E2E przechodzą; brak błędów TypeScript, migracji i konsoli przeglądarki.
18. Konflikt wersji (`409`) jest obsłużony w UI (komunikat, odświeżenie stanu), bez cichego nadpisania.
19. Usunięcie kolumny z zadaniami wymaga docelowej kolumny lub potwierdzonego archiwum; nie da się usunąć ostatniej kolumny `isDone`.
20. Przekroczenie limitu WIP pokazuje ostrzeżenie, ale nie blokuje.
21. Zapis z obcym `Origin` lub bez nagłówka `X-PersonalHub-Client` jest odrzucany; żądanie z niedozwolonym `Host` jest odrzucane.
22. Kontener działa jako non-root na świeżym wolumenie (zapis do `/app/data` działa), z `read_only` rootfs.
23. Backup przywrócony procedurą offline z `docs/BACKUP_RESTORE.md` zawiera własne ikony i otwiera się poprawnie; uaktualnienie obrazu na istniejącym wolumenie tworzy snapshot pre-migration i zachowuje dane.
24. Nieznany `/api/...` zwraca JSON 404, a nieznana trasa SPA stronę 404 aplikacji; `/health/*` nie trafia do fallbacku SPA.
25. Szybki dostęp pokazuje karty `IsFavorite` niezależnie od aktywnej zakładki; karta jest jednym rekordem.
26. Command palette znajduje link, sekcję i zadanie, działa wyłącznie z klawiatury.
27. Zmiana motywu, strefy czasowej i liczby kolumn w `/settings` jest trwała po restarcie.

## 15. Dokumentacja do dostarczenia

`README.md` (uruchomienie, Docker/Portainer, backup/restore, aktualizacja, ograniczenia), `docs/ARCHITECTURE.md` (encje, komponenty, przepływ DnD, wersje narzędzi), `docs/API.md`, `docs/BACKUP_RESTORE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/TESTING.md` (jak uruchomić testy, co faktycznie zweryfikowano), `docs/DECISIONS.md`, `docs/PROGRESS.md`.

## 16. Instrukcje dla agenta

Najpierw przeczytaj `AGENT_PROMPT.md`, potem ten plik w całości. Zrealizuj działającą aplikację, nie makiety. Stosuj małe moduły, kompozycję i czytelne nazwy. Nie odkładaj krytycznych zachowań na „TODO”. Na koniec przedstaw pliki, polecenia, wykonane testy (z wynikiem), znane ograniczenia i funkcje odłożone.

## 17. Referencje projektowe

- Homepage: https://gethomepage.dev/ i https://github.com/gethomepage/homepage
- Homarr: https://homarr.dev/docs/
- Dashy: https://dashy.to/docs/configuring/
- Glance: https://github.com/glanceapp/glance
- EF Core SQLite limitations: https://learn.microsoft.com/en-us/ef/core/providers/sqlite/limitations
- dnd-kit (React): https://dndkit.com/react/quickstart/

Nie kopiuj znaków towarowych ani UI dosłownie; wykorzystuj wyłącznie wzorce interakcji.
