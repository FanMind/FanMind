#!/usr/bin/env python3
from __future__ import annotations
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
errors: list[str] = []
findings: list[str] = []


def text(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        errors.append(f"missing:{path}")
        return ""
    return p.read_text(encoding="utf-8")


def creator_development_contract_errors(creator_gate: dict, catalog: dict) -> list[str]:
    result: list[str] = []
    active = [
        action
        for action in catalog.get("actions", [])
        if action.get("id") == "NBA-CREATOR-INTELLIGENCE"
    ]
    retired = [
        action
        for action in catalog.get("retired_actions", [])
        if action.get("id") == "NBA-CREATOR-INTELLIGENCE"
    ]

    if creator_gate.get("required_for_sales") is not False:
        result.append("creator-expansion-must-not-block-sales")
    if len(active) > 1 or len(retired) > 1 or (active and retired):
        result.append("creator-action-identity-must-be-unambiguous")
        return result
    if active:
        action = active[0]
        if (
            action.get("prerequisite_gates") != ["memory_v6", "staging"]
            or action.get("parallel_safe") is not True
        ):
            result.append("creator-development-must-follow-owner-decision-015")
        return result
    if retired:
        action = retired[0]
        if (
            action.get("status") != "CONSUMED"
            or "#1184" not in str(action.get("bounded_source_evidence", ""))
            or "new bounded engineering action" not in str(action.get("reason", ""))
            or not str(action.get("replacement_rule", "")).strip()
        ):
            result.append("consumed-creator-action-missing-bounded-evidence-or-replacement")
        return result

    result.append("creator-development-action-missing-without-consumed-evidence")
    return result


if "--creator-contract-test" in sys.argv:
    active_catalog = {
        "actions": [{
            "id": "NBA-CREATOR-INTELLIGENCE",
            "prerequisite_gates": ["memory_v6", "staging"],
            "parallel_safe": True,
        }],
        "retired_actions": [],
    }
    retired_catalog = {
        "actions": [],
        "retired_actions": [{
            "id": "NBA-CREATOR-INTELLIGENCE",
            "status": "CONSUMED",
            "bounded_source_evidence": "PR #1184",
            "reason": "requires a new bounded engineering action",
            "replacement_rule": "exact scope required",
        }],
    }
    creator_gate = {"required_for_sales": False}
    assert creator_development_contract_errors(creator_gate, active_catalog) == []
    assert creator_development_contract_errors(creator_gate, retired_catalog) == []
    assert "creator-development-action-missing-without-consumed-evidence" in (
        creator_development_contract_errors(creator_gate, {"actions": [], "retired_actions": []})
    )
    invalid_retired = json.loads(json.dumps(retired_catalog))
    invalid_retired["retired_actions"][0]["bounded_source_evidence"] = ""
    assert "consumed-creator-action-missing-bounded-evidence-or-replacement" in (
        creator_development_contract_errors(creator_gate, invalid_retired)
    )
    duplicate = json.loads(json.dumps(retired_catalog))
    duplicate["actions"] = active_catalog["actions"]
    assert "creator-action-identity-must-be-unambiguous" in (
        creator_development_contract_errors(creator_gate, duplicate)
    )
    print("FANMIND_CREATOR_ACTION_CONTRACT_RESULT=passed")
    raise SystemExit(0)


state = json.loads(text("project-memory/FINISHLINE_STATE.json") or "{}")
roadmap = text("src/config/roadmap.ts")
truth = text("docs/SOURCE_OF_TRUTH.md")
contr = text("project-memory/CONTRADICTIONS.md")
external = text("project-memory/EXTERNAL_ACCEPTANCE.md")
restore = text("project-memory/RESTORE_STATE_MACHINE.md")

expected_repo = state.get("repository")
ci_repo = os.environ.get("GITHUB_REPOSITORY")
if ci_repo and expected_repo and ci_repo != expected_repo:
    errors.append(f"repository-mismatch:{ci_repo}!={expected_repo}")

# Roadmap invariants.
for token in [
    'title: "Produktions- & Billing-Basis"',
    'status: "Technisch abgeschlossen"',
    'title: "Social-Kanäle & Creator Intelligence"',
    'status: "Creator und Social jetzt · Android danach"',
    'label: "Verkaufsübergabe", state: "later", status: "Nach Abnahme der Kanäle in Phase 3 + 7"',
    'label: "Creator Intelligence & Sales Assistance", state: "progress", status: "Phase 7b · jetzt in Arbeit"',
    'title: "Website-KI, iOS & weitere Kanäle"',
    'status: "Website-KI begonnen · übrige Anbindungen später"',
]:
    if token not in roadmap:
        errors.append(f"roadmap-invariant-missing:{token}")

for channel in ["Facebook", "Instagram", "WhatsApp"]:
    if f'label: "{channel}"' not in roadmap:
        errors.append(f"phase3-channel-missing:{channel}")
for channel in ["TikTok", "X / Twitter", "Discord", "OnlyFans"]:
    if f'label: "{channel}"' not in roadmap:
        errors.append(f"phase7-channel-missing:{channel}")

# FM-DEC-015 resumes development now; Creator remains outside sales acceptance.
creator_gate = state.get("gates", {}).get("creator_intelligence", {})
catalog = json.loads(text("project-memory/NEXT_BEST_ACTIONS.json") or "{}")
errors.extend(creator_development_contract_errors(creator_gate, catalog))
for action in catalog.get("actions", []):
    if state.get("gates", {}).get(action.get("gate"), {}).get("required_for_sales"):
        if "creator_intelligence" in action.get("prerequisite_gates", []):
            errors.append("pre-sales-action-must-not-require-creator-expansion")

if "FM-DEC-015" not in text("project-memory/DECISIONS.md") or "Ein Creator = ein Account = ein Workspace" not in text("docs/CREATOR_INTELLIGENCE.md"):
    errors.append("creator-account-boundary-missing")

# Canonical truth invariants.
for token in [
    "Phase 3 umfasst Facebook, Instagram und WhatsApp",
    "Phase 7 umfasst TikTok, X/Twitter, Discord und OnlyFans",
    "Die technische Verkaufsübergabe erfolgt erst nach realer technischer Abnahme",
    "dieser Teil von Phase 8 ist deshalb begonnen",
]:
    if token not in truth:
        errors.append(f"source-truth-invariant-missing:{token}")

# Known ownership drift must be explicitly reconciled rather than silently accepted.
stale_ownership = (
    "user-owned" in truth
    or "future-org" in truth
    or "zukünftige Organisation" in truth
)
if stale_ownership:
    findings.append("known-restore-ownership-drift")
    if "CTR-FM-001" not in contr or "RECONCILIATION_REQUIRED" not in contr:
        errors.append("stale-restore-ownership-not-recorded-as-contradiction")

# V6 state must not claim external controls accepted implicitly.
if state.get("phase8_started") is not True:
    errors.append("website-ai-phase8-foundation-not-recorded")
if state.get("sales_ready") is not False:
    errors.append("sales-ready-must-remain-false-until-derived-gates-pass")
for required in ["EXT-MOBILE-ANDROID", "EXT-MOBILE-IOS", "EXT-META-EVENTS", "EXT-LEGAL-TAX-AVV"]:
    if required not in external:
        errors.append(f"external-control-missing:{required}")
for token in ["BACKUP_ACCEPTED", "TARGET_COMPATIBLE", "DB_RESTORED", "DISPOSABLE_TARGET_CLEANED", "ACCEPTED"]:
    if token not in restore:
        errors.append(f"restore-state-missing:{token}")

if errors:
    print("FANMIND_TRUTH_DRIFT_RESULT=failed")
    for item in findings:
        print(f"FANMIND_TRUTH_DRIFT_FINDING={item}")
    for item in errors:
        print(f"FANMIND_TRUTH_DRIFT_ERROR={item}")
    raise SystemExit(1)

print("FANMIND_TRUTH_DRIFT_RESULT=passed")
for item in findings:
    print(f"FANMIND_TRUTH_DRIFT_FINDING={item}")
