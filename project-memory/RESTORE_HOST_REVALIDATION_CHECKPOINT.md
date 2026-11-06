# FanMind Restore Host Revalidation Checkpoint

Task: `FM-RST-001`
Risk: `R4`
Current Restore state: `BACKUP_ACCEPTED`
Target transition: `BACKUP_ACCEPTED -> HOST_REVALIDATED -> RUNNER_POLICY_REVALIDATED`

This checkpoint is deliberately read-only. It does not restore, decrypt, migrate, create roles/extensions, mutate Production/Staging, start a payment, or authorize a later write gate.

## Already proven and therefore not rebuilt

The following are established historical/operator evidence and are reused unless fresh validation proves drift:

- dedicated isolated Restore VM exists;
- Ubuntu 24.04 baseline;
- PostgreSQL 17.11 target/toolchain baseline;
- Node.js 24.19.0 baseline;
- target database `fanmind_restore`;
- bootstrap login `fanmind_restore_bootstrap`;
- PostgreSQL local target on `127.0.0.1:5432`;
- TLS `verify-full` previously passed;
- dedicated `fanmind-restore` user without sudo;
- protected `restore-drill` GitHub Environment and private age-identity setup were established;
- runner group `fanmind-restore-drill` was established in the operator session;
- no second Restore server is required;
- accepted Schema-2 encrypted Full Backup exists: `b74c1c60-1d61-4a39-9f0d-648ec003a12c`;
- checksum-only verification exists: `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`;
- recovery contract/PG17 roundtrip is already proven by PR #943 / `14a1e2d0e100f2ec8cfa14486c96f128fb431878`.

These facts prevent duplicate provisioning. They are not automatically fresh enough to advance the R4 state.

## Fresh evidence required for `HOST_REVALIDATED`

All of the following must be current and bound to the actual Restore host before the state advances:

1. hostname/runner identity still matches the reviewed `fanmind-restore-01` contract;
2. OS remains Ubuntu 24.04 / Linux x64;
3. fixed Node runtime remains 24.19.0 at the reviewed root-owned path;
4. PostgreSQL client/server target contract remains major 17 and expected 17.11 tooling where pinned by the host gate;
5. `fanmind-restore` remains the dedicated unprivileged user and non-interactive sudo cannot succeed;
6. unexpected privileged container/runtime sockets and capabilities are unavailable;
7. runner temp and workspace remain distinct, safe, non-symlink boundaries and private where required;
8. installed root-owned host gate and fixed toolchain still match their reviewed identities/checksums;
9. no unexpected proxy, loader, tracing, Git/Node/Python/TLS override or Restore write acknowledgement reaches the host-readiness environment;
10. local target/TLS identity has not drifted in a way that invalidates later compatibility evidence.

### Fail-closed observations

Any of these observations prevents `HOST_REVALIDATED`:

- host or runner identity mismatch;
- unexpected sudo/capability/privileged socket access;
- changed/untrusted host gate or toolchain;
- unsafe symlink/permission boundary;
- unexpected environment override or active Restore write gate;
- target/TLS identity drift that is not reconciled;
- evidence belongs to another host/run/commit.

## Fresh evidence required for `RUNNER_POLICY_REVALIDATED`

Organization ownership is already current: repository is `FanMind/FanMind`, owner type Organization `FanMind`. This invalidates older `user-owned`/`future-org` wording, but organization ownership alone is not authorization evidence.

Before any protected Restore job, independently verify the live GitHub runner-group policy for `fanmind-restore-drill`:

- selected repository is exactly FanMind repository ID `1259448985`;
- no unrelated repository is allowed;
- workflow restriction is enabled;
- allowed Restore workflow paths are exactly the reviewed `main` Restore workflows;
- public-repository allowance, if the repository is public, matches the reviewed policy;
- the operator assertion variable `FANMIND_RESTORE_RUNNER_SCOPE` is not treated as proof by itself;
- the runner used for the protected job is a fresh one-job JIT runner under the reviewed external controller contract.

### Evidence rule

The existing repository verifier for the private administrator policy capture/receipt remains the approved non-secret normalization path. The capture must be fresh according to the canonical Restore runbook. A receipt proves the reviewed capture bytes; it does not prove later GitHub policy has not drifted.

If the current ChatGPT/GitHub connector cannot read organization runner-group admin policy directly, the state remains `NEEDS_VERIFICATION`; do not guess and do not advance the state.

## Exact next action

1. obtain/inspect fresh current runner-group policy evidence through a supported GitHub organization administrator path;
2. run the existing secret-free Restore Host Toolchain Readiness path from current `main` using the exact reviewed confirmation;
3. compare the result with this checkpoint and `RESTORE_STATE_MACHINE.md`;
4. only when both host and policy evidence are current, record `HOST_REVALIDATED` and then `RUNNER_POLICY_REVALIDATED` separately;
5. next after that is `RESOURCE_READY`, still read-only.

## What would prove the current conclusion wrong?

A current host-readiness failure, a runner-group policy that allows additional repositories/workflows, a non-JIT/persistent runner, or target/toolchain/TLS drift would prove that the historical operator setup is not safely reusable. In that case fix only the drifted component; do not rebuild the entire Restore environment by default.
