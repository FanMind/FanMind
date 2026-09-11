# FanMind Backup Worker

## Ausgangsanalyse

Vorhanden aus Phase 5: `/api/health`, `/admin/operations`, `AdminNotificationsBell`, Platform-Admin-Prüfung über `FANMIND_ADMIN_EMAILS`, die Tabellen `admin_notifications`, `system_health_events`, `admin_operation_jobs`, `backup_runs`, `operations_audit_log` und die Migration `20260711120000_phase_5_operations_foundation.sql`. Fehlend waren bisher atomare Job-Übernahme, echte Backup-Ausführung außerhalb von Next.js, Zeitpläne, Verschlüsselung, Offsite-Upload und Retention.

## Architektur

Die Web-App legt ausschließlich geprüfte Jobs in `admin_operation_jobs` an. Sie nimmt keine Shell-Befehle, Dateipfade oder freien Parameter aus dem Browser an. Der separate Worker `scripts/operations/backup-worker.mjs` läuft auf Production als root-eigener systemd-Service aus `/usr/local/lib/fanmind-ops/backup-worker.mjs` und verarbeitet nur die Allowlist:

- `backup_server_config`
- `backup_database`
- `backup_storage`
- `backup_full`
- `verify_backup`

Die atomare Übernahme erfolgt über `claim_admin_backup_job(worker_id, lease_seconds)` mit `FOR UPDATE SKIP LOCKED`, Lease, Retry abgelaufener Leases und maximal einem aktiven Backup-Job. Die RPC-Funktion wird ausschließlich serverseitig mit `SUPABASE_SERVICE_ROLE_KEY` aufgerufen; `PUBLIC`, `anon` und `authenticated` dürfen kein `EXECUTE` auf diese Funktion haben, während `service_role` nach der Folgemigration `20260711170000_grant_backup_worker_rpc_service_role.sql` `EXECUTE` erhält.


## Leerlauf, RPC-Antworten und Heartbeat

PostgREST kann für `public.claim_admin_backup_job(text, integer)` bei leerer Queue je nach Composite-Rückgabetyp nicht nur JavaScript `null`, sondern auch ein leeres Array oder ein Composite-Leerobjekt wie `{ id: null, job_type: null }` liefern. Der Worker normalisiert deshalb die RPC-Antwort vor jeder Verarbeitung: `null`, `undefined`, `[]`, leere Composite-Zeilen und Jobs ohne nichtleere `id` oder ohne erlaubten `job_type` gelten nicht als ausführbarer Job. In diesem No-Job-Pfad wird kein `job_claimed` geschrieben, kein `handle(job)` aufgerufen, keine Admin-Benachrichtigung erzeugt und kein Audit-Eintrag angelegt; der Worker wartet regulär `FANMIND_BACKUP_POLL_MS` (Standard: 30 Sekunden), bevor er erneut pollt.

Ein tatsächlich beanspruchter Job mit nicht erlaubtem `job_type` wird defensiv als `failed` markiert und ohne Secrets mit `job_rejected` protokolliert. Die Allowlist des Workers umfasst `backup_server_config`, `backup_database`, `backup_storage`, `backup_full` und den später sicher ergänzten Job `verify_backup`. Der Verifier akzeptiert keine Browserpfade, bleibt unter `FANMIND_BACKUP_ROOT`, prüft nur Prüfsumme, Größe und Manifest-Metadaten und entschlüsselt kein Production-Artefakt.

Der Job-Poll bleibt über `FANMIND_BACKUP_POLL_MS` kurzfristig steuerbar. Heartbeats in `system_health_events` sind davon entkoppelt und werden über `FANMIND_BACKUP_HEARTBEAT_MS` gesteuert (Standard: 300000 ms / 5 Minuten), damit normaler Leerlauf nicht alle 30 Sekunden zusätzliche Health-Zeilen erzeugt.

## Serverpfade, Eigentümer und Rechte

- `/usr/local/lib/fanmind-ops/backup-worker.mjs`: `root:root`, `0750`
- `/usr/local/lib/fanmind-ops/database-authorization-contract.mjs`: `root:root`, `0750`
- `/usr/local/lib/fanmind-ops/verify-backup-artifact.mjs`: `root:root`, `0750`
- `/usr/local/lib/fanmind-ops/supabase-root-2021-ca.crt`: `root:root`, `0644`
- `/usr/local/sbin/fanmind-backup-worker` optionaler Wrapper: `root:root`, `0755`
- `/etc/fanmind-backup/worker.env`: `root:root`, `0600`
- `/etc/fanmind-backup/pgpass`: `root:root`, `0600`
- `/etc/fanmind-backup/recipient.txt`: `root:root`, `0644`, enthält nur den öffentlichen age-Empfänger
- `/etc/fanmind-backup/rclone.conf`: `root:root`, `0600`
- `/var/backups/fanmind`: `root:root`, `0700`

## ENV / Root-Konfiguration

Siehe `ops/systemd/fanmind-backup-worker.env.example`. Echte Werte werden nur auf dem Server gesetzt und nicht committet. Wichtig: `SUPABASE_SERVICE_ROLE_KEY` ist ausschließlich serverseitig für Worker und Admin-API vorgesehen.

## systemd

Installieren:

```bash
sudo install -d -o root -g root -m 0700 /usr/local/lib/fanmind-ops
sudo install -o root -g root -m 0644 config/certificates/supabase-root-2021-ca.crt /usr/local/lib/fanmind-ops/supabase-root-2021-ca.crt
sudo install -o root -g root -m 0750 scripts/operations/database-authorization-contract.mjs /usr/local/lib/fanmind-ops/database-authorization-contract.mjs
sudo install -o root -g root -m 0750 scripts/operations/verify-backup-artifact.mjs /usr/local/lib/fanmind-ops/verify-backup-artifact.mjs
sudo install -o root -g root -m 0750 scripts/operations/backup-worker.mjs /usr/local/lib/fanmind-ops/backup-worker.mjs
sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-worker.service /etc/systemd/system/fanmind-backup-worker.service
sudo install -o root -g root -m 0600 ops/systemd/fanmind-backup-worker.env.example /etc/fanmind-backup/worker.env
sudo node --check /usr/local/lib/fanmind-ops/database-authorization-contract.mjs
sudo node --check /usr/local/lib/fanmind-ops/verify-backup-artifact.mjs
sudo node --check /usr/local/lib/fanmind-ops/backup-worker.mjs
sudo systemd-analyze verify /etc/systemd/system/fanmind-backup-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now fanmind-backup-worker.service
```

Status und Logs:

```bash
sudo systemctl status fanmind-backup-worker.service
sudo journalctl -u fanmind-backup-worker.service -f
```

Deaktivierung/Rollback:

```bash
sudo systemctl disable --now fanmind-backup-worker.service
sudo rm -f /etc/systemd/system/fanmind-backup-worker.service
sudo systemctl daemon-reload
```

## Artefakt-Platzierung über Dateisystemgrenzen

Die systemd-Unit behält `PrivateTmp=true`. Dadurch liegt das private Worker-`/tmp` je nach Host- und Namespace-Konfiguration nicht zwingend auf demselben Dateisystem wie `FANMIND_BACKUP_ROOT` (`/var/backups/fanmind`). Der Worker verwendet deshalb keinen direkten `rename()` von PrivateTmp nach Backup-Root.

Der Klartext-Dump bleibt ausschließlich im privaten temporären Arbeitsverzeichnis und wird durch `encryptedFinalize()` nach erfolgreicher age-Verschlüsselung entfernt. Dauerhaft abgelegt werden nur das verschlüsselte `<backup>.age` und die zugehörige `<backup>.age.sha256`. Beide Dateien gelten als untrennbares Paar.

Für die finale Ablage kopiert der Worker beide verschlüsselten Quelldateien zuerst unter eindeutig benannten, versteckten `.part`-Dateien direkt in `FANMIND_BACKUP_ROOT` und legt diese Dateien mit root-only-Rechten an. Danach prüft er Existenz und Lesbarkeit, berechnet SHA256 über das kopierte `.age`-Artefakt und vergleicht den Wert sowohl mit dem Worker-Ergebnis als auch mit dem Inhalt der kopierten `.sha256`-Datei. Erst nach erfolgreicher Validierung benennt er innerhalb von `FANMIND_BACKUP_ROOT` zuerst die Prüfsumme und danach das `.age`-Artefakt auf die finalen Namen um. Diese finalen Renames bleiben damit atomar innerhalb desselben Ziel-Dateisystems; das eigentliche Backup-Artefakt erscheint erst, wenn seine Prüfsumme bereits vorhanden ist.

Bestehende finale Dateien werden nicht still überschrieben. Bei Kopier-, Prüfsummen- oder Rename-Fehlern entfernt der Worker nur die konkret erzeugten temporären Dateien sowie eine eventuell bereits finalisierte Prüfsummendatei; ein irreführendes finales `.age`-Artefakt bleibt nicht zurück. Die verschlüsselten Quelldateien werden erst nach erfolgreicher Zielvalidierung und finaler Ablage gelöscht.


## Release-Metadaten für Vollbackup-Manifeste

Die Worker-Konfiguration ist bewusst in zwei Dateien getrennt:

- `/etc/fanmind-backup/worker.env` enthält stabile Worker-Konfiguration und Secrets wie Supabase-Service-Role, Datenbankzugang, Backup-Root, age-Empfängerpfad und Offsite-Konfiguration. Diese Datei bleibt verpflichtend, root-only und wird durch Deployments nicht überschrieben.
- `/etc/fanmind-backup/release.env` enthält ausschließlich die aktuelle Release-Metadatenzeile `FANMIND_RELEASE_COMMIT=<40-stelliger-lowercase-git-sha>`. Sie enthält keine Secrets und keine weiteren Variablen.

`fanmind-backup-worker.service` lädt zuerst `worker.env` und danach optional `release.env`. Die Release-Datei ist optional, damit bestehende Installationen weiter starten; fehlt sie, bleibt `production_commit=unknown` nur als kontrollierter Degraded-/Fallback-Zustand im Vollbackup-Manifest möglich.

Das Deployment bestimmt nach `git reset --hard origin/main` den tatsächlich ausgecheckten Commit mit `git rev-parse HEAD`, validiert exakt 40 lowercase Hex-Zeichen und schreibt `/etc/fanmind-backup/release.env` über `scripts/operations/write-backup-release-env.sh` atomar. Der Helper erzeugt die temporäre Datei direkt im Zielverzeichnis, schreibt ausschließlich die eine `FANMIND_RELEASE_COMMIT`-Zeile, setzt `0600`, nutzt auf Production `root:root` und finalisiert per Rename im selben Dateisystem. Bestehende Secrets in `worker.env` werden nicht gelesen oder verändert.

Nach erfolgreichem Deployment wird ein bereits aktiver `fanmind-backup-worker.service` neu gestartet, damit die neue Release-ID geladen wird. Ist der Worker inaktiv oder nicht aktiviert, startet das Deployment ihn nicht automatisch und verwendet kein `systemctl enable`. Zukünftige Vollbackup-Manifeste müssen dadurch den tatsächlich ausgerollten Commit in `production_commit` enthalten; `unknown` signalisiert nur fehlende Release-Metadaten oder den bestehenden Fallback.

## Sicherheit

Der Worker nutzt `spawn(..., { shell:false })`, feste Jobtypen und feste Backup-Pfade. Browserdaten werden nicht als Shell-Argumente oder Dateipfade verwendet. Logs sind strukturiert und redigieren Key-/Secret-/Token-Felder. Zusätzlich werden Exception-Texte niemals direkt in Journal, `admin_operation_jobs` oder `operations_audit_log` übernommen: bekannte interne Fehler werden auf eine feste Allowlist reduziert, Prozess-, Supabase-, Konfigurations- und Dateisystemfehler erhalten generische Codes und jeder unbekannte Wert wird `backup_worker_failed`. Auch eine ungültige konfigurierte Worker-ID fällt auf eine lokal abgeleitete, feste Kennung zurück. Restore ist nicht implementiert.

## Datenbank-Authorization-Contract

Der lesende Source-Guard erkennt neben der historischen Legacy-Ausnahme auch
die bereits abgenommene Härtung von
`public.trim_conversation_messages_to_latest_50()`: exakt diese parameterlose
SECURITY-DEFINER-Triggerfunktion, ausschließlich
`search_path=pg_catalog, pg_temp`, kein effektives EXECUTE für `anon` oder
`authenticated`, EXECUTE für `service_role`. Gesamtzahl 13 und die zwölf
geschützten Nicht-Triggerfunktionen bleiben verbindlich. Genau einer der
beiden vollständigen Zustände muss vorliegen; Teilzustände, unklare Pfade oder
abweichende Privilegien werden abgewiesen. Die Prüfung ändert selbst keine Rechte.

Der historische Legacy-Zustand bleibt für vorhandene Archive und ihre
Restore-Prüfungen interpretierbar. Receipt-Schema 2, Kanonisierung und die
bestehenden Fingerprint-/ACL-Vergleiche werden nicht umgeschrieben. Neue
Sicherungen binden die tatsächlichen gehärteten ACLs in ihrem eigenen
Fingerprint. Ein alter erfolgreicher Datenbank-Restore wird dafür nicht wiederholt.

Ab Worker-Version `phase5-backup-worker-6` werden PostgreSQL-Eigentümer,
normale ACLs, Spalten-ACLs und Default ACLs als Teil des
Wiederherstellungsvertrags gesichert. Der Worker öffnet dafür eine
`REPEATABLE READ`, `READ ONLY` Source-Transaktion, erzeugt den kanonischen
Authorization Contract und hält den exportierten Snapshot offen, bis
`pg_dump --format=custom --snapshot=<snapshot-id>` abgeschlossen ist. Der Dump
verwendet weder `--no-owner` noch `--no-privileges`.

Die Source-Verbindung erhält eine vollständig neu aufgebaute libpq-Umgebung:
`PGHOSTADDR`, Service-Dateien, `PGPASSWORD` und sonstige geerbte `PG*`-Werte
werden nicht übernommen. Passfile und CA-Pfad stammen ausschließlich aus
`FANMIND_BACKUP_PGPASSFILE` und `FANMIND_BACKUP_DB_CA_CERT_PATH`; TLS ist fest
auf `verify-full`, GSS-Fallback auf `disable` gesetzt. Das Deployment
installiert das reviewte Supabase-CA-Bundle read-only neben dem Worker. Der
Worker öffnet beide Dateien ohne Symlink-Folge, verlangt einen einzelnen,
root-eigenen regulären Inode, prüft Größe, Rechte und stabile Metadaten und
friert die gelesenen Bytes anschließend als mode-`0600`-Kopien im privaten
Job-Verzeichnis ein. Snapshot-Export, `pg_dump` und die TOC-Prüfung verwenden
nur diese Kopien; eine Pfadrotation während des Backups kann die Verbindungen
damit nicht auf unterschiedliche Credentials oder CAs umlenken.

`pg_restore --list` muss anschließend aktive `ACL`- und `DEFAULT ACL`-
Einträge enthalten. Das Datenbank-Teilmanifest hat `format_version: 2`, setzt
`privileges_archived` und `ownership_archived` auf `true` und bindet unter
`authorization_contract` Fingerprint, Datensatz- und Grant-Tupelzahlen,
Required-Roles-Hash, den separaten Rollen-Fingerprint
`role_fingerprint_sha256` samt positiver `role_record_count` sowie Anzahl und
SHA256 der Archiv-ACL-TOC-Einträge. Zusätzlich bindet
`database_container_fingerprint_sha256` mit positiver
`database_container_record_count` Eigentümer, effektive Datenbank-ACL,
datenbankspezifische Rolleneinstellungen und das PostgreSQL-17-Profil der
Source-Datenbank einschließlich gespeicherter und tatsächlich verfügbarer
Collation-Version. Stimmen diese beiden Versionen nicht überein, wird kein
Backup veröffentlicht. Der Klartext-Dump wird erst danach mit age verschlüsselt.

Der Authorization Contract hat Schema 2 und die Kanonisierung
`postgresql-17-acl-json-array-hex-v2`. Er bindet zusätzlich die vollständige,
sortierte Extension-Descriptorliste mit exakter Version, Hostschema,
Extension- und Schema-Owner sowie Relokalisierbarkeit, ferner Listen-Hash,
Extension-Fingerprint und positive Record-Anzahl. Der Fingerprint erfasst die
Definitionen der direkten Production-Member und die rekursive
Internal-/Auto-/Partition-Closure (`pg_depend` `i/a/P/S`), einschließlich
portablem TOAST-Bezug, Ownern und initialen ACLs. Unterstützt werden bewusst
die in Production belegten direkten Klassen `pg_proc`, `pg_class`, `pg_type`
und `pg_language` sowie die abgeleiteten Klassen `pg_attrdef`,
`pg_constraint`, `pg_rewrite` und `pg_trigger`. Jede andere Memberklasse
bricht mit `authorization_extension_class_unsupported` ab; sie wird niemals
stillschweigend unvollständig attestiert.

Historische Datenbank-Manifeste bleiben checksum-verifizierbar. Der Verifier
darf für sie jedoch keine privaten Restore-Ausgaben oder ein
Full-Backup-Restore-Receipt erstellen. Ein neuer Full Backup nach Installation
dieser Worker-Version ist deshalb Voraussetzung für den isolierten
Restore-Drill.

## Scheduling

Zeitpläne werden durch root-eigene systemd-Timer umgesetzt. Die Timer starten keine Backups direkt, sondern rufen `enqueue-backup-job.mjs` auf und legen einen geprüften Job an. Der laufende Worker übernimmt anschließend atomar.

- `fanmind-backup-database.timer`: täglich
- `fanmind-backup-storage.timer`: täglich
- `fanmind-backup-server_config.timer`: täglich
- `fanmind-backup-full.timer`: wöchentlich

Installation der Timer:

```bash
sudo install -o root -g root -m 0755 scripts/operations/enqueue-backup-job.mjs /usr/local/lib/fanmind-ops/enqueue-backup-job.mjs
sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-enqueue@.service /etc/systemd/system/fanmind-backup-enqueue@.service
sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fanmind-backup-database.timer fanmind-backup-storage.timer fanmind-backup-server_config.timer fanmind-backup-full.timer
```

## Retention

`backup-retention.mjs` löscht nur Dateien, die dem Muster `fanmind-*.age` oder `fanmind-*.sha256` entsprechen. Vor Production-Ausführung muss Bernd den Dry-Run prüfen:

```bash
sudo FANMIND_BACKUP_ROOT=/var/backups/fanmind node /usr/local/lib/fanmind-ops/backup-retention.mjs --dry-run
```

Der systemd-Abschluss schreibt bei Fehlern ausschließlich `BACKUP_RETENTION_ERROR=<fester_code>`. Rohe Dateisystem-, Pfad- oder Exception-Texte werden nicht in das Journal übernommen.

## Production-blocker fixes before installation (#538)

This PR keeps Phase 5 in preparation; do not install the worker or run Production migrations until after merge and manual review.

- Full backups are now single encrypted tar artifacts. The tar is assembled in a protected temporary full-backup directory and contains the encrypted server-config, database and storage part artifacts, their `.age.sha256` files, and a central `manifest.json` with file names, sizes and SHA256 values.
- Every backup move treats `<artifact>.age` and `<artifact>.age.sha256` as one unit. The worker re-reads the destination checksum file and recalculates SHA256 over the destination artifact before it writes `backup_runs.checksum_reference`.
- Offsite upload copies both the encrypted artifact and its `.sha256`; upload is marked `uploaded` only after both transfers succeed.
- `FANMIND_PM2_DUMP_FILE` is required operational configuration. Production uses `/home/ubuntu/.pm2/dump.pm2`; the worker checks readability and only logs `pm2_dump_file_unreadable` if it is missing.
- Storage backup walks each prefix with offset pagination (`FANMIND_STORAGE_BACKUP_PAGE_SIZE`, max 1000), ignores `.emptyFolderPlaceholder`, rejects duplicate paths and fails if listing and downloaded counts differ.
- At the time of PR #538, `verify_backup` was intentionally disabled. The later safe verifier and migration `20260718173000_enable_safe_backup_verification.sql` re-enabled the fixed job type without browser-controlled paths or decryption.
- The server-config backup intentionally includes `/etc/fanmind-backup` as `sensitive_encrypted_config`. This captures `worker.env`, `pgpass`, `rclone.conf` and the public age recipient only inside encrypted artifacts; plaintext remains in the worker temp directory and is removed during cleanup.
- `MemoryDenyWriteExecute=true` is intentionally omitted from the service because Node.js 24/V8 on Ubuntu 24.04 may require writable executable memory during startup. Other hardening remains: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome=read-only`, explicit `ReadOnlyPaths` and explicit `ReadWritePaths`.

Manual order after merge: do not install or start the worker until all required Production migrations have been applied and reviewed in this exact order: (1) `20260711120000_phase_5_operations_foundation.sql`, (2) `20260711143000_phase_5_backup_worker.sql`, (3) `20260711161500_disable_verify_backup_until_safe_validation.sql`, (4) `20260711170000_grant_backup_worker_rpc_service_role.sql`. The fourth migration confirms `public.claim_admin_backup_job(text, integer)` exists, keeps `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`, and grants `EXECUTE` only to `service_role` so PostgREST RPC calls made with the server-side service role can claim queued jobs. Only after the safe verifier code is installed may (5) `20260718173000_enable_safe_backup_verification.sql` re-enable `verify_backup`. Then set `/etc/fanmind-backup/worker.env`; run `systemd-analyze verify /etc/systemd/system/fanmind-backup-worker.service`; start worker; enqueue a controlled backup and checksum-only verification; verify Operations Center and files under `/var/backups/fanmind`. Rollback: stop/disable the service and timers, leave backup artifacts in place, and revert queued jobs to `blocked` manually if needed.
