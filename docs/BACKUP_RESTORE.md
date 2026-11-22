# Backup, restore, aktualizacja

## Kopie online

W UI Ustawienia → Dane:

1. **Eksport JSON z ikonami**: pełny wersjonowany dokument z ID, kolejnością, ustawieniami, zadaniami, checklistami, linkami i ikonami base64.
2. **Pobierz świeżą kopię SQLite**: SQLite Backup API tworzy spójny snapshot także przy WAL. To jeden plik z ikonami.
3. **Utwórz kopię na serwerze**: `/app/data/backups/backup-*.db`. Retencja 10 ostatnich standardowych kopii. Snapshoty `pre-import-*` i `pre-migration-*` nie są automatycznie rotowane.

`GET /api/v1/backup/sqlite` również zapisuje snapshot do katalogu kopii. Kopie na tym samym wolumenie nie chronią przed awarią dysku: pobieraj je na inny nośnik. Nigdy nie kopiuj samego żywego dashboard.db, ignorując WAL.

## Import JSON w UI

Wybierz JSON (do 25 MB), sprawdź liczniki podglądu, potwierdź zastąpienie danych. Błędny rekord blokuje całość. Token jest jednorazowy i wygasa po 10 minutach, także po restarcie serwera. Przed commitem powstaje kopia `pre-import`. Commit zastępuje dane w jednej transakcji. ID i ikony są zachowane. Brak merge w MVP. Eksport `includeIcons=false` z odwołaniami do własnych ikon nie nadaje się do samodzielnego importu bez ich danych; preview odrzuci brakujące referencje.

## Restore SQLite offline (lokalnie)

1. Zatrzymaj API/kontener. Zachowaj obecną bazę z WAL/SHM jako osobny zestaw awaryjny, jeśli istnieje.
2. Umieść spójny snapshot jako `dashboard.db` w katalogu danych.
3. Usuń **stare** `dashboard.db-wal` i `dashboard.db-shm` tylko przy zatrzymanej aplikacji; nie łącz ich z nową bazą.
4. Zapewnij właściciela/uprawnienia konta aplikacji.
5. Uruchom zgodną wersję aplikacji. Sprawdź `/health/ready`, zakładki, zadania i własne ikony.

Nie przywracaj snapshotu nowszej aplikacji do starszego obrazu. Start odmawia pracy, jeśli rozpoznaje migracje nowsze niż dostępne w aplikacji.

## Restore named volume Dockera

Ustal prawdziwą nazwę wolumenu przez `docker inspect personal-hub` (Mounts). W poniższych poleceniach zastąp `STACK_personal_hub_data` tą nazwą; katalog bieżący zawiera snapshot `personal-hub.db`.

```text
docker compose stop
docker run --rm --user 0 -v STACK_personal_hub_data:/data -v "ABSOLUTE_BACKUP_DIRECTORY:/restore:ro" alpine:3.22 sh -c "cp /restore/personal-hub.db /data/dashboard.db && rm -f /data/dashboard.db-wal /data/dashboard.db-shm && chown 1654:1654 /data/dashboard.db"
docker compose up -d
docker compose ps
```

Najpierw pobierz/zarchiwizuj obecne dane, jeśli możesz ich potrzebować. UID `app` obrazu .NET to domyślnie 1654; przed użyciem sprawdź UID w swoim zbudowanym obrazie. `ABSOLUTE_BACKUP_DIRECTORY` jest katalogiem hosta, nie ścieżką do pliku. Nie uruchamiaj operacji na niewłaściwym wolumenie. Polecenia kontenerowe nie zostały wykonane w tej sesji.

## Aktualizacja bez utraty danych

1. Pobierz świeży backup i zapisz aktualny tag obrazu.
2. Zachowaj ten sam wolumen i connection string.
3. Dla źródeł: `docker compose up --build -d`. Dla registry: pull i up z `compose.image.yaml`.
4. Przed oczekującymi migracjami istniejącej bazy API tworzy snapshot `pre-migration-1-*`. Awaria snapshotu blokuje migrację. Na świeżej bazie snapshot nie jest potrzebny.
5. Sprawdź health i dane. Rollback po migracji: zatrzymaj aplikację, przywróć pasujący snapshot i poprzedni obraz razem.

`docker compose down -v` usuwa dane. Nie używaj go podczas aktualizacji. Snapshoty pre-migration/pre-import kontroluj pod kątem zajętego miejsca.

Testy: `BackupContainsCommittedWalAndSettingsPersist`, `IconsRoundTripAndMaliciousUploadRejected`, `ExistingDatabaseRestartsWithoutReseedAndFreshBackupIsRestorable` sprawdzają SQLite i ponowne otwarcie snapshotu. Pełny restore/upgrade kontenera na named volume oraz realną migrację z poprzedniej wersji produktu oznaczono jako NIE URUCHOMIONO.
