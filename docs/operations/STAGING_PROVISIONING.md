# FanMind Staging-Provisioning

## Ziel

Eine klar abgegrenzte Nicht-Production-Umgebung für schreibende Stripe-, Referral-, Restore-, Migrations- und Integrationsprüfungen bereitstellen. Der Webhost nutzt aus Kostengründen denselben Exoscale-Server wie Production, ist dort aber durch einen eigenen Linux-Nutzer, Release-Pfad, Prozess, nginx-vHost, ENV-Datei und Runner-Dienst getrennt. Diese Betriebsgrenze ist keine Infrastrukturtrennung durch einen zweiten Server. Supabase- und Stripe-Staging-Ressourcen müssen dagegen vollständig von Production getrennt bleiben. Production-Daten, Production-Schlüssel und echte Kundendaten dürfen nicht verwendet werden.

## Bereits technisch vorhanden

- Fail-closed-Policy in `src/lib/environmentBoundaryPolicy.mjs`;
- Read-only- und Write-Preflight über `npm run environment:preflight` und `npm run environment:preflight:write`;
- sichere Vorlage `.env.staging.example`;
- zusätzlicher Baseline-Check `npm run staging:preflight`;
- manueller GitHub-Workflow `FanMind Staging Readiness`;
- manueller, `main`-gebundener und commit-genauer Deploy-Workflow `Deploy FanMind Staging` für einen ausschließlich mit `fanmind-staging` gekennzeichneten Self-Hosted Runner;
- manueller, `main`-gebundener Workflow `Provision FanMind Staging Host`, der
  auf dem bestehenden Exoscale-Host ausschließlich den getrennten Linux-Nutzer,
  Release-Pfad, private Runtime-Dateien, systemd-Anwendungsdienst, nginx-vHost
  und zweiten Runner-Dienst anlegt;
- separater manueller Workflow `Enable FanMind Staging TLS`, der erst nach
  erfolgreicher DNS-Bindung das vorhandene Certbot-Konto für
  `staging.fanmind.ch` verwendet;
- versionierte nginx-Grenze für exakt `/api/webhooks/whatsapp`: wegen des von
  Meta unvermeidlich als Query übertragenen `hub.verify_token` gelten dort
  `access_log off` und route-lokal `error_log /dev/null crit`;
- Policy-Tests, die Production-Ziele und unvollständige Freigaben blockieren.
- ein getrennter, commit-genauer und read-only Workflow
  `FanMind Staging Stripe Webhook Readiness`, der URL, Testmodus, Aktivstatus,
  explizite API-Version und die exakte minimale Eventmenge des Stripe-
  Testwebhooks prüft, ohne Endpoint- oder Billing-Ressourcen zu verändern.

## Externer Ressourcenstand

1. **Staging-Webgrenze auf dem bestehenden Exoscale-Server – erledigt**
   - eigener HTTPS-Host `staging.fanmind.ch`;
   - eigener Linux-Nutzer, eigener Prozess, eigener Release-Pfad und getrennte ENV-Datei;
   - kein Alias auf die Production-Anwendung und keine gemeinsame Runtime;
   - kein zweiter Server: ein Ausfall oder eine Fehlkonfiguration des gemeinsamen Hosts bleibt ein geteiltes Infrastrukturrisiko.

2. **Supabase Staging – erledigt**
   - neues eigenes Supabase-Projekt;
   - eigenes Auth, Datenbank, Storage und Service-Role-Key;
   - `FANMIND_TARGET_SUPABASE_PROJECT_REF` muss exakt der Projektreferenz in der Supabase-URL entsprechen;
   - Abweichungen zwischen URL und expliziter Zielreferenz werden fail-closed abgelehnt;
   - ausschließlich synthetische Kontakte, Nachrichten und Dateien;
   - Production-Projektreferenz nur als Vergleichswert, niemals Production-Schlüssel hinterlegen.

3. **Stripe Sandbox – offen**
   - bevorzugt ein eingeschränkter `rk_test_...`-Schlüssel mit den minimal
     benötigten Lese-/Schreibrechten; `sk_test_...` bleibt nur als kompatibler
     Übergang erlaubt;
   - eigener Test-Webhook auf `https://staging.fanmind.ch/api/stripe/webhook`;
   - fünf getrennte aktive Testpreise für den aktuellen vollständigen Staging-Lifecycle:
     - Starter Setup: exakt 990 Euro einmalig;
     - Starter: exakt 312 Euro monatlich;
     - Internal Daily Test: exakt 1 Euro täglich;
     - KI Plus: exakt 100 Euro monatlich;
     - KI Ultra: exakt 200 Euro monatlich;
   - Stripe-Testkarten und ausschließlich synthetische Testkunden/-subscriptions;
   - keine Live-Kunden, Live-Zahlungsmittel oder Live-Subscription-IDs.

4. **Staging-Runtime und Runner – erledigt**
   - eigener Self-Hosted Runner mit dem exklusiven Label `fanmind-staging`, niemals der Production-Runner;
   - eigener Release-Pfad unter `/var/www/fanmind-staging`;
   - eigene, nicht versionierte `/var/www/fanmind-staging/.env.production` mit Dateimodus `0600` und ausschließlich Staging-Werten;
   - eigener, vom GitHub-Runner unabhängiger systemd-Dienst
     `fanmind-staging.service` und eigener nginx-vHost;
   - eigener root-verwalteter Shared-Rate-Limit-Secret unter
     `/etc/fanmind-staging/runtime-secrets.env`; er wird lokal kryptografisch
     erzeugt, nie ausgegeben und bei Re-Provisionierung unverändert bewahrt;
   - die einmalige Host-Provisionierung läuft mit der Bestätigung
     `provision-fanmind-staging-host`; sie deployt keine Anwendung und ändert
     weder den Production-Checkout noch den Production-PM2-Prozess;
   - der eigentliche Deploy synchronisiert einen kurzlebig authentifizierten,
     commit-genauen Checkout mit `persist-credentials: false` ohne `.git` in
     den Release-Pfad; der Staging-Nutzer erhält keine dauerhaften
     Repository-Zugangsdaten;
   - der dafür kurzzeitig benötigte Secret
     `FANMIND_STAGING_RUNNER_REGISTRATION_TOKEN` wird nach erfolgreicher
     Registrierung des zweiten Runners aus dem GitHub Environment gelöscht;
   - Wiederholungsläufe prüfen die bestehende private `.runner`-Datei über einen
     privilegierten read-only `sudo test -f`; nach erfolgreicher Erstregistrierung
     ist daher kein neuer Registrierungstoken für normale Re-Provisionierung nötig;
   - dadurch entsteht kein zweiter Exoscale-Server und kein zusätzlicher
     monatlicher Infrastrukturpreis.

5. **GitHub Environment `staging`**
   - Variable `FANMIND_STAGING_APP_URL`;
   - Variable `FANMIND_STAGING_SUPABASE_PROJECT_REF`;
   - Variable `FANMIND_PRODUCTION_SUPABASE_PROJECT_REF`;
   - Variable `FANMIND_STAGING_ADMIN_EMAILS` als kommagetrennte Liste der
     Staging-Administratoren; reale Adressen gehören nur in dieses geschützte
     Environment und nicht in versionierte Dateien;
   - Secret `FANMIND_STAGING_SUPABASE_URL`;
   - Secret `FANMIND_STAGING_SUPABASE_ANON_KEY`;
   - Secret `FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY`; sowohl der aktuelle
     serverseitige `sb_secret_...`-Key als auch ein Legacy-Service-Role-JWT
     werden unterstützt. Opaque Keys werden ausschließlich im `apikey`-Header
     transportiert und niemals als Bearer-Token ausgegeben;
   - Secret `FANMIND_STAGING_STRIPE_SECRET_KEY`;
   - Secret `FANMIND_STAGING_STRIPE_WEBHOOK_SECRET`;
   - Variable `FANMIND_STAGING_STRIPE_PRICE_STARTER_SETUP` für 990 Euro einmalig;
   - Variable `FANMIND_STAGING_STRIPE_PRICE_STARTER_MONTHLY` für 312 Euro monatlich;
   - Variable `FANMIND_STAGING_STRIPE_PRICE_INTERNAL_DAILY_TEST` für 1 Euro täglich;
   - Variable `FANMIND_STAGING_STRIPE_TAX_REGISTRATION_CONFIRMED`, erst nach
     tatsächlich eingerichteter Stripe-Tax-Testregistrierung exakt auf `true`;
   - Variablen `FANMIND_STAGING_STRIPE_PRICE_AI_PLUS` und
     `FANMIND_STAGING_STRIPE_PRICE_AI_ULTRA` für aktive EUR-Monatspreise zu
     exakt 100 beziehungsweise 200 Euro im Stripe Test Mode;
   - optionaler begrenzter Secret `FANMIND_STAGING_OPENAI_API_KEY`.
   - Variable `FANMIND_AI_TIER_STAGING_WORKSPACE_ID` für einen ausschließlich
     synthetischen Workspace mit einem Owner und mindestens einem Mitglied;
   - Variable `FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID` für den
     markierten primären synthetischen Acceptance-Workspace;
   - Variablen `FANMIND_STAGING_DB_PORT` (`5432`) und
     `FANMIND_STAGING_DB_NAME`;
   - Secrets `FANMIND_STAGING_DB_HOST` (IPv4-kompatibler Supabase-Supavisor-
     Session-Pooler), `FANMIND_STAGING_DB_USER` (für Supabase üblicherweise
     `postgres.<staging-project-ref>`) und `FANMIND_STAGING_DB_PASSWORD`;
     niemals eine Production-Verbindung;
     die kontrollierten Staging-DB-Workflows leiten den nicht geheimen,
     kanonischen Production-Vergleichshost automatisch als
     `db.<production-project-ref>.supabase.co` aus der Production-Projektreferenz
     ab. Ein Production-DB-Host-Secret oder Production-Zugangsdaten werden dafür
     nicht benötigt; der isolierte Restore-Drill besitzt davon getrennte,
     strengere Zielvergleichsregeln;
   - die kontrollierten DB-Workflows verwenden für `verify-full` ausschließlich
     die review- und fingerprint-gebundene öffentliche Supabase-Root-CA unter
     `config/certificates/supabase-root-2021-ca.crt`; der Ubuntu-Systemspeicher
     allein vertraut dieser privaten Provider-CA nicht;
   - Variablen `FANMIND_STAGING_E2E_WORKSPACE_ID`,
     `FANMIND_STAGING_E2E_CONTACT_ID`,
     `FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID` und
     `FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID` für zwei vollständig getrennte
     synthetische Workspaces und Kontakte;
   - Secrets `FANMIND_STAGING_E2E_EMAIL`,
     `FANMIND_STAGING_E2E_PASSWORD`,
     `FANMIND_STAGING_E2E_SECONDARY_EMAIL` und
     `FANMIND_STAGING_E2E_SECONDARY_PASSWORD`; die vollständigen
     Fail-closed-Anforderungen stehen in `docs/testing/BROWSER_E2E.md`;
   - die einmalige kontrollierte Erstellung und die gemeinsame UUID-Zuordnung
     dieser Ressourcen steht in
     `docs/operations/STAGING_SYNTHETIC_FIXTURES.md`;
   - temporärer Secret `FANMIND_STAGING_RUNNER_REGISTRATION_TOKEN` nur für
     die erste Runner-Registrierung; niemals in Runtime-ENV oder Git schreiben.

## Sichere Reihenfolge

1. externe Ressourcen erstellen;
2. den kurzlebigen Runner-Registrierungstoken ausschließlich als geschützten
   Environment-Secret hinterlegen und `Provision FanMind Staging Host` auf
   `main` mit `provision-fanmind-staging-host` starten;
3. den im Workflow-Summary ausgewiesenen IPv4-Wert als A-Record für
   `staging.fanmind.ch` setzen;
4. nach nachgewiesener DNS-Auflösung `Enable FanMind Staging TLS` mit
   `enable-fanmind-staging-tls` starten;
   Ein späterer wiederholter Provisionierungslauf darf die bereits verifizierte
   Certbot-Konfiguration nicht mehr durch den HTTP-Bootstrap-vHost ersetzen.
   Er erhält ausschließlich eine vollständige, exakt auf
   `staging.fanmind.ch`, Port `3001` und dessen Zertifikat gebundene
   TLS-Konfiguration; unvollständige oder abweichende Zustände stoppen
   fail-closed und verlangen danach erneut den getrennten TLS-Workflow. Für
   einen vorhandenen TLS-vHost parst die Provisionierung zusätzlich blockweise.
   Sie akzeptiert genau einen strukturell erkannten Port-443-Server. Die
   Listener-Auswertung normalisiert den ersten nginx-Parameter dezimal, sodass
   auch `0443` und `Adresse:0443` als Port 443 zählen. Im akzeptierten Server
   bindet sie die eindeutige exakte Direktive `listen 443 ssl;`, höchstens
   einen zusätzlichen SSL-geschützten IPv6-Listener, den exakten
   `server_name staging.fanmind.ch`, beide exakten Zertifikatdirektiven sowie
   genau eine Location `= /api/webhooks/whatsapp` mit exakt einem
   `access_log off`, einem route-lokalen `error_log /dev/null crit` und dem
   Upstream `127.0.0.1:3001`. In dieser Location sind ausschließlich die zehn
   versionierten Log-, Proxy- und Headerdirektiven zulässig; zusätzliche
   Includes, Rewrites, interne Redirects oder mehrzeilig versteckte
   Direktiven blockieren. Auch der TLS-Server selbst darf den Request nicht
   vor der Location-Auswahl umschreiben. Eine geschützte Location nur im HTTP-Server kann
   einen generisch geloggten TLS-Server daher nicht freigeben. Fehlt oder
   dupliziert sich ein Teil, wird der bestehende TLS-vHost nicht automatisch
   umgeschrieben: der Lauf
   stoppt mit `Existing staging TLS virtual host lacks the exact WhatsApp
   query-redaction boundary`. Erst eine separat reviewte Korrektur des
   TLS-vHosts, `nginx -t` und ein erneuter Provisionierungslauf dürfen
   fortfahren.
5. den kurzlebigen Runner-Registrierungstoken anschließend löschen;
6. `.env.staging.example` außerhalb von Git befüllen;
7. die Projektreferenz aus `NEXT_PUBLIC_SUPABASE_URL` exakt in `FANMIND_TARGET_SUPABASE_PROJECT_REF` übernehmen;
8. alle Schreibschalter auf `false` lassen;
9. `npm run staging:preflight` ausführen;
   Die spätere read-only Rollout-State-Prüfung bewertet einen in einem frisch
   kontrolliert aufgebauten Projekt noch fehlenden
   `supabase_migrations.schema_migrations`-Ledger als leeren Ledger und prüft
   anschließend weiterhin jedes reale Zielobjekt. Ein partieller, widersprüchlicher
   oder ungültiger Objektstand bleibt blockierend;
10. den manuellen Workflow `Deploy FanMind Staging` auf dem ausgewählten, von `main` erreichbaren Commit mit der Bestätigung `deploy-staging-only` starten;
11. der Workflow muss Preflight, Product Truth, Lint, Operations-Tests, Build,
    den getrennten systemd-Neustart, Health und commit-genauen Public Smoke
    erfolgreich abschließen; der Healthcheck meldet bei einem Fehler nur
    validierte Komponentennamen und Zustände, niemals Secret-Werte;
12. Workflow `FanMind Staging Readiness` exakt auf diesem Git-Commit manuell
    starten. Der read-only Hosted Runner erzeugt dafür je Lauf einen maskierten,
    kurzlebigen Rate-Limit-Prüfwert und erhält niemals das root-verwaltete
    Laufzeit-Secret des Staging-Hosts. Der abschließende Public Smoke prüft
    separat, dass der echte Staging-Dienst seine Shared-Rate-Limit-Komponente
    gesund meldet;
13. den vollständigen Stripe-Testkatalog mit
    `FanMind Staging Stripe Catalog Readiness` und danach den aktivierten,
    minimalen Testwebhook mit `FanMind Staging Stripe Webhook Readiness`
    commit-genau und read-only nachweisen; anschließend mit
    `FanMind Staging Stripe Webhook Signed Smoke` mutationsfrei bestätigen,
    dass der exakt ausgelieferte Staging-Handler das gebundene Signing-Secret
    akzeptiert;
14. erst für einen ausdrücklich beschriebenen Testfall `FANMIND_ENABLE_NON_PRODUCTION_WRITES=true` und die exakte Bestätigung setzen;
15. nach dem Test Schreibfreigabe sofort wieder deaktivieren;
16. synthetische Testdaten und temporäre Artefakte kontrolliert löschen.

## Kontrollierte KI-Stufen-Abnahme

Der manuelle Workflow `FanMind AI Tier Staging Acceptance` ist vorbereitet,
führt aber keine Migration aus. Vor seinem ersten Lauf muss die
checksum-gebundene Entitlement-Migration separat und bewusst auf Staging
verifiziert oder separat und bewusst auf Staging angewendet worden sein. Eine
gemeldete Migrationsanzahl ersetzt diesen Nachweis nicht.

1. Einen synthetischen Staging-Workspace mit einem Owner und mindestens einem
   weiteren Mitglied anlegen. Er darf noch keinen KI-Stufeneintrag besitzen.
2. Vier für diese KI-Abnahme relevante aktive Stripe-Testpreise bereitstellen:
   Starter-Setup exakt 990 Euro einmalig, Starter exakt 312 Euro monatlich,
   Plus exakt 100 Euro monatlich und Ultra exakt 200 Euro monatlich. Der
   zusätzliche 1-Euro-Daily-Testpreis gehört zum vollständigen Billing-Lifecycle,
   wird aber von diesem KI-spezifischen Acceptance-Workflow nicht verwendet.
3. Die oben genannten Staging-Variablen und -Secrets im GitHub Environment
   hinterlegen.
4. Zuerst `FanMind Staging Database Rollout State` auf demselben exakten
   `main`-Commit ausführen. Bei `verify` darf kein Apply gestartet werden; bei
   `skip` muss die Ledger-/Objektabweichung erhalten und ein generischer Push
   unterbleiben; bei `block` wird gestoppt.
5. Nur bei `apply` den manuellen Workflow `FanMind AI Tier Staging Migration`
   auf `main` mit der Bestätigung
   `apply-workspace-ai-tier-entitlements` starten. Er prüft die
   festgeschriebene Checksumme, bindet das Staging-Ziel und verlangt danach
   den read-only Metadaten-Postflight.
6. Erst nach einem grünen Objekt-Postflight den manuellen
   Abnahmeworkflow mit der Bestätigung
   `run-ai-tier-staging-acceptance` starten.
7. Der Abnahmerunner prüft den Stripe-Testkatalog read-only, simuliert doppelte,
   verspätete und kollidierende Lifecycle-Ereignisse und testet für Owner und
   Mitglied `SELECT`, `INSERT`, `UPDATE` und `DELETE` als verbotene
   Browserzugriffe.
8. Der erlaubte Service-Role-Insert-/Read-/Update-/Delete-Nachweis läuft
   ausschließlich in einer Datenbanktransaktion, die am Ende zurückgerollt
   wird. Workspace-, Nutzer-, Price-, Subscription- und Event-IDs werden
   nicht ausgegeben.

Erst `AI_TIER_STAGING_ACCEPTANCE=PASS` zusammen mit
`AI_TIER_STAGING_TRANSACTION=ROLLED_BACK` gilt als technischer Nachweis.
Das beweist noch keine Production-Freigabe und aktiviert Plus oder Ultra
nicht.

Die getrennte Erweiterung `FanMind AI Tier Stripe Event Ledger Staging` wurde
inzwischen kontrolliert auf Staging angewendet. Der aktuelle read-only
Katalog-Postcheck bestätigt den leeren Ledger, beide Funktionen, `FORCE RLS`
und die vorgesehenen Rechte-/`search_path`-Grenzen. Die ergänzende aktuelle
rollback-only Ledger-Abnahme für Replay, stale Event, gleiche Sekunde,
Reconciliation und entzogenes direktes Service-Role-Write bleibt offen, weil
die frühere Lifecycle-Abnahme vor dem Ledger-Apply lief. Das Runtime-Flag
`FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED` darf bis zu diesem Nachweis nicht
aktiviert werden; der Apply-Workflow setzt es nicht automatisch.

Danach bleibt auch das allgemeine Basis-Billing-Ledger getrennt. Sein
kontrolliertes SQL deckt Checkout, Invoice, Subscription, PaymentIntent,
Refund/Dispute und Tax ab, wurde aber nicht angewandt. Vor Aktivierung müssen
alle als `controlled_cutover` gesäten bestehenden Stripe-Workspaces mit einem
frischen kanonischen Snapshot reconciliert und alle `unresolved`-/
Sekundenkonflikte geschlossen sein. Eine aktive Basis-Projektion setzt zudem
den abgeschlossenen KI-Tier-/Referral-Abgleich desselben Snapshots voraus;
dieser gemeinsame Operator ist noch nicht aktiviert. Apply und Aktivierung
sind getrennt; der manuelle Workflow
`FanMind Stripe Billing Event Ledger Staging` setzt keine Runtime-Flags. Nach
Apply ersetzt zunächst die zweifach bestätigte Capture-only-Stufe den Legacy-
PATCH; die dritte Projektionsfreigabe bleibt bis nach dem vollständigen
Cutover `false`. Vollständiger Ablauf:
`docs/operations/STRIPE_BILLING_EVENT_LEDGER.md`.

Zwischen SQL-Apply und bestätigter Capture-Umschaltung ist ein dokumentierter
Billing-Write-Freeze Pflicht. Danach wird das Stripe-Workspace-Inventar erneut
DB-basiert gegen Lifecycle-Streams und aktuelle Objektbindungen geprüft. Die
Postflight-Werte `STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING` und
`STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED` müssen vor dem dritten Gate
beide exakt `0` sein. Unabhängig davon darf ein fehlender Stream mit bestehender
Stripe-Identität nie automatisch projektionsfähig werden.

Beide Ledger-Apply-Workflows verlangen den exakt geprüften `main`-Commit und
verwenden den Staging-Session-Pooler nur mit projektqualifiziertem Benutzer,
einem tatsächlich gegen das Ziel verglichenen Production-Host als negativem
Vergleichsanker und TLS `verify-full` gegen die
eingecheckte Supabase-Root-CA. Unmittelbar vor dem jeweiligen Apply führen sie
den gemeinsamen read-only Rollout-State mit demselben Commit, Ziel und
Passfile aus. Der KI-Workflow verlangt exakt
`STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=apply`, der Basis-Workflow
`STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=apply`; beide verlangen
zusätzlich den Gesamtzustand `PASS`. `present` plus grüner exakter Postflight
wird zu `verify`, jede partielle Objektmenge zu `block`.

## Freigabekriterien

Staging gilt erst als tatsächlich eingerichtet, wenn:

- eigener HTTPS-Host erreichbar ist;
- Supabase-Projekt nachweislich von Production getrennt ist;
- URL-Projektreferenz und explizite Staging-Zielreferenz exakt übereinstimmen;
- Stripe Test Mode verwendet wird;
- alle fünf aktuell erforderlichen Stripe-Testpreise korrekt gebunden sind;
- GitHub-Workflow vollständig grün ist;
- `/api/version` exakt den Commit ausliefert, auf dem der Readiness-Workflow gestartet wurde;
- `/api/version` zusätzlich `runtimeEnvironment=staging` ausliefert und damit die aktive Staging-Runtime bestätigt;
- der aktive nginx-TLS-vHost als einziger struktureller Port-443-Server den
  exakten Staging-Host, das Zertifikat und im selben Block die exakte
  WhatsApp-Location mit
  `access_log off` und route-lokalem `error_log /dev/null crit` enthält und
  ein kontrollierter Handshake bestätigt, dass `hub.verify_token` weder in
  Access- noch Error-Logs erscheint;
- jedes später vorgeschaltete CDN, WAF oder Load-Balancer eine gleichwertige
  und nachgewiesene Query-Redaktionsgrenze besitzt;
- keine realen Kundendaten vorhanden sind;
- Read-only- und Write-Preflight wie vorgesehen fail-closed reagieren;
- ein Test-Webhook erfolgreich verarbeitet wurde;
- die Stripe-seitige Webhook-Bindung zuvor read-only exakt auf URL,
  Testmodus, Aktivstatus, API-Version und minimale Eventmenge geprüft wurde;
- der signierte, mutationsfreie Staging-Smoke für exakt den ausgelieferten
  Commit HTTP 200 bestätigt hat;
- die KI-Stufen-Abnahme bei angewendeter Staging-Migration vollständig grün
  ist, bevor der Entitlement-Speicher mit Webhook oder produktiver KI
  verdrahtet wird.

## Nicht als erledigt markieren

Das Vorhandensein der Policy, Vorlage, Deploy-Automation und dieses Runbooks
ersetzt nicht die vollständige externe Laufzeitabnahme. Stripe-Testkatalog und
Test-Webhook sind vorbereitet; Runtime-Secret-Bindung, isolierter Host,
Supabase-Staging und der reale End-to-End-Nachweis müssen weiterhin gemeinsam
grün belegt sein. Der Roadmap-Punkt `Produktions- und Testdaten trennen` bleibt
deshalb bis zu diesem Nachweis teilweise offen.
