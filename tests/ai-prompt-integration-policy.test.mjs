import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  migration: "supabase/migrations/20260726213000_workspace_ai_prompt_settings.sql",
  policy: "src/lib/aiPromptPolicy.mjs",
  policyTypes: "src/lib/aiPromptPolicy.d.ts",
  storage: "src/lib/workspaceAiPrompts.ts",
  settingsRoute: "src/app/api/ai/prompt-settings/route.ts",
  workspaceAuthorization: "src/lib/workspaceAuthorization.ts",
  supabaseServer: "src/lib/supabase/server.ts",
  settingsUi: "src/app/settings/ai-usage/AiPromptSettings.tsx",
  settingsPage: "src/app/settings/ai-usage/page.tsx",
  replyUi: "src/app/fans/[id]/AiReplySuggestions.tsx",
  replyRoute: "src/app/api/ai/reply-suggestions/route.ts",
  executionPolicy: "src/lib/aiExecutionPolicy.mjs",
  sourceOfTruth: "docs/SOURCE_OF_TRUTH.md",
};

async function sources() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, path]) => [
        key,
        await readFile(path, "utf8"),
      ]),
    ),
  );
}

test("workspace prompt storage is tenant-scoped and mutations remain server-only", async () => {
  const source = await sources();

  assert.match(
    source.migration,
    /workspace_id uuid primary key references public\.workspaces\(id\) on delete cascade/u,
  );
  assert.match(source.migration, /enable row level security/u);
  assert.match(
    source.migration,
    /member\.workspace_id =\s*workspace_ai_prompt_settings\.workspace_id[\s\S]*member\.user_id = auth\.uid\(\)/u,
  );
  assert.match(
    source.migration,
    /revoke all on table public\.workspace_ai_prompt_settings\s+from public, anon, authenticated/u,
  );
  assert.match(
    source.migration,
    /grant all on table public\.workspace_ai_prompt_settings\s+to service_role/u,
  );
  assert.match(source.storage, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.doesNotMatch(source.settingsUi, /SUPABASE_SERVICE_ROLE_KEY/u);
});

test("only owner/admin can save bounded prompts from a trusted mutation origin", async () => {
  const source = await sources();

  assert.match(source.settingsRoute, /requireAuthorizedWorkspaceMember/u);
  assert.match(
    source.settingsRoute,
    /workspace\.owner_user_id === context\.user\.id/u,
  );
  assert.match(source.settingsRoute, /isPlatformAdminEmail/u);
  assert.match(
    source.settingsRoute,
    /function assertActivePromptManagement\([\s\S]*evaluateWorkspaceProcessingEntitlement\(context\.workspace\)/u,
  );
  assert.match(
    source.settingsRoute,
    /if \(!canManage\(context\)\)[\s\S]*assertActivePromptManagement\(context\)[\s\S]*saveWorkspaceAiPromptSettings/u,
  );
  assert.match(source.settingsRoute, /assertTrustedMutationOrigin/u);
  assert.match(source.settingsRoute, /invalid_request_origin/u);
  assert.match(source.policy, /AI_COMPANY_PROMPT_MAX_CHARS = 3_000/u);
  assert.match(source.policy, /AI_PROMPT_PROFILE_MAX_CHARS = 1_500/u);
  assert.match(source.policy, /AI_PROMPT_PROFILE_MAX_COUNT = 8/u);
  assert.match(
    source.settingsRoute,
    /Object\.hasOwn\(candidate, "companyPrompt"\)[\s\S]*Object\.hasOwn\(candidate, "profiles"\)[\s\S]*typeof candidate\.companyPrompt === "string"[\s\S]*Array\.isArray\(candidate\.profiles\)/u,
  );
  assert.match(source.settingsRoute, /if \(!isPromptSettingsPayload\(payload\)\)/u);
});

test("workspace members can read prompt settings without receiving mutation rights", async () => {
  const source = await sources();

  assert.match(
    source.workspaceAuthorization,
    /getUserWorkspaceMembershipDashboard/u,
  );
  assert.match(
    source.supabaseServer,
    /postgrestSelect<WorkspaceMemberRow>\(\s*"workspace_members"[\s\S]*\[\["user_id", user\.id\]\]/u,
  );
  assert.match(
    source.supabaseServer,
    /membershipResult\.data\.length !== 1[\s\S]*const \[membership\] = membershipResult\.data[\s\S]*postgrestRequest<WorkspaceMemberSafeDashboardRow>[\s\S]*rpc\/\$\{WORKSPACE_MEMBER_SAFE_DASHBOARD_RPC\}[\s\S]*isMissingWorkspaceMemberSafeDashboardRpc\(workspaceResult\.error\)[\s\S]*postgrestSelect<WorkspaceMemberCompatibilityProcessingRow>\(\s*"workspaces"[\s\S]*\[\["id", membership\.workspace_id\]\]/u,
  );
  assert.match(
    source.settingsRoute,
    /if \(!canManage\(context\)\)[\s\S]*workspace_owner_required/u,
  );
});

test("prompt context types match the nullable runtime contract", async () => {
  const source = await sources();

  assert.match(source.policyTypes, /companyPrompt: string \| null/u);
  assert.match(source.policyTypes, /profileId: string \| null/u);
  assert.match(source.policyTypes, /profileName: string \| null/u);
  assert.match(source.policyTypes, /profilePrompt: string \| null/u);
  assert.doesNotMatch(source.policyTypes, /profileInstruction/u);
});

test("reply generation accepts only a profile id and loads prompt content server-side", async () => {
  const source = await sources();

  assert.match(source.replyUi, /promptProfileId:/u);
  assert.doesNotMatch(
    source.replyUi,
    /companyPrompt:|profilePrompt:|promptInstruction:/u,
  );
  assert.match(source.replyRoute, /promptProfileId\?: unknown/u);
  assert.match(source.replyRoute, /getWorkspaceAiPromptContext/u);
  assert.match(
    source.replyRoute,
    /getWorkspaceAiPromptContext\(\s*workspace\.id,\s*payload\.promptProfileId/u,
  );
  assert.match(source.executionPolicy, /companyPrompt/u);
  assert.match(source.executionPolicy, /promptProfilePrompt/u);
  assert.match(
    source.replyRoute,
    /dürfen niemals Sicherheits-, Wahrheits-, Datenschutz-, Schema- oder Manuell-Senden-Regeln überschreiben/u,
  );
});

test("settings and reply UI expose global plus selectable scenario prompts", async () => {
  const source = await sources();

  assert.match(source.settingsPage, /<AiPromptSettings locale=\{locale\} singleWritingStyle=\{creatorIntelligenceEnabled\(\)\} \/>/u);
  assert.match(source.settingsUi, /Unternehmens-Prompt & Antwortprofile/u);
  assert.match(source.settingsUi, /Verkauf & Beratung/u);
  assert.match(source.settingsUi, /Kundenservice/u);
  assert.match(source.settingsUi, /Reklamation & Deeskalation/u);
  assert.match(source.settingsUi, /Community & Fans/u);
  assert.match(source.replyUi, /Antwortprofil/u);
  assert.match(source.replyUi, /\/settings\/ai-usage/u);
  assert.match(source.sourceOfTruth, /Workspace-Unternehmens-Prompt/u);
  assert.match(source.sourceOfTruth, /bis zu acht Antwortprofile/u);
});
