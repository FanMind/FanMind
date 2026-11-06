# Operations Center

`/admin/operations` ist die Phase-5-Oberfläche für Betriebsstatus, Backup-Transparenz und sichere Backup-Job-Anforderung.

## Backup-Worker-Erweiterung

Die Oberfläche zeigt jetzt echte Metadaten aus `backup_runs` und `admin_operation_jobs`: Status, Startzeit, Größe, SHA256, Offsite-Status, Worker, Lease und Ergebnisreferenz. Platform-Admins können Server-Konfigurations-, Datenbank-, Storage- und Vollbackups einreihen. Die API führt niemals ein Backup direkt aus, sondern schreibt nur einen allowlist-geprüften Job.

Jede manuelle Backup-Aktion verlangt in einem zugänglichen FanMind-Dialog eine
ausdrückliche Bestätigung. Vor der Bestätigung bleiben Abbrechen, Schließen und
Escape ohne API-Aufruf. Nach der Bestätigung kann der Dialog auch während einer
laufenden Anfrage geschlossen werden; das bricht den bereits übermittelten
Auftrag nicht ab und löst ihn nicht erneut aus. Tab und Shift+Tab bleiben im
Dialog. Erst die Bestätigung durchläuft serverseitig das gemeinsame atomare
Rate-Limit. Pro
Platform-Admin sind höchstens fünf Anforderungen in zehn Minuten möglich; die
persistierte Limiter-Identität ist ausschließlich HMAC-SHA256-pseudonymisiert.
Fehlt die Limiter-Infrastruktur, wird kein Job eingereiht. Parallel bleibt
höchstens ein Backup- oder Verifikationsjob aktiv.

## Aktueller Production-Stand

Backup-Worker, verschlüsselte lokale Backups, Offsite-Übertragung, Retention,
read-only Production-Audit, isolierter Release-Deploy und Operations-Monitor
sind produktiv eingerichtet. Die datenschutzsparsame Server-Fehlertelemetrie
ist seit dem 1. August 2026 aktiv und durch ein getrenntes stabiles
30-Minuten-Betriebsfenster abgenommen; Operations- und Serverfehler-E-Mails
bleiben getrennt deaktiviert.

Extern beziehungsweise separat offen bleiben der echte isolierte Restore-Drill,
getrennte Staging-Ressourcen, eine ausdrücklich freizugebende E-Mail-Abnahme und
die Remote-Retention mit Löschwirkung. Ein Restore bleibt außerhalb der
Web-Oberfläche.

## Verify backup scope

The Operations Center can enqueue server-config, database, storage and full
backups. It can also enqueue the fixed `verify_backup` job. The server selects
the newest eligible `backup_runs.id`; the browser cannot provide a path,
artifact or shell parameter. The verifier resolves both references below
`FANMIND_BACKUP_ROOT`, rejects symlinks and traversal, validates checksum, size
and manifest metadata and never decrypts Production data. The first real
checksum-only job from `/admin/operations` remains a separate Production
acceptance step.
