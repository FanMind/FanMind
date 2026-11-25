// Offline preparation only: writes a private proposal, never installs or authorizes it.
import { readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, SQL_PROOFS, validateAdmission, validateSqlReceipt } from './monthly-release-control.mjs';
import { verifySource } from './monthly-release-package.mjs';
function writePlanDraft(sourcePath, output) {
  const raw = readFileSync(sourcePath);
  const source = JSON.parse(raw);
  verifySource(process.cwd(), source);
  if (source.evidence?.sourceChecks !== 'PASS_AT_PREPARATION_ONLY' ||
      !Array.isArray(source.evidence.acceptances) || source.evidence.acceptances.length === 0 ||
      !raw.equals(Buffer.from(JSON.stringify(source, null, 2) + '\n'))) throw Error('prepared_source_required');
  const references = [source.evidence.staging, ...source.evidence.acceptances];
  if (references.some(ref => ref?.candidate !== source.candidate || !Number.isSafeInteger(ref.id) || ref.id <= 0 ||
      !Number.isSafeInteger(ref.attempt) || ref.attempt <= 0 || typeof ref.path !== 'string') ||
      new Set(references.map(ref => ref.id)).size !== references.length) throw Error('staging_reference_binding');
  const draft = {
    sourcePackageSha256: sha256(raw),
    base: source.base, candidate: source.candidate, target: 'production', controller: source.controller,
    availableStagingRuns: source.evidence.acceptances.map(({ id, attempt, path }) => ({ id, attempt, path })),
    coverage: source.changes.map(({ path }) => ({
      path, kind: /^(?:docs|tests)\//u.test(path) ? 'source_ci' : null,
    })),
    configuration: { supportDisabled: null, supportHelp: null },
    restoreFiles: { evidence: null, full: null, runner: null, postcheck: null },
    rehearsalFile: null,
    sql: source.sql.map(({ path, sha256: digest }) => ({
      path, controller: digest && Object.hasOwn(SQL_PROOFS, path) && SQL_PROOFS[path].sqlSha256 === digest
        ? SQL_PROOFS[path].workflow : null,
      backwardCompatible: null, receiptFile: null,
    })),
  };
  writeFileSync(output, JSON.stringify(draft, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

let directory, created = false;
function main() {
  const [sourcePath, planPath, out] = process.argv.slice(2);
  if (!sourcePath || !planPath || !out || process.getuid() === 0 || process.argv.length !== 5) throw Error('usage');
  if (sourcePath === '--draft') {
    writePlanDraft(planPath, out);
    process.stdout.write('MONTHLY_RELEASE_PLAN=DRAFT_REQUIRES_REVIEW\n');
    return;
  }
  const source = JSON.parse(readFileSync(sourcePath)), plan = JSON.parse(readFileSync(planPath));
  verifySource(process.cwd(), source);
  const hash = sha256(JSON.stringify(source, null, 2) + '\n');
  if (Object.hasOwn(plan, 'sourcePackageSha256') && (plan.sourcePackageSha256 !== hash ||
      plan.base !== source.base || plan.candidate !== source.candidate || plan.target !== 'production' ||
      plan.controller !== source.controller)) throw Error('draft_source_binding');
  const names = ['evidence', 'full', 'runner', 'postcheck'];
  const bytes = names.map(name => readFileSync(plan.restoreFiles[name]));
  const evidence = JSON.parse(bytes[0]), rehearsalBytes = readFileSync(plan.rehearsalFile), rehearsal = JSON.parse(rehearsalBytes);
  const sqlReceipts = plan.sql.map(item => readFileSync(item.receiptFile));
  const a = {
    version: 1, source, target: 'production', controller: '.github/workflows/deploy-fanmind.yml', ownerId: '270165082',
    issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7200000).toISOString(),
    coverage: plan.coverage, configuration: plan.configuration,
    sql: plan.sql.map((item, index) => ({ path: item.path, sha256: source.sql.find(sql => sql.path === item.path)?.sha256,
      backwardCompatible: item.backwardCompatible, decision: 'verified_applied', controller: item.controller, postflightSha256: sha256(sqlReceipts[index]) })),
    restore: { productionCommit: evidence.productionCommit, schemaFingerprint: evidence.databaseAuthorizationFingerprintSha256, receipts: bytes.map(sha256) },
    rehearsal: { candidate: source.candidate, result: rehearsal.result, pg17: rehearsal.pg17, sourceTree: rehearsal.sourceTree,
      sourceCommit: rehearsal.sourceCommit, runId: Number(rehearsal.runId), elapsedMs: rehearsal.elapsedMs, reportSha256: sha256(rehearsalBytes) },
    ...(plan.resumeAfterAttempt ? { resumeAfterAttempt: plan.resumeAfterAttempt } : {}),
  };
  validateAdmission(a, hash, source.base, source.candidate);
  sqlReceipts.forEach((raw,index) => validateSqlReceipt(JSON.parse(raw), a.sql[index], a));
  directory = join(realpathSync(dirname(resolve(out))), basename(resolve(out)));
  if (/^\/(?:etc|usr|var|root)(?:\/|$)/u.test(directory)) throw Error('protected_destination');
  mkdirSync(directory, { mode: 0o700 }); created = true;
  names.forEach((name,index) => writeFileSync(join(directory, `${hash}.${name}.json`), bytes[index], { flag: 'wx', mode: 0o600 }));
  writeFileSync(join(directory, `${hash}.rehearsal.json`), rehearsalBytes, { flag: 'wx', mode: 0o600 });
  sqlReceipts.forEach((raw,index) => writeFileSync(join(directory, `${hash}.sql-${index}.json`), raw, { flag: 'wx', mode: 0o600 }));
  const verifier = fileURLToPath(new URL('./verify-restore-drill-evidence.mjs', import.meta.url));
  const result = execFileSync(process.execPath, [verifier, '--input', join(directory, `${hash}.evidence.json`), '--full-receipt', join(directory, `${hash}.full.json`), '--runner-receipt', join(directory, `${hash}.runner.json`), '--database-postcheck-receipt', join(directory, `${hash}.postcheck.json`)], { encoding: 'utf8', timeout: 30000, stdio: ['ignore','pipe','pipe'] });
  if (!result.includes('RESTORE_DRILL_EVIDENCE=PASS\n')) throw Error('restore');
  writeFileSync(join(directory, `${hash}.json`), JSON.stringify(a, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(`MONTHLY_ADMISSION=PROPOSED_NOT_AUTHORIZED\nPACKAGE_SHA256=${hash}\n`);
}
try {
  main();
} catch {
  if (created) rmSync(directory, { force: true, recursive: true });
  process.stderr.write('MONTHLY_ADMISSION=BLOCK\n'); process.exitCode = 1;
}
