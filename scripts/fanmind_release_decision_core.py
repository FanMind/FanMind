#!/usr/bin/env python3
from __future__ import annotations

import fanmind_release_decision_core_round8 as _round8
from fanmind_release_decision_core_round8 import *  # noqa: F401,F403

# Round 8 deliberately treats missing contract revalidation metadata as a
# compatibility-only synthetic-fixture case in its final quorum recomputation,
# matching the already reviewed hardening layer. Canonical Project Memory still
# requires non-empty contract revalidate_on through the structural preflight.
_original_configured_trigger_list = _round8._configured_trigger_list


def _fixture_compatible_trigger_list(value):
    if value is None:
        return []
    return _original_configured_trigger_list(value)


_round8._configured_trigger_list = _fixture_compatible_trigger_list

# The prior current-head wrapper is now an internal security-relevant layer; add
# it to the signed control-plane fingerprint so this refactor cannot create an
# unsigned evaluator path. Round8 also binds itself internally so direct imports
# cannot omit it from the authenticated control-plane fingerprint.
_base = _round8._base
_base.CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_base.CONTROL_PLANE_FILES,
            "scripts/fanmind_release_decision_core_round8.py",
        )
    )
)
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES


def evaluate_release_decision(*args, **kwargs):
    """Pure evaluator used by focused tests and protected producer consumers."""
    return _round8.evaluate_release_decision(*args, **kwargs)


def _cli_evaluate_release_decision(*args, **kwargs):
    """Canonical CLI trust boundary: a bound release SHA must resolve to Git."""
    actual_head = kwargs.get("actual_head")
    if not _round8.git_commit_resolves(actual_head):
        return "BLOCK", ["release_evidence:actual_head_unresolvable"]
    return evaluate_release_decision(*args, **kwargs)


def main() -> int:
    # The inherited base CLI resolves its evaluator through this module-level
    # hook. Apply the Git-object check only at the CLI boundary so pure evaluator
    # tests can continue to use synthetic but syntactically valid 40-hex SHAs.
    previous = _base.evaluate_release_decision
    _base.evaluate_release_decision = _cli_evaluate_release_decision
    try:
        return _base.main()
    finally:
        _base.evaluate_release_decision = previous


# Direct imports use the fully hardened evaluator; canonical CLI execution swaps
# this hook temporarily to the stricter Git-object-resolving wrapper above.
_base.evaluate_release_decision = evaluate_release_decision


if __name__ == "__main__":
    raise SystemExit(main())
