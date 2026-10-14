#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${FANMIND_SOURCE_DIR:-/var/www/fanmind}"
RELEASE_ROOT="${FANMIND_RELEASE_ROOT:-/var/www/fanmind-releases}"
CURRENT_LINK="${FANMIND_CURRENT_RELEASE_LINK:-/var/www/fanmind-current}"
APP_NAME="${FANMIND_PM2_APP_NAME:-fanmind}"
BASE_URL="${FANMIND_DEPLOY_BASE_URL:-https://fanmind.ch}"
RETAIN_RELEASES="${FANMIND_RELEASE_RETENTION_COUNT:-4}"
RELEASE_COMMIT="${1:-}"
PM2_CONFIG_RELATIVE_PATH="ops/pm2/fanmind.production.config.cjs"
TEMP_RELEASE=""
SWITCHED=0
PREVIOUS_CWD=""
PREVIOUS_COMMIT=""
PREVIOUS_EXEC_MODE=""
PREVIOUS_LINK_TARGET=""
AVAILABILITY_LOG=""
AVAILABILITY_PID=""

log() {
  printf '[fanmind-release] %s\n' "$*"
}

fail() {
  printf '[fanmind-release] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command missing: $1"
}

stop_availability_probe() {
  if [[ -n "$AVAILABILITY_PID" ]]; then
    kill "$AVAILABILITY_PID" >/dev/null 2>&1 || true
    wait "$AVAILABILITY_PID" >/dev/null 2>&1 || true
    AVAILABILITY_PID=""
  fi
}

start_availability_probe() {
  AVAILABILITY_LOG="$(mktemp)"
  chmod 0600 "$AVAILABILITY_LOG"
  (
    while true; do
      status_code="000"
      if response_code="$(
        curl -sS -o /dev/null -w '%{http_code}' --max-time 2 \
          "$BASE_URL/api/version" 2>/dev/null
      )"; then
        if [[ "$response_code" =~ ^[0-9]{3}$ ]]; then
          status_code="$response_code"
        fi
      fi
      printf '%s\n' "$status_code" >> "$AVAILABILITY_LOG"
      sleep 0.25
    done
  ) &
  AVAILABILITY_PID=$!
}

verify_availability_probe() {
  [[ -r "$AVAILABILITY_LOG" ]] || return 1

  local sample_count
  local failed_count
  for _ in 1 2 3 4 5 6 7 8; do
    sample_count="$(wc -l < "$AVAILABILITY_LOG" | tr -d '[:space:]')"
    if [[ "$sample_count" =~ ^[0-9]+$ ]] && (( sample_count >= 2 )); then
      break
    fi
    sleep 0.25
  done
  stop_availability_probe
  sample_count="$(wc -l < "$AVAILABILITY_LOG" | tr -d '[:space:]')"
  failed_count="$(awk '$0 != "200" { failures += 1 } END { print failures + 0 }' "$AVAILABILITY_LOG")"
  log "release switch availability: samples=${sample_count:-0} non_200=${failed_count:-0}"

  [[ "$sample_count" =~ ^[0-9]+$ ]] \
    && (( sample_count >= 2 )) \
    && [[ "$failed_count" == "0" ]]
}

verify_built_deployment_id() {
  local release_dir="$1"
  local expected_commit="$2"
  FANMIND_REQUIRED_DEPLOYMENT_ID="$expected_commit" \
    node -e '
      const fs = require("node:fs");
      const path = process.argv[1];
      let payload;
      try {
        payload = JSON.parse(fs.readFileSync(path, "utf8"));
      } catch {
        process.exit(1);
      }
      process.exit(
        payload?.config?.deploymentId === process.env.FANMIND_REQUIRED_DEPLOYMENT_ID
          ? 0
          : 1,
      );
    ' "$release_dir/.next/required-server-files.json"
}

is_safe_release_path() {
  local candidate="$1"
  [[ -n "$candidate" ]] && [[ "$candidate" == "$RELEASE_ROOT"/* ]]
}

read_previous_pm2_cwd() {
  pm2 jlist | node -e '
    let body = "";
    process.stdin.on("data", chunk => body += chunk);
    process.stdin.on("end", () => {
      try {
        const list = JSON.parse(body);
        const processEntry = list.find(item => item?.name === process.env.FANMIND_PM2_APP_NAME);
        process.stdout.write(processEntry?.pm2_env?.pm_cwd || "");
      } catch {
        process.stdout.write("");
      }
    });
  '
}

read_previous_pm2_exec_mode() {
  pm2 jlist | node -e '
    let body = "";
    process.stdin.on("data", chunk => body += chunk);
    process.stdin.on("end", () => {
      try {
        const list = JSON.parse(body);
        const processEntry = list.find(item => item?.name === process.env.FANMIND_PM2_APP_NAME);
        process.stdout.write(processEntry?.pm2_env?.exec_mode || "");
      } catch {
        process.stdout.write("");
      }
    });
  '
}

read_live_commit() {
  curl -fsS --max-time 15 "$BASE_URL/api/version" 2>/dev/null |
    node -e '
      let body = "";
      process.stdin.on("data", chunk => body += chunk);
      process.stdin.on("end", () => {
        try {
          const payload = JSON.parse(body);
          process.stdout.write(/^[0-9a-f]{40}$/.test(payload.releaseCommit || "") ? payload.releaseCommit : "");
        } catch {
          process.stdout.write("");
        }
      });
    '
}

is_safe_runtime_target() {
  local candidate="$1"
  [[ "$candidate" == "$SOURCE_DIR" ]] || is_safe_release_path "$candidate"
}

switch_current_link() {
  local target="$1"
  is_safe_runtime_target "$target" || return 1
  sudo rm -f -- "${CURRENT_LINK}.new"
  sudo ln -s "$target" "${CURRENT_LINK}.new"
  sudo mv -Tf "${CURRENT_LINK}.new" "$CURRENT_LINK"
}

start_pm2_cluster() {
  local config_path="$1"
  local commit="$2"
  [[ -f "$config_path" ]] || return 1
  [[ -f "$CURRENT_LINK/package.json" ]] || return 1
  FANMIND_RELEASE_COMMIT="$commit" \
    FANMIND_CURRENT_RELEASE_LINK="$CURRENT_LINK" \
    FANMIND_PM2_APP_NAME="$APP_NAME" \
    pm2 start "$config_path" --only "$APP_NAME"
}

reload_pm2_cluster() {
  local config_path="$1"
  local commit="$2"
  [[ -f "$config_path" ]] || return 1
  [[ -f "$CURRENT_LINK/package.json" ]] || return 1
  FANMIND_RELEASE_COMMIT="$commit" \
    FANMIND_CURRENT_RELEASE_LINK="$CURRENT_LINK" \
    FANMIND_PM2_APP_NAME="$APP_NAME" \
    pm2 reload "$config_path" --only "$APP_NAME" --update-env
}

pm2_uses_rolling_release_contract() {
  local cwd
  local exec_mode
  cwd="$(read_previous_pm2_cwd || true)"
  exec_mode="$(read_previous_pm2_exec_mode || true)"
  [[ "$cwd" == "$CURRENT_LINK" ]] && [[ "$exec_mode" == "cluster_mode" ]]
}

verify_pm2_release_contract() {
  local expected_commit="$1"
  pm2 jlist | FANMIND_EXPECTED_PM2_CWD="$CURRENT_LINK" \
    FANMIND_EXPECTED_RELEASE_COMMIT="$expected_commit" \
    FANMIND_PM2_APP_NAME="$APP_NAME" \
    node -e '
      let body = "";
      process.stdin.on("data", chunk => body += chunk);
      process.stdin.on("end", () => {
        let list;
        try {
          list = JSON.parse(body);
        } catch {
          process.exit(1);
        }
        const matches = list.filter(item => item?.name === process.env.FANMIND_PM2_APP_NAME);
        const valid = matches.length === 1
          && matches[0]?.pm2_env?.status === "online"
          && matches[0]?.pm2_env?.exec_mode === "cluster_mode"
          && matches[0]?.pm2_env?.pm_cwd === process.env.FANMIND_EXPECTED_PM2_CWD
          && matches[0]?.pm2_env?.FANMIND_RELEASE_COMMIT === process.env.FANMIND_EXPECTED_RELEASE_COMMIT
          && matches[0]?.pm2_env?.FANMIND_RUNTIME_ENVIRONMENT === "production";
        process.exit(valid ? 0 : 1);
      });
    '
}

rollback() {
  local reason="$1"
  SWITCHED=0
  log "rollback requested: $reason"

  local rollback_commit="$PREVIOUS_COMMIT"
  if [[ ! "$rollback_commit" =~ ^[0-9a-f]{40}$ ]]; then
    rollback_commit="unknown"
  fi

  local rollback_target="$PREVIOUS_LINK_TARGET"
  local link_restored=0
  if ! is_safe_runtime_target "$rollback_target" && is_safe_runtime_target "$PREVIOUS_CWD"; then
    rollback_target="$PREVIOUS_CWD"
  fi
  if is_safe_runtime_target "$rollback_target" && switch_current_link "$rollback_target"; then
    link_restored=1
  else
    log "previous release link could not be restored"
  fi

  if [[ "$PREVIOUS_EXEC_MODE" == "cluster_mode" ]] \
    && [[ "$PREVIOUS_CWD" == "$CURRENT_LINK" ]] \
    && [[ "$link_restored" -eq 1 ]]; then
    if reload_pm2_cluster "$RELEASE_DIR/$PM2_CONFIG_RELATIVE_PATH" "$rollback_commit"; then
      pm2 save
      log "rolling rollback completed to previous release"
      return 0
    fi
    log "rolling rollback failed; trying legacy fallback"
  fi

  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true

  if [[ -n "$PREVIOUS_CWD" ]] && [[ -f "$PREVIOUS_CWD/package.json" ]]; then
    if FANMIND_RELEASE_COMMIT="$rollback_commit" \
      FANMIND_RUNTIME_ENVIRONMENT=production \
      NODE_ENV=production \
      pm2 start npm --name "$APP_NAME" --cwd "$PREVIOUS_CWD" -- start; then
      pm2 save
      log "legacy rollback completed to previous cwd"
      return 0
    fi
    log "previous cwd could not be started; trying source checkout fallback"
  fi

  if [[ -f "$SOURCE_DIR/package.json" ]] && [[ -d "$SOURCE_DIR/.next" ]]; then
    if FANMIND_RELEASE_COMMIT="$rollback_commit" \
      FANMIND_RUNTIME_ENVIRONMENT=production \
      NODE_ENV=production \
      pm2 start npm --name "$APP_NAME" --cwd "$SOURCE_DIR" -- start; then
      pm2 save
      log "legacy rollback completed to source checkout fallback"
      return 0
    fi
    log "source checkout fallback could not be started"
  fi

  log "rollback target unavailable; manual intervention required"
  return 1
}

cleanup() {
  stop_availability_probe
  if [[ -n "$AVAILABILITY_LOG" ]] && [[ -f "$AVAILABILITY_LOG" ]]; then
    rm -f -- "$AVAILABILITY_LOG"
  fi
  if [[ -n "$TEMP_RELEASE" ]] && [[ -d "$TEMP_RELEASE" ]]; then
    rm -rf -- "$TEMP_RELEASE"
  fi
}

on_exit() {
  local status=$?
  trap - EXIT
  cleanup
  if [[ "$status" -ne 0 ]] && [[ "$SWITCHED" -eq 1 ]]; then
    rollback "unexpected failure after PM2 switched to the new release" || true
  fi
  exit "$status"
}
trap on_exit EXIT

[[ "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "release commit must be a full SHA"
[[ "$RETAIN_RELEASES" =~ ^[1-9][0-9]*$ ]] || fail "retention count must be a positive integer"
[[ -d "$SOURCE_DIR/.git" ]] || fail "source checkout not found"
[[ -r "$SOURCE_DIR/.env.production" ]] || fail "source production environment file not readable"

for command in git tar npm node pm2 curl sudo readlink mktemp awk wc tr sleep; do
  require_command "$command"
done

export FANMIND_PM2_APP_NAME="$APP_NAME"
PREVIOUS_CWD="$(read_previous_pm2_cwd || true)"
PREVIOUS_COMMIT="$(read_live_commit || true)"
PREVIOUS_EXEC_MODE="$(read_previous_pm2_exec_mode || true)"
PREVIOUS_LINK_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"

log "building isolated release $RELEASE_COMMIT"
log "previous cwd: ${PREVIOUS_CWD:-unknown}"
log "previous commit: ${PREVIOUS_COMMIT:-unknown}"
log "previous PM2 mode: ${PREVIOUS_EXEC_MODE:-unknown}"

cd "$SOURCE_DIR"
git fetch --prune origin main
if ! git cat-file -e "$RELEASE_COMMIT^{commit}" 2>/dev/null; then
  git fetch --no-tags origin "$RELEASE_COMMIT"
fi
git merge-base --is-ancestor "$RELEASE_COMMIT" origin/main \
  || fail "release commit is not reachable from origin/main"

sudo install -d -o "$(id -u)" -g "$(id -g)" -m 0755 "$RELEASE_ROOT"
RELEASE_DIR="$RELEASE_ROOT/$RELEASE_COMMIT"
TEMP_RELEASE="$RELEASE_ROOT/.${RELEASE_COMMIT}.tmp.$$"

if [[ -e "$RELEASE_DIR" ]]; then
  if [[ "$PREVIOUS_CWD" == "$RELEASE_DIR" ]] || [[ "$PREVIOUS_LINK_TARGET" == "$RELEASE_DIR" ]]; then
    log "release is already active; validating without rebuilding"
  else
    is_safe_release_path "$RELEASE_DIR" || fail "unsafe existing release path"
    rm -rf -- "$RELEASE_DIR"
  fi
fi

if [[ ! -d "$RELEASE_DIR" ]]; then
  mkdir -m 0755 "$TEMP_RELEASE"
  git archive --format=tar "$RELEASE_COMMIT" | tar -xf - -C "$TEMP_RELEASE"
  ln -s "$SOURCE_DIR/.env.production" "$TEMP_RELEASE/.env.production"

  cd "$TEMP_RELEASE"
  npm ci --no-audit --no-fund
  npm run verify:truth
  npm run lint
  npm run test:operations
  npm run test:release-integrations
  NEXT_DEPLOYMENT_ID="$RELEASE_COMMIT" npm run build
  [[ -f ".next/required-server-files.json" ]] || fail "required Next.js build metadata missing"
  [[ -f "$PM2_CONFIG_RELATIVE_PATH" ]] || fail "PM2 production configuration missing"

  mv "$TEMP_RELEASE" "$RELEASE_DIR"
  TEMP_RELEASE=""
fi

verify_built_deployment_id "$RELEASE_DIR" "$RELEASE_COMMIT" \
  || fail "Next.js deployment ID is not bound to the release commit"

# Owner-authorized ChatAdmin model activation requires a real provider contract
# probe before the live symlink or process changes. No automatic model downgrade.
if [[ -f "$RELEASE_DIR/scripts/operations/chat-admin-model-preflight.mjs" ]] && [[ "$PREVIOUS_LINK_TARGET" != "$RELEASE_DIR" ]]; then
  node --env-file="$RELEASE_DIR/.env.production" "$RELEASE_DIR/scripts/operations/chat-admin-model-preflight.mjs" \
    || fail "ChatAdmin model provider preflight blocked the release"
fi

sudo nginx -t

start_availability_probe

if ! switch_current_link "$RELEASE_DIR"; then
  fail "current release link could not be switched"
fi
SWITCHED=1

if pm2_uses_rolling_release_contract; then
  log "switching release with PM2 rolling reload"
  if ! reload_pm2_cluster "$RELEASE_DIR/$PM2_CONFIG_RELATIVE_PATH" "$RELEASE_COMMIT"; then
    rollback "PM2 rolling reload failed" || true
    fail "new release could not be reloaded"
  fi
else
  log "migrating legacy PM2 process to the rolling release contract"
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  if ! start_pm2_cluster "$RELEASE_DIR/$PM2_CONFIG_RELATIVE_PATH" "$RELEASE_COMMIT"; then
    rollback "PM2 cluster migration failed" || true
    fail "new release could not be started in cluster mode"
  fi
fi

if ! verify_pm2_release_contract "$RELEASE_COMMIT"; then
  rollback "PM2 release contract verification failed" || true
  fail "new release does not satisfy the PM2 rolling release contract"
fi

HEALTH_OK=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsSL --max-time 15 "$BASE_URL/login" -o /dev/null; then
    HEALTH_OK=1
    break
  fi
  log "application not ready; attempt $attempt/10"
  sleep 3
done

if [[ "$HEALTH_OK" -ne 1 ]]; then
  rollback "login healthcheck failed" || true
  fail "new release failed login healthcheck"
fi

cd "$RELEASE_DIR"
if ! FANMIND_SMOKE_BASE_URL="$BASE_URL" \
  FANMIND_EXPECTED_RELEASE_COMMIT="$RELEASE_COMMIT" \
  FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=production \
  npm run smoke:public; then
  rollback "public smoke test failed" || true
  fail "new release failed public smoke test"
fi

if ! verify_availability_probe; then
  rollback "release switch availability probe detected an outage" || true
  fail "new release caused a public availability gap"
fi

cd "$SOURCE_DIR"
if ! git reset --hard "$RELEASE_COMMIT"; then
  rollback "source checkout synchronization failed" || true
  fail "source checkout could not be synchronized"
fi

pm2 save
SWITCHED=0

mapfile -t RELEASE_PATHS < <(
  find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    sort -nr |
    awk '{ $1=""; sub(/^ /, ""); print }'
)

kept=0
for candidate in "${RELEASE_PATHS[@]}"; do
  if [[ "$candidate" == "$RELEASE_DIR" ]] \
    || [[ "$candidate" == "$PREVIOUS_CWD" ]] \
    || [[ "$candidate" == "$PREVIOUS_LINK_TARGET" ]]; then
    kept=$((kept + 1))
    continue
  fi
  if (( kept < RETAIN_RELEASES )); then
    kept=$((kept + 1))
    continue
  fi
  is_safe_release_path "$candidate" || fail "unsafe release cleanup path"
  rm -rf -- "$candidate"
  log "removed old release $(basename "$candidate")"
done

log "isolated release deployment completed at $RELEASE_COMMIT"
