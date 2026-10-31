#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly EXPECTED_SOURCE_HEAD="f1568c42f3ae08c9014ac659a7030d115b76654e"
readonly EXPECTED_MANIFEST_BLOB="c9f53631425ac240358f989d57ace7db91178ed2"
readonly EXPECTED_PATCH_SHA256="b240031f15d7946c52702245c28220a74ea24299940c4a8a8967b87194a24a6d"
readonly EXPECTED_CANDIDATE_MANIFEST_SHA256="26d0a8d5882df3d4313f2a05242ca8b74b69fd51671de3aa3c709fbc92be5e18"
readonly RC6_RELATIVE_PATH="supabase/controlled/boerns-agent-claims-rc6"
readonly DATABASE_URL="postgresql://postgres@127.0.0.1:5432/boerns_rc6"

: "${BOERNS_RC6_SOURCE_REPO:?exact RC6 source checkout is required}"
: "${BOERNS_RC6_PRIMARY_CONTAINER_ID:?primary PG17 service container is required}"
: "${BOERNS_RC6_ROLLBACK_CONTAINER_ID:?rollback PG17 service container is required}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
patch_file="$repo_root/tests/fixtures/boerns-rc6-r8.patch"
source_root="$BOERNS_RC6_SOURCE_REPO/$RC6_RELATIVE_PATH"
work_dir="$(mktemp -d)"
candidate_root="$work_dir/candidate"
candidate_manifest="$work_dir/candidate-manifest.sha256"

emit_bounded_artifacts() {
  local container_id="$1"
  docker exec "$container_id" sh -c '
    if [ -d /tmp/boerns-artifacts ]; then
      find /tmp/boerns-artifacts -type f | sort | head -n 20 |
      while IFS= read -r artifact; do
        printf "ARTIFACT_TAIL path=%s\n" "$artifact"
        tail -n 40 "$artifact"
      done
    fi
  ' 2>&1 || true
}

cleanup() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    emit_bounded_artifacts "$BOERNS_RC6_PRIMARY_CONTAINER_ID"
    emit_bounded_artifacts "$BOERNS_RC6_ROLLBACK_CONTAINER_ID"
  fi
  for container_id in "$BOERNS_RC6_PRIMARY_CONTAINER_ID" "$BOERNS_RC6_ROLLBACK_CONTAINER_ID"; do
    docker exec "$container_id" sh -c       'rm -rf /tmp/boerns-rc6 /tmp/boerns-artifacts' >/dev/null 2>&1 || true
  done
  rm -rf "$work_dir"
  exit "$status"
}
trap cleanup EXIT

fail() {
  printf 'RC6_PG17_PRECHECK_FAIL reason=%s\n' "$1" >&2
  exit 1
}

actual_head="$(git -C "$BOERNS_RC6_SOURCE_REPO" rev-parse HEAD)"
[[ "$actual_head" == "$EXPECTED_SOURCE_HEAD" ]] ||
  fail "unexpected_source_head"

actual_manifest_blob="$(
  git -C "$BOERNS_RC6_SOURCE_REPO" rev-parse     "HEAD:$RC6_RELATIVE_PATH/MANIFEST.sha256"
)"
[[ "$actual_manifest_blob" == "$EXPECTED_MANIFEST_BLOB" ]] ||
  fail "unexpected_original_manifest_blob"

printf '%s  %s\n' "$EXPECTED_PATCH_SHA256" "$patch_file" | sha256sum -c -
(
  cd "$source_root"
  sha256sum -c MANIFEST.sha256
)

mapfile -t patch_paths < <(
  awk '/^(--- a\/|\+\+\+ b\/)/ {
    sub(/^(--- a\/|\+\+\+ b\/)/, "")
    print
  }' "$patch_file" | sort -u
)
expected_patch_paths=(
  "TEST_AND_ROLLBACK_PLAN.md"
  "tests/10_functional_smoke.sql"
  "tests/20_concurrent_acquire.sh"
  "tests/25_empty_rollback_race.sh"
)
[[ "${patch_paths[*]}" == "${expected_patch_paths[*]}" ]] ||
  fail "unexpected_patch_paths"
[[ "$(grep -c '^--- a/' "$patch_file")" == "4" ]] ||
  fail "unexpected_old_patch_section_count"
[[ "$(grep -c '^+++ b/' "$patch_file")" == "4" ]] ||
  fail "unexpected_new_patch_section_count"

mkdir -p "$candidate_root"
cp -a "$source_root/." "$candidate_root/"
patch --batch --forward --reject-file=- -d "$candidate_root" -p1 <"$patch_file"

(
  cd "$candidate_root"
  while read -r _ path; do
    sha256sum "$path"
  done <"$source_root/MANIFEST.sha256"
) >"$candidate_manifest"
printf '%s  %s\n' "$EXPECTED_CANDIDATE_MANIFEST_SHA256"   "$candidate_manifest" | sha256sum -c -

for unchanged_path in   "20261028_01_create_boerns_agent_claims.sql"   "20261028_01_drop_boerns_agent_claims.sql"   "adapter/error_mapping.mjs"   "tests/30_adapter_error_mapping.test.mjs"; do
  cmp "$source_root/$unchanged_path" "$candidate_root/$unchanged_path"
done

for container_id in "$BOERNS_RC6_PRIMARY_CONTAINER_ID" "$BOERNS_RC6_ROLLBACK_CONTAINER_ID"; do
  docker exec "$container_id" sh -c     'rm -rf /tmp/boerns-rc6 /tmp/boerns-artifacts && mkdir -p /tmp/boerns-rc6 /tmp/boerns-artifacts'
  docker cp "$candidate_root/." "$container_id:/tmp/boerns-rc6"
done

run_container_stage() {
  local container_id="$1"
  local stage_timeout="$2"
  local stage_name="$3"
  local stage_command="$4"

  printf 'STAGE_START name=%s\n' "$stage_name"
  docker exec     -e PGPASSWORD=boerns-rc6-ci-only     -e DATABASE_URL="$DATABASE_URL"     -e ROLLBACK_DATABASE_URL="$DATABASE_URL"     "$container_id"     timeout --signal=TERM --kill-after=5s "$stage_timeout"     bash -lc "$stage_command"
  printf 'STAGE_PASS name=%s\n' "$stage_name"
}

run_container_stage   "$BOERNS_RC6_PRIMARY_CONTAINER_ID" 180s primary-functional   'cd /tmp/boerns-rc6 &&
   psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/00_local_database_preflight.sql &&
   psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 20261028_01_create_boerns_agent_claims.sql &&
   psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/10_functional_smoke.sql'

run_container_stage   "$BOERNS_RC6_PRIMARY_CONTAINER_ID" 300s primary-concurrency-restore-epoch   'cd /tmp/boerns-rc6 &&
   ARTIFACT_DIR=/tmp/boerns-artifacts/concurrent
   export ARTIFACT_DIR
   tests/20_concurrent_acquire.sh'

run_container_stage   "$BOERNS_RC6_ROLLBACK_CONTAINER_ID" 300s rollback-empty-races   'cd /tmp/boerns-rc6 &&
   ARTIFACT_DIR=/tmp/boerns-artifacts/empty-rollback
   export ARTIFACT_DIR
   tests/25_empty_rollback_race.sh'

printf 'STAGE_START name=adapter-error-mapping\n'
timeout --signal=TERM --kill-after=5s 60s   node --test "$candidate_root/tests/30_adapter_error_mapping.test.mjs"
printf 'STAGE_PASS name=adapter-error-mapping\n'
printf 'RC6_PG17_SYNTHETIC_PASS source_head=%s candidate_manifest_sha256=%s\n'   "$EXPECTED_SOURCE_HEAD" "$EXPECTED_CANDIDATE_MANIFEST_SHA256"
