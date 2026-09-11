import assert from "node:assert/strict";
import test from "node:test";
import { socialConfig, randomSecret, stateDigest, sealSocialSecret, openSocialSecret, socialAuthorizeUrl } from "../src/lib/socialProviderPolicy.mjs";
import { boundedProviderJson, exchangeSocialToken, readXDirectMessages, readSocialProfile } from "../src/lib/socialProviderClient.mjs";
import { handleSocialRequest } from "../src/lib/socialProviderFlow.mjs";

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const env = { FANMIND_APP_URL: "https://staging.fanmind.ch", NEXT_PUBLIC_SUPABASE_URL: "https://vshyhvgcmrlagvfnvomc.supabase.co",
  FANMIND_RUNTIME_ENVIRONMENT: "staging", FANMIND_SOCIAL_STAGING_PROJECT_REF: "vshyhvgcmrlagvfnvomc", FANMIND_SOCIAL_PILOT_ENABLED: "true",
  FANMIND_SOCIAL_PILOT_WORKSPACE_IDS: workspace, FANMIND_X_CLIENT_ID: "synthetic-client", FANMIND_X_CLIENT_SECRET: "synthetic-secret",
  FANMIND_X_PILOT_APPROVED: "true", FANMIND_TIKTOK_CLIENT_ID: "synthetic-client", FANMIND_TIKTOK_CLIENT_SECRET: "synthetic-secret",
  FANMIND_TIKTOK_PILOT_APPROVED: "true", FANMIND_SOCIAL_TOKEN_KEY: "ab".repeat(32) };
const context = { user: { id: "11111111-1111-4111-8111-111111111111" }, workspace: { id: workspace, role: "owner" }, demo: false };
const config = socialConfig("x", workspace, env);
const token = { accessToken: "synthetic-access", refreshToken: "synthetic-refresh", scopes: ["tweet.read", "users.read", "dm.read", "offline.access"], expiresAt: new Date(Date.now() + 7200000).toISOString() };
function request(action, origin = config.origin, provider = "x") {
  return new Request(`${config.origin}/api/integrations/social/${provider}/${action}`, { method: ["status", "callback"].includes(action) ? "GET" : "POST", headers: { origin } });
}
const row = { workspace_id: workspace, provider: "x", external_account_id: "123", display_name: "Synthetic", revision: "33333333-3333-4333-8333-333333333333",
  encrypted_token: sealSocialSecret(token, `social:${workspace}:x:123`, config.key), expires_at: token.expiresAt };
test("pilot requires exact Staging target, explicit account and app approval; Production cannot activate", () => {
  assert.equal(config.provider, "x");
  for (const change of [{ FANMIND_SOCIAL_PILOT_ENABLED: "false" }, { FANMIND_RUNTIME_ENVIRONMENT: "production" },
    { FANMIND_SOCIAL_STAGING_PROJECT_REF: "drqkpdvtbbrrdwmtrodz", NEXT_PUBLIC_SUPABASE_URL: "https://drqkpdvtbbrrdwmtrodz.supabase.co" },
    { FANMIND_SOCIAL_PILOT_WORKSPACE_IDS: "other" }, { FANMIND_X_PILOT_APPROVED: "false" }, { FANMIND_SOCIAL_TOKEN_KEY: "" },
    { FANMIND_APP_URL: "https://fanmind.ch" }, { FANMIND_APP_URL: "http://staging.fanmind.ch" }, { FANMIND_APP_URL: "https://staging.fanmind.ch/path" }])
    assert.throws(() => socialConfig("x", workspace, { ...env, ...change }), /pilot_unavailable/);
  assert.throws(() => socialConfig("__proto__", workspace, env), /unsupported_provider/);
});
test("X requests PKCE S256 and read-only scopes; TikTok requests profile only", () => {
  const state = randomSecret(), verifier = randomSecret(); const url = new URL(socialAuthorizeUrl(config, state, verifier));
  assert.equal(url.origin, "https://x.com"); assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.notEqual(url.searchParams.get("code_challenge"), verifier);
  assert.doesNotMatch(url.href, /synthetic-secret|dm.write|tweet.write/);
  const tiktok = new URL(socialAuthorizeUrl(socialConfig("tiktok", workspace, env), state, verifier));
  assert.equal(tiktok.searchParams.get("scope"), "user.info.basic");
  assert.throws(() => stateDigest("untrusted"), /oauth_invalid/);
});
test("AEAD rejects a different account, provider, key, version or changed ciphertext", () => {
  const ciphertext = sealSocialSecret(token, "account-a:x:123", config.key);
  assert.equal(openSocialSecret(ciphertext, "account-a:x:123", config.key).accessToken, token.accessToken);
  for (const bind of ["account-b:x:123", "account-a:tiktok:123", "account-a:x:456"])
    assert.throws(() => openSocialSecret(ciphertext, bind, config.key), /credential_invalid/);
  assert.throws(() => openSocialSecret(ciphertext, "account-a:x:123", "cd".repeat(32)), /credential_invalid/);
  assert.throws(() => openSocialSecret(ciphertext.replace("v1:", "v2:"), "account-a:x:123", config.key), /credential_invalid/);
});
test("official token request never follows redirects or leaks secret into URL; wrong scopes fail", async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++; assert.equal(url, "https://api.x.com/2/oauth2/token"); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.match(options.headers.Authorization, /^Basic /); assert.equal(new URLSearchParams(options.body).get("code_verifier"), "verifier");
    return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 7200, token_type: "bearer", scope: "tweet.read users.read dm.write offline.access" });
  };
  await assert.rejects(exchangeSocialToken(config, "code", "verifier", fetcher), /provider_scope_invalid/); assert.equal(calls, 1);
});
test("provider response size and status are bounded and redacted without retries", async () => {
  await assert.rejects(boundedProviderJson("fixed", {}, async () => new Response("x".repeat(256001))), /provider_invalid/);
  await assert.rejects(boundedProviderJson("fixed", {}, async () => new Response("SENSITIVE", { status: 429 })), error => error.code === "rate_limited" && !error.message.includes("SENSITIVE"));
  await assert.rejects(boundedProviderJson("fixed", {}, async () => Response.json({ errors: [{ detail: "PRIVATE" }] })), /provider_invalid/);
});
test("TikTok profile response must match the authorizing token identity", async () => {
  await assert.rejects(readSocialProfile(socialConfig("tiktok", workspace, env), { ...token, openId: "owner" }, async () => Response.json({ data: { user: { open_id: "different", display_name: "Other" } } })), /provider_identity_invalid/);
});
test("X preview excludes outbound, groups, foreign, duplicate and malformed messages; one bounded request", async () => {
  const valid = { id: "999", text: "Hello", event_type: "MessageCreate", created_at: "2026-09-11T09:00:00Z", sender_id: "456", dm_conversation_id: "123-456" };
  let calls = 0;
  const result = await readXDirectMessages(token, "123", async (url, options) => {
    calls++; assert.equal(url.origin, "https://api.x.com"); assert.equal(url.searchParams.get("max_results"), "20"); assert.equal(options.method, undefined);
    assert.match(url.searchParams.get("dm_event.fields"), /sender_id/); assert.equal(url.searchParams.has("expansions"), false);
    return Response.json({ data: [valid, valid, { ...valid, sender_id: "123" }, { ...valid, participant_ids: ["123", "456", "789"] }, { ...valid, participant_ids: ["456", "789"] }, { ...valid, created_at: "bad" }], meta: { next_token: "cursor-never-followed" } });
  });
  assert.equal(calls, 1); assert.equal(result.messages.length, 1); assert.equal(result.skipped, 5); assert.equal(result.hasMore, true);
});
test("origin, owner, demo and disabled-pilot denial happen before any storage/provider mutation", async () => {
  let calls = 0; const store = { rpc: async () => { calls++; }, read: async () => { calls++; } };
  for (const args of [{ request: request("start", "https://attacker.example") }, { authorize: async () => ({ ...context, workspace: { ...context.workspace, role: "member" } }) },
    { authorize: async () => ({ ...context, demo: true }) }, { env: { ...env, FANMIND_SOCIAL_PILOT_ENABLED: "false" } }]) {
    const response = await handleSocialRequest({ request: request("start"), provider: "x", action: "start", authorize: async () => context, store, env, ...args });
    assert.notEqual(response.status, 200); assert.notEqual(response.status, 303);
  }
  assert.equal(calls, 0);
});
test("callback requires atomic unconsumed state before any token exchange", async () => {
  let calls = 0;
  const response = await handleSocialRequest({ request: new Request(`${request("callback").url}?state=${randomSecret()}&code=PRIVATE`), provider: "x", action: "callback", authorize: async () => context,
    store: { rpc: async () => null }, env, client: { exchangeSocialToken: async () => { calls++; } } });
  assert.equal(calls, 0); assert.match(response.headers.get("location"), /oauth_invalid$/); assert.doesNotMatch(response.headers.get("location"), /PRIVATE/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});
test("successful callback encrypts the exact account token and reauthorizes before saving", async () => {
  const state = randomSecret(), hash = stateDigest(state); let auth = 0, exchanged = 0, saved = false;
  const store = { rpc: async (name, params) => {
    assert.equal(params.p_workspace, workspace); assert.equal(params.p_user, context.user.id);
    if (name === "consume") return sealSocialSecret({ verifier: "verifier" }, `social:${workspace}:x:${hash}`, config.key);
    assert.equal(name, "complete"); assert.equal(auth, 2); assert.equal(params.p_account, "123");
    assert.equal(openSocialSecret(params.p_token, `social:${workspace}:x:123`, config.key).accessToken, token.accessToken); saved = true; return true;
  } };
  const result = await handleSocialRequest({ request: new Request(`${request("callback").url}?state=${state}&code=code`), provider: "x", action: "callback", store, env,
    authorize: async () => { auth++; return context; }, client: { exchangeSocialToken: async () => { exchanged++; return token; }, readSocialProfile: async () => ({ id: "123", name: "Synthetic" }) } });
  assert.equal(exchanged, 1); assert.equal(saved, true); assert.match(result.headers.get("location"), /social_result=connected$/);
});
test("disconnect clears local tokens with kill switch off and reports revocation honestly", async () => {
  let deleted = false;
  const result = await handleSocialRequest({ request: request("disconnect"), provider: "x", action: "disconnect", authorize: async () => context,
    store: { rpc: async name => { assert.equal(name, "disconnect"); deleted = true; return [row]; } }, env: { ...env, FANMIND_SOCIAL_PILOT_ENABLED: "false" } });
  assert.equal(deleted, true); assert.deepEqual(await result.json(), { disconnected: true, providerRevoked: false });
});
test("post-read disconnect or revision change suppresses the complete preview", async () => {
  const response = await handleSocialRequest({ request: request("messages"), provider: "x", action: "messages", authorize: async () => context, env,
    store: { read: async () => row, rpc: async name => name === "claim_read" ? [row] : false },
    client: { readXDirectMessages: async () => ({ messages: [{ text: "PRIVATE" }] }) } });
  assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /PRIVATE/);
});
test("TikTok never calls a DM provider and rate-limit failure never calls X", async () => {
  let calls = 0;
  for (const provider of ["tiktok", "x"]) {
    const response = await handleSocialRequest({ request: request("messages", config.origin, provider), provider, action: "messages", authorize: async () => context, env,
      store: { read: async () => row, rpc: async () => [] }, client: { readXDirectMessages: async () => { calls++; } } });
    assert.ok([429, 503].includes(response.status));
  }
  assert.equal(calls, 0);
});
