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
