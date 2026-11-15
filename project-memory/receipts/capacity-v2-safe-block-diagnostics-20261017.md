# Capacity v2 safe BLOCK diagnostics — source handoff

FM-AI-001 / FM-CR-052; 17 October 2026. Base main
3fcf7c31e8b6d978e35c8920e1c3cddefeff4d2e. No competing open PR or active
Capacity diagnostics Builder was found. Same task/lock; no new queue.

## Problem and change

Run39022404980 ended BLOCK after offline/main/password setup passed; its actual
Staging cause is UNKNOWN. This source increment is instrumentation, not a repair
of an assumed database/network problem. Keep that failed evidence unchanged.

Only the existing shared runner adds private WeakMap-backed diagnostic records,
fixed control-point Stage/Reason codes and a hardcoded, filtered baseline-field
allowlist. Unknown/forged errors cannot self-declare a diagnostic. psql2 means
failed/lost connection only; psql3 means script failure only. No stderr parsing,
dynamic SQLSTATE, error text/stack, output values or customer data is rendered.
All BLOCK cases remain exit1. Match remains the original one-line enum.

Runbook documents the exact codes and limits. Existing integration manifest
refreshes only runner/test pins. Workflow, emitter, preflight SQL, three lifecycle
SQL inputs, original28 preparation tests, preparation manifest/expected policy and
monetary/schema baseline, recovery, CA, target, TLS, passfile transport, read-only
transaction, ROLLBACK and resource limits are unchanged against base main.

## Builder verification

Implementation9b301a15cdb9a0b6f58de57ee9dd85ed953717b6:43 integration tests,
20 existing shared regressions,1 required-suite inventory =64/64 passed,0failed,
0skipped. Includes every fixed stage, unclassified/forged exceptions, malformed/
missing/null/extra/secret-bearing responses, exact baseline-field allowlist output,
client exits/signals/timeout/output bounds, cleanup and unchanged read-only stdin.
A wrongSha test initially expected a later emitter guard; corrected only that
expectation to the actual earlier environment rejection. No guard was changed.
Targeted ESLint, offline controls/hash verification, memory quality, drift,
next-action/v8 checks, God Mode preflight/release-decision check and diff-check pass.
Native SQL bytes were not changed or unnecessarily rerun locally; required fresh
CI on the final published head runs the existing full native PG17 Capacity path.
Final head/check-run bindings are recorded in the existing PR metadata to avoid
self-referential receipt commits. Pending CI is not claimed as passed here.

## Independent evidence

Separate reviewer capacity_countercheck examined exact implementation9b301a15:
PASS, no open findings. Independently ran43/43 integration tests,0fail/skip.
Adversarial renderer checks also covered hostile/revoked proxies, Symbol,BigInt,
undefined and frozen diagnostic/field records. Verified unchanged protected bytes,
manifest-only runner/test refresh, conservative classification and no writes.
Required CI and final exact-head review remain separately bound in PR metadata.

## Scope, risk and next protected action

No workflow dispatch/retry, Staging/Production query or write, SQL apply, deploy,
provider/Stripe/Billing call, customer migration, Finishline or D3 work occurred.
Actual old BLOCK cause is still unresolved. Coarse categories deliberately do not
identify TLS versus credentials or ACL versus missing schema; UNKNOWN is valid.
All acceptance/source/target gates stay fail-closed. Source recovery is a reviewed
revert; no database rollback action is introduced or needed by instrumentation.

Draft PR only; no merge authorization inferred. After reviewed merge, determine
actual main and controller/integration-manifest/query/recovery hashes, exact
Staging target and existing recovery contract. A new exact Owner/protected approval
is mandatory before one bounded read-only diagnostic run through the SAME existing
workflow. No raw-output debug flag, alternate transport, automatic repair or retry.
