# Offsite Backups

FanMind darf langfristig nicht ausschließlich lokale Backups auf `fanmind-prod-01` behalten. Der Worker unterstützt einen rclone-Offsite-Adapter.

## Konfiguration

- `FANMIND_BACKUP_OFFSITE_ENABLED=true`
- `FANMIND_BACKUP_RCLONE_REMOTE=<remote-name>`
- `FANMIND_BACKUP_RCLONE_CONFIG=/etc/fanmind-backup/rclone.conf`
- `FANMIND_BACKUP_REMOTE_PATH=fanmind/production`

Nur verschlüsselte `.age`-Dateien werden hochgeladen. Klartextarchive werden nach erfolgreicher Verschlüsselung gelöscht.

## Degraded-Modus

Wenn Offsite nicht konfiguriert ist, scheitert der lokale Backup-Lauf nicht. Der Lauf wird als `offsite_pending`/`not_configured` markiert und erzeugt eine In-App-Meldung. Wenn rclone fehlschlägt, bleibt das lokale Backup erhalten und der Status wird `degraded`/`failed`.

## Checksum pair requirement

Offsite copies are valid only when both `<backup>.age` and `<backup>.age.sha256` are present on the remote. The worker uploads the encrypted artifact first and then the checksum file; `backup_runs.offsite_status='uploaded'` is written only after both transfers complete. If either transfer fails, the local backup remains valid but the run is marked degraded/failed for offsite follow-up.

## Retention

Die lokale Retention löscht keine Remote-Objekte. Für das Offsite-Ziel existiert ein separates, dauerhaft read-only Planungswerkzeug:

```bash
sudo -n node /usr/local/lib/fanmind-ops/offsite-backup-retention-plan.mjs --dry-run
```

Der Planer liest nur das Remote-Inventar, bewertet vollständige Paare gegen die bestehende 1-1-1-Policy und gibt ausschließlich redigierte Zähler aus. Er enthält keinen Execute-Modus und keine rclone-Mutationskommandos. Details, Production-Dry-Run und Sicherheitsgrenzen stehen in `docs/operations/OFFSITE_RETENTION.md`.
