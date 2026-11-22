# Wdrożenie

## Lokalnie

`npm ci --prefix src/personal-hub-web`, `npm run build --prefix src/personal-hub-web`, następnie `dotnet run --project src/PersonalHub.Api --no-launch-profile --urls http://127.0.0.1:8080`.

Produkcyjna publikacja bez Dockera: `dotnet publish src/PersonalHub.Api -c Release -o artifacts/publish` po zbudowaniu frontendu; z katalogu publikacji uruchom `dotnet PersonalHub.Api.dll --urls http://127.0.0.1:8080`. Ustaw bezwzględny `ConnectionStrings__Default`, np. `Data Source=D:/PersonalHub/dashboard.db;Foreign Keys=True;Default Timeout=5`.

## Compose

Skopiuj `.env.example` jako `.env`, następnie `docker compose up --build -d`. Jedna usługa runtime na porcie 8088 hosta. `docker compose config --quiet` weryfikuje interpolację. `docker compose ps` i `docker inspect --format '{{.State.Health.Status}}' personal-hub` weryfikują gotowość. Healthcheck nie potrzebuje curl/wget.

`HOST_PORT=8090` zmienia port. `BIND_ADDRESS=127.0.0.1` ogranicza publikację do localhost. Dla LAN użyj np. `BIND_ADDRESS=192.168.1.10` i `ALLOWED_HOSTS=localhost;127.0.0.1;[::1];192.168.1.10;hub.lan`. Zastosuj firewall. Nie ustawiaj publicznego bindu bez dodatkowej ochrony. Ustawienie timezone w UI steruje datami zadań; `TZ` dotyczy logów.

Dane: wolumen `personal_hub_data` montowany do `/app/data`. W środku są baza i kopie. Nie stosuj sieciowego filesystemu bez weryfikacji lockingu. Jedna replika.

## Portainer

Stack z repozytorium z kontekstem builda może używać `compose.yaml`, jeśli środowisko Portainera obsługuje budowanie. Web editor bez kontekstu: najpierw zbuduj i wypchnij własny obraz:

```text
docker build -t registry.example.com/personal-hub:1.0.0 .
docker push registry.example.com/personal-hub:1.0.0
```

Wklej `compose.image.yaml` i ustaw `PERSONAL_HUB_IMAGE` na swój obraz, wraz z HOST_PORT/BIND_ADDRESS/ALLOWED_HOSTS. Repo nie publikuje gotowego obrazu i nie podaje fikcyjnego registry. Zapisz nazwę wolumenu; zmiana nazwy stacka może utworzyć nowy wolumen zamiast podłączyć dotychczasowy.

## Reverse proxy z TLS i auth

Przykład nginx (TLS i plik htpasswd tworzysz na swoim serwerze):

```nginx
server {
    listen 443 ssl;
    server_name hub.example.com;
    ssl_certificate /etc/ssl/hub/fullchain.pem;
    ssl_certificate_key /etc/ssl/hub/privkey.pem;
    auth_basic "Personal Hub";
    auth_basic_user_file /etc/nginx/personal-hub.htpasswd;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Dodaj `hub.example.com` do `ALLOWED_HOSTS` i pozostaw localhost dla healthchecka. Dodaj zmienną środowiskową `TrustedProxies` z rzeczywistym adresem IP proxy widzianym przez aplikację (np. IP bramy bridge Dockera); nie zgaduj i nie ufaj całej sieci. Proxy ma usuwać i nadpisywać forwarded headers klienta. Dla HTTP localhost bez proxy pozostaw `TrustedProxies` puste.

Brak auth w aplikacji oznacza, że należy objąć ochroną proxy także `/api`, eksporty, ikony i backupy. VPN jest alternatywą, jeśli dostęp mają wyłącznie zaufane urządzenia. Sam TLS nie ogranicza uprawnień.

## Ograniczenie weryfikacji

Składnia Compose została sprawdzona. Engine Docker nie działał (`dockerDesktopLinuxEngine` nie istnieje), więc build obrazu, uruchomienie healthy, non-root, read_only, nowy wolumen i przykład nginx są **NIE URUCHOMIONO**. Nie traktuj tych konfiguracji jako zaliczonych testów wdrożeniowych.
