# Backup Worker 7: geschützter Installationsvorschlag (R4)

Status: Vorbereitung, keine Produktionsinstallation. Die R4-Freigabe vom
13.10.2026 gilt ausschließlich für den regulären Merge von PR #1314 am Head
`c872c6136aa79052b59fe122f595d8821e20ef8a`. Dieser wurde am
2026-10-13T19:19:37Z als `8e5dcbdca844972fb2f133c188ecfee5d5252273`
gemergt. Diese Anleitung ist keine zusätzliche Autorisierung.

## Exakte Bindungen

| Bindung | Wert |
|---|---|
| Repository / ID | FanMind/FanMind / 1259448985 |
| Worker-Quelle | 8e5dcbdca844972fb2f133c188ecfee5d5252273 |
| Laufende App, unverändert | 707d22702a784e3b9999d1c9ae9c1e11c096a1bc |
| Controller | tatsächlicher Merge-Commit dieses separaten PR, noch nicht vorhanden |
| DB-Projekt | drqkpdvtbbrrdwmtrodz, postgres, 5432, TLS verify-full |
| Environment | backup-production-recovery |
| Reviewer / Dispatch-Owner | Bernds-tech, User-ID 270165082 |
| Runner | self-hosted, fanmind-prod, exoscale, linux, x64 |
| Workflow | .github/workflows/backup-worker-production-control.yml |
| GitHub Concurrency | fanmind-production-deploy, cancel-in-progress false |
| Host-Lock | /run/lock/fanmind-backup-worker-install.lock, flock nonblock |

Nur diese drei Worker-Dateien werden bei freigegebenem `install` ausgetauscht:

| Datei | SHA-256 |
|---|---|
| database-authorization-contract.mjs | b80490c17270a830dc409fc4d3755224e23facdc23a6f4ee34fb28189f7544de |
| verify-backup-artifact.mjs | ded9bf771c8111056c9fbb1b0e4d1dbc81b467b0f233031687dcade05f5b44af |
| backup-worker.mjs | 71afff4a985f29f0cf235aee5686ed0760bbac0f74bb2ecc1fc7f13977c928d1 |

`/etc/fanmind-backup/release.env` muss exakt die App-Bindung enthalten:
`FANMIND_RELEASE_COMMIT=707d22702a784e3b9999d1c9ae9c1e11c096a1bc` mit
abschließendem LF, root:root/0600. Der Controller schreibt diese Datei niemals.
Er verändert weder App/PM2, SQL/ACLs, Timer noch bestehende Backups.

## Noch erforderliche R4-Freigaben

1. Regulärer Merge des separat geprüften Controller-PR an dessen unverändertem
   exakten Head, mit allen erforderlichen CI-/Branch-Regeln und Guardian PASS.
2. Provisionierung des geschützten Environments und einmaliger Root-Bootstrap
   durch den autorisierten Host-Administrator. Beides ist aktuell nicht
   freigegeben. Kein Workflow darf sich selbst dieses Privileg verschaffen.
3. Konkrete Installation, gebunden an den tatsächlich gemergten Controller,
   die obige Worker-Quelle, App, Ziel und frische Host-Beweise. Eine reine
   Vorbereitung oder Merge-Freigabe ersetzt diese Installationsfreigabe nicht.

## Environment und Root-Bootstrap (Vorschlag, nicht ausgeführt)

Das Environment muss bereits existieren: genau ein required User reviewer mit
obiger numerischer ID, ausschließlich Deployment-Branch `main`, kein Admin-
Bypass. Die REST-Repräsentation kann die Bypass-Einstellung auslassen; daher ist
zusätzlich eine frische unabhängige Owner-Prüfung in der root-eigenen Freigabe
verpflichtend. Keine Änderung am bisher ungeschützten `production` Environment.

Ein autorisierter Administrator muss zuerst rein lesend den installierten Unit-
Inhalt samt SHA-256, effektive systemd-Properties, drei alte Worker-SHA-256,
Owner/Modi, App-Version, private Verzeichnisse, freien Speicher und den Root-
Zugriff erfassen. Keine alten Dateihashes aus App- oder Worker-Commit ableiten.
Bei fehlendem Nachweis endet die Vorbereitung an dieser Grenze.

Erst nach separater Bootstrap-Freigabe: drei Controller-Dateien aus dem exakt
geprüften Controller-Commit nach `/usr/local/lib/fanmind-ops/` (Control und
Policy) und `/usr/local/sbin/fanmind-backup-worker-control` (Wrapper),
root:root/0750. Die drei gepinnten Worker-Dateien müssen in
`/var/lib/fanmind-backup-install/bundles/8e5dcbdca844972fb2f133c188ecfee5d5252273/`
root:root/0750 liegen. Das Kontrollverzeichnis und `rollback/` sind root:root/0700;
alle Vorfahren root-eigen, ohne fremde Schreibrechte oder Symlinks.

Eine gesondert geprüfte minimale sudo-Regel darf dem tatsächlichen Runner-User
nur den festen Wrapper gewähren, niemals node/bash/install/systemctl direkt.
Der Runner-User muss vorab ermittelt werden; keine generische ALL-Regel.
Privilegierter Code wird niemals aus dem Runner-Workspace ausgeführt.

Root-eigene `/var/lib/fanmind-backup-install/authorization.json` (0600):
Schema 1, repository, environment, project und die drei Commit-Bindungen;
reviewerId 270165082, adminBypassDisabled true; freigegebene actions;
approvedAt/expiresAt ISO-UTC (maximal 24 Stunden), unitHash aus aktueller
Host-Inventur; controllerHashes mit genau `backup-worker-install-control.mjs`,
`backup-worker-install-policy.mjs`, `fanmind-backup-worker-control`; previousHashes
mit genau den drei Worker-Dateinamen aus obiger Tabelle, aber den tatsächlich
installierten alten Bytes. Alle Hashes vollständige lowercase SHA-256.
`install` verlangt gleichzeitig autorisierten `rollback`. Die eingefrorene
Freigabe wird vor Vorbereitung, Service-stop und Dateiersatz erneut auf TTL
geprüft. Läuft sie nach autorisiertem stop ab, bleibt die bereits genehmigte
sichere automatische Rückstellung zulässig; ein neuer Dispatch benötigt eine
noch gültige Freigabe.

Die Environment-Variable `FANMIND_BACKUP_WORKER_ACTION_APPROVAL` muss für den
jeweiligen Dispatch exakt `CONTROLLER_SHA:ACTION:WORKER_SHA:APP_SHA` sein.
Keine Secrets oder Hash-Platzhalter als Freigabe verwenden. Keine Bootstrap-
Ausführung ist in diesem Workflow enthalten.

## Ablauf nach gesonderter Freigabe

Dispatch ausschließlich von main, dessen HEAD der freigegebene Controller-
Merge ist. Inputs: action `verify`, `install` oder `rollback`;
reviewed_controller_commit exakt dieser SHA; worker_source_commit und
expected_application_commit wie oben; confirmation exakt `backup-worker-ACTION`.
Der Hosted-Preflight liest main und Environment vor dem privilegierten Job.
Ohne bereits bestehende Schutzregeln stoppt er, bevor ein Environment-Job startet.

Der Root-Preflight prüft gebundene Controller-/Bundle-/Unit-Hashes, sichere
Root-Pfade, App-Liveversion, aktive oder für expliziten Rollback inaktive Unit,
korrekten Prozess, PG17/TLS-Verbindung und den vollständigen 20/13-Vertrag.
Die SQL-Beobachtungen laufen read-only; keine Migration und kein GRANT/REVOKE.
Alle Backup-/Verify-Aufträge müssen weder queued noch running sein.
`verify` schreibt keine Installationsbelege oder Programmdateien und stoppt
keinen Worker. Nur kurzlebige root-private Verbindungskopien werden entfernt.

`install` bewahrt die exakt gebundenen alten Programmbytes und release.env im
neuen privaten Rollback-Verzeichnis, fsynct PREPARED, stoppt die feste Unit,
prüft die Queue erneut und persistiert APPLYING vor dem ersten Dateiaustausch.
Es installiert die drei gepinnten Dateien atomar, prüft Hashes, startet die Unit
und wiederholt App-/20/13-/Service-Prüfungen vor INSTALLED. Ein erfolgreicher
identischer Folgelauf ist ein kontrolliertes No-op; keine blinden Wiederholungen.

Der Guard belegt den Katalogvertrag (Owner, Signatur, proconfig und ACL), nicht
vollständige Body-Semantik sämtlicher Produktionsfunktionen. Der Host-Controller
und reale systemd-/sudo-Ausführung müssen beim geschützten Preflight noch
bestätigt werden; lokale Tests simulieren diese Host-Schritte.

## Unterbrechung und Rollback

PREPARED/APPLYING/RECONCILIATION_REQUIRED blockieren erneutes install. Ein
Queue-Rennen nach stop oder Prozessabbruch lässt den Worker bewusst gestoppt;
keine unkontrollierte automatische Wiederaufnahme. Ein autorisierter rollback
kann active oder inactive/MainPID0 akzeptieren, verlangt jedoch zuvor den
gebundenen Beleg, unveränderte App/release.env, gespeicherte alte Hashes,
20/13-Vertrag und leere Queue. Andere Servicezustände blockieren.

Nur Dateien, deren aktuelle Bytes jeweils exakt alt oder neu sind, dürfen
zurückgestellt werden. Unknown bytes, fehlende Snapshots oder aktive Jobs
führen zu Reconciliation durch den autorisierten Administrator. Bei normalem
Postflight-/Kopierfehler wird ausschließlich auf diese alten Programmbytes
zurückgestellt. Kein Restore der Produktionsdatenbank, keine Löschung oder
Überschreibung vorhandener Backup-Artefakte. ROLLED_BACK ist terminal; keine
zweite Installation in demselben Belegverzeichnis.

## Grenzen und nachgelagerte Aufgaben

Die tatsächliche Root-Inventur, sichere Environment-Konfiguration, Bootstrap,
Host-Preflight und Installation sind offen. Ein erfolgreich installierter Worker
beweist noch kein frisches Backup und keinen Restore. Kontrollierter DB-/Full-
Backup-Job, Integritäts-/Offsite-Nachweis und isolierter Restore benötigen danach
jeweils aktuelle Voraussetzungen und passende Autorisierung. Historische
consumed Restore-Ziele nicht wiederverwenden. Audit 38436222005/1 bleibt bis
zum Nachweis frischer wiederherstellbarer Backups ein Produktionsblocker.
