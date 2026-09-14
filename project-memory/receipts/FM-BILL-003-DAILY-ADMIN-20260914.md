# FM-BILL-003 — Daily admin visibility, 14 September 2026

Status: IN_PROGRESS. Risk: R3 application/admin state; separate Production SQL remains R4. Lock: LOCK-FM-DAILY-ADMIN-20260914, holder ChatGPT, branch fix/daily-admin-visibility-20260914.

## Owner request and scope reconciliation
The owner resumes Daily activation for the intended test cohort and explicitly requests a persistent admin on/off switch. Off must remove Daily from public promotion, Landing, registration and new-package selection and reject new Daily booking attempts. Existing users, paid subscriptions, contract information, invoices, cancellation and ordinary login must not be deleted, repriced or disabled by catalog visibility. No trial cohort is created, no Play test evidence is inferred and no payment is triggered here.

This supersedes only the always-visible catalog rule in FM-DEC-014 and the older scheduling deferral for this expressly resumed work. Prices, stored legacy IDs, explicit current consent, Workspace/RLS/Tax/Stripe/webhook/ledger guards remain unchanged. The former 24-hour beta window must not expire the new admin setting or the existing testers' access. Catalog visibility and actual paid-activation readiness are distinct.

## Preflight and preserved completed work
Fresh native GitHub main is 1e011edd422d3cc7165ac3a4be221af8b8c57f56, the same pinned snapshot as the mandatory readers already read in this conversation: PROTOCOL, AUTO_HANDOFF, CURRENT_STATE, FINISHLINE_STATE, NEXT_BEST_ACTION, OWNER_ACTION_INBOX, SESSION_HANDOFF, STARTED_WORK, WORK_LOCKS, OPEN_LOOPS, TASK_LEDGER, DEPENDENCIES, DECISIONS, FAILED_ATTEMPTS. Their historical next-action/paid-deferral text is reconciled with this explicit request, not silently treated as current priority. Current tree and open PRs were re-read; #1121 and #1122 are separate and must not be overwritten. AGENTS, canonical registration, public-Daily policy, runtime settings, admin page/route and Security checklist were inspected against this snapshot. Existing installed audit 34866973595 remains successful for this exact release.

#1124 is already merged/deployed with its final receipt; do not reimplement or republish its callback fix. #1123 payment-terms switch remains on. No Stripe catalog recreation, Auth-template or URL-configuration changes, new user, user deletion, Restore, reboot, Social or Mobile changes.

## Started work / evidence plan
Completed so far: exact existing runtime/admin/catalog/readiness source inventory and current GitHub snapshot reconciliation. Existing settings already use a server-only private atomic file outside release directories; preserve that deployment-persistent boundary rather than add a database for a visibility boolean.
Still open: one runtime visibility authority across public pages and all new-admission/checkout paths, authenticated admin control, on/off/no-expiry/error/unauthorized/cache regressions, current-head CI/review and normal Production deployment. The separate missing Production Workspace/Daily SQL and complete paid test remain open; visibility never substitutes for those prerequisites.
Next: implement the bounded switch using existing routes/storage, test both directions and negative paths, publish through reviewed PR/green CI, verify the deployed revision, then owner-controlled admin and website acceptance. Do not request the same publication permission again.
Recovery: bounded application revert; preserve settings, accounts, subscriptions, Stripe objects and consent records. No automatic DB mutation or payment.
