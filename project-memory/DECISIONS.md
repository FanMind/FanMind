# FanMind Decision Log

Decisions are append-only. If a decision changes, add a new entry that explicitly supersedes the old one.

## FM-DEC-001
- Date: 2026-08-19
- Status: DONE
- Decision: GitHub repository state plus `project-memory/` is the durable technical project memory; conversational memory is supplementary only.
- Reason: Prevent duplicate implementation attempts and loss of micro-history across chats/sessions.

## FM-DEC-002
- Date: 2026-08-19
- Status: DONE
- Decision: New user ideas enter through `CHANGE_REQUESTS.md` before scope is silently changed.
- Reason: Preserve execution focus while ensuring ideas are never lost.

## FM-DEC-003
- Date: 2026-08-19
- Status: DONE
- Decision: A completed task is not reopened or rewritten merely because a later feature is related; later scope receives a new change/task ID.
- Reason: Keep historical completion truth intact.

## FM-DEC-004
- Date: 2026-08-19
- Status: DONE
- Decision: Restore drills never target Production or shared Supabase Staging and should not spawn another restore server by default.
- Reason: Maintain isolation and avoid restarting already completed infrastructure work.

## FM-DEC-005
- Date: 2026-08-22
- Status: DONE
- Decision: Self-hosted Restore workflow CA-path controls are pinned to `/etc/ssl/certs/ca-certificates.crt` and `/etc/ssl/certs`, validated as canonical root-owned non-runner-writable system truststore objects before checkout; `GIT_SSL_NO_VERIFY` remains unset.
- Reason: Empty CA-path exports override truststore discovery and caused run `32568632008` to fail, while simply removing the variables would permit ambient runner values to influence the R4 checkout boundary.

## FM-DEC-006
- Date: 2026-08-22
- Status: DONE
- Decision: Successful protected read-only run `32582640853` advances the Restore state machine to `TARGET_COMPATIBLE`, but it never implies or authorizes `DB_RESTORED`. The database workflow requires a new exact R4 authorization and fresh mutable-evidence preflight.
- Reason: Resource checksum and read-only catalog/TLS evidence prove readiness only; the next state changes the isolated database and remains a separately protected risk boundary.

## FM-DEC-007
- Date: 2026-08-22
- Status: DONE
- Decision: Database-Restore run `32594374666` consumed its exact authorization and may not be retried. Its pre-write receipt-bound failure creates a separate extension-baseline R4 boundary: provision and verify the exact five-extension/97-record contract first, then require a new exact authorization for any later database Restore.
- Reason: Independent evidence proves the target stayed empty and clean, while the deterministic 2-of-5 extension mismatch would make an unchanged retry fail again. Separating provisioning from Restore preserves least privilege, rollback and evidence clarity.

## FM-DEC-008
- Date: 2026-08-23
- Status: DONE
- Decision: The successful separately authorized extension-only transaction closes the receipt-bound 2-of-5 blocker but does not advance the state machine beyond `TARGET_COMPATIBLE`. Any database Restore remains a new exact R4 authorization with fresh mutable-evidence preflight.
- Reason: The controller proved exact extension and ACL fingerprints while explicitly not dispatching a Restore, reset or JIT/workflow and not writing Production/Supabase Staging. Preserving the transition boundary prevents extension evidence from being overstated as restored data.

## FM-DEC-009
- Date: 2026-08-29
- Status: DONE
- Decision: `iOS-TestFlight` is removed from the current Phase-6 completion scope and moved to Phase 8. Phase 8 remains `not started`; the move is a roadmap/future-scope assignment only. Existing native iOS code, simulator/prebuild CI and other cross-platform foundations remain intact.
- Supersedes: only the prior current-finishline requirement that FM-MOB-001 must complete iOS/TestFlight before the through-Phase-7 finishline can close; it does not supersede native iOS implementation evidence.
- Reason: Owner explicitly deferred TestFlight to Phase 8 while keeping the current Mobile work focused on the Android/current-finishline path.

## FM-DEC-010
- Date: 2026-08-30
- Status: DONE
- Decision: Repository-only iPhone App Store preparation may proceed before Phase 8. This includes metadata, public HTTPS support, privacy/review/tester handoffs and a future screenshot plan. It does not start Phase 8 and authorizes no iOS build, signing, TestFlight, App Store Connect submission or iPhone acceptance. Complete Android acceptance and final Android screenshots are moved behind a real download/install from the Google Play test track; the verified Android `1.0.0` AAB must not be rebuilt.
- Supersedes: only the FM-DEC-009 wording that could be read as deferring every iOS Store document until Phase 8, and the earlier device-handoff sequence that placed the complete 19-check Android run before Play-track availability. It does not supersede the Phase-8 boundary for signed iOS/TestFlight/device work.
- Reason: Owner wants useful Store preparation to continue during Google account review, currently has no iPhone for real testing, and explicitly wants Android acceptance to cover the Store-delivered artifact.
