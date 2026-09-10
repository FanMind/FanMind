#!/usr/bin/env python3
from __future__ import annotations
import json
import os
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
creator_action = next((a for a in catalog.get("actions", [])
                       if a.get("id") == "NBA-CREATOR-INTELLIGENCE"), {})
if creator_gate.get("required_for_sales") is not False:
    errors.append("creator-expansion-must-not-block-sales")
if (creator_action.get("prerequisite_gates") != ["memory_v6", "staging"]
        or creator_action.get("parallel_safe") is not True):
    errors.append("creator-development-must-follow-owner-decision-015")
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
