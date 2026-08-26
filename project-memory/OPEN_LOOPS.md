# FanMind Open Loops

This register contains started, partially completed or follow-up work that could otherwise disappear between sessions. Do not use it as a second task backlog; link each loop to an existing task/change ID whenever possible.

## FM-LOOP-001
- Related: FM-RST-001
- Status: OPEN
- Updated: 2026-08-26
- Gap: Recovery code/backup/host foundation is advanced, but the complete isolated DB/Storage/Server-config/Cleanup/Evidence drill is not accepted end-to-end.
- Close when: exact artifact-bound isolated restore has passed current R4 quorum and independent countercheck, including cleanup and final evidence.
- Next check: extension-only baseline remains proven at the exact 97-record extension and canonical ACL fingerprints. The later database controller `45054c41...` stopped at its first SSH call before JIT/dispatch/database access. First obtain the owner-PC public-IP/TCP-22 result and reconcile any exact Exoscale `/32` allowlist drift. Then require a new exact R4 authorization/controller for `TARGET_COMPATIBLE -> DB_RESTORED`. Do not rerun `32594374666`, repeat the extension controller or reuse `45054c41...`/authorization `5385992305`.

## FM-LOOP-002
- Related: FM-MEM-005
- Status: CLOSED
- Updated: 2026-08-19
- Gap: V2-V6 memory/governance and finishline controls required exact-head acceptance and merge.
- Closed by: PR #975 exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed all applicable Memory/FanMind/Security/Browser gates and was squash-merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- Follow-up: maintain V6; no parallel memory system.

## FM-LOOP-003
- Related: FM-MOB-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: native app repository/CI exists; signed Android/iOS, real-device Recovery/Login/Purge, TestFlight, push and store evidence remain external.
- Close when: required Android/iOS signed-build and device/store acceptance is evidence-bound to exact builds/commit.
- Next check: Supabase redirect and read-only EAS resource state before build/signing.

## FM-LOOP-004
- Related: FM-AI-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: Plus/Ultra foundation exists but final product decisions, quality/cost proof, full current Staging lifecycle and activation evidence are incomplete.
- Close when: tier-specific risk quorum is satisfied and any Production activation is explicit and current.
- Next check: reconcile #560/#874 Gate 4 against current Test catalog/lifecycle runs to avoid repeating completed Staging setup.

## FM-LOOP-005
- Related: FM-META-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: Pixel technical path is production-proven but external Events Manager/browser, no-PII, App Review/permissions and real Meta account E2E remain incomplete.
- Close when: all applicable Meta external/security/legal acceptance evidence is current.
- Next check: normal-browser Events Manager acceptance under #714.

## FM-LOOP-006
- Related: FM-SOC3-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: Phase 3 foundations exist but Facebook, Instagram and WhatsApp have not all passed real external E2E acceptance.
- Close when: all three required channels pass tenant/idempotency/auth/revocation/reconnect/no-auto-send acceptance.
- Next check: do not start until earlier non-Social gates are sufficiently closed per #874.

## FM-LOOP-007
- Related: FM-SOC7-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: Phase 7 real connectors are not accepted; OnlyFans remains conditional feasibility.
- Close when: TikTok/X/Discord have approved official connector scope and E2E evidence, and OnlyFans is either officially/contractually implemented+accepted or explicitly documented unavailable without bypass.
- Next check: current official API/platform capability immediately before implementation.

## FM-LOOP-008
- Related: FM-SALES-001
- Status: BLOCKED
- Updated: 2026-08-19
- Gap: sales material exists, but technical sales handoff is blocked by required Phase-3/Phase-7 acceptance and final Production demo truth.
- Close when: #874 Sales Handoff criteria pass on the exact final release.
- Next check: after Social finishline.

## FM-LOOP-009
- Related: FM-LEGAL-001
- Status: BLOCKED
- Updated: 2026-08-19
- Gap: external tax/legal/register/AVV/provider evidence is incomplete.
- Close when: only genuine external evidence/approvals have been recorded; no technical self-approval.
- Next check: when advisor/register/provider evidence arrives.

## FM-LOOP-010
- Related: FM-RST-001
- Status: CLOSED
- Updated: 2026-08-22
- Gap: canonical restore documentation still contains pre-transfer `user-owned`/`future-org` wording although the current repository is Organization-owned `FanMind/FanMind`.
- Closed by: protected read-only run `32582640853` independently revalidated repository ID `1259448985`, group `fanmind-restore-drill`, selected repository and exact three-workflow scope; canonical readers were reconciled by PR #992, merged as `cb04829c378285c24c3c53b5fab2d03177c19165`.
- Follow-up: mutable runner policy must still be revalidated before every R4 write; do not repeat the organization transfer.

## FM-LOOP-011
- Related: FM-AI-001 / Referral controls
- Status: OPEN
- Updated: 2026-08-19
- Gap: older issues #642/#643/#644 contain stale Staging prerequisites or unchecked items that newer #874 evidence partially/fully supersedes.
- Close when: each old checkbox has been mapped to current evidence or retained as a genuine remaining gate; then close/supersede stale issues deliberately.
- Next check: issue-level reconciliation, not code reimplementation.

## FM-LOOP-012
- Related: FM-MEM-008
- Status: CLOSED
- Updated: 2026-08-20
- Gap: Project Memory V8 originally omitted mandatory V5 active-work bookkeeping and a prior exact-head Browser E2E run was cancelled.
- Closed by: final exact PR #980 head `704fec4b6264dd5a0dd83cc8e0029352672485d0` included corrected V5 bookkeeping/generated status and passed Guard, Quality, Status, FanMind CI, Landing, Supply Chain, CodeQL and Browser E2E run #915 before merge `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Follow-up: maintain V8; stale handoff/evidence must downgrade to revalidation.

## FM-LOOP-013
- Related: FM-SEC-001 / issue #982
- Status: OPEN
- Updated: 2026-08-26
- Gap: protected read-only run `32997946812` now proves the exact Production pre-hardening state, and the Staging RPC is classified as technically constrained intentional exposure. Production remediation, explicit Staging exception acceptance and leaked-password protection on both targets remain unaccepted/unapplied.
- Close when: exact-target read-only catalog/ACL/advisor evidence classifies every warning as remediated or explicitly accepted by policy; any approved state-changing action follows the existing R3 protected path with rollback/postflight; fresh advisor scans are bound to exact targets.
- Next check: only after explicit owner resume, run one exact protected Production Apply and post-advisor scan under `FM-SEC-OWNER-001`; decide the separate Staging exception/Auth setting path under `FM-SEC-OWNER-002`. No mutation is standing-authorized.

## Rules
- Every `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must have either an open-loop entry or an explicit reason why no follow-up is required.
- Close loops explicitly; never delete their history.
- A loop may be `OPEN`, `BLOCKED`, `CLOSED` or `SUPERSEDED`.
