# FanMind Operations Monitor

## Zweck

Der Operations Monitor erzeugt datensparsame Betriebsereignisse und Admin-Meldungen für:

- öffentliche Erreichbarkeit von `/api/health`;
- aktiver Zustand des nginx-Reverse-Proxys über einen unprivilegierten,
  read-only `systemctl is-active`-Aufruf;
- PM2-Status des Prozesses `fanmind`;
- Disk- und RAM-Auslastung;
- verbleibende Gültigkeit des TLS-Zertifikats;
- Aktualität von Datenbank-, Storage-, Server-Konfigurations- und Vollbackups;
- Alter des letzten Backup-Worker-Heartbeats.

Er liest keine Kontakte, Nachrichten, Prompts, KI-Ausgaben oder Zahlungsdaten.
Der nginx-Check speichert ausschließlich den normalisierten Dienstzustand und
liest weder nginx-Konfiguration noch Journal. Ein isolierter CPU-Momentwert
wird bewusst nicht als Zehn-Minuten-Alarm verwendet: Anwendung, PM2, RAM und
Disk liefern die belastbaren Hostsignale, ohne kurzzeitige Lastspitzen als
scheinbaren Ausfall zu melden.

## Standardzustand

Nach dem Merge werden Script, Service und Timer nur installiert. Der Monitor bleibt deaktiviert, solange nicht ausdrücklich gesetzt ist:

```text
FANMIND_OPERATIONS_MONITOR_ENABLED=true
```

Der Timer wird durch das Deployment nicht automatisch aktiviert.

Der nicht geheime Monitorcode wird root-owned unter
`/usr/local/lib/fanmind-monitor/operations-monitor.mjs` installiert. Das
Verzeichnis ist mit `0755` nur les- und durchlaufbar und die Datei mit `0644`
nicht direkt ausführbar, damit die gehärteten systemd-Services sie als
unprivilegierter Benutzer `ubuntu` ausschließlich über `/usr/bin/node` lesen
können. Root-only Operations- und Aktivierungsscripte bleiben getrennt unter
`/usr/local/lib/fanmind-ops` mit Verzeichnismodus `0700` geschützt.

Auch E-Mails bleiben separat deaktiviert:

```text
FANMIND_OPERATIONS_EMAIL_ENABLED=false
```

## Aktueller Production-Stand

Die festgeschriebene Komponenten-Migration wurde am 1. August 2026 über den
getrennten Production-Lauf angewendet und anschließend unabhängig read-only
verifiziert. Der Zehn-Minuten-Timer ist auf dem Release
`d6725d71145dc26584281f669fbcd4511d912126` kontrolliert aktiviert; Operations-
E-Mails bleiben deaktiviert. Ein normaler Deploy installiert weiterhin nur
Code und Units und kann weder die Migration anwenden noch E-Mail aktivieren.

## Production-Konfiguration

Empfohlene Startwerte in `/var/www/fanmind/.env.production`:

```text
FANMIND_OPERATIONS_MONITOR_ENABLED=false
FANMIND_OPERATIONS_MONITOR_BASE_URL=https://fanmind.ch
FANMIND_OPERATIONS_EMAIL_ENABLED=false
FANMIND_OPERATIONS_DISK_WARNING_PERCENT=80
FANMIND_OPERATIONS_DISK_CRITICAL_PERCENT=90
FANMIND_OPERATIONS_MEMORY_WARNING_PERCENT=85
FANMIND_OPERATIONS_MEMORY_CRITICAL_PERCENT=95
FANMIND_OPERATIONS_SSL_WARNING_DAYS=30
FANMIND_OPERATIONS_SSL_CRITICAL_DAYS=7
FANMIND_OPERATIONS_DATABASE_BACKUP_MAX_HOURS=36
FANMIND_OPERATIONS_STORAGE_BACKUP_MAX_HOURS=36
FANMIND_OPERATIONS_CONFIG_BACKUP_MAX_HOURS=36
FANMIND_OPERATIONS_FULL_BACKUP_MAX_HOURS=192
FANMIND_OPERATIONS_BACKUP_WORKER_WARNING_MINUTES=20
FANMIND_OPERATIONS_BACKUP_WORKER_CRITICAL_MINUTES=60
FANMIND_OPERATIONS_HEALTH_EVENT_REPEAT_HOURS=6
```

Für kritische E-Mails zusätzlich:

```text
FANMIND_OPERATIONS_EMAIL_ENABLED=true
RESEND_API_KEY=<server-only>
FANMIND_NOTIFICATION_FROM=FanMind <noreply@fanmind.ch>
FANMIND_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Die Schalter dürfen erst nach einem erfolgreichen manuellen Test aktiviert werden. Schlüssel und Empfänger nicht in Logs oder Chat ausgeben.

## Datenmodell

Vor Aktivierung Migration anwenden:

```text
supabase/migrations/20260718190000_operations_monitor_components.sql
```

Ein normaler Merge oder Web-Deploy wendet diese Migration niemals an. Der
getrennte Workflow `FanMind Operations Monitor Production Migration` besitzt
zwei manuelle Aktionen:

- `verify` prüft das bereits installierte Schema ausschließlich read-only;
- `apply` wendet genau die SHA-256-gebundene Migration einmalig an und führt
  danach denselben read-only Postflight aus.

Der lokale Offline-Vertrag wird vor Veröffentlichung mit
`npm run db:operations-monitor:check` geprüft. Dieser Befehl besitzt keinen
Datenbankzugriff und keine Apply-Option.

Beide Aktionen sind auf `main`, das geschützte GitHub-Environment
`production`, den Production-Runner und den exakt ausgelieferten Release-
Commit begrenzt. Der root-eigene Runner nutzt die vorhandene geschützte
Backup-Datenbankverbindung, bindet sie an die öffentliche Supabase-
Projektreferenz und übergibt weder Passwort noch Connection-URL an GitHub.
Die SQL-Datei ist als `0600 root:root` installiert, per SHA-256 festgeschrieben
und enthält eine einzige Transaktion mit Lock- und Statement-Timeout. Vor dem
Apply müssen Tabellen, RLS, fehlende Browser-Policies/-Rechte und bestehende
Komponentenwerte den Basisvertrag erfüllen. Danach werden der exakte
Komponenten-Constraint und beide Indizes geprüft. GitHub erhält nur einen
allowlist-gefilterten technischen Ergebniscode.

Der Monitor schreibt ausschließlich technische Metadaten in:

- `system_health_events`;
- `admin_notifications`;
- `operations_audit_log` für E-Mail-Ergebnisse.

Pro Komponente wird höchstens eine aktive Monitor-Meldung geführt. Wiederholte unveränderte Fehler erzeugen keine E-Mail-Flut. Bei Eskalation wird die bestehende Meldung wieder geöffnet; bei Erholung wird sie als gelöst markiert.

Regulärer Timer, manueller Probe und synthetische Lifecycle-Abnahme verwenden
dasselbe exklusive Laufzeit-Lock unter `/run/lock`. Dadurch kann kein manueller
Abnahmelauf mit dem Zehn-Minuten-Lauf um dieselbe Meldung konkurrieren.

## Manueller Test vor Aktivierung

```bash
cd /var/www/fanmind
FANMIND_OPERATIONS_MONITOR_ENABLED=true node scripts/operations/operations-monitor.mjs
```

Danach prüfen:

1. `system_health_events` enthält nur technische Komponenten und Zusammenfassungen.
2. `/admin/operations` zeigt neue Zustände.
3. Es wurden keine Kontakt-, Nachrichten- oder Prompt-Inhalte gespeichert.
4. Bei normalem Zustand wurde keine kritische E-Mail gesendet.
5. Ein künstlich abgesenkter Disk-Warnwert erzeugt genau eine Warnung.
6. Nach Rückstellung wird dieselbe Meldung gelöst.

Der dauerhafte GitHub-Workflow `FanMind Operations Monitor Production Control`
führt diese Abnahme auf `main` reproduzierbar aus. Die Aktion `probe` startet
nur den gehärteten Einmal-Service
`fanmind-operations-monitor-probe.service`. Er erzwingt den Monitor für genau
diesen Lauf, hält E-Mail-Versand ausdrücklich ausgeschaltet und bricht ab,
sobald eine der geprüften Komponenten nicht `healthy` ist. Vor und nach dem
Einmallauf wird der installierte read-only Production-Audit gegen den exakt
bestätigten Release-Commit ausgeführt.

Schlägt der Einmallauf fehl, liest der Workflow nur das seit Beginn dieses
Laufs entstandene systemd-Journal. Ein root-owned Verifier gibt daraus
ausschließlich einen fest erlaubten Diagnosecode sowie betroffene technische
Komponenten mit `unknown`, `degraded` oder `unavailable` aus. Freitext,
Environment-Werte, technische Zusammenfassungen und andere Journalzeilen
werden nicht in das GitHub-Log übernommen.

Die Aktion `activate` verlangt zusätzlich die exakte Bestätigung
`activate-operations-monitor-production`. Erst nach einem erfolgreichen Probe
setzt das installierte, root-eigene Kontrollscript atomar ausschließlich
`FANMIND_OPERATIONS_MONITOR_ENABLED=true` und
`FANMIND_OPERATIONS_EMAIL_ENABLED=false`, aktiviert den Zehn-Minuten-Timer und
führt den normalen Service einmal aus. Noch innerhalb des atomaren
Aktivierungsblocks muss außerdem der vollständige installierte Production-Audit
grün bleiben. Dieser Abschluss-Audit läuft ausdrücklich als Production-Benutzer
`ubuntu`, damit er denselben PM2-Kontext wie die regulären Production-Audits
prüft. Seine ungefilterte Fehlerausgabe bleibt in einer lokalen temporären Datei;
GitHub erhält bei einem Fehler nur einen begrenzten technischen Statuscode. Bei
einem Fehler werden Environment-Datei und vorheriger Timerzustand
wiederhergestellt. Der Workflow checkt keinen Branch-Code aus und gibt keine
Environment-Werte aus.

Die getrennte Aktion `lifecycle` verlangt die exakte Bestätigung
`lifecycle-operations-monitor-production`. Nach einem vollständig gesunden
Probe erzeugt sie ausschließlich für die technische Komponente
`operations_monitor` die feste Folge Warnung, Kritisch und Recovery. Sie prüft
dabei, dass genau eine Meldung geöffnet, dieselbe Meldung eskaliert und danach
gelöst wird. Die beiden erwarteten E-Mail-Versuche müssen als `noop` mit dem
Grund `disabled` im Audit stehen; ein erfolgreicher Versand lässt den Lauf
scheitern. Die synthetischen Ereignisse sind in ihren Metadaten ausdrücklich
als Abnahme markiert und enthalten keine Host-, Kunden- oder Secretwerte. Bei
jedem Fehler versucht der Lauf, eine noch aktive synthetische Meldung zu lösen,
und gibt GitHub nur einen allowlist-gefilterten Diagnosecode aus.

## Timer kontrolliert aktivieren

Erst nach erfolgreichem manuellen Test:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fanmind-operations-monitor.timer
sudo systemctl start fanmind-operations-monitor.service
sudo systemctl status fanmind-operations-monitor.timer --no-pager
sudo journalctl -u fanmind-operations-monitor.service -n 100 --no-pager
```

## Deaktivieren

```bash
sudo systemctl disable --now fanmind-operations-monitor.timer
```

Zusätzlich in `.env.production`:

```text
FANMIND_OPERATIONS_MONITOR_ENABLED=false
FANMIND_OPERATIONS_EMAIL_ENABLED=false
```

## Sicherheitsgrenzen

- keine frei eingebbaren Befehle oder Pfade;
- keine Shell-Ausführung aus dem Browser;
- keine Antwortinhalte aus FanMind-Routen in Admin-Meldungen;
- keine Secrets in UI, Datenbank oder Logs;
- E-Mail nur bei neuer kritischer Eskalation und optional bei Entwarnung;
- systemd-Service ohne Root-Rechte und mit eingeschränktem Dateisystemzugriff;
- eigener root-owned Monitor-Runtime-Pfad, der für `ubuntu` nur les- und
  durchlaufbar ist; root-only Aktivierungscode bleibt davon getrennt;
- kein automatisches Aktivieren durch Deployment.
- keine automatische Datenbankmigration durch Deployment;
- Schema-Apply nur über den checksum-, Production- und Release-gebundenen
  Einmallauf mit read-only Vorher-/Nachher-Audit;
- kein E-Mail-Versand durch Probe oder Timer-Aktivierung;
- kein E-Mail-Versand durch die synthetische Lifecycle-Abnahme;
- gemeinsames exklusives Lock für Timer, Probe und Lifecycle-Abnahme;
- synthetische Zustände ausschließlich auf der reservierten technischen
  Komponente `operations_monitor`, niemals auf echten Hostsignalen;
- Aktivierung nur auf `main`, auf dem Production-Runner und gebunden an den
  exakten bereits ausgelieferten Commit;
- vor jeder Aktivierung ein vollständiger read-only Production-Audit und ein
  vollständig gesunder Einmallauf;
- atomarer Environment-Update mit Rückfall auf Datei- und Timer-Ausgangszustand.
