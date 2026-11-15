# Support #1350 — controlled Staging rollout continuation

Status: PREPARATION ONLY. PR #1416 is merged at
`f8ed24bd12c3445732abcd46b9d3f42bfad55334`; its product acceptance is retained.
This continuation does not reopen or repeat that implementation. No target write,
Owner grant, schedule activation, environment-variable change or deployment has
been authorized by this document. The old #1416 merge authorization is consumed.

## Verified target and exclusive scope

On 2026-11-04, read-only catalogue inspection of FanMind Staging
`vshyhvgcmrlagvfnvomc` found all six Support tables and their functions absent;
`support_repair_audit` already exists and is excluded from CREATE/DROP. No
`pg_cron` is installed. Production `drqkpdvtbbrrdwmtrodz` is forbidden.
Main remains the merge above. Parallel Admin Chat/Open Questions source, their
locks, existing work orders and existing audit data are excluded.

The base controlled SQL contains **six tables, sixteen functions, two triggers
and one identity sequence**, rather than only the ten functions previously
sampled. Operations adds one retention-receipt table and four functions, replacing
only the legacy unaudited purge body. The reviewed install is therefore seven
tables, twenty function signatures, two triggers and one sequence. The executable
manifest lists every name plus SHA256 of both SQL files. It is not a normal
`supabase db push` migration; neither SQL file is auto-applied by application deploy.

## Scope-separated release gates

| Step | Required evidence / approval | Effect |
|---|---|---|
| Source review | Required CI, independent new source QA/security/privacy, exact head | One follow-up Draft; no target change |
| Independent reference | Synthetic PG17 source DB; candidate from CI, committed hash/manifest and exact reproduction in next CI | Never learn desired state from Staging |
| Schema apply | New explicit Owner approval for this exact main source and Staging project; protected `staging` job and shared write lease | Create only reviewed Support objects; no Owner or feature activation |
| Owner binding | Separate approval identifying exact confirmed, unbanned existing auth UUID; protected existing Staging Admin email allowlist must match | Insert one platform-Owner UUID; no auth/IAM/workspace changes |
| Synthetic fixture / app deployment | Existing authorization must actually cover exact source, target, synthetic fixture actions and default-off gates | Deploy through existing protected workflow; no Production |
| First retention | Explicit authorization for physical deletion on this Staging target, exact source and synthetic scope | Run receipt and per-category counts |
| Daily activation | Separate approval for schedule and exact reviewed source; set `FANMIND_SUPPORT_RETENTION_SOURCE_COMMIT` and `FANMIND_SUPPORT_RETENTION_SCHEDULE_ENABLED=true` through existing authorized settings process | Existing protected workflow runs daily at02:23UTC, health every6h |
| Final acceptance | Runtime identity/isolation/deletion/consent evidence, independent QA/security/privacy | Overall PASS only after live proof |

Existing Creator, ChatAdmin and Website Chat write approvals do not silently extend
to these new steps. No Owner UUID is guessed from Workspace or GitHub ownership.
Source merge itself must follow repository rules and applicable authorization.

## Controlled installer and failure handling

Reuse `.github/workflows/website-chat-retention-staging.yml`, component `support`,
protected `staging` environment, existing TLS CA and Staging credentials, exact main
commit, existing `fanmind-website-chat-staging-write` concurrency. Website actions
remain separately gated. Schedules are inert unless explicitly enabled. The runner
rejects wrong project/host/user/TLS/origin, feature branches, stale manual checkout,
ambiguous confirmation, libpq redirects and plaintext password overrides. Password
files use the existing private snapshot mechanism and are removed after the job.

First run `--check` offline, then `--verify` as an explicit read-only job. Empty
catalogue classifies ABSENT, never PASS. Approved `--apply` installs only on ABSENT;
EXACT is an idempotent no-op; partial state, extra policies/views/functions/defaults,
changed ACLs or bodies classify DRIFT and stop. Missing reference stops execution.
The installation is one transaction with an advisory lock, short lock/statement
timeouts, an absence guard, exact full-catalogue postflight before COMMIT and an
independent readback. Unexpected default grants cause rollback, rather than changing
global Supabase default privileges or revoking an unknown application's permissions.
Required parent objects are existing `auth.users`, `workspaces`, `social_connections`
and standard Supabase roles. A missing/incompatible FK dependency aborts atomically.

Rollback before activation: approved `--rollback-empty` takes exclusive table locks,
rechecks full reference inside the transaction, rejects **any** row (including
Owner/receipt rows), removes known triggers/functions and tables in dependency
order, without CASCADE, then verifies ABSENT. Failure rolls back the whole operation.
After data exists: disable only the Support gates/schedule through authorized
configuration; preserve data and forward-fix after review. Never automatically DROP
populated objects or erase customer data to make rollback possible. Existing audit,
Auth, workspaces, provider records and Production remain untouched.

## Retention contract and evidence

| Data | Due for physical cleanup |
|---|---|
| Support turns | Older than30days |
| Idle empty private threads/consent and handoff notice | Older than30days; thread locked and eligibility re-read after lock |
| Terminal case/events | Completed more than30days ago |
| Pending/running case/events | Approval expiry more than31days ago |
| Notifications | Older than30days, or deleted case/thread reference |
| Retention receipts | Completed more than90days ago |

No user messages/provider errors/emails enter the receipt. It contains run UUID,
source commit, UTC day, status, attempts, timestamps, counts and fixed SQLSTATE only.
Global Owner health is served through verified Admin + exact platform-Owner policy;
ordinary Admins/customers cannot inspect other Workspace data or invoke purge.
The Owner inbox shows missing/stale/failed daily evidence as an alert; routine
successful deletions create no incident notification.

Each GitHub run gets a deterministic UUID, reused across at most three attempts.
An advisory lock prevents overlap; one daily successful receipt prevents duplicate
physical deletion. SQL deletion failure rolls back that deletion subtransaction
and persists a failed receipt; an explicit same-run retry can resume after correction.
The old unaudited purge raises an error. At most10000 due turns /10000 cases /
20000 notices are supported per run: excess backlog produces a failed receipt,
not a false success. An operator must review a bounded catch-up plan; no automatic
large deletion escalation is allowed. This guard is intentionally not an unlimited
batch worker. The first synthetic acceptance must test this boundary.

Cancellation, lost connection and server outage can roll back the entire transaction,
including its receipt. A successful Actions job without a successful SQL receipt is
insufficient. Keep the protected Actions result as independent failure evidence;
health fails when the latest status failed or no success exists within30hours.
GitHub can delay/skip schedules: check both job history and DB health. A supported
operator must watch failures/staleness; no delivery to a human is claimed merely
because the workflow is red. Re-run the same authorized run after diagnosis, max3;
never log passfiles, queries containing account emails, customer text or raw stderr.

## Synthetic final acceptance (only after authorization)

Use two existing isolated synthetic identities/workspaces plus exact approved Owner
and a separate ordinary Admin. Record source SHA, deployed health SHA, project,
workflow URL, clock and fixture IDs in a restricted receipt. Test Desktop/Mobile,
login/logout/account switch, persistent reload, ambiguous retry without duplicates,
older pages, API/storage failures and recovery. Verify cross-tenant reads/cursors,
Owner-global coarse notices and ordinary Admin denial. Verify customer consent
snapshot, later-message exclusion and single-action approval expiry/replay.

Run new privacy export/erase, stale-scope/extra-field/foreign-Origin rejection,
newer-message and recreated-thread replay protection. Confirm physical deletion
of raw own turns/thread/consent/handoff notice and preservation of the foreign
fixture. Verify due metadata cleanup, exact per-category counts, repeat UUID/daily
no-op, simulated failure/retry and stale/missing health. Run protected monitoring
and link actual successful deletion receipt. Clean up only approved synthetic data.
Independent reviewers must review this **runtime** evidence; source PASS is not
Staging acceptance. Feature activation remains off until all gates are met.
