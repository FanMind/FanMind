# FM-STAGING-FINAL-ACCEPTANCE-20261105 — PR1434

Status: SOURCE_PREPARED / LIVE_BLOCKED. Risk R3 source, R4 target boundary.
Baseline/main remains5414f53d4cdfc9db58bf1306654e62eb0efa44da. Production release
remainsa798d7938bb4e7e168f615f0c32d1a603dd47d4a from the existing accepted read.
No Main ref, Production deploy/schema, provider or runtime flag is changed.

This continues the existing AdminChat/Staging task and source handoff; no duplicate
Staging writer/lease is claimed. The existing ChatAdmin and deployment concurrency
leases are reused by the respective workflow paths. The source-only branch is
fix/staging-final-acceptance-20261105; no active database lease remains.

Contracts: FM-CONTRACT-CHATADMIN-AI-001, FM-CONTRACT-CHATADMIN-STORAGE-001.
Gates: FM-IGATE-CHATADMIN-AI-001, FM-IGATE-CHATADMIN-STORAGE-001.
Support repair persistence and Workspace authorization consumers remain explicitly
in scope without inventing a missing registry ID. No registry status is promoted.

## Evidence and findings

- Existing protected run42107187544 passed browser/invented_price, HTTPS version,
  session cleanup, data cleanup and absence; aggregate persistence failed.
- Independent source review and deterministic reproduction show ten successful
  generations can have0,2or10 rejected quality attempts. The exact error-count2
  assertion is false as a stable invariant. Historical actual counts are unknown
  after accepted cleanup. Preserve every existing exact assertion and add only
  six bounded numeric expected/actual diagnostic counters before failure.
- Source controller fixes independently requested target, override, effective
  process and verified-rollback checks, plus durable private fsynced receipts.
  Analysis/external delivery remain disabled. Main-only/protected-Staging gates
  are retained. Full Media catalogue equality rejects altered or additional
  permissive policies, privilege drift and trigger changes. Native source-based
  recreation is added to the existing PG17 required CI; local skip is not PASS.
- Local final relevant tests64/64 PASS. Separate source profile/ownership tests
  pass with native PG17 unavailable locally. CI exact head remains authoritative.
- Staging repair-audit metadata read21:37UTC:0rows,11columns, no connection_id,
  partial status/completion constraint/history index. Current application requires
  these. Full legacy fingerprint5be8a062a7627b88d5f710b9928fd669 is a precondition
  only; desired post-state comes from the existing12-column source classifier.
- Independent QA approved only the rollback rehearsal: upgrade SHA256
  178bb5017ac25114ded84213f37f92bda224193bbd9ab0aa5b2812fec6c9faf1;
  synthetic acceptance SHA256
  1c6fe0c787c2b95c8f1f466b88209370d818b8720ca6654ad47e8fc3bdebbb75.
  Derived rehearsal96670d964870ea1fcb7536d4bf893e6bc6c76b260bf27ca125b6cf1a0b9e9372
  replaces the sole final COMMIT with native acceptance and ROLLBACK.
- Both Staging rehearsal tool requests expired at confirmation. There is no SQL
  execution/PASS or committed apply claim. Fresh readback: original fingerprint,
  zero rows and no other AccessExclusiveLock. No automatic retry after the second
  expired request and no alternate write path to evade confirmation.
- Fresh Production read confirms repair audit absent, admin-CRM state RPC present,
  member-safe dashboard RPC absent. Separate concrete Production proposal ends
  in ROLLBACK and has no execution authority. Preserve both environments' access
  protections; do not copy Staging-only tables or legacy fields wholesale.

## Remaining gates / recovery

Main must remain unchanged per current Owner scope. Existing protected controls
require changed source on Main and deployed source binding. Therefore no feature-
branch execution, merge, deploy or protected live retest is substituted. Browser
connection is unavailable for dispatch. Staging SQL confirmation also expired.
These are concrete execution blockers, not evidence that current authorization
has been withdrawn. Scope change permitting an ordinary protected operations merge
would still not authorize any Production deployment or schema write.

Before live continuation: exact-head required CI/native PG17 and independent final
review; resolve Main source-binding decision; perform current target/backup check
and successful audit rehearsal/postflight before any commit; separately execute
only authorized Staging control, full runtime/file acceptance and final cleanup.
Before activation source revert is sufficient. After activation use reviewed
Staging deactivate, inspect private receipt and effective flags; preserve schema
and all data. Never restore enabled flags on failed deactivation or drop populated
objects. Overall functional parity and complete acceptance remain NO.
