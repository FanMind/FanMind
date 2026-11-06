import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, URL, Response, Date, console: { error() {} }, process: { env: { NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid" } },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected import: ${name}`); return dependencies[name]; } });
  return exports;
}
const connection = { id: "connection-1", workspace_id: "workspace-1", platform: "facebook", page_id: "page-2", connected_at: "2026-09-11T12:00:00.000Z", connected_by: "user-1", status: "connected", last_messenger_sync_at: null };
function harness(options = {}) {
  const calls = { reads: 0, imports: [], limits: [] };
  const dependencies = {
    "server-only": {},
    "@/app/channels/facebookWebhookActions": { syncFacebookMessengerConversationForContact: async input => { calls.imports.push(input); return options.result ?? { ok: true }; } },
    "@/app/channels/instagramWebhookActions": { syncInstagramMessengerConversationForContact: async input => { calls.imports.push(input); return options.result ?? { ok: true }; } },
    "@/lib/demoMode": { areDemoConnectionsDisabled: () => options.demo ?? false },
    "@/lib/metaIntegrationPolicy.mjs": { canManageMetaConnections: role => role === "owner" },
    "@/lib/sharedRateLimit": { consumeSharedRateLimit: async input => { calls.limits.push(input); if (options.limitError) throw new Error("private provider text"); return { allowed: options.allowed ?? true }; } },
    "@/lib/workspaceAuthorization": { requireActiveAuthorizedWorkspace: async () => {
      if (options.inactive) throw new Error("inactive");
      return { user: { id: options.user ?? "user-1" }, workspace: { id: options.workspace ?? "workspace-1", role: options.role ?? "owner" } };
    } },
    "@/lib/supabase/server": { getWorkspaceSocialConnectionsServer: async workspace => {
      assert.equal(workspace, "workspace-1"); calls.reads++;
      return { error: options.readError, connections: options.rows?.(calls.reads) ?? [{ ...connection, ...options.row }] };
    } },
  };
  return { calls, run: load("src/lib/metaInitialImport.ts", dependencies).runMetaInitialImport };
}
test("only a verified messaging connection imports its exact saved account", async () => {
  for (const platform of ["facebook", "instagram"]) {
    const h = harness({ row: { platform } });
    assert.equal(await h.run({ ...connection, platform }, `${platform}_messages`), "complete");
    assert.equal(h.calls.reads, 2); assert.equal(h.calls.imports.length, 1);
    assert.equal(h.calls.imports[0].connection.page_id, "page-2");
    assert.equal(h.calls.imports[0].connection.workspace_id, "workspace-1");
    assert.equal(h.calls.imports[0].markInboundSeen, undefined);
    assert.equal(h.calls.limits[0].maxRequests, 1);
  }
  for (const type of ["facebook_comments", "facebook_insights", "instagram_comments", "instagram_insights", "forged"]) {
    const h = harness(); assert.equal(await h.run(connection, type), "not_needed");
    assert.equal(h.calls.reads + h.calls.limits.length + h.calls.imports.length, 0);
  }
});
test("inactive, member, demo, foreign or replaced connections cause no import or allowance", async () => {
  for (const config of [{ inactive: true }, { role: "member" }, { demo: true }, { user: "other" }, { workspace: "other" }, { readError: true }, { row: { status: "disconnected" } }, { row: { page_id: "page-1" } }, { row: { connected_at: "different" } }, { row: { workspace_id: "other" } }, { row: { connected_by: "other" } }]) {
    const h = harness(config); assert.equal(await h.run(connection, "facebook_messages"), "failed");
    assert.equal(h.calls.imports.length + h.calls.limits.length, 0);
  }
});
test("a finished import, rejected allowance and failed limiter never retry the provider", async () => {
  for (const [config, expected] of [[{ row: { last_messenger_sync_at: "2026-09-11T12:01:00Z" } }, "not_needed"], [{ allowed: false }, "deferred"], [{ limitError: true }, "failed"]]) {
    const h = harness(config); assert.equal(await h.run(connection, "facebook_messages"), expected); assert.equal(h.calls.imports.length, 0);
  }
});
test("connection replacement after the allowance is detected before provider use", async () => {
  const h = harness({ rows: read => [{ ...connection, page_id: read === 1 ? "page-2" : "replacement" }] });
  assert.equal(await h.run(connection, "facebook_messages"), "failed"); assert.equal(h.calls.imports.length, 0);
});
test("partial imports and provider failures are returned separately from a successful connection", async () => {
  for (const [result, expected] of [[{ ok: true, continuationPending: true }, "partial"], [{ ok: false, error: "private" }, "failed"]]) {
    const h = harness({ result }); assert.equal(await h.run(connection, "facebook_messages"), expected);
  }
});
test("actual Facebook flow waits for page selection and successful save before the first import", async () => {
  const calls = [];
  const integration = {
    fetchFacebookGrantedPermissions: async () => [], fetchFacebookTokenDiagnostics: async () => ({}), getGrantedFacebookPermissionNames: () => [],
    getFacebookGrantedScopeNames: () => [], hasRequiredFacebookPagePermissions: () => true, hasFacebookCommentFeedScopes: () => true, hasFacebookInsightsScopes: () => true,
    fetchFacebookPages: async () => [{ id: "page-1", name: "One", accessToken: "synthetic-1" }, { id: "page-2", name: "Two", accessToken: "synthetic-2" }],
    isTokenEncryptionConfigured: () => true, encryptToken: () => "synthetic-encrypted", tokenLastFour: () => "fake",
    FACEBOOK_PAGE_MESSENGER_WEBHOOK_FIELDS: ["messages"], FACEBOOK_PAGE_COMMENT_WEBHOOK_FIELDS: ["feed"],
    subscribeFacebookPage: async () => ({ subscribedAppsStatus: "active", fields: { messages: "active" } }),
  };
  let saveError = false;
  const flow = load("src/lib/facebookConnectionFlow.ts", {
    "@/lib/facebookIntegration": integration,
    "@/lib/metaInitialImport": { runMetaInitialImport: async (row, type) => { calls.push(["import", row.page_id, type]); return "partial"; } },
    "@/lib/supabase/server": { upsertFacebookSocialConnection: async input => { calls.push(["save", input.pageId]); return { connection, error: saveError }; }, updateFacebookWebhookSubscribed: async () => ({}) },
  });
  const input = { workspaceId: "workspace-1", connectedBy: "user-1", connectionType: "facebook_messages", userAccessToken: "synthetic" };
  assert.equal((await flow.completeFacebookOAuthConnection(input)).errorCode, "page_selection_required"); assert.equal(calls.length, 0);
  const success = await flow.completeFacebookOAuthConnection({ ...input, selectedPageId: "page-2" });
  assert.equal(success.ok, true); assert.equal(success.initialImport, "partial");
  assert.deepEqual(calls, [["save", "page-2"], ["import", "page-2", "facebook_messages"]]);
  calls.length = 0; saveError = true;
  assert.equal((await flow.completeFacebookOAuthConnection({ ...input, selectedPageId: "page-2" })).ok, false);
  assert.deepEqual(calls, [["save", "page-2"]]);
});
test("actual Instagram callback imports only after verified user/state/workspace and save", async () => {
  let valid = true, saveError = false; const calls = [];
  const route = load("src/app/api/integrations/instagram/callback/route.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect() { throw new Error("redirect"); } },
    "@/lib/demoMode": { areDemoConnectionsDisabled: () => false }, "@/lib/metaIntegrationPolicy.mjs": { canManageMetaConnections: () => true },
    "@/lib/facebookIntegration": { encryptToken: () => "encrypted", isTokenEncryptionConfigured: () => true, tokenLastFour: () => "fake" },
    "@/lib/instagramIntegration": { verifyInstagramOAuthState: () => valid ? { userId: "user-1", workspaceId: "workspace-1", connectionType: "instagram_messages" } : null,
      exchangeInstagramCode: async () => { calls.push("exchange"); return {}; }, exchangeInstagramLongLivedToken: async () => ({ accessToken: "synthetic" }),
      fetchInstagramProfile: async () => ({ userId: "account-1", username: "Synthetic" }), getInstagramOAuthScopes: () => [], subscribeInstagramAccount: async () => true },
    "@/lib/workspaceAuthorization": { requireActiveAuthorizedWorkspace: async () => ({ user: { id: "user-1" }, workspace: { id: "workspace-1", role: "owner" } }) },
    "@/lib/supabase/server": { getSupabaseServerUser: async () => ({ data: { user: { id: "user-1" } } }), updateInstagramWebhookSubscribed: async () => ({}),
      upsertInstagramSocialConnection: async () => { calls.push("save"); return { connection: { ...connection, platform: "instagram" }, error: saveError }; } },
    "@/lib/metaInitialImport": { runMetaInitialImport: async (row, type) => { calls.push("import"); assert.equal(row.platform, "instagram"); assert.equal(type, "instagram_messages"); return "failed"; } },
  });
  const request = new Request("https://staging.fanmind.invalid/api/integrations/instagram/callback?code=synthetic&state=synthetic");
  const response = await route.GET(request); assert.match(response.headers.get("location"), /connected=instagram_messages&meta_import=failed/);
  assert.deepEqual(calls, ["exchange", "save", "import"]);
  calls.length = 0; valid = false; await route.GET(request); assert.equal(calls.length, 0);
  valid = true; saveError = true; await route.GET(request); assert.deepEqual(calls, ["exchange", "save"]);
});
