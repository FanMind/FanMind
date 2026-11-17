# FM-MVP-BILLING-FIELD-PROTECTION-20261117

R3 source preparation for the existing Owner Billing task #1518/#1524 and
central #1512. Scope: existing Workspace ACL contract, its active source pin,
focused existing regression suites and the existing ACL preparation runbook.
Necessary read-only integration: existing monthly SQL verifier/registration/workflow;
no Applycontroller. Detected sql_not_verified contract requires that exact adapter.
No competing Billing PR found; #1500 Capacity work remains separate.

State: SOURCE_PREPARED / DRAFT_PR_1536 / PRODUCTION_NOT_AUTHORIZED.
Main f8b1b91ebd71fa40ae0869090bd3e511c304a37a integrated without overlapping
changes; no protected target action. The apparent old consent blocker is not
repaired with invented terms: the ACL-only step is separated from paid
activation, which retains server evidence checks. DDL/RLS/privilege postflight
bytes remain identical. Historical receipts are immutable.

No new SQL implementation or general provisioning rollout. Existing-only
Recovery artifact stays byte-identical and outside the smallest Apply scope.
No Workspace data, role membership, checkout, subscription, provider or price
change. Exact Production SQL, source merge and release actions require the
single central decision under #1512. No target lock has been acquired.

Receipt: project-memory/receipts/billing-mvp-field-protection-20261117.md.
Scope is frozen after the necessary native/required CI and countercheck;
no unrelated hardening. This source lock is not a Production permission.
