# AI/Billing Read-only Reconciliation — 2026-08-26

## Scope and binding

- Task: `FM-AI-001`
- Exact reviewed/runtime commit: `2f8d9ca989e87ad88a76a514308618a9ce5d6fbb`
- GitHub Environment: `staging`
- Evidence mode: repository tests, protected read-only GitHub workflows and explicit read-only Supabase catalog SQL
- Forbidden and not performed: Stripe/Supabase resource mutation, payment/refund, SQL Apply, transactional lifecycle acceptance, runtime-ledger activation, Plus/Ultra activation, Production/Restore/Mobile/Security mutation
- Repository acceptance: PR #1012 passed all 10 checks at exact head `b53e000228bf99801b327c1d7b81646edce32d6f` and squash-merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`

## Current protected evidence

| Contract | Run / job | Result |
| --- | --- | --- |
| AI tier Staging resource readiness | `33003378162` / `98290675487` | `PASS`; database target, synthetic workspace, Plus/Ultra test prices and offline lifecycle contract verified; write flag false; read-only mode |
| Five-price Stripe test catalog | `33003452287` / `98290922265` | `PASS`; Test Mode, five active isolated prices and configured webhook secret; no Stripe write/payment |
| Stripe test webhook endpoint | `33003526741` / `98291186923` | `PASS`; exact Staging URL, Test Mode, enabled endpoint and exactly 22 handled events at pinned API version `2026-06-24.dahlia` |
| AI ledger Staging catalog | direct `BEGIN; SET TRANSACTION READ ONLY` query | entitlement/event/reconciliation tables and both atomic functions present; forced RLS; no browser/direct-ledger privileges; fixed search path; 0 events and 0 unresolved reconciliations |
| General Billing ledger Staging catalog | same read-only query | all four controlled ledger tables absent; control is implemented in the repository but has not been applied or activated |
| Focused local policies | 175 tests | `175/175 PASS`; AI readiness keeps Standard ready and Plus/Ultra blocked |

No secret value, Stripe object ID, provider model, customer record, prompt/reply content or private evaluation result is copied into this record.

## Gate-4 reconciliation

| Gate-4 item | Current classification | Evidence / exact limitation |
| --- | --- | --- |
| Synthetic Staging workspace with AI boundary | `VERIFIED_READ_ONLY` | Current resource run proves the dedicated workspace and two distinct principals exist and the database/Production boundary matches. It does not create or mutate a row. |
| Plus/Ultra Stripe test prices | `VERIFIED_READ_ONLY` | Current AI resource run verifies the two 100/200-EUR monthly Test Mode prices; the five-price catalog independently verifies all isolated Billing test prices. Do not create replacements. |
| Webhook endpoint/configuration | `VERIFIED_READ_ONLY` | Current endpoint check proves enabled Test Mode configuration, exact Staging URL, secret presence and the exact 22-event allowlist. Historical signed no-write smoke remains evidence for signature acceptance, not a current lifecycle mutation. |
| AI event-ledger storage/ACL | `VERIFIED_READ_ONLY` | Applied AI-specific ledger is present, empty and locked to the two service-role-only security-definer functions with forced RLS. |
| Upgrade/Downgrade/Cancellation/Failed-payment/Entitlement lifecycle | `PARTIAL` | Code and focused tests cover ordering, duplicate/stale/conflict handling, paid-item transitions and fail-closed entitlement resolution. Historical run `31735315959` rolled back successfully in legacy CRUD mode; the AI ledger was applied later by `32038152382`. No current full rollback-only Staging acceptance has exercised the applied ledger path. The separate general Billing ledger is not applied. |
| Context limits | `VERIFIED_POLICY` | The approved 50/100/150 message limits are already central, server-owned and tested. They are not an open decision and do not activate paid tiers. |
| Quality/cost/quota evidence | `PARTIAL` | Monitoring, recommendation and private-eval validators exist. Binding model/fallback, request/token quota and usage enforcement decisions plus four representative weeks and a real blinded private evaluation remain absent. |
| No live payment | `VERIFIED_NEGATIVE` | All current checks are Test Mode/read-only; no Checkout, charge, refund or subscription mutation occurred. |

## True remaining work

1. `FM-AI-OWNER-001`: approve the remaining product/financial matrix without changing the already accepted 50/100/150 context limits: model classes and distinct fallbacks, request/token quotas, 80/100-percent behavior, Overage, upgrade/downgrade/cancellation/proration/refund and cost/margin.
2. Produce the private blinded quality result and representative usage/cost evidence required by the existing validators; do not store source prompts, replies, reviewer identities or provider-model mapping in Git.
3. The observation-time Stripe conformance gap is now repository-closed by FM-CR-009: PR #1035 final head `ffdc11ab4a1c199134dc009abc516cc8257f5e8b` passed all exact-head gates and merged as `9a7b37f2cee798dc64c1d32f70fda338db174b5e`. The correction uses SDK `22.4.0` and outbound `2026-07-29.dahlia` while deliberately retaining the observed older inbound endpoint as a separate provider-side migration gate. This completion never grants permission to change provider resources.
4. `FM-AI-OWNER-002`: separately authorize and execute the controlled general Billing ledger Staging sequence, including write freeze, SQL Apply/postflight, capture-only cutover, canonical reconciliation and downstream AI/referral reconciliation. Do not enable projection until all cutover counters and conflicts are zero.
5. After the ledger/cutover state is ready, separately authorize exactly one current rollback-only AI lifecycle acceptance through the applied ledger path, covering Plus, Ultra, removal/fallback, cancellation/paused/failed-payment consequences, browser denial, idempotency/order conflict and complete rollback.
6. Obtain Legal/Tax acceptance. Automatic Tax remains fail-closed unless the actual registration is explicitly confirmed.
7. Only after all preceding tier-specific evidence: integrate runtime models/quotas server-side and make a separate explicit Production activation decision. A merge, Test price or environment value alone must never activate Plus/Ultra.

## Gate result

`FM-AI-001` remains `PARTIAL`. The old claims that the synthetic Staging resource or Plus/Ultra Test prices are missing are superseded, and the productive Stripe code-conformance correction is accepted under FM-CR-009. Provider-side inbound webhook migration remains separate. The genuine blockers are current post-ledger lifecycle acceptance, unapplied general Billing ledger/cutover, product/quality/cost evidence, provider-side webhook migration, Legal/Tax, runtime integration and explicit Production activation.
