import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/deploy-fanmind.yml', import.meta.url),
  'utf8',
);

test('production deploy installs the current backup worker before daemon reload', () => {
  const directoryInstall = workflow.indexOf(
    'sudo install -d -o root -g root -m 0700 /usr/local/lib/fanmind-ops',
  );
  const workerInstall = workflow.indexOf(
    'sudo install -o root -g root -m 0750 scripts/operations/backup-worker.mjs /usr/local/lib/fanmind-ops/backup-worker.mjs',
  );
  const unitInstall = workflow.indexOf(
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-worker.service /etc/systemd/system/fanmind-backup-worker.service',
  );
  const daemonReload = workflow.indexOf('sudo systemctl daemon-reload');

  assert.notEqual(directoryInstall, -1);
  assert.notEqual(workerInstall, -1);
  assert.notEqual(unitInstall, -1);
  assert.notEqual(daemonReload, -1);
  assert.ok(directoryInstall < workerInstall);
  assert.ok(workerInstall < unitInstall);
  assert.ok(unitInstall < daemonReload);
});
