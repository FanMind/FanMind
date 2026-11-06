-- Workspace-Isolation Diagnose und sichere Reparaturvorlage.
-- Keine Secrets eintragen. Ergebnisse nur mit anonymisierten E-Mails/IDs teilen.
-- Diese Datei löscht keine Kontakte, Nachrichten oder Workspace-Daten.

-- 1) Mitgliedschaften je Nutzer prüfen: Mehrere Workspace-Mitgliedschaften sind im MVP verdächtig.
select
  wm.user_id,
  count(*) as membership_count,
  array_agg(wm.workspace_id order by wm.created_at nulls last, wm.id) as workspace_ids,
  array_agg(wm.role order by wm.created_at nulls last, wm.id) as roles
from public.workspace_members wm
group by wm.user_id
having count(*) > 1
order by membership_count desc, wm.user_id;

-- 2) Besitzer-Workspace je Nutzer prüfen.
select
  w.owner_user_id as user_id,
  count(*) as owned_workspace_count,
  array_agg(w.id order by w.created_at nulls last, w.id) as owned_workspace_ids
from public.workspaces w
group by w.owner_user_id
having count(*) <> 1
order by owned_workspace_count desc, user_id;

-- 3) Fremde Mitgliedschaften finden: Nutzer ist Mitglied in einem Workspace, den er nicht besitzt.
select
  wm.id as membership_id,
  wm.user_id,
  wm.workspace_id,
  wm.role,
  w.owner_user_id as workspace_owner_user_id
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
where w.owner_user_id is distinct from wm.user_id
order by wm.user_id, wm.workspace_id;

-- 4) Reparatur für einen konkret bestätigten falsch zugeordneten Nutzer.
-- Platzhalter ersetzen und in einer Transaktion ausführen. Keine Kontakt-/Nachrichtentabellen anfassen.
-- begin;
-- insert into public.workspaces (name, owner_user_id, plan_id, commercial_option, setup_fee_cents, monthly_fee_cents, commitment_months)
-- select 'FanMind Workspace', :'wrong_user_id', 'starter', 'starter_no_setup_commitment', 0, 0, 0
-- where not exists (select 1 from public.workspaces where owner_user_id = :'wrong_user_id');
-- insert into public.workspace_members (workspace_id, user_id, role)
-- select w.id, :'wrong_user_id', 'owner'
-- from public.workspaces w
-- where w.owner_user_id = :'wrong_user_id'
--   and not exists (
--     select 1 from public.workspace_members wm
--     where wm.workspace_id = w.id and wm.user_id = :'wrong_user_id'
--   );
-- delete from public.workspace_members wm
-- using public.workspaces w
-- where wm.workspace_id = w.id
--   and wm.user_id = :'wrong_user_id'
--   and w.owner_user_id is distinct from :'wrong_user_id'
--   and wm.workspace_id = :'wrong_workspace_id';
-- commit;
