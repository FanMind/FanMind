import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { targetFor, ownerSql, replaceSupportFlag, withActivationRollback, PRODUCTION } from '../scripts/operations/support-production-control.mjs';

const email = 'operator@example.test';
const commit = 'a'.repeat(40);
const { parseSupportSetting } = createRequire(import.meta.url)('../ops/pm2/support-runtime-setting.cjs');
const base = {
  GITHUB_REPOSITORY: 'FanMind/FanMind', GITHUB_REF: 'refs/heads/main', GITHUB_ACTOR_ID: '270165082',
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: commit, FANMIND_SUPPORT_REVIEWED_COMMIT: commit,
  FANMIND_RUNTIME_ENVIRONMENT: 'production', NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION}.supabase.co`,
  NEXT_PUBLIC_APP_URL: 'https://fanmind.ch', FANMIND_SUPPORT_CONFIRM: 'support-production-owner',
  FANMIND_BACKUP_DB_HOST: `db.${PRODUCTION}.supabase.co`, FANMIND_BACKUP_DB_USER: 'postgres',
  FANMIND_BACKUP_DB_NAME: 'postgres', FANMIND_BACKUP_PGPASSFILE: '/etc/fanmind-backup/pgpass',
  FANMIND_ADMIN_EMAILS: email,
};
test('Production owner requires the actual configured platform Admin and fixed target', () => {
  assert.equal(targetFor(base, 'owner', email).email, email);
  for (const patch of [
    { NEXT_PUBLIC_SUPABASE_URL: 'https://vshyhvgcmrlagvfnvomc.supabase.co' },
    { FANMIND_ADMIN_EMAILS: 'someone-else@example.test' }, { GITHUB_ACTOR_ID: '123' },
    { FANMIND_BACKUP_DB_USER: 'postgres.another-project' }, { GITHUB_SHA: 'b'.repeat(40) },
    { FANMIND_SUPPORT_CONFIRM: 'support-production-activate' }, { PGOPTIONS: '-c role=postgres' },
  ]) assert.throws(() => targetFor({ ...base, ...patch }, 'owner', email));
});
test('scheduled cleanup allows only explicitly enabled retention/monitor on pinned reviewed source', () => {
  const scheduled = { ...base, GITHUB_EVENT_NAME: 'schedule', GITHUB_SHA: 'b'.repeat(40), FANMIND_SUPPORT_SCHEDULE_ENABLED: 'true' };
  assert.equal(targetFor(scheduled, 'monitor', email).commit, commit);
  assert.throws(() => targetFor(scheduled, 'owner', email));
  assert.throws(() => targetFor({ ...scheduled, FANMIND_SUPPORT_SCHEDULE_ENABLED: 'false' }, 'retention', email));
});
test('Owner mutation is one guarded transaction and never changes Auth/admin configuration', () => {
  const sql = ownerSql({ ...targetFor(base, 'owner', email), uuid: '11111111-1111-4111-8111-111111111111' }, true);
  assert.match(sql, /pg_advisory_xact_lock\(1350,1417\)/);
  assert.match(sql, /email_confirmed_at IS NOT NULL/);
  assert.match(sql, /banned_until/);
  assert.match(sql, /lower\(email\)='operator@example.test'/);
  assert.match(sql, /user_id<>/);
  assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM) auth\./i);
  assert.doesNotMatch(sql, /GRANT|ALTER ROLE/i);
});
test('Support flag change preserves unrelated settings and rejects ambiguity', () => {
  const original = 'OTHER_SECRET=private\nFANMIND_SUPPORT_CENTRE_ENABLED=false\nOTHER_FLAG=true\n';
  assert.equal(replaceSupportFlag(original, true), 'OTHER_SECRET=private\nFANMIND_SUPPORT_CENTRE_ENABLED=true\nOTHER_FLAG=true\n');
  assert.equal(replaceSupportFlag('OTHER=true\n', true), 'OTHER=true\nFANMIND_SUPPORT_CENTRE_ENABLED=true\n');
  assert.throws(() => replaceSupportFlag(original + 'FANMIND_SUPPORT_CENTRE_ENABLED=true\n', true));
  assert.throws(() => replaceSupportFlag('FANMIND_SUPPORT_CENTRE_ENABLED="true"\n', true));
});
test('PM2 uses only the persistent support flag and fails closed on ambiguous values', () => {
  assert.equal(parseSupportSetting('UNRELATED_SECRET=private\n'), 'false');
  assert.equal(parseSupportSetting('UNRELATED_SECRET=private\nFANMIND_SUPPORT_CENTRE_ENABLED=true\n'), 'true');
  assert.equal(parseSupportSetting('FANMIND_SUPPORT_CENTRE_ENABLED=false\n'), 'false');
  assert.throws(() => parseSupportSetting('FANMIND_SUPPORT_CENTRE_ENABLED=true\nFANMIND_SUPPORT_CENTRE_ENABLED=false\n'));
  assert.throws(() => parseSupportSetting('FANMIND_SUPPORT_CENTRE_ENABLED=maybe\n'));
  const pm2 = readFileSync('ops/pm2/fanmind.production.config.cjs', 'utf8');
  assert.match(pm2, /FANMIND_SUPPORT_CENTRE_ENABLED: readSupportSetting\(currentReleaseLink\)/);
});
test('activation failure restores the prior state and exposes rollback failure', () => {
  const before = 'UNRELATED_SECRET=keep\nFANMIND_SUPPORT_CENTRE_ENABLED=false\n';
  let state = before;
  let restored = false;
  assert.throws(() => withActivationRollback(
    () => { state = replaceSupportFlag(state, true); },
    () => { throw new Error('health failed'); },
    () => { state = before; restored = true; },
  ), /activation_failed_rolled_back/);
  assert.equal(state, before);
  assert.equal(restored, true);
  assert.throws(() => withActivationRollback(() => { throw new Error('reload'); }, () => {}, () => { throw new Error('rollback reload'); }), /activation_rollback_failed/);
});
test('workflow serializes with deployment and cleanup stays disabled by default', () => {
  const workflow = readFileSync('.github/workflows/support-production-control.yml', 'utf8');
  assert.match(workflow, /group: fanmind-production-deploy/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /FANMIND_SUPPORT_PRODUCTION_SCHEDULE_ENABLED == 'true'/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.doesNotMatch(workflow, /continue-on-error|\|\| true/);
  const source = readFileSync('scripts/operations/support-production-control.mjs', 'utf8');
  assert.match(source, /classify\(catalogue, reference\) !== 'EXACT'/);
  assert.match(source, /PGSSLMODE: 'verify-full'/);
  assert.match(source, /activation_rollback_failed/);
  assert.match(source, /operational_readiness_missing/);
  assert.doesNotMatch(source, /console\.(?:log|error)\((?:env|result|catalogue|target)/);
});
