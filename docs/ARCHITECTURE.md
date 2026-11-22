# Architektura

Aktualizacja UI 2026-11-23: widoki produktu to dashboard oraz ustawienia. Pełny moduł zadań jest ładowany pod sekcjami w dashboardzie; `/tasks` zachowano jako redirect. Zamiast trybu edycji są współdzielone menu Radix Context Menu / Dropdown Menu. Sekcje mają WidthPercent w SQLite i układ w siatce 12 kolumn. Bieżący opis: [UI_UPDATE.md](UI_UPDATE.md); poniższy audyt środowiska zachowuje historię pierwszego wdrożenia.

## Środowisko zweryfikowane 2026-11-22

| Narzędzie | Wersja / stan |
|---|---|
| Windows | 10.0.26200, x64 |
| .NET SDK | 10.0.302 |
| .NET runtime | 10.0.10 |
| EF Core / SQLite / OpenAPI | 10.0.0 (dostępne w lokalnym cache, przypięte) |
| dotnet-ef | 9.0.3; wygenerował migrację dla EF 10 z ostrzeżeniem wersji |
| Node | 24.12.0 |
| npm | 11.21.1 |
| Docker CLI | 28.5.1 |
| Compose | 2.40.2 |
| Docker Engine | niedostępny: brak pipe dockerDesktopLinuxEngine |
| Playwright | 1.64.1 |
| Przeglądarki lokalne | katalogi chromium 1223/1248/1254, firefox 1522, webkit 2287; uruchomienie zablokowane `spawn EPERM` |

Dokładne zależności npm: `package-lock.json`; NuGet: `packages.lock.json`. Dostęp do rejestrów był ograniczony. Pakiety npm zainstalowano z istniejącego cache przez lokalny adapter odczytu; lockfile zawiera publiczne URL registry.npmjs.org i nie wymaga adaptera.

## Podział

`src/PersonalHub.Api` jest modularnym monolitem Minimal API. `Features/Dashboard` odpowiada za zakładki, sekcje, karty, tagi i ikony. `Features/Tasks` zawiera reguły statusów, zakończenia, terminów i API. `Features/Settings` obsługuje ustawienia i operacje systemowe. `Features/Backup` odpowiada za snapshoty SQLite oraz transfer danych. `Common` zawiera walidację, błędy domenowe, ochronę żądań i blokadę zapisów. `Infrastructure/Persistence` zawiera DbContext, migracje, pragmy SQLite i seed.

`src/personal-hub-web` ma trzy strony. `HubContext` udostępnia bootstrap, kolejkę mutacji, stan zapisu, rollback obsługiwanych optimistic updates i zmianę dnia. Wspólne komponenty: dialog, edytory, karty zadań, menu ruchu, Markdown, ikony i mini-Kanban. Trasy Tasks i Settings oraz wybrane ikony są ładowane leniwie. Formularze używają React Hook Form, etykiety pochodzą z `pl.json` przez i18next.

## Encje i zapis

Zakładka → sekcje → karty. Wspólne tagi mają relacje wiele-do-wielu z kartami i zadaniami. Kolumna → zadania → checklista/linki. Ikony są BLOB w tej samej bazie. `Settings` przechowuje wartości JSON, `Metadata` m.in. trwały znacznik seedowania. FK i indeksy są zapisane w migracji `InitialSchema`. EF wymusza optimistic concurrency przez `Version`; czasy UTC mają konwerter odczytu UTC. ID są Guid v7.

SQLite: WAL, foreign_keys=ON, busy_timeout=5000, synchronous=NORMAL. Każde połączenie otrzymuje pragmy przez interceptor. Jedna replika runtime. Middleware serializuje mutacje, aby walidacja limitów i operacje importu nie ścigały się z reorderami. Zmiany kolejności obu kontenerów zapisują się atomowo przez transakcję `SaveChanges`. Import ma jawną transakcję. Nie wdrażać wielu replik nad tym samym plikiem.

## Przepływ przenoszenia

Uchwyt przekazuje rodzaj, ID, kontener i wersję. Drop albo menu `Przenieś…` wysyła mały request do `/move`/`reorder`. Serwer sprawdza FK/limity/wersję, renumeruje źródło i cel, zapisuje transakcyjnie. Klient odświeża cache po sukcesie; w obsługiwanych aktualizacjach optymistycznych przywraca poprzedni stan po błędzie. Kolejka klienta jest globalna (silniejsza od kolejki na kontener).

Obecna implementacja używa HTML Drag & Drop dla myszy oraz menu obsługiwanego dotykiem i klawiaturą. Nie jest implementacją wymaganego dnd-kit ani pełną obsługą gestu przeciągania na telefonie.

## Czas

Serwer używa wstrzykniętego `TimeProvider`. Daty zadań to `DateOnly`. Autorytet: ustawienie `timezone`, nie strefa systemu ani przeglądarki. Klient sprawdza datę przez Intl co sekundę i na focus/visibilitychange, a po zmianie dnia unieważnia zapytania. Testy obejmują północ i obie zmiany DST w Warszawie w 2026 r. Timera działającego w prawdziwej przeglądarce nie zweryfikowano.

## Dystrybucja

Docker: Node buduje statyki, SDK publikuje API, obraz aspnet zawiera tylko API i statyki. `/app/data` należy do `app`. Rootfs jest read-only, `/tmp` to tmpfs. Healthcheck to własny tryb DLL. Konfiguracja Compose jest poprawna składniowo; zachowanie kontenera nie zostało wykonane bez działającego Engine.
