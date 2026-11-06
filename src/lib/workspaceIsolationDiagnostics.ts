export const WORKSPACE_ISOLATION_DIAGNOSTIC_SQL = `
-- Nur als Supabase-Admin ausführen. Keine Kontakte, Nachrichten oder Secrets ausgeben.
select
  w.id as workspace_id,
  w.owner_user_id,
  count(distinct wm.user_id) as member_count,
  count(distinct c.id) as contact_count,
  bool_or(wm.user_id <> w.owner_user_id) as has_non_owner_members
from workspaces w
left join workspace_members wm on wm.workspace_id = w.id
left join contacts c on c.workspace_id = w.id
group by w.id, w.owner_user_id
having count(distinct wm.user_id) <> 1
   or bool_or(wm.user_id <> w.owner_user_id)
order by member_count desc, workspace_id;
`;

export function getWorkspaceIsolationDiagnosticSql(): string {
  return WORKSPACE_ISOLATION_DIAGNOSTIC_SQL.trim();
}
