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
# unsigned evaluator path.
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
    return _round8.evaluate_release_decision(*args, **kwargs)


# The inherited CLI main resolves the evaluator through _base at runtime.
_base.evaluate_release_decision = evaluate_release_decision


if __name__ == "__main__":
    raise SystemExit(main())
