#!/usr/bin/env python3
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
policy = json.loads((PM / "EVIDENCE_TTL_POLICY.json").read_text(encoding="utf-8"))["policy"]
register = json.loads((PM / "EVIDENCE_FRESHNESS.json").read_text(encoding="utf-8"))["entries"]
finishline = json.loads((PM / "FINISHLINE_STATE.json").read_text(encoding="utf-8"))

accepted = {"ACCEPTED", "PRODUCTION_CONFIRMED"}
mutable_success = {"VERIFIED", "COUNTERCHECKED", "ACCEPTED", "PRODUCTION_CONFIRMED"}
errors = []
now = datetime.now(timezone.utc)

ids = [entry.get("id") for entry in register if isinstance(entry, dict)]
if len(ids) != len(register) or len(ids) != len(set(ids)) or not all(ids):
    errors.append("evidence-id-missing-or-duplicate")

for entry in register:
    cls = entry.get("class")
    if cls not in policy:
        errors.append(f"unknown-evidence-class:{entry.get('id')}:{cls}")
        continue
    ttl = policy[cls].get("ttl_hours")
    status = entry.get("status")
    observed = entry.get("observed_at")
    if ttl is not None and status in mutable_success and not observed:
        errors.append(f"mutable-evidence-missing-observed-at:{entry.get('id')}")
        continue
    if ttl is not None and observed:
        try:
            instant = datetime.fromisoformat(observed.replace("Z", "+00:00"))
            if instant.tzinfo is None:
                raise ValueError("timezone required")
        except ValueError:
            errors.append(f"invalid-observed-at:{entry.get('id')}")
            continue
        expired = now > instant.astimezone(timezone.utc) + timedelta(hours=ttl)
        if expired:
            gate = entry.get("gate")
            gate_state = finishline.get("gates", {}).get(gate, {}).get("state")
            print(f"EVIDENCE_REVALIDATION_REQUIRED={entry.get('id')} gate={gate} state={gate_state}")
            if gate_state in accepted and status in mutable_success:
                errors.append(f"stale-evidence-supporting-accepted-gate:{entry.get('id')}:{gate}")

legacy_snapshots = [
    entry
    for entry in register
    if isinstance(entry, dict) and entry.get("id") == "EV-LEGACY-ISSUE-SNAPSHOT-20260830"
]
if len(legacy_snapshots) != 1:
    errors.append("legacy-issue-snapshot-missing-or-duplicate")
else:
    legacy_snapshot = legacy_snapshots[0]
    expected_revisions = legacy_snapshot.get("issues")
    if not isinstance(expected_revisions, dict) or set(expected_revisions) != {"642", "643", "644", "874"}:
        errors.append("legacy-issue-revisions-invalid")
    elif os.environ.get("GITHUB_ACTIONS") == "true" or os.environ.get("FANMIND_VERIFY_GITHUB_ISSUES") == "1":
        for issue_number, expected in expected_revisions.items():
            headers = {
                "Accept": "application/vnd.github+json",
                "User-Agent": "FanMind-project-memory-quality",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            github_token = os.environ.get("GITHUB_TOKEN")
            if github_token:
                headers["Authorization"] = f"Bearer {github_token}"
            request = Request(
                f"https://api.github.com/repos/FanMind/FanMind/issues/{issue_number}",
                headers=headers,
            )
            try:
                with urlopen(request, timeout=20) as response:  # noqa: S310 -- fixed public GitHub API host
                    live = json.load(response)
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
                errors.append(f"legacy-issue-live-read-failed:{issue_number}:{type(exc).__name__}")
                continue
            actual = {
                "updated_at": live.get("updated_at"),
                "state": live.get("state"),
                "state_reason": live.get("state_reason"),
                "body_sha256": hashlib.sha256((live.get("body") or "").encode("utf-8")).hexdigest(),
            }
            relevant_revision_fields = {"state", "state_reason", "body_sha256"}
            if any(actual.get(field) != expected.get(field) for field in relevant_revision_fields):
                errors.append(f"legacy-issue-live-revision-mismatch:{issue_number}")

if errors:
    print("FANMIND_EVIDENCE_FRESHNESS_RESULT=failed")
    for error in errors:
        print(f"FANMIND_EVIDENCE_FRESHNESS_ERROR={error}")
    sys.exit(1)
print("FANMIND_EVIDENCE_FRESHNESS_RESULT=passed")
