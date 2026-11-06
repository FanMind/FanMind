#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "project-memory" / "FINISHLINE_STATE.json"


def main() -> None:
    data = json.loads(STATE.read_text(encoding="utf-8"))
    allowed = set(data.get("sales_required_states", ["ACCEPTED", "PRODUCTION_CONFIRMED"]))
    gates = data.get("gates", {})
    blockers = []
    for name, gate in gates.items():
        if gate.get("required_for_sales") is True and gate.get("state") not in allowed:
            blockers.append({"gate": name, "task": gate.get("task"), "state": gate.get("state")})
    calculated = len(blockers) == 0
    declared = data.get("sales_ready") is True
    if declared != calculated:
        raise SystemExit(
            f"SALES_READINESS_STATE_MISMATCH declared={str(declared).lower()} calculated={str(calculated).lower()}"
        )
    print(f"SALES_READY={str(calculated).lower()}")
    print(f"SALES_BLOCKER_COUNT={len(blockers)}")
    for item in blockers:
        print(f"SALES_BLOCKER={item['gate']}:{item['task']}:{item['state']}")


if __name__ == "__main__":
    main()
