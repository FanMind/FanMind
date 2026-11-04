import "server-only";
import { isPlatformAdminEmail } from "@/lib/admin";
import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { isSupportCase, isSupportUuid, performSupportDecision, type SupportCase, type SupportProblem, type SupportPlatform } from "./supportCentrePolicy";

export const supportCentreTime = async () => Date.now();
export const supportCentreEnabled = () => process.env.FANMIND_SUPPORT_CENTRE_ENABLED === "true";
async function database(path: string, body?: Record<string, unknown>): Promise<unknown> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !supportCentreEnabled()) throw new Error("support_unavailable");
  const response = await fetch(getSupabaseRestUrl(path), {
    method: body ? "POST" : "GET", headers: { ...getSupabaseApiKeyHeaders(key), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("support_unavailable");
  return response.json();
}
export async function supportCentreActor() {
  const { data } = await getSupabaseServerUser();
  if (!data.user || !isPlatformAdminEmail(data.user.email)) return null;
  let owner = false;
  if (supportCentreEnabled()) {
    const rows = await database(`support_centre_owners?select=user_id&user_id=eq.${encodeURIComponent(data.user.id)}&limit=1`);
    owner = Array.isArray(rows) && rows.length === 1 && rows[0].user_id === data.user.id;
  }
  return { user: data.user, owner };
}
export async function listSupportWorkspaces(): Promise<Array<{ id: string; name: string }>> {
  if (!await supportCentreActor()) throw new Error("unauthorized");
  const rows = await database("workspaces?select=id,name&order=name.asc&limit=100");
  if (!Array.isArray(rows) || rows.some(r => !isSupportUuid(r.id) || typeof r.name !== "string")) throw new Error("support_unavailable");
  return rows.map(r => ({ id: r.id, name: r.name }));
}
export type SupportAudit = { case_id: string; event: string; created_at: string };
export async function listSupportCases(workspace: string): Promise<{ cases: SupportCase[]; audit: SupportAudit[] }> {
  if (!isSupportUuid(workspace) || !await supportCentreActor()) throw new Error("unauthorized");
  const cases = await database(`support_centre_cases?select=id,workspace_id,connection_id,platform,problem,action,permission,status,created_at,expires_at,completed_at&workspace_id=eq.${workspace}&order=created_at.desc&limit=100`);
  if (!Array.isArray(cases) || cases.some(row => !isSupportCase(row, workspace))) throw new Error("support_unavailable");
  const audit = await database(`support_centre_events?select=case_id,workspace_id,event,created_at&workspace_id=eq.${workspace}&order=created_at.desc&limit=200`);
  if (!Array.isArray(audit) || audit.some(r => r.workspace_id !== workspace || !isSupportUuid(r.case_id) || !["requested", "approved", "rejected", "succeeded", "failed", "expired"].includes(r.event) || !Number.isFinite(Date.parse(r.created_at)))) throw new Error("support_unavailable");
  return { cases, audit: audit.map(r => ({ case_id: r.case_id, event: r.event, created_at: r.created_at })) };
}
/** Internal only: caller has derived the workspace/connection from verified auth. */
export async function recordSupportProblem(input: { workspace: string; connection: string; platform: SupportPlatform; problem: SupportProblem }) {
  if (!supportCentreEnabled()) return;
  await database("rpc/support_centre_report", { p_workspace: input.workspace, p_connection: input.connection, p_platform: input.platform, p_problem: input.problem });
}
export async function decideSupportCase(actor: string, workspace: string, id: string, decision: "approve" | "reject") {
  // Reauthenticate at the mutation boundary; never trust an actor supplied by a browser.
  const current = await supportCentreActor();
  if (!current?.owner || current.user.id !== actor || !isSupportUuid(workspace) || !isSupportUuid(id)) throw new Error("forbidden");
  return performSupportDecision({ workspace, id, decision }, {
    claim: async () => {
      const row = await database("rpc/support_centre_decide", { p_actor: actor, p_workspace: workspace, p_case: id, p_decision: decision });
      return row as SupportCase;
    },
    check: async () => {
      const result = await database("rpc/support_centre_check", { p_actor: actor, p_workspace: workspace, p_case: id });
      if (typeof result !== "boolean") throw new Error("invalid_check");
      return result;
    },
    finish: async (success) => {
      await database("rpc/support_centre_finish", { p_actor: actor, p_workspace: workspace, p_case: id, p_success: success });
    },
  });
}
