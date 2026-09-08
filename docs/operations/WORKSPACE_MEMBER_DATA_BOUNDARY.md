# Workspace-Member-Datengrenze

Status: `SCHEMA_VERIFIED`; reale Browser-Abnahme weiterhin offen.

Der gemeinsame read-only Staging-Rollout `34267504075` / Job `102200475242`
bestätigt am 8. September 2026 auf geprüftem `main` `a1bde387` den vollständigen
Datengrenzen-Postflight mit `WORKSPACE_MEMBER_BOUNDARY=verify`. Ein separater
Katalogabgleich bestätigt den kanonischen Safe-Dashboard-RPC einschließlich
seiner fünf Felder, festem Suchpfad, `row_security=on` und fehlendem
`PUBLIC`-/`anon`-EXECUTE. Dies belegt den aktuellen Schemazustand, keine neue
Apply-Ausführung oder reale Chromium-Abnahme. Production bleibt als Ziel
dieses Staging-Controls ausgeschlossen. Siehe FM-EV-038.

## Ziel

Der Control
`supabase/controlled/20260816120000_workspace_member_data_boundary.sql`
schließt vier getrennte Grenzen:

1. Authentifizierte Teammitglieder lesen nicht mehr die volle
   `workspaces`-Zeile mit Billing-, Stripe-, Invoice-, Steuer-, Adress- und
   serververwalteten Testfeldern. Sie erhalten ausschließlich die Projektion
   `workspace_id`, `workspace_name`, `plan_id`, `membership_role` und
   `member_processing_allowed` aus dem parameterlosen RPC
   `get_current_workspace_member_safe_dashboard()`.
   Die administrative `workspace_analysis_settings`-Zeile mit Legal-Basis,
   Transparenz-, AVV-, Retention-, Betroffenenrechts- und Bestätigerfeldern
   wird ebenfalls Owner-only.
2. Direkte JWT-Mutationen auf `contacts`, `memories`, `followups`,
   `conversations`, `conversation_messages`, `conversation_summaries`,
   `contact_reply_targets`, `ai_usage_events`, `content_sources`,
   `fan_analysis_reports`, `contact_ai_profiles` und
   `workspace_voice_profiles` benötigen zugleich Workspace-Ownership und den
   kanonischen aktiven Processing-Vertrag. Bestehende Member-Reads bleiben
   unverändert.
3. `social_connections` ist für Browser nur durch den Owner lesbar. Der
   Browser erhält exakt die dokumentierten nicht geheimen Statusspalten und
   keinerlei INSERT-, UPDATE-, DELETE- oder Secret-Spaltenrechte.
   `page_access_token_encrypted` bleibt ausschließlich serverseitig.
4. Terminale Billing-Zustände gewinnen immer gegen Override, Grace und
   temporäre Freigaben. Ein temporärer Demo-Zugang ist nur mit einer
   serververwalteten, noch gültigen DB-Expiry berechtigt. Client-editierbare
   Auth-Metadaten sind keine Entitlement-Quelle.

## App-first-Vertrag

Die Anwendung bleibt vor und nach dem SQL-Apply kompatibel:

- Nur bei der eindeutig fehlenden Safe-RPC-Funktion lädt der Webserver nach
  bereits eindeutig geprüfter Membership mit `service_role` intern exakt die
  für die Processing-Auswertung erforderlichen Workspace-Felder. An Browser,
  Renderer und DTO gelangen trotzdem nur die fünf sicheren Projektionsfelder.
  Andere RPC-Fehler bleiben fail-closed.
- Mobile verwendet beim exakt fehlenden RPC höchstens `id,name,plan_id` für
  die bereits gebundene Workspace-ID und setzt Processing fail-closed auf
  `false`. Nach dem SQL-Apply greift der Safe-RPC.
- Web und Mobile zeigen Membern CRM-Daten im Nur-Lese-Modus. Create, Edit,
  Archive, Merge, CSV, Memory-/Follow-up-Speichern, Statuswechsel, KI-Analyse,
  Reply-Erzeugung und Connector-Aktionen bleiben verborgen beziehungsweise
  lokal blockiert. Sämtliche Web-Mutations- und KI-Routen autorisieren darüber
  hinaus explizit den aktiven Owner statt des Member-Read-Kontexts.
- Low-Level-Facebook-/Instagram-Sync und Diagnose sind `server-only` Services.
  Die beiden clientimportierbaren Channel-Actions enthalten keine
  caller-gelieferten Connection-Objekte und reautorisieren Owner plus aktives
  Processing vor jedem Aufruf.
- Vollständige Member-Schreibrechte dürfen nicht durch einen erfolgreichen
  RLS-Postflight aktiviert werden. Dafür ist ein gesondert geprüfter atomarer
  DB-RPC-Vertrag erforderlich.

## Offline-Prüfung und Prüfsumme

```bash
npm run db:workspace-member-data-boundary:check
node --test tests/workspace-member-data-boundary.test.mjs \
  tests/workspace-member-data-boundary-staging.test.mjs
```

Der Offline-Modus schreibt keine Datenbank und erwartet für den kontrollierten
SQL-Stand SHA-256
`aae2930ad9a0f1561c039a62546c86f2ce81363c136d5dba02806e9b0c44ed00`.
`--verify` und `--apply` sind absichtlich getrennt und funktionieren nur mit
dem vollständigen Staging-, Commit-, TLS-, Ziel- und Bestätigungsvertrag.

## GitHub-Environment `staging`

Erforderliche Variablen:

- `FANMIND_STAGING_APP_URL`
- `FANMIND_STAGING_SUPABASE_PROJECT_REF`
- `FANMIND_PRODUCTION_SUPABASE_PROJECT_REF`
- `FANMIND_STAGING_DB_NAME`

Erforderliche Secrets:

- `FANMIND_STAGING_SUPABASE_URL`
- `FANMIND_STAGING_DB_HOST`
- `FANMIND_STAGING_DB_PASSWORD`

Der DB-Nutzer wird ausschließlich als
`postgres.<FANMIND_STAGING_SUPABASE_PROJECT_REF>` abgeleitet. Zulässig ist nur
der IPv4-kompatible Supabase-Session-Pooler auf Port `5432`, TLS
`verify-full` und das eingecheckte, geprüfte Supabase-Root-CA. Connection-URLs,
`PGPASSWORD`, `PGOPTIONS`, Service-Dateien sowie Client-Zertifikat- oder andere
libpq-Zielumleitungen werden abgewiesen. Das Passwort liegt nur kurz in einem
privaten `PGPASSFILE` mit Modus `0600` und wird im Always-Cleanup entfernt.

Das Environment muss Schutzregeln und den nötigen manuellen Reviewer besitzen.
Die Workflows erhalten nur `contents: read`; sie besitzen keine Production-
Credentials und leiten den Production-Host allein aus dem nicht geheimen
Production-Projekt-Ref als Ausschlussanker ab.

## Sichere Reihenfolge

1. Den exakt geprüften `main`-Commit zuerst auf isoliertes Staging deployen.
   `/api/version` muss genau diesen `releaseCommit` und
   `runtimeEnvironment=staging` liefern; `/api/health` muss alle öffentlichen
   Pflichtkomponenten als healthy bewerten. Der derzeitige alte Live-App-Stand
   ist daher ein harter Apply-Blocker.
2. Den read-only Rollout-State ausführen. Nur
   `STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=apply` bei vollständig
   abwesendem Control oder `verify` bei vollständig gültigem Control ist
   zulässig; `block` beendet den Rollout.
3. Workflow `FanMind Workspace Member Data Boundary Staging Apply` auf genau
   diesem `main`-Commit mit Bestätigung
   `apply-workspace-member-data-boundary` ausführen.
4. Danach den separaten Workflow
   `FanMind Workspace Member Data Boundary Staging Verify` mit Bestätigung
   `verify-workspace-member-data-boundary` ausführen.
5. Erst nach beiden grünen DB-Nachweisen den realen Workflow
   `FanMind Staging Core and CSV Acceptance` mit
   `run-staging-core-csv-acceptance` ausführen. Dieser prüft den Boundary-
   Postflight vor Fixture-Writes, Owner-/Member-/KI-/CSV-Verhalten in echtem
   Chromium, vollständiges Cleanup und denselben Postflight samt Release-Bindung
   danach erneut.
6. Abschließend den separaten Verify-Workflow noch einmal ausführen und die
   festen PASS-Marker als externen Staging-Nachweis archivieren.

Apply, Verify und Chromium-Abnahme teilen die Concurrency-Gruppe
`fanmind-staging-core-csv-write`; sie laufen nicht parallel.

## Preflight und transaktionaler Apply

Vor dem ersten DDL prüft der Runner in einer eigenen read-only Transaktion:

- Zielrolle ist exakt `postgres`; `anon`, `authenticated` und `service_role`
  existieren;
- der Control steht nicht im generischen Migrationsledger, der kontrollierte
  server-owned-Prerequisite-Beleg dagegen exakt als
  `20260809141141 / workspace_server_owned_columns_controlled` schon;
- `anon` und `authenticated` besitzen kein `CREATE` im Schema `public`;
- alle 16 Zieltabellen existieren als RLS-geschützte Tabellen;
- die sieben serververwalteten Workspace-Spalten, das zehnspaltige Owner-
  Update-Allowlisting und die benötigte Membership-/Member-Read-Basis sind
  vollständig;
- alle drei Control-Funktionen sind entweder gemeinsam abwesend oder gemeinsam
  vorhanden und gehören `postgres`; ein Teilzustand blockiert;
- alle erforderlichen Social-Spalten einschließlich der verschlüsselten
  Tokenspalte existieren.

Der SQL-Control selbst läuft vollständig zwischen `BEGIN` und `COMMIT`, mit
Lock- und Statement-Timeouts, internem Preflight, Vertrags-Selbsttests und
vollständigem internem Postflight. Policy-DDL, Funktionen und ACL-Änderungen
sind PostgreSQL-transaktional: Jeder Fehler vor `COMMIT` rollt den gesamten
Schritt zurück. Eine sessionweite Advisory Lock serialisiert konkurrierende
Apply-Versuche.

Der Control ist auf einem bereits exakt angewendeten Stand wiederholbar:
Policies werden deterministisch ersetzt, Funktionen per `CREATE OR REPLACE`
festgeschrieben und ACLs zuerst entzogen und dann exakt vergeben. Ein
Teilzustand oder fehlende Voraussetzung wird nicht automatisch ergänzt. Der
Schritt schreibt absichtlich keinen generischen Migrationsledger-Eintrag.

## Externer Postflight und akzeptierte Marker

Nach erfolgreichem `COMMIT` startet der Runner eine neue read-only Transaktion.
Sie prüft unter anderem:

- RLS und exakte restriktive Policies für Workspace, Analysis, 36 geschützte
  Mutationen und vier Social-Befehle;
- exakte Social-Spaltenrechte, kein Secret-Read und vollständiges
  `service_role`-CRUD;
- exakte Funktionssignaturen, Owner `postgres`, Sprache, Volatilität,
  Security-Modus, `search_path`, `row_security`, Funktionskörper und direkte
  EXECUTE-ACLs;
- terminale und aktive Processing-Vertragsfälle.

Nur diese Kombination belegt den Apply:

- `WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS`
- `WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY=completed`
- `WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS`
- `WORKSPACE_MEMBER_DATA_BOUNDARY_READY=APPLIED_AND_VERIFIED`

Der getrennte Verify muss
`WORKSPACE_MEMBER_DATA_BOUNDARY_READY=VERIFIED_APPLIED` liefern. Für die reale
Browser-Abnahme sind zusätzlich
`STAGING_CORE_CSV_MEMBER_BOUNDARY_POSTFLIGHT=PASS`,
`STAGING_CORE_CSV_FINAL_RELEASE=PASS` und
`STAGING_CORE_CSV_ACCEPTANCE=PASS` nötig. Ein Repositorytest, Merge oder
Offline-Check ersetzt keinen dieser externen Nachweise.

## Fehler und Recovery

- `preflight_failed`: kein DDL gestartet; Voraussetzungen korrigieren und den
  Rollout-State erneut read-only prüfen.
- `apply_outcome_indeterminate`: niemals blind erneut anwenden. Zuerst den
  getrennten Verify-Workflow starten. Bei dessen PASS ist der Apply bereits
  vollständig; bei FAIL den realen DB-Zustand read-only untersuchen.
- `applied_unverified`: der Commit-Marker fehlt nicht, aber der externe
  Postflight scheiterte. Keine automatische Wiederholung oder Down-Migration;
  getrennten Verify und manuellen read-only Katalogaudit ausführen.
- `postflight_failed`: Verify hat Drift oder einen nicht angewendeten Stand
  gefunden. Chromium-Abnahme und Member-Aktivierung bleiben blockiert.

Es gibt bewusst keine automatische Down-Migration: Die App-first-Version ist
mit beiden Schema-Zuständen kompatibel. Bei einem Fehler vor `COMMIT` ist der
Apply vollständig zurückgerollt. Nach bestätigtem Commit bleibt die
App-first-Version aktiv, bis Ursache und sicherer Forward-Fix geprüft sind.
Niemals gegen Production oder ein Restore-Ziel anwenden.

## Bekannte Restgrenze

Einige bestehende `service_role`-Actions prüfen Autorisierung und mutieren in
getrennten Requests. Diese TOCTOU-Grenze wird durch Member-Nur-Lesen und die
direkten RLS-Policies nicht erweitert, ist aber kein atomarer Schreibvertrag.
Sie bleibt als gesonderter P2-Folgepunkt offen; neue Member-Schreibpfade dürfen
darauf nicht aufgebaut werden.
