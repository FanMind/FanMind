# Staging Support/Media control — prepared, not activated

Scope: FM-CONTRACT-CHATADMIN-AI-001 and FM-CONTRACT-CHATADMIN-STORAGE-001, Support repair persistence and
Workspace authorization. Production deployment, schema mutation, provider/image
analysis, billing and delivery remain excluded. Main is unchanged at5414f53d.

The new manual workflow requires protected staging, exact main/deployed source,
fixed Staging project/origin, the existing Owner binding and recent same-source
retention receipt. It takes the existing Staging deployment lease. Preflight is
read-only: full pinned Support reference plus full Media catalogue/reference,
including policy predicates/commands/roles, grants, function bodies and triggers.
Native PG17 source recreation and mutation negatives must pass required CI before
any use. The local environment cannot run that native test; SKIP is not PASS.

The host step compares the existing systemd unit and root:fanmind-staging:640
secret-file boundary. It changes only Support/Media flags and pins analysis false.
Private override files cannot redefine those flags. A per-run mode0600 fsynced
receipt records only prior flags, action, source and run before writing. The actual
service process flags and live release are checked afterward. Failed activation
restores prior configuration and verifies prior effective flags and release.
Concurrent configuration changes stop rollback rather than overwrite another
operator. Failed deactivation never restores enabled flags and reports unresolved
reconciliation. Private receipts survive interruption; never upload environment
files or process environments. No new sudo right or resource is installed.

Recovery: use the reviewed deactivate action; preserve data and schema. A prepared
receipt without a verified completion requires comparing its prior flags with the
current effective service flags before retry. No automatic retry of an uncertain
activation. Actual Support/media browser/file acceptance remains required.

The existing ChatAdmin verifier now emits allowlisted expected/actual counters
before its unchanged exact assertions. An independent deterministic reproduction
shows ten successful generations can yield0,2or10 quality-rejected usage events.
Exact error-count2 is not a valid invariant. Historical actual counts were erased
by the successful authorized cleanup, so no historical cause or application data
loss is asserted. Do not replace it with a looser range: exact per-attempt witness
evidence is required to prove complete usage recording. The current application
records usage best-effort; its successful response alone is not that evidence.

Main-only execution is an intentional gate. This branch cannot run the new
control or diagnostic against the target while Main must remain unchanged.
Do not change the workflow to accept an unreviewed feature branch to avoid it.

## Owner-authorized Staging widget completion — 9 November 2026

The Owner explicitly requests completion on isolated Staging. `prepare-widget`
uses the existing exact-main/deployed-source/protected-Staging control and full
read-only schema/Owner/retention preflight. It generates one 32-byte internal
session-signing secret directly on that existing host, only when missing; it
never rotates a configured secret or transfers a Production key. A duplicate,
nonempty invalid value or override is rejected. The existing private file,
concurrency lease, service restart authority, durable boolean-only receipt and
byte-exact rollback are reused. Support/media/analysis/diagnostic/repair/email
switches stay unchanged. The secret is never logged, returned or stored in an
artifact. A configured key does not enable an installation or prove a message.

The existing Support customer acceptance workflow gains `widget_only=true` and
an explicitly supplied synthetic `widget_workspace_id`. It rejects mixed modes,
wrong targets and unmarked/non-synthetic/Owner workspaces. It requires exactly
one disabled installation with the existing, unverified Staging origin, no
session/receipt/handoff and no existing Website Chat contact. Existing unrelated
contacts are counted and preserved. Its limited fixture transaction temporarily
enables that installation and processing only for the marked test workspace.

The real closed-Shadow-DOM widget executes on `/support` in desktop/mobile
Chromium via ordinary mouse/keyboard input; no Shadow DOM protection is changed.
The actual public session/message/handoff routes are exercised with visitor
session tokens, never a service-role browser identity. Tests cover no session on
mount, consent denial, persisted ingestion, duplicate-send idempotency, foreign
Origin and expired-session denial, plus consented synthetic handoff storage.
The optional widget AI reply request is explicitly aborted, never mocked as
success. No external provider or email send is made. Widget reply quality and
real email/Meta delivery remain separate external acceptance, not a condition
silently marked green by these tests.

Cleanup disables the installation in its own committed transaction first,
then removes only the new receipt-bound synthetic contacts (existing FK cascades
remove their conversations/messages/handoffs), removes its visitor sessions,
restores the original unverified origin and exact prior processing flags, and
independently compares all six row counts with baseline. A changed fixture
marker/other flags stops restoration rather than overwriting another operator.
A cleanup failure is explicit; never count that run as PASS or blindly repeat it.
The signing secret remains available for later authorized Staging tests; the
installation returns to disabled. No schema, new account/role, infrastructure,
Production, Billing, legal approval or external connection is added.


The same controller separately offers `activate-diagnostics` and
`deactivate-diagnostics`: only the existing read-only diagnostic and safe-status
check switches change. Owner/schema/retention/source gates and unchanged
Support/media/analysis/repair/email state are verified. Deactivation remains
available with the existing fail-closed stop behavior. Confirmed provider repair
stays disabled. `verify_diagnostics=true` in the existing customer acceptance
uses both real isolated customer sessions to check safe redacted own connections,
a true read-only status check, forbidden credential change and hostile Origin.
No external repair or successful provider connection is inferred.
