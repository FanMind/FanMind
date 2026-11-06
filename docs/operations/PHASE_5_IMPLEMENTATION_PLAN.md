# Phase 5 Implementation Plan

Stand: 3. August 2026

Dieses Dokument trennt den bereits produktiv abgenommenen technischen
Phase-5-Umfang von den weiterhin externen beziehungsweise bewusst
deaktivierten Abschlussnachweisen. Die ausführliche aktuelle Produkt- und
Betriebswahrheit steht in `docs/SOURCE_OF_TRUTH.md`.

## Bereits umgesetzt

- Operations Foundation aus PR #535: Health-Endpunkt, Operations Center, Admin-Bell und Metadatentabellen.
- Backup-/Worker-Teilblock: sicheres Jobmodell, atomare Job-Übernahme, separater Worker, server_config/database/storage/full-Backups, age-Verschlüsselung, rclone-Offsite-Adapter, systemd-Dokumentation und Admin-UI zum Einreihen.
- Operations Monitor mit zehnminütigem Production-Timer, persistiertem
  `nginx.service`-Status und geprüfter Warning-/Critical-/Recovery-Lifecycle-
  Logik. Operations-E-Mail bleibt bewusst deaktiviert.
- Server-Error-Tracking mit checksum-gebundenem, manuell aktiviertem
  Production-Control-Path, begrenzten Fingerprints, Retention und redigierter
  Abnahme. Es werden keine Nachrichten, Stacks, Header, Request-Bodies,
  IP-Adressen, CRM-Inhalte oder Secrets gespeichert; eine öffentliche
  Fehler-Teststrecke existiert nicht.
- Dauerhafter read-only Production-Audit nach Deployments und täglich mit
  Release-, Runtime-, Health-, PM2-, nginx-, Hostressourcen-, Backup- und
  Worker-Prüfung.
- Isolierter Release-Deploy mit atomischem Release-Symlink,
  commit-gebundener Deployment-ID, PM2-Rolling-Reload, Übergangsprüfung und
  automatischem Rolling-Rollback bei fehlgeschlagener Abnahme.
- Fail-closed Environment-Governance, Staging-Preflight, Vorlage und manueller
  commit-genauer Staging-Deploy-Workflow. Schreibende Remote-Tests gegen
  Production sind blockiert.
- Restore-Drill-Codepfad mit exklusiver Zielgrenze, checksum-only
  Ressourcencheck, transaktionalem Datenbank-Runner, privatem Postcheck und
  redigiertem Evidence-Validator.

## Weiterhin extern oder bewusst deaktiviert

- Externe Alarmierung per E-Mail ist noch nicht produktiv aktiviert. Der
  technische Notification-Lifecycle ist vorhanden; Aktivierung benötigt
  bestätigte Empfänger-, Datenschutz- und Betriebsregeln.
- Separater HTTPS-Host, separates Supabase-Projekt, Staging-Runner sowie DNS
  und TLS sind real bereitgestellt. Der Stripe-Testkatalog ist read-only
  nachgewiesen. Offen bleiben Webhook-/Billing-Lifecycle sowie der reale Lauf
  der vorbereiteten synthetischen E2E-/Billing-Fixtures. Die vorhandene Policy
  und Automation ersetzen den externen Abnahmenachweis nicht.
- Der tatsächliche isolierte Restore muss gegen die geschützte
  `restore-drill`-Umgebung ausgeführt werden. Datenbank-, Storage-,
  Server-Konfigurations- und Cleanup-Nachweise bleiben bis zu diesem externen
  Lauf offen.
- Der formale Phase-5-Abschluss ist erst zulässig, wenn diese externen
  Nachweise vorliegen. Bereits produktiv abgenommene Technik darf dabei nicht
  erneut als offen oder unimplementiert ausgewiesen werden.

Phase 3 und Meta-Integrationen werden in diesem Block nicht verändert.
