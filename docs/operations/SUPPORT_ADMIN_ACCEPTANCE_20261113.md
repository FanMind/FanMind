# Support and ChatAdmin continuation — 13 November 2026

Status: PARTIAL. Issue #1350 remains open. This is an execution record, not a
Production release, schema approval, independent QA sign-off or completion claim.

## Observed source and deployments

| Surface | Exact commit | Evidence |
| --- | --- | --- |
| Main before this correction | `4488fc0ff548e2ec2fc230a0403d1826849fd233` | Fresh authenticated Git remote ref read |
| Staging runtime | `6be52484b9edc2ca0b23bff06b2414fe08090f57` | Browser `/api/version`, 08:20:37 UTC |
| Production runtime | `a798d7938bb4e7e168f615f0c32d1a603dd47d4a` | Browser `/api/version`, 08:21:00 UTC |

No Staging branch ref was returned. Staging is a deployed runtime, not a branch
that can be assumed equal to Main. Existing Draft PRs #1463/#1465 were inspected
and left unchanged. No Facebook, Stripe, schema, role, secret or deployment was
changed. An existing worktree was preserved; source work uses its own branch.

## Support: actual execution and results

- Reused the existing scheduled Retention proof rather than dispatch another
  purge. [Run 43196085487](https://github.com/FanMind/FanMind/actions/runs/43196085487),
  job `131107306504`, records `ACTION: retention`, schedule enabled and
  `SUPPORT_PRODUCTION_RETENTION=PASS` at 2026-11-12T09:57:54.0642779Z.
- Independently retrieved the existing current monitor log:
  [run 43382459460](https://github.com/FanMind/FanMind/actions/runs/43382459460),
  job `131743194891`, `ACTION: monitor`, schedule enabled,
  `SUPPORT_PRODUCTION_MONITOR=PASS` at 2026-11-13T06:59:12.0569129Z.
  This continuation did not obtain new database-level deletion counters. The
  earlier receipt/counter evidence in #1350 remains historical evidence.
- After the user completed login, `/admin/support` explicitly identified the
  current Production actor as Platform Owner. Its global inbox displayed the
  existing 10 November 09:57:47 synthetic security warning. This closes the
  previously missing **actual authenticated display/receipt** proof for that
  existing test notification. No second notification was created. This is an
  in-app alarm, not email delivery.
- The regular acknowledgment control was exercised once. It did not produce a
  durable acknowledgment: the warning reappeared after reload. The existing
  maintenance/recovery error remained visible. Do not claim acknowledgment PASS.
  Production still uses the old direct Origin comparison; Main already contains
  the configured-HTTPS-Origin fix in `4b917976`. That is a source/deployment
  difference consistent with the failure, not a proven HTTP-status diagnosis.
- Public Production chat: sending disabled before consent; one actual model
  answer plus follow-up received; no automatic-send or fixed time-saving promise
  in the observed answers. Minimize/reopen preserved the conversation at a
  390×844 viewport, the composer fit within the viewport, and withdrawal disabled
  sending. The temporary viewport override was reset.
- Concrete public answer defects: an invented contact email and omission of
  the direct original/reply-link step. The latter already has a Main fix in
  `69fd1f77`, absent from the old Production release. Production also still
  displays the old Starter/Setup pricing surface; the current canonical
  Capacity-v2 source changes are not live merely because Main contains them.
- Implemented the missing server email-output guard. Public model answers now
  normalize email addresses to the approved public contact. Oversized output
  after normalization fails closed. Tests exercise the reproduced typo,
  foreign/case variants, mailto, size expansion and the actual route boundary
  with a simulated provider response. No real visitor transcript is stored here.
- Authenticated Staging support: reused its existing history, saved one plainly
  marked non-sensitive acceptance question, received the approved manual-send
  workflow, reloaded the page and reopened Help. The new turn remained visible.
  No handoff was submitted and no earlier history was erased. The single test
  turn remains under the existing retention policy.

## ChatAdmin: actual execution and limits

- The signed-in Staging Operator is authenticated and can open the Support
  Centre, but `/chatadmin` returns 404. The existing capability contract requires
  the actual Character Workspace Owner; Platform Support Owner authority is
  separate. No access grant or impersonation was performed.
- #1425 and its latest comments were checked. Its implementation already exists;
  the documented Production schema installation and historical rollout are not
  proof of current media runtime activation. No duplicate media implementation,
  schema apply or image/provider processing was started.
- Consequently, live Character notes/facts/messages scrolling, fixed attachment
  area, editable suggestions, Character-context persistence, real private-media
  upload/search/preview/delete and price/delivery policy acceptance remain
  **NOT VERIFIED in this continuation**. Existing source tests are not a
  substitute for this account-bound live acceptance.
- A Staging login tab was left for the existing Character Owner login. The
  working Operator session was not logged out, avoiding disruption of the
  separate integration work. No independent QA agent/reviewer sign-off exists
  for this new source correction yet.

## Local validation

- Website Chat/public route regression: **95 PASS, 0 FAIL, 0 SKIP**.
- Selected ChatAdmin policy/media API/media rules and Support Centre policy,
  Owner acceptance/rollout tests: **75 PASS, 0 FAIL, 0 SKIP**. These use source
  and synthetic adapters, not a fresh live two-tenant or real-image proof.
- God Mode adversarial regression: **123 PASS**; structural preflight PASS.
  The unsigned checked-in release evaluation remains **BLOCK**, with absent
  protected target/evidence/attestation. It was not rewritten into approval.
- Full Next.js build including TypeScript: **PASS using `npm run build --
  --webpack`**. The default Turbopack build first failed because this isolated
  worktree reuses installed dependencies through an external symlink. No source
  or deployment guard was changed to hide that environment limitation.
- Focused ESLint: 0 errors; three pre-existing unused-import warnings in the
  Website Chat test. `git diff --check` PASS.

## Remaining concrete boundaries

1. Sign in with the existing Character Workspace Owner on Staging, then finish
   the live ChatAdmin/media checks without expanding Operator permissions.
2. Review this bounded source PR and obtain final-head CI plus independent QA.
3. Reconcile the exact protected deployment candidate. Main differs from
   Production in 175 files, including Stripe and Meta code; a wholesale Main
   deployment would not be a Support-only change. The current Production
   controller admits reviewed Main only. Do not silently deploy excluded work
   or bypass that controller with a feature-branch hand-deployment.
4. Obtain concrete Owner approval for any new protected rollout/schema action
   only after its exact source, impact and existing gates are reviewable. No
   Production deployment or new migration approval is inferred from this report.

Support and ChatAdmin are not marked complete while these actual failures and
acceptance gaps remain.
