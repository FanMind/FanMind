# Creator Foundation Transition Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repository-only generator and assertions contract for the exact bounded Creator Foundation legacy-to-current transition.

**Architecture:** A pure Node module verifies immutable source/profile pins and emits one deterministic SQL artifact plus a manifest. Unit tests pin its fail-closed surface; the existing isolated PG17 harness executes the artifact transactionally to prove exact catalog change, rollback and data preservation without contacting Staging or Production.

**Tech Stack:** Node.js ESM, `node:test`, PostgreSQL 17 container in CI, existing Creator reconciliation modules.

**Spec:** `docs/operations/CREATOR_FOUNDATION_FORWARD_TRANSITION_DESIGN.md`

## Global Constraints

- Emit only `creator_workspace_access_allowed(uuid)`, two pinned RPC bodies and four exact policy USING replacements.
- Verify accepted source, query, auth.uid, Daily parent and Hosted provider-role profiles; never derive expected values from a target.
- No database/provider call, workflow dispatch, APPLY mode, product-data write, runtime activation or deployment acceptance.
- Mixed/current/unknown overload-policy-role/AdminCRM/profile drift must fail closed.
- Later target observation/reference acceptance and execution are separate protected actions.

## Review Focus

- A single changed source/profile pin must block before SQL bytes are emitted.
- Already-current and mixed catalogs must not become replayable transitions.
- Unexpected overload, policy, role or AdminCRM paths must return a fixed failure code.
- Failure after each DDL step must roll back the entire catalog change.
- Stored Creator/parent rows and foreign-workspace denials must remain unchanged.

---

### Task 1: Pure generator contract

**Files:**
- Create: `scripts/operations/creator-foundation-transition-generator.mjs`
- Test: `tests/creator-foundation-transition-generator.test.mjs`

**Interfaces:**
- Consumes: accepted reconciliation source/profile constants and explicit observed-state input.
- Produces: `buildCreatorFoundationTransition(input)` returning deterministic `{sql, manifest}` or a fixed-code error.

- [ ] Write unit tests for exact output inventory and every fail-closed input class; run and observe missing-module/API failures.
- [ ] Implement pin/profile/state validation and deterministic bounded SQL generation.
- [ ] Run the focused test file to green; refactor without widening output.

### Task 2: Native PostgreSQL 17 transition proof

**Files:**
- Create: `tests/creator-foundation-transition-generator-pg17.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `buildCreatorFoundationTransition()` output and existing isolated Legacy/Current fixtures.
- Produces: native proof for exact Legacy-to-Current catalog, injected rollback at each step, unchanged rows and authorization negatives.

- [ ] Write PG17 tests and observe failure because the transition harness/artifact is not yet wired.
- [ ] Add the minimal isolated execution harness and CI registration.
- [ ] Run native tests where available and all non-native contract tests locally.

### Task 3: Canonical integration and release evidence

**Files:**
- Modify: package/test registration and relevant Creator reconciliation README/runbook.
- Modify: `project-memory/*` readers for this exact scope only.

**Interfaces:**
- Consumes: exact generator and native proof results.
- Produces: one reviewable source package with reproducible manifest and explicit next protected integration step.

- [ ] Register focused/full tests and document reproducible artifact generation without an APPLY path.
- [ ] Run Operations, Memory, drift, freshness, God Mode and diff checks.
- [ ] Commit/publish one coherent code+test+documentation head, request one independent review, process all findings, and merge only after exact-head CI is green with zero open P0/P1/P2.

