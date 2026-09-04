# Website Chat — technischer Retention-Vertrag

Status: checksum-gebunden und repository-seitig geprüft; nicht angewandt,
nicht geplant und nicht aktiviert.

Die kontrollierte Datei
`supabase/controlled/20260904170000_website_chat_retention.sql` bereitet eine
einzige service-role-only RPC `manage_website_chat_retention(...)` vor. Ein
normaler Deploy und ein generischer Supabase-Migrationslauf können sie nicht
anwenden.

## Löschgrenze

Ein Lauf darf höchstens 1.000 Sitzungen bearbeiten und läuft standardmäßig als
Dry-run. Löschbar sind nur Website-Chat-Sitzungen, die abgelaufen oder
widerrufen sind. Existiert für eine Sitzung noch ein nicht abgelaufener
menschlicher Übergabenachweis, bleibt die Sitzung bis zu dessen eigenem
`expires_at` erhalten.

Beim ausdrücklich aktivierten Lauf wird ausschließlich aus
`website_chat_visitor_sessions` gelöscht. Die vorhandenen Fremdschlüssel
entfernen dazugehörige technische Message-Receipts und abgelaufene
Handoff-Nachweise. Nicht gelöscht werden:

- Kontakte und die dort geführte freiwillige E-Mail-Adresse;
- Conversations;
- eingehende Nachrichten und interne Handoff-Notizen;
- Workspaces oder Installationen.

Damit bleibt der in FanMind sichtbare Gesprächsverlauf erhalten. Die E-Mail-
Adresse folgt weiterhin dem bestehenden Kontakt-/Workspace-Lebenszyklus und
benötigt vor einer späteren Zustellung zusätzlich Rechts-/Datenschutzabnahme,
Verifizierung und einen separat freigegebenen Versandweg.

## Schutzbedingungen

- `SECURITY INVOKER`, fester Suchpfad und ausschließlich `service_role`-
  Ausführungsrecht;
- kein Browser-/`PUBLIC`-Zugriff und keine neue RLS-Policy;
- deterministische Reihenfolge, begrenzte Batchgröße und `SKIP LOCKED` beim
  tatsächlichen Löschen;
- keine Timer, Cronjobs, Provider-, KI- oder E-Mail-Aufrufe;
- Ausgabe nur aggregierter Zähler, keine IDs, E-Mail-Adressen oder Inhalte.

Lokale, rein statische Prüfung:

```sh
npm run db:website-chat-retention:check
npm run test:website-chat
```

## Noch getrennt umzusetzen

Vor jeder Anwendung sind ein eigener exact-main Staging-Verify/Apply-Pfad und
eine rollback-only Acceptance erforderlich. Sie müssen mindestens Dry-run,
begrenzte Löschung, Schutz eines noch gültigen Handoffs, Cascade nur für
technische Zeilen, Erhalt des CRM-Verlaufs, vollständigen Rollback und das
Fehlen jedes Providers nachweisen. Erst danach kann über einen weiterhin
standardmäßig deaktivierten Betriebsplan entschieden werden.
