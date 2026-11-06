import { createHash } from 'node:crypto';
export const WORKER_COMMIT = '8e5dcbdca844972fb2f133c188ecfee5d5252273';
export const APP_COMMIT = '707d22702a784e3b9999d1c9ae9c1e11c096a1bc';
export const PROJECT = 'drqkpdvtbbrrdwmtrodz';
export const ENVIRONMENT = 'backup-production-recovery';
export const OWNER_ID = 270165082;
export const BACKUP_ACTIVE_JOBS_SQL = "begin read only;set local statement_timeout='15s';select count(*) from public.admin_operation_jobs where job_type in ('backup_database','backup_full','backup_storage','backup_server_config','verify_backup') and status in ('queued','claimed','running');rollback;";
export const FILES = Object.freeze({
  'database-authorization-contract.mjs': 'b80490c17270a830dc409fc4d3755224e23facdc23a6f4ee34fb28189f7544de',
  'verify-backup-artifact.mjs': 'ded9bf771c8111056c9fbb1b0e4d1dbc81b467b0f233031687dcade05f5b44af',
  'backup-worker.mjs': '71afff4a985f29f0cf235aee5686ed0760bbac0f74bb2ecc1fc7f13977c928d1',
});
export function fail(code) { const e = new Error(code); e.code = code; throw e; }
export function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
export function request(action, controller, worker, app) {
  if (!['verify','install','rollback'].includes(action)) fail('action_invalid');
  if (!/^[a-f0-9]{40}$/.test(controller ?? '')) fail('controller_commit_invalid');
  if (worker !== WORKER_COMMIT || app !== APP_COMMIT) fail('release_binding_invalid');
  return { action, controllerCommit: controller, workerCommit: worker, applicationCommit: app };
}
export function authorization(value, input, now = Date.now()) {
  if (value?.schemaVersion !== 1 || value.repository !== 'FanMind/FanMind' ||
      value.environment !== ENVIRONMENT || value.project !== PROJECT ||
      value.controllerCommit !== input.controllerCommit || value.workerCommit !== input.workerCommit ||
      value.applicationCommit !== input.applicationCommit || value.adminBypassDisabled !== true ||
      value.reviewerId !== OWNER_ID || !Array.isArray(value.actions) || !value.actions.includes(input.action) ||
      value.actions.some(x => !['verify','install','rollback'].includes(x)) ||
      !Number.isFinite(Date.parse(value.approvedAt)) || !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.approvedAt) > now || Date.parse(value.expiresAt) <= now ||
      Date.parse(value.expiresAt) - Date.parse(value.approvedAt) > 24 * 3600 * 1000 ||
      !value.controllerHashes || Object.keys(value.controllerHashes).sort().join('|') !== ['backup-worker-install-control.mjs','backup-worker-install-policy.mjs','fanmind-backup-worker-control'].sort().join('|') ||
      Object.values(value.controllerHashes).some(x => !/^[a-f0-9]{64}$/.test(x)) ||
      !/^[a-f0-9]{64}$/.test(value.unitHash ?? '') ||
      !value.previousHashes || Object.keys(value.previousHashes).sort().join('|') !== Object.keys(FILES).sort().join('|') ||
      Object.values(value.previousHashes).some(x => !/^[a-f0-9]{64}$/.test(x)) ||
      (input.action === 'install' && !value.actions.includes('rollback'))) fail('authorization_invalid');
  return value;
}
export function environmentPolicy(value, branches) {
  const rules = value?.protection_rules?.filter(x => x.type === 'required_reviewers');
  if (value?.name !== ENVIRONMENT || rules?.length !== 1 || rules[0].reviewers?.length !== 1 ||
      rules[0].reviewers[0].type !== 'User' || rules[0].reviewers[0].reviewer?.id !== OWNER_ID ||
      value.can_admins_bypass === true || value.deployment_branch_policy?.custom_branch_policies !== true ||
      value.deployment_branch_policy?.protected_branches !== false || branches?.total_count !== 1 ||
      branches.branch_policies?.length !== 1 || branches.branch_policies[0].name !== 'main' ||
      branches.branch_policies[0].type !== 'branch') fail('environment_protection_invalid');
  // The REST representation may omit can_admins_bypass. A fresh independent
  // owner attestation in the root-only authorization is also mandatory.
}
export function connection(config) {
  const host = config.FANMIND_BACKUP_DB_HOST;
  const username = config.FANMIND_BACKUP_DB_USER;
  const direct = host === `db.${PROJECT}.supabase.co` && username === 'postgres';
  const pooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host ?? '') && username === `postgres.${PROJECT}`;
  if ((!direct && !pooler) || config.NEXT_PUBLIC_SUPABASE_URL !== `https://${PROJECT}.supabase.co` ||
      config.FANMIND_BACKUP_DB_NAME !== 'postgres' || (config.FANMIND_BACKUP_DB_PORT || '5432') !== '5432') fail('database_target_invalid');
  for (const key of ['FANMIND_BACKUP_PGPASSFILE','FANMIND_BACKUP_DB_CA_CERT_PATH'])
    if (!config[key]?.startsWith('/') || config[key].includes('\0')) fail('connection_file_invalid');
  return { host, username, port:'5432', database:'postgres' };
}
export function parseSelectedEnvironment(text) {
  const names = new Set(['NEXT_PUBLIC_SUPABASE_URL','FANMIND_BACKUP_DB_HOST','FANMIND_BACKUP_DB_USER',
    'FANMIND_BACKUP_DB_NAME','FANMIND_BACKUP_DB_PORT','FANMIND_BACKUP_PGPASSFILE','FANMIND_BACKUP_DB_CA_CERT_PATH']);
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!m || !names.has(m[1])) continue;
    if (Object.hasOwn(out,m[1])) fail('environment_duplicate');
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    if (/[\r\n\0]/.test(v) || /[$`\\]/.test(v)) fail('environment_value_invalid');
    out[m[1]] = v;
  }
  out.FANMIND_BACKUP_DB_CA_CERT_PATH ||= '/usr/local/lib/fanmind-ops/supabase-root-2021-ca.crt';
  return out;
}

// Host operations are injected only by the fixed root CLI, never by argv/env.
// Persisted APPLYING survives a killed process and blocks an automatic retry.
export async function transition(input, io) {
  await io.preflight();
  const state = await io.state();
  if (input.action === 'verify') {
    if (state && state.status !== 'INSTALLED' && state.status !== 'ROLLED_BACK') fail('reconciliation_required');
    await io.checkFiles(state?.status === 'INSTALLED' ? 'new' : 'old');
    return 'VERIFIED';
  }
  if (input.action === 'install' && state) {
    if (state.status !== 'INSTALLED') fail('receipt_already_exists');
    await io.checkFiles('new');
    return 'ALREADY_INSTALLED';
  }
  if (input.action === 'rollback' && !state) fail('rollback_receipt_missing');
  if (input.action === 'rollback' && state.status === 'ROLLED_BACK') {
    await io.checkFiles('old'); return 'ALREADY_ROLLED_BACK';
  }
  await io.authorize(); // fresh TTL before any persistent preparation/write
  if (input.action === 'install') {
    await io.checkFiles('old');
    await io.snapshot(); // exclusive new private files + fsync + PREPARED receipt
  } else {
    await io.checkSaved();
    await io.checkKnownFiles(); // only exactly saved-old or exactly pinned-new
  }
  await io.authorize(); // fresh TTL before controlled service mutation
  await io.stop();
  // A timer can enqueue/claim after the initial read. Do not resume or mutate
  // program files on an indeterminate/active job; operator reconciliation first.
  await io.queueEmpty();
  await io.persist('APPLYING');
  try {
    await io.authorize(); // expire safely into the already authorized recovery path
    await io.replace(input.action === 'install' ? 'new' : 'old');
    await io.checkFiles(input.action === 'install' ? 'new' : 'old');
    await io.start();
    await io.postflight();
    await io.persist(input.action === 'install' ? 'INSTALLED' : 'ROLLED_BACK');
    return input.action === 'install' ? 'INSTALLED' : 'ROLLED_BACK';
  } catch {
    await io.persist('RECONCILIATION_REQUIRED');
    try {
      await io.stop(); await io.queueEmpty(); await io.checkSaved();
      await io.checkKnownFiles(); await io.replace('old');
      await io.checkFiles('old'); await io.start(); await io.postflight();
      await io.persist('ROLLED_BACK');
    } catch { fail('reconciliation_required'); }
    fail('installation_failed_rolled_back');
  }
}
