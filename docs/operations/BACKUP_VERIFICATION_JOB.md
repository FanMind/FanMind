# FanMind Backup Verification Job

## Zweck

Der Job `verify_backup` prüft das neueste geeignete, lokal gespeicherte FanMind-Backup erneut und unabhängig vom Erstellungsprozess. Die Prüfung ist **read-only** und führt weder Restore noch Entschlüsselung aus.

## Sicherheitsmodell

- Nur Platform-Admins können den Job über `/admin/operations` einreihen.
- Jede manuelle Anforderung verlangt eine ausdrückliche Bestätigung im
  zugänglichen FanMind-Dialog. Vor der Bestätigung bleiben Abbrechen, Schließen
  oder Escape ohne API-Aufruf; Tab und Shift+Tab bleiben im Dialog. Nach der
  Bestätigung kann der Dialog geschlossen werden, ohne den bereits
  übermittelten Auftrag abzubrechen oder erneut auszulösen. Bestätigte Aktionen
  teilen das atomare Limit von fünf Backup-Aktionen pro Platform-Admin und zehn
  Minuten; bei fehlendem Limiter wird fail-closed kein Job eingereiht.
- Die Limiter-Identität wird zweckgebunden mit HMAC-SHA256 pseudonymisiert;
  E-Mail und User-ID werden dort nicht im Klartext gespeichert.
- Die Web-App übermittelt ausschließlich den festen Jobtyp `verify_backup`.
- Browser und Job-Metadaten dürfen keinen Artefakt-, Prüfsummen- oder Shell-Pfad vorgeben.
- Der Worker wählt selbst das neueste geeignete Objekt aus `backup_runs`.
- `storage_reference` und `checksum_reference` müssen nach `realpath` innerhalb von `FANMIND_BACKUP_ROOT` liegen.
- Die Prüfsummendatei muss exakt `<artifact>.sha256` sein.
- Die bestehende SHA-256- und Größenangabe aus `backup_runs` muss mit dem Artefakt übereinstimmen.
- Der private age-Schlüssel bleibt außerhalb von Production. Deshalb ist die UI-Prüfung bewusst `checksum_only`.

## Ergebnis

Bei Erfolg:

- wird der ursprüngliche Lauf auf `validation_status=passed` gesetzt;
- entsteht ein neuer `backup_runs`-Datensatz mit `backup_type=verification`;
- enthält das Manifest nur Quell-Lauf-ID, Backup-Typ, Modus und Dateinamen;
- wird der Admin-Job als `succeeded` abgeschlossen;
- werden Admin-Benachrichtigung und Audit-Eintrag ohne Pfade oder Secrets angelegt.

Bei Fehlern wird der Job mit einem datenarmen Fehlercode beendet. Ein Restore oder eine Änderung des Backup-Artefakts findet nicht statt.

## Kontrollierte Production-Migration

Vor Nutzung auf Production manuell und nach den früheren Phase-5-Migrationen anwenden:

```text
supabase/migrations/20260718173000_enable_safe_backup_verification.sql
```

`npm run db:backup-verification:check` prüft die Datei offline gegen die fest
eingebaute SHA-256-Prüfsumme. Der getrennte manuelle GitHub-Workflow
`FanMind Backup Verification Production Migration` besitzt ausschließlich die
Aktionen `verify` und `apply`. Beide sind an `main`, den exakten live
ausgerollten Commit, das geschützte Environment `production`, den
self-hosted Production-Runner und die vorhandene root-only Datenbankidentität
gebunden. Vor und nach jeder Aktion muss der read-only Production-Audit grün
sein.

Der normale Web-Deploy installiert Runner, Migration, Systemd-Unit und
redigierenden Log-Prüfer root-owned, wendet die Migration aber niemals
automatisch an. Der Apply läuft mit Lock-/Statement-Timeout in einer
Transaktion und gibt nur allowlist-basierte Statuscodes aus, keine SQL-Fehler,
Zugangsdaten oder Tabelleninhalte.

Die Migration:

- erlaubt `verify_backup` wieder in `admin_operation_jobs`;
- erlaubt `verification` in `backup_runs`;
- nimmt `verify_backup` in die atomare Claim-Funktion auf;
- hält `EXECUTE` für `PUBLIC`, `anon` und `authenticated` gesperrt;
- gewährt `EXECUTE` ausschließlich `service_role`.

## Production-Abnahme

1. Offline-Check und geschützten Production-`verify` ausführen.
2. Falls `schema_not_ready` bestätigt ist, den getrennt bestätigten
   Production-`apply` ausführen.
3. Deployment abschließen, damit Worker und Verifier gemeinsam unter `/usr/local/lib/fanmind-ops/` liegen.
4. Vorhandenes lokales Backup-Paar unter `FANMIND_BACKUP_ROOT` bestätigen.
5. In `/admin/operations` **Letztes Backup prüfen** wählen.
6. Jobstatus, Verification-Lauf, Admin-Meldung und Audit-Eintrag kontrollieren.
7. Bestätigen, dass keine Datei verändert wurde und keine Entschlüsselung stattfand.
