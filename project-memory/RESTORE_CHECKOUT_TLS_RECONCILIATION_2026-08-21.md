# FanMind Restore Checkout TLS Reconciliation — 2026-08-21

## Identity

- Task: `FM-RST-001`
- Risk: `R4`
- Status: `RECONCILIATION_REQUIRED`
- Branch: `restore-checkout-tls-verification-20260821`
- Pull request: `#990`
- Base commit: `f1713876d004772ea5c3fc99f28bca7c1d6f01f9`
- Initial repair head: `4e9fd71485109c481f72ceddefd96eaf54398603`
- Active repair lock: `LOCK-FM-RST-001-CHECKOUT-TLS-20260821`

This checkpoint records a security-relevant contradiction found by an independent countercheck after the functional Resource Readiness and Target Compatibility workflow succeeded. It does not advance the Restore to `DB_RESTORED` and does not authorize a database write.

## Established target state — do not rebuild

The isolated disposable PostgreSQL target was successfully reset through the exact hash-bound v10 reset path and independently counterchecked:

- target database `fanmind_restore` exists once and is empty;
- baseline extension count is 2;
- unexpected object count is 0;
- core table count is 0;
- the prior populated database is retained as connection-disabled quarantine `fanmind_restore_before_20260821_193331`;
- reset receipt: `/home/fanmind-restore/secure/target-reset-receipt-20260821_193331.json`;
- Production and Supabase Staging were not touched.

The quarantine remains required for rollback and must not be deleted during this reconciliation.

## Functional read-only evidence

GitHub Actions run `32521238067`, exact commit `f1713876d004772ea5c3fc99f28bca7c1d6f01f9`, completed functionally with three successful jobs:

1. dispatch validation job `96893658594`;
2. secret-free host job `96893677059` on the first fresh one-job JIT runner;
3. protected read-only Resource Readiness/Target Compatibility job `96893707102` on a second independently generated one-job JIT runner.

The functional checks reported:

- Restore host gate passed;
- encrypted Full Backup resource readiness passed in checksum-only mode;
- no decryption and no Restore write occurred;
- PostgreSQL major 17 and required role/extension counts passed;
- dedicated bootstrap Restore user was a superuser;
- PostgreSQL connection was read-only and used TLS `verify-full`;
- both JIT runners removed `.credentials` and `.runner` and exited with code 0.

The accidental duplicate workflow run `32521274992` was cancelled and did not execute a Restore job.

## Independent countercheck finding

The protected job log showed `actions/checkout` using Git/cURL with:

```text
server certificate verification SKIPPED
```

All three Restore workflows exported:

```yaml
GIT_SSL_NO_VERIFY: 'false'
```

This is not a neutral false-valued setting. Git treats the environment variable as presence-triggered; exporting it with any value disables HTTPS certificate verification. Therefore the functional run cannot satisfy the R4 transport-security quorum even though the checksum, host and PostgreSQL catalog checks passed.

## Current security conclusion

- `RESOURCE_READY` and `TARGET_COMPATIBLE` remain functionally demonstrated but are not cleanly accepted for the next R4 write.
- Current Restore status is `RECONCILIATION_REQUIRED` at the source-checkout transport boundary.
- `restore-drill-database.yml` must not be dispatched from commit `f1713876d004772ea5c3fc99f28bca7c1d6f01f9`.
- No database Restore, decryption, Production mutation or Supabase-Staging mutation occurred in the affected run.
- The empty target and rollback quarantine remain unchanged.

## Repair scope in PR #990

The reviewed repair changes only:

- `.github/workflows/restore-drill-host-readiness.yml`;
- `.github/workflows/restore-drill-resource-readiness.yml`;
- `.github/workflows/restore-drill-database.yml`;
- `tests/restore-host-readiness.test.mjs`;
- this Project Memory checkpoint and the accepted-state drift baseline.

For every self-hosted Restore job, the repair:

1. removes `GIT_SSL_NO_VERIFY` entirely from the job environment;
2. adds a fail-closed assertion before any later checkout:

```bash
[[ -z "${GIT_SSL_NO_VERIFY+x}" ]]
```

3. adds regression tests that forbid exporting the variable and require exactly one unset assertion per self-hosted Restore job.

The repair does not change Restore targets, credentials, artifacts, PostgreSQL content, Storage, server configuration or Production runtime.

## Verification and acceptance required

Before merge:

1. Project Memory Guard, Quality/Drift, Status and all applicable FanMind CI/security/browser checks must pass on the exact PR head;
2. exact diff must remain limited to the stated transport-security repair and memory reconciliation;
3. no test may weaken the existing process-injection, JIT, host, target, TLS or write-gate boundaries.

After merge:

1. generate two new one-job JIT runners;
2. rerun `FanMind Restore Drill Resource Readiness` from the corrected exact `main` commit;
3. separately approve only the protected read-only environment job;
4. require functional Resource Readiness and Target Compatibility success;
5. independently inspect checkout logs and prove certificate verification is not skipped;
6. only then re-establish accepted `RESOURCE_READY` and `TARGET_COMPATIBLE` evidence and consider the separately protected database Restore dispatch.

## Failed approach / do not repeat

- Do not export `GIT_SSL_NO_VERIFY` with `false`, `0`, an empty value or any other value in a Restore workflow.
- Do not interpret a successful checkout as proof of certificate verification without inspecting the transport evidence for this R4 path.
- Do not reuse run `32521238067` as clean R4 transport-security acceptance.
- Do not dispatch the database Restore from the superseded workflow commit.
- Do not recreate the Restore server, PostgreSQL/TLS baseline or empty target; fix only the verified workflow transport defect.

## Falsification question

What observation would prove this repair insufficient?

Any exact-head workflow still exporting `GIT_SSL_NO_VERIFY`, any protected checkout log still reporting skipped certificate verification, any regression in the host/JIT/target gates, any checkout of a commit other than the reviewed exact `main` commit, or any target/backup/TLS drift before the repeated readiness run forces continued `RECONCILIATION_REQUIRED` and blocks the Restore write.
