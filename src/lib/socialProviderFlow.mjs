import { randomUUID } from "node:crypto";
import { socialConfig, socialTarget, providerPolicy, randomSecret, stateDigest, sealSocialSecret, openSocialSecret, socialAuthorizeUrl, socialErrorCode, SocialProviderError } from "./socialProviderPolicy.mjs";
import * as providerClient from "./socialProviderClient.mjs";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const json = (value, status = 200) => Response.json(value, { status, headers });
function canonicalOrigin(env) {
  try { const url = new URL(env.FANMIND_APP_URL); if (url.protocol === "https:" && !url.username && !url.password) return url.origin; } catch {}
  throw new SocialProviderError("pilot_unavailable");
}
function assertRow(row, workspaceId, provider) {
  if (!row || row.workspace_id !== workspaceId || row.provider !== provider) throw new SocialProviderError("connection_changed");
  return row;
}
const binding = (workspaceId, provider, id) => `social:${workspaceId}:${provider}:${id}`;
export async function handleSocialRequest({ request, provider, action, authorize, store, env = process.env, client = providerClient }) {
  let origin;
  try {
    providerPolicy(provider);
    if (!Object.hasOwn({ status: "GET", callback: "GET", start: "POST", disconnect: "POST", messages: "POST" }, action)) return json({ error: "not_found" }, 404);
    const method = action === "status" || action === "callback" ? "GET" : "POST";
    if (request.method !== method) return json({ error: "method_not_allowed" }, 405);
    origin = canonicalOrigin(env);
    if (method === "POST" && request.headers.get("origin") !== origin) return json({ error: "origin_denied" }, 403);
    const context = await authorize(action === "disconnect" || action === "status" ? "read" : "active");
    if (context.workspace.role !== "owner" || context.demo) throw new SocialProviderError("owner_required");
    // Even status/disconnect must use the verified isolated target. The pilot
    // kill switch may be off during cleanup; the target boundary never is.
    socialTarget(env);
    const workspaceId = context.workspace.id;
    const params = { p_workspace: workspaceId, p_user: context.user.id, p_provider: provider };
    if (action === "disconnect") {
      // Local removal always remains possible, including with the pilot kill switch off.
      const removed = await store.rpc("disconnect", params);
      if (!Array.isArray(removed) || removed.length > 1) throw new SocialProviderError("storage_unavailable");
      let providerRevoked = false;
      if (removed[0]) {
        const row = assertRow(removed[0], workspaceId, provider);
        try {
          const config = socialConfig(provider, workspaceId, env);
          const token = openSocialSecret(row.encrypted_token, binding(workspaceId, provider, row.external_account_id), config.key);
          await client.revokeSocialToken(config, token);
          // An in-flight refresh can outlive local deletion; don't promise its
          // newly issued credential was covered by revoking the previous token.
          providerRevoked = !row.lease_until || Date.parse(row.lease_until) <= Date.now();
        } catch { /* Local deletion is authoritative; UI explains outstanding provider revocation. */ }
      }
      return json({ disconnected: true, providerRevoked });
    }
    let config;
    try { config = socialConfig(provider, workspaceId, env); }
    catch (error) { if (action !== "status") throw error; }
    if (action === "status") {
      let row = null, storageReady = true;
      try { row = await store.read(workspaceId, provider); if (row) assertRow(row, workspaceId, provider); }
      catch { storageReady = false; }
      return json({ available: Boolean(config) && storageReady, connected: Boolean(row),
        accountName: row?.display_name ?? null, expiresAt: row?.expires_at ?? null,
        nextReadAt: row?.next_read_at ?? null, capability: provider === "tiktok" ? "profile_only" : "dm_read_preview" });
    }
    if (action === "start") {
      const state = randomSecret(); const verifier = randomSecret(); const hash = stateDigest(state);
      const saved = await store.rpc("begin", { ...params, p_hash: hash, p_verifier: sealSocialSecret({ verifier }, binding(workspaceId, provider, hash), config.key) });
      if (saved !== true) throw new SocialProviderError("rate_limited");
      return json({ authorizationUrl: socialAuthorizeUrl(config, state, verifier) });
    }
    if (action === "callback") {
      const query = new URL(request.url).searchParams;
      if (query.has("error")) throw new SocialProviderError("oauth_denied");
      const hash = stateDigest(query.get("state"));
      const encryptedVerifier = await store.rpc("consume", { ...params, p_hash: hash });
      if (!encryptedVerifier) throw new SocialProviderError("oauth_invalid");
      const { verifier } = openSocialSecret(encryptedVerifier, binding(workspaceId, provider, hash), config.key);
      const token = await client.exchangeSocialToken(config, query.get("code"), verifier);
      try {
        const profile = await client.readSocialProfile(config, token);
        const stillAuthorized = await authorize("active");
        if (stillAuthorized.workspace.id !== workspaceId || stillAuthorized.user.id !== context.user.id || stillAuthorized.workspace.role !== "owner" || stillAuthorized.demo) throw new SocialProviderError("connection_changed");
        const saved = await store.rpc("complete", { ...params, p_hash: hash, p_account: profile.id, p_name: profile.name,
          p_token: sealSocialSecret(token, binding(workspaceId, provider, profile.id), config.key), p_expires: token.expiresAt });
        if (saved !== true) throw new SocialProviderError("connection_changed");
        return new Response(null, { status: 303, headers: { ...headers, Location: `${origin}/channels?social=${provider}&social_result=connected` } });
      } catch (error) {
          // Revoke only the newly issued token, including failed profile reads,
          // lost authorization, failed/indeterminate persistence and disconnect races.
          try { await client.revokeSocialToken(config, token); }
          catch { throw new SocialProviderError("provider_cleanup_required"); }
          throw error;
      }
    }
    if (provider !== "x") throw new SocialProviderError("messaging_unavailable");
    const row = assertRow(await store.read(workspaceId, provider), workspaceId, provider);
    const lease = randomUUID();
    const leaseParams = { ...params, p_revision: row.revision, p_lease: lease };
    const claimed = await store.rpc("claim_read", leaseParams);
    if (!Array.isArray(claimed) || claimed.length !== 1) throw new SocialProviderError("rate_limited");
    const current = assertRow(claimed[0], workspaceId, provider);
    if (current.revision !== row.revision) throw new SocialProviderError("connection_changed");
    let token = openSocialSecret(current.encrypted_token, binding(workspaceId, provider, current.external_account_id), config.key);
    if (Date.parse(token.expiresAt) < Date.now() + 60000) {
      token = await client.refreshSocialToken(config, token);
      const identity = await client.readSocialProfile(config, token);
      if (identity.id !== current.external_account_id) throw new SocialProviderError("provider_identity_invalid");
      if (await store.rpc("rotate", { ...leaseParams, p_token: sealSocialSecret(token, binding(workspaceId, provider, identity.id), config.key), p_expires: token.expiresAt }) !== true) throw new SocialProviderError("connection_changed");
    }
    const result = await client.readXDirectMessages(token, current.external_account_id);
    const stillAuthorized = await authorize("active");
    if (stillAuthorized.workspace.id !== workspaceId || stillAuthorized.user.id !== context.user.id || stillAuthorized.workspace.role !== "owner" || stillAuthorized.demo
      || await store.rpc("finish_read", leaseParams) !== true) throw new SocialProviderError("connection_changed");
    // Ephemeral preview only; no CRM records, raw provider payloads or learning writes.
    return json(result);
  } catch (error) {
    const code = socialErrorCode(error);
    if (action === "callback" && origin) return new Response(null, { status: 303, headers: { ...headers, Location: `${origin}/channels?social=${provider === "x" ? "x" : "tiktok"}&social_result=${code}` } });
    return json({ error: code }, code === "rate_limited" ? 429 : code === "owner_required" || code === "connection_changed" ? 403 : 503);
  }
}
