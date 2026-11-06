# Production: AI-Usage- und Referral-Migrationen anwenden

Stand: 2026-07-07

## Anlass

Im Live-Test laden die Admin-Seiten zwar grundsätzlich, zeigen aber noch:

- `/admin/ai-usage`: `KI-Verbrauch konnte nicht geladen werden (404). Migration evtl. noch nicht live.`
- `/admin/referrals`: `referral_program_state konnte nicht geladen werden (404). Migration evtl. noch nicht live.`

Das bedeutet: Die Anwendung ist deployed, aber die Supabase-Production-Datenbank enthält die neuen Tabellen aus PR #444 und PR #445 noch nicht oder nicht vollständig.

## Betroffene Migrationen

Diese beiden Dateien müssen auf dem Supabase-Production-Projekt angewendet werden:

1. `supabase/migrations/20260706120000_ai_usage_events.sql`
2. `supabase/migrations/20260706143000_referral_program_admin_foundation.sql`

## Sicherheitsregel

Keine Secrets in GitHub, Chat, Screenshots oder Logs posten. SQL aus dem Repository darf in Supabase SQL Editor ausgeführt werden; ENV-Werte niemals ausgeben.

## Option A: Supabase Dashboard / SQL Editor

1. Supabase Production-Projekt öffnen.
2. SQL Editor öffnen.
3. Inhalt von `supabase/migrations/20260706120000_ai_usage_events.sql` einfügen.
4. Ausführen.
5. Inhalt von `supabase/migrations/20260706143000_referral_program_admin_foundation.sql` einfügen.
6. Ausführen.

## Option B: Supabase CLI

Nur verwenden, wenn die Production-Verknüpfung und Zugangsdaten sicher eingerichtet sind.

```bash
supabase db push
```

Vorher sicherstellen, dass wirklich das Production-Projekt gemeint ist.

## Kontrolle nach Anwendung

Im Supabase SQL Editor ausführen:

```sql
select to_regclass('public.ai_usage_events') as ai_usage_events;
select to_regclass('public.referral_program_state') as referral_program_state;
select to_regclass('public.referral_program_members') as referral_program_members;
select to_regclass('public.referrals') as referrals;
select to_regclass('public.referral_discount_snapshots') as referral_discount_snapshots;
```

Erwartung: Jede Abfrage liefert den jeweiligen Tabellennamen, nicht `null`.

Danach RLS prüfen:

```sql
select relname, relrowsecurity
from pg_class
where oid in (
  'public.ai_usage_events'::regclass,
  'public.referral_program_state'::regclass,
  'public.referral_program_members'::regclass,
  'public.referrals'::regclass,
  'public.referral_discount_snapshots'::regclass
);
```

Erwartung: `relrowsecurity = true` für alle fünf Tabellen.

## Server danach neu starten

Auf `fanmind-prod-01`:

```bash
cd /var/www/fanmind
pm2 restart fanmind --update-env
pm2 save
```

## Browser-Smoke-Test

Als Admin öffnen:

- `https://fanmind.ch/admin/ai-usage`
- `https://fanmind.ch/admin/referrals`

Erwartung:

- Keine 404-Migrationsmeldung mehr.
- `/admin/ai-usage` zeigt leeren Zustand oder echte Usage-Aggregation.
- `/admin/referrals` zeigt Programmstatus `open` und 0/2000 oder echte Daten.

## Danach

Wenn beide Seiten korrekt laden, kann Issue #451 geschlossen werden. Wenn damit auch #446 erfüllt ist, kann anschließend #446 geschlossen werden.
