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
- ausschließlich erlaubte strukturierte Backup-Worker-Ereignisnamen und deren Anzahl, getrennt für die letzte Stunde, letzten 24 Stunden und 14 Tage.

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

Die Backup-Worker-Ausgabe verwendet eine feste Ereignis-Whitelist und drei Zeitfenster:

```text
BACKUP_WORKER_WINDOW=1h
BACKUP_WORKER_EVENT=1h|job_failed:0
BACKUP_WORKER_WINDOW=24h
BACKUP_WORKER_EVENT=24h|job_failed:0
BACKUP_WORKER_WINDOW=14d
BACKUP_WORKER_EVENT=14d|job_failed:<count>
BACKUP_WORKER_1H_FAILURE_EVENT_COUNT=0
BACKUP_WORKER_1H_FAILURE_FREE=true
```

Owner-Entscheidung vom 14. Oktober 2026: Der Freigabe-Verifier verlangt eine fehlerfreie letzte Stunde statt 24 Stunden. Fehlende oder widersprüchliche Ein-Stunden-Messwerte bleiben blockierend. Frische verschlüsselte Backups, checksum-only-Prüfung und Offsite-Nachweise bleiben Pflicht. Die Änderung wird erst durch die gemeinsame geschützte Installation von Collector und Verifier wirksam; ein Repository-Merge allein aktualisiert den installierten Production-Audit nicht.

Ältere, bereits behobene Fehler bleiben im 14-Tage-Fenster sichtbar, ohne den aktuellen Ein-Stunden-Zustand zu verschleiern. Ausgegeben werden nur Zähler für `worker_start`, `worker_stop`, `sigterm_received`, `claim_failed`, `job_claimed`, `job_failed`, `job_rejected` und `fatal`.

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

- Server-HEAD und `LIVE_RELEASE` sind exakt der unabhängig bestätigte erwartete Production-Commit; eine abweichende lokale `origin/main`-Referenz benötigt den unten beschriebenen unabhängigen Herkunftsnachweis (vorbereiteter Quellvertrag, noch nicht installiert);
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
- `BACKUP_WORKER_1H_FAILURE_FREE=true`.

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
- ein täglicher Lauf um 04:17 UTC liest den tatsächlich laufenden
  Production-Commit aus `/api/version` und schafft ein weiteres stabiles
  Zeitfenster, auch wenn `main` bereits weitergelaufen ist;
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
und Backup-Worker-Fehler im Ein-Stunden-Fenster ab.

## Diagnose bei Abbruch

### Vorbereitete Tracking-Provenienzkorrektur — 15. November 2026

**Source-only; nicht installiert und keine Productionfreigabe.** Im tatsächlichen
Read-only-Lauf43721201037 stimmten EXPECTED_COMMIT, SERVER_HEAD und LIVE_RELEASE
mit bb799466d2c235195fedcb4d80568f9f0bd56969 überein. Nur die lokale Trackingreferenz
war30e8ddc52557d39f7da1b69ac303106d4bf3040e. Die vier installierten Auditdateien
entsprachen vor/nach dem Lauf ihren kanonischen Repositorybytes. Dies erklärt
diesen Lauf; die nicht aufbewahrten Rohwerte des älteren43711512421 bleiben unbekannt.

Der neue Validator hält SERVER_HEAD und LIVE_RELEASE strikt auf der erwarteten
Productionversion. ORIGIN_MAIN muss genau einmal als vollständiger SHA40 vorliegen.
Ist er exakt gleich der Productionbasis, bleibt der bisherige strikte
Identitätsnachweis bestehen (LIVE_EXACT). Eine abweichende Referenz kann niemals
nach fehlgeschlagener Prüfung auf diesen Pfad zurückfallen.

Für die abweichende Referenz führt der Validator selbst zusätzliche **lesende**
Prüfungen durch; rohe TRACKING_OK-/Ancestry-Behauptungen autorisieren nichts:

1. Fester realer /var/www/fanmind-Checkout mit eigenem .git-Verzeichnis,
   nicht bare/shallow. Absolutes /usr/bin/git mit minimaler Umgebung; keine
   Replacementobjekte, Grafts, Alternates, Include-/URL-Rewrites oder Promisor-
   beziehungsweise Partial-Clone-Abkürzungen. Kein Lazy-Fetch, optionaler Lock,
   Checkout, Reset oder Git-Write.
2. Genau eine allowlistete FanMind/FanMind-Origin-URL, direkte nichtsymbolische
   refs/remotes/origin/main, exakte HEAD-/Ref-Bindung. Live/Origin müssen echte
   Commitobjekte mit erneut berechneter Objekt-ID sein; lokal Live<=Origin.
3. Ausschließlich feste GitHub-HTTPS-GET-Endpunkte für FanMind/FanMind,
   Repository-ID1259448985/default_branchmain, kanonischen Main-Commitanker
   und die zwei exakten Vergleiche Live...Origin und Origin...Mainanker.
   Base/merge-base, ahead/behind/status/total müssen konsistent sein.
   Keine Abhängigkeit vom paginierten Commitarray. HTTP200, kein Redirect,
   maximal256KiB JSON, je Request10Sekunden/5Sekunden Verbindungsaufbau;
   insgesamt fünf Requests ohne automatische Wiederholung oder API-Token.
4. Mainanker, lokaler Ref/HEAD, Konfiguration und Verzeichnisidentität werden
   danach erneut gleich gebunden. Unbekannte/fehlende Objekte, API-Ausfall,
   Rate-Limit, Timeout oder geänderte Evidenz bedeuten tracking_provenance_invalid.

Erfolgreiche historische Quellen werden als MAIN_EXACT beziehungsweise
MAIN_ANCESTOR mit SHA und beobachtetem Mainanker ausgewiesen. Der Mainanker ist
**ausschließlich Audit-Herkunftsnachweis, niemals Deploymentkandidat**. Der
Monatscontroller bleibt unverändert: ORIGIN_MAIN darf nur die Livebasis oder
den exakt freigegebenen Kandidaten enthalten. Keine dritte historische SHA wird
dort zusätzlich zugelassen; completeChecks, Backup, Restore, SQL, Owner- und
Environment-Gates bleiben unverändert. Eine separate Runtimebestätigung ist
weiterhin kein voller Backup-/Operations-PASS.

#### Tatsächlicher Installationsumfang und Rückfall

| Installierte Datei | Aktuell gemessener SHA-256 | Vorbereiteter SHA-256 / Modus |
| --- | --- | --- |
| /usr/local/lib/fanmind-audit/read-only-production-audit.sh |664be21a67ad06dd7f26d7d1dca6ca63e9b441dd58e0f26eab8a403a22c4af27|unverändert,0755,Root0:0|
| /usr/local/lib/fanmind-audit/verify-production-audit-output.mjs |e65a1af5169c3843dcb04bf3283a1e013928c26f2357c25f52847391145ca218|4422b2410502ec51cd03031c967ba7b0a3b6c7a4fb601b673bfc91635c81c882,0755,Root0:0|

Bootreadiness und Public-Health-Policy bleiben bytegleich; neue Imports sind nur
Node-Builtins. Kein neuer Rootpfad, Helper, Server, Runner, Dienst, Secret oder
kostenpflichtiger Anbieter. Der fest installierte Git-/curl-Lesepfad und die
erreichbare öffentliche GitHub-API sind spätere tatsächliche Vorbedingungen.
Der private Monatsrelease-Verifierclosure muss seinen geänderten Validatorhash
ebenfalls exakt übernehmen; dessen bisheriger Nachweis ist dadurch nicht aktuell.

Der historische One-Hour-Installer unten bleibt absichtlich unverändert auf
935d1d8/707d2270 und seine alten Datei-/Workerpins gebunden. Er lehnt die neuen
Validatorbytes ab. Die Tests verwenden deshalb eine komprimierte, SHA-geprüfte
historische Bytefixture; sie führen diese nicht als zweite Auditimplementierung
aus. Keine Pins/Approvalvariablen werden zur Installation umgedeutet.

**Vor jeder späteren Installation fehlen** ein separat geprüfter, konkret
freigegebener Übergang im bestehenden geschützten Installationsverfahren,
frische tatsächliche Host-/Datei-/Controllerbindungen und exakte Quellcommit-
und Hashfreigaben. Vorher alten Collector und Validator als sichere Root-
Rückfallkopien einfrieren; bestehenden exklusiven Hostlock verwenden. Gemischte
oder unbekannte Bytes sperren. Nach Austausch exakte Hashes und unabhängige
Version bestätigen und den vollständigen Audit ausführen. Bei technischem
Installations-/Versions-/Provenienz-/Postflightfehler beide eingefrorenen
Originale wiederherstellen und ihre Hashes unabhängig kontrollieren. Kein
Checkout-Reset, Dienstneustart, Datenbankrollback oder Backupworkerwechsel.
Bleibt ein echtes Sicherheitsgate rot, bleibt der Übergang unvollständig;
kein alleiniger Runtime-PASS ersetzt den vollständigen Audit.

Dieser Auftrag führt keine Installation und keinen neuen Productionaudit mit
ungeprüften Quellbytes aus. Mergeentscheidung und geschützte Installation sind
getrennt. Die bereits rote Production-/Monatsrelease-Zulassung bleibt bestehen.

### Geschützte Installation der Ein-Stunden-Regel

`FanMind Protected One-Hour Audit Policy Install` installiert ausschließlich die
beiden per SHA-256 gebundenen Audit-Dateien aus dem geprüften Commit
`935d1d806d09bd7291e89bcffb2250864dcf6739`. Es ersetzt nur das ebenfalls gepinnte
alte Paar oder prüft ein bereits installiertes neues Paar. Ein gemischter oder
unbekannter Stand bleibt blockiert. Keine Dienste werden neu gestartet und kein
Anwendungsrelease wird geändert.

Der Ablauf ist Owner-, current-main-, Host- und `backup-production-recovery`-
gebunden. Die vorhandene Reviewer-/Branch-/Bypass-Policy wird vorab geprüft;
nach dem Environment-Warten wird current main erneut gelesen. Die zusätzliche
Environment-Variable `FANMIND_AUDIT_POLICY_INSTALL_APPROVAL` muss exakt enthalten:

```text
<reviewed-main>:install-audit-one-hour:935d1d806d09bd7291e89bcffb2250864dcf6739:707d22702a784e3b9999d1c9ae9c1e11c096a1bc:admin-bypass-disabled
```

Branch `main`, vollständigen `reviewed_main_commit` und Bestätigung
`install-audit-one-hour` verwenden. Der fest gepinnte Root-Installer friert alle
Eingabebytes ein, nutzt den bestehenden exklusiven Backup-Installationslock und
prüft unveränderten Live-Commit vor/nach der Installation. Danach läuft der
vollständige installierte Audit als `ubuntu`, einschließlich Backup-/Offsite-
Prüfungen. Nur `PRODUCTION_AUDIT_POLICY=INSTALLED_AND_VERIFIED` gilt als Erfolg.
Scheitert die Installation oder dieser Postcheck, werden beide alten Dateien
wiederhergestellt. Private Audit-Rohdaten und stderr werden nicht veröffentlicht.

Dieser einmalige Übergang ist an den bestehenden Release `707d2270...` gebunden.
Ein neuer oder unbekannter Runtime-Stand verlangt einen separat geprüften Weg.

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
  sein; zusätzliche Drop-ins sowie fehlende/zusätzliche Bedingungen oder
  Assertions verhindern den Pass. Die einzige erlaubte nichtleere Bedingung
  ist die unten beschriebene, vollständig gebundene nginx-Standardbedingung.
  Für alle anderen Definitionen müssen `Conditions` und `Asserts` ausdrücklich
  leer sein. Das gilt auch für die vom Timer
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
  GitHub liefert den Pipelines-Tenant-Pfad bei der Registrierung über
  [ConfigurationManager](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Listener/Configuration/ConfigurationManager.cs).
  Der Owner-Abgleich vom 13. September 2026 beweist einen einzelnen undurchsichtigen
  Kennungspfad statt einer UUID. Erlaubt sind dort die Wurzel oder genau ein
  Segment aus 1–256 ASCII-Buchstaben, Ziffern, Unterstrichen oder Bindestrichen,
  optional mit abschließendem Slash. Broker behält seinen Wurzel-/UUID-Vertrag.
  Die ursprüngliche URL-Schreibweise muss passen; Ports, Whitespace, kodierte
  Separatoren, Punktsegmente und zusätzliche Pfadsegmente bleiben gesperrt.
  Der separate Runner-Admin-Flow ist in diesem belegten Vertrag nicht freigegeben.
  Zusätzlich muss die vollständige `.runner`-Datei exakt der unabhängig
  bestätigten SHA-256 entsprechen. Ein anderer syntaktisch gültiger GitHub-
  Tenant oder eine bloß passende öffentliche Repository-URL genügt nicht.
  Der [offizielle Runner-Schreiber](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Sdk/Util/IOUtil.cs)
  verwendet `Encoding.UTF8`, einschließlich einer möglichen führenden
  UTF-8-Markierung (BOM). Genau eine solche Markierung wird erst nach der
  vollständigen Hashprüfung für das JSON-Parsen entfernt; die Datei und ihre
  Referenzbytes bleiben unverändert. Doppelte/verschobene BOM und ungültiges
  JSON bleiben gesperrt. Ungültiges UTF-8 darf nicht durch verlustbehaftete
  Dekodierung dieselbe Prüfsumme wie ein gültiger Ersatzbuchstabe erhalten.
  Der Owner hat die führende BOM inzwischen auf dem Host bestätigt.
  Der [offizielle Runner](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Listener/Runner.cs)
  kann zuerst `.runner_migrated` versuchen. Diese Datei muss entweder fehlen
  oder regulär, eigentümergeführt, pfadgeschützt und einschließlich BOM exakt
  bytegleich zur unabhängig bestätigten `.runner`-Datei sein. Abweichende Bytes,
  Links, fremde Schreibrechte und Lesefehler verhindern den Pass. Nur `ENOENT`
  beweist Abwesenheit. Der Owner-Abgleich bestätigt aktuell bytegleiche Dateien.
  [CredentialManager](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Listener/Configuration/CredentialManager.cs)
  kann außerdem alternative OAuth-Credentials bevorzugen. Der hier belegte
  Vertrag verlangt deshalb die bestätigte Abwesenheit von `.credentials_migrated`;
  eine vorhandene Datei oder ein Link benötigt einen separaten geprüften Vertrag.
  Ihre Inhalte werden niemals gelesen, gehasht oder ausgegeben. Die vorhandenen
  ursprünglichen Credentials behalten ihre strenge reine Metadatenprüfung.
  Die nativen Listener-/Node-Dateien müssen zusätzlich mit jeweils genau einem
  tatsächlich laufenden Programm derselben Runner-cgroup, Startargumente und
  Arbeitsverzeichnis übereinstimmen: Kernel-Dateiidentität, ELF-Format und
  SHA-256 sowie unveränderte Metadaten vor/nach dem Lesen. Ersetzte Dateien oder
  verweigerter Kernel-Zugriff sperren den Nachweis. Kein Kandidat wird ausgeführt.

Der authentifizierte Owner-Nachweis vom 13. September 2026 bestätigt nach
Runner-Update v2.337.0 das offizielle versionierte Layout. Der
[offizielle Updater](https://github.com/actions/runner/blob/v2.337.0/src/Misc/layoutbin/update.sh.template)
legt die beiden absoluten Verknüpfungen `bin -> bin.2.337.0` und
`externals -> externals.2.337.0` innerhalb desselben Runner-Verzeichnisses an.
Der Collector akzeptiert entweder beide direkten Verzeichnisse oder genau
diese beiden absoluten Ziele. Eine gemischte Update-Phase, relative Ziele,
andere Versionen, fremde Ziele und weitere Verknüpfungen innerhalb der
Zielverzeichnisse bleiben gesperrt. Das Runner-Verzeichnis und seine Artefakte
müssen dem Runner-Benutzer gehören; alle Elternverzeichnisse müssen direkt,
gegen Gruppen-/Fremdschreiben geschützt und root- oder benutzereigen sein.

Nur die vier festen Startartefakte werden über dieses Layout auf ihre geprüften
kanonischen Dateien abgebildet. Die vollständigen Skript-Hashes bleiben Pflicht;
Registrierung, Environment, Service-Zuordnung und Credentials erhalten keine
Link-Ausnahme. Vor und nach der Konfigurations- und Kernel-Prüfung müssen
Datei-/Verzeichnisidentität, Eigentümer, Rechte, Nanosekunden-Zeitstempel und
Link-Ziele unverändert sein. Auch ein Austausch gegen einen Link mit demselben
Ziel verhindert den Pass dieser Beobachtung.

Die laufenden Programme müssen weiterhin aus derselben Service-cgroup und
dem richtigen Arbeitsverzeichnis stammen. Nur die festen Alias-/Zielpfade
mit den bekannten Startargumenten sind gültig; ELF, Kernel-Dateiidentität und
vollständiger Hash müssen zum aktuellen kanonischen Artefakt passen. Ein noch
geladenes altes Programm nach einem Update bleibt unbestätigt. Kein Kandidat
wird zur Versionsbestimmung ausgeführt, kein Link repariert und kein Dienst
automatisch neu gestartet. Native CI prüft echte kontrollierte Programmimages,
Argumente und Arbeitsverzeichnisse mit synthetischer cgroup-Zuordnung; die
echte Production-Zuordnung bleibt dem installierten Audit vorbehalten.

Die externe Referenz liegt ausschließlich unter
`/etc/fanmind/production-boot-reference.json`, als reguläre root-eigene Datei
ohne Symlinks und fremde Schreibrechte (höchstens 4096 Bytes). Das feste Schema
enthält ausschließlich `schemaVersion: 1` sowie die vier kleingeschriebenen
64-stelligen SHA-256-Werte `runnerRegistrationSha256`, `nginxUnitSha256`,
`pm2UnitSha256` und `runnerUnitSha256`. Die Registrierung wird als vollständige
Datei in ihrer bestätigten Byte-Darstellung gebunden, die Units als vollständige
Fragment-Dateien. Es dürfen keine privaten Registrierungswerte ins Git oder Log.

Der authentifizierte Owner-Abgleich vom 13. September 2026 bestätigt die exakte
nginx-Unit aus dem offiziellen
[Ubuntu-Paket nginx-common 1.24.0-2ubuntu7.17](https://security.ubuntu.com/ubuntu/pool/main/n/nginx/nginx-common_1.24.0-2ubuntu7.17_all.deb).
Ihr vollständiger SHA-256 ist
`6c759c229d4dacf65c1f98c1733646f8b979d3e75e13a98bfbcfe26f8a2f793c`.
Sie enthält `ConditionFileIsExecutable=/usr/sbin/nginx`. Der Collector erlaubt
diese eine Bedingung nur für `nginx.service`, denselben vollständigen Hash in
der unabhängigen Referenz und eine typisierte Antwort der exakt aufgelösten
D-Bus-Unit: ein Element vom Typ `a(sbbsi)`, genau dieser Bedingungstyp/Pfad,
ohne Trigger oder Negation. Die private Messmarkierung kann nicht durch einen
angezeigten String oder serialisierte Properties ersetzt werden. Die Bedingung
wird nicht als leer umgedeutet. Der historische Ergebniswert ersetzt keinen
neuen Dateinachweis: `/usr/sbin/nginx` muss aktuell eine reguläre ausführbare
Datei sein, einschließlich aller Pfadkomponenten root-eigen und gegen fremdes
Schreiben geschützt. Die [systemd-v255-Implementierung](https://github.com/systemd/systemd/blob/v255/src/shared/condition.c)
prüft Dateityp und Ausführungsbits; zusätzliche Pfadschutzprüfungen bleiben
hier erforderlich. Andere Hashes, zusätzliche/negierte Bedingungen, Assertions,
Drop-ins, fehlende Daten oder ausstehendes `daemon-reload` bleiben gesperrt.

Der gleiche Owner-Abgleich bestätigt die PM2-7.0.3- und Runner-v2.337.0-Vorlagen.
Die folgenden ausgeführten Owner-Schritte schließen die früheren Rechte- und
PATH-Befunde: Runner-Unit 0644; ursprüngliche Registrierung, PATH, Environment
und Credentials 0600; PM2-Dump weiterhin 0600. Nur `/snap/bin` fehlte in den
gespeicherten Suchpfaden. Der Owner hat dieses Verzeichnis nach Prüfung der
root-eigenen, geschützten Eltern angelegt; beide vollständigen PATH-Prüfungen
melden jetzt true. Es wurden keine Zugangsdaten zurückgesetzt oder Snap-Pakete
installiert. Production und Staging haben je einen aktiven Runner auf demselben
Host; beide benötigen frische Idle-Prüfung vor dem späteren Neustart.

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
- Backup-Worker-Zähler im Ein-Stunden-, 24-Stunden- und 14-Tage-Fenster;
- verbleibende Maßnahmen.

Keine Rohkonfiguration, kein vollständiges Journal und keine Secret-bearing Artefakte werden an Issues angehängt.

## Bounded release-contract diagnostics — 15 November 2026

Audit43711512421 completed its collector with exit0, then its installed validator
reported production_audit_release_drift. The official log contains no actual
SERVER_HEAD/ORIGIN_MAIN/LIVE_RELEASE tuple and no installed-file fingerprints;
there is no artifact. The existing EXIT trap deleted the private temporary raw
output. Therefore the historical mismatching field and installed contract version
cannot be inferred from that log. No policy correction or Production PASS is
claimed before fresh protected observation.

| Value | Existing contract meaning |
| --- | --- |
| expectedCommit | Manual/deploy-bound expected Production commit; scheduled runs resolve it independently through Production HTTPS |
| SERVER_HEAD | HEAD of the operational /var/www/fanmind Git checkout, not the release symlink or a public live-version proof |
| ORIGIN_MAIN | Local refs/remotes/origin/main; a staleable tracking ref, not an independently fetched current remote Main |
| LIVE_RELEASE | releaseCommit from the collector's Production HTTPS request |
| GITHUB_SHA | Source/workflow commit of this observation, distinct from deployed Production |

The canonical validator still requires all three observed values equal expected.
The existing monthly adapter already separately admits an exactly bound candidate
in ORIGIN_MAIN and preserves all other runtime/backup checks. The source-package
completeChecks still rejects a failed audit; no audit exemption is added.
Repository collector/validator/boot/health files are byte-identical between the
last observed Production sourcebb799466 and Main4577f4c. This is repository
source equality only, not proof of installed byte equality or a unique installed
commit. Current independent HTTPS15Nov12:11:53UTC confirms FanMind/production/
bb799466d2c235195fedcb4d80568f9f0bd56969. The existing Exoscale Production
console is connected but shows only an OS login prompt. No console input,
password reveal, new key/SSH channel or host operation was performed.

The smallest necessary follow-up extends ONLY the existing audit workflow's
observation. It does not install repository code on the host or replace the
installed validator. The inline diagnostic runs as the existing runner, without
new sudo permissions or checkout. Before/after collection it reports SHA256,
UID/GID and mode only for four fixed existing root-owned files: collector,
validator, boot dependency and public-health dependency. Symlink, writable,
non-root-owned, missing, unreadable or changing files report unavailable without
contents. The protected Operations directory is not opened or made readable.
Per-file equality establishes byte equality, not a unique installed commit.

After the unchanged installed validator runs, a bounded private-output reader
emits only single well-formed expected/workflow SHA40, AUDIT_UTC and the three
SHA40 observations, plus actual probe/validator exit codes. Missing, duplicate,
malformed, NUL-containing or oversized evidence is unavailable, never guessed.
There is no raw audit/stderr/ENV/PM2/journal/artifact upload. Existing private
files are still removed by the unchanged trap. Diagnostic output has no PASS
or admission authority; installed validator failure remains failure. A failed
collector cannot become green even if an old validator returns0.

Tests execute the actual workflow step in an isolated synthetic harness:
historical Production base, advanced Main (still red), real live/server drift,
missing/duplicate/malformed evidence, canary redaction and old-validator/process
failure. Existing monthly base/candidate and resume paths retain exact bindings;
foreign origins/server/live values, bad backups, duplicate evidence and failed
Main audit checks remain blocked. No database query, apply, worker or Root
installation and no Production deployment occurs in these tests.

Next protected step: review/merge the diagnostic source, then obtain fresh
read-only evidence through this same protected Production workflow. Keep the
real audit red until a separately evidenced complete PASS. Only after the tuple,
installed before/after hashes and corresponding reviewed Git source are known
may a focused contract correction be proposed. Do not fetch/reset the Production
checkout to conceal drift, discard ORIGIN_MAIN, exempt failed checks or install
new Root code as part of this diagnosis. Preserve the existing Backup/Recovery,
Owner, protected-environment and monthly SQL gates. PR1517 remains merged.
