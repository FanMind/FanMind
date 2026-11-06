import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.FANMIND_BACKUP_OFFSITE_ENABLED = 'true';
process.env.FANMIND_BACKUP_RCLONE_REMOTE = 'fanmind-offsite';
process.env.FANMIND_BACKUP_REMOTE_PATH = 'bucket/fanmind/production';
process.env.FANMIND_BACKUP_RCLONE_CONFIG = '/tmp/fanmind-rclone.conf';

const worker = await import('../scripts/operations/backup-worker.mjs');

test('offsite transfer pair rolls back the artifact when checksum upload fails', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-offsite-unit-'));
  const log = join(tmp, 'rclone.log');
  const fakeRclone = join(tmp, 'fake-rclone.sh');
  const artifact = join(tmp, 'backup.age');

  await writeFile(artifact, 'encrypted-backup', { mode:0o600 });
  await writeFile(`${artifact}.sha256`, 'checksum  backup.age\n', { mode:0o600 });
  await writeFile(fakeRclone, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FANMIND_RCLONE_TEST_LOG"
command_name=""
source_name=""
for ((i=1; i<=$#; i++)); do
  value="\${!i}"
  if [[ "$value" == "copyto" || "$value" == "deletefile" ]]; then
    command_name="$value"
    next=$((i+1))
    if (( next <= $# )); then source_name="\${!next}"; fi
    break
  fi
done
if [[ "$command_name" == "copyto" && "$source_name" == *.sha256 && "\${FANMIND_TEST_FAIL_CHECKSUM:-0}" == "1" ]]; then
  exit 42
fi
if [[ "$command_name" == "deletefile" && "\${FANMIND_TEST_FAIL_DELETE:-0}" == "1" ]]; then
  exit 43
fi
`, { mode:0o755 });

  process.env.FANMIND_RCLONE_BIN = fakeRclone;
  process.env.FANMIND_RCLONE_TEST_LOG = log;

  await t.test('successful upload returns both references without cleanup', async () => {
    process.env.FANMIND_TEST_FAIL_CHECKSUM = '0';
    process.env.FANMIND_TEST_FAIL_DELETE = '0';
    await writeFile(log, '');

    const result = await worker.offsite(artifact);
    const lines = (await readFile(log, 'utf8')).trim().split('\n');

    assert.equal(result.status, 'uploaded');
    assert.equal(result.reference, 'fanmind-offsite:bucket/fanmind/production/backup.age');
    assert.equal(result.checksum_reference, 'fanmind-offsite:bucket/fanmind/production/backup.age.sha256');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /copyto .*backup\.age fanmind-offsite:bucket\/fanmind\/production\/backup\.age$/);
    assert.match(lines[1], /copyto .*backup\.age\.sha256 fanmind-offsite:bucket\/fanmind\/production\/backup\.age\.sha256$/);
  });

  await t.test('checksum failure deletes the already uploaded artifact and rethrows', async () => {
    process.env.FANMIND_TEST_FAIL_CHECKSUM = '1';
    process.env.FANMIND_TEST_FAIL_DELETE = '0';
    await writeFile(log, '');

    await assert.rejects(() => worker.offsite(artifact), /fake-rclone\.sh_exit_42/);

    const lines = (await readFile(log, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 3);
    assert.match(lines[0], /copyto .*backup\.age fanmind-offsite:bucket\/fanmind\/production\/backup\.age$/);
    assert.match(lines[1], /copyto .*backup\.age\.sha256 fanmind-offsite:bucket\/fanmind\/production\/backup\.age\.sha256$/);
    assert.match(lines[2], /deletefile fanmind-offsite:bucket\/fanmind\/production\/backup\.age$/);
  });

  await t.test('cleanup failure is surfaced explicitly', async () => {
    process.env.FANMIND_TEST_FAIL_CHECKSUM = '1';
    process.env.FANMIND_TEST_FAIL_DELETE = '1';
    await writeFile(log, '');

    await assert.rejects(
      () => worker.offsite(artifact),
      (error) => error instanceof AggregateError && error.message === 'offsite_checksum_upload_failed_cleanup_failed',
    );
  });
});
