# Backup Runbook

## Backup-Typen

- Server-Konfiguration: `.env.production`, PM2-Dump, nginx, relevante systemd-Units und öffentliche Backup-Konfiguration.
- Datenbank: PostgreSQL-17-Custom-Format mit Eigentums- und
  Berechtigungsinformationen; Validierung mit `pg_restore --list` und dem
  receipt-fähigen Authorization Contract.
- Storage: rekursive Sicherung des Buckets `fanmind-assets` mit Manifest je Objekt.
- Vollbackup: kombiniert erfolgreiche Teilbackups plus zentrales Manifest.

## Verschlüsselung

Automatische Backups verwenden age Public-Key-Verschlüsselung. Auf Production liegt nur der öffentliche Empfänger in `FANMIND_BACKUP_PUBLIC_KEY_FILE`, z. B. `/etc/fanmind-backup/recipient.txt`. Der private Schlüssel bleibt offline und darf nie auf Production oder ins Repository.

## Manuelle Ausführung

1. Production-Migrationen manuell in Supabase prüfen und in exakt dieser Reihenfolge anwenden:
   1. `20260711120000_phase_5_operations_foundation.sql`
   2. `20260711143000_phase_5_backup_worker.sql`
   3. `20260711161500_disable_verify_backup_until_safe_validation.sql`
   4. `20260711170000_grant_backup_worker_rpc_service_role.sql`
2. Vor der Worker-Installation bestätigen: `service_role` hat `EXECUTE` auf `public.claim_admin_backup_job(text, integer)`, `PUBLIC`, `anon` und `authenticated` nicht; `service_role` hat außerdem `USAGE` auf Schema `public` für den PostgREST-RPC-Lookup.
3. Erst danach Worker und sicheren Backup-Verifier gemeinsam installieren.
4. Anschließend `20260718173000_enable_safe_backup_verification.sql` mit
   `npm run db:backup-verification:check` offline prüfen. Production-`verify`
   und der getrennt bestätigte, transaktionale Production-`apply` laufen nur
   über `FanMind Backup Verification Production Migration`; ein Web-Deploy
   wendet die Migration niemals automatisch an. Diese Migration aktiviert
   ausschließlich den nun vorhandenen festen Jobtyp `verify_backup`.
5. Worker starten.
6. Als Platform-Admin unter `/admin/operations` einen Backup-Job und getrennt **Letztes Backup prüfen** einreihen.
7. Logs mit `journalctl` prüfen.
8. `backup_runs`, Verification-Lauf, In-App-Benachrichtigung und Audit-Eintrag prüfen.


## Leerlaufprüfung nach Start

Wenn keine Backup-Jobs anstehen, darf `claim_admin_backup_job` über PostgREST auch `null`, `[]` oder eine leere Composite-Zeile wie `{ id: null, job_type: null }` zurückgeben. Erwartetes Worker-Verhalten im Leerlauf: kein `job_claimed` mit leerer ID, kein `job_type_not_allowed`-Loop, keine Admin-Benachrichtigung und kein Audit-Eintrag. Der nächste Claim erfolgt nach `FANMIND_BACKUP_POLL_MS` (Standard: 30 Sekunden). Heartbeats sind separat über `FANMIND_BACKUP_HEARTBEAT_MS` getaktet (Standard: 5 Minuten), damit ein ruhender Worker keine unnötig dichten `system_health_events` erzeugt.

## PrivateTmp und finale Ablage

`fanmind-backup-worker.service` verwendet weiterhin `PrivateTmp=true`. Das private temporäre Arbeitsverzeichnis und `FANMIND_BACKUP_ROOT` können deshalb unterschiedliche Dateisysteme sein; ein direkter Cross-Filesystem-`rename()` ist nicht zulässig und wird nicht als Platzierungsmechanismus verwendet.

Klartext-Dumps und unverschlüsselte Tar-Dateien dürfen nur im privaten Temp-Bereich des Workers existieren. `encryptedFinalize()` entfernt den Klartext nach erfolgreicher age-Verschlüsselung. Nach `/var/backups/fanmind` beziehungsweise den konfigurierten Backup-Root gelangen ausschließlich verschlüsselte `.age`-Dateien und ihre `.age.sha256`-Prüfsummen.

Die dauerhafte Ablage erfolgt als copy/verify/finalize-Prozess: `.age` und `.age.sha256` werden zuerst als eindeutig benannte versteckte `.part`-Dateien direkt im Backup-Root angelegt, dort gelesen, per SHA256 gegen das Worker-Ergebnis und die kopierte Prüfsummendatei validiert und erst danach innerhalb des Backup-Root atomar umbenannt. Die Reihenfolge ist bewusst: zuerst die finale `.age.sha256`, danach die finale `.age`. Das Paar gilt erst dann als verwendbar, wenn beide finalen Dateien vorhanden sind.

Bei Fehlern muss geprüft werden, dass keine versteckten `.part`-Dateien und kein irreführendes finales `.age` ohne gültige Prüfsumme zurückgeblieben sind. Bestehende finale Backup-Namen dürfen nicht überschrieben werden; eine Kollision ist ein Fehler, der manuell untersucht werden muss.


## Release-Commit im Vollbackup-Manifest

`/etc/fanmind-backup/worker.env` enthält die stabile Worker-Konfiguration und Secrets. Der aktuell ausgerollte Git-Commit wird separat in `/etc/fanmind-backup/release.env` verwaltet; diese Datei darf ausschließlich eine Zeile `FANMIND_RELEASE_COMMIT=<40-stelliger-lowercase-git-sha>` enthalten. Keine echten ENV-Inhalte oder Secrets gehören in Git oder Logs.

Das Production-Deployment schreibt `release.env` nach dem Checkout des ausgerollten Commits atomar mit dem root-eigenen Helper `write-backup-release-env.sh`. Erst danach darf ein möglicher Worker-Restart erfolgen. Ist `fanmind-backup-worker.service` bereits aktiv, startet das Deployment ihn nach erfolgreichem App-Deployment neu, damit die neue Release-ID geladen wird. Ist der Worker inaktiv oder disabled, wird er nicht automatisch gestartet und nicht enabled.

Bei der Validierung eines Vollbackups muss das zentrale Manifest `production_commit` mit dem tatsächlich ausgerollten 40-stelligen Commit enthalten. `production_commit=unknown` ist nur ein Degraded-/Fallback-Zustand und weist darauf hin, dass `release.env` fehlt oder keine Release-Commit-Variable im Worker-Prozess vorhanden war.

## Validierung

- Server-/Storage-Archive: `tar -tzf` vor Verschlüsselung.
- Datenbank: `pg_dump` und der kanonische Authorization Contract verwenden
  denselben offenen `REPEATABLE READ`, `READ ONLY` Snapshot. Der Custom Dump
  wird ohne `--no-owner` und ohne `--no-privileges` erzeugt. Vor der
  Verschlüsselung muss `pg_restore --list` mindestens je einen aktiven `ACL`-
  und `DEFAULT ACL`-TOC-Eintrag nachweisen. Anzahl und SHA256 der
  Berechtigungs-TOC-Einträge sowie der separate Rollen-Fingerprint
  `role_fingerprint_sha256` und seine positive `role_record_count` werden in
  `manifest.authorization_contract` gebunden. Dasselbe gilt für
  `database_container_fingerprint_sha256` und
  `database_container_record_count`: Sie binden Datenbank-Owner, effektive
  Datenbank-ACL, current-database-Rolleneinstellungen, Encoding/Locale,
  gespeicherte und tatsächliche Collation-Version, Tablespace und weitere
  wiederherstellungsrelevante Containerattribute. Ein Collation-Drift stoppt
  die Veröffentlichung.
- Der Authorization Contract verwendet Schema 2 und
  `postgresql-17-acl-json-array-hex-v2`. Das Manifest bindet außerdem die
  vollständige sortierte `required_extensions`-Descriptorliste, deren SHA256
  sowie `extension_fingerprint_sha256` und `extension_record_count`. Der
  Extension-Fingerprint umfasst portable Definitionen der direkten
  Production-Member und ihrer rekursiven internen/automatischen
  `pg_depend`-Closure. Eine nicht unterstützte Extension-Objektklasse stoppt
  die Backup-Veröffentlichung fail-closed.
- Die Source-Verbindung verwendet ausschließlich das private
  `FANMIND_BACKUP_PGPASSFILE`, das reviewte absolute
  `FANMIND_BACKUP_DB_CA_CERT_PATH`, `sslmode=verify-full` und deaktiviertes
  GSS-Fallback. Geerbte libpq-Routing-, Service- und Passwortvariablen werden
  verworfen. Passfile und CA werden ohne Symlink-Folge stabil gelesen und als
  private mode-`0600`-Dateien je Backup-Job eingefroren; alle Datenbankprozesse
  verwenden nur diese Snapshots.
- Nur Datenbank-Teilmanifeste mit `format_version=2`,
  `privileges_archived=true`, `ownership_archived=true` und einem vollständig
  validen Authorization Contract sind als Restore-Quelle zulässig. Ältere
  verschlüsselte Backups bleiben für die allgemeine Prüfsummen- und
  Inhaltsprüfung erhalten, dürfen aber kein Full-Backup-Restore-Receipt
  erzeugen und sind kein vollständiger Wiederherstellungsnachweis.
- Verschlüsselte Datei: SHA256-Datei neben dem `.age`-Artefakt.
- Offsite: rclone beendet erfolgreich, bevor `offsite_status=uploaded` gesetzt wird.

## Restore

Restore ist absichtlich nicht in der Web-App implementiert. Ein Restore-Test bleibt ein offener Phase-5-Abschlussblock und muss separat auf einer Testumgebung dokumentiert werden. Das redigierte Abschlussprotokoll wird mit `npm run restore:evidence:verify -- --input <datei>` fail-closed geprüft; dieser Validator ersetzt den tatsächlichen isolierten Restore nicht.

## Retention

Für das MVP gilt die schlanke 1-1-1-Policy: Datenbank, Storage und Server-Konfiguration behalten jeweils einen aktuellen täglichen, einen davon zeitlich getrennten wöchentlichen und einen zeitlich getrennten monatlichen Wiederherstellungspunkt. Vollbackups werden nur wöchentlich erstellt und behalten deshalb einen wöchentlichen und einen monatlichen Stand. Die Retention behandelt `.age` und `.age.sha256` immer als Paar, überspringt unvollständige Paare und schützt selbst bei einer Null-Konfiguration mindestens das neueste vollständige Paar. Vor dem Aktivieren einer echten Löschung muss der Dry-Run auf Production geprüft werden.

```bash
sudo FANMIND_BACKUP_ROOT=/var/backups/fanmind node /usr/local/lib/fanmind-ops/backup-retention.mjs --dry-run
```

## Phase 5 blocker resolution notes

Full backups are complete only when one encrypted `fanmind-full-*.tar.gz.age` and its adjacent `.age.sha256` exist outside the temporary directory. The encrypted full tar contains encrypted server-config, database and storage part artifacts plus their checksums and a central manifest. Treat the pair as atomic for copy, retention and offsite handling.

The server configuration backup deliberately uses Option A: `/etc/fanmind-backup` is included as `sensitive_encrypted_config` because it contains the operational material required to understand and rebuild backup automation. Never log or publish its contents; verify only encrypted artifacts and checksums on Production.

`verify_backup` was intentionally disabled in the original Phase 5 worker PR.
The later safe verifier and migration
`20260718173000_enable_safe_backup_verification.sql` re-enable only the fixed
job type after the verifier is installed. The browser cannot provide paths or
free parameters; the worker selects the eligible backup run, stays below
`FANMIND_BACKUP_ROOT` and performs checksum-only validation without decryption.
The first real job from `/admin/operations` remains a separate Production
acceptance step.
