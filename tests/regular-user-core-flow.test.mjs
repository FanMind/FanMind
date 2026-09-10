import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

function requiresAll(text, fragments, context) {
  for (const fragment of fragments) {
    assert.match(
      text,
      fragment instanceof RegExp ? fragment : new RegExp(fragment, "u"),
      `${context}: ${String(fragment)}`,
    );
  }
}

test("regular registration continues to authenticated setup before entering the CRM", async () => {
  const [registration, workspaceRoute] = await Promise.all([
    source("src/app/register/RegisterClient.tsx"),
    source("src/app/api/register/workspace/route.ts"),
  ]);

  requiresAll(
    registration,
    [
      /supabase\.auth\.signUp\(/u,
      /syncSupabaseSessionForServer\(data\.session\)/u,
      /buildRegistrationAccountMetadata/u,
      /router\.push\(setupHref\)/u,
    ],
    "registration journey",
  );
  requiresAll(
    workspaceRoute,
    [
      /isTrustedFanMindMutationRequest\(request\)/u,
      /getSupabaseServerUser\(/u,
      /ensureUserWorkspace\(/u,
    ],
    "workspace provisioning boundary",
  );
});

test("login synchronizes the Supabase session and reaches the protected dashboard", async () => {
  const login = await source("src/app/login/page.tsx");

  requiresAll(
    login,
    [
      /supabase\.auth\.signInWithPassword\(/u,
      /syncSupabaseSessionForServer\(data\.session\)/u,
      /const LOGIN_TARGET = "\/dashboard"/u,
      /window\.location\.assign\(target\)/u,
    ],
    "login journey",
  );
});

test("dashboard, contacts, follow-ups and inbox stay workspace-scoped", async () => {
  const [dashboard, fans, fanDetail, followups, inbox] = await Promise.all([
    source("src/app/dashboard/page.tsx"),
    source("src/app/fans/page.tsx"),
    source("src/app/fans/[id]/page.tsx"),
    source("src/app/followups/page.tsx"),
    source("src/app/inbox/page.tsx"),
  ]);

  requiresAll(dashboard, [/getUserAuthorizedWorkspaceDashboard\(/u, /getWorkspaceContacts\(/u], "dashboard");
  requiresAll(fans, [/getUserAuthorizedWorkspaceDashboard\(/u, /getWorkspaceContacts\(/u], "contacts");
  requiresAll(
    fanDetail,
    [/requireAuthorizedWorkspaceMember\(/u, /getContactConversationMessages\(/u],
    "contact detail",
  );
  requiresAll(
    followups,
    [/getUserAuthorizedWorkspaceDashboard\(/u, /getWorkspaceFollowups\(/u, /FollowupStatusForm/u],
    "follow-ups",
  );
  requiresAll(
    inbox,
    [/requireAuthorizedWorkspaceMember\(/u, /getWorkspaceConversations\(/u, /getWorkspaceOpenFollowups\(/u],
    "inbox",
  );
});

test("conversation, memory and follow-up mutations authorize the contact and refresh downstream surfaces", async () => {
  const actions = await source("src/app/fans/actions.ts");

  for (const action of [
    "saveManualFanMessage",
    "saveManualMemory",
    "saveManualFollowup",
  ]) {
    const start = actions.indexOf(`export async function ${action}`);
    const next = actions.indexOf("\nexport async function ", start + 1);
    assert.notEqual(start, -1, `${action} must remain implemented`);
    const body = actions.slice(start, next === -1 ? undefined : next);
    assert.match(body, /getCurrentWorkspaceOrThrow\(\)/u, `${action} requires a workspace`);
    assert.match(
      body,
      /ensureContactInWorkspace\(workspace\.id, contactId\)/u,
      `${action} rejects cross-workspace contacts`,
    );
  }

  const memoryStart = actions.indexOf("export async function saveManualMemory");
  const followupStart = actions.indexOf("export async function saveManualFollowup");
  const inboundStart = actions.indexOf("export async function saveInboundMessage");
  assert.match(actions.slice(memoryStart, followupStart), /revalidatePath\("\/dashboard"\)/u);
  requiresAll(
    actions.slice(followupStart, inboundStart),
    [/revalidatePath\("\/followups"\)/u, /revalidatePath\("\/dashboard"\)/u],
    "follow-up downstream refresh",
  );
});

test("AI uses the authorized contact, bounded structured output and human-controlled saves", async () => {
  const [route, client] = await Promise.all([
    source("src/app/api/ai/reply-suggestions/route.ts"),
    source("src/app/fans/[id]/AiReplySuggestions.tsx"),
  ]);

  requiresAll(
    route,
    [
      /requireContactInActiveAuthorizedWorkspace\(/u,
      /readBoundedJsonRequest\(/u,
      /consumeSharedRateLimit\(/u,
      /store: false/u,
      /type: "json_schema"/u,
      /Mensch prüft und sendet final selbst/u,
    ],
    "AI server boundary",
  );
  assert.doesNotMatch(
    route,
    /payload\.workspaceId|payload\.workspace_id/u,
    "the browser must not select an AI workspace",
  );
  requiresAll(
    client,
    [
      /fetch\("\/api\/ai\/reply-suggestions"/u,
      /saveSuggestedMemory\(/u,
      /saveSuggestedFollowup\(/u,
      /navigator\.clipboard\.writeText/u,
    ],
    "human-controlled AI journey",
  );
});

test("completed follow-ups remain visible as a canonical CRM transition", async () => {
  const [statusForm, contextActions] = await Promise.all([
    source("src/app/followups/FollowupStatusForm.tsx"),
    source("src/app/fans/[id]/contextActions.ts"),
  ]);

  requiresAll(
    statusForm,
    [/followup\.status === "completed" \|\| followup\.status === "done"/u, /value=\{nextStatus\}/u],
    "follow-up status UI",
  );
  requiresAll(
    contextActions,
    [
      /values: \{ status: nextStatus \}/u,
      /workspace_id/u,
      /contact_id/u,
      /revalidatePath\("\/followups"\)/u,
    ],
    "follow-up status mutation",
  );
});
