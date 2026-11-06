# Triggerfunktionen – kontrollierter Production-Härtungspfad

## Abnahme am 10. September 2026

Der geschützte Apply ist abgeschlossen: Run `34496892707` / Job
`102937525772` meldet `applied`. Der getrennte Verify `34497099991` /
`102938240926` meldet `verified`. Sämtliche Production-Audits davor/danach
bestätigen Release `9a6e9d016cb0928e58b89c6c2d5b6183379c50ed`.
Die unabhängige Supabase-Advisor-Prüfung um 15:38:41 UTC findet keine der
bisherigen drei Search-Path- und zwei Browser-EXECUTE-Warnungen mehr.

Dieser begrenzte Härtungsschritt ist produktiv abgenommen; ein erneuter Apply
ist nicht erforderlich. Leaked-Password-Protection, Workspace-Vertrag und
Meta-Abnahme bleiben getrennt offen. Vollständiger Nachweis:
`project-memory/EXECUTION_RECEIPTS.md`,
`RECEIPT-FM-SEC-001-PRODUCTION-HARDENING-20260910`.

## Ziel und aktuelle Grenze

Dieser Pfad übernimmt ausschließlich die bereits im isolierten Staging
abgenommene Härtung für vier interne Triggerfunktionen nach Production. Er
ist vom Staging-Apply, vom normalen Web-Deploy und von generischen Supabase-
Migrationen getrennt.

Der normale Production-Deploy installiert nur root-eigenen Runner,
festgeschriebene SQL-Datei, Journal-Prüfer und eine nicht aktivierte
`oneshot`-Unit. Er startet weder Verify noch Apply. Ein Merge oder Deployment
bewirkt daher **keine automatische Datenbankänderung**.

Kontrollierte SQL-Datei:

```text
supabase/controlled/20260806203023_harden_trigger_function_privileges.sql
SHA-256: 6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132
```

## Abgedeckte Production-Advisories

Erforderlich vorhanden:

```text
public.set_social_connections_updated_at()
public.set_referral_updated_at()
public.set_demo_start_session_updated_at()
```

Optional in älteren Umgebungen:

```text
public.trim_conversation_messages_to_latest_50()
```

Nach einem erfolgreichen Apply gilt für jede vorhandene Funktion:

- `search_path=pg_catalog, pg_temp`;
- kein direktes `EXECUTE` für `PUBLIC`, `anon` oder `authenticated`;
- bestehende Triggerzuordnungen bleiben erhalten;
- keine Tabellenzeile, kein CRM-Inhalt und keine RLS-Policy wird verändert.

Der optionale alte Retention-Trigger bleibt, solange er noch vorhanden ist,
`SECURITY DEFINER`, ist aber nicht mehr als Browser-RPC ausführbar. Seine
spätere Entfernung durch den getrennten Conversation-History-Rollout gehört
nicht zu diesem Production-Control.

## Installierte Sicherheitsgrenzen

Der Production-Runner:

- läuft ausschließlich root-eigen über eine gehärtete `oneshot`-Unit;
- bindet das Production-Supabase-Projekt an `NEXT_PUBLIC_SUPABASE_URL` sowie
  den vorhandenen Backup-Datenbankhost und den projektqualifizierten Benutzer;
- lehnt Connection-URLs, `PGPASSWORD`, `PGHOSTADDR`, libpq-Services und andere
  Umleitungen ab;
- verlangt eine root-eigene Passwortdatei mit Modus `0600` unter
  `/etc/fanmind-backup/` und arbeitet nur mit einem privaten Snapshot;
- prüft vor jedem Datenbankzugriff den installierten Release-Commit gegen
  `https://fanmind.ch/api/version`;
- akzeptiert ausschließlich die checksum-festgeschriebene, transaktionale
  SQL-Datei ohne Daten-DML, neue Objekte, Grants oder Löschoperationen;
- führt vor und nach dem Apply eigene read-only Katalogprüfungen mit kurzem
  Statement-Timeout aus;
- gibt nur strukturierte, allowlist-geprüfte Status- und Fehlercodes aus.

Der GitHub-Workflow läuft nur auf `main`, im geschützten Environment
`production`, auf dem vorhandenen `fanmind-prod`-Runner und für den exakt
angegebenen Live-Commit. Vor und nach jeder Aktion muss der vollständige
read-only Production-Audit einschließlich Backup-Freshness grün sein.

## Offline-Prüfung

```bash
npm run db:trigger-function-hardening:production:check
```

Diese Prüfung verbindet sich mit keiner Datenbank. Sie validiert ausschließlich
Pfad, Größe, SHA-256 und den engen SQL-Vertrag.

## Read-only Verify

Workflow:

```text
FanMind Trigger Function Hardening Production Control
```

Eingaben:

```text
action: verify
confirmation: trigger-function-hardening-production-verify
expected_commit: <exakter aktueller main-/Production-Commit>
```

Der Verify ändert nichts. Vor dem ersten Apply muss er mit dem festen Code
`hardening_not_ready` stoppen, wenn der alte Zustand noch vorhanden ist. Nach
dem Apply muss dieselbe Aktion vollständig grün sein.

## Expliziter Apply

Der Apply ist eine separate Production-Datenbankmutation und darf erst nach
erneuter ausdrücklicher Freigabe gestartet werden:

```text
action: apply
confirmation: trigger-function-hardening-production-apply
expected_commit: <exakter aktueller main-/Production-Commit>
```

Der Runner akzeptiert nur zwei Zustände:

- bereits vollständig gehärtet → `already_applied`, ohne erneute Mutation;
- exakt zulässiger Altzustand → transaktionaler Apply und vollständiger
  read-only Postflight.

Fehlende Funktionen, fehlende Triggerzuordnungen, unerwartete Signaturen,
abweichende Connection-Bindungen, Checksum-Drift, falsche Berechtigungen oder
ein abweichender Live-Commit führen fail-closed zum Abbruch.

## Verbindliche Reihenfolge

1. PR und vollständige CI für Runner, Workflow, Unit, Prüfer und Dokumentation.
2. Merge und Production-Deploy; dadurch werden nur Kontrollartefakte
   installiert.
3. Production-Commit und read-only Audit bestätigen.
4. Aktuelle Supabase-Advisories als Vorher-Nachweis festhalten.
5. Separaten Apply ausdrücklich freigeben und einmal ausführen.
6. Read-only Verify auf demselben Commit ausführen.
7. Supabase-Security-Advisories erneut prüfen: die drei `search_path`-Warnungen
   und beide Browser-`EXECUTE`-Warnungen müssen verschwunden sein.
8. Ergebnis ohne Secrets, Hosts, Benutzer oder Kundenwerte im Finishline-Issue
   dokumentieren.

Leaked-Password-Protection bleibt eine getrennte Supabase-Auth-
Kontoeinstellung. Die absichtlichen `RLS enabled/no policy`-Informationen für
service-only Tabellen werden nicht durch künstliche Browser-Policies
„behoben“.
