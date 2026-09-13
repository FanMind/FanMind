# FanMind Read-only Production Operations Audit

## Zweck

`scripts/operations/read-only-production-audit.sh` sammelt einen redigierten technischen Zustandsnachweis für FanMind Production. Das Skript darf weder Dienste verändern noch Backups entschlüsseln oder Daten wiederherstellen. Es ergänzt `/api/version`, `/api/health`, den Operations-Monitor und den Backup-Verifier um einen reproduzierbaren Host-Nachweis.

Der Audit ist insbesondere für Issue #524 und den zentralen P1-Tracker #644 vorgesehen.

## Geprüfte Bereiche

Der Audit gibt ausschließlich die folgenden Kategorien aus:

- Zeitpunkt, Shell-Node-Version und die von PM2 für den einzigen FanMind-Prozess gemeldete Node-Version; die Shell-Version ist kein Beleg für die App-Version;
- Server-HEAD, `origin/main`, öffentlicher Release-Commit und Environment;
- explizite öffentliche Runtime-Umgebung aus `/api/version`;
- öffentlicher Health-Gesamtstatus und veröffentlichte Komponentenstatus;
- ausgewählte PM2-Metadaten: Status, Restart-Zähler, instabile Restarts, Uptime, CWD, Ausführungsmodus und Memory;
- ausschließlich die normalisierten Booleschen Zustände des Server-Fehlertrackings und seiner getrennten E-Mail-Alarmierung;
- Ergebnis von `nginx -t` und aktiver Zustand von `nginx.service`;
- HTTP-Status des lokalen und öffentlichen Login-Endpunkts;
- Root-Dateisystembelegung, verfügbarer Arbeitsspeicher, Host-Uptime, Boot-ID und Reboot-Hinweis;
- Namen und Aktivierungsstatus der `fanmind-*`-systemd-Units;
- stabile Timer-Metadaten je konkreter `fanmind-*.timer`-Unit über `NextElapseUSecRealtime`, `NextElapseUSecMonotonic` und `LastTriggerUSec`;
- Anzahl und Aktualität verschlüsselter Backup-/Prüfsummen-Paare;
- checksum-only-Verifikation des neuesten verschlüsselten Vollbackups;
- bei aktivierter Offsite-Konfiguration nur Erreichbarkeit, Objekt-/Paaranzahlen und der neueste Vollbackup-Dateiname;
- ausschließlich erlaubte strukturierte Backup-Worker-Ereignisnamen und deren Anzahl, getrennt für die letzten 24 Stunden und 14 Tage.

## Harte Sicherheitsgrenzen

Das Skript führt ausdrücklich **nicht** aus:

- kein `pg_restore`, `psql` oder Datenbank-Write;
- keine `age`-Entschlüsselung und keine Verwendung einer privaten age-Identity;
- kein `rclone copy`, `sync`, `move`, `delete` oder `purge`;
- kein Start, Stop, Restart, Enable oder Disable von systemd-/PM2-Diensten;
- keine nginx-Neuladung;
- keine Git-Änderung;
- keine POST-/PUT-/PATCH-/DELETE-Anfrage;
- keine Ausgabe von `.env.production`, `worker.env`, Tokens, Keys, Passwörtern, Remote-Namen, Remote-Pfaden oder Backup-Inhalten;
- keine Ausgabe des vollständigen PM2-JSON oder der PM2-Environment-Map;
- keine Ausgabe der Production-ENV, ihrer übrigen Schlüssel, Werte oder ihres Pfads;
- keine Ausgabe von Backup-Job-IDs, Worker-Fehlertexten, Pfaden aus Fehlern oder vollständigen Journalzeilen.

Die wenigen `sudo -n`-Aufrufe sind auf lesende Prüfungen beschränkt: `nginx -t`, Dateisystem-Inventar, checksum-only-Verifier, read-only Offsite-Listing und Journal-Auswertung. Ein fehlendes non-interactive Recht führt zum Abbruch oder zu einem klaren `unavailable`-Status; das Skript fordert kein Passwort interaktiv an.

## Ausführung

Auf dem Production-Host aus einem vertrauenswürdigen, geprüften Repository-Stand:

```bash
cd /var/www/fanmind
bash scripts/operations/read-only-production-audit.sh
```

Optionale, nicht geheime Pfadparameter:

```bash
FANMIND_AUDIT_APP_ROOT=/var/www/fanmind \
FANMIND_AUDIT_BACKUP_ROOT=/var/backups/fanmind \
FANMIND_AUDIT_PUBLIC_BASE_URL=https://fanmind.ch \
FANMIND_AUDIT_PM2_APP_NAME=fanmind \
bash scripts/operations/read-only-production-audit.sh
```

## Server-Fehler-Schalter

Der Audit liest aus der geschützten Production-ENV ausschließlich die beiden
allowlisteten Schlüssel `FANMIND_SERVER_ERROR_TRACKING_ENABLED` und
`FANMIND_SERVER_ERROR_EMAIL_ENABLED`. Er akzeptiert nur eine absolute,
kanonische reguläre Datei, folgt keinen Symlinks, begrenzt die Datei auf 64 KiB
und verlangt jeden Schlüssel genau einmal mit dem normalisierten Wert `true`
oder `false`. Eine fehlende, doppelte, ungültige, während des Lesens veränderte
oder zu große Datei lässt den Audit fail-closed abbrechen.

Im Roh-Audit erscheinen ausschließlich:

```text
SERVER_ERROR_TRACKING_ENABLED=true
SERVER_ERROR_EMAIL_ENABLED=false
```

Der Ergebnis-Verifier verlangt genau diese Kombination. Seine redigierte
Zusammenfassung veröffentlicht nur
`PRODUCTION_SERVER_ERROR_TRACKING_ENABLED=true` und
`PRODUCTION_SERVER_ERROR_EMAIL_ENABLED=false`; andere ENV-Werte werden weder
ausgewertet noch ausgegeben.

## systemd- und Worker-Ausgabe

Die Timer-Ausgabe wird nicht aus lokalisierten Spalten von `systemctl list-timers` abgeleitet. Für jede konkrete Timer-Unit werden ausschließlich stabile Properties gelesen. Kalender-Timer nutzen typischerweise `next_realtime`; relative Timer wie `OnUnitActiveSec` können stattdessen nur `next_monotonic` liefern:

```text
SYSTEMD_TIMER=<unit>|next_realtime=<timestamp-or-unknown>|next_monotonic=<value-or-unknown>|last=<timestamp-or-unknown>
```

Die Backup-Worker-Ausgabe verwendet eine feste Ereignis-Whitelist und zwei Zeitfenster:

```text
BACKUP_WORKER_WINDOW=24h
BACKUP_WORKER_EVENT=24h|job_failed:0
BACKUP_WORKER_WINDOW=14d
BACKUP_WORKER_EVENT=14d|job_failed:<count>
BACKUP_WORKER_24H_FAILURE_EVENT_COUNT=0
BACKUP_WORKER_24H_FAILURE_FREE=true
```

Ältere, bereits behobene Fehler bleiben im 14-Tage-Fenster sichtbar, ohne den aktuellen 24-Stunden-Zustand zu verschleiern. Ausgegeben werden nur Zähler für `worker_start`, `worker_stop`, `sigterm_received`, `claim_failed`, `job_claimed`, `job_failed`, `job_rejected` und `fatal`.

## Backup-Prüfung

Der Audit wählt das neueste lokale Artefakt nach dem Muster

```text
fanmind-full-*.tar.gz.age
```

und ruft den bestehenden Verifier ausschließlich ohne `--identity` auf. Dadurch werden nur:

- Artefakt und benachbarte `.sha256`-Datei auf Lesbarkeit geprüft;
- Dateinamensbindung geprüft;
- SHA-256 neu berechnet und verglichen;
- Backup-Typ und Dateigröße ermittelt.

Das Ergebnis muss `mode=checksum_only` und `backupType=full` melden. Eine inhaltliche Prüfung oder ein Restore bleibt dem isolierten Ablauf in `docs/operations/RESTORE_DRILL.md` vorbehalten.

## Offsite-Prüfung

Die Offsite-Konfiguration wird nicht per Shell `source` ausgeführt. Das Skript liest nur vier ausdrücklich erlaubte Konfigurationsfelder als Text:

- `FANMIND_BACKUP_OFFSITE_ENABLED`;
- `FANMIND_BACKUP_RCLONE_REMOTE`;
- `FANMIND_BACKUP_RCLONE_CONFIG`;
- `FANMIND_BACKUP_REMOTE_PATH`.

Remote-Name und Remote-Pfad werden nicht ausgegeben. Bei aktivierter und vollständiger Konfiguration wird ausschließlich `rclone lsf --files-only --recursive` verwendet. Der Audit bewertet, ob verschlüsselte Artefakte und Prüfsummen als vollständige Paare vorliegen.

## Pass-Kriterien

Eine vollständig durchgelaufene technische Audit-Ausführung endet mit:

```text
AUDIT_RESULT=success
```

Für einen belastbaren Operations-Pass müssen zusätzlich gelten:

- Server-HEAD, `origin/main` und `LIVE_RELEASE` sind identisch;
- `LIVE_ENVIRONMENT=production`;
- `LIVE_HEALTH=healthy` und alle Pflichtkomponenten sind gesund;
- `PM2_STATUS=online` und `PM2_UNSTABLE_RESTARTS=0`;
- `SERVER_ERROR_TRACKING_ENABLED=true` und `SERVER_ERROR_EMAIL_ENABLED=false`;
- nginx-Konfiguration ist gültig;
- lokaler und öffentlicher Login antworten mit 2xx/3xx;
- Backup-Root ist verfügbar;
- keine verwaisten lokalen Backup-Paare;
- das neueste Vollbackup besteht die checksum-only-Prüfung;
- bei aktivierter Offsite-Sicherung ist das Remote erreichbar und enthält keine verwaisten Paare;
- `BACKUP_WORKER_24H_FAILURE_FREE=true`.

Ein `REBOOT_REQUIRED=true` ist kein automatischer Neustartauftrag. Der Neustart benötigt einen eigenen kontrollierten Plan mit Backup-, Rollback- und anschließendem Smoke-Test.

## GitHub-Actions-Sicherheitsregel

Production-nahe Self-Hosted Runner dürfen nicht dauerhaft beliebigen Pull-Request-Code ausführen. Ein temporärer Audit-Workflow darf deshalb nur auf einem vertrauenswürdigen internen Branch verwendet und muss vor dem Merge entfernt werden. Dauerhafte Automation muss ausschließlich Code aus dem geschützten `main`-Stand ausführen oder einen bereits auf dem Server installierten, root-eigenen Audit verwenden.

Der dauerhafte Workflow `.github/workflows/production-readonly-audit.yml` folgt
der zweiten Variante:

- der normale Production-Deploy installiert Audit und Ergebnis-Verifier
  root-owned in das ausschließlich dafür bestimmte, für den Runner nur
  les- und traversierbare Verzeichnis `/usr/local/lib/fanmind-audit`; die
  gemeinsame Public-Health-Policy bleibt root-owned unter `/usr/local/lib`;
- das allgemeine Operationsverzeichnis `/usr/local/lib/fanmind-ops` bleibt
  unverändert root-only mit Modus `0700`. Der Audit übergibt den dort
  geschützten checksum-only Backup-Verifier ausschließlich an `sudo -n node`;
- der nicht geheime Operations-Monitor liegt getrennt root-owned unter
  `/usr/local/lib/fanmind-monitor` (`0755` Verzeichnis, `0644` Script), damit
  ausschließlich seine unprivilegierten `ubuntu`-Services ihn über
  `/usr/bin/node` lesen können; Aktivierungscode bleibt root-only;
- der Audit-Workflow checkt keinen Repository-Code aus und führt ausschließlich
  diese installierte Version aus;
- nach einem erfolgreichen `Deploy FanMind` wird der exakt deployte Commit
  automatisch geprüft;
- ein täglicher Lauf um 04:17 UTC vergleicht Production mit dem dann aktuellen
  `main`-Commit und schafft ein weiteres stabiles Zeitfenster;
- ein manueller Lauf ist ausschließlich auf `main` mit
  `run-read-only-production-audit` und einem exakten 40-stelligen erwarteten
  Commit möglich;
- Rohdaten und stderr bleiben in getrennten privaten temporären Runner-Dateien und werden nach dem Lauf
  gelöscht. Es wird kein Audit-Artefakt hochgeladen;
- nur die redigierte, maschinengeprüfte Zusammenfassung erscheint im
  Workflow-Log.

Der fail-closed Ergebnis-Verifier kann außerhalb des Workflows so verwendet
werden:

```bash
npm run production:audit:verify -- \
  /sicherer/pfad/audit-output.txt \
  <erwarteter-40-stelliger-main-commit>
```

Er lehnt unter anderem Commit- oder Runtime-Drift, ungesunde Pflichtkomponenten,
PM2-/nginx-Fehler, veraltete oder verwaiste Backup-Paare, Offsite-Abweichungen
und Backup-Worker-Fehler im 24-Stunden-Fenster ab.

## Diagnose bei Abbruch

Der Workflow ruft den Verifier auch nach einem fehlgeschlagenen Audit-Skript auf
und übergibt dessen tatsächlichen Exit-Code als optionales drittes Argument.
Ein von null verschiedener Code bleibt ein Fehler, selbst wenn die private
Ausgabe einen Success-Marker enthält. Der EXIT-Trap des Audits erhält den letzten
fest definierten Prüfabschnitt; private Zwischendateien werden auch bei einem
frühen oder expliziten Abbruch gelöscht. Ungeprüftes stderr, Fehlertexte und
Pfadwerte erscheinen nicht im Workflow-Log.

Die Fehlerausgabe enthält nur `PRODUCTION_AUDIT_VERIFIED=false`, einen festen
`PRODUCTION_AUDIT_FAILURE_CODE`, den allowlisteten
`PRODUCTION_AUDIT_FAILED_STAGE` und den normalisierten Exit-Code. Fehlt eine
auswertbare Stufe, lautet sie `unknown`; ein Fehler der abschließenden
Pass-Prüfung lautet `validation`.

Ein gesondert vollständig validierter Runtime-Teil kann zusätzlich
`PRODUCTION_RUNTIME_VERIFIED=true` melden. Dafür müssen derselbe erwartete
Production-Commit, alle acht Health-Komponenten, genau ein PM2-Prozess im
Cluster-Modus mit CWD `/var/www/fanmind-current`, beide Fehlertracking-
Schalter, nginx, HTTP und die Host-Messwerte bestehen. Er dokumentiert die
Shell-Node-Version getrennt von `PRODUCTION_PM2_NODE_VERSION` (PM2-Prozessmetadaten),
die acht einzelnen Health-Status, Restart-Zähler, nginx-Status, Boot-ID und
Host-/Prozess-Uptime. Dieser Teilnachweis schließt weder den Gesamt-Audit noch
Backup-/Restore-Arbeit oder den Ubuntu-Neustart ab. Für den Neustart sind
separate Vorher-/Nachher-Messungen mit geänderter Boot-ID erforderlich.

## Dokumentation eines Laufs

### Separater Autostart-Nachweis vor dem Ubuntu-Neustart

Der normale Deploy installiert zusätzlich `production-boot-readiness.mjs`
root-owned und nur lesbar in `/usr/local/lib/fanmind-audit`. Der bestehende Audit
ruft diesen Collector unprivilegiert auf. Er liest ausschließlich systemd-
Properties, feste geschützte Startup-Dateien, die eigene Runner-cgroup und die gespeicherte PM2-Prozessliste;
er führt weder einen gespeicherten Befehl noch eine Service-Änderung aus.

`PRODUCTION_BOOT_READINESS_VERIFIED=true` verlangt:

- nginx, `pm2-ubuntu`, Backup-Worker, die fünf Backup-/Retention-Timer und den
  Operations-Monitor-Timer jeweils `loaded|enabled|active|no`; das letzte Feld
  ist `NeedDaemonReload`. Ausstehender Reload oder eine fehlende Messung
  sperrt den Nachweis, weil beim Boot die Dateien statt des systemd-Caches gelten;
- den tatsächlich ausführenden GitHub-Runner über seine eigene systemd-cgroup
  gebunden, mit Benutzer `ubuntu`, ebenfalls dauerhaft enabled und active;
- vollständige Unit-Definitionen statt nur aktiver Zustände: alle zehn
  Repository-Definitionen für Worker, Timer und deren tatsächlich gestartete
  Dienste sind im Collector per SHA-256 gebunden. nginx, PM2 und Runner
  benötigen unabhängige bestätigte Unit-Prüfsummen. Fragment-Dateien und alle
  Pfadkomponenten müssen root-eigen und gegen fremde Schreibzugriffe geschützt
  sein; zusätzliche Drop-ins sowie jede nichtleere oder fehlende `Conditions`-
  oder `Asserts`-Messung verhindern den Pass. Das gilt auch für die vom Timer
  ausgelösten One-Shot-Dienste. Geänderte Befehle nach `daemon-reload` werden
  dadurch auch bei weiterhin gesundem laufenden Prozess erkannt;
- den PM2-Start als `ubuntu`, `forking`, mit dem festen PM2-Home/PIDFile und
  ausschließlich dem gespeicherten `pm2 resurrect`-Startbefehl; zusätzliche
  `ExecCondition`-/`ExecStartPre`-/`ExecStartPost`-Hooks, Environment-Dateien,
  zusätzliche Environment-Werte und unbekannte Startumgebungen werden abgelehnt;
  beim Herunterfahren ist nur derselbe PM2-Pfad mit `kill` erlaubt, zusätzliche
  `ExecStopPost`-Befehle bleiben gesperrt. Auch der Runner darf keine eigenen
  Stop-/StopPost-Befehle besitzen;
- root-eigene, nicht durch andere beschreibbare PM2-/Node-Startpfade; der erste
  ausführbare Node-Treffer im systemd-PATH muss derselbe sein wie beim Audit.
  Auch ein früheres beschreibbares oder nicht vorhandenes PATH-Verzeichnis
  verhindert diesen Nachweis. Es wird kein gefundener Befehl ausgeführt;
- genau einen gespeicherten FanMind-Prozess im Cluster-Modus, stabilem CWD,
  Next-Startpfad, einer Instanz, Autorestart, Production-Umgebung und exakt dem
  geprüften Release. Die höchstens 1 MiB große reguläre PM2-Datei wird ohne
  Symlinks und mit Eigentümer-/Schreibrechte-/Änderungsprüfung gelesen.
  PM2 entfernt `instances` beim Dump und speichert je laufendem Worker einen
  Eintrag: entscheidend ist deshalb genau ein gespeicherter Eintrag, nicht das
  Vorhandensein dieses Felds. Ein expliziter anderer Instanzwert bleibt ungültig.
  Zusätzliche `node_args`/`interpreter_args` sowie Node-/Loader-Overrides in
  gespeicherten Top-Level- oder Environment-Werten verhindern ebenfalls den Pass;
- den tatsächlichen Zielpfad des stabilen Release-Links unter
  `/var/www/fanmind-releases/<expectedCommit>`, denselben Next deployment ID
  und vorhandene reguläre Build-/Startdateien. Ein nur im Environment
  behaupteter Release-Commit reicht nicht;
- für den aktuellen Runner: passender `runsvc.sh`-Start und WorkingDirectory,
  leere zusätzliche Hooks/Service-Environment-Eingänge, passende `.service`-
  und `.runner`-Bindung an die aktuell ausführende Identität/Workspace sowie
  vorhandene geschützte Registrierungsdateien und ausführbare Startartefakte.
  Die zwei offiziellen Startup-Skripte aus `actions/runner` v2.337.0 sind per
  SHA-256 gebunden; diese Version wurde im Production-Audit 34683879279
  beobachtet. Geänderte Skripte nach einem Runner-Update verlangen erneutes
  Review. `.path` und `.env` dürfen keine zusätzlichen Loader-Optionen einführen.
  Jeder gespeicherte PATH-Eintrag muss existieren, root-eigen und entlang des
  gesamten Pfads gegen fremde Schreibzugriffe geschützt sein, auch nach dem
  ersten Systemverzeichnis und bei Symlinks.
  Credentials werden nur über Dateimetadaten geprüft, nie gelesen oder ausgegeben.
  Das beweist keine künftige Provider-Anmeldung und ersetzt keinen Recovery-Zugang.
  Registrierung benötigt gültige positive Agent-/Pool-IDs, ein HTTPS-Pipelines-
  Ziel unter `actions.githubusercontent.com` und im V2-Flow ein passendes
  Broker-Ziel; Credentials, Query und Fragment sind in den URLs ausgeschlossen.
  Zusätzlich muss die vollständige `.runner`-Datei exakt der unabhängig
  bestätigten SHA-256 entsprechen. Ein anderer syntaktisch gültiger GitHub-
  Tenant oder eine bloß passende öffentliche Repository-URL genügt nicht.
  Die nativen Listener-/Node-Dateien müssen zusätzlich mit jeweils genau einem
  tatsächlich laufenden Programm derselben Runner-cgroup, Startargumente und
  Arbeitsverzeichnis übereinstimmen: Kernel-Dateiidentität, ELF-Format und
  SHA-256 sowie unveränderte Metadaten vor/nach dem Lesen. Ersetzte Dateien oder
  verweigerter Kernel-Zugriff sperren den Nachweis. Kein Kandidat wird ausgeführt.

Die externe Referenz liegt ausschließlich unter
`/etc/fanmind/production-boot-reference.json`, als reguläre root-eigene Datei
ohne Symlinks und fremde Schreibrechte (höchstens 4096 Bytes). Das feste Schema
enthält ausschließlich `schemaVersion: 1` sowie die vier kleingeschriebenen
64-stelligen SHA-256-Werte `runnerRegistrationSha256`, `nginxUnitSha256`,
`pm2UnitSha256` und `runnerUnitSha256`. Die Registrierung wird als vollständige
Datei in ihrer bestätigten Byte-Darstellung gebunden, die Units als vollständige
Fragment-Dateien. Es dürfen keine privaten Registrierungswerte ins Git oder Log.

Ein authentifizierter Operator muss die echte laufende Runner-Registrierung und
die erwarteten Unit-Definitionen unabhängig bestätigen, den Review-Beleg
dokumentieren und erst danach diese Referenz geschützt installieren. Niemals
eine Referenz ungeprüft aus den gerade untersuchten Dateien erzeugen. Audit und
normaler Deploy erstellen oder aktualisieren diese Referenz nicht. Ihre aktuelle
Production-Existenz ist nicht belegt; bis zur bestätigten Installation bleiben
`BOOT_REFERENCE_BOUND`, `BOOT_UNIT_CONTRACTS` und die gesamte Boot-Bereitschaft
bei fehlender Referenz false. Ein erfolgreicher Source-Rollout schließt diese
konkrete externe Voraussetzung nicht automatisch ab.

Leere strukturierte Properties können in Ubuntu systemd 255 auch bei
`systemctl show --all` vollständig fehlen: Der
[offizielle systemd-Printer](https://github.com/systemd/systemd/blob/v255/src/systemctl/systemctl-show.c)
gibt `Exec*` und `EnvironmentFiles` nur innerhalb seiner Elementschleife aus.
Der [generische Printer](https://github.com/systemd/systemd/blob/v255/src/shared/bus-print-properties.c)
kennzeichnet nicht darstellbare strukturierte Werte wie
Conditions/Asserts als `[unprintable]`; auch dieser Marker beweist keine Leere.
Der Collector fragt ausschließlich fehlende oder so markierte bekannte Array-Properties zusätzlich
über [busctl](https://manpages.ubuntu.com/manpages/noble/man1/busctl.1.html) ab.
`GetUnit` muss die bereits geladene, exakt benannte Unit auflösen; anschließend
gelten nur erfolgreiche Antworten mit exaktem Interface, Array-Typ und null
Elementen als leer. Das umfasst auch Conditions/Asserts und den leeren Runner-
ExecStop. Falsche Anzahl/Typen, zusätzliche Daten, Abfragefehler und nichtleere
Werte bleiben gesperrt. Bereits dargestellte Werte werden nicht überschrieben.
Es gibt keine Service-Aktivierung, implizite Reparatur oder Rohwert-Ausgabe.

Die authentifizierte Owner-Gegenprobe vom 13. September 2026 bestätigte alle vier
PM2-Hooks direkt als leer. Sie identifizierte außerdem `dump.pm2` mit Modus 0664;
die ausgeführte Korrektur wurde als 0600 bestätigt. Der gespeicherte App-/Release-
Vertrag und die Rechte werden nach dem normalen Rollout erneut geprüft. Diese
Teilnachweise ersetzen weder die unabhängige Referenz noch die übrigen Boot-Gates.

Ausgegeben werden nur feste Rollen, normalisierte Zustände, Boolesche Werte und
drei feste Diagnosecodes unter `PRODUCTION_BOOT_DIAGNOSTIC_PM2_STARTUP`,
`PRODUCTION_BOOT_DIAGNOSTIC_PM2_SAVED_APP` und
`PRODUCTION_BOOT_DIAGNOSTIC_BOOT_NODE`. Der Collector meldet jeweils die erste
nicht bestätigte Bedingung, beispielsweise `start_command`, `release_binding`
oder `path_unverified`. `file_unverified` bestätigt keine konkrete Dateifehler-
ursache; `startup_unverified` bedeutet, dass Node ohne parsebaren PM2-Startvertrag
nicht geprüft werden konnte. Ein passender Teilvertrag ergibt `ok`. Alle Codes
stammen aus einer festen Liste; Werte und Fehlertexte werden niemals übernommen.
Fehlende, doppelte oder unbekannte Diagnosecodes werden zu `unknown`.
Die Diagnosen ändern keine Pass-Bedingung und ersetzen keinen Booleschen
Nachweis. Auch `ok` kann einen fehlenden oder falschen Boot-Check nicht ersetzen.
Unbekannte, fehlende und doppelte Unit-/Boolesche Messwerte verhindern den Boot-Pass; private
Unit-Properties, Runner-Namen, PM2-Environment und Dateiinhalte erscheinen
nicht im Log. Ein manueller Audit außerhalb der Runner-cgroup kann weiterhin
den bisherigen Operations-Vertrag erfüllen, aber keine Runner-Boot-Bindung
beweisen. Unbekannte Startup-Formate werden geprüft, nicht automatisch repariert.

Die bisherige Operations-Pass-Prüfung bleibt unverändert. Ihr Erfolg allein ist
keine Neustartbereitschaft; vor dem Neustart sind **beide** Resultate sowie
frische Ziel-/Recovery-Fakten nötig. Auch der Boot-Pass beweist nur diese
Startvoraussetzungen: Konsole/SSH-Recovery, unveränderte aktuelle Zielinstanz,
ein freies Wartungsfenster und tatsächliche Vorher-/Nachher-Messungen bleiben
erforderlich. Keine laufenden Deploy-/Backup-/Restore-Jobs unterbrechen.

Beim kontrollierten Neustart ausschließlich die bestätigte bestehende
Production-Instanz verwenden, niemals Reinstall/Reset. Danach erneut denselben
Release, nginx, alle acht Health-Komponenten, echte PM2-Node-Version und
Restart-Zähler messen. Erst eine geänderte Host-Boot-ID beweist den Ubuntu-
Neustart. Einen zurückgesetzten PM2-Zähler niemals als Boot-Nachweis oder als
Beweis für fehlende frühere Restarts interpretieren. Kein neuer Backup-/DB-
Restore-Lauf ist nötig, wenn der bereits akzeptierte frische Nachweis ausreicht.

PM2 dokumentiert [Startup und gespeicherte Prozessliste](https://pm2.keymetrics.io/docs/usage/startup/)
als getrennte Voraussetzungen und verlangt nach Node-Upgrades eine Prüfung des
Startup-Skripts.

### Laufbeleg

In #524 und #644 werden nur die redigierten Felder dokumentiert:

- Audit-Zeitpunkt und Run-ID;
- Release-Synchronität;
- Health-, PM2-, nginx-, Disk-/RAM- und Reboot-Status;
- die beiden normalisierten Server-Fehlertracking-/E-Mail-Schalter;
- systemd-/Timer-Gesamtbild;
- Backup-Paaranzahlen, Alter und checksum-only-Ergebnis;
- Offsite-Erreichbarkeit/Paarstatus;
- Backup-Worker-Zähler im 24-Stunden- und 14-Tage-Fenster;
- verbleibende Maßnahmen.

Keine Rohkonfiguration, kein vollständiges Journal und keine Secret-bearing Artefakte werden an Issues angehängt.
