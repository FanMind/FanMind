# Support Production Owner and activation control

Scope: Issue #1350. Production schema is already installed and accepted by PR #1418. Do not reinstall it. The Owner explicitly selected Production and then authorized Owner assignment and activation; the exact account was provided privately. No real account identifier belongs in this document.

## Independent operations

Use `FanMind Support Production Control` on reviewed protected main, existing production environment and existing production runner. It shares the deployment concurrency lease. Manual actions require the repository Owner actor, exact triggering main SHA and `support-production-<action>` confirmation.

- `verify`: read-only full schema/reference/role check; resolve only the explicitly supplied email, require the actual host `FANMIND_ADMIN_EMAILS`, exactly one confirmed/nondeleted/unbanned Auth user, and no competing Support Owner. Emit only fixed status markers.
- `owner`: repeat those checks under a transaction/advisory lock and Support-Owner table lock, insert the exact resolved UUID idempotently, and independently read back. No Auth, platform-Admin configuration, workspace or other permission change.
- `retention`: execute the installed operator-only audited, volume-guarded purge, with deterministic run ID, at most three attempts and existing daily deduplication. Review real counts/receipt; never imply read filtering is deletion. Manual retention needs its own action-specific confirmation.
- `monitor`: require the newest receipt to be succeeded, no older than30hours, and bound to the reviewed cleanup source. GitHub failures need an actual operational observer; a red workflow alone is not human delivery.
- `activate`: only after exact live release, full schema, bound Owner, fresh successful cleanup receipt, correct actual schedule configuration, privacy readiness and exact reviewed runtime-acceptance evidence. No readiness variable may be set merely because code/CI passed.

## Runtime and scheduler gates

Production environment variables:

| Variable | Required value/evidence |
| --- | --- |
| FANMIND_SUPPORT_PRODUCTION_SOURCE_COMMIT | Reviewed main ancestor containing this control and matching the accepted schema reference |
| FANMIND_SUPPORT_PRODUCTION_OWNER_EMAIL | Exact explicitly approved existing account, matching actual Production Admin configuration |
| FANMIND_SUPPORT_PRODUCTION_SCHEDULE_ENABLED | `true` only after daily physical cleanup and monitoring are authorized/configured |
| FANMIND_SUPPORT_PRODUCTION_PRIVACY_READY | `true` only after responsible operator, full-request register/secure delivery and accurate Support disclosure are confirmed |
| FANMIND_SUPPORT_PRODUCTION_ACCEPTANCE_COMMIT | Exact deployed/reviewed commit whose Support identity/tenant/consent/export/erasure/runtime evidence was independently accepted |

Schedules remain inert without the explicit enable flag. Daily cleanup is02:23UTC and monitoring every six hours. Cleanup source remains pinned and must be reachable from current protected main; its exact full-schema check runs every time. A later application release does not automatically stop valid cleanup; schema changes require a newly reviewed reference/control. Activation checks source/Owner schedule values rather than only the enabled switch. Already authorized root-only cleanup/monitoring does not depend on the Owner Auth account staying present or in the Admin list; Owner account changes must not stop required deletion. Owner binding and feature activation still require the actual verified Admin identity.

The new PM2 contract reads only the strict Support boolean from the existing shared `.env.production`; other values are not exposed. This preserves the flag across rolling deployments. Before activation, the corresponding PM2 configuration and helper must actually be deployed. The control verifies effective PM2 state, live SHA and application health after reload. On failure it restores the exact previous environment-file bytes and previous effective flag, then reloads; rollback failure is reported distinctly. Existing SQL/data is retained.

## Pending runtime acceptance

Schema acceptance and unit/native/component CI do not complete runtime acceptance. Confirm actual Owner vs ordinary Admin/customer denial, login/logout/account switch, cross-tenant boundaries, consent snapshot/later-message exclusion, own export/erasure, storage failure and monitored physical cleanup with approved synthetic fixtures only. Do not invent credentials, impersonate an actual customer or copy customer text into GitHub.

The single existing Support flag also enables customer conversation storage. Do not call this an admin-only activation or enable it before privacy and cleanup prerequisites. Existing provider/help/diagnostic/repair switches remain separate. No new provider, external send, Billing, schema or production-data fixture is authorized by this runbook.

Source preparation and safe Owner binding can proceed while these runtime prerequisites remain open. Overall Issue #1350 remains open until actual runtime acceptance is complete.

## Owner-directed live acceptance — 5 November 2026

The Owner explicitly requested enabling live Support so that he can perform the
remaining acceptance himself. This supersedes pre-completed acceptance as a
prerequisite **only for** the manual `activate-for-owner-acceptance` action.
It is not an accepted privacy/runtime result and does not set PRIVACY_READY or
ACCEPTANCE_COMMIT. Logs explicitly retain `SUPPORT_RUNTIME_ACCEPTANCE=PENDING_OWNER`;
Issue #1350 remains open until the Owner reports actual results.

Use reviewed protected main as controller source, supply the exact current live
commit separately and acknowledge `I_WILL_PERFORM_THE_PENDING_LIVE_ACCEPTANCE`.
The workflow checks both live and pinned cleanup sources are ancestors of reviewed
main and that their full Support schema/reference matches; the live PM2 contract
must also match. The controller still requires the actual bound eligible Owner,
exact Production/schema/role checks, authorized schedules and a fresh succeeded
receipt for the pinned cleanup source. It verifies exact live version and all
eight health checks, with the existing byte-exact rollback on failure.

This switches the existing global Support flag, including authenticated customer
conversation persistence; it does not restrict activation to the Owner's browser.
Consent, identity/tenant checks and the separate provider/repair switches remain
unchanged. No synthetic customer records, schema writes or provider calls are
performed by this action. The Owner performs the pending live checks.

For an explicit stop, `deactivate` uses the same main/Owner/live binding and
rollback verification, but deliberately does not require healthy cleanup or
completed privacy/runtime acceptance. It changes only the Support flag to false;
existing data and cleanup remain intact. Normal `activate` keeps all original
completed-acceptance requirements.
