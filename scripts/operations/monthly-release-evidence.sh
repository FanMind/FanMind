#!/bin/bash -p
set -euo pipefail
export PATH=/usr/bin:/bin
[[ "$EUID" == 0 && "$#" == 3 ]]
[[ "$1" =~ ^[0-9a-f]{64}$ && "$2" =~ ^[0-9a-f]{40}$ && "$3" =~ ^[0-9a-f]{40}$ ]]
BUNDLE=/usr/local/lib/fanmind-monthly-release
for directory in / /usr /usr/local /usr/local/lib "$BUNDLE" "$BUNDLE/scripts" "$BUNDLE/scripts/operations"; do
  [[ -d "$directory" && "$(readlink -f "$directory")" == "$directory" ]]
  [[ "$(stat -c %u "$directory")" == 0 ]]
  mode="$(stat -c %a "$directory")"
  (( (8#$mode & 8#022) == 0 ))
done
for file in \
  scripts/operations/monthly-release-evidence.mjs \
  scripts/operations/monthly-release-control.mjs \
  scripts/operations/monthly-release-package.mjs \
  scripts/operations/production-release-preflight.mjs \
  scripts/operations/verify-production-audit-output.mjs \
  scripts/operations/production-boot-readiness.mjs \
  scripts/operations/verify-restore-drill-evidence.mjs \
  scripts/operations/verify-full-backup-restore-receipt.mjs \
  scripts/operations/database-authorization-contract.mjs \
  scripts/public-health-policy.mjs; do
  [[ -f "$BUNDLE/$file" && ! -L "$BUNDLE/$file" ]]
  [[ "$(stat -c '%u:%a' "$BUNDLE/$file")" == 0:644 ]]
done
exec /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/node \
  /usr/local/lib/fanmind-monthly-release/scripts/operations/monthly-release-evidence.mjs "$1" "$2" "$3"
