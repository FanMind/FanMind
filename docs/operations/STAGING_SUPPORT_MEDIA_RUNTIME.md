# Staging Support/Media control — prepared, not activated

Scope: FM-CONTRACT-CHAT-ADMIN-MULTI-CHARACTER, Support repair persistence and
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
