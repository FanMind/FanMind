# FanMind Do Not Assume

These are facts that may drift or must be revalidated before action. They are not permanent project truth.

## Runtime and infrastructure
- Do not assume the current Production commit; verify it.
- Do not assume runner availability, runner identity, runner-group policy or environment approvals from an old chat/session; verify current GitHub state.
- Do not assume an external account, provider approval, Meta permission, Stripe state, EAS state or Supabase target is unchanged; verify before relying on it.
- Do not assume a failed workflow is safely retryable when the previous attempt may have produced an indeterminate external mutation.
- Do not assume a successful implementation is accepted on a real device/staging/production target without evidence.

## Restore-specific
- Do not assume the restore host/database target must be rebuilt because a later step failed.
- Do not assume labels prove runner authorization.
- Do not assume database-only success equals a complete restore drill.

## Working rule
When a planned action depends on a drift-prone fact, record the revalidation result in `EVIDENCE.md`, `ASSUMPTIONS.md`, `CURRENT_STATE.md` or the related task before proceeding.
