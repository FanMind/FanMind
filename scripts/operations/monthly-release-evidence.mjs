import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPinnedFile, sha256, validateAdmission, validateSqlReceipt, VERIFIER_FILES } from './monthly-release-control.mjs';
async function main() {
  const [hash, base, candidate] = process.argv.slice(2);
  if (process.getuid() !== 0 || !/^[a-f0-9]{64}$/u.test(hash ?? '')) throw Error('authority');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const codeSha256 = {};
  // Every module in the installed verifier closure is root-owned, non-writable,
  // and independently compared to the exact reviewed candidate by its caller.
  for (const file of VERIFIER_FILES) codeSha256[file] = sha256(readPinnedFile(join(root, file), null, 0, 0o644));
  const a = JSON.parse(readPinnedFile(`/etc/fanmind-release/${hash}.json`, null, 0, 0o600));
  validateAdmission(a, hash, base, candidate);
  const dir = mkdtempSync(join(tmpdir(), 'fanmind-monthly-proof-'));
  try {
    const names = ['evidence', 'full', 'runner', 'postcheck'];
    for (const [i, name] of names.entries()) {
      const bytes = readPinnedFile(`/etc/fanmind-release/${hash}.${name}.json`, a.restore.receipts[i], 0, 0o600);
      writeFileSync(join(dir, name), bytes, { flag: 'wx', mode: 0o600 });
      if (i === 0) {
        const e = JSON.parse(bytes);
        if (e.productionCommit !== base || e.databaseAuthorizationFingerprintSha256 !== a.restore.schemaFingerprint
          || !(Date.now() >= Date.parse(e.completedAt) && Date.now() - Date.parse(e.completedAt) <= 30 * 86400000)) throw Error('restore_binding');
      }
    }
    const out = execFileSync('/usr/bin/node', [join(root, 'scripts/operations/verify-restore-drill-evidence.mjs'), '--input', join(dir, 'evidence'), '--full-receipt', join(dir, 'full'), '--runner-receipt', join(dir, 'runner'), '--database-postcheck-receipt', join(dir, 'postcheck')], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!out.includes('RESTORE_DRILL_EVIDENCE=PASS\n')) throw Error('restore');
    const rehearsal = JSON.parse(readPinnedFile(`/etc/fanmind-release/${hash}.rehearsal.json`, a.rehearsal.reportSha256, 0, 0o600));
    if (rehearsal.result !== 'PASS' || rehearsal.pg17 !== true || rehearsal.sourceTree !== a.source.tree
      || rehearsal.elapsedMs !== a.rehearsal.elapsedMs || rehearsal.elapsedMs > 3600000
      || !['gateFailure','deadlineAbort','postDeployFailure','resume','cleanup'].every(key => rehearsal[key] === true)
      || rehearsal.scope !== 'INTEGRATED_PRODUCTION_ADAPTER_SYNTHETIC_GATES_REAL_HTTP_GIT_SHELL') throw Error('rehearsal_binding');
    const sqlReceipts = a.sql.map((item, index) => {
      const bytes = readPinnedFile(`/etc/fanmind-release/${hash}.sql-${index}.json`, item.postflightSha256, 0, 0o600);
      const receipt = JSON.parse(bytes); validateSqlReceipt(receipt, item, a); return receipt;
    });
    process.stdout.write(JSON.stringify({ admission: a, codeSha256, restoreVerified: true, rehearsalVerified: true, sqlReceipts }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { process.stderr.write('MONTHLY_PRIVATE_EVIDENCE=BLOCK\n'); process.exitCode = 1; });
