# FM-CHATADMIN-003 postflight follow-up — 2026-09-28

- State: repository correction in progress on PR #1223; end-to-end feature remains IMPLEMENTED_NOT_VERIFIED.
- PR #1222 merged as `cff301bdcab927a648e1cf0fdd880678da1980da`. Exact review identified five postflight gaps; the first PR #1223 revision addressed runtime-column basics, symmetric constraint checks, ACL grant options, schema USAGE and post-restore verification.
- Review of commit `0629ae01dbcf39105ee05a35d1bbe6c1c0b5eb46` found four additional issues: reverse constraint comparison included unrelated base constraints; parent Character defaults/generation/checks were incomplete; grant-option check omitted the authority helper; and table/function ownership restoration needed explicit ACL regranting.
- Follow-up commit `a7be039996fd265dd8b7708c9f710fafb613b7b1` scopes symmetric constraint comparison to fan constraints, validates parent status/revision defaults, ordinary-column state and checks, includes every expected ChatAdmin routine in the grant-option check, and restores grants before the PG17 VERIFIED assertions.
- No Staging, Production, provider or customer mutation occurred. Existing target evidence is not reused as current acceptance.
- Next: rerun all required checks, including native PostgreSQL 17, and complete independent exact-head review on PR #1223. Only then consider repository merge; separate controlled Staging/runtime acceptance and cleanup remain required for feature completion.
