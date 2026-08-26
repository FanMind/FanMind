# Meta Conversation Continuation – kontrollierter Staging-Pfad

## Zweck und Aktivierungsgrenze

Die Migration
supabase/migrations/20260811220000_meta_conversation_sync_continuation.sql
ergänzt zwei ausschließlich serverseitig verwendete Felder an
social_connections. Sie halten einen streng validierten Meta-after-Cursor und
den ursprünglichen Intervallstart fest, wenn ein auf 25 Conversations
begrenzter Lauf noch nicht die letzte Provider-Seite erreicht hat.

Der Schritt verbindet kein Meta-Konto, startet keinen Abruf, aktiviert keine
Analyse und versendet nichts. Ein normaler Web-Deploy darf ihn nicht anwenden.
Production ist von den hier beschriebenen Workflows ausgeschlossen.

Punktstand 26. August 2026: Beide Fortsetzungsfelder und ihr Constraint wurden
im isolierten Staging als vorhanden/read-only korrekt beobachtet. Der exakte
Migration-Ledger-Zeitstempel wurde dabei nicht separat bewiesen. Diese
Objektpräsenz allein autorisiert weder Apply noch Re-Apply.

## Offline-Prüfung

    npm run db:meta-conversation-continuation:check

Der Runner akzeptiert nur den bytegenau festgeschriebenen SHA-256-Wert. Er
erlaubt ausschließlich die beiden nullable Spalten, den Paar-/Längen-/
Zeichensatz-Check und den Entzug der neuen Browser-Spaltenrechte. Daten-
änderungen, Grants und destruktive SQL-Anweisungen sind nicht Teil des
Vertrags.

## Bedingtes manuelles Apply im isolierten Staging

1. Nach Review und Merge zuerst den gemeinsamen read-only Rollout-State für
   denselben Commit und dasselbe Ziel ausführen. Nur wenn er Ledger und Objekte
   konsistent als `apply` klassifiziert, den Workflow
   FanMind Meta Conversation Continuation Staging Apply auf main starten.
2. Als reviewed_commit exakt den geprüften Main-Commit eintragen.
3. Als Bestätigung apply-meta-conversation-continuation eintragen.
4. Der Workflow prüft zuerst den gemeinsamen read-only Rollout-Zustand. Er
   schreibt nur bei einem vollständig nachgeprüften Meta-Content-Schema und
   den exakten Ergebnissen
   STAGING_DATABASE_ROLLOUT_META_CONTENT=verify,
   STAGING_DATABASE_ROLLOUT_META_CONTINUATION=apply und
   STAGING_DATABASE_ROLLOUT_STATE=PASS.
5. Vor dem ersten Write muss der rollback-only Basis-Preflight mit
   META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS abschließen. Er sperrt
   fehlendes RLS, Browser-Tabellenrechte und fehlenden Service-Role-Zugriff.
6. Nur folgende Abschlussmarker akzeptieren:
   META_CONVERSATION_CONTINUATION_APPLY=completed,
   META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS,
   META_CONVERSATION_CONTINUATION_POSTFLIGHT_TRANSACTION=ROLLED_BACK und
   SECRETS_WURDEN_NICHT_AUSGEGEBEN=true.

Ein vorhandener vollständiger Zustand wird nicht erneut verändert. Ein
partieller oder driftender Zustand stoppt vor dem Apply. Das Apply läuft
atomar; der anschließende Metadaten-Postflight ist read-only und wird
zurückgerollt.

Meldet der gemeinsame Zustand `skip`, sind die vollständigen Objekte vorhanden,
aber der exakte Ledger-Eintrag fehlt. Dann weder Apply noch Acceptance starten
und den Ledger-Widerspruch nur in einem getrennt freigegebenen Ablauf
reconciliieren. `verify` ist ausschließlich der gemeinsam vorhandene
Ledger-/Objektzustand; `block` stoppt jede weitere Datenbankaktion.

## Read-only Verify

Anschließend den Workflow
FanMind Meta Conversation Continuation Staging Verify mit demselben exakten
Commit und verify-meta-conversation-continuation starten.

Auch dieser reine Verify-Lauf muss zuerst den gemeinsamen read-only Rollout-
Zustand ausführen und exakt
STAGING_DATABASE_ROLLOUT_META_CONTENT=verify,
STAGING_DATABASE_ROLLOUT_META_CONTINUATION=verify sowie
STAGING_DATABASE_ROLLOUT_STATE=PASS bestätigen. Ein partieller oder driftender
Ledger-/Objektzustand blockiert damit den Einzel-Postflight, selbst wenn die
beiden Fortsetzungsfelder für sich betrachtet gültig aussehen.

Der Postflight prüft:

- social_connections existiert mit aktivem RLS;
- beide Spalten besitzen exakt Typ, Nullbarkeit und keinen Default;
- der validierte Check verlangt beide Felder gemeinsam oder beide null,
  Cursorlänge 1 bis 2048 und den festgelegten Zeichensatz;
- anon, authenticated und PUBLIC besitzen keine Rechte auf die beiden
  server-only Spalten;
- service_role kann beide Spalten lesen und aktualisieren;
- die Prüfung läuft ausschließlich in einer read-only Transaktion mit
  Rollback.

## Sicherer Abbruch und Rollback

Die neuen Spalten sind inaktiv, solange kein kontrollierter Meta-Sync läuft.
Bei einem Fehler bleibt Meta deaktiviert und der gemeinsame Rollout-State wird
erneut read-only ausgeführt. Keine Spalte und keine bestehende CRM-Historie
löschen. Eine Schema-Rücknahme benötigt einen separaten, ausdrücklich
freigegebenen und datenverlustgeprüften Ablauf.

Nach erfolgreicher vollständiger Rollout-State-Klassifikation und read-only
Verify (mit Apply nur bei zuvor eindeutigem `apply`) bleiben der echte Facebook-/Instagram-
Testkontoabruf, Queue-/Worker-E2E, Meta App Review und die Rechtsfreigabe
eigenständige Gates. Erst diese Nachweise dürfen zu einem begrenzten
Workspace-Pilot führen.
