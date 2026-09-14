# FM-BILL-003 — Payment-terms setup access, 2026-09-14

Status: IN_PROGRESS. Risk: R2 for read-only setup UI; paid activation remains R4 and is not enabled by this receipt.
Branch: fix/payment-terms-setup-access-20260914.
Scope lock: LOCK-FM-BILL-003-TERMS-ACCESS-20260914, limited to the setup page's read-only terms section and its regression test. Existing financial, callback, Social and Operations work is not taken over.

## Owner instruction and boundary
The owner explicitly asks to enable payment terms after the signed-in setup page displays only the account-ready message and demo entry. Make the existing terms directly accessible from this page. This bounded change is only access to read the document, NOT acceptance of the whole request to enable paid onboarding. Do not describe it as an activated checkout, a resolved contract-version gate, or a successful payment test.

## Preflight and current evidence
Current GitHub main and root tree were re-read as 4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b and 0e5ecbaf3212f8104cac35a8a9d1a87e2e8028dc. The current project-memory tree is 5c4245d5a94eb225ce7ca46a4767c5cc78c087bd: the already-read PROTOCOL, AUTO_HANDOFF, CURRENT_STATE, FINISHLINE_STATE, NEXT_BEST_ACTION, OWNER_ACTION_INBOX, SESSION_HANDOFF, STARTED_WORK, WORK_LOCKS, OPEN_LOOPS, TASK_LEDGER, DEPENDENCIES, DECISIONS and FAILED_ATTEMPTS remain bound to that unchanged main. Canonical Source of Truth, WEB_REGISTRATION, RELEASE_ACCEPTANCE_20260910, the actual setup page and payment-terms policy were inspected. Open PRs were checked; the separate registration investigation and speculative parser patch are not merged into this branch.

A fresh read-only Production catalog query returned zero ensure_current_user_workspace functions and zero ensure_internal_daily_test_workspace functions. The existing version policy remains unresolved; merely flipping its boolean would not create the required Workspace functions or prove the payment path. The connected Stripe session exposes the FanMind Live account, not a demonstrated test context. No provider write, SQL migration, payment, account deletion or email send is performed.

## Implementation and evidence plan
Expose the existing localized payment-terms link independently of paid activation, in a separate read-only section. Preserve all existing authentication, existing-Workspace redirects, explicit package consent, version checks, provisioning and checkout gates. Open the document in another tab so the authenticated setup remains available. No acceptance timestamp or metadata is recorded by opening it.

Compile and execute the actual TSX page in the existing style of isolated Node/TypeScript/JSX fixtures. Verify terms access with activation disabled, no paid form or provisioning from this read, preserved denial of a forged submission, unchanged active package forms and anonymous redirect. Require reviewed exact-head CI and normal deployment before any live-access claim.

## Still open
Full payment-terms-version alignment, protected Workspace/consent/Billing rollout, factual tax/provider readiness, complete email callback repair and end-to-end payment acceptance. The owner already authorized the requested work; do not ask the same general permission again or recreate prices/accounts to produce activity.

## Recovery
Revert only the read-only UI/test change. No financial or database state is changed. No live deployment or completion is claimed by this starting receipt.
