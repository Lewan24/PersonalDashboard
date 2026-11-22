# Testy i faktyczne wyniki

Najnowszy przebieg po korektach interfejsu 2026-11-23: **25/25 xUnit i 27/27 Vitest**. Dodano testy menu, klawiatury, modułu zadań i migracji szerokości. E2E wykrywa obecnie 4 scenariusze i nadal jest blokowane `spawn EPERM`. Bieżący raport: [UI_UPDATE.md](UI_UPDATE.md). Poniższe zestawienie zachowuje wyniki pierwszego wdrożenia.

## Wykonano

| Polecenie | Wynik |
|---|---|
| `dotnet restore src/PersonalHub.Api --use-lock-file --ignore-failed-sources -p:NuGetAudit=false` | PASS, lockfile utworzony z dostępnych pakietów. Zdalny audyt NuGet nie został wykonany. |
| `dotnet build src/PersonalHub.Api -c Release --no-restore` | PASS, 0 błędów, 0 ostrzeżeń. |
| `dotnet test tests/PersonalHub.Api.Tests --no-restore` | PASS, 23/23, 0 pominiętych. Plikowa SQLite i WebApplicationFactory. |
| `npm test --prefix src/personal-hub-web` | PASS, 21/21 w 2 plikach, Vitest + Testing Library/jsdom. |
| `npm run typecheck --prefix src/personal-hub-web` | PASS, TypeScript strict. |
| `npm run build --prefix src/personal-hub-web` | PASS, produkcyjny Vite output do API/wwwroot. |
| `docker compose config --quiet` | PASS. |
| `PERSONAL_HUB_IMAGE=personal-hub:local docker compose -f compose.image.yaml config --quiet` | PASS (w PowerShell ustaw zmienną przez `$env:PERSONAL_HUB_IMAGE`). |
| `node scripts/openapi-contract.mjs --check` | PASS, 58 operacji zgodnych z zapisanym OpenAPI. To sprawdza listę tras, nie pełne DTO. |
| Lokalny `dotnet run ... --urls http://127.0.0.1:8080`, odczyt bootstrap i OpenAPI | PASS, HTTP 200, rzeczywisty seed i statyczny build. |
| Lokalny Release DLL: `/health/ready`, SPA `/tasks`, `--healthcheck` | PASS, odpowiednio HTTP 200, HTTP 200 text/html, kod wyjścia 0. |
| Zapis przez proxy Vite z `Origin: http://127.0.0.1:5173` | PASS, `/system/test-write` HTTP 200. Proxy zachowuje Host (`changeOrigin:false`), więc ochrona Origin pozostaje aktywna. |

Pierwszy przebieg API miał 16/18 (błędy testów: odczyt tablicy jako obiektu i DELETE bez wymaganego JSON); następnie poprawiono deterministyczny wybór innej sekcji w teście konfliktu. Po poprawkach i rozszerzeniu zestawu końcowy przebieg ma 23/23. Nie ukrywamy wcześniejszych nieudanych prób.

`dotnet format ... whitespace` nie wykonał formatowania: build-host pipe UnauthorizedAccessException. Kod TS/CSS/JSON sformatowano Prettier; lint semantyczny ESLint nie jest skonfigurowany. Kompilator TS strict i kompilator C# to wykonane kontrole statyczne.

## Wydajność

- Początkowy główny JS: **143,98 KB gzip**, współdzielony React chunk 3,11 KB i leniwe ikony 2,15 KB; nawet z nimi 149,24 KB < budżetu 250 KB.
- CSS: **5,04 KB gzip**.
- Oddzielne trasy: Tasks 2,77 KB gzip, Settings 2,07 KB gzip.
- `/bootstrap`, 500 kart + 1000 zadań: szczegółowe 7 próbek i mediana w [performance.json](performance.json). Test mierzy pełny odczyt odpowiedzi przez WebApplicationFactory, rozgrzane zapytania i plikową SQLite. To pomiar in-process na Windows, bez TCP/proxy/kontenera, z zadaniami bez terminów (todayTasks puste). Nie zastępuje pomiaru na docelowym serwerze ani najgorszego przypadku 1000 zadań na dziś.
- Lighthouse desktop accessibility / mobile performance: **NIE URUCHOMIONO** — browser spawn EPERM.

## Niewykonane kontrole

`npm run e2e --prefix src/personal-hub-web` wykrywa 3 scenariusze, ale runner nie uruchamia workera (`spawn EPERM`). Bezpośrednia próba Chromium także kończy się `spawn EPERM`. Narzędzie przeglądarkowe nie miało aktywnego native pipe. Dlatego nie ma zatwierdzonych screenshotów, pomiaru konsoli, wizualnego review ani wyników E2E/axe. Nie utożsamiamy testów jsdom z prawdziwą przeglądarką.

`docker compose up --build -d`: **NIE URUCHOMIONO** — brak `dockerDesktopLinuxEngine`. CLI i parser Compose działają, Engine nie. Nie potwierdzono budowy obrazu, healthchecka w kontenerze, Linux tzdata, non-root, read_only, uprawnień świeżego wolumenu, restartu i aktualizacji obrazu. Konfiguracja nie jest dowodem ich działania.

Wykonano mechaniczny detektor Impeccable: jedyne ostrzeżenie dotyczyło deklaracji fontu Inter. Usunięto tę nieużywaną nazwę, pozostawiając systemowy font aplikacyjny. Bez screenshotów nie wykonano niezależnego review wizualnego.

## Jak powtórzyć

```powershell
dotnet restore tests/PersonalHub.Api.Tests
dotnet test tests/PersonalHub.Api.Tests
npm ci --prefix src/personal-hub-web
npm test --prefix src/personal-hub-web
npm run typecheck --prefix src/personal-hub-web
npm run build --prefix src/personal-hub-web
dotnet build src/PersonalHub.Api -c Release
```

Uruchom produkcyjne API z README na porcie 8080. Potem:

```powershell
cd src/personal-hub-web
npx playwright install chromium
npm run e2e
```

Zmienna `HUB_URL` zmienia adres bazowy E2E; `CHROMIUM_PATH` pozwala wskazać pasującą przeglądarkę. E2E tworzy dane testowe — używaj osobnej bazy lub świeżego wolumenu, nie danych produkcyjnych. Artefakty trafiają do docs/e2e-report i docs/e2e-results. Integracja axe nie została zainstalowana ani skonfigurowana; należy ją dodać przed uznaniem scenariusza 15 za PASS.

Aktualizacja kontraktu tras: pobierz świeży `/openapi/v1.json` do docs/openapi.json, uruchom `node scripts/openapi-contract.mjs`, następnie `--check`. `HUB_URL=http://127.0.0.1:8080 node scripts/openapi-contract.mjs --check` sprawdza żywy serwer. Pełny generator DTO nadal wymaga uzupełnienia.

Pełna tabela 27 scenariuszy: [PROGRESS](PROGRESS.md). E2E nie pokrywa jeszcze wszystkich 27 scenariuszy; część zachowań testują testy API/jednostkowe, pozostałe wymagają rozszerzenia E2E i ręcznego odbioru.
