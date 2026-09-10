# FanMind Finishline Board

Machine source: `FINISHLINE_STATE.json`. Current sales finishline ends after Phase 7a Social acceptance and technical Sales Handoff; Phase 7b is subsequent work.

| Gate | Task | Current state | What is already proven | What still closes the gate |
|---|---|---|---|---|
| Project Memory V6 | FM-MEM-005 | ACCEPTED | exact PR #975 head passed Memory Guard/Quality V6/Status, FanMind CI, Landing, Supply Chain, CodeQL and Browser E2E; merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d` | maintain V6; no parallel memory system |
| Production/Ops | FM-OPS-001 | VERIFIED | production deploy, health/version, audit, monitoring, encrypted backups and checksum verification | maintain; optional/destructive follow-ups remain separate |
| Isolated Staging | FM-STG-001 | ACCEPTED | separate Supabase/Web Staging, DNS/TLS, synthetic workspaces, test resources and primary acceptance | reuse; feature-specific acceptance stays in its own gate |
| Restore | FM-RST-001 | PARTIAL | isolated database Restore and full database postcheck accepted through DB_POSTCHECKED; bounded Storage controller prepared | protected-host access, distinct disposable Storage target and exact action scope, real Storage/config verification, cleanup and final evidence; never repeat database Restore |
| Mobile | FM-MOB-001 | IMPLEMENTED_NOT_VERIFIED | native app, signed Android AAB and FCM Preview, documented closed Play test release; recovery redirect configured | complete build-bound Android/Recovery/device evidence, real opt-in/registration/Push delivery, Play cohort and later public Store acceptance; iOS/TestFlight remains Phase 8 |
| AI/Billing | FM-AI-001 | PARTIAL | Standard active; Plus/Ultra fail-closed policy, test/storage/lifecycle foundations | written tier decisions, quality/cost, complete Staging lifecycle, legal/tax, explicit activation |
| Meta/Security | FM-META-001 | PARTIAL | PageView-only Pixel production path; advanced Meta foundation | Events Manager/no-PII, App Review/real E2E, final security/legal evidence |
| Phase 3 Social | FM-SOC3-001 | PARTIAL | Facebook/Instagram advanced foundations; dormant WhatsApp inbound foundation | real E2E Facebook + Instagram + WhatsApp including auth/revocation/reconnect/tenant/idempotency |
| Phase 7 Social | FM-SOC7-001 | PARTIAL | feasibility notes | official-scope validation and real TikTok/X/Discord acceptance; OnlyFans official/contractual feasibility or explicit unavailable result |
| Sales Handoff | FM-SALES-001 | BLOCKED | sales material exists and roadmap truth is aligned | all required sales gates accepted + exact-release 5-minute Production demo + final reader sync |
| Legal/Tax/AVV | FM-LEGAL-001 | BLOCKED | technical reader/evidence framework and confirmed operator facts | genuine advisor/register/provider/customer evidence; no guessing |

## Hard finishline rules

- `SALES_READY=true` is never set manually. It is derived by `scripts/fanmind_sales_readiness.py`.
- Current machine result remains `SALES_READY=false` because required finishline gates are still open.
- Phase 4 is the completed Production/Billing base, not sales handoff.
- Phase 3 is Facebook + Instagram + WhatsApp.
- Phase 7a is TikTok + X/Twitter + Discord + conditional OnlyFans, followed by technical Sales Handoff. Phase 7b is Creator Intelligence & Sales Assistance (FM-CREATOR-001), currently DEFERRED and not required for sales. Further Phase 8 work follows Phase 7b.
- The disabled Website-AI security/widget/message-ingestion foundation and a dormant consent-bound manual email-handoff path in Phase 8 have started, and they are not counted in this finishline. Database/Staging acceptance, dialog, automatic uncertainty escalation, verified email delivery, `iOS-TestFlight`, LinkedIn and later platforms remain deferred.
- A gate with code/CI only is not automatically `ACCEPTED`.
- External acceptance cannot be inferred from a repository artifact.
- Restore remains R4 and never targets Production or Supabase Staging.
- No real payment, destructive offsite retention, platform bypass or protected Production mutation is authorized by this board.

## Closeout order

1. Restore accepted end-to-end.
2. Mobile current-finishline acceptance: redirect/recovery, complete receipt-bound 19-check signed Android real-device runbook/private validator and applicable Push/Store evidence; the bounded FM-MOB-003/FM-MOB-004 UI observation is already accepted and there is no iOS/TestFlight requirement.
3. AI/Billing tier decisions and lifecycle acceptance.
4. Meta Events/Security external acceptance.
5. Phase 3 real Social acceptance.
6. Phase 7 real Social acceptance / OnlyFans feasibility resolution.
7. Final Production demo and technical Sales Handoff.
8. After handoff: Phase 7b Creator Intelligence & Sales Assistance; this does not block the preceding handoff.
9. After accepted Phase 7b: further Phase 8 work, preserving the historically started disabled Website-AI foundation.
