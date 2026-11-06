# FanMind Restore Checkout CA Truststore Reconciliation — 2026-08-22

## Identity

- Task: `FM-RST-001`
- Risk: `R4`
- Status: `RESOLVED`
- Branch: `restore-checkout-ca-truststore-20260822`
- Pull request: `#991`
- Base commit: `1735a5f552c0c20c180fb96be6fa9000cbffc360`
- Active repair lock: `LOCK-FM-RST-001-CHECKOUT-CA-TRUSTSTORE-20260822`

This checkpoint records the bounded repository defect found by the failed protected read-only Resource Readiness run and its later clean runtime closure. It does not authorize a database write or invalidate the independently established empty-target baseline.

## Live run evidence

GitHub Actions run `32568632008` used exact `main` commit `1735a5f552c0c20c180fb96be6fa9000cbffc360`.

- dispatch validation job `97020817035`: success;
- secret-free host job `97020825268`: success;
- protected Resource Readiness job `97020836458`: failure in checkout;
- intended Host-2 JIT runner: ID `40`, name `fanmind-restore-01`;
- preinstalled host re-attestation: success;
- `actions/checkout`: three failed fetch attempts, exit `128`;
- resource-readiness and PostgreSQL compatibility steps: skipped;
- one-job JIT cleanup: `.credentials` and `.runner` removed, listener exit `0`.

The job therefore did not decrypt the backup, connect to PostgreSQL, reset or restore the isolated target, touch the retained rollback quarantine, write Production or write Supabase Staging.

## Root cause

PR #990 correctly removed the presence-triggered `GIT_SSL_NO_VERIFY` export. The failed job confirmed that the variable was absent and its transport trace did not report skipped server-certificate verification.

The same workflow job environment still exported these CA-path variables with empty values:

- `CURL_CA_BUNDLE`;
- `GIT_SSL_CAINFO`;
- `GIT_SSL_CAPATH`;
- `REQUESTS_CA_BUNDLE`;
- `SSL_CERT_DIR`;
- `SSL_CERT_FILE`.

Git/cURL then failed with `error reading ca cert file  (Error while reading file.)` and `Problem with the SSL CA cert (path? access rights?)`. An independent read-only reproduction with Git 2.43 produced the same failure when `GIT_SSL_CAINFO` and `GIT_SSL_CAPATH` were present but empty; the same request succeeded when bound to Ubuntu's system CA bundle and directory.

## Bounded repair

Every self-hosted job in the three Restore workflows now pins the CA consumers to the fixed Ubuntu system truststore:

- CA bundle: `/etc/ssl/certs/ca-certificates.crt`;
- CA directory: `/etc/ssl/certs`.

Before the preinstalled Restore gate and before any later checkout, each self-hosted job proves:

1. all six CA variables equal the fixed bundle/directory contract;
2. the bundle is non-empty, canonical, a regular file, root-owned, non-symlink, non-writable by the runner and not group/world-writable;
3. the directory is canonical, a directory, root-owned, non-symlink, non-writable by the runner and not group/world-writable;
4. `GIT_SSL_NO_VERIFY` remains entirely unset.

Regression tests require the exact pinned values and one truststore validation block per self-hosted Restore job. The preinstalled gate digest, checkout SHA, JIT topology, target boundaries, write gates and Restore commands remain unchanged.

## Closure evidence

- PR #991 passed its exact-head Project Memory, FanMind CI, supply-chain, CodeQL and browser checks and merged to `main` as `b75f68ecc7999a9b492051aecc2421b9b597dd18`.
- Fresh protected read-only run `32582640853` checked out that exact commit. Git/cURL loaded 121 certificates from `/etc/ssl/certs/ca-certificates.crt` plus 365 from `/etc/ssl/certs`, negotiated TLS 1.3 and reported `server certificate verification OK`.
- The dangerous prior marker `server certificate verification SKIPPED`, the empty-CA error and the CA-path/access-rights error were absent. Git/cURL separately reported `server certificate status verification SKIPPED`; that is the OCSP/status check and does not negate the explicit server-certificate verification success.
- `RESTORE_DRILL_RESOURCE_READINESS=PASS`: isolated environment, separate target, encrypted Full Backup, checksum-only validation, no database connection, no decryption and writes disabled.
- `RESTORE_TARGET_COMPATIBILITY=PASS`: PostgreSQL 17, three of three required roles, one of one required extensions (`pgcrypto`), dedicated restore superuser, read-only catalog connection, TLS `verify-full` and writes disabled.
- Gate job `97054217701`, Host-1 job `97054234003` and protected Host-2 job `97054248185` all completed `success`; Host-2 one-job runner ID `42` removed `.credentials` and `.runner`, exited 0 and was absent from the runner list before controller acceptance.
- No database Restore, target reset, Production write, Supabase-Staging write or other R4 mutation occurred.

The state machine therefore advances through `RESOURCE_READY` to `TARGET_COMPATIBLE`. Mutable runner/host/target/TLS evidence still expires and must be revalidated before the next protected write.

## Acceptance boundary fulfilled for read-only readiness

The repository repair and its protected runtime checkout are now jointly proven:

1. exact-head repository/security checks passed;
2. the bounded repair merged to `main`;
3. a newly approved, separately prepared two-JIT read-only Resource Readiness run completed;
4. resource and target compatibility passed;
5. the checkout trace independently proved normal certificate verification without CA-file errors or the dangerous certificate-verification-skip marker.

No workflow dispatch or JIT creation is part of this repository repair. Run `32568632008`, job `97020836458` and JIT runner ID `40` must not be retried or reused.

## Failed approach / do not repeat

- Do not represent path-valued CA environment controls with empty strings.
- Do not remove the CA variables and thereby allow ambient runner values to control checkout.
- Do not weaken or reintroduce `GIT_SSL_NO_VERIFY`.
- Do not treat a successful host gate as proof that the later checkout can load its CA truststore.
- Do not create another Restore server, reset the already empty target, delete the rollback quarantine or dispatch the database Restore while this reconciliation is open.

## Falsification question

What observation would prove this repair insufficient?

Any later self-hosted Restore job with an empty, ambient, symlinked, runner-writable or non-root truststore path; any checkout with a CA-file error or the exact dangerous `server certificate verification SKIPPED` marker; any checkout of a commit other than the newly authorized reviewed `main`; or any host/target/backup/TLS drift before the database run invalidates the mutable evidence and blocks all Restore writes pending reconciliation.
