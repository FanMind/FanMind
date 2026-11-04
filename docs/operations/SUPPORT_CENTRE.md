# KI-Support-Zentrale — #1350

Source increment SUPPORT-CENTRE-1350-20261104 on main b9693fb5. Not activated.

## Reuse and separation

The public support launcher, Website Chat AI/session/message/consent/Origin/receipt
binding, customer embed and Inbox handoff already exist. The authenticated
WorkspaceHelpLauncher, coarse diagnostics, automatic read-only checks and
customer-confirmed sync repair also exist. PR #1250 is still open but its public
support continuation was superseded by the merged implementation; do not merge
its stale implementation as a new feature. Open Question PRs #1411–#1414 remain
separate Draft work. No ChatAdmin, Builder, agent-chat, Open Questions, shared
WorkspaceShell, package, lockfile or workflow implementation is changed here.

## New source

- `/admin/support`: existing login and platform-admin gate, separate navigation,
  explicit Workspace selection, dashboard, cases/diagnosis, Owner decisions,
  history and append-only activities. AdminTabs provides the entry link.
- The help panel can explicitly escalate a technical connection problem through
  `/api/support/escalate`. Auth derives Workspace and connection. Only fixed
  platform/problem codes are stored; no free-form error, message or token.
- `FANMIND_SUPPORT_CENTRE_ENABLED` defaults off and does not enable diagnostics,
  Website AI or existing repair/provider flags. Escalation additionally requires
  the existing diagnostics gate. GET diagnostics remains read-only.
- Platform Admin = existing FANMIND_ADMIN_EMAILS policy. Platform Owner = that
  same policy AND the verified auth-user UUID provisioned in the separate
  `support_centre_owners` table. Workspace Owner is not Platform Owner. There
  is no application writer, self-promotion endpoint or user-metadata fallback.
- Cases bind Workspace, exact connection, action and permission. The only current
  action is `refresh_readonly_status` / `read_connection_status`. A fresh Owner
  decision atomically consumes a 30-minute pending case with audit under row
  lock. Replays, expiry, foreign targets and unknown actions fail closed.
- The coarse checking RPC revalidates Owner, running claim, expiry and exact
  connection. Two fresh reads comprise execution and postcheck. No provider
  call or account mutation occurs. Failure remains visible; uncertain completion
  stays running for reconciliation and is never blindly repeated.
- Failed/running cases and unexpired approvals form Owner notifications in the
  selected Workspace. Successful routine checks are only in history/audit.
  This increment does not monitor critical incidents or security events.

## Database and retention

`supabase/controlled/support_centre.sql` is SOURCE ONLY / UNAPPLIED. It is not a
normal migration and no deploy or script applies it. Browser roles have no table
or function access. Service role has SELECT and only fixed RPCs; no direct
INSERT/UPDATE/DELETE/TRUNCATE, including on the Owner table or audit.

Terminal case metadata and cascading events have a 30-day retention window.
Expired pending/running metadata has a maximum 31-day reconciliation window.
The restricted `support_centre_purge()` is not executable by the app service
role and has no installed scheduler. Before activation an authorized maintenance
operator, daily cleanup, monitoring and deletion evidence must be configured.
Without that operation the retention SLA is NOT met. Workspace deletion cascades
cases and events. No conversation evidence or legal holds are copied here;
existing source-system duties and retention continue independently. Actor UUIDs
and connection/workspace identifiers are pseudonymous personal data, not anonymous.

Owner provisioning, maintenance grants and any schema APPLY require separate
review and exact Staging target binding; this source does not perform them.

## Verification and acceptance

Tests are registered through the existing Website Chat and Authorization PG17
suites; package/workflow files are unchanged. The native test creates and drops
its own synthetic database in the existing pinned CI PG17 source container and
checks ACL/RLS, foreign Workspace, expiry, concurrent single claim, postcheck,
terminal idempotency, cascading audit retention and cleanup. It must not be
reported PASS until the exact commit's CI step succeeds. Local mock/contract
checks do not replace native PostgreSQL or real Staging.

Real Staging still needs a reviewed commit, protected schema installation,
explicit Owner UUID, cleanup operator, synthetic Workspace/connection, exact
origin and isolated runtime flags. Test login/logout, Owner/Admin/member,
Desktop/mobile, failed reads/audit, request races, expiry, foreign-tenant input
and removal of temporary state. Do not enable a provider repair for these checks.

## Remaining product work

This increment is a bounded central triage and approval foundation, not full
completion of #1350. Still needed: autonomous critical/security incident intake,
owner-wide notifications beyond the selected Workspace, additional separately
reviewed repair capabilities, integration of existing sync-repair history, and
full authenticated conversational context/continuity with logout/Workspace
reset and unresolved-conversation handoff. Website/widget real Staging acceptance,
knowledge-source freshness, legal/provider gates and production activation remain
separate. Existing customer confirmation is never replaced by Platform Owner approval.

## Local evidence for this increment

- Website Chat suite: 77 pass / 0 fail, including 9 central policy/request/route cases.
- TypeScript, focused ESLint, test-suite ownership and product-truth checks: pass.
- Next production build: pass (initial external dependency symlink rejected by
  Turbopack; rebuilt successfully with local dependencies, no source workaround).
- Independent Security and Privacy source reviews: no unresolved P0/P1/P2 after
  correcting the exact-target reader, retention design and request validation.
- Independent QA: focused tests, typecheck and 4 browser test registrations pass.
  The delayed cross-platform handoff response is guarded by a generation counter.
- Local Browser execution is BLOCKED: Chromium executable absent. Four tests
  could not launch; no browser pass is claimed. Exact-head CI must run them.
- Native PG17 is NOT_RUN locally: no Docker/PostgreSQL capability. The registered
  CI proof must succeed before this controlled SQL is considered verified.
