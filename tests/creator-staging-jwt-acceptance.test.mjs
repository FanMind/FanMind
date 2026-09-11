import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runCreatorJwtAcceptance, validateCreatorAcceptanceEnvironment } from '../scripts/operations/creator-staging-jwt-acceptance.mjs';
import { STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME, STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME, STAGING_SYNTHETIC_MEMBER_EMAIL } from '../src/lib/stagingSyntheticFixturePolicy.mjs';
const primary = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondary = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const creator = '44444444-4444-4444-8444-444444444444';
function environment() { return {
  FANMIND_RUNTIME_ENVIRONMENT: 'staging', NEXT_PUBLIC_APP_URL: 'https://staging.fanmind.ch',
  FANMIND_TARGET_SUPABASE_PROJECT_REF: 'stagingref', FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: 'productionref', FANMIND_STAGING_SUPABASE_URL: 'https://stagingref.supabase.co',
  GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'a'.repeat(40), FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1',
  FANMIND_STAGING_CREATOR_ACCEPT_CONFIRM: 'accept-creator-foundation', FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true', FANMIND_NON_PRODUCTION_WRITE_ACK: 'I_UNDERSTAND_NON_PRODUCTION_ONLY',
  FANMIND_STAGING_E2E_WORKSPACE_ID: primary, FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID: secondary,
  FANMIND_STAGING_E2E_EMAIL: 'synthetic-primary@example.invalid', FANMIND_STAGING_E2E_SECONDARY_EMAIL: 'synthetic-secondary@example.invalid',
  FANMIND_STAGING_E2E_PASSWORD: 'SyntheticPrimaryOnly1234!', FANMIND_STAGING_E2E_SECONDARY_PASSWORD: 'SyntheticSecondaryOnly1234!', FANMIND_STAGING_E2E_MEMBER_PASSWORD: 'Fm1!'+'a'.repeat(64),
  FANMIND_STAGING_SUPABASE_ANON_KEY: 'sb_publishable_synthetic', FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic',
}; }
function harness({ changedFixture = false, preexisting = false, interruptedCreate = false, failedDelete = false, legacyKeys = false } = {}) {
  const env = environment(); const calls = []; const saved = new Map(); const logouts = [];
  if (legacyKeys) { env.FANMIND_STAGING_SUPABASE_ANON_KEY = 'eyJ.synthetic.anon'; env.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY = 'eyJ.synthetic.service'; }
  if (preexisting) saved.set(primary, { id: creator, workspace_id: primary, internal_notes: 'Existing data, never ours' });
  const users = new Map([[env.FANMIND_STAGING_E2E_EMAIL, owner], [env.FANMIND_STAGING_E2E_SECONDARY_EMAIL, other], [STAGING_SYNTHETIC_MEMBER_EMAIL, member]]);
  const json = (value, status=200) => new Response(value === null ? null : JSON.stringify(value), {status});
  async function fetchImpl(url, init) {
    assert.equal(url.origin, 'https://stagingref.supabase.co'); assert.equal(init.redirect, 'error');
    const service = init.headers.apikey === env.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY;
    if (service || url.pathname === '/auth/v1/token') {
      assert.equal(init.headers.Authorization, legacyKeys ? `Bearer ${init.headers.apikey}` : undefined);
    } else {
      assert.match(init.headers.Authorization, /^Bearer (synthetic-|fanmind-ai-member-staging)/u);
    }
    calls.push({ path:url.pathname, method:init.method, query:Object.fromEntries(url.searchParams), body:init.body ? JSON.parse(init.body) : null });
    const current = calls.at(-1);
    if (url.pathname === '/auth/v1/token') return json({ access_token: current.body.email });
    if (url.pathname === '/auth/v1/user') { const email=init.headers.Authorization.slice(7); return json({ id:users.get(email), email }); }
    if (url.pathname === '/auth/v1/logout') { logouts.push(init.headers.Authorization); return json(null,204); }
    if (url.pathname === '/rest/v1/workspaces') {
      const id=url.searchParams.get('id').slice(3);const first=id===primary;
      return json([{id,name:first?STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME:STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME,owner_user_id:first?owner:other,billing_status:'active',workspace_access_mode:'active',test_access_flags:{staging_synthetic_fixture:!changedFixture}}]);
    }
    if (url.pathname === '/rest/v1/rpc/save_creator_bundle') {
      assert.equal(current.body.p_workspace_id, primary); assert.equal(current.body.p_creator_id,null);
      saved.set(primary,{id:creator,workspace_id:primary,internal_notes:current.body.p_persona.internalNotes});
      if(interruptedCreate) throw new Error('simulated committed response lost');
      throw new Error('This safety harness does not simulate successful approval');
    }
    if (url.pathname === '/rest/v1/creators') {
      const id=url.searchParams.get('workspace_id').slice(3);const row=saved.get(id);
      if(init.method==='DELETE') {
        assert.ok(row);assert.equal(url.searchParams.get('id'),`eq.${row.id}`);assert.equal(url.searchParams.get('internal_notes'),`eq.${row.internal_notes}`);
        if(failedDelete) return json({},503);
        saved.delete(id);return json([row]);
      }
      return json(row?[row]:[]);
    }
    if(['/rest/v1/creator_voice_profiles','/rest/v1/creator_sales_playbooks','/rest/v1/creator_commercial_events'].includes(url.pathname)) return json([]);
    throw new Error('Unexpected endpoint');
  }
  return {env,fetchImpl,calls,saved,logouts};
}
test('wrong target, changed release, missing acknowledgement, proxy and runtime activation produce zero network calls', async () => {
  for(const patch of [{FANMIND_TARGET_SUPABASE_PROJECT_REF:'productionref'},{FANMIND_STAGING_SUPABASE_URL:'https://productionref.supabase.co'},{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{GITHUB_SHA:'b'.repeat(40)},{GITHUB_REF:'refs/heads/feature'},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false'},{FANMIND_STAGING_CREATOR_ACCEPT_CONFIRM:'apply-creator-foundation'},{HTTP_PROXY:'https://unexpected.invalid'},{GITHUB_RUN_ID:''},{FANMIND_CREATOR_INTELLIGENCE_ENABLED:'true'},{FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID:primary}]) {
    let calls=0; await assert.rejects(runCreatorJwtAcceptance({...environment(),...patch},{fetchImpl:async()=>{calls++;throw Error('network forbidden')}}));assert.equal(calls,0);
  }
  assert.equal(validateCreatorAcceptanceEnvironment(environment()),true);
});
test('unmarked fixtures and existing Creator data never cause a bundle mutation or cleanup deletion', async () => {
  for(const options of [{changedFixture:true},{preexisting:true}]) {
    const h=harness(options);await assert.rejects(runCreatorJwtAcceptance(h.env,h));
    assert.equal(h.calls.filter(c=>c.method==='DELETE'||c.path.endsWith('/rpc/save_creator_bundle')).length,0);
    assert.equal(h.logouts.length,1);
    if(options.preexisting) assert.equal(h.saved.get(primary).internal_notes,'Existing data, never ours');
  }
});
test('lost create response still removes only the exact run-marked bundle and closes all returned sessions', async () => {
  const h=harness({interruptedCreate:true});await assert.rejects(runCreatorJwtAcceptance(h.env,h));
  assert.equal(h.saved.size,0);assert.equal(h.calls.filter(c=>c.method==='DELETE').length,1);assert.equal(h.logouts.length,3);
  const deletion=h.calls.find(c=>c.method==='DELETE');assert.equal(deletion.query.workspace_id,`eq.${primary}`);assert.match(deletion.query.internal_notes,/123:1:a{40}$/u);
});
test('unconfirmed cleanup fails closed and a fresh cleanup invocation can finish the same run', async () => {
  const h=harness({interruptedCreate:true,failedDelete:true});await assert.rejects(runCreatorJwtAcceptance(h.env,h),/cleanup_incomplete/);assert.equal(h.saved.size,1);
  const fresh=harness();fresh.saved.set(primary,h.saved.get(primary));
  const result=await runCreatorJwtAcceptance(fresh.env,{...fresh,cleanupOnly:true});assert.equal(result.result,'PASS');assert.equal(fresh.saved.size,0);assert.equal(fresh.logouts.length,2);
});
test('cleanup never removes a row created by a different run', async () => {
  const h=harness({preexisting:true});await assert.rejects(runCreatorJwtAcceptance(h.env,{...h,cleanupOnly:true}),/cleanup_incomplete/);
  assert.equal(h.saved.size,1);assert.equal(h.calls.filter(c=>c.method==='DELETE').length,0);
});
test('legacy JWT API keys retain their supported headers through indeterminate-response cleanup', async () => {
  const h=harness({legacyKeys:true,interruptedCreate:true});await assert.rejects(runCreatorJwtAcceptance(h.env,h));
  assert.equal(h.saved.size,0);assert.equal(h.logouts.length,3);
});
test('both shared-member credential lifecycles use the same non-cancelling workflow lock', () => {
  const workflows=['creator-foundation-staging.yml','browser-e2e-staging-write.yml'].map(name=>readFileSync(new URL(`../.github/workflows/${name}`,import.meta.url),'utf8'));
  for (const source of workflows) assert.match(source,/concurrency:\n  group: fanmind-staging-core-csv-write\n  cancel-in-progress: false/u);
  assert.match(workflows[0],/always\(\)[\s\S]*?--cleanup/u);
  assert.match(workflows[0],/always\(\)[\s\S]*?revoke-staging-ephemeral-member-credential/u);
});
