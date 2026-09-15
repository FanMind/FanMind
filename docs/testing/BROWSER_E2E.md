# FanMind Browser-E2E

## Zweck

Die Browser-Suite ergänzt die bestehenden Unit-, Policy-, Build-, Public-Smoke- und Sprachprüfungen. Sie ersetzt keine dieser Schichten.

Sie schützt die kritischen öffentlichen FanMind-Flows auf echter Browser-Ebene:

- Landingpage auf Deutsch und Englisch;
- Login und sichere Fehlermeldung;
- Passwort-Sichtbarkeit;
- Demo-Bestätigungsdialog ohne Demo-Erzeugung;
- enumeration-sicherer Passwort-Reset mit vollständig synthetischer Supabase-Antwort;
- öffentlicher Account-Löschressourcenpfad mit direktem authentifiziertem Gesamtprozess;
- Starter-Paketwahrheit und Roadmap-Abgrenzung der Vorschau-Pakete;
- Weiterleitung geschützter Routen zum Login;
- Desktop- und Mobile-Viewport ohne horizontales Überlaufen;
- consent-gesteuerten Meta Pixel: ohne Consent kein Script, gleichwertiges Ablehnen/Akzeptieren, genau eine Initialisierung, deduplizierte `PageView`-Events bei Client-Navigation sowie fail-closed blockierte geschützte Routen, unsichere Querywerte und geschützte same-origin Referrer.

Der Gerhard-Demo-Kern bleibt unverändert: Login, Dashboard, Kontakte, Kontaktdetail, serverseitige KI-Vorschläge, Kontaktwissen, Follow-ups und klar abgegrenzte Roadmap. Browser-E2E erweitert FanMind nicht um Social-Vollintegrationen, Scraping oder automatisches Senden.

## Automatisches no-write Gate

Workflow:

```text
.github/workflows/browser-e2e.yml
```

Konfiguration:

```text
playwright.config.mts
```

Tests:

```text
e2e/public-critical.spec.ts
```

Der Workflow:

1. installiert Root-Abhängigkeiten reproduzierbar mit `npm ci`;
2. erstellt den Production-kompatiblen Next.js-Build;
3. installiert ausschließlich Chromium;
4. startet den gebauten Server lokal auf `127.0.0.1:3100`;
5. führt dieselben Tests mit Desktop Chrome und einem Pixel-7-Viewport aus;
6. lädt bei Fehlern einen kurzlebigen Playwright-Bericht, Screenshots und Traces hoch.

### Harte no-write-Grenzen

Der automatische Lauf:

- arbeitet ausschließlich gegen den lokal gebauten CI-Server;
- startet keine öffentliche Demo;
- legt keinen Nutzer und keinen Workspace an;
- löst keine Zahlung aus;
- führt keine KI-Anfrage aus;
- speichert kein Kontaktwissen und kein Follow-up;
- nutzt ausschließlich synthetische E-Mail-Adressen;
- fängt Login-Fehler und Passwort-Recovery vollständig im Browser ab;
- enthält keine echten Production-Secrets oder Kundendaten;
- fängt das Meta-Script vollständig synthetisch ab und baut im CI-Lauf keine echte Verbindung zu Meta auf;
- prüft, dass keine Conversion-Events oder Eventparameter gesendet werden.

Die Testartefakte werden sieben Tage aufbewahrt. Videos sind deaktiviert. Traces und Screenshots entstehen nur bei Fehlern. Passwörter, Tokens, vollständige Recovery-URLs und Response-Bodies dürfen nicht in Testnamen, Logs oder Artefakten ausgegeben werden.

## Lokale Ausführung

```bash
npm ci
NEXT_PUBLIC_META_PIXEL_ID=2069553844439892 npm run build
npx playwright install chromium
NEXT_PUBLIC_META_PIXEL_ID=2069553844439892 npm run test:e2e
```

Alternativer lokaler Port:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
FANMIND_RUNTIME_SETTINGS_FILE=/tmp/fanmind-browser-e2e-runtime-settings.json \
npm run test:e2e
```

In diesem Fall muss der gebaute FanMind-Server bereits selbst auf dem angegebenen Port
und mit demselben `FANMIND_RUNTIME_SETTINGS_FILE` gestartet worden sein. Andernfalls
darf der zustandsverändernde Daily-Test nicht als gültiger Lauf gewertet werden.

## Deterministischer lokaler Gerhard-Kernablauf

Der zweite automatische Browser-Job schützt den gefrorenen regulären
Gerhard-Ablauf auf echten FanMind-Routen: Landingpage, Login, Dashboard,
Inbox, Fans, Kontaktdetail, KI-Vorschläge, Kopieren, Kontaktwissen,
Follow-up-Erstellung, Abschluss/Wiedereröffnung und Roadmap.

Dieser Lauf verwendet keine externe Umgebung und keine Provider-Zugangsdaten.
Eine strikt bestätigungspflichtige Node-Fixture bindet ausschließlich an
`127.0.0.1`, stellt genau einen synthetischen Nutzer, Workspace, Kontakt und
eine eingehende Nachricht bereit und implementiert nur die für diese Strecke
benötigten Supabase-Auth-/PostgREST-Verträge. Unbekannte Tabellen, Spalten,
Filter, Methoden, Origins, Rollen oder Mutationen schlagen fehl. Die einzigen
zulässigen Datenänderungen sind:

- die eingehende Nachricht als gesehen markieren;
- genau einen Kontaktwissen-Eintrag anlegen;
- genau ein Follow-up anlegen;
- dieses Follow-up einmal abschließen und einmal wieder öffnen.

Die KI-Route ist die einzige im Browser synthetisch erfüllte FanMind-Antwort.
Alle anderen App- und Fixture-Anfragen laufen real gegen den lokalen Build
beziehungsweise die Loopback-Fixture. Fremde Origins werden blockiert; jeder
lokale HTTP-Fehler ab Status 400 sowie jeder unbehandelte Seitenfehler lässt
die Abnahme fehlschlagen. Es wird niemals automatisch eine Nachricht
gesendet.

Der lokale reguläre Kernablauf benötigt zuerst einen Build mit ausschließlich
synthetischen Loopback-Werten:

```bash
FANMIND_CORE_FLOW_FIXTURE_ACK=fanmind-local-synthetic-core-flow \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-core-flow-anon-key \
NEXT_PUBLIC_APP_URL=http://localhost:3100 \
NEXT_PUBLIC_SITE_URL=http://localhost:3100 \
FANMIND_PUBLIC_DEMO_ENABLED=false \
FANMIND_ENABLE_REFERRAL_BILLING=false \
FANMIND_ENABLE_TELEGRAM_SEND=false \
SUPABASE_SERVICE_ROLE_KEY=fanmind-local-core-flow-service-role-key \
npm run build

FANMIND_CORE_FLOW_FIXTURE_ACK=fanmind-local-synthetic-core-flow \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-core-flow-anon-key \
NEXT_PUBLIC_APP_URL=http://localhost:3100 \
NEXT_PUBLIC_SITE_URL=http://localhost:3100 \
SUPABASE_SERVICE_ROLE_KEY=fanmind-local-core-flow-service-role-key \
npm run test:e2e:core-flow
```

Die Fixture enthält ausschließlich synthetische Werte und lebt nur im
Prozessspeicher. `__reset` setzt sie vor jedem Browserlauf auf den festen Seed
zurück; `__state` gibt nur feste Zähler und Mutationscodes aus. Der Job ersetzt
weder die read-only Staging-Abnahme noch Provider-, RLS- oder Production-
Nachweise. Fehlerartefakte bleiben auf die synthetische lokale Strecke
begrenzt und werden sieben Tage aufbewahrt.

## Manuelle read-only Staging-Abnahme

Workflow:

```text
.github/workflows/browser-e2e-staging.yml
```

Konfiguration:

```text
playwright.staging.config.mts
```

Test:

```text
e2e-staging/readonly-critical.spec.ts
```

Dieser Lauf ist bewusst nur manuell, ausschließlich auf `main` ausführbar und
nutzt das GitHub Environment `staging`. Er wird erst ausgeführt, wenn die
getrennten externen Staging-Ressourcen vorhanden sind. Den Supabase-Ursprung
verwendet er unter demselben Secret-Namen wie Readiness, KI und Mobile-Push;
eine zweite Variable mit demselben Wert ist nicht erforderlich.

### Erforderliche Staging-Werte

GitHub Environment Variables:

```text
FANMIND_STAGING_APP_URL
FANMIND_PRODUCTION_SUPABASE_PROJECT_REF
FANMIND_STAGING_E2E_WORKSPACE_ID
FANMIND_STAGING_E2E_CONTACT_ID
FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID
FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID
```

GitHub Environment Secrets:

```text
FANMIND_STAGING_SUPABASE_URL
FANMIND_STAGING_E2E_EMAIL
FANMIND_STAGING_E2E_PASSWORD
FANMIND_STAGING_E2E_SECONDARY_EMAIL
FANMIND_STAGING_E2E_SECONDARY_PASSWORD
```

Beide Nutzer, Workspaces und Kontakte müssen getrennte, ausdrücklich
synthetische Testdaten sein. Beide E-Mail-Adressen müssen im Namen `staging`,
`synthetic` oder `test` enthalten. Die vier UUIDs sind Pflichtwerte und dürfen
sich nicht wiederholen. Der erwartete Supabase-Ursprung muss exakt zum
Staging-Projekt gehören und vom dokumentierten Production-Projekt abweichen.
Die kontrollierte einmalige Erstellung und die Übernahme der sechs
wiederverwendeten Staging-UUIDs ist in
`docs/operations/STAGING_SYNTHETIC_FIXTURES.md` beschrieben.

### Fail-closed Zielgrenze

Die Staging-Konfiguration akzeptiert ausschließlich:

- HTTPS;
- einen Hostnamen mit `staging`;
- niemals `fanmind.ch` oder `www.fanmind.ch`;
- ausschließlich den exakt bestätigten Staging-Supabase-Ursprung;
- die feste Bestätigung `fanmind-staging-readonly`;
- zwei vollständige synthetische Zugangsdaten- und Fixture-Sätze.

Der Staging-Test erlaubt nur:

- Auth-Session-Austausch und expliziten Logout am bestätigten Supabase-Ursprung;
- GET-, HEAD- und OPTIONS-Anfragen ausschließlich am App- oder
  Staging-Supabase-Ursprung;
- Login;
- Dashboard lesen;
- Kontaktliste lesen;
- den jeweils eigenen synthetischen Kontakt direkt über RLS lesen;
- den fremden synthetischen Kontakt in beide Richtungen als unsichtbar
  nachweisen;
- Admin-Sperre und gelöschte Sitzung nach Logout nachweisen.

Jede andere POST-, PATCH-, PUT- oder DELETE-Anfrage wird browserseitig blockiert. Insbesondere sind Registrierung, Demo-Erzeugung, KI-Aufrufe, Kontaktmutation, Kontaktwissen, Follow-ups, Billing und Referral-Aktionen nicht Bestandteil dieses read-only Laufs.

Traces, Screenshots und Videos sind für den authentifizierten Staging-Lauf deaktiviert, damit keine Sitzung oder Kundendarstellung in Artefakten landet.

## Manuelle schreibende Staging-Kern- und CSV-Abnahme

Der Workflow

```text
.github/workflows/browser-e2e-staging-write.yml
```

schließt die lokale Gerhard-Strecke auf dem echten isolierten Staging. Er ist
nur manuell auf dem exakten bereits deployten `main`-Commit ausführbar und
verlangt die Bestätigung `run-staging-core-csv-acceptance`. Production und das
Production-Supabase-Projekt sind als Ziele ausgeschlossen.

Der Lauf erstellt ausschließlich zwei deterministisch markierte, kurzlebige
Kontakte samt einer eingehenden Conversation im bereits markierten
synthetischen Staging-Workspace. Danach prüft er zusammenhängend:

- Owner-Login, Dashboard, Inbox und Kontaktansicht;
- eine reale KI-Standard-Antwort über die Staging-Providerkonfiguration;
- menschliches Kopieren ohne automatische Sendefunktion;
- genau einen Kontaktwissen- und einen offenen Follow-up-Eintrag;
- CSV-Import mit genau einer gültigen, einer doppelten und einer ungültigen
  Zeile;
- Member-Lesezugriff auf CRM-Flächen, sichtbare Owner-Inhalte und fehlende
  Create-, CSV-, KI-, Kontaktwissen-, Follow-up- und direkte JWT-
  Mutationsrechte;
- bidirektionale RLS-Isolation zum sekundären Workspace;
- exakte Datenbankeffekte vor und vollständige Entfernung aller kurzlebigen
  Abnahmedaten danach.

Vor dem Browserlauf prüft der Workflow `/api/version`, den gemeinsamen
read-only Datenbank-Rollout-State, den vollständigen read-only Workspace-
Member-Boundary-Postflight, TLS und das private Passwortfile. Der Boundary-
State muss bereits `verify` sein; `apply` oder `block` beendet die Abnahme vor
jedem Fixture-Write. Den kanonischen, ausschließlich driftrelevanten Rollout-
State hält der Workflow als private Baseline fest. Ein `always()`-Cleanup
läuft auch nach Browser- oder Verifikationsfehlern. Nach einem erfolgreichen
Browserlauf und nachgewiesenem Cleanup wiederholt der Workflow den vollständigen
Member-Boundary- und Datenbank-Postflight, verlangt die unveränderte kanonische
Baseline und prüft unmittelbar vor dem einzigen Acceptance-PASS erneut den
exakten Release-Commit sowie `runtimeEnvironment=staging`. Ein Deploy-Wechsel
oder eine dauerhaft abweichende kontrollierte Datenbank-Rollout-Lage während
der Abnahme kann damit keinen grünen Nachweis erzeugen. Apply, Verify und
Chromium-Abnahme teilen die Concurrency-Gruppe
`fanmind-staging-core-csv-write`. Es gibt keine Screenshots, Videos, Traces
oder hochgeladenen Browserartefakte.

Das Member-Passwort ist kein persistentes Environment-Secret. Der geschützte
Job erzeugt und maskiert es erst im Hosted Runner, bindet beide benötigten
Prozessnamen ausschließlich über `GITHUB_ENV` und lässt einen eng begrenzten
Service-Role-Helper vor der Rotation Adresse, Auth-Fixture-Marker, genau eine
`member`-Membership und den markierten primären Workspace prüfen. Ein
vollständiger Post-`PUT`-Read bestätigt dieselbe Profilbindung, Auth-Identität,
Membership und denselben Workspace erneut. Bei unbestimmtem Providerergebnis
oder Drift versucht der Helper nur auf der zuvor gebundenen Member-UUID eine
neue unbekannte Kompensationsrotation; der Lauf bleibt unabhängig von deren
Erfolg rot. `GITHUB_ENV` wird nur als reguläre Runner-Datei mit einem Link
akzeptiert, über den geöffneten Deskriptor auf exakt `0600` gesetzt und vor
dem Passwort-Append erneut geprüft. Ein
`always()`-Schritt rotiert nach dem Browserlauf auf ein neues, nicht
ausgegebenes Passwort und beweist, dass das zuvor bekannte Passwort mit
`invalid_credentials` abgewiesen wird. Ohne diesen Cleanup kann der finale
Acceptance-PASS nicht erscheinen. Der vollständige Vertrag steht in
`docs/operations/STAGING_EPHEMERAL_MEMBER_CREDENTIAL.md`.
Chromium wird vor der Erzeugung installiert; der Revoke-Schritt leert beide
Prozessaliase per `EXIT`-Trap vor Postflight und Evidence-Cleanup wieder.

Zusätzlich zu den Werten des read-only Laufs benötigt das Environment
`staging`:

```text
FANMIND_STAGING_SUPABASE_PROJECT_REF
FANMIND_STAGING_DB_NAME
```

und diese Secrets:

```text
FANMIND_STAGING_SUPABASE_ANON_KEY
FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY
FANMIND_STAGING_DB_HOST
FANMIND_STAGING_DB_PASSWORD
```

Der Member verwendet ausschließlich die fest gebundene synthetische Adresse
`fanmind-ai-member-staging@example.invalid`. Die Abnahme darf erst nach dem
Fixture-Provisioning und nach Deploy des exakten geprüften Commits gestartet
werden. Für diesen Workflow darf kein persistentes Member-Passwort angelegt
werden; die Owner-/Secondary-Secrets bleiben unverändert.
Ein grüner Repositorytest oder Merge ersetzt den tatsächlichen manuellen Lauf
nicht.

## Positive read-only Admin-Abnahme in Staging

Der vorhandene Browser-Lauf beweist bereits, dass ein normaler synthetischer
Nutzer nicht in den Adminbereich gelangt. Der separate Workflow

```text
.github/workflows/admin-e2e-staging.yml
```

ergänzt die positive Gegenseite: Eine ausdrücklich in
`FANMIND_STAGING_ADMIN_EMAILS` freigegebene, von beiden synthetischen
Standardnutzern getrennte Admin-Identität muss `/admin/billing` und
`/admin/operations` erreichen.

Der Lauf bleibt manuell, auf den exakten geprüften `main`-Commit und das
GitHub Environment `staging` gebunden. Er verwendet denselben
Origin-/Produktions-Ausschluss, dieselben zwei normalen Staging-Fixtures und
denselben Browser-Schreibschutz wie die bestehende read-only Abnahme. Er
klickt keine Admin-Aktion an, führt keine Billing-, Restore- oder
Datenbankmutation aus und erzeugt keine Browserartefakte.

Zusätzlich erforderlich sind zwei geschützte Environment-Secrets:

```text
FANMIND_STAGING_ADMIN_E2E_EMAIL
FANMIND_STAGING_ADMIN_E2E_PASSWORD
```

Die E-Mail muss bereits als bestätigter Nutzer im isolierten
Staging-Supabase-Projekt existieren, in der kommagetrennten Variable
`FANMIND_STAGING_ADMIN_EMAILS` stehen und einen regulären
Staging-Operator-Workspace besitzen. Das Passwort wird nur als GitHub Secret
gespeichert und weder im Workflow noch in der Dokumentation ausgegeben.

Kontrollierter Start:

1. geprüften PR nach `main` mergen;
2. den exakten aktuellen `main`-Commit eintragen;
3. `verify-staging-admin-readonly` bestätigen;
4. nur einen Lauf mit `STAGING_ADMIN_E2E_BOUNDARY=accepted`, getrennten
   Identitäten und vollständig grüner Playwright-Suite akzeptieren.

## Noch externe Abnahme

Der Code für den read-only Staging-Lauf kann unabhängig von den externen Ressourcen geprüft und gemergt werden. Nicht als erledigt gelten bis zur tatsächlichen Bereitstellung:

- eigener HTTPS-Staging-Host;
- separates Supabase-Staging-Projekt;
- synthetischer Staging-Nutzer;
- synthetischer Workspace und Kontakt;
- tatsächlicher manueller Staging-Workflow-Lauf.

Schreibende Referral-, Restore-, RLS- oder Lifecycle-Tests bleiben weiterhin an die vollständige Environment-Grenze aus `docs/operations/ENVIRONMENT_SEPARATION.md` gebunden.

## Fehlerbehandlung

Bei einem fehlgeschlagenen öffentlichen Browser-Gate:

1. Bericht und Trace ausschließlich auf synthetische Daten prüfen;
2. betroffenen Flow lokal reproduzieren;
3. Produktfehler in einem kleinen PR beheben;
4. keine Assertion entfernen, nur um einen echten Fehler zu verdecken;
5. Public-Smokes, Sprachprüfung oder Policy-Tests nicht als Ersatz abschalten.

Bei einem fehlgeschlagenen Staging-Lauf:

1. Ziel- und Credential-Grenze prüfen, ohne Werte auszugeben;
2. bestätigen, dass keine Mutation ausgeführt wurde;
3. externes Staging oder Testdaten korrigieren;
4. niemals auf Production ausweichen;
5. erst danach den manuellen Lauf wiederholen.
