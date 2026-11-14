-- Revision 16 / RC6 local-only database preflight. Never deploy this file to FanMind.
\set ON_ERROR_STOP on

do $preflight$
begin
  if current_setting('server_version_num')::integer < 170000
     or current_setting('server_version_num')::integer >= 180000 then
    raise exception 'tests require PostgreSQL 17.x';
  end if;
  if to_regnamespace('boerns_agent_claims') is not null then
    raise exception 'test database is not clean';
  end if;
end
$preflight$;

-- A disposable vanilla PostgreSQL database does not provide Supabase's standard
-- application roles. Create inert NOLOGIN stand-ins so the production migration's
-- explicit deny-list can be tested without weakening that migration.
do $local_supabase_roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$local_supabase_roles$;
