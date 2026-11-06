#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/var/www/fanmind/.env.production"
TIMER_UNIT="fanmind-operations-monitor.timer"
SERVICE_UNIT="fanmind-operations-monitor.service"
AUDIT_USER="ubuntu"
EXPECTED_COMMIT="${1:-}"
CONFIRMATION="${2:-}"

fail() {
  echo "FanMind operations monitor activation failed: $1" >&2
  exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail "root_required"
[[ "$EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "expected_commit_invalid"
[[ "$CONFIRMATION" == "activate-operations-monitor-production" ]] || fail "confirmation_invalid"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || fail "environment_file_invalid"

env_mode="$(stat -c '%a' "$ENV_FILE")"
case "$env_mode" in
  600|640) ;;
  *) fail "environment_file_mode_invalid" ;;
esac
env_size="$(stat -c '%s' "$ENV_FILE")"
[[ "$env_size" -gt 0 && "$env_size" -le 1048576 ]] || fail "environment_file_size_invalid"

version_payload="$(curl -fsSL --max-time 15 --max-filesize 16384 https://fanmind.ch/api/version)" || fail "version_unavailable"
live_commit="$(VERSION_PAYLOAD="$version_payload" /usr/bin/node -e '
  const payload = JSON.parse(process.env.VERSION_PAYLOAD || "{}");
  const value = payload.releaseCommit;
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) process.exit(1);
  process.stdout.write(value);
')" || fail "version_response_invalid"
unset version_payload VERSION_PAYLOAD
[[ "$live_commit" == "$EXPECTED_COMMIT" ]] || fail "release_commit_mismatch"

for key in FANMIND_OPERATIONS_MONITOR_ENABLED FANMIND_OPERATIONS_EMAIL_ENABLED; do
  count="$(grep -Ec "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" || true)"
  [[ "$count" -le 1 ]] || fail "${key}_duplicate"
done

was_enabled="$(systemctl is-enabled "$TIMER_UNIT" 2>/dev/null || true)"
backup_file="$(mktemp "${ENV_FILE}.operations-backup.XXXXXX")"
next_file="$(mktemp "${ENV_FILE}.operations-next.XXXXXX")"
audit_file="$(mktemp /tmp/fanmind-monitor-activation-audit.XXXXXX)"
activated=false

cleanup() {
  rm -f "$next_file" "$audit_file"
  if [[ "$activated" != "true" ]]; then
    if [[ -f "$backup_file" ]]; then
      chown --reference="$ENV_FILE" "$backup_file" 2>/dev/null || true
      chmod --reference="$ENV_FILE" "$backup_file" 2>/dev/null || true
      mv -f "$backup_file" "$ENV_FILE" 2>/dev/null || true
    fi
    if [[ "$was_enabled" == "enabled" ]]; then
      systemctl enable --now "$TIMER_UNIT" >/dev/null 2>&1 || true
    else
      systemctl disable --now "$TIMER_UNIT" >/dev/null 2>&1 || true
    fi
  else
    rm -f "$backup_file"
  fi
}
trap cleanup EXIT

cp --preserve=mode,ownership,timestamps "$ENV_FILE" "$backup_file"

awk '
  BEGIN { monitor_seen = 0; email_seen = 0 }
  /^[[:space:]]*FANMIND_OPERATIONS_MONITOR_ENABLED[[:space:]]*=/ {
    print "FANMIND_OPERATIONS_MONITOR_ENABLED=true"
    monitor_seen = 1
    next
  }
  /^[[:space:]]*FANMIND_OPERATIONS_EMAIL_ENABLED[[:space:]]*=/ {
    print "FANMIND_OPERATIONS_EMAIL_ENABLED=false"
    email_seen = 1
    next
  }
  { print }
  END {
    if (!monitor_seen) print "FANMIND_OPERATIONS_MONITOR_ENABLED=true"
    if (!email_seen) print "FANMIND_OPERATIONS_EMAIL_ENABLED=false"
  }
' "$ENV_FILE" > "$next_file"

chown --reference="$ENV_FILE" "$next_file"
chmod --reference="$ENV_FILE" "$next_file"
mv -f "$next_file" "$ENV_FILE"

[[ "$(grep -Ec '^[[:space:]]*FANMIND_OPERATIONS_MONITOR_ENABLED[[:space:]]*=[[:space:]]*true[[:space:]]*$' "$ENV_FILE")" -eq 1 ]] || fail "monitor_flag_write_failed"
[[ "$(grep -Ec '^[[:space:]]*FANMIND_OPERATIONS_EMAIL_ENABLED[[:space:]]*=[[:space:]]*false[[:space:]]*$' "$ENV_FILE")" -eq 1 ]] || fail "email_flag_write_failed"

systemctl daemon-reload
systemctl enable --now "$TIMER_UNIT"
systemctl start "$SERVICE_UNIT"

[[ "$(systemctl is-enabled "$TIMER_UNIT")" == "enabled" ]] || fail "timer_not_enabled"
[[ "$(systemctl is-active "$TIMER_UNIT")" == "active" ]] || fail "timer_not_active"
[[ "$(systemctl show "$SERVICE_UNIT" --property=Result --value --no-pager)" == "success" ]] || fail "service_result_failed"

if ! sudo -n -u "$AUDIT_USER" -H \
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
echo "OPERATIONS_MONITOR_ACTIVATION=success"
echo "OPERATIONS_MONITOR_TIMER_ENABLED=true"
echo "OPERATIONS_MONITOR_EMAIL_ENABLED=false"
