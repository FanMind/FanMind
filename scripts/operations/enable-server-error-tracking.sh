#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/var/www/fanmind/.env.production"
CURRENT_LINK="/var/www/fanmind-current"
PM2_CONFIG="${CURRENT_LINK}/ops/pm2/fanmind.production.config.cjs"
APP_NAME="fanmind"
APP_USER="ubuntu"
PM2_BIN=""
EXPECTED_COMMIT="${1:-}"
CONFIRMATION="${2:-}"

fail() {
  echo "FanMind server-error tracking activation failed: $1" >&2
  exit 1
}

reload_application() {
  sudo -n -u "$APP_USER" -H \
    env \
      FANMIND_RELEASE_COMMIT="$EXPECTED_COMMIT" \
      FANMIND_CURRENT_RELEASE_LINK="$CURRENT_LINK" \
      FANMIND_PM2_APP_NAME="$APP_NAME" \
      "$PM2_BIN" reload "$PM2_CONFIG" --only "$APP_NAME" --update-env \
      >/dev/null
}

verify_application_process() {
  sudo -n -u "$APP_USER" -H "$PM2_BIN" jlist | \
    FANMIND_EXPECTED_RELEASE_COMMIT="$EXPECTED_COMMIT" \
    FANMIND_EXPECTED_PM2_CWD="$CURRENT_LINK" \
    FANMIND_EXPECTED_PM2_APP="$APP_NAME" \
    /usr/bin/node -e '
      let source = "";
      process.stdin.on("data", chunk => source += chunk);
      process.stdin.on("end", () => {
        let list;
        try { list = JSON.parse(source); } catch { process.exit(1); }
        const matches = list.filter(item => item?.name === process.env.FANMIND_EXPECTED_PM2_APP);
        const entry = matches[0]?.pm2_env;
        const valid = matches.length === 1
          && entry?.status === "online"
          && entry?.exec_mode === "cluster_mode"
          && entry?.pm_cwd === process.env.FANMIND_EXPECTED_PM2_CWD
          && entry?.FANMIND_RELEASE_COMMIT === process.env.FANMIND_EXPECTED_RELEASE_COMMIT
          && entry?.FANMIND_RUNTIME_ENVIRONMENT === "production";
        process.exit(valid ? 0 : 1);
      });
    '
}

[[ "$(id -u)" -eq 0 ]] || fail "root_required"
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "expected_commit_invalid"
[[ "$CONFIRMATION" == "activate-server-error-tracking-production" ]] || fail "confirmation_invalid"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || fail "environment_file_invalid"
[[ -f "$PM2_CONFIG" && ! -L "$PM2_CONFIG" ]] || fail "pm2_config_invalid"
PM2_BIN="$(sudo -n -u "$APP_USER" -H env PATH=/usr/local/bin:/usr/bin:/bin /bin/sh -c 'command -v pm2')" \
  || fail "pm2_unavailable"
case "$PM2_BIN" in
  /usr/bin/pm2|/usr/local/bin/pm2) ;;
  *) fail "pm2_path_invalid" ;;
esac
[[ -x "$PM2_BIN" ]] || fail "pm2_unavailable"

env_mode="$(stat -c '%a' "$ENV_FILE")"
case "$env_mode" in
  600|640) ;;
  *) fail "environment_file_mode_invalid" ;;
esac
env_size="$(stat -c '%s' "$ENV_FILE")"
[[ "$env_size" -gt 0 && "$env_size" -le 1048576 ]] || fail "environment_file_size_invalid"

version_payload="$(curl -fsSL --max-time 15 --max-filesize 16384 https://fanmind.ch/api/version)" \
  || fail "version_unavailable"
live_commit="$(VERSION_PAYLOAD="$version_payload" /usr/bin/node -e '
  const payload = JSON.parse(process.env.VERSION_PAYLOAD || "{}");
  const value = payload.releaseCommit;
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) process.exit(1);
  process.stdout.write(value);
')" || fail "version_response_invalid"
unset version_payload VERSION_PAYLOAD
[[ "$live_commit" == "$EXPECTED_COMMIT" ]] || fail "release_commit_mismatch"

sudo -n systemctl reset-failed fanmind-server-error-migration@verify.service >/dev/null 2>&1 || true
sudo -n systemctl start fanmind-server-error-migration@verify.service >/dev/null 2>&1 \
  || fail "schema_verification_failed"
[[ "$(systemctl show fanmind-server-error-migration@verify.service --property=Result --value --no-pager)" == "success" ]] \
  || fail "schema_verification_failed"

sudo -n systemctl reset-failed fanmind-server-error-acceptance.service >/dev/null 2>&1 || true
sudo -n systemctl start fanmind-server-error-acceptance.service >/dev/null 2>&1 \
  || fail "email_disabled_acceptance_failed"
[[ "$(systemctl show fanmind-server-error-acceptance.service --property=Result --value --no-pager)" == "success" ]] \
  || fail "email_disabled_acceptance_failed"

for key in FANMIND_SERVER_ERROR_TRACKING_ENABLED FANMIND_SERVER_ERROR_EMAIL_ENABLED; do
  count="$(grep -Ec "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" || true)"
  [[ "$count" -le 1 ]] || fail "${key}_duplicate"
done

backup_file="$(mktemp "${ENV_FILE}.server-error-backup.XXXXXX")"
next_file="$(mktemp "${ENV_FILE}.server-error-next.XXXXXX")"
audit_file="$(mktemp /tmp/fanmind-server-error-activation-audit.XXXXXX)"
activated=false
env_changed=false

cleanup() {
  rm -f "$next_file" "$audit_file"
  if [[ "$activated" != "true" ]]; then
    if [[ -f "$backup_file" ]]; then
      chown --reference="$ENV_FILE" "$backup_file" 2>/dev/null || true
      chmod --reference="$ENV_FILE" "$backup_file" 2>/dev/null || true
      mv -f "$backup_file" "$ENV_FILE" 2>/dev/null || true
    fi
    if [[ "$env_changed" == "true" ]]; then
      reload_application >/dev/null 2>&1 || true
    fi
  else
    rm -f "$backup_file"
  fi
}
trap cleanup EXIT

cp --preserve=mode,ownership,timestamps "$ENV_FILE" "$backup_file"

awk '
  BEGIN { tracking_seen = 0; email_seen = 0 }
  /^[[:space:]]*FANMIND_SERVER_ERROR_TRACKING_ENABLED[[:space:]]*=/ {
    print "FANMIND_SERVER_ERROR_TRACKING_ENABLED=true"
    tracking_seen = 1
    next
  }
  /^[[:space:]]*FANMIND_SERVER_ERROR_EMAIL_ENABLED[[:space:]]*=/ {
    print "FANMIND_SERVER_ERROR_EMAIL_ENABLED=false"
    email_seen = 1
    next
  }
  { print }
  END {
    if (!tracking_seen) print "FANMIND_SERVER_ERROR_TRACKING_ENABLED=true"
    if (!email_seen) print "FANMIND_SERVER_ERROR_EMAIL_ENABLED=false"
  }
' "$ENV_FILE" > "$next_file"

chown --reference="$ENV_FILE" "$next_file"
chmod --reference="$ENV_FILE" "$next_file"
mv -f "$next_file" "$ENV_FILE"
env_changed=true

[[ "$(grep -Ec '^[[:space:]]*FANMIND_SERVER_ERROR_TRACKING_ENABLED[[:space:]]*=[[:space:]]*true[[:space:]]*$' "$ENV_FILE")" -eq 1 ]] \
  || fail "tracking_flag_write_failed"
[[ "$(grep -Ec '^[[:space:]]*FANMIND_SERVER_ERROR_EMAIL_ENABLED[[:space:]]*=[[:space:]]*false[[:space:]]*$' "$ENV_FILE")" -eq 1 ]] \
  || fail "email_flag_write_failed"

reload_application || fail "pm2_reload_failed"
verify_application_process || fail "pm2_contract_failed"

health_payload="$(curl -fsSL --max-time 15 --max-filesize 65536 https://fanmind.ch/api/health)" \
  || fail "health_unavailable"
HEALTH_PAYLOAD="$health_payload" /usr/bin/node -e '
  const payload = JSON.parse(process.env.HEALTH_PAYLOAD || "{}");
  const components = Array.isArray(payload.checks) ? payload.checks : [];
  const healthy = payload.status === "healthy"
    && components.length === 8
    && components.every(component => component?.status === "healthy");
  process.exit(healthy ? 0 : 1);
' || fail "health_invalid"
unset health_payload HEALTH_PAYLOAD

if ! sudo -n -u "$APP_USER" -H \
  env FANMIND_AUDIT_VERIFIER_PATH=/usr/local/lib/fanmind-ops/verify-backup-artifact.mjs \
  /usr/local/lib/fanmind-audit/read-only-production-audit.sh \
  > "$audit_file" 2>&1; then
  fail "post_activation_audit_failed"
fi
if ! /usr/bin/node /usr/local/lib/fanmind-audit/verify-production-audit-output.mjs \
  "$audit_file" \
  "$EXPECTED_COMMIT"; then
  fail "post_activation_audit_verification_failed"
fi

activated=true
echo "SERVER_ERROR_TRACKING_ACTIVATION=success"
echo "SERVER_ERROR_TRACKING_ENABLED=true"
echo "SERVER_ERROR_TRACKING_EMAIL_ENABLED=false"
