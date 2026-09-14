# FM-REG-002 / FM-BILL-003 — owner-authorized registration publication

Status: IN_PROGRESS. Risk: R3 source authentication correction; any separate Production schema activation remains R4. Scope lock: LOCK-FM-REG-002-PUBLISH-20260914, holder ChatGPT, retained on the existing registration branch. Existing speculative parser changes are superseded, not merged as a fix.

## Preflight / authorization
Owner explicitly requests publishing the corrections so the owner can run the real website test. Existing FM-AUTH-REGISTRATION-PUBLISH-20260910 and FM-AUTH-PAID-ACTIVATION-20260910 remain applicable. Preserve configured Stripe, all actual accounts, prices, explicit terms consent and payment gates. Do not start payments or invent external legal/tax acceptance.

Fresh main 3067fc248c7c0b0f12985852610a320fdb39d88d and tree f4fa734856fe8ece92d0e8cfd5aab41beac24d67 are the published switch release. Fresh project-memory tree 0c0603e052409f1ab1358e5e1177a5d29f8688e0 binds the unchanged mandatory readers already read in this conversation: PROTOCOL, AUTO_HANDOFF, CURRENT_STATE, FINISHLINE_STATE, NEXT_BEST_ACTION, OWNER_ACTION_INBOX, SESSION_HANDOFF, STARTED_WORK, WORK_LOCKS, OPEN_LOOPS, TASK_LEDGER, DEPENDENCIES, DECISIONS, FAILED_ATTEMPTS. AGENTS and canonical registration/Daily/Workspace/security sources remain bound to the same unchanged source snapshot. Do not restart Creator/Social/Restore work or repeat the switch release. Original branch head was freshly read as 7665c66ddb0b8f64e74951f112e769a690e13170. This reconciliation preserves its historical receipts while taking application source from current main.

## New falsifiable source evidence
Upstream supabase/auth internal/tokens/service.go blob 6cf445cf119011a036cf8e3166329918aa91cceb explicitly appends the empty sb marker to implicit redirects. FanMind main readWebRegistrationSession rejects that marker as an unknown field. Reproduce using the provider-shaped fragment against the exact main module, then allow only a single empty sb marker; keep type=signup, bearer, duplicate/error/query/size and token checks intact. This proves a concrete compatibility defect; without a captured sanitized callback it does not establish the sole cause of every previous browser failure.

## Started work and evidence plan
Completed so far: exact source/provider contract comparison and retained Production confirmations; user is not asked to repeat account creation or screenshots.
Still open: focused source correction, automatic verified-session continuation, Daily presentation/readiness, independent review, current-head CI, normal release and exact-runtime countercheck. Production Workspace/Daily schema prerequisites remain separately open and must not be bypassed by merely showing Daily.
Next: reproduce the sb incompatibility, implement the bounded correction and tests, review and publish through this branch/PR. Retain confirmed-account resend privacy. No broadening to recovery/magiclink or missing type; no credentials in diagnostics, storage, git or public logs.
Owner action needed: real browser acceptance only after verified publication; no repeated publication permission.
Recovery: bounded application revert, preserving accounts, Stripe and stored contracts. State-changing schema work needs its own reviewed exact target transaction and independent pre/postflight.
