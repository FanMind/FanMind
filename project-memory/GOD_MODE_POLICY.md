# FanMind God Mode v1

Task: `FM-GOV-GODMODE-001`  
Risk: R3 repository-governance control plane.  
Scope: repository-only. This policy never authorizes Staging/Production writes, DB migrations, capability grants, provider activation, Billing/Stripe/Tax changes, Restore writes, destructive actions or Mobile activation.

## Core rule

God Mode is a fail-closed release and integration control layer on top of the existing FanMind Project Memory. It extends `TASK_LEDGER.md`, `DEPENDENCIES.md`, `QUALITY_CONTROL.md` and `COUNTERCHECK_POLICY.md`; it does not create a second task system.

Mandatory semantics:

- uncertainty = STOP;
- unknown != success;
- missing evidence != success;
- green CI != Production acceptance;
- merge != activation;
- local module success != integration success;
- old evidence != current evidence.

`RELEASE_DECISION.json` may contain only `ALLOW`, `BLOCK` or `OWNER_REQUIRED`. A passing God Mode CI gate proves the governance controls are structurally valid and fail closed; it does not itself authorize a runtime release or protected action.

## Release decision

`ALLOW` is permitted only when all applicable conditions are current and bound to the evaluated release SHA and target:

1. every required system invariant is `ENFORCED` and has qualifying current commit/target-bound evidence;
2. every integration gate mapped by `IMPACT_MAP.json` from an affected contract is `VERIFIED`, regardless of a stored applicability flag; every explicitly applicable gate is also mandatory;
3. the affected-contract scope is explicit, non-empty and covers every authoritative entry in `CONTRACT_REGISTRY.json`; changing a contract status must never make it disappear from the evaluated scope;
4. every affected contract is `ACTIVE`, its consumers were revalidated and the declared risk is not below the highest contract `minimum_risk`;
5. no P0/P1/P2 finding, unresolved review thread, pending required check, failed/red required check or reconciliation flag remains;
6. evidence is authenticated by the protected evidence producer, bound to the exact release SHA, target and current God Mode control-plane fingerprint, and checked against `EVIDENCE_TTL_POLICY.json`;
7. every `revalidate_on` trigger declared by an evidence class has a current producer-signed trigger fingerprint and the evidence record carries the same fingerprint; missing or changed trigger state invalidates that evidence;
8. R2 requires distinct implementation evidence, an independent countercheck and a relevant negative-path proof; R3/R4 retain those roles, require recovery proof and at least two evidence classes whose contributing provenance is actually independent;
9. negative and recovery proof are separately typed and distinct globally and for each mandatory integration gate;
10. every mandatory integration gate has qualifying current evidence explicitly bound to that exact gate. A registry status of `VERIFIED` alone is not release evidence;
11. dependencies are satisfied and `blocking_reasons` is a present empty list;
12. all release input fields use exact JSON types; booleans cannot masquerade as finding counts and integers cannot masquerade as booleans;
13. contract, integration-gate, invariant, evidence and impact-map identities are unambiguous; duplicates fail closed;
14. protected-action status is derived from the authoritative operation/target policy. A candidate-provided `protected_action_required` field may only agree with the derived result; it cannot downgrade a protected action.

The checked-in `RELEASE_DECISION.json` is a conservative baseline and may remain `BLOCK`. A missing target, operation, evidence attestation or protected evidence key therefore keeps the baseline fail-closed and is not an invitation to fabricate evidence.

## Protected evidence producer

A non-`BLOCK` decision requires a short-lived signed evidence attestation from the controlled producer contract `fanmind-protected-evidence-producer-v1`.

The attestation binds:

- exact release SHA;
- exact release target;
- current God Mode control-plane fingerprint;
- issue and expiry timestamps with a maximum two-hour lifetime;
- current revalidation-trigger fingerprints;
- the exact evidence records used by the decision.

The signature is HMAC-SHA256 with a minimum 32-byte key available only to the protected producer execution. The key must never be committed, logged, pasted into chat or exposed to ordinary pull-request CI. The normal `FanMind God Mode Gate` does not request that secret. A contributor-controlled repository file, local evidence JSON or ordinary PR run therefore cannot manufacture `ALLOW` merely by making its own SHA/evidence internally consistent.

The evaluator accepts an attestation only from `--attestation-file` or `FANMIND_GOD_MODE_ATTESTATION_FILE`, with the verification key supplied separately through `FANMIND_GOD_MODE_ATTESTATION_KEY`. The repository's ordinary `EVIDENCE_FRESHNESS.json` remains durable project history/freshness metadata; it is not by itself trusted release authority for a non-`BLOCK` result.

Changing any control-plane file changes the control-plane fingerprint and invalidates an older attestation. This includes the release evaluator itself, its wrapper, the God Mode workflow, preflight, policy, invariant/contract/gate/impact registries and TTL policy.

## Contracts and integration gates

Technical interfaces are stable `FM-CONTRACT-*` records. Real module boundaries are `FM-IGATE-*` records. Contract/schema/API/AI-context/Billing/disclosure/Social changes trigger consumer-impact analysis through `IMPACT_MAP.json`.

Every contract registry entry remains part of the authoritative release scope until the registry itself is deliberately reconciled through reviewed governance. A status such as `VERIFIED`, `BLOCKED` or an unknown value never silently removes a contract from scope; a non-`ACTIVE` affected contract blocks.

A module passing its own tests does not make an integration gate green. Integration evidence must execute the affected boundary or a faithful synthetic equivalent, identify the exact gate and satisfy the configured gate roles. If a gate deliberately configures roles stronger than the risk-default quorum, those stronger roles are mandatory rather than discarded.

## Evidence roles, provenance and freshness

Evidence roles are authoritative release semantics, not descriptive labels. Qualifying evidence declares roles such as `implementation`, `countercheck`, `negative`, `recovery` or an explicitly stronger gate role, and identifies the gates and invariants it proves.

- R1 requires relevant evidence.
- R2 requires implementation, independent countercheck and negative proof.
- R3/R4 require the R2 roles plus recovery proof and at least two independent evidence classes.
- Independence requires different source, execution ID and independence key; different class labels alone are not independence.
- A single generic record cannot serve as both implementation and independent countercheck.
- Negative and recovery proof must use distinct evidence IDs for each gate that requires both roles.
- Every required invariant needs current evidence explicitly naming that invariant.
- Mutable evidence is accepted only within its TTL.
- Immutable evidence does not expire by age alone, but every declared revalidation trigger is still consumed. A missing/currently different trigger fingerprint blocks.
- Invalidated or superseded evidence never counts.

## Protected action derivation

Repository-only operations may be unprotected only when both the operation and target are repository-scoped. Known Staging, Production, database, provider, Billing, Restore, capability-grant and destructive operations are protected. Unknown operations or mismatched target/operation pairs fail closed.

For technically complete protected work, the result is `OWNER_REQUIRED`, never `ALLOW`. A supplied `protected_action_required=false` cannot override an operation/target that the policy derives as protected.

## Adversarial gate

For substantive R2+ work, the independent countercheck actively searches for relevant break paths including:

- tenant/workspace leak;
- authority escalation or browser service-role use;
- race/TOCTOU and stale revision;
- partial schema/orphan data;
- wrong target;
- idempotency/retry defects;
- rollback/recovery failure;
- cross-module contract drift;
- stale/expired evidence or release mismatch;
- changed provider/config/signing/credential state covered by TTL revalidation triggers;
- retained blocker with otherwise clean summary fields;
- hidden P0/P1/P2 or failed required check;
- risk downgrade or gate applicability bypass;
- contract-scope disappearance through status manipulation;
- duplicate mappings/IDs or malformed JSON type substitution;
- reused negative/recovery proof;
- two class labels backed by non-independent provenance;
- `VERIFIED` invariant/gate status without exact bound evidence;
- self-declared unprotected Staging/Production action;
- unsigned, expired, tampered or wrong-control-plane release attestation.

For R3/R4, at least one applicable negative/mutation-style proof must demonstrate that intentionally broken protection turns red when technically bounded and safe.

## Synthetic golden flows

The registry retains these reusable governance targets:

- CRM core: Login -> Contact -> Conversation -> AI Reply -> Copy -> Follow-up -> Disclosure.
- ChatAdmin manual v1: authorized owner -> character -> pasted fan message -> exactly three suggestions -> copy/manual-send handoff.

They are acceptance evidence only when the actually affected layer is executed. Static comments, mocked success strings and implementation-only output are not acceptance.

## Post-merge guardian

After merge/deploy, the guardian revalidates the exact release SHA/target, health/runtime when applicable, unexpected feature-flag/schema/target drift, trigger fingerprints, affected invariants/contracts/integration gates and evidence TTL. Any mismatch becomes `RECONCILIATION_REQUIRED`; no new feature work should build on that state.

A God Mode documentation/governance merge is not itself new runtime/provider/Staging evidence and must not trigger self-generated revalidation of an unchanged external blocker.

## Protected actions

God Mode never collapses an owner/environment boundary. Even a repository-scoped `ALLOW` does not execute or authorize a protected Staging/Production APPLY/ACCEPT/write, capability grant, Billing/Stripe/Tax activation, provider secret/configuration change, Restore write or destructive action.