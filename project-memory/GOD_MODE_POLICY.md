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

`ALLOW` is permitted only when all applicable conditions are current and bound to the evaluated release SHA and target:

1. all required system invariants are `ENFORCED`;
2. every integration gate mapped by `IMPACT_MAP.json` from an affected contract is `VERIFIED`, regardless of a manually stored applicability flag; additionally any explicitly applicable gate must be `VERIFIED`;
3. the affected-contract scope is explicit and non-empty, all affected contracts are active, their consumers were revalidated, and the declared risk is not below the highest `minimum_risk` of those contracts;
4. no P0/P1/P2 finding, unresolved review thread, pending required check, failed/red required check or reconciliation flag remains;
5. evidence quorum is derived from current evidence records explicitly bound to the evaluated release SHA and target, with mutable evidence checked against `EVIDENCE_TTL_POLICY.json`; expiry blocks even when the release SHA and target have not changed;
6. R2 requires distinct implementation and independent countercheck evidence plus a relevant negative-path proof; R3/R4 retain that quorum, require at least two independent evidence classes and additionally require recovery evidence. Negative and recovery proof must be separately typed and distinct;
7. every mandatory integration gate must have qualifying current evidence explicitly bound to that exact gate. A registry status of `VERIFIED` alone is not release evidence;
8. dependencies are satisfied;
9. `blocking_reasons` is a present empty list; a retained blocker can never coexist with `ALLOW`;
10. all release input fields use their exact JSON types. Booleans cannot substitute for integer finding counts and integers cannot substitute for booleans;
11. contract, integration-gate, evidence and impact-map identities are unambiguous; duplicate mappings or duplicate IDs fail closed;
12. there is no protected action still requiring a distinct owner/environment approval.

The checked-in `RELEASE_DECISION.json` is a conservative baseline snapshot and may remain `BLOCK`. A future `ALLOW`/`OWNER_REQUIRED` evaluation must supply an exact runtime snapshot (`--snapshot-file`) plus the independently observed release SHA (`--release-sha` or `FANMIND_RELEASE_SHA`) and explicit release target. The evaluated release SHA is deliberately distinct from the commit that contains the God Mode control-plane code; this prevents a self-referential requirement for a checked-in evidence registry to contain its own resulting commit hash.

Current target/runtime evidence may be supplied separately through `--evidence-file`. Such an evidence snapshot must itself come from the authenticated/controlled execution path appropriate to the target. The release evaluator does not turn a locally edited evidence file into acceptance; it merely validates the supplied records fail-closed against the release SHA, target, evidence class, TTL, role, gate binding, status and invalidation/supersession state. The checked-in evidence registry remains the default only when it actually contains qualifying current evidence.

Self-asserted booleans such as “fresh” or “current-head-bound” are not sufficient to produce `ALLOW`. The evaluator cross-checks evidence IDs, exact release SHA, target, evidence state, TTL, typed role, gate binding, invalidation/supersession markers, mapped gates and contract risk floors. Omitted or malformed `protected_action_required` is `BLOCK`; `true` produces `OWNER_REQUIRED` only after every technical requirement is otherwise satisfied.

If the evidence is invalid, missing, stale, contradictory or structurally incomplete, the result is `BLOCK`. If the technical quorum is otherwise valid but the next action is protected by an explicit owner/environment boundary, the result is `OWNER_REQUIRED`.

## Contracts and integration gates

Technical interfaces are registered as stable `FM-CONTRACT-*` records. Real module boundaries are registered as `FM-IGATE-*` records. Contract/schema/API/AI-context/Billing/disclosure/Social changes trigger consumer-impact analysis and revalidation through `IMPACT_MAP.json`.

Each contract declares a conservative `minimum_risk`. The release decision may raise risk but may not lower it below the highest affected contract floor. An affected contract also makes every gate mapped from that contract mandatory for the evaluated release, even when a stale/manual `applicable=false` value exists. An empty affected-contract scope can never be used to obtain `ALLOW` or `OWNER_REQUIRED`.

A module passing its own tests does not make an integration gate green. Integration evidence must execute the actual affected boundary or a faithful synthetic equivalent, be current under its evidence-class TTL, and identify the exact gate it proves. Duplicate contract mappings are ambiguous and therefore block instead of being resolved by file order.

## Evidence roles and freshness

Evidence roles are authoritative release semantics, not descriptive labels. Qualifying runtime evidence declares one or more roles such as `implementation`, `countercheck`, `negative` and `recovery`, and declares the integration gate or gates it actually proves.

- R1 requires relevant evidence.
- R2 requires implementation evidence, a distinct independent countercheck, and a relevant negative-path proof.
- R3/R4 require the R2 roles plus recovery proof and at least two independent evidence classes.
- A single generic record cannot serve as both the implementation and independent countercheck.
- The same evidence ID cannot satisfy both negative and recovery proof for R3/R4.
- Mutable evidence is accepted only while its `observed_at` remains within the configured TTL for its class; malformed/future timestamps and unknown evidence classes block.
- Immutable evidence does not expire merely with time but remains subject to its explicit invalidation/revalidation triggers.

## Adversarial gate

For substantive R2+ changes, the independent countercheck actively searches for at least the relevant break paths:

- tenant/workspace leak;
- authority escalation or browser service-role use;
- race/TOCTOU and stale revision;
- partial schema or orphan data;
- wrong target;
- idempotency/retry defects;
- rollback/recovery failure;
- cross-module contract drift;
- stale or expired evidence/current-release mismatch;
- retained blocker with otherwise clean summary fields;
- hidden P0 or failed-required-check state;
- risk downgrading or integration-gate applicability bypass;
- empty affected scope;
- duplicate impact mappings;
- malformed JSON type substitution;
- untyped or reused proof-role evidence;
- a `VERIFIED` gate without current evidence for that exact gate.

For R3/R4, at least one applicable negative or mutation-style proof must demonstrate that intentionally broken protection turns red when technically bounded and safe to do so.

## Synthetic golden flows

The registry includes these synthetic flows as reusable governance targets:

- CRM core: Login -> Contact -> Conversation -> AI Reply -> Copy -> Follow-up -> Disclosure.
- ChatAdmin manual v1: authorized owner -> character -> pasted fan message -> exactly three suggestions -> copy/manual-send handoff.

They are acceptance evidence only when the actually affected layer is executed. Static comments, mocked success strings and implementation-only output are not acceptance.

## Post-merge guardian

After merge/deploy, the guardian revalidates the exact release SHA/target, health/runtime when applicable, unexpected feature-flag/schema/target drift, affected invariants/contracts/integration gates and whether prior ACCEPTED evidence became stale or expired. Any mismatch becomes `RECONCILIATION_REQUIRED`; no new feature work should build on that state.

A God Mode documentation/governance merge is not, by itself, new runtime/provider/Staging evidence and must not trigger self-generated revalidation of an unchanged external blocker.

## Protected actions

God Mode never collapses an owner/environment boundary. Even an `ALLOW` decision does not itself execute or authorize a protected Staging/Production APPLY/ACCEPT/write, capability grant, Billing/Stripe/Tax activation, provider secret/configuration change, Restore write or destructive action.
