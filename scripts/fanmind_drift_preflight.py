#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
baseline = json.loads((PM / "DRIFT_BASELINE.json").read_text(encoding="utf-8"))

def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("utf-8")
    return hashlib.sha1(header + data).hexdigest()

errors = []
for relative, expected in baseline.get("watched_files", {}).items():
    path = ROOT / relative
    if not path.exists():
        errors.append(f"watched-file-missing:{relative}")
        continue
    actual = git_blob_sha(path.read_bytes())
    if actual != expected:
        errors.append(f"DRIFT_REVIEW_REQUIRED:{relative}:expected={expected}:actual={actual}")

if errors:
    print("FANMIND_DRIFT_PREFLIGHT_RESULT=failed")
    for error in errors:
        print(f"FANMIND_DRIFT_PREFLIGHT_ERROR={error}")
    sys.exit(1)
print("FANMIND_DRIFT_PREFLIGHT_RESULT=passed")
