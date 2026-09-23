# FM-CREATOR-001 — confirmed-chat controlled rollout runner — 2026-09-23

- Status: IN_PROGRESS
- Risk: R4
- Work lock: `LOCK-FM-CREATOR-CONFIRMED-CHAT-ROLLOUT-RUNNER-20260923`
- Holder: autonomous FanMind Builder
- Baseline: exact `main` `832ceac28265528c412efb36a2eca90bd2514a65`; PR #1167 is merged and its repository-only account/contact deletion-verification scope is consumed.
- Task / NBA: `FM-CREATOR-001` / `NBA-CREATOR-INTELLIGENCE`.
- Contracts / gates: `FM-CONTRACT-CREATOR-AI-001`, `FM-CONTRACT-DISCLOSURE-DELETE-001`, `FM-IGATE-CREATOR-AI-001`, `FM-IGATE-DISCLOSURE-DELETE-001`.
- Scope: repository-only controlled migration runner/checksum and target-bound read-only schema VERIFY contract for `supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql`. Pin the exact reviewed SQL artifact, reject partial/drifted schema, prove relevant ACL/RLS/function/trigger boundaries, bind target identity and reviewed checkout, and make any future APPLY structurally staging-only and impossible while the source rollout state is still `preinstall`.
- Negative boundary: no workflow dispatch, no Staging/Production SQL, no source rollout-state switch, no feature-flag activation, no provider call, no real customer/account/contact mutation, no Billing/Stripe/Tax, no Restore write and no Mobile work in this scope.
- Ordering invariant: `preinstall` source state -> reviewed later state-switch/deploy of fail-closed readers -> target-bound read-only VERIFY -> separate owner/protected-environment authorization -> controlled Staging APPLY -> independent postflight/negative authorization evidence -> separate runtime acceptance/activation. Merge alone is never activation.
- Recovery: repository revert only. A later indeterminate database apply must stop for read-only verification; never blindly retry, drop or repair schema.
- Falsifier: checksum/blob mismatch, migration contract drift, partial target state, target/ref/host/TLS/checkout mismatch, Production apply attempt, preinstall apply attempt, unexpected installed target while source is preinstall, red current-head gate, unresolved P1/P2 or blocking review thread.
- Exact next: publish one bounded PR, run the offline runner check and focused negatives through existing CI, consume exactly one required independent review per material head, fix findings on that PR, and merge only under the normal convergence rule. Do not dispatch protected VERIFY/APPLY from this repository-preparation scope.