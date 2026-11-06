#!/usr/bin/env python3
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
policy = json.loads((PM / "MILESTONE_POLICY.json").read_text(encoding="utf-8"))
required = set(policy["required_fields"])
allowed = set(policy["milestones"])
folder = ROOT / policy["directory"]
errors = []
seen = set()

if not folder.exists():
    errors.append("milestone-directory-missing")
else:
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            errors.append(f"invalid-json:{path.name}")
            continue
        missing = sorted(required - set(data))
        if missing:
            errors.append(f"missing-fields:{path.name}:{','.join(missing)}")
        milestone = data.get("milestone")
        if milestone not in allowed:
            errors.append(f"unknown-milestone:{path.name}:{milestone}")
        key = (milestone, data.get("snapshot_date"), data.get("snapshot_commit"))
        if key in seen:
            errors.append(f"duplicate-snapshot:{path.name}")
        seen.add(key)
        if data.get("state") not in {"ACCEPTED", "PRODUCTION_CONFIRMED"}:
            errors.append(f"invalid-snapshot-state:{path.name}:{data.get('state')}")
        if not isinstance(data.get("evidence"), list) or not data.get("evidence"):
            errors.append(f"snapshot-evidence-empty:{path.name}")
        if not isinstance(data.get("open_followups"), list):
            errors.append(f"snapshot-followups-not-list:{path.name}")

if errors:
    print("FANMIND_MILESTONE_SNAPSHOT_RESULT=failed")
    for error in errors:
        print(f"FANMIND_MILESTONE_SNAPSHOT_ERROR={error}")
    sys.exit(1)
print("FANMIND_MILESTONE_SNAPSHOT_RESULT=passed")
