# FM-RST-001 — DB_POSTCHECKED evidence matrix — 2026-09-07

Purpose: enumerate the canonical `DB_RESTORED -> DB_POSTCHECKED` predicates without promoting the state prematurely.

| Predicate | Current evidence | Classification |
|---|---|---|
| Exact isolated target / PostgreSQL 17 | issue #944 final chain; target `fanmind-restore-01`, PostgreSQL 17.11, database `fanmind_restore` | PROVEN |
| Transactional database Restore committed | workflow `33178878764`, database job `98874745740`; final reconciliation `5453857592` | PROVEN |
| Restore not repeated | final reconciliation/accepted database-phase receipt | PROVEN |
| Owner / ACL / default-ACL authorization contract | receipt-bound authorization contract plus completed projected expected/actual fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`; PR #1075 fixes target-only principal projection | PROVEN_AT_AGGREGATE_FINGERPRINT |
| Missing schema ACL delta | exactly eight schema-USAGE grants completed under one-shot authorization `5453727223` | PROVEN |
| Role contract | source contract 23 roles / 44 records; isolated target-only bootstrap principal explicitly projected out only after unique-login/superuser proof | PROVEN_AT_CONTRACT_BOUNDARY |
| Database-container contract | issue #944 post-failure reconciliation states database-container fingerprint already matched exactly | PROVEN_AT_FINGERPRINT |
| Extension contract | five required extensions; extension fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` already matched exactly | PROVEN_AT_FINGERPRINT |
| Core application grants | count 120 matched exact contract | PROVEN |
| Restricted SECURITY DEFINER boundary | count 12 matched exact contract | PROVEN |
| Core tables / RLS / policies | final core postcheck `5|5|5|5`; all five core tables present, RLS enabled and policies present | PROVEN |
| Schema/data/accounting predicates beyond the published aggregate/fingerprint evidence | canonical state machine requires explicit receipt-bound reconciliation; public issue summaries do not expose every underlying private receipt field | RECONCILIATION_REQUIRED |
| Temporary plaintext cleanup | `PASS` | PROVEN |
| No Production / Supabase-Staging mutation | final issue/receipt chain | PROVEN |

Decision: remain at `DB_RESTORED`. The next work is to map the private/immutable database postcheck receipt fields to the remaining schema/data/accounting predicates. If an exact predicate is not present in retained receipt evidence, acquire only a bounded read-only target proof. Do not rerun the Restore to recreate evidence.
