#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'usage: %s <40-char-lowercase-git-sha> [target-path]\n' "$(basename "$0")" >&2
}

cleanup() {
  if [[ -n "${tmp_file:-}" && -e "$tmp_file" ]]; then
    rm -f -- "$tmp_file"
  fi
}
trap cleanup EXIT

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

release_commit="$1"
target_path="${2:-/etc/fanmind-backup/release.env}"

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'error: release commit must be a full 40-character lowercase git SHA\n' >&2
  exit 2
fi

if [[ "$target_path" != /* ]]; then
  printf 'error: target path must be absolute\n' >&2
  exit 2
fi

target_dir="$(dirname -- "$target_path")"
target_base="$(basename -- "$target_path")"

if [[ ! -d "$target_dir" ]]; then
  printf 'error: target directory does not exist\n' >&2
  exit 1
fi

umask 077
tmp_file="$(mktemp --tmpdir="$target_dir" ".${target_base}.tmp.XXXXXXXXXX")"
printf 'FANMIND_RELEASE_COMMIT=%s\n' "$release_commit" > "$tmp_file"
chmod 0600 "$tmp_file"

if [[ "$(id -u)" -eq 0 ]]; then
  chown root:root "$tmp_file"
fi

mv -f -- "$tmp_file" "$target_path"
tmp_file=""

if [[ "$(id -u)" -eq 0 ]]; then
  chown root:root "$target_path"
fi
chmod 0600 "$target_path"

printf 'Backup release commit recorded: %.12s\n' "$release_commit"
