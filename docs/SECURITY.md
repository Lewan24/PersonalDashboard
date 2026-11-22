# Bezpieczeństwo i granice zaufania

Brak uwierzytelniania i separacji użytkowników. Każdy mający dostęp sieciowy może przeczytać, zmienić i skasować wszystkie dane, wykonać import, pobrać JSON, ikony i pełną bazę. Aplikacja nie jest bezpieczna do bezpośredniej publikacji w internecie. Domyślne wiązanie localhost nie zastępuje ochrony komputera i kont użytkowników.

## Mechanizmy

- Mutacje wymagają `X-PersonalHub-Client: 1` i JSON; upload ikon używa multipart. Niezgodny Origin lub Referer jest odrzucany. Żądania bez tych źródeł są dopuszczone wyłącznie z wymaganym nagłówkiem i Content-Type (narzędzia lokalne).
- Host musi należeć do jawnej listy `AllowedHosts`; wildcard nie jest wspierany przez własną walidację. Ochrona ogranicza DNS rebinding, nie jest kontrolą dostępu.
- CORS pozostaje wyłączony. Forwarded headers są wyłączone bez `TrustedProxies`; przy włączeniu zaufane są wyłącznie wymienione IP proxy, jeden hop.
- CSP self, brak obiektów i ramek, nosniff, no-referrer, Permissions-Policy wyłącza kamerę/mikrofon/geolokalizację. Nie pobieramy metadanych, faviconów i adresów usług z backendu, co eliminuje tę drogę SSRF.
- URL tylko http/https po stronie API i klienta. Markdown renderowany jako elementy React z ograniczonej gramatyki, bez HTML i bez `dangerouslySetInnerHTML`. Surowy HTML jest wyświetlany jako tekst. Nie jest to pełny CommonMark.
- Upload do BLOB: limit 256 KB, łącznie 50 MB, magic bytes PNG/JPEG/GIF/WebP/ICO; SVG zabronione, stały MIME. Nie ma ścieżek uploadu. Magic bytes nie są pełnym dekoderem obrazów ani skanerem antywirusowym.
- Limit JSON 1 MB (także chunked przez feature Kestrela), import 25 MB, ograniczony magazyn tokenów podglądu (5), TTL 10 minut, użycie jednorazowe. Import waliduje graf i powiązania przed zapisem; transakcja replace, backup przed commitem.
- Kontener: app/non-root, read_only, cap_drop ALL, no-new-privileges; wykonania w tym środowisku nie potwierdzono.

## Ryzyka operacyjne

SQLite backup i JSON zawierają wszystkie prywatne dane. Chroń je uprawnieniami, szyfruj nośnik i kopie zewnętrzne; pliki nie są szyfrowane przez aplikację. Osoba z lokalnym dostępem do wolumenu omija zabezpieczenia HTTP. Nie zapisuj haseł/tokenów w opisach i linkach.

Przeglądanie złośliwych linków pozostaje decyzją użytkownika; http/https nie oznacza zaufanego hosta. Nowe karty mają noopener/noreferrer. Własne ikony są dekodowane przez przeglądarkę, więc aktualizuj przeglądarkę i runtime. Walidacja `Version` zabezpiecza przed utratą zmian, nie przed złośliwym klientem.

Nie ma rate limitingu, audytu tożsamości, RBAC ani logowania. Osoba z dostępem może wyczerpać zasoby lub tworzyć kopie. Ogranicz dostęp firewallem/VPN; reverse proxy powinno limitować ruch, wymuszać TLS i uwierzytelnianie. API nie loguje opisów ani tokenów; domyślne logowanie EF nie włącza sensitive data logging.

Testy `SecurityAndRouting`, `DangerousUrlsRejected`, `IconsRoundTripAndMaliciousUploadRejected`, `InvalidPatchDoesNotPersistPartialChangesAndTaskVersionRequired` i testy Markdown w Vitest sprawdzają wybrane mechanizmy. Nie jest to pełny audyt bezpieczeństwa. Axe/Lighthouse nie uruchomiono.
