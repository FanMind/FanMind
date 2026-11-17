import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { constants, openSync, fstatSync, readFileSync, closeSync, lstatSync, realpathSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { verifySource, collectEvidence, BUDGET_SECONDS } from './monthly-release-package.mjs';
import { parseProductionAuditOutput, verifyProductionAuditOutput } from './verify-production-audit-output.mjs';
const exec = promisify(execFile);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const VERIFIER_FILES = [
  'scripts/operations/monthly-release-evidence.mjs', 'scripts/operations/monthly-release-control.mjs',
  'scripts/operations/monthly-release-package.mjs', 'scripts/operations/production-release-preflight.mjs',
  'scripts/operations/verify-production-audit-output.mjs', 'scripts/operations/production-boot-readiness.mjs',
  'scripts/operations/verify-restore-drill-evidence.mjs', 'scripts/operations/verify-full-backup-restore-receipt.mjs',
  'scripts/operations/database-authorization-contract.mjs', 'scripts/public-health-policy.mjs',
];
const HEX = /^[a-f0-9]{64}$/u;
const bootMs = () => Math.floor(Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0]) * 1000);
const SHA = /^[a-f0-9]{40}$/u;
const assert = (ok, code) => { if (!ok) throw new Error(code); };

export function readPinnedFile(path, digest, uid = 0, mode = 0o644) {
  assert(resolve(path) === path && realpathSync(path) === path, 'evidence_path');
  for (let p = dirname(path); ; p = dirname(p)) {
    const s = lstatSync(p);
    assert(s.uid === uid && (s.mode & 0o022) === 0 && !s.isSymbolicLink(), 'evidence_parent');
    if (p === '/') break;
  }
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const a = fstatSync(fd, { bigint: true });
    assert(a.isFile() && a.uid === BigInt(uid) && (a.mode & 0o777n) === BigInt(mode) && a.size > 0n && a.size <= 524288n, 'evidence_metadata');
    const bytes = readFileSync(fd);
    const b = fstatSync(fd, { bigint: true }), c = lstatSync(path, { bigint: true });
    assert(['ino', 'dev', 'size', 'mtimeNs', 'ctimeNs'].every(k => a[k] === b[k] && a[k] === c[k]), 'evidence_changed');
    if (digest) assert(sha256(bytes) === digest, 'evidence_digest');
    return bytes;
  } finally { closeSync(fd); }
}

export function extractProductionBody(text) {
  const begin = '          # BEGIN_REVIEWED_PRODUCTION_BODY\n', end = '          # END_REVIEWED_PRODUCTION_BODY\n';
  assert(text.split(begin).length === 2 && text.split(end).length === 2, 'body_markers');
  const body = text.split(begin)[1].split(end)[0];
  assert(body.split('\n').every(line => !line || line.startsWith('          ')), 'body_indentation');
  return 'set -euo pipefail\n' + body.split('\n').map(line => line.slice(10)).join('\n');
}

export const SQL_PROOFS = Object.freeze({
  'supabase/controlled/workspace_server_owned_columns_mvp.sql': { sqlSha256: 'a8fcffc7d473f222129c95a581a3dc8a41460c3f0d8df260835a2821163abc1b', workflow: '.github/workflows/monthly-release-sql-verify.yml', prefix: 'MONTHLY_SQL', evidenceVersion: 2, id: 'workspace_fields' },
  'supabase/controlled/ai_capacity_entitlement_writer.sql': { sqlSha256: '536c15017c53a979d876d3b1174caecfbfb719ff49fc7b0262d174b1bb0128dc', workflow: '.github/workflows/monthly-release-sql-verify.yml', prefix: 'MONTHLY_SQL', evidenceVersion: 2, id: 'capacity_writer' },
  'supabase/controlled/chat_admin_media_catalogue.sql': { sqlSha256: '47220fcf870d70ac6fa9c64c8305c4b9170df374fe0610293d14d274c09a150e', workflow: '.github/workflows/monthly-release-sql-verify.yml', prefix: 'MONTHLY_SQL', evidenceVersion: 2, id: 'media_catalogue' },
  'supabase/controlled/chat_admin_media_prices.sql': { sqlSha256: '9c6a323c27821bf10ef24a96fe1ff318da8375d7352b712cbfe28994c7e444d4', workflow: '.github/workflows/monthly-release-sql-verify.yml', prefix: 'MONTHLY_SQL', evidenceVersion: 2, id: 'media_prices' },
  'supabase/controlled/support_ai_consent.sql': { sqlSha256: 'cd610fc3775b5d6e9f074b6f8af0125effd5bc360367bf992e5809b45c0f8e61', workflow: '.github/workflows/monthly-release-sql-verify.yml', prefix: 'MONTHLY_SQL', evidenceVersion: 2, id: 'support_consent' },
  'supabase/controlled/chat_admin_media_storage_finalization.sql': { sqlSha256: 'd021366a66d968d3ddeeb594a67ded277e723a0bd9759a439e4f8fb5ae3f8218', workflow: '.github/workflows/monthly-release-sql-verify.yml', prefix: 'MONTHLY_SQL', evidenceVersion: 2, id: 'media_storage' },
  'supabase/migrations/20260718173000_enable_safe_backup_verification.sql': { sqlSha256: '8eed56adadef5c5a9a6075ead6a956d8414b8c592fe583ce8cdb6a4ab00e0cfa', workflow: '.github/workflows/backup-verification-production-migration.yml', prefix: 'BACKUP_VERIFICATION_MIGRATION' },
  'supabase/migrations/20260718190000_operations_monitor_components.sql': { sqlSha256: '7470587f067152bbf40679572bd7f34e0e7fef281e71ca771da151abad402a06', workflow: '.github/workflows/operations-monitor-production-migration.yml', prefix: 'OPERATIONS_MONITOR_MIGRATION' },
  'supabase/migrations/20260718203000_privacy_server_error_tracking.sql': { sqlSha256: 'de48786613b33bc7d592d018c365cff5ca1417f18176e47c964d9d6a796f3cef', workflow: '.github/workflows/server-error-production-control.yml', prefix: 'SERVER_ERROR_MIGRATION' },
  'supabase/controlled/20260806203023_harden_trigger_function_privileges.sql': { sqlSha256: '6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132', workflow: '.github/workflows/trigger-function-hardening-production-control.yml', prefix: 'TRIGGER_FUNCTION_HARDENING_PRODUCTION' },
});

export function validateSqlReceipt(receipt, item, a, now = Date.now()) {
  const adapter = SQL_PROOFS[item.path];
  assert(adapter && item.controller === adapter.workflow && item.sha256 === adapter.sqlSha256, 'sql_adapter_required');
  assert(receipt?.target === 'production' && receipt.candidate === a.source.candidate && receipt.base === a.source.base
    && receipt.path === item.path && receipt.sqlSha256 === item.sha256 && receipt.action === 'verify' && receipt.result === 'PASS'
    && Number.isSafeInteger(receipt.runId) && receipt.runId > 0 && Number.isSafeInteger(receipt.jobId) && receipt.jobId > 0 && Number.isSafeInteger(receipt.runAttempt) && receipt.runAttempt > 0, 'sql_receipt_binding');
  if (adapter.evidenceVersion === 2) assert(receipt.version === 2 && receipt.state === 'EXACT'
    && receipt.project === 'drqkpdvtbbrrdwmtrodz' && [a.source.base,a.source.candidate].includes(receipt.live) && receipt.sourceTree === a.source.tree
    && SHA.test(receipt.sourceTree ?? ''), 'sql_state_not_exact');
  if (adapter.evidenceVersion === 2 && receipt.live !== a.source.base && receipt.live === a.source.candidate) assert(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(a.resumeAfterAttempt ?? ''), 'sql_resume_approval_required');
  assert(now >= Date.parse(receipt.verifiedAt) && now - Date.parse(receipt.verifiedAt) <= 900000, 'sql_receipt_expired');
}

export async function verifySqlProvenance(a, receipts, get, getLog) {
  assert(Array.isArray(receipts) && receipts.length === a.sql.length, 'sql_receipts_missing');
  for (const [i, item] of a.sql.entries()) {
    const receipt = receipts[i]; validateSqlReceipt(receipt, item, a);
    const adapter = SQL_PROOFS[item.path], run = await get(`actions/runs/${receipt.runId}`);
    assert(run.repository?.full_name === 'FanMind/FanMind' && run.head_sha === a.source.candidate && run.path === adapter.workflow
      && run.status === 'completed' && run.conclusion === 'success' && run.run_attempt === receipt.runAttempt, 'sql_run_binding');
    if (adapter.evidenceVersion === 2) assert(run.event === 'workflow_dispatch' && run.head_branch === 'main'
      && String(run.actor?.id) === '270165082', 'sql_controller_authority');
    const jobs = await get(`actions/runs/${receipt.runId}/attempts/${receipt.runAttempt}/jobs?per_page=100`);
    assert(jobs.total_count <= 100 && jobs.jobs?.length === jobs.total_count, 'sql_jobs_incomplete');
    const job = jobs.jobs.find(j => j.id === receipt.jobId);
    assert(job?.conclusion === 'success' && Date.parse(job.completed_at) === Date.parse(receipt.verifiedAt), 'sql_job_binding');
    if (adapter.evidenceVersion === 2) assert(job.name === 'Verify one installed SQL state (read only)'
      && job.steps?.some(s => s.name === 'Collect exact Production SQL state without writes' && s.conclusion === 'success')
      && Date.parse(job.started_at) <= Date.parse(job.completed_at), 'sql_verifier_step');
    const log = await getLog(receipt.jobId);
    if (adapter.evidenceVersion === 2) {
      const expected = { ADAPTER: adapter.id, PATH: item.path, SHA256: item.sha256, TARGET: 'production',
        PROJECT: receipt.project, BASE: a.source.base, LIVE: receipt.live, CANDIDATE: a.source.candidate, TREE: a.source.tree,
        ACTION: 'verify', STATE: 'EXACT', RESULT: 'verified' };
      const values = new Map();
      for (const line of log.split(/\r?\n/u)) {
        const m = line.match(/^(\d{4}-\d\d-\d\dT[0-9:.]+Z) MONTHLY_SQL_([A-Z0-9_]+)=([a-zA-Z0-9_./-]+)$/u);
        if (!m) continue;
        assert(Date.parse(m[1]) >= Date.parse(job.started_at) && Date.parse(m[1]) < Date.parse(job.completed_at) + 1000
          && Date.parse(m[1]) <= Date.now() && Date.now() - Date.parse(m[1]) <= 900000, 'sql_log_time');
        assert(!values.has(m[2]), 'sql_log_duplicate'); values.set(m[2], m[3]);
      }
      assert(values.size === Object.keys(expected).length
        && Object.entries(expected).every(([key, value]) => values.get(key) === value), 'sql_postflight_not_verified');
      continue;
    }
    // Only actual timestamped output, never echoed shell source/ANSI groups.
    const lines = log.split(/\r?\n/u).map(line => line.match(/^\d{4}-\d\d-\d\dT[0-9:.]+Z ([_A-Z]+=[a-z_]+)$/u)?.[1]).filter(Boolean);
    assert(lines.includes(`${adapter.prefix}_ACTION=verify`) && lines.includes(`${adapter.prefix}_RESULT=verified`), 'sql_postflight_not_verified');
  }
}

export function validateAdmission(a, hash, base, candidate, now = Date.now()) {
  assert(a?.version === 1 && HEX.test(hash) && sha256(JSON.stringify(a.source, null, 2) + '\n') === hash, 'package_digest');
  assert(a.source.base === base && a.source.candidate === candidate && SHA.test(base) && SHA.test(candidate), 'package_identity');
  assert(a.target === 'production' && a.controller === '.github/workflows/deploy-fanmind.yml' && a.ownerId === '270165082', 'admission_authority');
  const issued = Date.parse(a.issuedAt), expires = Date.parse(a.expiresAt);
  assert(Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && now < expires && expires - issued <= 86400000, 'admission_expired');
  assert(Array.isArray(a.coverage) && a.coverage.length === a.source.changes.length && new Set(a.coverage.map(x => x.path)).size === a.coverage.length, 'coverage_incomplete');
  const runs = a.source.evidence?.acceptances?.map(x => x.id) ?? [];
  for (const change of a.source.changes) {
    const c = a.coverage.find(x => x.path === change.path);
    assert(c && ((c.kind === 'staging' && runs.includes(c.runId)) || (c.kind === 'source_ci' && /^(?:docs\/|project-memory\/|tests\/|scripts\/|\.github\/)/u.test(c.path))), 'coverage_unverified');
  }
  assert(Array.isArray(a.sql) && a.sql.length === a.source.sql.length && new Set(a.sql.map(x => x.path)).size === a.sql.length, 'sql_incomplete');
  for (const sql of a.source.sql) {
    const decision = a.sql.find(x => x.path === sql.path);
    assert(decision && decision.sha256 === sql.sha256 && decision.backwardCompatible === true
      && decision.decision === 'verified_applied' && SQL_PROOFS[sql.path]?.workflow === decision.controller && sql.sha256 === SQL_PROOFS[sql.path].sqlSha256 && HEX.test(decision.postflightSha256)
      && /^\.github\/workflows\/[a-z0-9-]+\.yml$/u.test(decision.controller), 'sql_not_verified');
  }
  assert(a.restore?.productionCommit === base && HEX.test(a.restore.schemaFingerprint) && Array.isArray(a.restore.receipts)
    && a.restore.receipts.length === 4 && a.restore.receipts.every(x => HEX.test(x)), 'restore_binding');
  assert(a.rehearsal?.result === 'PASS' && HEX.test(a.rehearsal.reportSha256) && a.rehearsal.candidate === candidate
    && a.rehearsal.pg17 === true && a.rehearsal.sourceTree === a.source.tree
    && SHA.test(a.rehearsal.sourceCommit ?? '') && Number.isSafeInteger(a.rehearsal.runId)
    && Number.isSafeInteger(a.rehearsal.elapsedMs) && a.rehearsal.elapsedMs > 0 && a.rehearsal.elapsedMs <= 3600000, 'rehearsal_missing');
  assert(typeof a.configuration?.supportDisabled === 'boolean' && typeof a.configuration?.supportHelp === 'boolean', 'configuration_missing');
}

// Observe only; never terminate database commits, PM2 rollback or privileged writes.
// Children stop at safe boundaries. A late protective operation is NOT success.
export async function runRelease(a, deps, previous = null) {
  const clock = deps.clock ?? (() => performance.now());
  const beforeMs = deps.elapsedBeforeMs ?? 0;
  assert(Number.isFinite(beforeMs) && beforeMs >= 0, 'clock_invalid');
  const start = clock() - beforeMs, attempt = randomUUID();
  const state = { version: 1, attempt, packageSha256: deps.packageHash, base: a.source.base, candidate: a.source.candidate,
    state: 'STARTED', phases: [], elapsedMs: 0, recovery: 'REVALIDATE_SAME_PACKAGE_AND_ACTUAL_STATE', updatedAt: new Date().toISOString() };
  const save = async () => { state.elapsedMs = Math.ceil(clock() - start); state.updatedAt = new Date().toISOString(); await deps.save(structuredClone(state)); };
  let expired = false;
  const timer = setInterval(() => {
    if (!expired && clock() - start >= 3600000) { expired = true; state.state = 'BUDGET_EXCEEDED_PENDING_SAFE_BOUNDARY';
      try { deps.observe?.({ ...structuredClone(state), elapsedMs: Math.ceil(clock() - start) })?.catch?.(() => {}); } catch { /* Final safe-boundary save remains mandatory. */ }
    }
  }, 250);
  let journalStarted = false;
  try {
    if (previous) {
      assert(previous.packageSha256 === deps.packageHash && previous.base === state.base && previous.candidate === state.candidate, 'resume_identity');
      if (previous.state !== 'COMPLETE') assert(a.resumeAfterAttempt === previous.attempt && Date.parse(a.issuedAt) >= Date.parse(previous.updatedAt), 'resume_inspection_approval_required');
    }
    journalStarted = true; await save();
    for (const phase of Object.keys(BUDGET_SECONDS)) {
      const begin = clock(), left = Math.min(BUDGET_SECONDS[phase] * 1000 - (phase === 'preflight' ? beforeMs : 0), 3600000 - (begin - start));
      assert(!expired && left > 0, 'budget_exceeded');
      state.state = `${phase.toUpperCase()}_PENDING`; await save();
      await deps[phase]({ remainingMs: left, previous, attempt });
      const elapsedMs = Math.ceil(clock() - begin + (phase === 'preflight' ? beforeMs : 0));
      state.phases.push({ phase, elapsedMs, result: 'PASS' });
      assert(!expired && elapsedMs <= BUDGET_SECONDS[phase] * 1000 && clock() - start <= 3600000, 'budget_exceeded');
      await save();
    }
    state.state = 'COMPLETE'; await save();
    assert(!expired && clock() - start <= 3600000, 'budget_exceeded');
    state.elapsedMs = Math.ceil(clock() - start); return state;
  } catch (error) {
    state.failure = /^[a-z0-9_]+$/u.test(error.message) ? error.message : 'operation_failed';
    state.state = state.failure === 'budget_exceeded' ? 'BUDGET_EXCEEDED_NOT_COMPLETE' : state.phases.length === 0 ? 'STOPPED_BEFORE_DEPLOY' : 'INSPECTION_REQUIRED';
    if (journalStarted) await save(); return state;
  } finally { clearInterval(timer); }
}

export function verifyReleaseAudit(raw, live, candidate, now = Date.now()) {
  const values = parseProductionAuditOutput(raw);
  const origin = values.get('ORIGIN_MAIN');
  assert(origin?.length === 1 && [live, candidate].includes(origin[0]), 'audit_origin');
  const time = Date.parse(values.get('AUDIT_UTC')?.[0]);
  assert(Number.isFinite(time) && now >= time && now - time <= 120000, 'audit_stale');
  // Canonical verifier otherwise expects origin==live. Monthly source is fetched
  // first; bind its different origin to the exact reviewed candidate explicitly.
  return verifyProductionAuditOutput(raw.replace(/^ORIGIN_MAIN=.*$/mu, `ORIGIN_MAIN=${live}`), live);
}

export function validatePrivateProof(proof, reviewed) {
  const admission = proof.admission;
  assert(proof.restoreVerified === true && proof.rehearsalVerified === true, 'private_proof_not_verified');
  for (const [path, hash] of Object.entries(proof.codeSha256 ?? {})) {
    assert(/^scripts\/(?:operations\/)?[a-z0-9-]+\.mjs$/u.test(path) && sha256(readFileSync(join(reviewed, path))) === hash, 'verifier_version');
  }
  assert(JSON.stringify(Object.keys(proof.codeSha256 ?? {}).sort()) === JSON.stringify([...VERIFIER_FILES].sort()), 'verifier_files');
  return admission;
}

export function createProductionAdapter({ admission, proof, packageHash, root, base, candidate, previous, command, phaseCommand, get, getLog, env = process.env }) {
  let actualLive;
  const audit = async live => {
    const { stdout } = await command('/usr/local/lib/fanmind-audit/read-only-production-audit.sh', [], { timeout: 90000 });
    verifyReleaseAudit(stdout, live, candidate);
  };
  return {
    preflight: async () => {
      if (proof.sqlReceipts?.some(r => r.version === 2 && r.live === candidate && r.live !== base))
        assert(previous && previous.attempt === admission.resumeAfterAttempt, 'sql_resume_state_required');
      validateAdmission(admission, packageHash, base, candidate);
      verifySource(root, admission.source);
      const run = await get(`actions/runs/${env.GITHUB_RUN_ID}`);
      assert(run.path === '.github/workflows/deploy-fanmind.yml' && run.head_sha === candidate && Number.isSafeInteger(run.check_suite_id), 'run_binding');
      const rehearsal = await get(`actions/runs/${admission.rehearsal.runId}`);
      assert(rehearsal.path === '.github/workflows/ci-fanmind.yml' && rehearsal.status === 'completed'
        && rehearsal.conclusion === 'success' && rehearsal.head_sha === admission.rehearsal.sourceCommit
        && rehearsal.repository?.full_name === 'FanMind/FanMind', 'rehearsal_run');
      const rehearsalCommit = await get(`commits/${rehearsal.head_sha}`);
      assert(rehearsalCommit.commit?.tree?.sha === admission.source.tree, 'rehearsal_tree');
      const jobs = await get(`actions/runs/${rehearsal.id}/attempts/${rehearsal.run_attempt}/jobs?per_page=100`);
      assert(jobs.jobs?.some(j => j.conclusion === 'success' && j.steps?.some(s => s.name === 'Prove full monthly release rehearsal with PostgreSQL 17' && s.conclusion === 'success')), 'rehearsal_step');
      const refs = admission.source.evidence;
      const fresh = await collectEvidence(candidate, refs.staging.id, refs.acceptances.map(x => x.id), get, run.check_suite_id);
      assert(JSON.stringify(fresh) === JSON.stringify(refs), 'staging_evidence_changed');
      await verifySqlProvenance(admission, proof.sqlReceipts, get, getLog);
      const { stdout } = await command('curl', ['-fsS', '--max-time', '15', 'https://fanmind.ch/api/version'], { timeout: 20000 });
      actualLive = JSON.parse(stdout).releaseCommit;
      assert(actualLive === base || (previous && actualLive === candidate), 'live_drift');
      await audit(actualLive);
    },
    deploy: async ({ remainingMs }) => {
      validateAdmission(admission, packageHash, base, candidate);
      const { stdout: reviewedBody } = await command('/usr/bin/git', ['-C', root, 'show', `${candidate}:.github/workflows/deploy-fanmind.yml`]);
      const body = extractProductionBody(reviewedBody);
      await phaseCommand('bash', ['-euo', 'pipefail'], remainingMs, { input: body, env: { EXPECTED_CURRENT_RELEASE: actualLive } });
    },
    tests: async ({ remainingMs }) => {
      await phaseCommand('/usr/bin/timeout', ['--signal=TERM', '--kill-after=10s', String(Math.max(1, Math.floor(remainingMs / 1000))), 'npm', 'run', 'smoke:public'], remainingMs, { cwd: root, env: { FANMIND_SMOKE_BASE_URL: 'https://fanmind.ch', FANMIND_EXPECTED_RELEASE_COMMIT: candidate, FANMIND_EXPECTED_RUNTIME_ENVIRONMENT: 'production' } });
    },
    closeout: async () => { await audit(candidate); },
  };
}

export async function runMonthlyCommand(file, args, remainingMs, reviewed, options = {}, environment = process.env) {
    const deadline = String(bootMs() + remainingMs);
    await new Promise((yes, no) => {
      const childEnv = { ...environment, ...options.env, FANMIND_MONTHLY_CONTROL: join(reviewed, 'scripts/operations/monthly-release-control.mjs'), FANMIND_MONTHLY_PHASE_DEADLINE: deadline };
      delete childEnv.GITHUB_TOKEN; // Never persist the Actions token in PM2 or its dump.
      const child = spawn(file, args, { ...options, stdio: options.stdio ?? ['pipe', 'ignore', 'ignore'], env: childEnv });
      child.on('error', no); child.on('close', code => code === 0 ? yes() : no(new Error('operation_failed')));
      child.stdin.end(options.input);
    });
}

async function main() {
  if (['checkpoint', 'remaining'].includes(process.argv[2])) {
    const minimum = process.argv[3] === 'switch' ? 300000 : 0;
    const remaining = Number(process.env.FANMIND_MONTHLY_PHASE_DEADLINE) - bootMs();
    assert(Number.isFinite(remaining) && remaining > minimum, 'budget_exceeded');
    if (process.argv[2] === 'remaining') process.stdout.write(String(Math.max(1, Math.floor(remaining / 1000))));
    return;
  }
  assert(process.argv[2] === 'run' && process.env.GITHUB_REPOSITORY === 'FanMind/FanMind'
    && process.env.GITHUB_REF === 'refs/heads/main' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && process.env.GITHUB_ACTOR_ID === '270165082' && process.env.GITHUB_SHA === process.env.EXPECTED_RELEASE_COMMIT, 'controller_authority');
  const reviewed = resolve(process.argv[3]), root = '/var/www/fanmind';
  assert(Number.isFinite(Number(process.env.MONTHLY_RELEASE_STARTED_MS)) && bootMs() - Number(process.env.MONTHLY_RELEASE_STARTED_MS) >= 0 && bootMs() - Number(process.env.MONTHLY_RELEASE_STARTED_MS) < 600000, 'preflight_budget_exceeded');
  const packageHash = process.env.MONTHLY_RELEASE_SHA256;
  assert(HEX.test(packageHash ?? ''), 'package_hash');
  // Only a separately installed root-owned fixed verifier may read private
  // receipts. No raw restore receipt or new secret is exposed to this runner.
  readPinnedFile('/usr/local/sbin/fanmind-monthly-release-evidence', sha256(readFileSync(join(reviewed, 'scripts/operations/monthly-release-evidence.sh'))), 0, 0o755);
  const { stdout: proofBytes } = await exec('/usr/bin/sudo', ['-n', '/usr/local/sbin/fanmind-monthly-release-evidence', packageHash, process.env.EXPECTED_CURRENT_RELEASE, process.env.EXPECTED_RELEASE_COMMIT], { timeout: 45000, maxBuffer: 524288 });
  const proof = JSON.parse(proofBytes), admission = validatePrivateProof(proof, reviewed);
  const candidate = process.env.EXPECTED_RELEASE_COMMIT, base = process.env.EXPECTED_CURRENT_RELEASE;
  validateAdmission(admission, packageHash, base, candidate);
  verifySource(root, admission.source);
  assert(admission.configuration.supportDisabled === (process.env.FANMIND_REQUIRE_SUPPORT_DISABLED === 'true')
    && admission.configuration.supportHelp === (process.env.FANMIND_SUPPORT_HELP_BUILD_ENABLE === 'true'), 'configuration_drift');
  const directory = join(root, '.monthly-release', packageHash); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, 'state.json');
  let previous = null;
  try { previous = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  let sequence = 0;
  const history = join(directory, 'history'); mkdirSync(history, { recursive: true, mode: 0o700 });
  const save = async value => { writeFileSync(join(history, `${value.attempt}-${sequence++}.json`), JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 }); const tmp = join(directory, `${randomUUID()}.tmp`); writeFileSync(tmp, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 }); renameSync(tmp, file); };
  const command = async (file, args, options = {}) => exec(file, args, { maxBuffer: 2 * 1024 * 1024, ...options });
  const phaseCommand = (file, args, ms, options) => runMonthlyCommand(file, args, ms, reviewed, options);

  const get = async path => {
    const r = await fetch(`https://api.github.com/repos/FanMind/FanMind/${path}`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
    assert(r.ok, 'github_unavailable'); return r.json();
  };
  const getLog = async id => {
    const r = await fetch(`https://api.github.com/repos/FanMind/FanMind/actions/jobs/${id}/logs`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }, signal: AbortSignal.timeout(15000), redirect: 'manual' });
    let logResponse = r;
    if (r.status === 302) {
      const url = new URL(r.headers.get('location'));
      // GitHub Actions log storage only; never follow a header to a private
      // address/arbitrary host and never forward the API Authorization header.
      if (url.protocol !== 'https:' || !/^productionresultssa[0-9]+\.blob\.core\.windows\.net$/u.test(url.hostname)) throw new Error('sql_log_redirect_unsupported');
      logResponse = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    }
    assert(logResponse.ok, 'sql_log_unavailable'); const log = await logResponse.text(); assert(log.length <= 4 * 1024 * 1024, 'sql_log_too_large'); return log;
  };
  const adapter = createProductionAdapter({ admission, proof, packageHash, reviewed, root, base, candidate, previous, command, phaseCommand, get, getLog });
  const state = await runRelease(admission, { ...adapter,
    packageHash, save, clock: bootMs, elapsedBeforeMs: bootMs() - Number(process.env.MONTHLY_RELEASE_STARTED_MS),
    observe: value => { process.stderr.write('MONTHLY_RELEASE=OVER_BUDGET_WAITING_SAFE_BOUNDARY\n'); return save(value); },
  }, previous);
  process.stdout.write(`MONTHLY_RELEASE=${state.state}\nMONTHLY_ELAPSED_MS=${state.elapsedMs}\n`);
  if (state.state !== 'COMPLETE') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { process.stderr.write('MONTHLY_RELEASE=BLOCK\n'); process.exitCode = 1; });
