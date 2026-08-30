import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  EXPECTED_CONTROL_SHA256,
  PROTECTED_MEMBER_WRITABLE_TABLES,
  SOCIAL_CONNECTION_PUBLIC_COLUMNS,
  evaluateWorkspaceMemberDataBoundarySql,
} from "../scripts/operations/workspace-member-data-boundary-runner.mjs";

const execFileAsync = promisify(execFile);
const controlledSqlPath =
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql";
const genericMigrationPath =
  "supabase/migrations/20260816120000_workspace_member_data_boundary.sql";
const runnerPath =
  "scripts/operations/workspace-member-data-boundary-runner.mjs";

function quotedSqlArray(block) {
  const match = block.match(/array\s*\[([\s\S]*?)\]/u);
  assert.ok(match);
  return [...match[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1]);
}

test("offline control is checksum-pinned and never applies without an explicit database mode", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_CHECKSUM=verified/u);
  assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_CONTRACT=verified/u);
  assert.match(
    output,
    /WORKSPACE_MEMBER_DATA_BOUNDARY_DATABASE_WRITE=not_performed/u,
  );
  assert.match(
    output,
    /WORKSPACE_MEMBER_DATA_BOUNDARY_READY=CHECKED_NOT_APPLIED/u,
  );

  const sql = await readFile(controlledSqlPath, "utf8");
  const evaluation = evaluateWorkspaceMemberDataBoundarySql(sql);
  assert.equal(evaluation.digest, EXPECTED_CONTROL_SHA256);
  assert.throws(
    () => evaluateWorkspaceMemberDataBoundarySql(`${sql}\n-- drift`),
    /control_checksum_mismatch/u,
  );
  await assert.rejects(stat(genericMigrationPath), /ENOENT/u);
});

test("member workspace access is a minimal no-argument database projection", async () => {
  const [sql, server, preActivation, dashboard] = await Promise.all([
    readFile(controlledSqlPath, "utf8"),
    readFile("src/lib/supabase/server.ts", "utf8"),
    readFile("src/lib/preActivation.ts", "utf8"),
    readFile("src/app/dashboard/page.tsx", "utf8"),
  ]);

  assert.match(
    sql,
    /create policy workspaces_select_requires_owner[\s\S]*as restrictive[\s\S]*for select[\s\S]*owner_user_id = \(select auth\.uid\(\)\)/u,
  );
  assert.match(
    sql,
    /create policy workspace_analysis_settings_select_requires_workspace_owner[\s\S]*as restrictive[\s\S]*for select[\s\S]*analysis_settings_owner_boundary\.owner_user_id[\s\S]*auth\.uid/u,
  );
  assert.match(sql, /workspace_analysis_settings_policy_postflight_failed/u);
  assert.match(
    sql,
    /function public\.get_current_workspace_member_safe_dashboard\(\)[\s\S]*security definer[\s\S]*current_user_id uuid := auth\.uid\(\)[\s\S]*membership_count <> 1/u,
  );
  assert.match(
    sql,
    /returns table \([\s\S]*workspace_id uuid[\s\S]*workspace_name text[\s\S]*plan_id text[\s\S]*membership_role text[\s\S]*member_processing_allowed boolean[\s\S]*\)/u,
  );
  assert.match(
    sql,
    /revoke all on function public\.get_current_workspace_member_safe_dashboard\(\)[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to authenticated/u,
  );

  const memberLoaderStart = server.indexOf(
    "export async function getUserWorkspaceMembershipDashboard",
  );
  const memberLoaderEnd = server.indexOf(
    "\nexport async function getWorkspaceSocialConnections",
    memberLoaderStart,
  );
  const memberLoader = server.slice(memberLoaderStart, memberLoaderEnd);
  assert.match(
    memberLoader,
    /rpc\/\$\{WORKSPACE_MEMBER_SAFE_DASHBOARD_RPC\}/u,
  );
  assert.doesNotMatch(memberLoader, /WORKSPACE_COLUMNS/u);
  assert.match(
    memberLoader,
    /isMissingWorkspaceMemberSafeDashboardRpc\(workspaceResult\.error\)[\s\S]*getServiceAccessToken\(\)[\s\S]*"workspaces",[\s\S]*serviceAccessToken,[\s\S]*"id,name,plan_id,billing_status,billing_suspended_at,billing_manual_override,billing_grace_until,subscription_effective_end_at,workspace_access_mode,test_access_flags"[\s\S]*\[\["id", membership\.workspace_id\]\][\s\S]*evaluateWorkspaceProcessingEntitlement/u,
  );
  assert.doesNotMatch(
    memberLoader,
    /stripe_customer_id|stripe_subscription_id|last_invoice|company_|billing_address|vat_/u,
  );
  assert.match(
    memberLoader,
    /membership\.role\.trim\(\)\.toLowerCase\(\) === "owner"[\s\S]*safeWorkspace\.membership_role !== "member"/u,
  );
  assert.match(
    server,
    /function memberSafeProjectionCompatibilityEnvelope[\s\S]*member_safe_projection: true[\s\S]*member_processing_allowed:/u,
  );
  assert.match(
    preActivation,
    /workspace\.role && workspace\.role !== "owner"[\s\S]*member_safe_projection === true[\s\S]*member_processing_allowed === true/u,
  );
  assert.match(
    dashboard,
    /workspace\.member_safe_projection === true[\s\S]*Teamzugang[\s\S]*Vertrags-, Rechnungs-, Stripe-, Steuer-, Adress- und Testzugangsdaten/u,
  );
});

test("CRM reads stay unchanged while direct writes require active ownership", async () => {
  const sql = await readFile(controlledSqlPath, "utf8");
  assert.equal(PROTECTED_MEMBER_WRITABLE_TABLES.length, 12);
  const preconditionBlock = sql.match(
    /do \$rls_precondition\$([\s\S]*?)\$rls_precondition\$;/u,
  )?.[1];
  const policyBlock = sql.match(
    /do \$policies\$([\s\S]*?)\$policies\$;/u,
  )?.[1];
  const postflightBlock = sql.match(
    /do \$policy_postflight\$([\s\S]*?)\$policy_postflight\$;/u,
  )?.[1];
  assert.ok(preconditionBlock);
  assert.ok(policyBlock);
  assert.ok(postflightBlock);
  const preconditionTables = quotedSqlArray(preconditionBlock);
  assert.ok(preconditionTables.includes("workspace_analysis_settings"));
  for (const table of PROTECTED_MEMBER_WRITABLE_TABLES) {
    assert.ok(preconditionTables.includes(table));
  }
  assert.deepEqual(
    quotedSqlArray(policyBlock),
    PROTECTED_MEMBER_WRITABLE_TABLES,
  );
  assert.deepEqual(
    quotedSqlArray(postflightBlock),
    PROTECTED_MEMBER_WRITABLE_TABLES,
  );
  assert.match(sql, /as restrictive for insert to authenticated with check/u);
  assert.match(
    sql,
    /as restrictive for update to authenticated using[\s\S]*with check/u,
  );
  assert.match(sql, /as restrictive for delete to authenticated using/u);
  assert.match(
    sql,
    /public\.workspace_owner_active_mutation_allowed\(workspace_id\)/u,
  );
  assert.match(
    sql,
    /workspace_owner_active_mutation_allowed[\s\S]*owned_workspace\.owner_user_id = \(select auth\.uid\(\)\)[\s\S]*workspace_processing_allowed_contract/u,
  );
  assert.doesNotMatch(
    sql,
    new RegExp(
      `drop policy if exists (?:${PROTECTED_MEMBER_WRITABLE_TABLES.join("|")})_[^\\n]*select`,
      "iu",
    ),
  );
  assert.doesNotMatch(sql, /FANMIND_.*RLS.*VERIFIED|member.*write.*enabled/iu);
});

test("social connector rows are owner-only for every authenticated command", async () => {
  const sql = await readFile(controlledSqlPath, "utf8");
  for (const command of ["select", "insert", "update", "delete"]) {
    assert.match(
      sql,
      new RegExp(
        `create policy social_connections_${command}_requires_workspace_owner[\\s\\S]*as restrictive[\\s\\S]*for ${command}[\\s\\S]*to authenticated`,
        "u",
      ),
    );
  }
  assert.match(sql, /service_role continues to bypass RLS/u);
  assert.match(
    sql,
    /revoke all on table public\.social_connections[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    sql,
    /revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)[\s\S]*from public, anon, authenticated/u,
  );
  const publicGrant = sql.match(
    /grant select\s*\(([\s\S]*?)\)\s*on table public\.social_connections\s*to authenticated;/u,
  );
  assert.ok(publicGrant);
  assert.deepEqual(
    publicGrant[1].split(",").map((column) => column.trim()),
    SOCIAL_CONNECTION_PUBLIC_COLUMNS,
  );
  assert.doesNotMatch(publicGrant[1], /page_access_token_encrypted/u);
  assert.match(sql, /has_any_column_privilege/u);
  assert.match(sql, /social_connections_token_ciphertext_exposed/u);
  assert.match(
    sql,
    /grant select, insert, update, delete on table public\.social_connections[\s\S]*to service_role/u,
  );
  for (const command of ["insert", "update", "delete"]) {
    const start = sql.indexOf(
      `create policy social_connections_${command}_requires_workspace_owner`,
    );
    const end = sql.indexOf("drop policy", start + 1);
    assert.match(
      sql.slice(start, end === -1 ? undefined : end),
      /workspace_owner_active_mutation_allowed/u,
    );
  }
});

test("database processing predicate is canonical, ordered and self-testing", async () => {
  const [sql, policy, server] = await Promise.all([
    readFile(controlledSqlPath, "utf8"),
    readFile("src/lib/workspaceProcessingPolicy.mjs", "utf8"),
    readFile("src/lib/supabase/server.ts", "utf8"),
  ]);
  const terminalPosition = sql.indexOf(
    "normalized_billing_status in ('cancelled', 'expired', 'refunded')",
  );
  const temporaryPosition = sql.indexOf(
    "p_test_access_flags -> 'temporary_processing_access'",
  );
  const overridePosition = sql.indexOf("p_billing_manual_override is true");
  assert.ok(terminalPosition >= 0);
  assert.ok(temporaryPosition > terminalPosition);
  assert.ok(overridePosition > temporaryPosition);
  for (const caseName of [
    "terminal_override",
    "terminal_temporary",
    "invalid_temporary_expiry",
    "invalid_grace",
    "suspended_grace",
    "active",
    "fixed_demo",
    "temporary_demo_without_db_expiry",
    "temporary_demo_with_db_expiry",
    "untrusted_demo",
  ]) {
    assert.match(sql, new RegExp(`processing_contract_${caseName}_failed`, "u"));
  }
  assert.match(
    sql,
    /fixed_demo_seed_version'[\s\S]*2026-07-26-v1/u,
  );
  assert.doesNotMatch(
    sql.slice(
      sql.indexOf("if normalized_billing_status = 'demo_free'"),
      sql.indexOf("if p_billing_manual_override", temporaryPosition),
    ),
    /temporary_demo/u,
  );
  assert.match(policy, /TEMPORARY_ACCESS_FLAG = "temporary_processing_access"/u);
  assert.match(policy, /FIXED_DEMO_SEED_VERSION = "2026-07-26-v1"/u);
  assert.match(
    server,
    /isServerBoundTemporaryDemoWorkspace\(workspaceRow\)[\s\S]*normalizeTemporaryDemoWorkspace\([\s\S]*TEMPORARY_DEMO_EXPIRED_ERROR[\s\S]*deleteExpiredTemporaryDemo/u,
  );
  const demoNormalizer = server.match(
    /async function normalizeTemporaryDemoWorkspace\([\s\S]*?\n\}\n\nasync function ensureFixedSandraDemoWorkspace/u,
  )?.[0] ?? "";
  assert.match(
    demoNormalizer,
    /!isServerBoundTemporaryDemoWorkspace\(workspace\)[\s\S]*demo_start_sessions[\s\S]*"id,status,expires_at,auth_user_id,workspace_id"[\s\S]*session\?\.status === "active"[\s\S]*TEMPORARY_DEMO_EXPIRED_ERROR[\s\S]*temporaryDemoCanonicalValues\(user\.id, sessionExpiry\)/u,
  );
  assert.doesNotMatch(
    demoNormalizer,
    /user_metadata|demo_expires_at|getTemporaryDemoExpiryState/u,
  );
});

test("member mutations and external processing stay owner-only and entitlement-sensitive", async () => {
  const [authorization, inbox, analysis, context, fans, aiReply, telegram, server] = await Promise.all([
    readFile("src/lib/workspaceAuthorization.ts", "utf8"),
    readFile("src/app/inbox/actions.ts", "utf8"),
    readFile("src/app/fans/[id]/analysisActions.ts", "utf8"),
    readFile("src/app/fans/[id]/contextActions.ts", "utf8"),
    readFile("src/app/fans/actions.ts", "utf8"),
    readFile("src/app/api/ai/reply-suggestions/route.ts", "utf8"),
    readFile("src/app/api/integrations/telegram/send-message/route.ts", "utf8"),
    readFile("src/lib/supabase/server.ts", "utf8"),
  ]);

  assert.match(
    authorization,
    /requireActiveAuthorizedWorkspaceMember[\s\S]*workspace\.role\.trim\(\)\.toLowerCase\(\) !== "owner"[\s\S]*workspace_member_mutations_disabled[\s\S]*evaluateWorkspaceProcessingEntitlement/u,
  );
  assert.match(
    authorization,
    /export async function requireActiveAuthorizedWorkspace\([\s\S]*requireAuthorizedWorkspace\(accessToken\)[\s\S]*evaluateWorkspaceProcessingEntitlement/u,
  );
  assert.match(
    authorization,
    /export async function requireContactInActiveAuthorizedWorkspace\([\s\S]*requireActiveAuthorizedWorkspace\(accessToken\)/u,
  );
  assert.match(inbox, /requireActiveAuthorizedWorkspace\(\)/u);

  const analyzeStart = analysis.indexOf(
    "export async function analyzeFanCommunication",
  );
  assert.match(
    analysis.slice(analyzeStart),
    /requireContactInActiveAuthorizedWorkspace\([\s\S]*contactId,[\s\S]*explicitAccessToken[\s\S]*OPENAI_RESPONSES_URL/u,
  );
  assert.match(
    fans,
    /syncFacebookChatForContact[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)/u,
  );
  assert.match(
    fans,
    /syncInstagramChatForContact[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)/u,
  );
  assert.match(
    fans,
    /saveFacebookReplyTarget[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)[\s\S]*upsertContactReplyTarget/u,
  );
  assert.match(
    fans,
    /getCurrentWorkspaceOrThrow[\s\S]*requireActiveAuthorizedWorkspace\(\)/u,
  );
  assert.match(
    context,
    /updateManualMemory[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)[\s\S]*deleteManualMemory[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)[\s\S]*updateManualFollowupStatus[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)[\s\S]*deleteManualFollowup[\s\S]*requireContactInActiveAuthorizedWorkspace\(contactId\)/u,
  );
  assert.match(
    aiReply,
    /requireContactInActiveAuthorizedWorkspace\([\s\S]*contactId,[\s\S]*accessToken/u,
  );
  for (const mutationSource of [fans, context, inbox, aiReply]) {
    assert.doesNotMatch(
      mutationSource,
      /requireActiveAuthorizedWorkspaceMember|requireContactInActiveAuthorizedWorkspaceMember/u,
    );
  }
  assert.match(
    telegram,
    /requireContactInActiveAuthorizedWorkspace\(contactId\)[\s\S]*sendManualTelegramMessage/u,
  );
  const telegramIngress = server.slice(
    server.indexOf("export async function findTelegramWebhookWorkspaceId"),
    server.indexOf("export async function getWorkspaceTelegramMessages"),
  );
  assert.match(
    telegramIngress,
    /postgrestSelect<WorkspaceBackfillRow>[\s\S]*evaluateWorkspaceProcessingEntitlement\([\s\S]*workspaceResult\.data[\s\S]*if \(!processing\.allowed\)[\s\S]*workspaceId: null/u,
  );
  assert.ok(
    telegramIngress.indexOf("evaluateWorkspaceProcessingEntitlement") <
      telegramIngress.indexOf("return { workspaceId: configuredWorkspaceId"),
  );
});

test("member navigation and CRM surfaces omit every owner-only mutation", async () => {
  const [
    navigation,
    dashboard,
    fans,
    detail,
    context,
    csvImport,
    inbox,
    followups,
    header,
  ] = await Promise.all([
    readFile("src/lib/workspaceNavigation.ts", "utf8"),
    readFile("src/app/dashboard/page.tsx", "utf8"),
    readFile("src/app/fans/page.tsx", "utf8"),
    readFile("src/app/fans/[id]/page.tsx", "utf8"),
    readFile("src/app/fans/[id]/FanContextPanel.tsx", "utf8"),
    readFile("src/app/fans/import/page.tsx", "utf8"),
    readFile("src/app/inbox/page.tsx", "utf8"),
    readFile("src/app/followups/page.tsx", "utf8"),
    readFile("src/components/WorkspaceHeader.tsx", "utf8"),
  ]);
  assert.match(
    navigation,
    /showOwnerArea = workspaceRole\?\.trim\(\)\.toLowerCase\(\) === "owner"/u,
  );
  assert.match(
    navigation,
    /\.\.\.\(showOwnerArea[\s\S]*\/onboarding[\s\S]*\/channels/u,
  );
  assert.match(
    navigation,
    /settingsNavigation:[\s\S]*showOwnerArea[\s\S]*\/settings\/profile/u,
  );
  assert.match(
    navigation,
    /savedViews: showOwnerArea[\s\S]*\/top-fans[\s\S]*\/reactivation/u,
  );
  for (const page of [dashboard, fans, inbox, followups]) {
    assert.match(page, /workspace\.role/u);
  }
  assert.match(
    fans,
    /memberReadOnly[\s\S]*primaryActionLabel[\s\S]*memberReadOnly \? null : \([\s\S]*CSV importieren[\s\S]*readOnly=\{memberReadOnly\}[\s\S]*memberReadOnly[\s\S]*new-fan-modal/u,
  );
  assert.match(
    detail,
    /memberReadOnly[\s\S]*readOnly=\{memberReadOnly\}[\s\S]*readOnly \? null[\s\S]*TopFanToggleForm[\s\S]*!readOnly && shouldShowFacebookHelpers[\s\S]*readOnly \? null[\s\S]*AiReplySuggestions/u,
  );
  assert.match(
    detail,
    /workspaceOwner && contact[\s\S]*markContactInboundMessagesSeen/u,
  );
  assert.match(
    detail,
    /readOnly \|\| demoConnectionsDisabled \? null[\s\S]*OriginalChatAction/u,
  );
  assert.match(
    detail,
    /contact && workspaceOwner[\s\S]*getContactReplyTarget/u,
  );
  assert.match(
    context,
    /readOnly[\s\S]*FanAnalysisReport[\s\S]*readOnly=\{readOnly\}[\s\S]*readOnly \? null[\s\S]*saveManualMemory[\s\S]*readOnly \? null[\s\S]*FollowupStatusForm/u,
  );
  assert.match(
    csvImport,
    /memberReadOnly[\s\S]*CSV-Import ist dem Workspace-Owner vorbehalten[\s\S]*CsvImportClient/u,
  );
  assert.match(
    inbox,
    /readOnly=\{memberReadOnly\}[\s\S]*!readOnly && item\.conversationId[\s\S]*readOnly \? null[\s\S]*Antwort vorbereiten/u,
  );
  assert.match(
    followups,
    /memberReadOnly[\s\S]*Nur-Lese-Modus[\s\S]*memberReadOnly \?[\s\S]*Nur Lesen[\s\S]*FollowupStatusForm/u,
  );
  assert.match(
    header,
    /primaryActionLabel\?: string[\s\S]*primaryActionLabel && primaryActionHref/u,
  );
});

test("mobile member projection and mutations are fail-closed and read-only", async () => {
  const [data, types, list, detail, create, edit, followups] = await Promise.all([
    readFile("apps/mobile/src/lib/data.ts", "utf8"),
    readFile("apps/mobile/src/types.ts", "utf8"),
    readFile("apps/mobile/app/(app)/contacts/index.tsx", "utf8"),
    readFile("apps/mobile/app/(app)/contacts/[id].tsx", "utf8"),
    readFile("apps/mobile/app/(app)/contacts/new.tsx", "utf8"),
    readFile("apps/mobile/app/(app)/contacts/[id]/edit.tsx", "utf8"),
    readFile("apps/mobile/app/(app)/followups.tsx", "utf8"),
  ]);

  const memberLoadStart = data.indexOf("const membershipResult");
  const memberLoadEnd = data.indexOf("export async function listContacts");
  const memberLoad = data.slice(memberLoadStart, memberLoadEnd);
  assert.match(
    memberLoad,
    /\.rpc\(MEMBER_SAFE_WORKSPACE_RPC\)[\s\S]*membership_role !== "member"/u,
  );
  const mobileCompatibility = memberLoad.match(
    /const compatibilityResult =[\s\S]*?safeWorkspace = \{/u,
  )?.[0] ?? "";
  assert.match(
    mobileCompatibility,
    /\.from\("workspaces"\)[\s\S]*\.select\("id,name,plan_id"\)/u,
  );
  assert.match(memberLoad, /member_processing_allowed: false/u);
  assert.doesNotMatch(
    mobileCompatibility,
    /owner_user_id|billing_status|stripe_|invoice|vat_|address/u,
  );
  assert.match(memberLoad, /isMissingMemberSafeWorkspaceRpc/u);
  assert.match(
    memberLoad,
    /role\)\.trim\(\)\.toLowerCase\(\) === "owner"[\s\S]*sicher abgelehnt/u,
  );
  assert.match(
    memberLoad,
    /\.limit\(2\)[\s\S]*membershipResult\.data\.length !== 1[\s\S]*const \[membership\] = membershipResult\.data/u,
  );
  assert.match(types, /role: "owner" \| "member"/u);
  assert.match(data, /MEMBER_MUTATIONS_DISABLED_ERROR/u);
  for (const mutation of [
    "createContact",
    "updateContact",
    "createContactMemory",
    "createFollowup",
    "completeFollowup",
  ]) {
    const start = data.indexOf(`function ${mutation}`);
    assert.notEqual(start, -1);
    assert.match(
      data.slice(start, start + 1_800),
      /workspaceRole[\s\S]*isOwnerRole/u,
    );
  }
  assert.match(list, /memberReadOnly[\s\S]*mutationReadOnly/u);
  assert.match(detail, /workspace\.role === "owner"/u);
  assert.match(create, /workspace\.role !== "owner"[\s\S]*Teamzugang · nur lesen/u);
  assert.match(edit, /workspace\.role !== "owner"[\s\S]*Teamzugang · nur lesen/u);
  assert.match(followups, /readOnly=\{workspace\.role !== "owner"\}/u);
});

test("Meta OAuth and synthetic writes recheck active owner processing", async () => {
  const paths = [
    "src/app/api/integrations/facebook/start/route.ts",
    "src/app/api/integrations/facebook/callback/route.ts",
    "src/app/api/integrations/facebook/select/route.ts",
    "src/app/channels/facebook/select/page.tsx",
    "src/app/api/integrations/instagram/start/route.ts",
    "src/app/api/integrations/instagram/callback/route.ts",
    "src/app/api/webhooks/meta/self-test/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requireActiveAuthorizedWorkspace\(\)/u, path);
  }
});

test("Meta low-level sync services are not browser-callable server actions", async () => {
  const [facebook, instagram, actions, grid, detail, worker] =
    await Promise.all([
      readFile("src/app/channels/facebookWebhookActions.ts", "utf8"),
      readFile("src/app/channels/instagramWebhookActions.ts", "utf8"),
      readFile("src/app/channels/metaSyncActions.ts", "utf8"),
      readFile("src/app/channels/ChannelsGrid.tsx", "utf8"),
      readFile("src/app/fans/[id]/page.tsx", "utf8"),
      readFile("src/app/api/internal/meta-catchup/route.ts", "utf8"),
    ]);

  for (const service of [facebook, instagram]) {
    assert.match(service, /^import "server-only";/u);
    assert.doesNotMatch(service, /^"use server";/u);
  }
  assert.match(actions, /^"use server";/u);
  assert.match(
    actions,
    /syncFacebookMessengerHistoryFromChannelPage[\s\S]*requireActiveAuthorizedWorkspace\(\)[\s\S]*syncFacebookMessengerHistory/u,
  );
  assert.match(
    actions,
    /syncInstagramMessengerHistoryFromChannelPage[\s\S]*requireActiveAuthorizedWorkspace\(\)[\s\S]*syncInstagramMessengerHistory/u,
  );
  assert.doesNotMatch(
    actions,
    /syncFacebookMessengerConversationForContact|syncInstagramMessengerConversationForContact|diagnoseFacebookDirectLinkSource/u,
  );
  assert.match(grid, /from "\.\/metaSyncActions"/u);
  assert.match(
    detail,
    /requireContactInActiveAuthorizedWorkspace\(contact\.id\)[\s\S]*diagnoseFacebookDirectLinkSource/u,
  );
  assert.match(
    worker,
    /isAuthorizedWorkerRequest[\s\S]*getWorkspaceProcessingEntitlement[\s\S]*syncFacebookMessengerConversationForContact/u,
  );
});
