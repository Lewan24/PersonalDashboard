# Personal Hub

Self-hosted dashboard linków i Kanban z zapisem w SQLite. React + TypeScript, ASP.NET Core 10, jeden kontener runtime.

Aktualizacja interfejsu 2026-11-23: kompaktowy dashboard, menu kontekstowe zamiast trybu edycji, trwała szerokość sekcji i pełny moduł zadań pod linkami. Raport zmian i aktualne testy: [UI_UPDATE.md](docs/UI_UPDATE.md).

**Stan: działający wycinek produktu, odbiór MVP nie jest zakończony.** API i frontend budują się; testy jednostkowe i integracyjne uruchomiono. Projekt obejmuje testy przeglądarkowe E2E. Obraz Docker i plik produkcyjny sprawdzono na lokalnym stacku. Pełne wyniki i wszystkie 27 scenariuszy: [docs/PROGRESS.md](docs/PROGRESS.md). Oryginalna specyfikacja: [docs/SPEC.md](docs/SPEC.md).

## Uruchomienie lokalne

Wymagania: .NET SDK 10 i Node 24 LTS. Node jest potrzebny tylko do budowy lub developmentu.

```bash
# W folderze z frontend
npm ci
npm run dev

# w folderze backend
dotnet run
```

Otwórz http://127.0.0.1:8080. Baza domyślnie: `src/PersonalHub.Api/data/dashboard.db`. Migracje i przykłady powstają przy pierwszym starcie. Usunięcie danych nie powoduje ponownego seedowania.

Podczas developmentu uruchom API jak wyżej oraz `npm run dev --prefix src/personal-hub-web`. Vite używa proxy API; pozostaje ten sam origin w przeglądarce.

## Docker / Portainer

```bash
# docker compose uzywajac lokalnego obrazu
docker compose -f compose.build.yaml up --build -d

# docker compose uzywajac produkcyjnego gotowego kodu
# skopiuj zawartosc compose.production.yaml i uruchom w portainer lub uruchom plik lokalnie
docker compose -f compose.production.yaml up -d
```

Otwórz http://127.0.0.1:8088. `HOST_PORT` zmienia port. `BIND_ADDRESS` domyślnie wynosi `127.0.0.1`. Dla LAN ustaw konkretny adres interfejsu oraz jawny `ALLOWED_HOSTS` (nazwy/IP oddzielone średnikiem, bez portów). Samo zmienienie portu nie zabezpiecza aplikacji.

**Brak logowania:** każda osoba mająca dostęp sieciowy ma pełny dostęp do danych, edycji i backupów. Nie publikuj aplikacji bez dodatkowego uwierzytelniania. Instrukcje LAN/VPN/proxy i Portainera: [DEPLOYMENT](docs/DEPLOYMENT.md), [SECURITY](docs/SECURITY.md). Obraz z registry publikujesz samodzielnie; wariant Portainera bez kontekstu builda to `compose.production.yaml`.

## Codzienna praca

- Klik linku otwiera adres. Prawy przycisk myszy albo przycisk `…` otwiera edycję, dostosowanie wyglądu, przenoszenie i pozostałe akcje. Menu obsługuje klawiaturę; na telefonie użyj `…`.
- Zakładki są w jednym poziomym pasku. Przyciski `+` tworzą zakładkę lub sekcję. Sekcje domyślnie zajmują całą szerokość; wybór procentów w nagłówku zapisuje szerokość (25/33/50/66/75/100%). Na telefonie sekcje pozostają pełnej szerokości.
- Pełny moduł zadań jest zawsze pod linkami, niezależnie od wybranej zakładki: statusy, Dzisiaj, Po terminie, następne 7 dni, archiwum, filtry, opis, checklista i linki. Dawny `/tasks` przekierowuje do tego modułu. Dzisiaj zmienia termin, status pozostaje niezależny.
- Szybki dostęp jest projekcją ulubionych kart. Domyślny akcent: `#cc0000`.
- `/settings`: wygląd, strefa czasowa, tagi, upload ikon, eksport/import i kopie SQLite.
- `Ctrl/Cmd+K` lub `/`: wyszukiwanie. `N`: zadanie. Skróty literowe nie działają w polach formularzy.

Formularze zapisują po przycisku **Zapisz**. Ruchy i szybkie akcje zapisują od razu. Wskaźnik zapisu i błędy są w pasku aplikacji. Po konflikcie zamknij formularz i ponownie otwórz aktualny rekord.

## Import z Homepage

W **Ustawieniach**, w sekcji **Import z Homepage**, wybierz `bookmarks.yaml`, `services.yaml` lub oba pliki. Dołącz `settings.yaml`, aby odtworzyć kolejność, układ i przypisanie grup do zakładek. Podgląd pokazuje liczbę kart przed zapisem. Import dopisuje linki do odpowiednich sekcji i pomija powtórki o tym samym tytule i adresie w tej samej sekcji. Wpisy z grupy szybkiego dostępu stają się ulubionymi.

API przechowuje odpowiedzi dashboardu i list zadań w pamięci przez maksymalnie 30 sekund. Po udanym zapisie kolejne odczyty korzystają z aktualnych danych.

Linki mogą używać automatycznej ikony z `/favicon.ico` na swojej domenie. Kartę można też ustawić na ikonę wbudowaną lub przesłaną w aplikacji. Jeśli witryna nie udostępnia ikony pod tym adresem, karta pokaże ikonę linku.

## Backup, restore i aktualizacja

Aby przenieść dashboard między instancjami, na źródłowej wybierz **Ustawienia → Dane i kopie zapasowe → Eksportuj bazę SQLite**. Na docelowej wybierz **Importuj bazę SQLite**, wskaż pobrany plik i potwierdź zastąpienie danych. Kopia poprzedniej bazy docelowej będzie dostępna do pobrania.

**Wyczyść bazę** tworzy kopię i usuwa dane oraz własne ustawienia. Tablica otrzymuje puste, domyślne kolumny. Kopie są dostępne w sekcji **Kopie na serwerze**. Eksport i import JSON pozostają dostępne. Więcej informacji zawiera [procedura kopii i odtwarzania](docs/BACKUP_RESTORE.md).

Aktualizacja lokalnego obrazu: `docker compose -f compose.build.yaml up --build -d` na tym samym wolumenie. Dla registry: `docker compose -f compose.production.yaml pull`, następnie `up -d` z tym samym plikiem. Migracje mają automatyczne snapshoty. Nie używaj `down -v`, jeśli chcesz zachować dane.

## Testy

```powershell
dotnet test tests/PersonalHub.Api.Tests
npm test --prefix src/personal-hub-web
npm run typecheck --prefix src/personal-hub-web
npm run build --prefix src/personal-hub-web
npm run e2e --prefix src/personal-hub-web
node scripts/openapi-contract.mjs --check
```

E2E wymaga uruchomionej aplikacji na porcie 8080 i przeglądarki Playwright. Szczegóły, wyniki, ograniczenia pomiarów: [TESTING](docs/TESTING.md).

## Znane ograniczenia

Natywne DnD zamiast wymaganego `@dnd-kit/react`; dotyk korzysta z menu przenoszenia. Markdown obsługuje ograniczony podzbiór (nagłówki, akapity, pogrubienia, kod inline, bezpieczne linki). Brak pełnego selektora Lucide/Simple Icons i pełnej generacji DTO przez `openapi-typescript`. Dostępne są wybrane ikony Lucide oraz upload własnych. Nie wszystkie mutacje mają optimistic update; reszta pokazuje zapis i odświeża stan po sukcesie. Nie zmierzono Lighthouse ani axe. Nie potwierdzono odbioru kontenera non-root na świeżym wolumenie.

Etap 2 ze specyfikacji pozostaje odłożony: cykliczność, scalanie kopii zapasowych, auth/PIN, historia, dodatkowe schematy URL i szablony sekcji. Etap 3: monitoring, integracje, PWA i kalendarz.
