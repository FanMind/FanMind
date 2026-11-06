# AI/Billing Read-only Reconciliation — 2026-08-26

## Scope and binding

- Task: `FM-AI-001`
- Exact reviewed/runtime commit: `2f8d9ca989e87ad88a76a514308618a9ce5d6fbb`
- GitHub Environment: `staging`
- Evidence mode: repository tests, protected read-only GitHub workflows and explicit read-only Supabase catalog SQL
- Forbidden and not performed: Stripe/Supabase resource mutation, payment/refund, SQL Apply, transactional lifecycle acceptance, runtime-ledger activation, Plus/Ultra activation, Production/Restore/Mobile/Security mutation
- Repository acceptance: PR #1012 passed all 10 checks at exact head `b53e000228bf99801b327c1d7b81646edce32d6f` and squash-merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`
- Historical-snapshot rule: every statement below about the general Billing ledger being absent/unapplied describes only the exact 2026-08-26 observation. It is superseded for current-state planning by the 2026-09-06 evidence recorded in `FM-EV-035` / `FM-AI-001-CANONICAL-BILLING-STAGING-ACCEPTED-20260906.md`: general Billing Apply `34040107219`, durable capture `34043010578`, unfreeze `34043148548`, exact isolated-Staging deploy `34058028839`, and rollback-only canonical Billing acceptance `34058118450` / job `101553652111`. Do not repeat the completed ledger/canonical-acceptance sub-gate from this historical document.

## Current protected evidence at the 2026-08-26 observation

| Contract | Run / job | Result |
| --- | --- | --- |
| AI tier Staging resource readiness | `33003378162` / `98290675487` | `PASS`; database target, synthetic workspace, Plus/Ultra test prices and offline lifecycle contract verified; write flag false; read-only mode |
| Five-price Stripe test catalog | `33003452287` / `98290922265` | `PASS`; Test Mode, five active isolated prices and configured webhook secret; no Stripe write/payment |
| Stripe test webhook endpoint | `33003526741` / `98291186923` | `PASS`; exact Staging URL, Test Mode, enabled endpoint and exactly 22 handled events at pinned API version `2026-06-24.dahlia` |
| AI ledger Staging catalog | direct `BEGIN; SET TRANSACTION READ ONLY` query | entitlement/event/reconciliation tables and both atomic functions present; forced RLS; no browser/direct-ledger privileges; fixed search path; 0 events and 0 unresolved reconciliations |
| General Billing ledger Staging catalog | same read-only query | **Historical pre-state only:** all four controlled ledger tables were absent at this observation. Superseded by the accepted 2026-09-06 installation/capture/canonical rollback evidence above. |
| Focused local policies | 175 tests | `175/175 PASS`; AI readiness keeps Standard ready and Plus/Ultra blocked |

No secret value, Stripe object ID, provider model, customer record, prompt/reply content or private evaluation result is copied into this record.

## Gate-4 reconciliation

| Gate-4 item | Current classification | Evidence / exact limitation |
| --- | --- | --- |
| Synthetic Staging workspace with AI boundary | `VERIFIED_READ_ONLY` | Current resource run proves the dedicated workspace and two distinct principals exist and the database/Production boundary matches. It does not create or mutate a row. |
| Plus/Ultra Stripe test prices | `VERIFIED_READ_ONLY` | Current AI resource run verifies the two 100/200-EUR monthly Test Mode prices; the five-price catalog independently verifies all isolated Billing test prices. Do not create replacements. |
| Webhook endpoint/configuration | `VERIFIED_READ_ONLY` | Current endpoint check proves enabled Test Mode configuration, exact Staging URL, secret presence and the exact 22-event allowlist. Historical signed no-write smoke remains evidence for signature acceptance, not a current lifecycle mutation. |
| AI event-ledger storage/ACL | `VERIFIED_READ_ONLY` | Applied AI-specific ledger is present, empty and locked to the two service-role-only security-definer functions with forced RLS. |
| General Billing ledger/canonical Staging sub-gate | `ACCEPTED_BOUNDED` | Superseding 2026-09-06 evidence proves installed general Billing ledger, durable capture and exact isolated-Staging canonical rollback acceptance. Deploy `34058028839` and acceptance `34058118450` / `101553652111` returned rollout `PASS`, ledger `verify`, cutover pending `0`, uninventoried `0`, full rollback and cleanup `PASS`. This does not prove the remaining provider-side AI lifecycle or Production activation. |
| Upgrade/Downgrade/Cancellation/Failed-payment/Entitlement lifecycle | `PARTIAL` | Code and focused tests cover ordering, duplicate/stale/conflict handling, paid-item transitions and fail-closed entitlement resolution. The bounded canonical Billing fixture is accepted, but remaining provider-side inbound webhook/current lifecycle and downstream AI/referral reconciliation evidence through the installed ledgers is still open. |
| Context limits | `VERIFIED_POLICY` | The approved 50/100/150 message limits are already central, server-owned and tested. They are not an open decision and do not activate paid tiers. |
| Quality/cost/quota evidence | `PARTIAL` | Monitoring, recommendation and private-eval validators exist. Binding model/fallback, request/token quota and usage enforcement decisions plus four representative weeks and a real blinded private evaluation remain absent. |
| No live payment | `VERIFIED_NEGATIVE` | The accepted Staging work remained Test Mode/rollback-only; no real Checkout, charge, refund or Production subscription mutation is accepted by this record. |

## True remaining work after the 2026-09-06 superseding evidence

1. `FM-AI-OWNER-001`: approve the remaining product/financial matrix without changing the already accepted 50/100/150 context limits: model classes and distinct fallbacks, request/token quotas, 80/100-percent behavior, Overage, upgrade/downgrade/cancellation/proration/refund and cost/margin.
2. Produce the private blinded quality result and representative usage/cost evidence required by the existing validators; do not store source prompts, replies, reviewer identities or provider-model mapping in Git.
3. The observation-time Stripe conformance gap is repository-closed by FM-CR-009: PR #1035 final head `ffdc11ab4a1c199134dc009abc516cc8257f5e8b` passed all exact-head gates and merged as `9a7b37f2cee798dc64c1d32f70fda338db174b5e`. The correction uses SDK `22.4.0` and outbound `2026-07-29.dahlia` while deliberately retaining the observed older inbound endpoint as a separate provider-side migration gate. This completion never grants permission to change provider resources.
4. Do **not** repeat the completed write-freeze/general-Billing-Apply/capture/canonical-rollback sequence. Under the narrowed `FM-AI-OWNER-002`, separately authorize only the remaining provider-side inbound webhook/current lifecycle and downstream AI/referral reconciliation evidence through the installed ledgers, with Test Mode and rollback/fail-closed controls as applicable.
5. Obtain Legal/Tax acceptance. Automatic Tax remains fail-closed unless the actual registration is explicitly confirmed.
6. Only after all preceding tier-specific evidence: integrate runtime models/quotas server-side and make a separate explicit Production activation decision. A merge, Test price, Staging acceptance or environment value alone must never activate Plus/Ultra or canonical Production projection.

## Gate result

`FM-AI-001` remains `PARTIAL`. This document is an immutable 2026-08-26 read-only snapshot whose old `general Billing ledger absent/unapplied` statement is explicitly superseded by the accepted 2026-09-06 Billing installation/capture/canonical rollback evidence. The bounded technical Staging sub-gate is complete and must not be repeated. Genuine blockers remain product/private quality-cost evidence, provider-side inbound webhook/current lifecycle/downstream reconciliation, Legal/Tax, Production runtime integration and explicit activation; Plus/Ultra and canonical Production projection stay fail-closed.