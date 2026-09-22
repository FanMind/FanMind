# FanMind Account-Deletion-Request-Schema

Stand: Juli 2026

Diese Dokumentation ergänzt `docs/database/fanmind_current_schema.md` um die service-role-only Request-Infrastruktur für vollständige Account-Löschungen.

## Migration

```text
supabase/migrations/20260724103000_account_deletion_requests.sql
```

## Tabelle `account_deletion_requests`

Zweck: authentifizierte Löschanfragen nachvollziehbar, statusfähig und widerrufbar verwalten, ohne Browser- oder Mobile-Clients direkten Datenbankzugriff zu geben.

Wichtige Felder:

- `id`: öffentliche Request-Referenz als UUID;
- `user_id`: interne Auth-User-Zuordnung während der Bearbeitung;
- `workspace_id`: optionaler historischer Workspace-Kontext;
- `owned_workspace_ids`: service-role-only Snapshot aller unmittelbar vor der Auth-Löschung tatsächlich eigenen Workspaces; nur für crash-sichere Vollständigkeitsprüfung beim Resume;
- `notification_email`: ausschließlich für persönliche Eingangs-/Abschlussbestätigung;
- `user_reference_hash`: pseudonyme HMAC-SHA-256-Referenz nach Auth-Löschung;
- `request_source`: `web` oder `mobile`;
- `confirmation_version`: aktuell `v1`;
- `status`: `pending`, `blocked`, `processing`, `completed`, `completed_notification_pending`, `cancelled` oder `failed`;
- `requires_ownership_transfer`: andere Workspace-Mitglieder blockieren die destruktive Bearbeitung;
- `requires_subscription_resolution`: aktives/ungeklärtes Abo blockiert die destruktive Bearbeitung;
- `requested_at`;
- `processing_deadline_at`: maximal 31 Tage, im Produktvertrag 30 Tage;
- `cancelled_at`;
- `processing_started_at`;
- `completed_at`;
- `acknowledgement_sent_at`;
- `completion_notification_sent_at`;
- `last_error_code`: ausschließlich stabiler maschinenlesbarer Code;
- `created_at`, `updated_at`.

## Bewusste Foreign-Key-Grenze

`user_id` besitzt absichtlich keinen Foreign Key zu `auth.users`. Sonst würde die Request-Zeile beim Löschen des Auth-Users verschwinden oder die Löschung blockieren. Nach erfolgreicher Löschung setzt der Processor:

- `user_id = null`;
- `workspace_id = null`;
- `owned_workspace_ids = null`;
- `user_reference_hash` auf einen serverseitigen HMAC-SHA-256-Wert;
- `notification_email = null`, sobald die Abschlussbestätigung zugestellt wurde.

Die Constraint erlaubt eine Zeile ohne `user_id` ausschließlich in einem abgeschlossenen Status mit pseudonymer Referenz.

## RLS und Rollenrechte

- RLS ist aktiv.
- `PUBLIC`, `anon` und `authenticated` haben keine Tabellenrechte.
- Es existiert bewusst keine Client-Policy.
- Nur `service_role` besitzt `SELECT`, `INSERT`, `UPDATE` und `DELETE`.
- Web und Mobile verwenden ausschließlich die authentifizierte Next.js-API `/api/account-deletion`.
- Die API liefert nur die reduzierte Darstellung aus `publicAccountDeletionStatus(...)`.

## Idempotenz

Ein partieller Unique Index erlaubt pro `user_id` nur eine Anfrage in:

- `pending`;
- `blocked`;
- `processing`.

Wiederholte Mobile-/Web-Anfragen liefern den bestehenden Status zurück und erzeugen keine parallelen Löschjobs.

## Datenminimierung

Nicht gespeichert werden:

- Bestätigungsphrase;
- Browser-/Mobile-Token;
- Passwort;
- Request-Body;
- IP-Adresse;
- User-Agent;
- Providerfehler;
- Kundendaten aus Kontakten, Nachrichten oder Kontaktwissen.

Die Operations-Benachrichtigung enthält keine E-Mail oder User-ID. Sie verwendet nur Request-ID, Quelle, Deadline und Blocker-Booleans.

## Keine automatische Löschung

Es gibt keinen Trigger oder Timer, der beim Insert destruktive Änderungen ausführt. Die Tabelle ist eine Request-/Status-Queue. Der separat installierte Processor ist Dry-Run per Default und benötigt für Execute drei ausdrückliche Gates.

## Schema-Reader-Regel

Bei Änderungen an dieser Tabelle müssen gleichzeitig geprüft werden:

1. Migration unter `supabase/migrations/`;
2. `src/lib/accountDeletionPolicy.mjs`;
3. `src/lib/accountDeletionRequests.ts`;
4. `scripts/operations/process-account-deletion.mjs`;
5. `docs/mobile/ACCOUNT_DELETION.md`;
6. Tests in `tests/account-deletion-policy.test.mjs`;
7. `docs/SECURITY_RLS_SECRETS_CHECK.md`.


## Crash-sicheres Workspace-Inventar

Der kontrollierte, normale Web-Deploy-unabhängige Vertrag
`supabase/controlled/20260922213000_account_deletion_workspace_inventory.sql`
ergänzt `owned_workspace_ids uuid[]` mit maximal 100 Einträgen. Dieser Vertrag
wird **nicht** durch den normalen Deploy angewendet.

Der Operations-Processor bleibt im Dry-run ohne diesen Vertrag lesbar. Vor
jedem echten `--execute` muss er jedoch den vollständigen aktuell eigenen
Workspace-ID-Snapshot zusammen mit dem Übergang auf `processing` erfolgreich
persistieren. Fehlt die Spalte oder kann der Snapshot nicht exakt zurückgelesen
werden, stoppt die Ausführung vor der Auth-Löschung. Nach einem Crash mit bereits
gelöschtem Auth-User darf Resume ausschließlich den gespeicherten Snapshot für
die Workspace-Daten-Nachprüfung verwenden. Ein fehlender/alter Request ohne
Snapshot wird fail-closed nicht als vollständig gelöscht markiert.

Der Übergang auf `processing` friert außerdem die für die Löschfreigabe
relevanten dynamischen Blocker ein. Solange der Request `processing` ist, dürfen
für die gespeicherten Workspaces weder Abo-/Billing-Felder verändert noch fremde
Workspace-Mitgliedschaften hinzugefügt, entfernt oder auf einen anderen
Workspace/User verschoben werden. Die eigene Mitgliedschaft des zu löschenden
Users bleibt für die spätere Löschbereinigung veränderbar. Ein Resume sperrt
`workspaces` und `workspace_members` erneut read-stabil, verifiziert den exakten
Workspace-Snapshot und berechnet Mitgliedschafts- und Abo-Blocker nochmals.
Jeder nachträglich festgestellte Blocker-Drift stoppt fail-closed vor weiterer
destruktiver Fortsetzung.

Damit werden übertragene historische Workspaces nicht fremd traversiert,
während alle beim destruktiven Start tatsächlich eigenen Workspaces auch nach
Auth-Cascade noch vollständig nachgeprüft werden können.
