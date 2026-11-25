import { createHash } from 'node:crypto';
export const WORKER_COMMIT = '690ab046d537d6cb910496302208e722054e0d80';
export const APP_COMMIT = 'bb799466d2c235195fedcb4d80568f9f0bd56969';
// Read-only inspection is separate from the historical installation approval.
export const INSPECT_WORKER_COMMIT = WORKER_COMMIT;
export const INSPECT_APP_COMMIT = 'bb799466d2c235195fedcb4d80568f9f0bd56969';
export function inspectionRequest(action, controller, worker, app) {
  if (action !== 'inspect' || !/^[a-f0-9]{40}$/.test(controller ?? '') ||
      worker !== INSPECT_WORKER_COMMIT || app !== INSPECT_APP_COMMIT) fail('inspection_binding_invalid');
  return { action, controllerCommit: controller, workerCommit: worker, applicationCommit: app };
}
export const PROJECT = 'drqkpdvtbbrrdwmtrodz';
export const ENVIRONMENT = 'backup-production-recovery';
export const OWNER_ID = 270165082;
const activeBackupJobs = "from public.admin_operation_jobs where job_type in ('backup_database','backup_full','backup_storage','backup_server_config','verify_backup') and status in ('queued','claimed','running')";
export const BACKUP_ACTIVE_JOBS_SQL = `begin read only;set local statement_timeout='15s';select count(*) ${activeBackupJobs};rollback;`;

// A session lock disappears on disconnect while a host-side rename may still run.
// A prepared transaction retains its table lock until this controller releases it.
// A crashed owner leaves the queue fenced for explicit operational reconciliation.
const fenceId = 'fanmind-backup-worker-install-queue';
export async function withEmptyBackupQueue(sql, mutate) {
  sql(`BEGIN ISOLATION LEVEL READ COMMITTED;
    SET LOCAL statement_timeout = '15s';
    LOCK TABLE public.admin_operation_jobs IN SHARE ROW EXCLUSIVE MODE NOWAIT;
    DO $queue$ BEGIN
      IF EXISTS (SELECT 1 ${activeBackupJobs}) THEN
        RAISE EXCEPTION 'backup_jobs_active';
      END IF;
    END $queue$;
    PREPARE TRANSACTION '${fenceId}';`);
  try {
    return await mutate();
  } finally {
    sql(`ROLLBACK PREPARED '${fenceId}';`);
  }
}
// Historical, pre-#1515 contract hash; not evidence of what is installed today.
export const OLD_CONTRACT_SHA256 = 'b80490c17270a830dc409fc4d3755224e23facdc23a6f4ee34fb28189f7544de';
// #1515 reported an INSTALLED worker with the 39/29 contract. Require an
// actual root-owned readback matching this exact candidate before preparing
// any private rollback or Owner-scoped authorization. Never infer it from PRs.
export const EXPECTED_INSTALLED_CONTRACT_SHA256 = '2f8e2d82f5f0eb2c070f22a7c035feaf1e4112a918853bea76b9fa769be8b441';
// Only the reviewed replacement module may change. Worker/verifier stay fixed.
export const UNIT_SHA256 = 'ae4a16dea717bc407274c1623e9dc5fd1aa9f67c0dcd41465bffa9dba3a50896';
export const RELEASE_SHA256 = '93cf1b697a3140e286c40ea8b020b44955cb9978518de00f958deea6aec214a7';
export const FILES = Object.freeze({
  'database-authorization-contract.mjs': '2a3203b46dd72d114c73ed006bbf637bffd2c9dcc46657493273fd62b90478bc',
});
export const RETAINED_FILES = Object.freeze({
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
      value.unitHash !== UNIT_SHA256 || value.releaseHash !== RELEASE_SHA256 ||
      !value.previousHashes || Object.keys(value.previousHashes).sort().join('|') !== Object.keys(FILES).sort().join('|') ||
      value.previousHashes['database-authorization-contract.mjs'] !== EXPECTED_INSTALLED_CONTRACT_SHA256 ||
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
  return io.withEmptyQueue(() => applyTransition(input, io));
}

async function applyTransition(input, io) {
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
