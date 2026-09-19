# Admin-CRM-Zugang: kontrollierter Datenbank-Rollout

Stand: 15. September 2026

## Zweck und Grenze

Die Web-Anwendung benötigt die atomare RPC und die restriktive RLS-Grenze aus
`supabase/migrations/20260915221500_admin_crm_access.sql`. Ein normaler
Production-Deploy wendet diese Datei nicht an. Bis zum erfolgreichen Postflight
darf im Adminbereich kein echter Zugang vergeben, befristet oder gesperrt
werden.

Dieser Ablauf enthält keine Stripe-, Tax-, Zahlungs- oder Nutzerdatenmutation.
Das Anwenden auf Production benötigt trotzdem eine separate ausdrückliche
Production-Freigabe für genau diese Datei, den exakten gemergten Commit und das
exakte Supabase-Production-Projekt. Die Feature-Freigabe oder der Web-Deploy
ersetzen diese Freigabe nicht.

## 1. Offline-Prüfung

Auf dem exakt zu veröffentlichenden Commit:

```bash
npm run db:admin-crm-access:check
```

Erwartung: `ADMIN_CRM_ACCESS_OFFLINE_CHECK=PASS` und der im Repository
festgeschriebene SHA-256. Bei Abweichung stoppen.

## 2. Read-only Preflight

Im eindeutig geprüften Supabase-Production-Projekt im SQL Editor ausführen:

```sql
select
  to_regprocedure('public.admin_crm_read_allowed(uuid)') as read_boundary,
  to_regprocedure('public.current_admin_crm_access_state()') as access_state_rpc,
  to_regprocedure('public.admin_set_registered_user_crm_access(uuid,uuid,text,text,timestamptz)') as access_rpc;
```

Vor dem ersten Rollout müssen alle drei Werte `null` sein. Ein partieller Zustand
wird nicht überschrieben, sondern separat untersucht.

## 3. Apply

Erst nach der separaten ausdrücklichen Production-Freigabe den unveränderten
Inhalt von `supabase/migrations/20260915221500_admin_crm_access.sql` im selben
geprüften SQL Editor genau einmal ausführen. Die Datei besitzt eine eigene
Transaktion. Keine weiteren Migrationen und kein `supabase db push` ausführen.

## 4. Unabhängiger read-only Postflight

```sql
select
  to_regprocedure('public.admin_crm_read_allowed(uuid)') is not null as read_boundary_present,
  to_regprocedure('public.current_admin_crm_access_state()') is not null as access_state_rpc_present,
  to_regprocedure('public.admin_set_registered_user_crm_access(uuid,uuid,text,text,timestamptz)') is not null as access_rpc_present,
  not has_function_privilege('anon', 'public.admin_set_registered_user_crm_access(uuid,uuid,text,text,timestamptz)', 'EXECUTE') as anon_denied,
  not has_function_privilege('authenticated', 'public.admin_set_registered_user_crm_access(uuid,uuid,text,text,timestamptz)', 'EXECUTE') as authenticated_denied,
  has_function_privilege('service_role', 'public.admin_set_registered_user_crm_access(uuid,uuid,text,text,timestamptz)', 'EXECUTE') as service_role_allowed;

select count(*) > 0 as restrictive_boundaries_present
from pg_policies
where schemaname = 'public'
  and policyname = 'admin_crm_entitlement_boundary'
  and permissive = 'RESTRICTIVE'
  and roles = array['authenticated']::name[];

select exists (
  select 1 from pg_policies
   where schemaname = 'public'
     and tablename = 'workspaces'
     and policyname = 'admin_crm_entitlement_boundary'
     and permissive = 'RESTRICTIVE'
     and roles = array['authenticated']::name[]
) as workspace_boundary_present;

select
  case
    when to_regprocedure('public.creator_workspace_access_allowed(uuid)') is null then true
    else has_function_privilege('authenticated', 'public.creator_workspace_access_allowed(uuid)', 'EXECUTE')
  end as creator_access_gate_callable;

```

Alle Werte müssen `true` sein. Wenn die Creator Foundation vorhanden ist, muss ihre eigene Regression zusätzlich aktive permanente und befristete Zugänge erlauben, abgelaufene und gesperrte Zugänge ablehnen und einen normalen Nicht-Admin-CRM-Workspace unverändert erlauben; das gilt in beiden Installationsreihenfolgen. Danach zuerst mit einem synthetischen,
bestätigten Nichtkunden testen: dauerhaft freigeben, auf ein zukünftiges Datum
befristen, sperren und nach jeder Stufe Anmeldung sowie direkten
authentifizierten Supabase-Read prüfen. Keine echte Zahlung auslösen.

## 4a. Tatsächliche Sequenzabweichung vom 19. September 2026

Der erste reale dauerhafte Admin-CRM-Grant wurde nach grünem Production-Postflight,
aber **vor** der hier geforderten synthetischen Lifecycle-Abnahme durchgeführt.
Der reale Workspace ist read-only gegengeprüft: 0 EUR, `admin_crm_access=true`,
manual/no-payment und ohne Stripe-Bindung. Er wird nicht gelöscht, zurückgesetzt oder
erneut gegrantet.

Bis die fehlende synthetische Abnahme permanent -> zukünftige Befristung -> Sperre
-> Login + direkter authentifizierter Read vollständig protokolliert ist, gilt
fail-closed: **keine weiteren realen Admin-CRM-Grants**. Der bereits gewährte Account
darf nach dem separaten FM-CR-043 Routing-Hotfix nur denselben bestehenden Zugang
erneut einloggen und read-only funktional prüfen.

## 5. Production-Nutzerfreigabe

Erst nach grünem Postflight **und** der dokumentierten synthetischen Lifecycle-Abnahme darf der Platform-Admin für weitere reale Nutzer unter
`/admin/billing?tab=customers` den bereits bestätigten Nutzer dauerhaft
kostenlos freigeben. Eine spätere Befristung oder Sperre erfolgt ausschließlich
in derselben Kundenübersicht; generische Workspace-Billing-Aktionen bleiben
gesperrt. Workspace und CRM-Daten werden nicht gelöscht.
