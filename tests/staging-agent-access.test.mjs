import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, symlink, link, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STAGING_ORIGIN, OPERATOR_WORKSPACE, OPERATOR_NAME, OPERATOR_USER, STAGING_AUTH_ORIGIN, PRODUCTION_AUTH_ORIGIN, validateBinding, readPrivateBinding, allowBrowserRequest, verifyVersion, verifyOperator } from '../scripts/operations/staging-agent-access-policy.mjs';

function binding() {
  return { origin: STAGING_ORIGIN, workspaceId: OPERATOR_WORKSPACE, userId: OPERATOR_USER, email: 'operator@example.invalid', password: 'synthetic-password-only', releaseCommit: 'a'.repeat(40), supabaseOrigin: STAGING_AUTH_ORIGIN, productionSupabaseOrigin: PRODUCTION_AUTH_ORIGIN, expiresAt: new Date(Date.now() + 3600000).toISOString(), dedicatedStagingIdentityVerified: true };
}

test('valid short lease and exact target are accepted', () => {
  assert.equal(validateBinding(binding()).workspaceId, OPERATOR_WORKSPACE);
});
for (const [name, patch] of Object.entries({ production: { origin: 'https://fanmind.ch' }, lookalike: { origin: 'https://staging.fanmind.ch.attacker.invalid' }, credentialsInURL: { origin: 'https://operator:password@staging.fanmind.ch' }, otherWorkspace: { workspaceId: '10000000-0000-4000-8000-000000000002' }, missingIdentity: { userId: '' }, sameAuthTarget: { supabaseOrigin: `https://${'p'.repeat(20)}.supabase.co` }, unknownProvider: { supabaseOrigin: 'https://supabase.attacker.invalid' }, unverifiedDedicatedAccount: { dedicatedStagingIdentityVerified: false }, expired: { expiresAt: '2020-01-01T00:00:00Z' }, unboundedLease: { expiresAt: '2099-01-01T00:00:00Z' }, missingPassword: { password: '' }, missingRelease: { releaseCommit: '' } })) {
  test(`reject binding: ${name}`, () => assert.throws(() => validateBinding({ ...binding(), ...patch }), /STAGING_AGENT_/u));
}

test('request guard denies production, Meta, admin, OAuth, sends and non-auth writes', () => {
  const b = binding();
  for (const [url, method] of [
    ['https://fanmind.ch/dashboard', 'GET'], ['https://graph.facebook.com/me', 'GET'],
    [`${STAGING_ORIGIN}/admin/billing`, 'GET'], [`${STAGING_ORIGIN}/logout`, 'GET'],
    [`${STAGING_ORIGIN}/api/integrations/facebook/start`, 'GET'], [`${STAGING_ORIGIN}/channels`, 'POST'],
    [`${STAGING_ORIGIN}/api/ai/reply`, 'POST'], [`${STAGING_ORIGIN}/api/auth/session`, 'DELETE'],
    [`${b.productionSupabaseOrigin}/auth/v1/token?grant_type=password`, 'POST'],
    [`${b.supabaseOrigin}/rest/v1/workspaces`, 'PATCH'],
    [`${b.supabaseOrigin}/auth/v1/token?grant_type=refresh_token`, 'POST'],
  ]) assert.equal(allowBrowserRequest(url, method, b), false, `${method} ${url}`);
  assert.equal(allowBrowserRequest(`${STAGING_ORIGIN}/dashboard`, 'GET', b), true);
  assert.equal(allowBrowserRequest(`${STAGING_ORIGIN}/api/auth/session`, 'POST', b), true);
  assert.equal(allowBrowserRequest(`${b.supabaseOrigin}/auth/v1/token?grant_type=password`, 'POST', b), true);
});

test('runtime and exact release must agree independently', () => {
  const v = { application: 'fanmind', runtimeEnvironment: 'staging', releaseCommit: 'a'.repeat(40) };
  verifyVersion(v, v.releaseCommit);
  for (const patch of [{ runtimeEnvironment: 'production' }, { application: 'foreign' }, { releaseCommit: 'b'.repeat(40) }]) assert.throws(() => verifyVersion({ ...v, ...patch }, v.releaseCommit));
});

test('matching display name alone cannot authorize another user/workspace', () => {
  const b = binding();
  const user = { id: b.userId, email: b.email };
  const row = { id: OPERATOR_WORKSPACE, name: OPERATOR_NAME, owner_user_id: b.userId, test_access_flags: { staging_operator_workspace: true } };
  verifyOperator(user, [row], b);
  assert.throws(() => verifyOperator({ ...user, id: 'foreign' }, [row], b));
  assert.throws(() => verifyOperator(user, [{ ...row, id: 'foreign' }], b));
  assert.throws(() => verifyOperator(user, [{ ...row, test_access_flags: {} }], b));
  assert.throws(() => verifyOperator(user, [row, row], b));
});

test('secret reader rejects missing mounts, unsafe permissions, links and repository secrets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fanmind-agent-test-'));
  try {
    await chmod(dir, 0o700);
    const repo = join(dir, 'repo');
    await mkdir(repo);
    const path = join(dir, 'binding.json');
    await writeFile(path, JSON.stringify(binding()), { mode: 0o600 });
    assert.equal((await readPrivateBinding(path, repo)).workspaceId, OPERATOR_WORKSPACE);
    await assert.rejects(readPrivateBinding(undefined, repo), /SECRET_BINDING_MISSING/u);
    await chmod(path, 0o644);
    await assert.rejects(readPrivateBinding(path, repo), /SECRET_PERMISSIONS_REJECTED/u);
    await chmod(path, 0o600);
    await symlink(path, join(dir, 'symlink'));
    await assert.rejects(readPrivateBinding(join(dir, 'symlink'), repo), /SECRET_PATH_REJECTED/u);
    await link(path, join(dir, 'hardlink'));
    await assert.rejects(readPrivateBinding(path, repo), /SECRET_PERMISSIONS_REJECTED/u);
    await rm(join(dir, 'hardlink'));
    await writeFile(join(repo, 'secret.json'), JSON.stringify(binding()), { mode: 0o600 });
    await assert.rejects(readPrivateBinding(join(repo, 'secret.json'), repo), /SECRET_IN_REPOSITORY/u);
    await chmod(dir, 0o755);
    await assert.rejects(readPrivateBinding(path, repo), /SECRET_DIRECTORY_REJECTED/u);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fresh CLI without binding fails closed with no secret-bearing exception', () => {
  const script = fileURLToPath(new URL('../scripts/operations/staging-agent-access.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(child.status, 2);
  assert.equal(child.stderr, '');
  const receipt = JSON.parse(child.stdout);
  assert.equal(receipt.blocker, 'STAGING_AGENT_SECRET_BINDING_MISSING');
  assert.equal(receipt.messenger, 'NOT_TESTED');
});
