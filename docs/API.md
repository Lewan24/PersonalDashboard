# API v1

Aktualizacja 2026-11-23: sekcje mają `widthPercent` (25/33/50/66/75/100, domyślnie 100), obsługiwany w POST/PATCH, bootstrapie i JSON export/import. Nowy domyślny accent: #cc0000. API zadań pozostaje bez zmian; strona `/tasks` przekierowuje do modułu na dashboardzie.

Adres bazowy `/api/v1`. OpenAPI zawsze: `/openapi/v1.json`; zapis z tej sesji: `docs/openapi.json`. Interaktywny Swagger UI nie został dostarczony. DTO klienta znajdują się w `src/personal-hub-web/src/types.ts`; generator `scripts/openapi-contract.mjs` wytwarza i sprawdza listę operacji `generated/routes.ts`. To nie zastępuje pełnej generacji DTO przez openapi-typescript (ograniczenie MVP).

## Żądania

Każda mutacja: `X-PersonalHub-Client: 1`, `Content-Type: application/json` (także DELETE, wysyłaj `{}`). Upload ikony: multipart pole `file`, bez ręcznego ustawiania boundary. Origin/Referer muszą odpowiadać aplikacji. Brak CORS. Host musi znajdować się w AllowedHosts.

JSON camelCase; daty YYYY-MM-DD, czasy UTC ISO 8601, priorytety none/low/medium/high/urgent. Encje mają id/version/createdAt/updatedAt. W PATCH/move zadania oraz akcjach zadania wymagane expectedVersion. Dla pozostałych PATCH jest opcjonalne; UI je wysyła. Konflikt: 409 ProblemDetails z `current`. PATCH jest częściowy, kolekcje zastępują poprzednie. Checklisty zachowują podane istniejące ID; nowe pozycje nie podają ID. API odrzuca ID checklisty innego zadania.

## Dashboard

`GET /bootstrap`: tabs, sections, items (z tags), tags, columns, settings, taskSummary, today, todayTasks. Bez N+1 po pojedynczych rekordach.

`GET/POST /tabs`, `PATCH/DELETE /tabs/{id}`, `POST /tabs/reorder {orderedIds}`.

`GET /sections?tabId=`, `POST /sections`, `PATCH/DELETE /sections/{id}`, `POST /sections/move {sectionId,targetTabId,targetIndex,expectedVersion?}`.

`GET /items?sectionId=`, `POST /items`, `PATCH/DELETE /items/{id}`, `POST /items/{id}/duplicate`, `POST /items/move {itemId,targetSectionId,targetIndex,expectedVersion?}`.

Usuwanie zakładki/sekcji z zawartością wymaga `cascade=true`, inaczej 409. Reorder wymaga kompletu ID bez duplikatów. Ruchy sekcji/kart zwracają rekordy obu kontenerów z kolejnością. Indeks jest liczony od zera i przycięty do końca listy.

Typy kart: compact-link/detailed-link/service-card/note/spacer. Dla note/spacer URL zostaje null. Inne wymagają http/https. tagIds to lista ID wspólnych tagów. favorite jest flagą isFavorite, brak osobnej encji Szybkiego dostępu.

`GET/POST /tags`, `PATCH/DELETE /tags/{id}`. Nazwy unikalne NOCASE.

## Zadania

`GET /tasks?q=&status=&priority=&tag=&due=today|overdue|next7|none&completed=true|false&archived=true|false&limit=&cursor=&sort=order|title|priority|dueDate`.

Domyślnie limit=200, max=500, archiwum=false. Cursor to przesunięcie liczbowe zwracane w nextCursor; jest to paginacja offsetowa, zmiany danych między stronami mogą zmienić granice stron. Wynik: `{today,tasks,total,nextCursor}`. W Today kolejność zawsze: priorytet malejąco, godzina rosnąco (puste na końcu), tytuł.

`GET/POST /tasks`, `GET/PATCH/DELETE /tasks/{id}`. DELETE wymaga query expectedVersion. Pola: title, descriptionMarkdown, columnId, priority, dueDate, dueTime, startDate, relatedDashboardItemId, tagIds, checklist, links. completedAt i isArchived są zarządzane akcjami, nie dowolnym PATCH.

`POST /tasks/{id}/move {targetColumnId,targetIndex,expectedVersion}`. targetColumnId może być GUID statusu albo literalem `today`. Today ustawia datę, nie status; zadanie ukończone/zarchiwizowane jest odrzucane. Ruch statusowy nie zmienia dueDate. Odpowiedź zawiera task oraz kolejność docelowej kolumny; frontend uzgadnia także źródło przez refetch.

`POST /tasks/{id}/complete|reopen|archive|unarchive|duplicate {expectedVersion}`. Complete idzie do pierwszej aktywnej isDone, reopen wraca do LastActiveColumnId lub pierwszej aktywnej nie-isDone. Duplicate kopiuje treść/tagi/terminy/linki i nieodhaczoną checklistę.

`GET /tasks/today`, `/tasks/overdue` zwracają `{today,tasks}`. `/tasks/summary` zwraca today i todayCount/overdueCount/next7Count. Today, Overdue i Next7 wykluczają archiwum i ukończone. Next7 to today..today+6. Nie ma publicznego parametru date.

`GET/POST /task-columns`, `PATCH /task-columns/{id}`, `POST /task-columns/reorder {orderedIds}`. `DELETE /task-columns/{id}?moveTasksTo=GUID` lub `?archiveTasks=true`. Archiwizacja z zadaniami zachowuje zarchiwizowaną kolumnę; usunięcie z przeniesieniem usuwa kolumnę. Ostatniej aktywnej isDone nie można usunąć/wyłączyć. WIP jest miękki.

## Ikony, ustawienia, dane

`GET/POST /icons`, `GET/DELETE /icons/{id}`. GET listy: metadane, GET konkretnej: binarny MIME i nosniff. Własny klucz: `icon:GUID`.

`GET/PUT /settings`: obiekt ustawień, PUT przyjmuje podzbiór znanych kluczy; walidacja timezone, kolorów i zakresów. `GET /system/status`, `POST /system/test-write`, `POST /system/seed` (addytywny).

`GET /export/json?includeIcons=true`, `POST /import/preview` (cały dokument eksportu), `POST /import/commit {previewToken,confirmed:true}`. Preview błędnego pliku daje ProblemDetails bez tokenu. Sukces: token, counts, errors=[]; ważność 10 minut. Commit tylko replace, backup i jedna transakcja.

`GET /backup/sqlite`, `POST /backup/create`, `GET /backup/list`, `GET /backup/download/{fileName}`. Backup API SQLite, retencja standardowych kopii=10, snapshoty pre-* bez rotacji.

Poza prefiksem: `/health/live` i `/health/ready`. Nieznane API/health/openapi zwracają JSON 404; SPA fallback serwuje aplikację dla pozostałych ścieżek, a router wyświetla swoją stronę 404.

## Limity i błędy

Limity domenowe odpowiadają §7 specyfikacji: nazwy 80, karta 120, URL 2048, zadanie 200, opis zadania 20000, checklista 100, linki 20, tagi 20. JSON 1 MB, import 25 MB, ikona 256 KB, razem 50 MB. Błędy: 400 (JSON/typ), 403 (CSRF/source), 404, 409, 413, 415, 422; 429 dla przepełnionego magazynu podglądów. ProblemDetails zawiera title/status/errors oraz opcjonalnie current.
