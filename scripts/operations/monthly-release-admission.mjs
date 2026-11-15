// Offline preparation only: writes a private proposal, never installs or authorizes it.
import { readFileSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, validateAdmission, validateSqlReceipt } from './monthly-release-control.mjs';
import { verifySource } from './monthly-release-package.mjs';
let directory, created = false;
try {
  const [sourcePath, planPath, out] = process.argv.slice(2);
  if (!sourcePath || !planPath || !out || process.getuid() === 0) throw Error('usage');
  const source = JSON.parse(readFileSync(sourcePath)), plan = JSON.parse(readFileSync(planPath));
  verifySource(process.cwd(), source);
  const hash = sha256(JSON.stringify(source, null, 2) + '\n');
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
} catch {
  if (created) rmSync(directory, { force: true, recursive: true });
  process.stderr.write('MONTHLY_ADMISSION=BLOCK\n'); process.exitCode = 1;
}
