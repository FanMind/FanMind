# FanMind Monatsrelease — bestehender geschützter Controller

PR1512, Source-Vorbereitung. Keine Production-Bereitstellung, kein Backup,
Restore, SQL-Apply oder geschützter Installationsschritt wurde ausgeführt.
Technische Abnahme erfordert die vollständige native CI-Generalprobe und
Guardian-Gegenprüfung am endgültigen Head; ein Paketgenerator-Test reicht nicht.

## Einmaliger Aufbau und monatlicher Ablauf

Der einzige Deployment-Einstieg bleibt `deploy-fanmind.yml`: aktueller exakter
Main, feste Owner-ID, vollständige Main-/PR-Pflichtprüfungen, geschütztes
`production` Environment und `fanmind-production-deploy`, ohne Abbruch eines
laufenden Releases. Main-Merge deployt nichts. Die bestehende isolierte
Build/PM2/nginx/Smoke/Host-Installation bleibt einmal im Workflow definiert.
Der Monatsadapter extrahiert genau diesen markierten Codeblock; es existiert
keine zweite Deploymentimplementierung. Ohne Monatsparameter bleibt der bisherige
separat freizugebende Einzelrelease erhalten.

Vor dem ersten produktiven Gebrauch ist der feste read-only Evidence-Wrapper
separat durch den autorisierten Administrator zu installieren. Das ist eine
**noch nicht ausgeführte geschützte Voraussetzung**, kein Teil dieses PR-Laufs.
Es entstehen keine Server, Datenbanken, Dienste, Timer oder neuen Secrets.

Danach ist der monatliche Bedienablauf:

1. Entwicklung und fachliche Staging-Abnahme abschließen; exakten Kandidaten
   festhalten. Der bestehende Controller verlangt weiterhin aktuellen Main;
   während Vorbereitung/Freigabe/Ausführung nicht unbemerkt Main ersetzen.
2. `Prepare FanMind monthly release (no deployment)` auf genau diesem Main
   ausführen. Eingaben: frisch verifizierter Production-Base-SHA,
   `staging_deployment_run`, JSON-Liste `staging_acceptance_runs`.
3. Das unveränderte Quellpaket samt SHA256, vollständiger Dateidifferenz,
   einzelnen Feature-/Abnahmezuordnungen und SQL-Entscheidungen freigabefertig
   vorbereiten. Root-Evidence-Bundle aus bereits vorhandenen offiziellen
   Backup-/Restore-/SQL-/Generalproben-Nachweisen vorbereiten. Fehlende Belege
   bleiben Blocker; keine Behauptung allein aufgrund grüner Quellcode-CI.
4. Owner genehmigt genau Base → Kandidat, Paket-Hash und Konfiguration.
   Bestehenden `Deploy FanMind` mit `reviewed_main_commit`,
   `expected_current_release`, unveränderter Bestätigung
   `deploy-reviewed-chatadmin` und `monthly_release_sha256` starten.
   Die bisherigen Support-Optionen müssen exakt zur freigegebenen Konfiguration
   passen. Bestehende Environment-Freigabe bleibt zusätzlich erforderlich.
5. Derselbe geschützte Controller prüft Paket, GitHub-/Staging-Nachweise,
   aktuelle Sicherungen, vollständige Restore-Kette und SQL-Postflights,
   deployt, prüft Funktion und Runtime und schreibt Status sowie Zeiten.

Kein kalendergesteuerter Production-Start. Jeder Monat benötigt seine eigene
Owner-Freigabe. Alle aufwendigen Entwicklungs-, fachlichen und Restore-Prüfungen
gehören möglichst vor den Beginn des eigentlichen Releasefensters.

## Paket und Nachweise

`monthly-release-package.mjs` erzeugt deterministisch Base, Kandidat, Git-Tree,
Git-Archiv-SHA256, vollständige Dateidifferenz und alle geänderten SQL-Dateien
unter `supabase/` einschließlich Änderung/Löschung und Prüfsummen.
Das Paket ist unveränderliche Quellidentität, niemals eigene Freigabeautorität.
`verifySource` berechnet die Daten erneut aus Git; neue Main-Commits, andere
Archive, fehlende Vorgänger oder manipulierte SQL-Hashes blockieren.

`collectEvidence` liest GitHub selbst. Erforderlich sind geschützter aktueller
Main, gemergter PR und dessen Pflichtprüfungen, erfolgreicher exakter Staging-
Rollout und tatsächlich ausgeführte erfolgreiche Abnahmejobs danach. Jede
geänderte Datei erhält genau eine fachliche Staging-Zuordnung; reine
Dokumentations-/Test-/Operationsänderungen dürfen stattdessen ihre Quellcode-CI
referenzieren. Runtime-Dateien dürfen nicht pauschal als `source_ci` gelten.
Diese Zuordnung ist Bestandteil des geschützten, vom Owner geprüften Plans;
noch fehlende fachliche Abnahmen werden nicht durch einen grünen Browserjob
für einen anderen Funktionsumfang ersetzt.

Die Generalproben-Evidence bindet den tatsächlichen Bericht-Hash, native PG17-
Erfolg, Quellbaum, gemessene Gesamtdauer und negative/Recovery-Fälle. Der Root-
Verifier liest die tatsächlichen privaten Berichtbytes. Der Monatsadapter
prüft zusätzlich den echten erfolgreichen GitHub-CI-Lauf, dessen Commit-Tree
und den tatsächlich bestandenen Schritt
`Prove full monthly release rehearsal with PostgreSQL 17`.

### Evidence-Vorschlag ohne manuelle Prüfsummenarbeit

Vor dem Release kann der Operator lokal aus dem Quellpaket, einem geprüften
Plan und den bereits vorhandenen privaten Nachweisen einen Vorschlag erzeugen:

```bash
node scripts/operations/monthly-release-admission.mjs monthly-release.json plan.json .monthly-release-prepared
```

`plan.json` enthält `coverage`, `configuration` (die beiden bestehenden Support-
Optionen), `restoreFiles` mit `evidence/full/runner/postcheck`-Dateipfaden,
`rehearsalFile` und `sql` mit `path`, `controller`, `backwardCompatible` sowie
`receiptFile`. Bei einer bestätigten Recovery kommt `resumeAfterAttempt` hinzu.
Der Generator berechnet alle Hashes, bindet Kandidat/Zeiten/Berichte, prüft die
kanonische Restore-Kette und erzeugt ausschließlich ein neues privates lokales
Verzeichnis. Ein vorhandener Vorschlag wird nicht überschrieben oder gelöscht.
`PROPOSED_NOT_AUTHORIZED` wird erst durch die getrennte genehmigte Root-
Installation zum verwendbaren Evidence-Bundle. Der Generator installiert
nichts auf Production, startet keinen Workflow und erzeugt keine Owner-Freigabe.

## Sichere SQL-Strategie und ihre tatsächliche Grenze

Der Webrelease führt **keine** SQL-Migration automatisch aus. Benötigte
Änderungen müssen vorher über ihren bestehenden separat freigegebenen
kontrollierten Migrationsweg angewendet und lesend abgenommen sein. Es gibt
keinen generischen Migration-Push und keine automatische Wiederholung eines
unbekannt abgeschlossenen DB-Vorgangs.

Für die vier bereits vorhandenen Production-Verifier sind Workflow, SQL-Pfad
und der unveränderliche SQL-Hash in `SQL_PROOFS` gebunden: Backup-Verifikation,
Operations-Monitor, Server-Error-Schema und Trigger-Hardening. Die privaten
Postflight-Receipts werden tatsächlich gelesen und gehasht. Target,
Base/Kandidat, SQL-Hash, Run/Versuch/Job, `verify` und PASS müssen stimmen.
Der Adapter überprüft den offiziellen erfolgreichen Lauf und dessen echte
`ACTION=verify`/`RESULT=verified`-Ausgabe. Die SQL-Prüfung muss höchstens
15 Minuten alt sein. Ein beliebiger Prüfhash oder ein Apply-Lauf genügt nicht.

**Wichtige Begrenzung:** Diese vorhandenen Controller verlangen teilweise,
Main-/Controller-/Live-Version gleichzuhalten. Ein neuer SQL-Stand lässt sich
unter Umständen nicht vor einem Base→Kandidat-Wechsel mit ihnen nachweisen.
Dann blockiert der Monatsrelease. Er lockert diese vorhandenen Regeln nicht.
Ebenso blockieren unbekannte SQL-Adapter, geänderte historische SQL-Bytes,
fehlende Postflights und nicht angewendete Migrationen. Neue/dormante SQL wird
nicht ohne überprüfbaren bestehenden Gate automatisch als unnötig eingestuft.
Das ist eine separat geschützte Schema-/Rollout-Voraussetzung, keine behauptete
Unterstützung beliebiger neuer Migrationen.

Nicht rückwärtskompatible Änderungen bleiben mehrstufig: Expand, kompatible
App, getrennte Datenübernahme, spätere Contract-Phase. Der Plan verlangt
nachgewiesene Rückwärtskompatibilität. Bereits benutzte produktive Strukturen,
Kundenguthaben, Zahlungen oder Meta-Konfiguration werden niemals mit Down-SQL
zurückgesetzt oder implizit verändert.

## Zeitüberwachung und Recovery

| Phase | Höchstbudget | Inhalt |
| --- | ---: | --- |
| Vorprüfung | 10 Minuten | Paket, Version, Freigabe, Staging, Backup/Restore, SQL |
| Deployment | 20 Minuten | bestehender isolierter Build, Umschaltung, Host-Installationen |
| Funktionstests | 15 Minuten | abschließender Public Smoke nach Host-Nacharbeiten |
| Abschluss/Reserve | 15 Minuten | frischer vollständiger Runtime-/Backup-Audit und Abschluss |

Die Uhr startet im geschützten Job **vor** Archiv-/Evidence-Vorbereitung.
Wartezeit auf Runner/Environment-Freigabe und vorgelagerte Quellcode-Prüfungen
werden gesondert betrachtet; danach läuft das Fenster ohne Neustart der Uhr.
Linux-Bootzeit und monotone Prozesszeit verhindern eine Verlängerung durch
Wanduhrkorrekturen. Vor und nach jedem Schritt sowie nach der letzten
Speicherung werden die Phasen- und Gesamtgrenzen geprüft.

Nur lesende/buildende npm-Kindprozesse und der abschließende Smoke-Test haben
begrenzte TERM/KILL-Fristen. Vor einer Live-Umschaltung sind mindestens fünf
Minuten Restzeit im Deploymentbudget nötig. Host-Schreibschritte prüfen vor
jeder sicheren Grenze die Frist. PM2-Reload/Rückwechsel, Schutzvorgänge und
Datenbanktransaktionen werden nicht durch eine Budget-Uhr blind getötet.

Bei einer bereits laufenden Schutzoperation kann das sichere Auslaufen über
60 Minuten dauern. Dann lautet das Ergebnis ausdrücklich **nicht abgeschlossen**;
es wird kein weiterer Mutationsschritt gestartet und kein 60-Minuten-Erfolg
behauptet. Der monatliche GitHub-Notfalltimeout beträgt 90 Minuten, damit die
60-Minuten-Zielgrenze einen laufenden Rückwechsel nicht hart abschneidet. Der
bisherige Einzelrelease behält seine 45 Minuten. Ein hart beendeter Runner
bleibt ein unbestätigter Vorgang, niemals eine automatische Recovery-Freigabe.

Der private Zustand liegt unter
`/var/www/fanmind/.monthly-release/<package-sha>/`, mit atomarem Latest-Stand
und unveränderlicher Ereignishistorie pro Versuch. Nach Fehler, Timeout oder
unklarem Zustand muss der geschützte Plan die genaue vorherige Attempt-ID
mit `resumeAfterAttempt` und einer späteren Zustandsprüfung bestätigen.
Ein abgewiesener blinder Retry überschreibt den vorherigen Zustand nicht.
Ein Host-Lock verhindert parallele Monatsversuche; der bestehende GitHub-
Deployment-Lock bleibt zusätzlich wirksam.

Bei Wiederaufnahme werden Paket, frische Gates und tatsächliche Live-Version
neu geprüft. Nur Base oder derselbe Kandidat sind erlaubt. Der bestehende
isolierte Builder erkennt einen bereits aktiven Kandidaten und prüft ihn ohne
erneuten Build; idempotente Host-Installationen dürfen nach Freigabe ergänzt
werden. Der Controller führt keine Migration nochmals aus. Fehler nach der
App-Umschaltung können `INSPECTION_REQUIRED` ergeben, weil die ursprüngliche
App-Rollbackfunktion die späteren Host-Installationen nicht vollständig undoen
kann. Es gibt deshalb keinen erfundenen atomaren Gesamtrollback.

## Geschützter Evidence-Aufbau (nur Installationsvorschlag)

Ein autorisierter Administrator muss nach gesonderter Freigabe genau diese
Dateien aus dem geprüften Commit root-eigen installieren:

- Wrapper `monthly-release-evidence.sh` →
  `/usr/local/sbin/fanmind-monthly-release-evidence`, root:root/0755.
- Die zehn `VERIFIER_FILES` aus `monthly-release-control.mjs` unter
  `/usr/local/lib/fanmind-monthly-release/` mit ursprünglichen relativen Pfaden,
  root:root/0644; Verzeichnisse root-eigen, nicht gruppen-/weltbeschreibbar.
- Der Wrapper darf nur über die bereits autorisierte sudo-Grenze mit genau
  Paket-Hash, Base und Kandidat ausgeführt werden. Keine allgemeine neue
  sudo-Freigabe für Node, Bash oder Migrationen.

Der feste Wrapper prüft sein Root-Bundle **vor** dem Node-Import, ignoriert
BASH_ENV/Caller-PATH/Node-Optionen und kann ausschließlich vorhandene Belege
lesend verifizieren. Fehlende Dateien, unsichere Besitzer/Modi, Symlinks,
Prüfsummen-/Versionsabweichungen und unvollständige Belege blockieren.
Er erstellt keine Sicherung und führt keinen Restore oder SQL-Apply aus.

Unter `/etc/fanmind-release/` (root-eigen, 0700) liegen pro Paket ausschließlich
private, root:root/0600 installierte freigegebene Evidence-Dateien:

| Datei | Inhalt |
| --- | --- |
| `<hash>.json` | Admission v1: originales `source`-Paket, Owner270165082, Production-Target, Controller, höchstens 24h gültige Freigabe, vollständige `coverage`, `sql`, `configuration`, `restore`, `rehearsal`; bei Recovery genaue vorherige Attempt-ID |
| `<hash>.evidence.json`, `.full.json`, `.runner.json`, `.postcheck.json` | Bestehende vollständige Restore-Kette; alle vier Hashes, Base-Commit und Schemafingerprint im Plan gebunden |
| `<hash>.rehearsal.json` | Tatsächlicher nativer CI-Generalprobenbericht, SHA256 und Quellbaum gebunden |
| `<hash>.sql-N.json` | Pro SQL ein checksum-gebundener verifizierter Postflight mit Target/Base/Kandidat/SQL/Run/Versuch/Job/Zeit |

Der bestehende kanonische Restore-Verifier prüft die eingefrorenen vier
privaten Receipts. Die vollständige Restore-Evidence darf höchstens 30 Tage
alt sein und muss zur Base und zum gebundenen Schemafingerprint gehören.
Eine nur teilweise DB-Abnahme genügt nicht. Rollen-/Archiv-/Receipt-Daten
bleiben privat; der Runner erhält nur den genehmigten Plan und begrenzte
Verifikationsergebnisse. Der GitHub-Token wird vor allen Deployment-/PM2-
Kindprozessen entfernt und darf nicht in PM2 oder dessen Dump gelangen.

Ein frischer Aufruf des vorhandenen root-eigenen read-only Production-Audits
prüft die tatsächlich aktuellen Sicherungsalter, Prüfsummen, Offsite- und
Worker-Gates vor dem Release und nach den Host-Nacharbeiten. Der bestehende
kanonische Verifier bleibt erhalten. Nur `ORIGIN_MAIN` wird ausdrücklich auf
den bereits geprüften neuen Kandidaten gebunden, während Live/Server-HEAD vor
dem Release noch die freigegebene Base sein dürfen. Andere Drift wird nicht
normalisiert oder ignoriert.

## Nichtproduktive Generalprobe und offene Betriebsgrenze

Die Generalprobe verwendet **denselben** `createProductionAdapter`, dieselbe
Subprozess-/Token-/Fristlogik, den extrahierten vollständigen Deploymentblock
und das wirkliche `deploy-isolated-release.sh` mit aktivierten Monatsgrenzen.
Das vorher vorhandene Shell-Harness wird gemeinsam genutzt, nicht dupliziert.
Git-Archive und getrennte echte HTTP-Anwendungsprozesse liefern Version1→2;
Hostpfade, sudo/systemd/PM2, GitHub und private Root-Evidence sind streng
isolierte synthetische Schnittstellen. Das ist kein realer Production-Host.

Im verpflichtenden nativen CI-Schritt werden die bereits vorhandenen
wegwerfbaren PostgreSQL17-Services wiederverwendet. Eine eigene synthetische
Schemaänderung wird transaktional angewendet, idempotent wiederholt, eine
Fehländerung zurückgerollt und erhaltene Daten nach Fehler/Recovery geprüft.
Echte Production-SQL wird dort niemals angewendet. Gates mit falschem Backup,
real aktivierte Deadline, Fehler nach Deployment, abgewiesener Retry und
zustandsgeprüfte Wiederaufnahme werden im selben Ablauf durchgespielt.
Der Bericht enthält tatsächlich gemessene Gesamtdauer, Quellbaum, PG17-Status
und einzelne Ergebnisflags. Lokale Läufe ohne PG17 dürfen keine native
Gesamtabnahme vortäuschen; verbindlich ist der finale native CI-Bericht.

Aktuell offene externe Voraussetzungen bleiben eigene Arbeiten: gültiger
Backup-/Restore-Nachweis und die noch nicht genehmigte Installation/Admission.
Read-only GitHub-Nachprüfung fand weiterhin Audit43590551891 mit
`production_audit_backup_latest_stale_or_empty`; DB226.04h>36h und Full321.04h>192h.
Die aktuelle Worker-Ursache ist dadurch nicht bewiesen. Historische20/13-
Kompatibilitätsprobleme dürfen nicht als heutige Diagnose ausgegeben werden.
Bestehender zuständiger Weg: `backup-worker-production-control.yml`, geschütztes
`backup-production-recovery`, gleicher Production-Lock und fixer Root-Controller.

Restore1350 bewahrt den akzeptierten DB_POSTCHECKED-Stand; Gesamtstatus PARTIAL.
Readiness43638416183 wartet bereits auf seinen Host-Schritt. Diese Arbeit
konsumiert dessen Ergebnisse und startet weder einen zweiten Lauf noch einen
Restore, ein Backup oder Änderungen an realen Restore-Daten.

## Five controlled SQL evidence adapters — 15 November 2026

Source-only extension of the existing monthly controller. No schema apply,
Root-verifier installation or Production rollout is performed by this change.
The four earlier Production adapters keep their existing strict semantics.

| SQL | Required installed state | Reused source contract |
| --- | --- | --- |
| `ai_capacity_entitlement_writer.sql` | Entire installed Capacity catalogue EXACT | `sourcePackage`, installed-reference and complete catalogue collector; writer alone never suffices |
| `chat_admin_media_catalogue.sql` | Exact extended catalogue, including only the two pinned guard bodies | media source profile/classifier; initial, extended_legacy and drift reject |
| `chat_admin_media_prices.sql` | Exact extended media prerequisite and full price postflight/structure | source-pinned function body/ACL/RLS checker plus strict columns, constraints, indexes, schema objects and grant-option checks |
| `support_ai_consent.sql` | Full source-reference EXACT | existing consent + base Support catalogue/classifier, role boundary, confirmed allowlisted Owner and disabled activation; ABSENT/DRIFT reject |
| `chat_admin_media_storage_finalization.sql` | Exact ready post-repair catalogue | existing guard-state query; pending rejects |

Four specialist controllers are Staging-only. Their target guards remain
unchanged; Staging PASS cannot become Production evidence. The existing
Production consent controller also has distinct ABSENT/SKIP semantics and is
not silently treated as generic `RESULT=verified`.

The new `monthly-release-sql-verify.yml` is only a bounded read-only evidence
producer for these five registered paths. It has no apply action, arbitrary SQL
input, schedule, installation, feature switch or deployment path. It reuses the
existing Production environment, Owner270165082, Production runner, protected
backup connection and `fanmind-production-deploy` lock; also takes the existing
monthly host lock. It snapshots the full exact reviewed Main archive into a
private temporary directory; source SQL hashes and reviewed references are
validated there. It never replaces the app checkout. Full source imports must
stay together, with no files cherry-picked from an open parallel PR.

Inputs: `adapter` (one fixed allowlisted name), `reviewed_commit`,
`production_base_commit`, `expected_live_commit`, `sql_sha256`, `confirmation=verify-monthly-sql-only`.
Only invoke after the candidate is merged/reviewed and exact current Main.
The live base is checked before/after the read; all SQL checks share one
repeatable-read READ ONLY snapshot, a server read-only default and fixed TLS
connection with a private passfile snapshot. Only metadata is queried; no RPC
with mutation, customer content, entitlement/price/consent change or schema
repair is called. Missing objects/partial states fail without a PASS marker.

For each SQL the private receipt uses version2 and the existing common fields
`target=production`, `base`, `candidate`, `path`, `sqlSha256`, `action=verify`,
`result=PASS`, positive `runId/jobId/runAttempt`, `verifiedAt` (actual successful
job completion). Additional fields are `project=drqkpdvtbbrrdwmtrodz`,
`sourceTree` (exact package tree), `state=EXACT`, `live` (independently observed
base or that same candidate). The original package `base` never changes on
resume. Candidate-live receipts additionally require the separately approved
`resumeAfterAttempt` UUID; the existing release state machine must still match
that UUID to its real private previous attempt and later inspection time. Empty
live values, third SHAs and substituting live for the original base reject. Bind its actual bytes through
the existing admission generator; never manufacture a receipt from this text.
The monthly controller independently re-reads the exact completed successful
Owner/Main/dispatch workflow run/attempt, selected successful collector job and
step, plus timestamped actual output. It requires one unique matching set of
adapter/path/hash/target/project/base/live/candidate/tree/action/state/result lines;
echoed shell commands, apply results, duplicates, another target/candidate,
missing data and stale/future evidence reject. TTL remains15minutes. Repeat
only read-only verification near the release window if it expires.

The fixed Root-evidence closure still has its ten existing modules. It imports
no specialist collector or mutable Staging module; only the existing monthly
control validates the pinned receipt. The collector runs solely in the exact
reviewed archive. No installation is authorized by this source preparation.

### Relationship to Support1350 / PR1515

PR1515 was regularly merged as Main
`6bc209851b4a54609747099ec34264318dc7f4c4` during this preparation;
reviewed PR1515 head `1a952487644b3344fed9f272f8a4603b48c0c46d`.
The merged Main is incorporated as a whole, preserving the39/29 contract,
full-receipt/restore-drill verifiers and dependent Current-Facts checksum.
These specialist files have no additional edits in this PR's diff against Main.
The complete ten-module Root closure must bind this combined candidate; never
combine an old installed Root bundle with newer receipts. Full exact-head
CI/nativePG17 is required again because the verified code closure changed.
The old candidate63e8 and earlier green adapter-only tree are historical,
not substitute Production approvals. Source merge does not install the worker,
create fresh backups, prove the independent Recovery route or approve the final
expanded schema. Support still owns those operational prerequisites; Adminchat
owns actual function installation and real media lifecycle acceptance.

The adapters verify installed schema only. They neither provide missing
Production apply controllers nor authorize those actions. Database action,
feature acceptance, backup/restore integrity, protected verifier installation,
Owner/environment approval and actual release acceptance remain separate.

Recovery: a failed verification writes no database state. Correct the specific
missing prerequisite through its specialist workflow, then verify the same
explicit candidate again; a changed Main requires reviewed source rebinding.
No automatic down migration or generic legacy/empty-parameter fallback exists.
Native tests extend the existing disposable PG17 specialist fixtures, including
price structure/ACL drift and read-only attempts. Local PG17 skips are reported
as skips; mandatory native CI remains the acceptance evidence.
