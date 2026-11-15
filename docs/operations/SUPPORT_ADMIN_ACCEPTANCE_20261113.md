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

- Initial Staging Operator session returned 404. The user then completed the
  existing Character Owner login; `/chatadmin` now opens. No permission grant
  was required or performed. Existing synthetically marked QA Characters/Fans
  were reused rather than created again.
- Opened an existing saved dialogue and its three archived suggestions. Typed
  an individual replacement into the reply editor and discarded the draft;
  editing works independently of the supplied suggestions.
- Actual wheel input moved the long manual notes and a temporary unsaved long
  summary/facts field from scrollTop 0 to 520. Both drafts were cancelled.
  The enclosing form also scrolls and its cancel action works. A persistent
  open Fan menu temporarily covered another Fan; closing it restored that
  selection. No application failure is inferred from locator timeouts alone.
- Actual message wheel scroll moved the conversation from 0 to about 199, with
  the composer still at y=589 (height 78). This proves the fixed message input,
  not a separate file-attachment feature. Character B showed its own empty Fan
  list, and A2 did not show A1's saved conversation.
- Generated exactly three real model suggestions for one explicitly marked
  synthetic price/image/delivery/automatic-send challenge on the existing test
  Fan A2. All three declined unverified media/offer/delivery claims and stated
  manual sending. No reply was copied/confirmed or externally sent. After a
  Fan switch the saved incoming turn and three collapsed suggestions were
  retrieved again. This is a bounded real-model case, not universal proof of
  all pricing or image-understanding behavior.
- Found a real rendering defect immediately after generation: stored suggestions
  and transient current suggestions appeared twice. The source correction
  renders the current suggestion group once directly under its incoming turn;
  archived editing and current copy-and-use controls remain. A new Chromium
  component regression supplies the actual persisted-history shape and asserts
  one occurrence, correct parent group and collapse/reopen behavior. It would
  reject the duplicate shape observed on Staging. This correction is not yet
  deployed; live Staging still has the duplicate behavior until rollout.
- The media button is absent in the authenticated selected-Character view.
  Its existing source only renders that entry when the media runtime flag is
  enabled. #1425 implementation already exists; no duplicate media code,
  schema apply, actual image processing or provider analysis was started.
- Media activation remains blocked by the existing exact reviewed Main/live
  Staging source requirement. Staging runs the separate unmerged #1463 source,
  while Main has moved on. The existing `activate` workflow controls Support
  plus media and explicitly keeps image analysis disabled; it is not a
  provider-analysis approval. Do not bypass source binding, overwrite the
  separate Facebook rollout or infer a current media activation from the
  historical Production schema report. Real upload/read/isolation/delete and
  configured custom-price/delivery acceptance remain open.

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
- Additional ChatAdmin layout/policy/manual-flow source tests: **91 PASS**.
  Local Chromium component execution was attempted but failed before launching
  the browser because the executor denies its process-singleton socket. This is
  not an assertion failure or a passing browser test. The new regression must
  pass in the existing independent Browser CI before merge.
- Focused ESLint: 0 errors; three pre-existing unused-import warnings in the
  Website Chat test. `git diff --check` PASS.

## Remaining concrete boundaries

1. Reconcile the exact Staging/Main source boundary without overwriting the
   separate #1463 rollout; then run the existing protected media preflight and
   separately approved activation/real-file acceptance. Character Owner login
   is now complete and must not be requested again solely for this session.
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
