# FanMind God Mode v1

Task: `FM-GOV-GODMODE-001`  
Risk: R3 repository-governance control plane.  
Scope: repository-only. This policy never authorizes Staging/Production writes, DB migrations, capability grants, provider activation, Billing/Stripe/Tax changes, Restore writes, destructive actions or Mobile activation.

## Core rule

God Mode is a fail-closed release and integration control layer on top of the existing FanMind Project Memory. It extends `TASK_LEDGER.md`, `DEPENDENCIES.md`, `QUALITY_CONTROL.md` and `COUNTERCHECK_POLICY.md`; it does not create a second task system.

The mandatory semantics are:

- uncertainty = STOP;
- unknown != success;
- missing evidence != success;
- green CI != Production acceptance;
- merge != activation;
- local module success != integration success;
- old evidence != current evidence.

`RELEASE_DECISION.json` may contain only `ALLOW`, `BLOCK` or `OWNER_REQUIRED`. A passing God Mode CI gate proves only that the governance controls are structurally valid and fail closed. It does not mean a product/runtime release is allowed.

## Release decision

`ALLOW` is permitted only when all applicable conditions are current and bound to the evaluated head/target:

1. all required system invariants are `ENFORCED`;
2. all applicable integration gates are `VERIFIED`;
3. all affected contracts are active and their consumers were revalidated;
4. no P1/P2 finding, unresolved review thread, pending/red required check or reconciliation flag remains;
5. evidence quorum is complete and current-head-bound;
6. dependencies are satisfied;
7. R3/R4 state-changing scopes have negative/fail-closed evidence and rollback/recovery evidence;
8. there is no protected action still requiring a distinct owner/environment approval.

If the evidence is invalid, missing, stale, contradictory or structurally incomplete, the result is `BLOCK`. If the technical quorum is otherwise valid but the next action is protected by an explicit owner/environment boundary, the result is `OWNER_REQUIRED`.

## Contracts and integration gates

Technical interfaces are registered as stable `FM-CONTRACT-*` records. Real module boundaries are registered as `FM-IGATE-*` records. Contract/schema/API/AI-context/Billing/disclosure/Social changes trigger consumer-impact analysis and revalidation through `IMPACT_MAP.json`.

A module passing its own tests does not make an integration gate green. Integration evidence must execute the actual affected boundary or a faithful synthetic equivalent.

## Adversarial gate

For substantive R2+ changes, the independent countercheck actively searches for at least the relevant break paths:

- tenant/workspace leak;
- authority escalation or browser service-role use;
- race/TOCTOU and stale revision;
- partial schema or orphan data;
- wrong target;
- idempotency/retry defects;
- rollback/recovery failure;
- cross-module contract drift.

For R3/R4, at least one applicable negative or mutation-style proof must demonstrate that intentionally broken protection turns red when technically bounded and safe to do so.

## Synthetic golden flows

The registry includes these synthetic flows as reusable governance targets:

- CRM core: Login -> Contact -> Conversation -> AI Reply -> Copy -> Follow-up -> Disclosure.
- ChatAdmin manual v1: authorized owner -> character -> pasted fan message -> exactly three suggestions -> copy/manual-send handoff.

They are acceptance evidence only when the actually affected layer is executed. Static comments, mocked success strings and implementation-only output are not acceptance.

## Post-merge guardian

After merge/deploy, the guardian revalidates the exact commit/target, health/runtime when applicable, unexpected feature-flag/schema/target drift, affected invariants/contracts/integration gates and whether prior ACCEPTED evidence became stale. Any mismatch becomes `RECONCILIATION_REQUIRED`; no new feature work should build on that state.

## Protected actions

God Mode never collapses an owner/environment boundary. Even an `ALLOW` decision does not itself execute or authorize a protected Staging/Production APPLY/ACCEPT/write, capability grant, Billing/Stripe/Tax activation, provider secret/configuration change, Restore write or destructive action.
