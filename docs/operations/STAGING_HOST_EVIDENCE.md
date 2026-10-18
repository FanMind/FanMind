# Staging host evidence — source preparation for issue #1346

Status: **BLOCKED**. This source scaffold cannot collect host evidence or produce
HOST_EVIDENCE_READY. No dispatch or Staging access is authorized by this task.
It is deliberately not a functioning collector with an invented private sink.
PR #1345 remains unchanged; its offline PostgreSQL proof is a separate prerequisite.

## Verified source and unresolved execution prerequisites

Preparation starts from main `f36e630c73d3820a61aef593a705d241600e7f47`.
PR #1345 is open/Draft at `6307861c78460283cd471d89417c0442537cad09`.
The existing deployment workflow specifies Environment `staging`, runner labels
`self-hosted, fanmind-staging, exoscale, linux, x64`; provisioning names the runner
`fanmind-staging-01-exoscale`. These are source contracts, not a current registry
or Environment-protection attestation. The permitted GitHub connector cannot read
`environments/staging` or `actions/runners`; no alternate access was attempted.
The Owner's administrator status does not prove those technical controls.

The repository is PUBLIC. Existing `actions/upload-artifact` uses do not establish
confidential download access. Environment approval, artifact retention and local
0600 permissions do not restrict public-repository artifact readers. No already
approved private Host-Evidence channel with bound audience, ACL, retention and
provenance verifier was found. Backup offsite encryption, ignored Legal/Mobile
evidence folders and prior manually shared evidence are different contracts.
They are not authorization to create or repurpose a Host-Evidence transport.

The fixed `staging-host-evidence-policy.json` truthfully records all three missing
bindings and `hostCollectionEnabled:false`. It is SHA256-bound by the policy
module. Dispatch inputs, environment variables and CLI switches cannot replace
or approve it. Even changing that file alone fails its checksum. A reviewed
source update, with an actual existing approved channel and adequate controls,
is necessary before a collector could be implemented and admitted.

## Current workflow and tests

`.github/workflows/staging-host-evidence.yml` has only workflow_dispatch, only the
required Self-hosted labels and Environment staging, read-only repository token
permissions, exact repository/name/ID, main/workflow ref and reviewed source SHA
checks, no retained checkout credential and no install/setup/deploy/SQL/host
collection/upload step. It serializes using the existing deployment concurrency
key without cancelling a running job. This concurrency key alone cannot exclude
all manual/capability/acceptance writers and is not lock-holder acknowledgement.

Only a pinned checkout and repository-only admission script exist. The latter
receives an explicitly allowlisted clean environment through env -i and outputs
three fixed lines: BLOCKED, one fixed reason, and host diagnostics not attempted.
There is no host reader, arbitrary command/path, process/secret dump, DB client,
provider request, receipt file or evidence upload. No dispatch input can unseal it.
Ordinary ephemeral Actions checkout/workspace activity is distinct from reading
application/host state. This preparation must not be dispatched to test its gate.
It does not verify current remote main after queueing; a future functioning
collector must add that fresh main/authorization check before any host collection.

Run locally with `node --test tests/staging-readiness-policy.test.mjs`. The new
cases are imported by that already registered Operations suite; package.json and
existing workflow files remain unchanged. Tests cover wrong repository/ID, event,
branch, source/workflow ref, run ID/attempt, environment and runner; secret and
workflow-command injection; attacker channel/path/approval variables and CLI
switches; source policy tampering; and absence of collection or transport steps.
Only synthetic fixtures and repository files are used.

## Requirements for a later reviewed collector

Resolve the named channel with existing approval evidence, exact destination and
access audience/ACL/retention, protected credential provenance, transport and
receipt-verification contract first. Validate actual Environment protection,
no untrusted ref/runner eligibility, current runner group/labels/repository scope
and operator approval without changing their existing rules. Unknown means BLOCK.
A future implementation needs independent source review and new exact-head CI;
the present workflow must not be called EVIDENCE_WORKFLOW_READY.

Collect only a bounded redacted receipt through that approved channel:

- UTC observation time and trusted host/boot identity; reviewed workflow and actual
  running release SHA, service/invocation identity and process UID/GID/executable.
  Read a strict systemd property allowlist; never print Environment, complete
  ExecStart/command lines, journals, PM2 environment or service contents.
- Runtime staging and only Supabase project reference `vshyhvgcmrlagvfnvomc`;
  allowlisted security switches, preview IDs/keys and current-facts settings only
  as present/unset. Never include their values, hashes, full URLs or identifiers.
- Identified Preview/autogrant/manual-flow/acceptance writers, including
  ensureStagingChatAdminCapability, and verified durable exclusion. Presence/unset
  does not establish flag value or absence of capability grants. Do not call
  preview, health or model routes that could themselves cause an autogrant.
- Bounded worker/timer/cron identity and state; actual backup artifact opaque ID,
  timestamp, size and trusted checksum/verification/retention/offsite metadata.
  No content reads, decryption, database queries or restore on Staging. Metadata
  alone cannot prove backup correctness, durable exclusion or recovery success.
- Dated affected lock-holder acknowledgement and sequence. Root-only unreadable
  facts remain unavailable; no sudoers change or installation may fill a gap.

Reject unsafe/unexpected fields before public output, including workflow-command
injection and token-bearing paths/URLs/names. Never attach host/backup identifiers
or sensitive hashes to the public issue/logs. An existing protected receipt may
be referenced publicly only by its approved opaque identifier and safe summary.

## Later one-time administrator authorization — not given here

After channel/protection/runner prerequisites, holder coordination, functioning
collector review, required CI and separately authorized merge:

1. An administrator records one dated authorization in issue #1346 for exactly
   one workflow_dispatch on the exact reviewed current main SHA, repository,
   workflow, Staging project, existing runner and approved private channel. Bind
   operator, validity window, single attempt and both relevant lock holders.
2. The authorization expressly excludes deploy, install, DB/SQL, flag/capability
   writes, provider calls, direct backup-content read/decryption and host restore.
   Existing staging Environment approvals remain required and unchanged. The
   administrator dispatches once; this source task does not dispatch or merge.
3. Before collection, recheck current main/authorization, trusted host/running
   release, channel ACL and no overlapping writer. A failed/partial run preserves
   its status; no automatic retry or reused authorization.
4. An independent reviewer reads the protected receipt, verifies provenance,
   source/run/attempt/target binding, freshness, strict redaction, exclusion proof,
   actual backup metadata/isolated recovery authority and dated holder signatures.
   Unknown fields keep BLOCKED. Only then may issue #1346 become
   HOST_EVIDENCE_READY; never INSTALL_READY or installation/activation authority.

Recovery now is a reviewed source revert. There is no runtime cleanup to perform.
