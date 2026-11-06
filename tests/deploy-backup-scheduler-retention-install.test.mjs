import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/deploy-fanmind.yml', import.meta.url),
  'utf8',
);

test('production deploy installs scheduler and retention files before daemon reload without enabling them', () => {
  const requiredCommands = [
    'sudo install -o root -g root -m 0750 scripts/operations/enqueue-backup-job.mjs /usr/local/lib/fanmind-ops/enqueue-backup-job.mjs',
    'sudo install -o root -g root -m 0750 scripts/operations/backup-retention.mjs /usr/local/lib/fanmind-ops/backup-retention.mjs',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-enqueue@.service /etc/systemd/system/fanmind-backup-enqueue@.service',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-retention.service /etc/systemd/system/fanmind-backup-retention.service',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-database.timer /etc/systemd/system/fanmind-backup-database.timer',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-storage.timer /etc/systemd/system/fanmind-backup-storage.timer',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-server_config.timer /etc/systemd/system/fanmind-backup-server_config.timer',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-full.timer /etc/systemd/system/fanmind-backup-full.timer',
    'sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-retention.timer /etc/systemd/system/fanmind-backup-retention.timer',
  ];

  const daemonReload = workflow.indexOf('sudo systemctl daemon-reload');
  assert.notEqual(daemonReload, -1);

  for (const command of requiredCommands) {
    const index = workflow.indexOf(command);
    assert.notEqual(index, -1, `missing deploy command: ${command}`);
    assert.ok(index < daemonReload, `deploy command must run before daemon reload: ${command}`);
  }

  assert.doesNotMatch(workflow, /systemctl\s+enable\s+.*fanmind-backup-/);
  assert.doesNotMatch(workflow, /systemctl\s+start\s+.*fanmind-backup-.*timer/);
});
