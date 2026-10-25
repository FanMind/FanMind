# Capacity v2 Staging baseline classification source handoff

- Task: FM-AI-001 / FM-CR-052, existing continuation.
- Risk: R3 repository diagnostic under the existing R4 Capacity lock.
- Base: `7368305db778165d6a6dd8f83265445a6863a25b`.
- Branch: `fix/capacity-v2-baseline-diagnostics-20261025`.
- Trigger evidence: read-only run `40224444403` blocked only on `schema_md5` and `capacity_generic_migration_marker_absent`.
- Change: boolean-only checks classify three budget-column defaults and known foundation, activation-gate, lifecycle or unknown Capacity migration markers. Existing aggregate fingerprint, generic marker and baseline values remain unchanged.
- Safety: output remains an allowlist of field identifiers. Hashes, marker identities, SQL definitions, credentials and child-process output are never rendered. Every mismatch remains `BLOCK`; apply mode remains disabled.
- Local evidence: preparation boundary 2/2 PASS; transport/redaction/negative harness 44/44 PASS. PostgreSQL 17 roundtrip and complete exact-head CI remain PR gates.
- Recovery: repository-only revert of the diagnostic commit. No target state changed and no database rollback is applicable.
- Forbidden and not performed: Staging dispatch, database read/write, migration, marker edit, baseline reconciliation, merge, deployment, provider access or Production action.
