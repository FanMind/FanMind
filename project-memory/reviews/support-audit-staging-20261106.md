# Support audit Staging continuation – 6 November 2026

Task FM-SUPPORT-AUDIT-STAGING-20261106-01, directly assigned by Owner. R3.
No delegation per explicit instruction; targeted countercheck uses the independent
immutable SQL classifier, native isolated PG17 and target-side rollback proof.
Contracts FM-CONTRACT-SOCIAL-CRM-001 / FM-CONTRACT-REG-ENTITLEMENT-001 and their
FM-IGATE equivalents retain their authorization/tenant/provider boundaries.

Owner explicitly approved the prepared Staging-only audit schema upgrade,
synthetic acceptance, rollback test and necessary bounded corrections. Main and
live Staging both017b4fc81b3cc107c888fd610bf0862c2d4e0761 at fresh preflight.
Production remaineda798d7938bb4e7e168f615f0c32d1a603dd47d4a. Projects independently
identified: vshyhvgcmrlagvfnvomc Staging, drqkpdvtbbrrdwmtrodz forbidden Production.

Read-only target evidence: auditDRIFT,11columns,0rows, no inbound FK or custom
trigger; exact legacy fingerprint5be8a062a7627b88d5f710b9928fd669; RLS enabled
and browser roles denied. Existing marked workspace and synthetic actor verified;
no synthetic Owner binding, chat thread or Social connection already exists.
No target apply yet at this source-preparation point.

The prepared original SQL is not changed or duplicated. Missing execution wiring
is added to the existing protected Support workflow: audit-verify, audit-upgrade,
audit-acceptance. It reuses the full core catalogue and effective-role checks,
exact target/user/TLS/passfile guards, the workflow write lease and both transaction
advisory locks. Manual current-Main/checkout/live-release binding is mandatory.
Unexpected fingerprint, rows, dependencies, source hash or classifier output fails
closed. Only the exact empty legacy shape can upgrade; INSTALLED is a no-op.

The new rollback fixture has only fixed synthetic contents and a token-free
expired connection. Platform Owner test binding is transaction-only. Actual
installed functions prove Owner/non-Owner, Workspace/Connection, approval, failed
status history, replay, paging, consent snapshot, erasure and retention health.
Audit tuple/status completion probes match the unchanged application writer.
No external provider adapter is invoked. HTTP tests prove anonymous denials
without setting runtime flags or supplying authentication.

Native PG17 must prove rejected nonempty upgrade preserves11columns/data, exact
original upgrade, independent INSTALLED classification, rollback-only synthetic
acceptance, zero residue and unchanged installed schema. Local native tests skip
when no container exists, never PASS. Existing required Support suites own all
added tests. Local policy/route suite9/9PASS; exact-head CI and live protected
results remain to be recorded in final task evidence.

Recovery: failed SQL transactions roll back at connection close; after a committed
upgrade never drop/revert the schema merely because acceptance fails. Read back
the immutable classifier and zero synthetic residue, repair the actual cause,
then rerun only the necessary approved acceptance. No Production, secrets,
provider configuration, persistent permission change or generic migration push.
Retain previous valid ChatAdmin/Website evidence when exact application source,
schema/config and target bindings remain unchanged.
