# Meta-Webhook-Diagnose: Production-Setup

Diese Anleitung behebt die Live-Blocker für die Facebook/Meta-Webhook-Diagnose auf `/channels`.

## 1. Supabase-Migration ausführen

Die Migration liegt im Repository unter:

```text
supabase/migrations/20260614170000_create_meta_webhook_events.sql
```

Sie ist idempotent und verwendet `CREATE TABLE IF NOT EXISTS` sowie `ADD COLUMN IF NOT EXISTS`. Sie kann daher erneut auf Production ausgeführt werden, falls die Tabelle im Schema-Cache fehlt oder eine ältere Teilversion vorhanden ist.

### Option A: Supabase SQL Editor

1. Im Supabase-Dashboard das Production-Projekt öffnen.
2. **SQL Editor** öffnen.
3. Den Inhalt von `supabase/migrations/20260614170000_create_meta_webhook_events.sql` einfügen.
4. Query ausführen.
5. Prüfen, ob `public.meta_webhook_events` existiert und die Spalten enthält:
   - `workspace_id`
   - `page_id`
   - `sender_id`
   - `recipient_id`
   - `event_type`
   - `status`
   - `text`
   - `raw_payload`
   - `error_reason`
   - `created_at`

### Option B: Supabase CLI

Wenn die Production-Datenbank per CLI verknüpft ist:

```bash
supabase db push
```

Alternativ kann die einzelne SQL-Datei gegen die Production-Datenbank ausgeführt werden, z. B. über `psql` mit der Production-Connection-URL.

## 2. Server-Env setzen

Auf dem Production-Host muss serverseitig gesetzt sein:

```text
SUPABASE_SERVICE_ROLE_KEY=<Production Supabase service_role key>
```

Wichtig:

- Der Key darf **niemals** committed werden.
- Der Key darf **nicht** mit `NEXT_PUBLIC_` beginnen.
- Der Key darf **nicht** ins Frontend, in Browser-Bundles oder Logs geschrieben werden.
- Nach dem Setzen oder Ändern der Env-Variable muss die App neu gestartet bzw. neu deployed werden.

## 3. Smoke-Test

1. App neu starten/deployen.
2. `/channels` öffnen.
3. Facebook-Karte öffnen.
4. Diagnose prüfen:
   - `Service-Role-Key: verfügbar`
   - `Tabelle public.meta_webhook_events: lesbar`
5. Button **Webhook-Selbsttest starten** klicken.
6. Danach sollte `Letztes Webhook-Event` einen Zeitpunkt statt `noch keines empfangen` anzeigen.
