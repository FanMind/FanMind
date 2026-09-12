#!/usr/bin/env bash
set -euo pipefail

audit_stage=prerequisites
cleanup_files=()
cleanup() {
  local exit_code=$?
  trap - EXIT
  if (( exit_code != 0 )); then
    printf 'AUDIT_FAILED_STAGE=%s\nAUDIT_EXIT_CODE=%s\nAUDIT_RESULT=failed\n' "$audit_stage" "$exit_code"
  fi
  rm -f "${cleanup_files[@]}" || true
  exit "$exit_code"
}
trap cleanup EXIT

APP_ROOT="${FANMIND_AUDIT_APP_ROOT:-/var/www/fanmind}"
BACKUP_ROOT="${FANMIND_AUDIT_BACKUP_ROOT:-/var/backups/fanmind}"
PUBLIC_BASE_URL="${FANMIND_AUDIT_PUBLIC_BASE_URL:-https://fanmind.ch}"
PM2_APP_NAME="${FANMIND_AUDIT_PM2_APP_NAME:-fanmind}"
VERIFIER_PATH="${FANMIND_AUDIT_VERIFIER_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/verify-backup-artifact.mjs}"
PRODUCTION_ENV_PATH="${FANMIND_AUDIT_PRODUCTION_ENV_PATH:-$APP_ROOT/.env.production}"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "AUDIT_ERROR=missing_command:$1" >&2
    exit 1
  }
}

for command in node npm pm2 git curl systemctl journalctl sudo awk find sort cut df date grep basename mktemp head; do
  require_command "$command"
done

audit_stage=runtime
printf 'AUDIT_UTC=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'NODE_VERSION=%s\n' "$(node --version)"
printf 'NPM_VERSION=%s\n' "$(npm --version)"
printf 'PM2_VERSION=%s\n' "$(pm2 --version)"
printf 'HOST_UPTIME_SECONDS=%s\n' "$(cut -d. -f1 /proc/uptime)"
printf 'HOST_BOOT_ID=%s\n' "$(</proc/sys/kernel/random/boot_id)"
audit_stage=release
printf 'SERVER_HEAD=%s\n' "$(git -C "$APP_ROOT" rev-parse HEAD)"
printf 'ORIGIN_MAIN=%s\n' "$(git -C "$APP_ROOT" rev-parse origin/main)"

curl -fsSL --max-time 15 "$PUBLIC_BASE_URL/api/version" | node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const payload = JSON.parse(input);
    console.log(`LIVE_RELEASE=${payload.releaseCommit || "missing"}`);
    console.log(`LIVE_ENVIRONMENT=${payload.environment || "missing"}`);
    console.log(`LIVE_RUNTIME_ENVIRONMENT=${payload.runtimeEnvironment || "missing"}`);
  });
'

audit_stage=health
curl -fsSL --max-time 15 "$PUBLIC_BASE_URL/api/health" | node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const payload = JSON.parse(input);
    console.log(`LIVE_HEALTH=${payload.status || "missing"}`);
    for (const check of payload.checks || []) {
      console.log(`HEALTH_COMPONENT=${check.component}:${check.status}`);
    }
  });
'

audit_stage=pm2
pm2 jlist | PM2_APP_NAME="$PM2_APP_NAME" node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const rows = JSON.parse(input);
    const matches = rows.filter(row => row && row.name === process.env.PM2_APP_NAME);
    if (matches.length !== 1) throw new Error("fanmind PM2 process count invalid");
    const [processRow] = matches;
    const env = processRow.pm2_env || {};
    const uptimeMs = Number.isFinite(env.pm_uptime)
      ? Math.max(0, Date.now() - env.pm_uptime)
      : Number.NaN;
    console.log(`PM2_STATUS=${env.status || "unknown"}`);
    console.log(`PM2_NODE_VERSION=${env.node_version || "unknown"}`);
    console.log(`PM2_RESTARTS=${Number.isFinite(env.restart_time) ? env.restart_time : "unknown"}`);
    console.log(`PM2_UNSTABLE_RESTARTS=${Number.isFinite(env.unstable_restarts) ? env.unstable_restarts : "unknown"}`);
    console.log(`PM2_UPTIME_SECONDS=${Number.isFinite(uptimeMs) ? Math.floor(uptimeMs / 1000) : "unknown"}`);
    console.log(`PM2_CWD=${env.pm_cwd || "unknown"}`);
    console.log(`PM2_EXEC_MODE=${env.exec_mode || "unknown"}`);
    console.log(`PM2_MEMORY_BYTES=${processRow.monit && Number.isFinite(processRow.monit.memory) ? processRow.monit.memory : "unknown"}`);
  });
'

audit_stage=env_flags
sudo -n node - "$PRODUCTION_ENV_PATH" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const MAX_ENV_BYTES = 64 * 1024;
const fields = [
  ['FANMIND_SERVER_ERROR_TRACKING_ENABLED', 'SERVER_ERROR_TRACKING_ENABLED'],
  ['FANMIND_SERVER_ERROR_EMAIL_ENABLED', 'SERVER_ERROR_EMAIL_ENABLED'],
];

function fail(code) {
  throw new Error(`production_env_${code}`);
}

let descriptor;
try {
  const [filePath] = process.argv.slice(2);
  if (
    typeof filePath !== 'string' ||
    !filePath.startsWith('/') ||
    filePath.includes('\0') ||
    path.resolve(filePath) !== filePath
  ) {
    fail('path_invalid');
  }

  const realPath = fs.realpathSync(filePath);
  if (realPath !== filePath) fail('path_alias_invalid');

  descriptor = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  const before = fs.fstatSync(descriptor);
  if (!before.isFile()) fail('type_invalid');
  if (before.size < 1 || before.size > MAX_ENV_BYTES) fail('size_invalid');

  const source = fs.readFileSync(descriptor, 'utf8');
  const after = fs.fstatSync(descriptor);
  if (
    after.dev !== before.dev ||
    after.ino !== before.ino ||
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    Buffer.byteLength(source, 'utf8') !== before.size
  ) {
    fail('changed_during_read');
  }

  const values = new Map(fields.map(([key]) => [key, []]));
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u,
    );
    if (!match || !values.has(match[1])) continue;

    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.get(match[1]).push(value);
  }

  for (const [key, outputKey] of fields) {
    const entries = values.get(key);
    if (entries.length !== 1) fail('flag_cardinality_invalid');
    if (!['true', 'false'].includes(entries[0])) fail('flag_value_invalid');
    console.log(`${outputKey}=${entries[0]}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : '';
  const code = /^production_env_[a-z0-9_]+$/u.test(message)
    ? message
    : 'production_env_unavailable';
  console.error(`AUDIT_ERROR=${code}`);
  process.exitCode = 1;
} finally {
  if (descriptor !== undefined) {
    try {
      fs.closeSync(descriptor);
    } catch {}
  }
}
NODE

audit_stage=nginx
if sudo -n nginx -t >/dev/null 2>&1; then
  echo "NGINX_CONFIG=ok"
else
  echo "NGINX_CONFIG=failed"
  exit 1
fi
printf 'NGINX_ACTIVE=%s\n' "$(systemctl is-active nginx.service 2>/dev/null || true)"

audit_stage=http
printf 'LOCAL_LOGIN_HTTP=%s\n' "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/login)"
printf 'PUBLIC_LOGIN_HTTP=%s\n' "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_BASE_URL/login")"
audit_stage=host
printf 'ROOT_DISK_USED_PERCENT=%s\n' "$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
printf 'MEMORY_AVAILABLE_KIB=%s\n' "$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"

if [[ -f /var/run/reboot-required ]]; then
  echo "REBOOT_REQUIRED=true"
  if [[ -r /var/run/reboot-required.pkgs ]]; then
    printf 'REBOOT_REQUIRED_PACKAGE_COUNT=%s\n' "$(grep -cve '^$' /var/run/reboot-required.pkgs || true)"
  fi
else
  echo "REBOOT_REQUIRED=false"
fi

audit_stage=systemd
mapfile -t units < <(systemctl list-unit-files 'fanmind-*' --no-legend 2>/dev/null | awk '{print $1}' | sort -u)
printf 'FANMIND_SYSTEMD_UNIT_COUNT=%s\n' "${#units[@]}"
for unit in "${units[@]}"; do
  active="$(systemctl is-active "$unit" 2>/dev/null || true)"
  enabled="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
  printf 'SYSTEMD_UNIT=%s|active=%s|enabled=%s\n' "$unit" "${active:-unknown}" "${enabled:-unknown}"
done

for unit in "${units[@]}"; do
  [[ "$unit" == *.timer ]] || continue
  next_realtime="$(systemctl show "$unit" --property=NextElapseUSecRealtime --value --no-pager 2>/dev/null || true)"
  next_monotonic="$(systemctl show "$unit" --property=NextElapseUSecMonotonic --value --no-pager 2>/dev/null || true)"
  last="$(systemctl show "$unit" --property=LastTriggerUSec --value --no-pager 2>/dev/null || true)"
  printf 'SYSTEMD_TIMER=%s|next_realtime=%s|next_monotonic=%s|last=%s\n' \
    "$unit" "${next_realtime:-unknown}" "${next_monotonic:-unknown}" "${last:-unknown}"
done

audit_stage=boot_readiness
node "$(dirname "$0")/production-boot-readiness.mjs" "$(git -C "$APP_ROOT" rev-parse HEAD)" ||
  printf 'BOOT_COLLECTOR=unavailable\n'

audit_stage=backup_inventory
inventory="$(mktemp)"
cleanup_files+=("$inventory")
worker_log="$(mktemp)"
cleanup_files+=("$worker_log")

if ! sudo -n test -d "$BACKUP_ROOT"; then
  echo "BACKUP_ROOT=unavailable"
  exit 1
fi
echo "BACKUP_ROOT=available"

sudo -n find "$BACKUP_ROOT" -maxdepth 1 -type f \
  \( -name 'fanmind-*.age' -o -name 'fanmind-*.age.sha256' \) \
  -printf '%T@|%f|%s\n' | sort -t'|' -k1,1nr > "$inventory"

INVENTORY="$inventory" node <<'NODE'
const fs = require('node:fs');
const source = fs.readFileSync(process.env.INVENTORY, 'utf8').trim();
const rows = source
  ? source.split('\n').filter(Boolean).map(line => {
      const [mtime, name, size] = line.split('|');
      return { mtime: Number(mtime), name, size: Number(size) };
    })
  : [];
const groups = new Map();
for (const row of rows) {
  const key = row.name.endsWith('.sha256') ? row.name.slice(0, -7) : row.name;
  const group = groups.get(key) || { artifact: null, checksum: null };
  if (row.name.endsWith('.sha256')) group.checksum = row;
  else group.artifact = row;
  groups.set(key, group);
}
const typeOf = name => {
  if (/^fanmind-full-.*\.tar\.gz\.age$/.test(name)) return 'full';
  if (/^fanmind-database-.*\.dump\.age$/.test(name)) return 'database';
  if (/^fanmind-storage-.*\.tar\.gz\.age$/.test(name)) return 'storage';
  if (/^fanmind-server-config-.*\.tar\.gz\.age$/.test(name)) return 'server_config';
  return 'other';
};
const complete = [...groups.values()].filter(group => group.artifact && group.checksum);
const orphaned = [...groups.values()].filter(group => !group.artifact || !group.checksum);
console.log(`BACKUP_ARTIFACT_COUNT=${rows.filter(row => !row.name.endsWith('.sha256')).length}`);
console.log(`BACKUP_COMPLETE_PAIR_COUNT=${complete.length}`);
console.log(`BACKUP_ORPHAN_PAIR_COUNT=${orphaned.length}`);
for (const type of ['database', 'storage', 'server_config', 'full']) {
  const candidates = complete
    .filter(group => typeOf(group.artifact.name) === type)
    .sort((a, b) => b.artifact.mtime - a.artifact.mtime);
  if (!candidates.length) {
    console.log(`BACKUP_LATEST=${type}|missing`);
    continue;
  }
  const latest = candidates[0].artifact;
  const ageHours = Math.max(0, (Date.now() / 1000 - latest.mtime) / 3600);
  console.log(`BACKUP_LATEST=${type}|file=${latest.name}|age_hours=${ageHours.toFixed(2)}|size_bytes=${latest.size}|pair=complete`);
}
NODE

audit_stage=backup_checksum
latest_full="$(sudo -n find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'fanmind-full-*.tar.gz.age' -printf '%T@|%p\n' | sort -t'|' -k1,1nr | head -n1 | cut -d'|' -f2-)"
if [[ -z "$latest_full" ]]; then
  echo "LATEST_FULL_BACKUP=missing"
  exit 1
fi
printf 'LATEST_FULL_BACKUP=%s\n' "$(basename "$latest_full")"

sudo -n node "$VERIFIER_PATH" --artifact "$latest_full" --json | node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const result = JSON.parse(input);
    console.log(`BACKUP_VERIFY_OK=${result.ok === true}`);
    console.log(`BACKUP_VERIFY_MODE=${result.mode || "missing"}`);
    console.log(`BACKUP_VERIFY_TYPE=${result.backupType || "missing"}`);
    console.log(`BACKUP_VERIFY_ARTIFACT=${result.artifact || "missing"}`);
    console.log(`BACKUP_VERIFY_SIZE_BYTES=${result.sizeBytes ?? "missing"}`);
  });
'

audit_stage=offsite
env_file=/etc/fanmind-backup/worker.env
if ! sudo -n test -r "$env_file"; then
  echo "OFFSITE_ENV=unavailable"
else
  read_config_value() {
    sudo -n node - "$env_file" "$1" <<'NODE'
const fs = require('node:fs');
const [file, requestedKey] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
let result = '';
for (const line of lines) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || match[1] !== requestedKey) continue;
  let value = match[2];
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  result = value;
}
process.stdout.write(result);
NODE
  }

  enabled="$(read_config_value FANMIND_BACKUP_OFFSITE_ENABLED)"
  printf 'OFFSITE_ENABLED=%s\n' "${enabled:-false}"
  if [[ "$enabled" != "true" ]]; then
    echo "OFFSITE_STATUS=not_enabled"
  else
    remote="$(read_config_value FANMIND_BACKUP_RCLONE_REMOTE)"
    config="$(read_config_value FANMIND_BACKUP_RCLONE_CONFIG)"
    remote_path="$(read_config_value FANMIND_BACKUP_REMOTE_PATH)"
    config="${config:-/etc/fanmind-backup/rclone.conf}"
    remote_path="${remote_path:-fanmind/production}"
    rclone_bin="$(command -v rclone || true)"

    if [[ -z "$remote" || -z "$rclone_bin" ]] || ! sudo -n test -r "$config"; then
      echo "OFFSITE_STATUS=incomplete_configuration"
      exit 1
    fi

    listing="$(mktemp)"
    cleanup_files+=("$listing")
    sudo -n "$rclone_bin" --config "$config" lsf "${remote}:${remote_path}" --files-only --recursive > "$listing"

    LISTING="$listing" node <<'NODE'
const fs = require('node:fs');
const names = fs.readFileSync(process.env.LISTING, 'utf8')
  .split('\n')
  .map(value => value.trim())
  .filter(Boolean);
const relevant = names.filter(name => /(^|\/)fanmind-.*\.age(?:\.sha256)?$/.test(name));
const groups = new Map();
for (const name of relevant) {
  const base = name.endsWith('.sha256') ? name.slice(0, -7) : name;
  const group = groups.get(base) || { artifact: false, checksum: false };
  if (name.endsWith('.sha256')) group.checksum = true;
  else group.artifact = true;
  groups.set(base, group);
}
const complete = [...groups.values()].filter(group => group.artifact && group.checksum).length;
const orphaned = [...groups.values()].filter(group => !group.artifact || !group.checksum).length;
const full = relevant.filter(name => /fanmind-full-.*\.tar\.gz\.age$/.test(name)).sort();
console.log('OFFSITE_STATUS=reachable');
console.log(`OFFSITE_RELEVANT_OBJECT_COUNT=${relevant.length}`);
console.log(`OFFSITE_COMPLETE_PAIR_COUNT=${complete}`);
console.log(`OFFSITE_ORPHAN_PAIR_COUNT=${orphaned}`);
console.log(`OFFSITE_LATEST_FULL=${full.length ? full[full.length - 1].split('/').pop() : 'missing'}`);
NODE
  fi
fi

audit_stage=worker
sudo -n journalctl -u fanmind-backup-worker.service --since '14 days ago' --no-pager -o cat > "$worker_log"

WORKER_LOG="$worker_log" node <<'NODE'
const fs = require('node:fs');
const now = Date.now();
const windows = [
  { name: '24h', since: now - 24 * 60 * 60 * 1000 },
  { name: '14d', since: now - 14 * 24 * 60 * 60 * 1000 },
];
const eventNames = [
  'worker_start',
  'worker_stop',
  'sigterm_received',
  'claim_failed',
  'job_claimed',
  'job_failed',
  'job_rejected',
  'fatal',
];
const failureEvents = new Set(['claim_failed', 'job_failed', 'job_rejected', 'fatal']);
const rows = [];
for (const line of fs.readFileSync(process.env.WORKER_LOG, 'utf8').split(/\r?\n/)) {
  try {
    const payload = JSON.parse(line);
    const timestamp = Date.parse(payload.ts);
    if (!Number.isFinite(timestamp) || !eventNames.includes(payload.event)) continue;
    rows.push({ event: payload.event, timestamp });
  } catch {}
}

console.log(`BACKUP_WORKER_STRUCTURED_EVENT_COUNT=${rows.length}`);
for (const window of windows) {
  const counts = new Map(eventNames.map(event => [event, 0]));
  for (const row of rows) {
    if (row.timestamp < window.since) continue;
    counts.set(row.event, (counts.get(row.event) || 0) + 1);
  }

  console.log(`BACKUP_WORKER_WINDOW=${window.name}`);
  for (const event of eventNames) {
    console.log(`BACKUP_WORKER_EVENT=${window.name}|${event}:${counts.get(event) || 0}`);
  }

  if (window.name === '24h') {
    const failureCount = [...failureEvents]
      .reduce((total, event) => total + (counts.get(event) || 0), 0);
    console.log(`BACKUP_WORKER_24H_FAILURE_EVENT_COUNT=${failureCount}`);
    console.log(`BACKUP_WORKER_24H_FAILURE_FREE=${failureCount === 0}`);
  }
}
NODE

echo "AUDIT_RESULT=success"
