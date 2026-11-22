# PROMPT DLA AGENTA PROGRAMISTYCZNEGO

Jesteś doświadczonym full-stack engineerem i projektantem UX. Twoim zadaniem jest **zaimplementować w tym repozytorium kompletną, działającą aplikację self-hosted „Personal Hub”** (dashboard + Kanban). Zależy nam na dopracowanym produkcie, nie na demonstracji komponentów.

## Źródła wymagań i pierwszeństwo

1. `README.md` w tym katalogu to **specyfikacja produktu (source of truth)**. Przeczytaj ją w całości przed rozpoczęciem pracy. Zawiera podjęte decyzje oznaczone **[DECYZJA]**, model danych, kontrakt API, semantykę zadań, bezpieczeństwo, wdrożenie i 27 scenariuszy odbiorowych.
2. Ten plik określa **proces pracy i format raportu**.
3. Referencja wizualna: `docs/reference/dashboard.png` (jeśli istnieje). Jeśli pliku brak, opierasz się na opisie w sekcji 1 specyfikacji i zapisujesz to w `docs/DECISIONS.md`.
4. W razie sprzeczności specyfikacja wygrywa w sprawach produktu, a ten plik w sprawach procesu. Każdą sprzeczność i każdą samodzielną decyzję zapisuj w `docs/DECISIONS.md` jedną linią (problem → decyzja → powód). Nie czekaj na doprecyzowanie kosmetycznych decyzji: użyj rozsądnych wartości domyślnych. Nie proś o zatwierdzenie oczywistych decyzji technicznych.

**Pierwsza czynność:** przenieś `README.md` do `docs/SPEC.md` (`git mv`, jeśli jest repo; inaczej `mv`) i utwórz nowy, użytkowy `README.md` produktu. Specyfikacji nie wolno nadpisać ani utracić.

## Nienegocjowalne wymagania

1. Frontend: React + TypeScript (`strict`) + Vite + Tailwind CSS; dostępne komponenty, spójny design system, ikony Lucide/Simple Icons (ładowane leniwie).
2. Backend: ASP.NET Core **.NET 10 Minimal API**, EF Core 10, SQLite (lokalny plik). Bez Redis, PostgreSQL, MySQL i bez Node w runtime.
3. **Jeden kontener produkcyjny** ASP.NET Core z frontendem statycznym. Dockerfile multi-stage i działający `compose.yaml` odpowiedni do Portainera (oraz `compose.image.yaml`, `.env.example`).
4. Konfiguracja dashboardu i zadań w UI, trwałość w SQLite. Brak YAML jako mechanizmu edycji przez użytkownika.
5. Zakładki, sekcje, karty/linki i kolumny Kanban wspierają DnD i trwałą kolejność, także przenoszenie między kontenerami tam, gdzie ma to sens, z alternatywą klawiaturową.
6. Oddzielny moduł Kanban `/tasks` oraz **zawsze obecny na dole dashboardu** panel mini-Kanban/podsumowania, niezależny od zakładki.
7. Dynamiczny widok Today jako projekcja zadań z datą dzisiejszą, niezależny od kolumn statusowych; Overdue jako filtr z badge'ami. **Nie duplikuj zadań w bazie.**
8. Kompletne formularze zadań: tytuł, opis Markdown, priorytet, termin, tagi, checklista, linki, status, archiwum.
9. Ustawienia UI, eksport/import JSON, bezpieczny backup SQLite (przez backup API/`VACUUM INTO`, nigdy kopia żywego pliku).
10. Brak logowania w MVP, ale **prawidłowo opisane i uwzględnione zagrożenia** (`docs/SECURITY.md`, ochrona CSRF/Host z sekcji 10 specyfikacji). Domyślnie port bindowany do localhost, jasne instrukcje dla LAN/VPN/reverse proxy. Nigdzie nie deklaruj, że brak auth jest bezpieczny w internecie.
11. API `/api/v1`, walidacja, kontrola konfliktów (`Version`), ProblemDetails, OpenAPI. Testy i dokumentacja.

## Środowisko i narzędzia

Na starcie sprawdź i zapisz w `docs/ARCHITECTURE.md` wersje: .NET SDK, Node, npm, Docker/Compose, przeglądarki Playwright. Jeśli czegoś brakuje i nie da się tego zainstalować, nie udawaj: kontynuuj, co się da (np. testy bez Dockera), a scenariusze, których nie dało się sprawdzić, oznacz w raporcie jako **NIE URUCHOMIONO** z powodem. Nie deklaruj niewykonanych testów jako zaliczonych.

## Tok pracy (kamienie milowe)

Pracuj iteracyjnie. **Po każdym kamieniu: build + testy tego etapu, commit (jeśli jest repo) i aktualizacja `docs/PROGRESS.md`** (checklista kamieni i 27 scenariuszy ze statusem PASS / FAIL / NIE URUCHOMIONO). `PROGRESS.md` ma pozwolić innej sesji wznowić pracę bez dodatkowego kontekstu.

- **M0, audyt i szkielet:** przeniesienie specyfikacji, repozytorium z układem z sekcji 12 specyfikacji, `docs/ARCHITECTURE.md` (model encji, podział komponentów, przepływ DnD, wersje narzędzi), działający Dockerfile + compose z pustą aplikacją i zielonym `/health/ready` w kontenerze (healthcheck przez `dotnet PersonalHub.Api.dll --healthcheck`).
- **M1, backend core i dashboard:** encje, DbContext, migracje, seed (z flagą `SeedCompletedAt`), `/bootstrap`, API zakładek/sekcji/kart/tagów/ikon/ustawień, ruchy i reorder w transakcjach, ochrona CSRF/Host i nagłówki bezpieczeństwa, walidacja URL/Markdown, SPA fallback bez przechwytywania `/api`, `/health`, `/openapi`. Frontend: dashboard, edit mode, DnD z uchwytami i klawiaturą, formularze, wskaźnik zapisu, rollback, i18n PL.
- **M2, Kanban:** kolumny, zadania, `/tasks`, modal zadania, DnD, wirtualny Today, Overdue, Najbliższe 7 dni, complete/reopen/archive/duplicate, checklisty, mini-Kanban na dole dashboardu, przeliczanie Today po północy w skonfigurowanej strefie.
- **M3, dane i ustawienia:** `/settings`, export/import (podgląd → commit, replace), backup (pobranie, utworzenie, lista), snapshot pre-migration, command palette, Szybki dostęp.
- **M4, weryfikacja i dokumentacja:** pełne testy (xUnit, Vitest, Playwright + axe), pomiary Lighthouse/budżetów, wszystkie dokumenty z sekcji 15 specyfikacji, finalny raport.

Jeśli budżet kontekstu lub środowisko uniemożliwia całość, **dostarcz najpierw kompletny działający pionowy wycinek zgodny z kamieniami M0–M2** (DB + API + UI + Docker dla dashboardu oraz Kanbana), jasno wypisz ograniczenia i kontynuuj iteracyjnie. Nie zastępuj implementacji opisem. Nie zostawiaj krytycznych zachowań jako „TODO”.

## Krytyczna semantyka zadań

```text
Task.ColumnId      = status workflow
Task.DueDate       = data kalendarzowa (DateOnly), wg skonfigurowanej strefy (AppSetting.timezone)
Task.CompletedAt   = ukończone / nieukończone
Aktywne            = IsArchived = false AND kolumna niezarchiwizowana
Today              = aktywne AND DueDate == today AND CompletedAt IS NULL
Overdue            = aktywne AND DueDate <  today AND CompletedAt IS NULL
Drag into Today    = DueDate = today, ColumnId bez zmian
Drag between cols  = zmiana ColumnId i SortOrder, DueDate bez zmian
Drag into Done     = zmiana ColumnId i CompletedAt (kolumna isDone)
```

Today może być pokazywane jako wirtualna kolumna: to ta sama karta widoczna w dwóch miejscach UI, ale w bazie jest zawsze jeden rekord. Karta zachowuje oryginalny status i umożliwia przejście do niego. Pełne reguły (niezmienniki isDone ⇔ CompletedAt, complete/reopen, kolejność w Today, WIP miękki) są w sekcji 6 specyfikacji. Cały kod zależny od czasu używa wstrzykiwanego `TimeProvider`.

## Wytyczne UX

- Projektuj pod użytkownika, który codziennie otwiera stronę startową. W trybie normalnym czysto i gęsto; edytor widoczny dopiero po kliknięciu „Edytuj”.
- Zachowaj hierarchię wizualną referencji, popraw odstępy, kontrast i zachowanie mobilne. Bez ciężkich gradientów, losowych emoji i ozdobników nadmiarowych.
- Dodanie linku w kilku kliknięciach (URL, nazwa, Zapisz); zaawansowane opcje rozwijane.
- DnD nie blokuje nawigacji linków; używaj uchwytów, `activationConstraint` i alternatywy klawiaturowej (menu „Przenieś…”). Komunikaty czytników ekranu po polsku.
- Zmiany zapisuj przez API z optimistic update i rollbackiem; mutacje na jednym kontenerze kolejkuj. Stały wskaźnik: zapisane / zapisywanie / błąd (ponów).
- Panel mini-Kanban jest zawsze na dole dashboardu; pełna tablica w osobnym widoku.
- Poprawne nazwy po polsku, centralny słownik (`i18next`, JSON `pl`), brak tekstów na sztywno w komponentach, liczby mnogie PL, możliwość dodania kolejnego języka bez zmian w komponentach.
- Obowiązkowo: empty states, loading/error states, dostępność (WCAG AA, `prefers-reduced-motion`), feedback o zapisie.

## Weryfikacja (krok końcowy każdego kamienia i na koniec)

Uruchom: build backendu i frontendu, lint/typecheck, migracje na pustej i istniejącej bazie, testy jednostkowe/integracyjne, E2E, build obrazu Docker i `docker compose up --build -d` z sprawdzeniem statusu `healthy`. Sprawdź co najmniej: przeciąganie między sekcjami i zakładkami, trwałość po refresh i restarcie kontenera, Today/Overdue, granicę dnia w Europe/Warsaw (w tym przejścia DST 2026-03-29 i 2026-10-25), import/export z ikonami, archiwum, upload ikon, odrzucanie niebezpiecznych URL/XSS, CSRF i `Host`, rozdzielenie API od SPA routing, kontener non-root na świeżym wolumenie. Zmierz budżety wydajności z sekcji 9 specyfikacji lub napisz, dlaczego się nie dało.

## Akceptacja końcowa

Projekt jest ukończony dopiero, gdy przejdą scenariusze 1–27 z sekcji 14 specyfikacji. Scenariusze, których nie uruchomiono lub które nie przeszły, są wyraźnie wskazane (nie ukrywaj ich).

## Format końcowego raportu

1. Co zaimplementowano i gdzie są pliki.
2. Jak uruchomić lokalnie oraz w Docker/Portainer (w tym zmiana portu, `BIND_ADDRESS`, `ALLOWED_HOSTS`).
3. Jak backupować, przywracać i aktualizować bez utraty danych.
4. **Tabela 27 scenariuszy**: status PASS / FAIL / NIE URUCHOMIONO, polecenie lub test, który to sprawdził, przyczyna dla niezaliczonych.
5. Faktycznie uruchomione testy i ich wynik (liczby, nie deklaracje), plus wyniki pomiarów wydajności.
6. Decyzje z `docs/DECISIONS.md` istotne dla użytkownika.
7. Znane ograniczenia i propozycje etapu 2.

Rozpocznij implementację teraz.
