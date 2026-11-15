# #1425 Storage deletion confirmation — 14 November 2026

Owner-authorized small continuation of merged #1490; existing schema/ACL repair,
CRM, mixer, Aurela and Support #1491 are preserved. No SQL or runtime activation.

## Observed cause

Correlated Staging Storage1.94.2 logs for the previously tombstoned synthetic
object show authenticated `object.get_authenticated_info`, `NoSuchKey`,
`not_found`, message `Object not found`, internal status404 and HTTP transport400.
The same fixed absent test key yields this bounded JSON response shape:

```json
{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"}
```

That envelope was independently retrieved without an Owner credential, proving
the provider shape only. The earlier Owner role/path and physical absence were
independently verified in protected logs and the database. Anonymous NoSuchKey
alone is not proof of authorization or physical deletion.

## Minimal correction

- Reuse one bounded response classifier in interactive and existing account
  erasure cleanup; never add a second deletion implementation or execution path.
- Preserve the exact key, authenticated request identity, no-store, redirect
  rejection, timeout and exact DELETE acknowledgment identity.
- Accept only JSON NoSuchKey/Object-not-found on400/404; transport400 additionally
  requires embedded404 and `not_found`. Reject NoSuchBucket, AccessDenied,
  InvalidRequest, unrelated/contradictory fields, non-JSON, malformed, empty,
  over1024-byte or failed responses. No catch-all400 or catch-all404 success.
- Revalidate current Character authorization after Storage deletion and before
  metadata cleanup. Existing RLS and tombstone rules remain authoritative.
- Require metadata DELETE representation to acknowledge exactly the requested
  ID. An RLS no-op cannot report successful metadata cleanup.
- No provider body, credential or private object path is logged by the parser.

## Evidence boundaries

Focused real-helper regression proves the exact observed400 envelope and normal
404, both normal DELETE and retry, failure classes, bounded parsing, revoked
authority and unacknowledged metadata deletion. Full build, required exact-head
CI, regular merge, protected Staging rollout and real target PNG/MP4 lifecycle
are separate gates; append results only after observed.

Local source checkpoint: Next build and focused ESLint PASS; media API/storage
suite50 tests,49PASS,0FAIL,1existing native skip. Existing ChatAdmin entrypoint
96 tests,95PASS,0FAIL,1existing native skip before the final metadata-negative
case; its successor media API suite includes that case. Governance162 tests
PASS, preflight and project-memory quality PASS. Conservative global release
decision remains BLOCK; it is not rewritten into a target acceptance claim.

The local browser was recovered using a fresh tab in the existing authenticated
Chrome session. Automated download yielded no file path; the existing neutral
PNG file chooser is prepared for an Owner file-selection handoff. No real
Owner image is selected or processed. Upload/playback/deletion is not yet PASS.

Mobile live acceptance: VERSCHOBEN – APP-ABNAHME. Automated responsive and security
regressions remain required. Production, Billing, Meta, schema, ACL and flags
are unchanged. Issue1425 stays open until complete actual Staging acceptance.
