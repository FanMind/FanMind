# FanMind Production-/Staging-Trennung

## Ziel

Schreibende Tests für Stripe, Referral, Restore, Social-Integrationen oder Datenmigrationen dürfen niemals versehentlich gegen `fanmind.ch` oder das Production-Supabase-Projekt laufen.

Die gemeinsame Policy liegt in:

```text
src/lib/environmentBoundaryPolicy.mjs
```

Der ausführbare Preflight lautet:

```bash
npm run environment:preflight
npm run environment:preflight:write
```

## Verbindliche Umgebungen

### Production

- `FANMIND_RUNTIME_ENVIRONMENT=production`
- App-Ziel ausschließlich `https://fanmind.ch` oder `https://www.fanmind.ch`
- eigenes Production-Supabase-Projekt
- Stripe Live nur in Production und niemals in Sandbox-Skripten
- reale Kunden- und Kontaktdaten nur in Production
- nicht-produktive Schreibfreigabe immer `false`

### Staging

- `FANMIND_RUNTIME_ENVIRONMENT=staging`
- eigener Host, beispielsweise `staging.fanmind.ch` oder ein klarer Testhost
- separates Supabase-Projekt mit separatem Auth, Storage und Service-Role-Key
- ausschließlich Stripe Test Mode
- ausschließlich synthetische Testdaten
- eigene Webhook-Ziele und eigene E-Mail-Empfänger
- öffentliche Demo, Billing, Monitor, Fehlertracking und Integrationen zunächst deaktiviert

### Test

- `FANMIND_RUNTIME_ENVIRONMENT=test`
- nur automatisierte oder kontrollierte Testläufe
- separates Supabase-Projekt beziehungsweise vollständig isolierte Fixtures
- keine Production-URLs, -IDs, -Schlüssel oder Kundendaten

### Development

- lokale Entwicklung
- der gemeinsame Policy-Preflight erlaubt keine schreibenden Remote-Tests im Modus `development`
- Remote-Schreibtests müssen ausdrücklich über `staging` oder `test` laufen

## Fünf Bedingungen für schreibende Tests

Ein Lauf mit `--allow-write` wird nur freigegeben, wenn gleichzeitig gilt:

1. `FANMIND_RUNTIME_ENVIRONMENT` ist `staging` oder `test`.
2. Die App-Ziel-URL ist gültig, HTTPS und nicht `fanmind.ch`.
3. Das Ziel-Supabase-Projekt ist eindeutig identifiziert und unterscheidet sich von `FANMIND_PRODUCTION_SUPABASE_PROJECT_REF`.
4. `FANMIND_ENABLE_NON_PRODUCTION_WRITES=true` ist bewusst gesetzt.
5. `FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY` ist exakt gesetzt.

Fehlt eine Bedingung, endet der Preflight mit Fehlerstatus.

## Supabase-Projektvergleich

Bei Standard-Supabase-URLs wird die Projektreferenz aus

```text
https://<project-ref>.supabase.co
```

abgeleitet. Bei Custom Domains muss zusätzlich gesetzt werden:

```text
FANMIND_TARGET_SUPABASE_PROJECT_REF=<staging-oder-test-ref>
```

Der Production-Vergleichswert wird ausschließlich als Projektreferenz hinterlegt:

```text
FANMIND_PRODUCTION_SUPABASE_PROJECT_REF=<production-ref>
```

Die Projektreferenz ist kein Service-Role-Key. Trotzdem wird im Preflight nur der Status `identified/missing/match` ausgegeben, nicht der konkrete Wert.

## Sichere Startvorlage

Repository-Vorlage:

```text
.env.staging.example
```

Vorgehen:

1. Datei außerhalb von Git nach `.env.staging.local` oder in einen Secret Store kopieren.
2. ausschließlich Staging-/Testwerte eintragen;
3. sämtliche Feature- und Schreibschalter zunächst auf `false` belassen;
4. Read-only-Preflight ausführen;
5. erst für einen konkreten kontrollierten Test beide Schreibfreigaben setzen;
6. nach dem Test sofort wieder deaktivieren.

## Read-only-Prüfung

```bash
set -a
source /sicherer/pfad/.env.staging.local
set +a
npm run environment:preflight
```

Ein Read-only-Lauf verlangt:

```text
FANMIND_ENABLE_NON_PRODUCTION_WRITES=false
```

Er gibt keine Schlüssel, URLs oder Projektreferenzen aus.

## Kontrollierte Schreibfreigabe

Nur für einen vorher beschriebenen Testfall:

```text
FANMIND_ENABLE_NON_PRODUCTION_WRITES=true
FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY
```

Danach:

```bash
npm run environment:preflight:write
```

Erst bei `ENVIRONMENT_BOUNDARY=OK` darf das nachgelagerte Schreibskript gestartet werden.

Nach dem Test:

```text
FANMIND_ENABLE_NON_PRODUCTION_WRITES=false
FANMIND_NON_PRODUCTION_WRITE_ACK=
```

## Datenregeln

In Staging/Test verboten:

- Kopien realer Fan-Nachrichten oder Kontaktwissen;
- Production-Datenbank-Dumps ohne vorherige vollständige Anonymisierung;
- Production-Storage-Artefakte mit personenbezogenen Inhalten;
- Live-Stripe-Schlüssel oder echte Zahlungsmittel;
- Production-Service-Role-Key;
- Production-Webhooks oder reale Social-Page-Tokens;
- Versand an echte Kunden/Fans.

Erlaubt:

- synthetische Demo-Kontakte;
- Stripe-Testkarten und Test-Webhooks;
- dedizierte Staging-E-Mail-Empfänger;
- isolierte Restore-Drills mit verschlüsselten beziehungsweise anonymisierten Testartefakten;
- kontrollierte KI-Tests ohne reale personenbezogene Inhalte.

## Deployment-Grenze

Der manuelle Staging-Deploy liegt in `.github/workflows/deploy-staging.yml`. Er
läuft ausschließlich auf einem separat mit `fanmind-staging` gekennzeichneten
Self-Hosted Runner, verwendet
`/var/www/fanmind-staging/.env.production` mit ausschließlich Staging-Werten
und darf niemals auf dem Production-Runner oder im Production-Pfad laufen. Er
deployt den unveränderlichen Commit, der den Workflow ausgelöst hat, sofern er
von `origin/main` erreichbar ist. Vor Installation und Build entfernt er alte
ignorierte oder unversionierte Build-Dateien mit Ausnahme der geschützten
`.env.production`, bindet den Next.js Deployment-Identifier an diesen Commit
und führt vor dem separaten systemd-Neustart den Staging-Preflight aus. Der
Anwendungsprozess wird vom Host-Service-Manager mit sauberen Runtime-Dateien
gestartet und ist deshalb nicht an die Lebensdauer des Self-Hosted-Runner-Jobs
gebunden. Der serverseitige Shared-Rate-Limit-Secret liegt getrennt vom
Release-Baum unter `/etc/fanmind-staging/runtime-secrets.env`, wird lokal
erzeugt und bei Re-Provisionierung bewahrt.

Die einmalige Host-Vorbereitung liegt getrennt davon in
`.github/workflows/provision-staging-host.yml`. Nur dieser manuelle,
`main`-gebundene Bootstrap darf den bestehenden Exoscale-Production-Runner
verwenden, um den separaten Betriebssystemnutzer `fanmind-staging`, den
Release-Pfad `/var/www/fanmind-staging`, die privaten Runtime-Dateien, den
systemd-Dienst `fanmind-staging.service`, den nginx-vHost und einen zweiten
Runner-Dienst mit exklusivem Label `fanmind-staging`
anzulegen. Er führt keinen Staging- oder Production-Deploy aus und darf den
Production-Checkout, die Production-ENV sowie den PM2-Prozess `fanmind` nicht
verändern. Der kurzlebige Runner-Registrierungstoken lebt ausschließlich als
GitHub-Environment-Secret und wird nach der Registrierung gelöscht.

Der spätere Staging-Deploy verwendet einen kurzlebig authentifizierten
`actions/checkout` mit `persist-credentials: false` und synchronisiert nur den
exakten Release-Baum ohne `.git` in den Staging-Pfad. Damit benötigt der
getrennte Linux-Nutzer keine dauerhaften Repository-Zugangsdaten.

`.github/workflows/enable-staging-tls.yml` darf erst laufen, wenn
`staging.fanmind.ch` auf die öffentliche IPv4-Adresse desselben
Exoscale-Hosts zeigt. Der Workflow vergleicht DNS und Hostadresse vor Certbot
und verwendet ausschließlich das bereits registrierte Certbot-Konto; er nimmt
keine neue Vertrags- oder Kontoregistrierung vor.
Ein wiederholter Host-Provisionierungslauf bewahrt eine bestehende
Staging-TLS-Konfiguration nur dann, wenn Zertifikat, privater Schlüssel,
exakter Hostname und der isolierte Upstream auf Port `3001` gemeinsam belegt
sind. Er überschreibt sie nicht mit dem HTTP-Bootstrap-vHost; partielle oder
abweichende TLS-Zustände stoppen vor dem nginx-Reload.

Der bestehende Production-Deploy darf niemals setzen:

```text
FANMIND_ENABLE_NON_PRODUCTION_WRITES=true
FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY
```

Die Policy-Tests prüfen diese Grenze im Repository.

## Referral-Sandbox

Referral-Schreibtests benötigen zusätzlich zu den bestehenden Stripe-/Referral-Bedingungen auch den gemeinsamen Umgebungs-Preflight. Dadurch reichen ein Testschlüssel und eine fremde URL allein nicht mehr aus; das Supabase-Ziel muss nachweislich von Production getrennt sein.

## Restore-Drill

Ein Datenbank-Restore benötigt zusätzlich zur gemeinsamen Schreibgrenze den zweistufigen Zielschutz aus `docs/operations/RESTORE_DRILL.md`:

```bash
npm run restore:preflight
npm run restore:database:drill -- /sicherer/pfad/fanmind-database-<timestamp>.dump
```

Der Restore-Preflight bindet die tatsächlichen kanonischen `PGHOST`-, `PGPORT`-, `PGDATABASE`- und `PGUSER`-Werte an eine unabhängig dokumentierte Zielbestätigung und sperrt jeden Treffer auf dem Production-Datenbankhost unabhängig von Port, Datenbank oder Benutzer. Numerische IPv4-/IPv6-Adressen werden kanonisiert; mehrdeutige Legacy-IPv4-Formen sind gesperrt. Der Runner öffnet geschützte Nicht-Symlink-Quellen einmal, prüft Eigentümer und Rechte, erstellt private Dump-/Passfile-Snapshots und verwendet genau diese Dateien für `pg_restore --list` und den transaktionalen Restore. Ein erfolgreicher allgemeiner `environment:preflight:write` allein reicht ausdrücklich nicht aus.

Ein Restore-Drill darf erst beginnen, wenn:

- der gemeinsame Schreib-Preflight grün ist;
- Ziel-Supabase und Ziel-Storage separat bestätigt wurden;
- keine Production-Daten überschrieben werden können;
- ein Rückbauplan und eine Löschung der Testdaten dokumentiert sind.

Siehe zusätzlich:

```text
docs/operations/RESTORE_DRILL.md
```
