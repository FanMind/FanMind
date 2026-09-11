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
Production-Commit, alle acht Health-Komponenten, PM2, beide Fehlertracking-
Schalter, nginx, HTTP und die Host-Messwerte bestehen. Er dokumentiert die
Shell-Node-Version getrennt von `PRODUCTION_PM2_NODE_VERSION` (PM2-Prozessmetadaten),
die acht einzelnen Health-Status, Restart-Zähler, nginx-Status, Boot-ID und
Host-/Prozess-Uptime. Dieser Teilnachweis schließt weder den Gesamt-Audit noch
Backup-/Restore-Arbeit oder den Ubuntu-Neustart ab. Für den Neustart sind
separate Vorher-/Nachher-Messungen mit geänderter Boot-ID erforderlich.

## Dokumentation eines Laufs

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
