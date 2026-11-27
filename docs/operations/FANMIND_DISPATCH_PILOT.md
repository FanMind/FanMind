# FanMind dispatch pilot

PR #1558 owns the implementation. Issue #1559 is its only order inbox. The existing Production recovery keeps its owner and commit binding.

## Provision once after recovery and reviewed merge

1. Register a private organization GitHub App using the settings in scripts/operations/fanmind-pilot-app-manifest.json. Install on FanMind/FanMind only. Record the numeric App ID and the separate numeric bot user ID. Disable webhooks and grant Actions write. Do not grant repository administration or contents write to the App.
2. Create the fanmind-dispatch-pilot environment, restrict deployments to protected main only, and store the PEM directly as environment secret FANMIND_PILOT_PRIVATE_KEY. Store FANMIND_PILOT_APP_ID as an environment variable. Protect main including workflow changes. Restrict force pushes and deletion of ops/pilot-receipts, and restrict its ordinary writers to the trusted automation where supported. Verify branch protections permit its create-only writes before activation. The job's built-in token requires contents write. GitHub grants this at repository scope; the implementation fixes the branch and file names. Anyone able to alter trusted workflow code, reset the ledger, or administer its settings is inside the trust boundary.
3. In repository Actions variables set FANMIND_PILOT_BOT_ID and FANMIND_PILOT_COMMIT to the verified bot user and reviewed main SHA. At activation set FANMIND_PILOT_ACTIVATED_AT to the actual UTC timestamp with Z and FANMIND_PILOT_ENABLED=true last. Changing issue, time or SHA during this pilot is outside its authorization. Deactivate with false. For immediate credential revocation suspend the App installation and cancel outstanding caller jobs. Check for already accepted runs.
4. Work or Codex submits /fanmind-pilot 1 as a new standalone comment on #1559 via the same authorized GitHub account. Wait for the claim and final result on ops/pilot-receipts. Repeat the same slot from a fresh session and verify that the result refers to the same run and contains the same GitHub job evidence. Then test slot 2. The caller rejects out-of-order slots and caps the sequence at 10. End as soon as accepted. A failed or reserved slot without a visible run stops new orders. Reissue the same comment for readback. Never delete a claim to retry. Investigate with the immutable order and Actions history. No host operations or paid runners are part of this pilot.
5. The GitHub connector must create a qualifying issue_comment event under the authorized numeric account. Verify this live, including event delivery. If the connector suppresses the event or uses a different actor, stop activation and inspect its identity before changing any policy.

## Separate future operational grants

Operation | Proposed scope | Acceptance required before granting
--- | --- | ---
Source and PR | Existing connector, reviewed same-repo branch and ordinary merge, native checks and protection | Existing successful writes, exact head checks and readback of merge
Branch refresh | Existing fanmind-pr-refresh environment and scoped credential from FANMIND_WORKSPACE_BUILDER.md | One opted-in outdated PR updated once, CI at new head
Staging | One approved release SHA at a time, verified Staging target only | Deploy receipt, health/version, rollback drill
Production release | One standard release per approved window, immutable authorized SHA, existing protected reviewer | Green Staging, fresh backups, offsite evidence, tested recovery, release health and version
Backup and recovery | One DB and one full backup per approved order, fixed host; restore only to independently attested isolated target | Host-side durable order claim, effect and receipt, lock, hashes, reconcile ambiguous effects before retry
Monitoring | Read-only existing redacted audit/health output | Target validation and redaction sample
Supabase | Named Staging or Production project, scoped read-only checks; SQL writes only for separately approved migration hash | Negative target test and schema/postflight proof
Stripe | Read-only named FanMind account and mode, no payments, refunds, bank or payout changes | Verify account/mode and redacted result
Exoscale | Initially inventory and monitoring for named instances only | Readback of instance identity and denial of write
Workspace agents | Editor on designated existing agents only | Match role, publish, reopen, and test routine and protected cases

For future Production admission, retain the personal path. A separate technical path must require both the exact installation/bot binding and an independently owner-authorized, revocable order covering target, commit, hashes, amount, deadline and permitted actions. An agent with dispatch rights must never issue its own authorization. Require terminal host evidence or verified rollback under one lock. This proposal grants no Production authority and the pilot never uses that path.
