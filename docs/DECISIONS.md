# Decyzje i odstępstwa

## Korekta użytkownika 2026-11-23

- Użytkownik zmienił wymagania nawigacji → brak osobnej strony zadań w UI, moduł pod wszystkimi sekcjami, legacy `/tasks` przekierowuje do `/#tasks` z zachowaniem filtrów → nowe polecenie ma pierwszeństwo nad pierwotnym SPEC §5.
- Użytkownik zastąpił tryb Edytuj menu kontekstowym → jedna postać linków, menu Radix pod PPM i przyciskiem `…`, klawiaturowe akcje ruchu → mniej stale widocznych kontrolek, dostępność na dotyku.
- Szerokość sekcji → osobne trwałe `WidthPercent` z presetami 25/33/50/66/75/100 → niezależna konfiguracja sekcji, szybki select w nagłówku, pełna szerokość na telefonie.
- Istniejące sekcje → migracja ustawia szerokość 100%, nie usuwa danych → zgodność z nowym domyślnym układem; starsze JSON bez pola dostają 100%.
- Domyślny akcent → #cc0000; migracja zmienia wyłącznie poprzedni domyślny #a5c8ae → własne inne kolory są zachowane.
- Zarządzanie kolumnami, zadaniami i linkami → akcje w menu zamiast osobnych rzędów przycisków → kompaktowość bez usunięcia funkcji.

Poniżej pozostawiono historię decyzji z pierwszego wdrożenia; tryb edycji i osobna trasa zadań zostały zastąpione powyższą korektą.

- `REAMDE.md` nie istnieje → przeczytano README.md i zachowano jako docs/SPEC.md → zgodność z AGENT_PROMPT i treścią specyfikacji.
- Brak repozytorium Git → przeniesiono plik przez Move-Item; brak commitów etapowych → nie tworzono fikcyjnej historii repo.
- Brak docs/reference/dashboard.png → interfejs według opisu §1 → matowy ciemny dashboard, kompaktowe sekcje i mini-Kanban.
- Specyfikacja zawiera kompletny brief i zakazuje blokowania kosmetycznych decyzji → wdrożenie bez dodatkowego procesu zatwierdzania makiet → pierwszeństwo instrukcji użytkownika nad domyślnym wywiadem design skill.
- Formularze zadań → jawny przycisk Zapisz → brak niejasnego autozapisu podczas edycji kolekcji.
- Wyścigi mutacji → globalna kolejka klienta oraz singleton WriteGate serwera → jedna instancja SQLite, łatwiejsze uzgadnianie stanu; operacje niezależne też są serializowane.
- Część mutacji optymistyczna (ruch kart, ukończenie z mini-panelu) → pozostałe używają stanu zapisu i refetch po sukcesie → pełny optimistic update wszystkich akcji nie jest jeszcze zgodny z MVP.
- Ograniczony dostęp do npm/NuGet i read-only globalny cache → instalacja dostępnych przypiętych wersji z cache, lockfile z publicznymi URL → odtwarzalny build bez zależności od lokalnego adaptera.
- Brak @dnd-kit/react w cache → natywne DnD myszy plus klawiaturowe/dotykowe menu ruchu → działające przenoszenie; pełne gesty dotykowe i wymagany pakiet pozostają odstępstwem MVP. API pakietu sprawdzono w oficjalnym https://dndkit.com/react/quickstart/.
- Brak react-markdown/rehype-sanitize w cache → ograniczony renderer oparty wyłącznie o escapowane elementy React → HTML i niebezpieczne linki nie są wykonywane; pełny Markdown pozostaje brakujący.
- Ikony → wybrane leniwe Lucide i BLOB upload; nieznane nazwy oraz si:* mają fallback link → pełny Simple Icons i picker nie zostały ukończone.
- Brak openapi-typescript w dostępnych zależnościach → ręcznie typowane DTO i generator listy operacji z OpenAPI → pełna generacja DTO i jej kontrola aktualności pozostają nieukończone.
- Brak integracji axe i niedostępny proces przeglądarki → testy semantyki w Testing Library oraz gotowe E2E, bez deklaracji WCAG/Lighthouse jako zaliczonych → uczciwa granica weryfikacji.
- Brak silnika Docker → Compose sprawdzony składniowo, runtime niewykonany → nie deklarujemy healthy/non-root jako potwierdzonych.
- Sekcja 5 dopuszcza zewnętrzną wyszukiwarkę, sekcja 13 odkłada ją do etapu 3 → dostarczono wyłącznie opt-in szablon URL otwierany po zatwierdzeniu → brak serwerowych integracji i automatycznego wysyłania wpisywanych znaków.
- Archiwizacja kolumny z zadaniami → zachowanie kolumny z IsArchived zamiast usunięcia FK → zadania nie są kasowane ani osierocane.
- Paginacja → offset w cursor i jawne doładowanie stron po 200 rekordów → prosty interfejs; równoczesne zmiany mogą przesunąć granice stron.
- Proxy Vite domyślnie podmienia Host przy skrótowej konfiguracji → jawne changeOrigin:false → zapisy developerskie przechodzą kontrolę Origin bez wyłączania ochrony CSRF.
- Dowolny akcent użytkownika → kontrastowy kolor tekstu na przycisku i dostosowany wariant akcentu dla tekstu/focus → wybrany akcent nie powoduje niewidocznego tekstu po zmianie motywu.
