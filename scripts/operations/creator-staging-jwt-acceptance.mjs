#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { isStrongEphemeralMemberPassword } from '../../src/lib/stagingEphemeralMemberCredentialPolicy.mjs';
import {
  STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
  STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME,
  STAGING_SYNTHETIC_MEMBER_EMAIL,
  STAGING_SYNTHETIC_UUID_PATTERN,
} from '../../src/lib/stagingSyntheticFixturePolicy.mjs';
import { defaultCreatorBundle, buildCreatorReplyContext } from '../../src/lib/creatorIntelligencePolicy.mjs';

const CONFIRMATION = 'accept-creator-foundation';
const TABLES = ['creators', 'creator_voice_profiles', 'creator_sales_playbooks', 'creator_commercial_events'];
function revisionConflict(result) { return result.status === 500 && result.data?.code === '40001' && result.data?.message === 'creator_revision_conflict'; }
function deniedWrite(result) { return result.status === 403 && result.data?.code === '42501'; }
function requireFact(ok, code) { if (!ok) throw new Error(code); }
function origin(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash ? u.origin : ''; } catch { return ''; } }
export function validateCreatorAcceptanceEnvironment(env) {
  const stage = env.FANMIND_TARGET_SUPABASE_PROJECT_REF;
  const prod = env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF;
  requireFact(env.FANMIND_RUNTIME_ENVIRONMENT === 'staging' && origin(env.NEXT_PUBLIC_APP_URL) === 'https://staging.fanmind.ch', 'target');
  requireFact(/^[a-z0-9]{8,64}$/u.test(stage ?? '') && /^[a-z0-9]{8,64}$/u.test(prod ?? '') && stage !== prod && origin(env.FANMIND_STAGING_SUPABASE_URL) === `https://${stage}.supabase.co`, 'target');
  requireFact(env.GITHUB_REF === 'refs/heads/main' && /^[0-9a-f]{40}$/u.test(env.GITHUB_SHA ?? '') && env.GITHUB_SHA === env.FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT, 'reviewed_commit');
  requireFact(env.FANMIND_STAGING_CREATOR_ACCEPT_CONFIRM === CONFIRMATION && env.FANMIND_ENABLE_NON_PRODUCTION_WRITES === 'true' && env.FANMIND_NON_PRODUCTION_WRITE_ACK === 'I_UNDERSTAND_NON_PRODUCTION_ONLY', 'confirmation');
  requireFact(env.FANMIND_CREATOR_INTELLIGENCE_ENABLED !== 'true', 'runtime_must_remain_off');
  requireFact(/^[1-9][0-9]{0,19}$/u.test(env.GITHUB_RUN_ID ?? '') && /^[1-9][0-9]{0,3}$/u.test(env.GITHUB_RUN_ATTEMPT ?? '') && isStrongEphemeralMemberPassword(env.FANMIND_STAGING_E2E_MEMBER_PASSWORD), 'run_identity');
  const ids = [env.FANMIND_STAGING_E2E_WORKSPACE_ID, env.FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID];
  requireFact(ids.every(x => STAGING_SYNTHETIC_UUID_PATTERN.test(x ?? '')) && new Set(ids).size === 2, 'fixture_identity');
  const emails = [env.FANMIND_STAGING_E2E_EMAIL, env.FANMIND_STAGING_E2E_SECONDARY_EMAIL];
  requireFact(emails.every(x => typeof x === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(x) && /staging|synthetic|test/iu.test(x)) && new Set(emails).size === 2 && !emails.includes(STAGING_SYNTHETIC_MEMBER_EMAIL), 'fixture_identity');
  requireFact([env.FANMIND_STAGING_E2E_PASSWORD, env.FANMIND_STAGING_E2E_SECONDARY_PASSWORD].every(x => typeof x === 'string' && x.length >= 20 && !/[\r\n]/u.test(x)), 'credentials');
  const anon = env.FANMIND_STAGING_SUPABASE_ANON_KEY;
  const admin = env.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY;
  requireFact(/^(eyJ|sb_publishable_)/u.test(anon ?? '') && /^(eyJ|sb_secret_)/u.test(admin ?? '') && anon !== admin, 'credentials');
  requireFact(['NODE_OPTIONS','NODE_EXTRA_CA_CERTS','NODE_USE_ENV_PROXY','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'].every(k => !env[k]), 'network_redirect');
  return true;
}

// Only exact, already marked synthetic workspaces. No credentials or provider
// data are printed. Each session and any test-created bundle are cleaned up.
export async function runCreatorJwtAcceptance(env, {
  fetchImpl = fetch,
  cleanupOnly = false,
} = {}) {
  validateCreatorAcceptanceEnvironment(env);
  const base = env.FANMIND_STAGING_SUPABASE_URL;
  const anonKey = env.FANMIND_STAGING_SUPABASE_ANON_KEY;
  const serviceKey = env.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY;
  const marker = `FanMind Creator acceptance ${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT}:${env.GITHUB_SHA}`;
  const actors = [];
  const fixtures = [
    { workspaceId: env.FANMIND_STAGING_E2E_WORKSPACE_ID, name: STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME, email: env.FANMIND_STAGING_E2E_EMAIL, password: env.FANMIND_STAGING_E2E_PASSWORD },
    { workspaceId: env.FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID, name: STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME, email: env.FANMIND_STAGING_E2E_SECONDARY_EMAIL, password: env.FANMIND_STAGING_E2E_SECONDARY_PASSWORD },
  ];
  const prepared = [];
  async function request(path, token, { method = 'GET', body, query = {}, admin = false } = {}) {
    const url = new URL(path, base);
    requireFact(url.origin === origin(base) && ['/rest/v1/', '/auth/v1/'].some(p => url.pathname.startsWith(p)), 'request_target');
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await fetchImpl(url, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: admin ? serviceKey : anonKey, Authorization: `Bearer ${token ?? anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    requireFact(text.length <= 100000, 'response_bound');
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { throw new Error('response_format'); } }
    return { ok: response.ok, status: response.status, data };
  }
  async function login(email, password) {
    const response = await request('/auth/v1/token', null, { method: 'POST', query: { grant_type: 'password' }, body: { email, password } });
    requireFact(response.ok && typeof response.data?.access_token === 'string', 'login');
    const actor = { token: response.data.access_token };
    actors.push(actor); // Remember a returned session before validating identity.
    const user = await request('/auth/v1/user', actor.token);
    requireFact(user.ok && user.data?.email?.toLowerCase() === email.toLowerCase() && STAGING_SYNTHETIC_UUID_PATTERN.test(user.data?.id ?? ''), 'login_identity');
    actor.id = user.data.id;
    return actor;
  }
  async function rows(table, fixture, actor, extras = {}) {
    const response = await request(`/rest/v1/${table}`, actor?.token ?? serviceKey, { admin: !actor, query: { select: '*', workspace_id: `eq.${fixture.workspaceId}`, limit: '2', ...extras } });
    requireFact(response.ok && Array.isArray(response.data), 'read');
    return response.data;
  }
  async function verifyFixture(fixture) {
    const response = await request('/rest/v1/workspaces', serviceKey, { admin: true, query: { select: 'id,name,owner_user_id,billing_status,workspace_access_mode,test_access_flags', id: `eq.${fixture.workspaceId}`, limit: '2' } });
    const list = response.data;
    requireFact(response.ok && Array.isArray(list) && list.length === 1 && list[0].id === fixture.workspaceId && list[0].name === fixture.name && list[0].owner_user_id === fixture.actor.id && list[0].test_access_flags?.staging_synthetic_fixture === true && list[0].billing_status === 'active' && list[0].workspace_access_mode === 'active', 'fixture_changed');
  }
  function payload(fixture, revision, approve) {
    const bundle = defaultCreatorBundle();
    bundle.persona.displayName = fixture === fixtures[0] ? 'Synthetic warm Creator' : 'Synthetic concise Creator';
    bundle.persona.status = 'active'; bundle.persona.internalNotes = marker;
    bundle.voice.tone = fixture === fixtures[0] ? 'warm and expressive' : 'calm and concise';
    bundle.voice.goodExamples = ['Synthetic example one.', 'Synthetic example two.', 'Synthetic example three.'];
    return { p_workspace_id: fixture.workspaceId, p_creator_id: fixture.creatorId ?? null, p_expected_revision: revision,
      p_persona: bundle.persona, p_voice: bundle.voice, p_playbook: bundle.playbook, p_approve: approve };
  }
  async function save(fixture, revision, approve, actor = fixture.actor) {
    await verifyFixture(fixture);
    return request('/rest/v1/rpc/save_creator_bundle', actor.token, { method: 'POST', body: payload(fixture, revision, approve) });
  }
  async function context(fixture) {
    const [creators, voices, playbooks] = await Promise.all(['creators','creator_voice_profiles','creator_sales_playbooks'].map(t => rows(t, fixture, fixture.actor)));
    requireFact(creators.length === 1 && voices.length === 1 && playbooks.length === 1, 'bundle_cardinality');
    return { workspaceId: fixture.workspaceId, contactId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', creatorId: fixture.creatorId, creator: creators[0], voice: voices[0], playbook: playbooks[0], commercial: {}, events: [] };
  }
  let failure;
  try {
    for (const fixture of fixtures) {
      fixture.actor = await login(fixture.email, fixture.password);
      await verifyFixture(fixture);
      if (cleanupOnly) prepared.push(fixture);
      else for (const table of TABLES) requireFact((await rows(table, fixture)).length === 0, 'fixture_not_empty');
    }
    requireFact(fixtures[0].actor.id !== fixtures[1].actor.id, 'owner_identity');
    if (!cleanupOnly) {
    const member = await login(STAGING_SYNTHETIC_MEMBER_EMAIL, env.FANMIND_STAGING_E2E_MEMBER_PASSWORD);
    requireFact(fixtures.every(f => f.actor.id !== member.id), 'member_identity');
    for (const fixture of fixtures) {
      prepared.push(fixture); // Includes an indeterminate create response.
      const created = await save(fixture, 0, true);
      requireFact(created.ok && STAGING_SYNTHETIC_UUID_PATTERN.test(created.data ?? ''), 'create');
      fixture.creatorId = created.data;
      const duplicate = await request('/rest/v1/rpc/save_creator_bundle', fixture.actor.token, { method: 'POST', body: { ...payload(fixture, 0, true), p_creator_id: null } });
      requireFact(duplicate.status === 409 && duplicate.data?.code === '23505', 'one_creator');
      for (const table of TABLES) {
        const denied = await request(`/rest/v1/${table}`, fixture.actor.token, { method: 'PATCH', query: { workspace_id: `eq.${fixture.workspaceId}` }, body: table === 'creator_voice_profiles' ? { fingerprint: { tone: 'UNREVIEWED' } } : table === 'creator_sales_playbooks' ? { rules: {} } : table === 'creators' ? { display_name: 'UNREVIEWED' } : { amount_minor: 1 } });
        requireFact(deniedWrite(denied), 'direct_write');
        const other = fixtures.find(f => f !== fixture);
        requireFact((await rows(table, fixture, other.actor)).length === 0, 'foreign_read');
      }
      const denied = await save(fixture, 1, false, fixtures.find(f => f !== fixture).actor);
      requireFact(deniedWrite(denied), 'foreign_write');
    }
    requireFact((await rows('creators', fixtures[0], member)).length === 1 && (await rows('creators', fixtures[1], member)).length === 0, 'member_read');
    requireFact(deniedWrite(await save(fixtures[0], 1, false, member)), 'member_write');
    const initial = await Promise.all(fixtures.map(context));
    const styles = initial.map(input => buildCreatorReplyContext(input).voice.tone);
    requireFact(styles[0] !== styles[1], 'style_isolation');
    for (const fixture of fixtures) {
      requireFact((await save(fixture, 1, false)).ok, 'draft_save');
      const draft = await context(fixture);
      let rejected = false;
      try { buildCreatorReplyContext(draft); } catch { rejected = true; }
      requireFact(rejected && draft.creator.revision === 2 && !draft.voice.approved_at && !draft.playbook.approved_at, 'draft_approval');
      requireFact(revisionConflict(await save(fixture, 1, true)), 'stale_revision');
      requireFact((await save(fixture, 2, true)).ok, 'reapproval');
      const simultaneous = await Promise.all([save(fixture, 3, true), save(fixture, 3, true)]);
      requireFact(simultaneous.filter(r => r.ok).length === 1 && simultaneous.filter(revisionConflict).length === 1, 'concurrent_revision');
      const current = await context(fixture);
      requireFact(current.creator.revision === 4 && current.voice.revision === 4 && current.playbook.revision === 4 && current.voice.approved_by === fixture.actor.id, 'current_revision');
      buildCreatorReplyContext(current);
    }
    }
  } catch (error) { failure = error; }
  const cleanup = [];
  for (const fixture of prepared) {
    try {
      await verifyFixture(fixture);
      const existing = await rows('creators', fixture);
      requireFact(existing.length <= 1 && existing.every(r => r.internal_notes === marker && (!fixture.creatorId || r.id === fixture.creatorId)), 'cleanup_identity');
      for (const row of existing) {
        const deleted = await request('/rest/v1/creators', serviceKey, { admin: true, method: 'DELETE', query: { workspace_id: `eq.${fixture.workspaceId}`, id: `eq.${row.id}`, internal_notes: `eq.${marker}` } });
        requireFact(deleted.ok && Array.isArray(deleted.data) && deleted.data.length === 1 && deleted.data[0].id === row.id, 'cleanup_delete');
      }
      for (const table of TABLES) requireFact((await rows(table, fixture)).length === 0, 'cleanup_postflight');
    } catch { cleanup.push('bundle_cleanup'); }
  }
  for (const actor of actors) {
    try { requireFact((await request('/auth/v1/logout', actor.token, { method: 'POST', query: { scope: 'local' } })).ok, 'session_cleanup'); } catch { cleanup.push('session_cleanup'); }
  }
  requireFact(cleanup.length === 0, 'cleanup_incomplete_verify_before_retry');
  if (failure) throw failure;
  if (cleanupOnly) return { result: 'PASS', cleanupOnly, bundleCascadeCleanup: 'PASS', runtimeActivated: false };
  return { result: 'PASS', cleanupOnly, ownerMemberForeign: 'PASS', oneWritingStyle: 'PASS', revisionsAndApproval: 'PASS', bundleCascadeCleanup: 'PASS', runtimeActivated: false, providerCalls: 0, qualityAcceptance: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!['--run','--cleanup'].includes(process.argv[2])) { console.error('CREATOR_JWT_ACCEPTANCE_ERROR=mode'); process.exitCode = 1; }
  else runCreatorJwtAcceptance(process.env, { cleanupOnly: process.argv[2] === '--cleanup' }).then(result => console.log(`CREATOR_JWT_ACCEPTANCE=${JSON.stringify(result)}`)).catch(() => { console.error('CREATOR_JWT_ACCEPTANCE_ERROR=failed_verify_before_retry'); process.exitCode = 1; });
}
