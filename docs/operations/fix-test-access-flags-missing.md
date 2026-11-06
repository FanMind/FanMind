# Fix: workspaces.test_access_flags fehlt

Stand: 2026-07-07

## Befund

Nach Referral Phase 2 kann `/workspace/setup` mit folgender Meldung hängen:

`Workspace konnte nicht gesucht werden: column workspaces.test_access_flags does not exist`

Ursache: Der Code erwartet die Spalte `public.workspaces.test_access_flags`, aber die Production-Datenbank hat diese Spalte noch nicht.

## Sofort-Fix in Supabase Production

Im Supabase SQL Editor ausführen:

```sql
alter table public.workspaces
  add column if not exists test_access_flags jsonb not null default '{}'::jsonb;

comment on column public.workspaces.test_access_flags is
  'Internal admin/test access flags. No public billing automation or payout logic.';
```

Danach auf dem Server:

```bash
cd /var/www/fanmind
pm2 restart fanmind --update-env
pm2 save
```

## Prüfung

```sql
select to_regclass('public.workspaces') is not null as workspaces_exists;
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'workspaces'
  and column_name = 'test_access_flags';
```

Erwartung: Eine Zeile mit `test_access_flags` und Typ `jsonb`.

## Browser-Test

- `/workspace/setup`
- `/dashboard`
- `/settings`
- `/admin/billing`
- `/admin/referrals`

sollten wieder ohne diesen Spaltenfehler laden.
