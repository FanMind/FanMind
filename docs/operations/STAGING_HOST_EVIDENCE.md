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

## Administrator evidence intake (no changes, no dispatch)

This section is a read-only collection checklist for a FanMind administrator.
Do not save, change, enable or create anything while following it. If a named
page or value is unavailable, record that item as UNKNOWN. An Owner statement is
context only and never replaces the screenshots below.

Keep all screenshots in the already approved private Evidence channel. Before
taking each screenshot, close developer tools, password managers and unrelated
tabs. Show the browser address, page heading, relevant setting and UTC clock.
Crop unrelated content. Cover tokens, secret values, API-key material, signed
URLs, internal hostnames/IPs, bucket/object names, organization IDs, unrelated
repository names and personal data with an opaque rectangle. Do not blur: blur
can be reversible. Do not cover the setting value being proved.

### Evidence group A — GitHub Environment `staging`

1. Sign in as a GitHub repository administrator and open
   [Repository Settings / Environments](https://github.com/FanMind/FanMind/settings/environments).
   Select the environment named exactly `staging`. A direct edit link may also
   work: [staging settings](https://github.com/FanMind/FanMind/settings/environments/staging/edit).
   Do not open or reveal any Environment secret.
2. Confirm these four visible protection rules without changing them:
   - **Required reviewers** is enabled and names at least one person or team
     independent of the person who starts the later run.
   - **Prevent self-review** is enabled.
   - **Allow administrators to bypass configured protection rules** is disabled.
   - **Deployment branches and tags** uses selected/custom rules and allows
     branch `main` only; no tag, wildcard, fork or other branch is allowed.
3. Capture `ENV-1`: one screenshot with the address bar, `staging` heading,
   Required reviewers, Prevent self-review and the disabled administrator-bypass
   control. Reviewer names may be replaced by stable labels such as
   `REVIEWER-1`, but the independent reviewer role must remain visible.
4. Capture `ENV-2`: the complete Deployment branches and tags section plus the
   expanded rule list showing exactly `main`. If the list does not fit, use
   numbered continuation screenshots with the same page heading and no gap.
5. Capture `ENV-3`: the bottom of the environment page showing that the
   preceding screenshots cover the complete protection/settings page. Redact all
   secret/variable names and values; only the section headings and item counts
   may remain. Never click a secret or use an edit/delete control.

GitHub's control meanings are documented in
[Managing environments for deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

### Evidence group B — GitHub Self-hosted Runner

1. Open [Organization Settings / Actions / Runner groups](https://github.com/organizations/FanMind/settings/actions/runner-groups).
   Locate the group containing runner `fanmind-staging-01-exoscale`. Record the
   exact displayed group name; do not assume or rename it. Open that group.
2. Capture `RUNNER-1`: group heading and complete **Repository access** control.
   It must be `Selected repositories`, and the expanded selected list must show
   `FanMind/FanMind`. Redact unrelated repository names. If any other selected
   repository could submit work to this runner, leave it visible as
   `UNEXPECTED-REPOSITORY` and classify FAIL.
3. Capture `RUNNER-2`: complete **Workflow access** control and its expanded
   selected-workflow list. Restrictions must be enabled. The evidence workflow
   entry must be bound exactly to
   `FanMind/FanMind/.github/workflows/staging-host-evidence.yml@refs/heads/main`.
   Every additional allowed workflow must likewise show an exact
   `@refs/heads/main` binding and be listed for reviewer assessment. A wildcard,
   tag, pull-request ref, feature branch or unbounded workflow is FAIL.
4. Open [Organization Settings / Actions / Runners](https://github.com/organizations/FanMind/settings/actions/runners)
   and select `fanmind-staging-01-exoscale`. If GitHub instead exposes it at
   repository level, use [Repository Settings / Actions / Runners](https://github.com/FanMind/FanMind/settings/actions/runners).
5. Capture `RUNNER-3`: the complete runner detail header showing the exact
   runner name, its group and current status, plus the full labels list. Required
   labels are `self-hosted`, `fanmind-staging`, `exoscale`, `linux`, and
   `x64`. Do not show registration commands, registration tokens, diagnostic
   logs, host addresses or service credentials.
6. Capture `RUNNER-4`: the group page footer or continuation proving the
   Repository access and Workflow access lists were complete. A repository
   source file containing `runs-on` is supporting context only, not proof of
   current runner-group restrictions.

GitHub explains these controls in
[Managing access to self-hosted runners using groups](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access).
Because the repository is public, any incomplete repository/workflow/ref
restriction is a blocking failure, not a documentation detail.

### Evidence group C — existing Exoscale Object Storage channel

1. Open the [Exoscale Portal](https://portal.exoscale.com/) and choose
   **Storage**. Do not create a bucket, role, key, policy or lifecycle rule.
   Identify the already existing bucket previously approved for FanMind
   Host-Evidence by matching the administrator's approved inventory/change record
   to its zone and purpose. A convenient or similarly named bucket is not proof.
   If no prior approval record exists, classify the channel UNKNOWN.
2. Capture `SOS-1`: bucket overview with zone, private/public state and the
   approval-record reference. Replace the real bucket name with the same opaque
   label, for example `EVIDENCE-BUCKET-1`, in every screenshot. Do not expose an
   endpoint, object key, host name or signed URL.
3. Open the bucket/object ACL view (Storage, bucket, edit). Capture `SOS-2`:
   complete bucket ACL and, if a dedicated prefix/object is used, its separate
   ACL. It must show no public or anonymous read/write and no broad authenticated
   access. Exoscale ACLs are not inherited, so bucket-only evidence is incomplete
   when object or prefix ACLs differ. See [Exoscale ACL documentation](https://community.exoscale.com/product/storage/object-storage/how-to/acl/).
4. Open IAM and the existing roles/policies used by this channel. Capture
   `SOS-3`: redacted policy/role readback showing default deny, the single
   approved bucket/prefix scope, the Operator's minimum write permission and the
   independent Reviewer's read-only permission. Show stable role aliases, not
   people, organization IDs, API-key IDs, access keys or secrets. Owner control
   alone is insufficient; Operator and Reviewer must be distinguishable.
5. Capture `SOS-4`: encryption readback showing HTTPS/TLS transport and
   encryption at rest for this existing bucket/object (`SSE-SOS` or the
   separately approved equivalent). Never display customer-provided encryption
   keys or key fingerprints. See [Exoscale encryption documentation](https://community.exoscale.com/product/storage/object-storage/how-to/encryption/).
6. Capture `SOS-5`: the exact existing retention evidence: enabled lifecycle
   expiration and version handling, or existing versioning/object-lock retention,
   together with the approved retention duration and deletion owner. Do not enable
   these features during intake. Portal support can be incomplete, so a signed,
   read-only CLI/API readback may be included in the protected package. See
   [bucket lifecycle](https://community.exoscale.com/product/storage/object-storage/how-to/bucketlifecycle/)
   and [versioning/object lock](https://community.exoscale.com/product/storage/object-storage/how-to/versioning/).
7. Capture `SOS-6`: the existing operating record naming the Operator,
   independent Reviewer, who may grant/revoke access, the permitted receipt
   purpose, review deadline and deletion/retention procedure. Use role aliases in
   screenshots. An administrator's verbal confirmation without ACL/IAM and
   retention readback does not pass.

Place `ENV-*`, `RUNNER-*`, `SOS-*` and a one-page manifest in one protected
package. The manifest contains capture UTC, evidence-group names, screenshot
numbers, collector target `FanMind/FanMind` / `staging`, and an opaque package
reference. Transfer it only through the already approved channel to the named
independent reviewer. Do not use a public issue/PR attachment, Actions artifact,
email, ordinary chat or a newly created share. If no approved transfer route can
be demonstrated, keep the package local and report UNKNOWN.

Public issue #1346 may receive only: opaque package reference, capture UTC,
reviewer role alias, and sanitized PASS/FAIL/UNKNOWN per group. Never publish the
screenshots, bucket/object identifiers, endpoints, internal host/runner details,
reviewer identities, ACL principals, organization/API-key IDs, secret or variable
names/values, tokens, credentials, signed URLs, encryption material, backup
identifiers, sensitive hashes, raw policies or retention inventory.

## Administrator evidence acceptance contract

The independent reviewer records one result for every row. PASS requires complete
current technical readback; an Owner/administrator statement alone is not PASS.
FAIL means the visible configuration contradicts the contract. UNKNOWN means the
control cannot be established from complete, readable and provenance-bound
evidence. UNKNOWN blocks release just like FAIL but does not claim the system is
misconfigured.

| Evidence | PASS | FAIL | UNKNOWN |
| --- | --- | --- | --- |
| Environment `staging` | All `ENV-1..3` are current and complete; required independent reviewer, self-review prevention, no admin bypass and exactly `main` are visible. | Any rule is off, missing, bypassable, permits another ref/tag, or exposes confidential data. | Page/list is cropped, stale, unreadable, lacks URL/time/provenance, or settings cannot be viewed. |
| Runner group and runner | `RUNNER-1..4` bind the named runner and exact labels to a group restricted to `FanMind/FanMind` and reviewed workflows at `refs/heads/main`; every extra allowed workflow is assessed. | All-repository access, unexpected repository, unrestricted workflow, wildcard/non-main ref, wrong group/runner/labels, or secret/log exposure. | Group membership, complete repository/workflow list, exact ref, labels or current detail state is not technically shown. |
| Private SOS channel | `SOS-1..6` bind a previously approved private destination to private ACLs, least-privilege bucket-scoped IAM, separate Operator/Reviewer roles, at-rest/in-transit encryption and explicit existing retention/deletion rules. | Public/broad access, unscoped or shared write authority, reviewer can write, encryption absent, retention contradicts approval, newly invented destination, or secrets included. | Prior approval, exact destination binding, object-level ACL, IAM scope, role separation, encryption or retention cannot be proven. |

Collector release is allowed only when all three groups are PASS, the protected
package is readable by the independent reviewer, capture time is still current
for the planned source review, and no contradictory evidence exists. Any FAIL or
UNKNOWN keeps `privateChannel`, `environmentProtectionVerified`,
`runnerScopeVerified` and `hostCollectionEnabled` unchanged and false.
Do not edit the policy or implement/unseal the collector merely because screenshots
were delivered. Evidence acceptance first requires a separate reviewed source
change, exact-head CI and the existing protected authorization sequence.

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
