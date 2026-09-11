## FM-DEC-017 — TikTok and X/Twitter now
- Date: 2026-09-11
- Status: CONFIRMED
- Decision owner: Bernd
- Decision: add TikTok and X/Twitter to the current Creator/Social implementation scope under FM-DEC-015. FM-DEC-016 remains binding: one Creator account, one text writing style across channels; managers remain later.
- Boundary: official own-account authorization only; TikTok Login/profile access is not a DM capability. X has a separately permissioned, metered read API. Real provider/app/legal/Staging evidence is not supplied by this scope decision. Discord and unrelated Phase 8 remain deferred.

# FanMind Decision Log

## FM-DEC-016
- Date: 2026-09-11
- Status: ACCEPTED
- Source: Bernd clarifies that each normal user is the Creator represented by their own account, every account has exactly one personal writing style, and only a manager may supervise multiple Creator/user accounts and their channels. "Voice" means written expression, not sound or a real voice.
- Decision: one user/Creator account = one Workspace = one current writing-style profile. Vocabulary, sentence structure, punctuation, emoji use and expression belong to that account. Revisions improve the same style; they are not a menu of different identities. Every suggested reply and connected channel uses that same account style.
- Manager boundary: a future manager access may operate across separately authorized Creator accounts/channels. Every action remains bound to the selected Creator's Workspace, writing style, fan knowledge and history; never use the manager's personal style or a pooled style. Existing roles/manager switching are not activated by this clarification.
- Terminology: use "Schreibstil" / "writing style" in product explanations. Existing internal voice/fingerprint identifiers refer to text only. No audio, speech synthesis, voice recording or voice cloning is in scope.
- Reply variants and legacy prompts: Recommended/Softer/Stronger are alternative replies within the same style, not three styles. Existing company prompts and legacy reply profiles may supply compatible business context or conversation goals, never an additional Creator identity/style. Verify the legacy UI and runtime interaction before Creator activation; this documentation does not prove that migration/acceptance is complete.
- Supersedes: ambiguous "Creator-Stimmen"/voice wording and any reading of legacy reply profiles as permission for several styles in one Creator account. FM-DEC-015's Creator/Social-before-Android priority and later manager/team/roles scope remain.
- Related tasks/change: FM-CREATOR-001 / FM-CR-030.

## FM-DEC-015
- Date: 2026-09-10
- Status: ACCEPTED
- Source: Bernd explicitly resumes Creator Intelligence and Facebook/Instagram/OnlyFans plus AI replies with human handoff now, and places Android completion afterwards.
- Decision: develop Phase 7b Creator foundations and the selected Social/handoff work now in parallel workstreams; Android follows these increments. Further unrelated Phase 8 work stays deferred. Paid activation stays DEFERRED_BY_OWNER until actual tax/UID facts exist; do not ask again while deferred.
- Supersedes: FM-DEC-013's implementation-after-sales prerequisite and the earlier non-Social/Mobile-before-Social development order only. Phase labels and real sales acceptance requirements are retained; no gate is marked accepted by reprioritization.
- Scope: define all six Creator data/model/authorization contracts first, then extend the existing reply pipeline. Reuse existing Meta and manual Copy-&-Open paths; no scraping, automatic sending, inferred provider/legal approval, new Android build or paid activation.
- Owner clarification in the same session: each Creator gets an independent FanMind account/Workspace. Enforce one Creator profile per Workspace; reuse existing workspace_id isolation and billing. Team access, extended roles/rights, auditable approvals and multi-workspace administration are later phases, not part of this increment.
- Related tasks: FM-CREATOR-001, FM-SOC3-001, FM-SOC7-001 and the existing Website-AI handoff task.

## FM-DEC-014
- Date: 2026-09-10
- Status: DONE
- Decision: permanently offer Starter Flex (EUR 990 setup + EUR 312/month), Starter 12 months (EUR 0 setup + EUR 312/month) and Daily (EUR 0 setup + EUR 1/day).
- Source: owner's explicit three-price/full-release instruction.
- Supersedes: only the previous rule restricting Daily to an exceptional 24-hour public beta; historical beta receipts remain valid for their original scope.
- Boundary: existing net-price basis, monthly commitment distinction and Daily cancellation/no-referral terms remain; no invented tax/UID/legal/provider evidence or automatic customer payment.

## FM-DEC-013
- Date: 2026-09-10
- Status: DONE
- Decision: Phase 7a required Social channels -> technical Sales Handoff to Gerhard -> Phase 7b Creator Intelligence & Sales Assistance -> further Phase 8 work.
- Reason: Owner explicitly placed the reviewed Creator expansion after the sales handoff but before Phase 8.
- Scope: `creators`, Creator-scoped fan/conversation/channel relationships, versioned Creator voice/playbooks, commercial fan evidence, conversation states, automatic Creator context in the existing reply pipeline and later confirmed-chat feedback.
- Boundary: scheduling only; FM-CREATOR-001 remains DEFERRED until FM-SALES-001 is accepted. It is not required_for_sales. Existing disabled Website-AI foundations remain historically started; no feature, schema, price, provider or Production activation is authorized by this decision.
- Supersedes: only wording that made all Phase 7 work a pre-sales requirement or placed further Phase 8 work immediately after Sales Handoff. Prior accepted work and FM-DEC-011's historical Website-AI start remain valid.

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
## FM-DEC-011
- Date: 2026-09-03
- Status: DONE
- Decision: The embeddable Website AI assistant belongs to Phase 8. Its existing disabled security, session, one-way widget and ingestion foundation means only this Phase-8 workstream is already started; iOS/TestFlight and later channel integrations remain deferred. The target includes AI dialogue, a fail-safe handoff to the FanMind user with the complete conversation, optional consented visitor email capture and manually controlled reply delivery.
- Reason: The owner confirmed the product scope and roadmap placement after the Android closed-test release.

## FM-DEC-012
- Date: 2026-09-08
- Status: DONE
- Decision: Bernd confirms all existing FanMind prices have already been created and configured. Treat price creation/configuration as complete; do not recreate products/prices, reprice or ask for the same setup again.
- Boundary: This does not supply missing model/quality/quota/financial evidence, approve real payments or activate paid AI tiers. Those separate completion gates remain open.
