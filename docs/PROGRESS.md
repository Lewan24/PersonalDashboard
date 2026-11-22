# Postęp i odbiór

Aktualizacja 2026-11-23: wdrożono korekty użytkownika — menu kontekstowe, kompaktowy układ, szerokość sekcji w SQLite, zadania pod linkami i czerwony akcent. Aktualne wyniki: **API 25/25, frontend 27/27, build PASS**. Szczegóły i granice weryfikacji: [UI_UPDATE.md](UI_UPDATE.md). Poniższa tabela odnosi się do pierwotnego odbioru MVP; nie jest dowodem uruchomienia przeglądarki ani kontenera po korekcie.

Stan na 2026-11-22. **Odbiór pełnego MVP nie jest zakończony.** Dostarczono aplikację z rzeczywistym API/SQLite/UI; brakujące elementy i niewykonane testy są jawne. Katalog początkowo nie był repozytorium Git, więc nie wykonywano commitów.

## Kamienie milowe

| Etap | Stan | Dowód / pozostałe prace |
|---|---|---|
| M0 audyt i szkielet | częściowo | Spec zachowany, struktura, build API+web, migracja, lokalny health. Docker Engine niedostępny; healthy w kontenerze NIE URUCHOMIONO. |
| M1 dashboard/API | częściowo | Rzeczywiste CRUD, SQLite, reorder/move, walidacja, Host/CSRF, formularze i stan zapisu. Brak dnd-kit i pełnego optimistic UI; E2E NIE URUCHOMIONO. |
| M2 Kanban | zaimplementowany rdzeń, odbiór częściowy | Statusy/Today/Overdue/Next7, complete/reopen, pola/kolekcje, archiwum, mini-panel, menu ruchów. Testy API i timer klienta PASS; realne gesty i przeglądarka NIE URUCHOMIONO. |
| M3 dane i ustawienia | częściowo | Import preview/commit, backup, ikony BLOB, ustawienia, palette i ulubione. Brak pełnego pickera ikon/Simple Icons; interakcje przeglądarkowe NIE URUCHOMIONO. |
| M4 weryfikacja | częściowo | xUnit 23/23, Vitest 21/21, TS/build, Compose config, pomiary pakietu i bootstrapu. Docker/E2E/axe/Lighthouse i wizualny review NIE URUCHOMIONO. |

## Scenariusze 1–27

PASS oznacza sprawdzone zachowanie w opisanym zakresie testu. Dla scenariuszy wymagających pełnego UI/kontenera, których nie wykonano, status pozostaje NIE URUCHOMIONO, nawet gdy część API ma zielone testy. `dotnet test tests/PersonalHub.Api.Tests` uruchamia wymienione testy API, `npm test --prefix src/personal-hub-web` uruchamia testy klienta.

| # | Scenariusz | Status | Dowód lub brakująca weryfikacja |
|---|---|---|---|
| 1 | Pusta baza, migracje, seed tylko raz | PASS | SeedIsPersistentAndNotRepeated; ExistingDatabaseRestartsWithoutReseedAndFreshBackupIsRestorable — migracje na nowym pliku i ponowne otwarcie snapshotu. |
| 2 | Zakładka/sekcja/link w UI, refresh i restart kontenera | NIE URUCHOMIONO | Kod UI/API jest; E2E dashboard przygotowany. Brak procesu przeglądarki i Engine. |
| 3 | Ruch między sekcjami/zakładkami, reorder, rollback | NIE URUCHOMIONO | DashboardMoveAndVersionConflict i HubContext.test rollback PASS; pełnego DnD i reorderu sekcji w UI nie wykonano. |
| 4 | Link w przeglądaniu, edycja w edytorze | NIE URUCHOMIONO | Oddzielne elementy a/button w Dashboard.tsx; brak uruchomienia przeglądarki. |
| 5 | Kolumny, ruchy i trwała kolejność w UI | NIE URUCHOMIONO | Ruchy statusów sprawdzone przez API; pełny cykl UI/reorder kolumn nie wykonany. |
| 6 | Today i status, jeden rekord | PASS | TodayStatusCompleteReopenAndOneRecord sprawdza status, projekcję i COUNT(*)=1 w SQLite. |
| 7 | Wczorajszy termin, badge i filtr zaległych | NIE URUCHOMIONO | Filtr API PASS w MoveTodayOnlyChangesDueDateAndStatusOnlyChangesColumn; badge w TaskCard nie sprawdzony w przeglądarce. |
| 8 | Today zmienia termin, status nie zmienia terminu | PASS | MoveTodayOnlyChangesDueDateAndStatusOnlyChangesColumn. |
| 9 | Complete/reopen, projekcje i poprzednia kolumna | PASS | TodayStatusCompleteReopenAndOneRecord. |
| 10 | Północ Warszawy i DST, odświeżenie klienta | PASS | 6 przypadków WarsawCalendarBoundaries, 6 przypadków Intl w Vitest i test timera HubContext z fałszywym zegarem; brak realnego wielogodzinnego browser soak. |
| 11 | Opis/checklista, archiwum i wyszukiwanie bez utraty | PASS | ArchiveSearchAndChecklistPatchPreserveData; częściowy PATCH zachowuje linki. |
| 12 | Walidacja importu, roundtrip kolejności/ikon | PASS | ImportRoundTripAndInvalidPreview; IconsRoundTripAndMaliciousUploadRejected. |
| 13 | Spójny backup podczas WAL i odtworzenie | PASS | BackupContainsCommittedWalAndSettingsPersist, integrity_check=ok; ExistingDatabaseRestartsWithoutReseedAndFreshBackupIsRestorable. |
| 14 | URL/XSS/złośliwa ikona | PASS | 3 przypadki DangerousUrlsRejected, IconsRoundTripAndMaliciousUploadRejected oraz test neutralizacji HTML/linków Markdown w Vitest. Zakres: opisane wektory, nie pełny pentest. |
| 15 | Telefon, klawiatura, DnD alternatywne, axe | NIE URUCHOMIONO | Menu ruchu i Radix są; test semantyki dialogu PASS. Brak browser/axe; natywne DnD dotykowe nie zaimplementowane. |
| 16 | Jedna usługa Docker healthy | NIE URUCHOMIONO | docker compose config --quiet PASS, up --build nie może połączyć się z Engine. |
| 17 | Wszystkie testy, brak błędów konsoli/migracji/TS | NIE URUCHOMIONO | xUnit 23/23, Vitest 21/21, build/TS PASS; E2E/console browser zablokowane spawn EPERM. |
| 18 | Konflikt 409 obsłużony w UI | NIE URUCHOMIONO | DashboardMoveAndVersionConflict PASS; komunikat/refetch zaimplementowany w HubContext; pełny konflikt w UI niewykonany. |
| 19 | Usuwanie kolumny i ostatnia isDone | PASS | ColumnGuardsAndSoftWip — 409 dla zajętej kolumny i 422 dla ostatniej isDone. |
| 20 | Miękki WIP i ostrzeżenie | NIE URUCHOMIONO | ColumnGuardsAndSoftWip potwierdza brak blokady; render ostrzeżenia nie sprawdzony w przeglądarce. |
| 21 | CSRF/header/Origin/Host | PASS | SecurityAndRouting — brak nagłówka 403, obcy Origin 403, niedozwolony Host 400. |
| 22 | Non-root, nowy wolumen, read_only | NIE URUCHOMIONO | Konfiguracja jest; Engine niedostępny. |
| 23 | Restore ikon offline i upgrade ze snapshotem | NIE URUCHOMIONO | Ikony w snapshotach i ponowne otwarcie DB PASS; procedura kontenera i prawdziwa migracja z poprzedniego wydania niewykonane. |
| 24 | JSON 404 API i SPA 404, health bez fallbacku | NIE URUCHOMIONO | SecurityAndRouting potwierdza JSON 404 API/health/openapi; strona SPA 404 wymaga E2E. |
| 25 | Szybki dostęp niezależny od zakładki, jeden rekord | NIE URUCHOMIONO | SettingsBooleansAndFavoriteProjectionPersist potwierdza flagę i liczbę rekordów; przełączanie zakładek w browser nie wykonane. |
| 26 | Palette: link/sekcja/zadanie, klawiatura | NIE URUCHOMIONO | Wdrożona, test E2E wyszukiwania przygotowany; browser niedostępny. |
| 27 | Trwały motyw/strefa/kolumny po restarcie | NIE URUCHOMIONO | Zapis ustawień do SQLite PASS; restart kontenera i zachowanie UI niewykonane. |

## Wznowienie

1. Uruchom Docker Engine i browser tooling w środowisku ze zgodami na procesy potomne.
2. Uruchom komendy z TESTING.md; najpierw rzeczywisty build obrazu i test świeżego wolumenu, potem E2E/axe i Lighthouse.
3. Uzupełnij zależności brakujące w cache: @dnd-kit/react (+ pakiety wymagane przez jego wersję), react-markdown/rehype-sanitize, Simple Icons i openapi-typescript. Aktualne menu ruchu i walidację URL zachowaj.
4. Dokończ pełny optimistic update, picker ikon i pełne typowanie DTO z OpenAPI. Zweryfikuj dostępność całego UI, focus oraz dark/light i mobile.
5. Uzupełnij brakujące scenariusze i zmieniaj statusy tylko na podstawie wykonanych testów. Obecna specyfikacja pozostaje w SPEC.md, bez zmian zakresu MVP.
