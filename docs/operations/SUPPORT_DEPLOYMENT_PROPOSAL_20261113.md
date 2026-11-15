# PR #1470 current Main reconciliation — 13 November 2026

The Owner authorized continuation, conflict resolution and new-head checks only.
PR1470 remains Draft, with no merge or deployment approval. Current Main
`3912461e1f88eb5cf2e621f23e4d6079409c20cc` includes the regular #1465 and #1469
merges. It is integrated into the existing PR through a genuine merge. The sole
content conflict is STAGING_OPERATOR_SESSION_ROLLOUT.md: retain both the bounded
Main-preservation proposal and Facebook final acceptance, marking prior failed
checkpoints historical. All Main runtime, SQL, tests and documentation are
retained byte-for-byte except that combined runbook. No new media, Facebook or
session implementation is introduced. Nine Expo patch updates and the exact
reviewed Main preservation source policy remain unchanged from old PR head
`900ce9454621696a761d94cef74070a075391fca`.

Fresh HTTPS target reads at 14:01 Vienna: Staging remains
`d34834979cef30c9c6af567d61b3df448901bfda`; Production remains
`a798d7938bb4e7e168f615f0c32d1a603dd47d4a`. No active workflow was in progress at
the initial API read; two older queued workflows are not deployment approval.
Repeat live versions, current Main and deployment/host locks before any later
joint Staging rollout; do not overwrite a successor. Metadata alone does not
prove the absence of a host lock.

The old head's eleven successful workflows, including native builds, are
complete historical evidence only. New-head CI must run in full, including
Mobile and native Android/iOS compilation, plus inherited media acceptance.
The final exact head/tree, local results and fresh GitHub receipts are recorded
in PR1470 after completion, avoiding a self-referential commit hash.

One bundled Owner decision after successful checks: approve regular source merge
of the exact final PR head including the narrowly bounded Main admission change
for preservation of an already enabled Operator continuation. This is a source
policy change; it neither changes active protected branch/environment rules nor
first-activates continuation. Manual exact reviewed Main SHA, Billing preserve,
no recovery, both explicit preservation inputs, and a fresh single valid true
flag parsed from private regular non-symlink .release.env remain mandatory.
Off/missing/unknown/duplicate/malformed state must never become an activation;
false/default input must not silently disable existing true state. Keep existing
protection, no bypass. No deployment, schema, bucket, provider, Billing, runtime
or feature activation is requested by this source decision. A merged Main SHA
and any later rollout remain separate concrete approvals.

The following sections are historical checkpoints, superseded where noted above.

> Final target reconciliation, 13 November12:38Vienna: browser /api/version
> confirms Stagingd34834979cef30c9c6af567d61b3df448901bfda at11:38:28UTC;
> Production remainsa798d793 at11:38:37UTC. Protected deployment43417498761
> completed successfully on exactlyd348. The candidate preserves this actually
> deployed refresh-format correction and its tests byte-for-byte through a real
> merge. No further undeployed draft is selected and no refresh implementation
> is independently rewritten here. Only runbook text conflicted; both sections
> retained. Runtime source observations supersede the older checkpoints below;
> they do not prove actual provider-backed renewal acceptance. All11 workflows
> passed on preceding2843; final-head CI is rerun after reconciliation. Mobile
> source/dependency tree is unchanged by this merge; no native check is bypassed.

> Fresh target reconciliation, 13 November12:10Vienna: Browser /api/version
> confirms Staginge4465268f781dfd57704070b9ae60ec6d831ca5d at11:10:12UTC;
> Production remainsa798d793 at11:10:20UTC. The existing release-fix PR is extended
> by a genuine merge of exactly that deployed source, preserving its session
> policy/tests byte-for-byte. Only the rollout runbook conflicted; both sections
> are retained. This adds no manual Facebook/runtime implementation change.
> Newer Draft1465d3483497 is not deployed and is excluded. Actual renewal on
> e446 still fails401/sign_in_required per the owning Work-tab; preserving its
> opt-in is not evidence of successful renewal. Main source integration and the
> named admission extension require explicit approval; no deployment is granted.

# Deployment-blocker repair proposal — 13 November 2026

PR1468 was Owner-approved at1ddf705e and regularly merged as
6c1e376b788e9ef4d3d929a44214f8484e8610ba after fresh12/12 required checks,
unchanged head and strict/no-bypass rules verification. Main ref, merged PR and
commit parents/tree independently agree. No deployment performed.

A follow-up source proposal repairs exactly two blockers:

1. Upgrade the nine Expo dependencies to the patch versions requested by the
   failed doctor check, regenerate the mobile lockfile and advance the existing
   exact-version assertions accordingly. No Mobile feature, native identity,
   permission, signed build, store action or check exclusion is introduced.
2. Prepare an explicitly approved Main-only preservation path for an already
   enabled Staging Operator session. Normal defaults may not turn it off.
   Exact source/manual/Billing-preserve checks and a fresh private flag read are
   mandatory. This source admission extension needs separate Owner approval;
   active branch/environment rules are untouched. See STAGING_OPERATOR_SESSION_ROLLOUT.md.

The new PR's exact head/tree and full independent CI receipts are recorded in
that PR. Until merged and separately deployed, neither target blocker is claimed
resolved live. No Facebook/Stripe/media runtime source or target data changes.
The final deployable Main SHA does not yet exist; after source approval/merge,
record its actual SHA and repeat target version checks before requesting Staging.

For Staging, propose that exact merged SHA with billing_write_freeze=preserve,
staging_operator_session_enabled=true and the fixed preservation confirmation.
No temporary environment branch expansion is needed for already allowed Main.
No database, flag activation, provider or permission change is part of this
proposal; preserving true must first be proved from existing release metadata.
Live Support acknowledgment requires an explicitly authorized existing test
alarm or bounded fixture with readback/reload/reopen and audit/actor evidence.
Production remains a separate later deployment and acceptance approval.

The preceding source-reconciliation proposal follows for context; its then-open
source merge is now complete, while actual target acceptance is still pending.

# Support common release — 13 November 2026

Source preparation only. No merge or deployment is authorized by this document.
The Owner requested a fresh common candidate and full checks before exact-head
merge approval. No new Support feature, database, provider, permission, secret,
flag or runtime changes are included. No additional database is proposed.

## Independently confirmed versions

| Surface | Exact source | Evidence |
| --- | --- | --- |
| Main | `0def924beb080dde9b7bd9fb4d514f5cca2ac291` | Fresh GitHub ref; approved PR1466/1467 merges retained |
| Staging | `a49decfdb81ea8a16ff78c134cd28b141af4a218` | Browser `/api/version` 2026-11-13T10:25:58.042Z (11:25:58 Vienna); successful protected deployment43408555294 |
| Production | `a798d7938bb4e7e168f615f0c32d1a603dd47d4a` | Browser `/api/version` 2026-11-13T10:26:20.231Z (11:26:20 Vienna) |

Staging advanced fromaae0003c to the Owner-approved a49decfd in the other
Work-tab. The old PR1468 candidate405a2cf6 would remove that deployed successor
and must not be released unchanged. Existing PR1468 is refreshed by a genuine
merge of its original source with exactly the observed Staginga49decfd.
No newer undeployed commit or media Draft1440 is selected. Those branches remain
unchanged and unmerged. Preserving deployed source is not a declaration that its
remaining live renewal/expiry/logout/revocation acceptance has passed, nor does
it inherit the other Work-tab's Main merge approval. Explicit exact-head common
source approval must cover this inherited source before Main may move.

## Preservation and verification

Runtime files from deployeda49decfd and the approved Main Support fixes are
preserved byte-for-byte. The only conflict is DRIFT_BASELINE metadata: retain
the combined Source of Truth and pin its actual Git blob; no other watched hash
or activation gate changes. The precise candidate SHA/tree and final CI receipts
are recorded in PR1468 after checks, avoiding a self-referential commit digest.
Historical deployment wording inherited from its parents is checkpoint evidence;
the fresh target readings above supersede it without fabricating live acceptance.

Required checks: full exact-head GitHub CI including lint/tests/production build,
Chromium desktop/mobile public and synthetic core journeys, native PostgreSQL17
authorization and Support roundtrips, CodeQL, supply-chain, Memory and God Mode.
Independent source QA must confirm both parent ancestries, exact preservation of
runtime files, no migration delta and unchanged no-auto-send/tenant boundaries.
Recheck target/source refs immediately before proposing or acting on approval.
A later Staging successor invalidates this frozen deployment proposal until
reconciled; never roll it back just to gain branch parity.

## Support correction included

PR1467 requires exact boolean true from support_centre_ack and a fresh authorized
inbox read confirming absence before returning success. False/malformed results
or a reopened alert return409; failed readback returns503. The existing canonical
HTTPS origin guard is retained behind the internal proxy. Idempotent retries
retain the database acknowledgment timestamp. Tests cover actual route/parser,
React inbox reload/reopen and native PostgreSQL owner/tenant/idempotency checks.
No migration is needed. Synthetic PASS is not live Production acceptance.

## Separate protected requests after the merge

1. Record actual common Main merge SHA and re-read both target versions and
   workflow locks. Use the existing protected deployment path; no bypass,
   force update, database migration, secret/permission/flag or provider change.
2. Request Staging-only deployment for that exact common Main SHA, preserving
   current settings, Billing freeze and deployed integrations. Its target
   baseline is a49decfd unless a fresh read establishes a successor. Existing
   in-app Help build flag NEXT_PUBLIC_FANMIND_INAPP_HELP_ENABLED must be verified;
   a server Support flag alone does not establish launcher availability.
3. After the approved Staging rollout, confirm HTTPS release/health and Support
   paths. With a specifically authorized existing test alarm or separately
   approved bounded fixture, prove acknowledgment actor/timestamp, absence on
   fresh read/reload/reopen, stable retry and correct new-occurrence behavior.
   Do not generate Admin-Chat content, edit media or send external messages.
4. Request Production deployment separately: exact merged SHA, current target
   a798d793 or fresh successor, complete accumulated source delta, passed gates,
   Staging evidence and the supported rollback. Source includes already-existing
   registration/Stripe/Meta differences; this is not approval to activate them.
5. Only after that approval, deploy and independently read the live version,
   then execute the same explicitly authorized durable acknowledgment proof on
   Production. Record outcomes in existing Issue1350. No false success, no
   automatic retry after indeterminate write and no email-delivery claim from
   database/UI evidence alone. Any needed data write/fixture cleanup must be
   included in the concrete acceptance approval.

Media development and Facebook feature completion are owned by their Work-tabs;
they are not Support completion prerequisites. Preserve their deployed behavior.
Support remains pending live target acceptance, even after all source checks pass.
