# SUPPORT-CENTRE-1350-20261104

Status: SOURCE_READY_FOR_REVIEW; holder: current Codex work session; risk R3 source-only.
Base: b9693fb5a14ace4cd6ade8f753868d878aed3d30; issue #1350.
Scope: new src/app/admin/support/, src/app/api/admin/support/, src/lib/supportCentre*, supabase/controlled/support_centre.sql, own tests/docs. Existing diagnostics may report coarse cases behind an independent default-off gate. Single writer. No ChatAdmin, Open Questions (#1411–#1414), shared shell, package/workflow/pinned-file writes. Existing AdminTabs receives only a Support link (no open PR claims it); support-specific WorkspaceHelpLauncher receives coarse explicit handoff.
Recovery: revert source before activation. No SQL APPLY, deployment, provider request, real data, secret, permission provisioning, merge or Production action.

Evidence: Website Chat 77/77, TypeScript, lint, product truth, suite ownership and production build PASS. Three independent reviewers; source P0/P1/P2 clear after fixes. Native PG17 and 4 synthetic browser cases registered; local capability unavailable. No runtime acceptance or activation. Current source writer finishes at draft PR publication.


Continuation SUPPORT-CENTRE-COMPLETE-20261104 authorized by Owner: same PR #1416,
exclusive support source writer. Current main0a374ad4 (#1415) is non-overlapping;
no ChatAdmin/Open Questions/shared shell writes. Scope includes SupportConversation,
SupportKnowledge, global inbox, safe metadata recovery, legacy audit integration,
focused/native/browser tests and related truth/retention docs. Owner expressly
permits normal merge after full source acceptance; no new merge question. No
Production/SQL APPLY/IAM/secret/provider activation. Staging readiness only unless
a separate existing target-bound deployment authorization actually applies.
