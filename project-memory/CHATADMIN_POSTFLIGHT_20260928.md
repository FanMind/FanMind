# FM-CHATADMIN-003 postflight follow-up — 2026-09-28

- State: repository correction in progress on PR #1223; end-to-end feature remains IMPLEMENTED_NOT_VERIFIED.
- PR #1222 merged as `cff301bdcab927a648e1cf0fdd880678da1980da`. Exact review findings were addressed iteratively on #1223; earlier code/check evidence is superseded by later commits.
- Review of `990e88cefa48b78be556a987d20163d96e9f543d` found that parent Character drift was checked after the extension ABSENT return, unexpected parent status/revision checks were omitted, and the PG17 exclusion expression used a non-immutable timestamptz operation. CI confirmed the immutable-expression test failure.
- Follow-up `c629887ab4006576311b9f263b83218c2d2f5c51` moves parent status/revision type, nullability, default, generation and complete relevant check-constraint validation before ABSENT; adds parent-drift negative tests before migration; and uses an immutable constant date-range exclusion case. Earlier ACL restoration and fan-constraint scoping corrections remain included.
- No Staging, Production, provider or customer mutation occurred. Existing target evidence is not reused as current acceptance.
- Next: rerun all required checks, including native PostgreSQL 17, and complete independent exact-head review on PR #1223. After those pass, merge, run protected read-only Staging schema VERIFY, and APPLY only if absent; then verify schema postflight/cleanup. Production remains unchanged.
