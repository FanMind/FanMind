# Meta Conversation Catch-up Queue – kontrollierter Staging-Pfad

## Zweck und Aktivierungsgrenze

Inbound-Facebook-/Instagram-Webhooks speichern die konkrete Nachricht
idempotent und führen im HTTP-Request keine Profil- oder Historienabfrage bei
Meta aus. Bei ausdrücklich aktiviertem Flag bündelt der Webhook nur einen
workspace-, connection-, plattform- und thread-gebundenen Auftrag. Ein
getrennter Worker verarbeitet ihn später.

Der SQL-Schritt
`supabase/controlled/20260811230000_meta_conversation_catchup_queue.sql` wird
von keinem normalen Web-Deploy ausgeführt. Die Vorbereitung installiert,
aktiviert oder startet auch den Worker nicht. Production ist ausgeschlossen.

Punktstand 26. August 2026: Queue-Tabelle, Indizes und server-only Funktionen
wurden im isolierten Staging als vorhanden/read-only korrekt beobachtet. Der
kontrollierte Schritt liegt absichtlich nicht im Supabase-Migrationsledger.
Sein vollständiger Tabellen-/Index-/ACL-/Funktions-Postflight ist deshalb die
maßgebliche Zustandsgrenze; bloße Tabellenpräsenz reicht nicht.

## Offline-Prüfung

```bash
npm run db:meta-catchup-queue:check
```

Der Runner akzeptiert nur den bytegenau festgeschriebenen SHA-256-Wert und
prüft den Tabellen-, RLS-, Coalescing-, Lease-, Retry-/Dead-Letter- und
service-role-only-Vertrag.

## Manuelle Staging-Kontrollen

Beide Workflows laufen ausschließlich per `workflow_dispatch`, auf `main`, für
den exakten `reviewed_commit`, im GitHub-Environment `staging`, über TLS und
gegen eine explizit von Production abweichende Supabase-Projektreferenz.
Die getrennte Conversation-Continuation-Migration ist keine Nebenwirkung
dieses Queue-Schritts. Sie muss zuvor über
docs/operations/META_CONVERSATION_CONTINUATION_STAGING.md für denselben Commit
und dasselbe Ziel über Ledger und Objekte als vollständig klassifiziert und
read-only nachgeprüft sein.

1. Nach Review und Merge zuerst den gemeinsamen read-only Rollout-State für
   denselben Commit und dasselbe Ziel ausführen. Nur wenn er Queue-Objekte und
   vollständigen Postflight konsistent als `apply` klassifiziert, den Workflow
   `FanMind Meta Catch-up Queue Staging Apply` mit dem exakten Main-Commit und
   der Bestätigung `apply-meta-catchup-queue` starten. Vor dem schreibenden
   Schritt führt er den gemeinsamen Staging-Rollout-Zustand read-only aus und
   verlangt exakt `STAGING_DATABASE_ROLLOUT_META_CATCHUP=apply` sowie
   `STAGING_DATABASE_ROLLOUT_STATE=PASS`.
2. Nur `META_CATCHUP_QUEUE_APPLY=completed`,
   `META_CATCHUP_QUEUE_POSTFLIGHT=PASS`,
   `META_CATCHUP_QUEUE_POSTFLIGHT_TRANSACTION=ROLLED_BACK` und
   `SECRETS_WURDEN_NICHT_AUSGEGEBEN=true` akzeptieren.
3. Bei `verify` den Apply überspringen; bei erfolgreichem bedingtem Apply
   anschließend `FanMind Meta Catch-up Queue Staging Verify` mit demselben
   Commit und `verify-meta-catchup-queue` ausführen. Dieser Lauf ist read-only.

Meldet der gemeinsame Zustand für die Queue `verify`, ist sie bereits
vollständig vorhanden und darf nicht erneut angewendet werden. `block` oder
eine fehlende/exakt abweichende Ergebniszeile stoppt vor dem ersten
schreibenden `psql`-Aufruf.

Der Postflight prüft Metadaten, RLS/`FORCE RLS`, zusammengesetzte
Workspace-Fremdschlüssel, den partiellen Coalescing-Index, fehlende
Browserrechte, die nur lesende direkte Service-Role-Berechtigung und die drei
ausschließlich für `service_role` ausführbaren Funktionen. Die Prüfung läuft
in einer zurückgerollten Transaktion.

## Rollback-only Queue-Acceptance

Der manuelle Workflow `FanMind Meta Catch-up Queue Staging Acceptance` ist
vorbereitet. Er darf erst nach einer frischen vollständigen Ledger-/Objekt-
Klassifikation der ledger-geführten Voraussetzungen sowie der vollständigen
Queue-Objektklassifikation und dem read-only Postflight (mit Apply nur bei
`apply`) mit dem exakten Main-Commit sowie der Bestätigung
`run-meta-catchup-queue-staging-acceptance` gestartet werden. Der gemeinsame
Rollout-State muss exakt `STAGING_DATABASE_ROLLOUT_META_CATCHUP=verify` und
`STAGING_DATABASE_ROLLOUT_STATE=PASS` liefern.

Der Lauf akzeptiert ausschließlich den speziell markierten synthetischen
Workspace der Workspace-Processing-Acceptance. Er sperrt die Queue während des
Tests, stoppt bei bereits offenen Staging-Aufträgen und führt in einer einzigen
vollständig zurückgerollten Transaktion folgende Nachweise aus:

- doppelte Enqueues ergeben genau einen offenen Auftrag und erhöhen die
  Generation;
- ein zweiter Worker erhält während einer aktiven Lease keinen Auftrag;
- neue Generationen während eines Claims bleiben nach erfolgreichem Abschluss
  als `pending` erhalten;
- eine abgelaufene Lease wird von einem anderen Worker übernommen;
- fünf begrenzte Retry-Abschlüsse enden mit allowlist-festem Fehlercode in
  `dead_letter`;
- falscher Workspace, getrennte Connection, ungültiger Kontakt und ungültige
  Plattform scheitern fail-closed;
- `anon` und `authenticated` können weder die Queue-Tabelle lesen noch die
  Enqueue-Funktion ausführen;
- synthetischer Kontakt, Connections und Queuezeilen sind nach `rollback`
  vollständig verschwunden.

Der Runner ruft keine Meta-API auf, erzeugt keine Analyse, versendet nichts und
gibt weder synthetische IDs noch Credentials aus. Offline lässt sich sein
Vertrag ohne Datenbankzugriff prüfen:

```bash
npm run meta:catchup-queue:staging:check
```

Die synthetische Acceptance ist weiterhin offen und darf keine realen
Kunden-, Meta- oder Production-Daten verwenden. Die gleichzeitige
Mehrprozess-Abnahme mit laufendem Worker, Entitlement-/Disconnect-Abbruch über
den internen Endpunkt und der Webhook-/Meta-Testkonto-E2E bleiben getrennte
Gates. Reale Meta-Testkonten und rechtliche Freigaben werden von dieser
synthetischen Datenbank-Acceptance ausdrücklich nicht ersetzt.

## Worker-Vorbereitung und Aktivierung

Die Vorlagen liegen unter:

- `scripts/operations/meta-catchup-worker.mjs`
- `ops/systemd/fanmind-meta-catchup-worker.service`
- `ops/systemd/fanmind-meta-catchup-worker.env.example`

Erst nach vollständig grüner Staging-Acceptance:

1. einen mindestens 32 Zeichen langen, getrennten
   `FANMIND_META_CATCHUP_WORKER_SECRET` ausschließlich in App und Worker
   hinterlegen;
2. Worker-Datei und Unit auf dem isolierten Staging-Host installieren, aber
   noch nicht aktivieren;
3. Worker-ENV mit Staging-Supabase, interner App-Origin und
   `FANMIND_META_CATCHUP_QUEUE_ENABLED=true` konfigurieren;
4. Worker starten und leere Queue/Health prüfen;
5. erst danach das App-Flag in Staging auf `true` setzen und die isolierte App
   neu starten;
6. synthetischen Webhook und Queue-/Worker-Abschluss erneut prüfen.

Keiner dieser Schritte ist Teil des normalen Deploy-Workflows.

## Sicherer Rollback

1. App-Flag auf `false` setzen und die isolierte Staging-App neu starten; neue
   Webhooks speichern weiter ihre konkrete Nachricht, enqueuen aber nichts.
2. Worker stoppen und deaktivieren.
3. Offene Queuezeilen unverändert erhalten; keine Tabelle und keine
   bestehende CRM-Historie löschen.
4. Ursache beheben und nach erneuter Abnahme fortsetzen. Abgelaufene Leases
   werden dann kontrolliert übernommen.

Ein Schema-Drop oder eine Production-Übertragung benötigt einen separaten,
ausdrücklich freigegebenen und datenverlustgeprüften Ablauf.
