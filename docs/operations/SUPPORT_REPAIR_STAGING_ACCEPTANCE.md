# Support Repair Staging Acceptance

Status: repository-only R3 preparation. This runbook does not authorize execution.

## Exact source chain

- Canonical `main` at integration preparation: `109c0274c867d5ff8128196b50c585fb9833972f`.
- #1351 foundation head: `556ec86488ccd9cc815804e23fb4c6761c792bfa`.
- #1352 repair head: `4fe1a43afc28f7706afe626e5f9768c0eb544e0c`.
- #1353 Capacity correction head: `8c8e904abf82421c1be9c9e93c884639c7e43d36`.
- #1354 independently reviewed cumulative head: `fcb2d6cf455e2f28056a25dff8c9302f3adb87cc`.
- Integration PR #1355 branch: `integration/support-release-20261025`, based byte-for-byte on the reviewed #1354 head before this documentation-only binding commit and targeting `main`.
- The exact final integration head must be read from PR #1355 after this commit and must have complete exact-head CI plus an independent R3 countercheck. The PR body is the immutable head/evidence binding; a source file cannot self-reference the SHA of the commit that contains it.
- The former base-first merge sequence is prohibited because #1351 through #1353 would expose known vulnerable or red intermediate trees on `main`. Only the cumulative integration candidate may proceed to human merge review.
- Protected execution must use the exact authorized merge result from PR #1355 after that exact `main` is deployed to isolated Staging.
- A later commit, rebase, base change, schema change, authorization change, Mobile audit change or flag change invalidates prior evidence and requires a fresh review.

## Boundary

Allowed in repository preparation:

- source and schema review;
- deterministic mock tests;
- read-only source classification;
- exact commands, evidence templates, recovery and rollback planning.

Not authorized by this document:

- workflow dispatch;
- database or migration execution;
- Staging or Production SQL writes;
- feature-flag activation;
- provider network calls;
- OAuth, credential, permission or connection changes;
- customer data or real customer connections;
- external messages;
- secret reads or disclosure.

## Evidence classes

Every result must be labelled as exactly one of:

- `SOURCE_REVIEW`: static source, schema or diff inspection.
- `MOCK_TEST`: deterministic injected dependency test without Staging or provider state.
- `INTEGRATION_TEST`: repository test that crosses real internal modules but no external target.
- `STAGING_RUNTIME`: observation or mutation on the exact isolated Staging target.
- `PROVIDER_TEST`: an actual Meta request. This is excluded from the prepared no-provider phase.

Green repository CI is not `STAGING_RUNTIME` or `PROVIDER_TEST` evidence.

## Required environment and target

The later protected run must bind all evidence to:

- target: FanMind isolated Staging Supabase project `vshyhvgcmrlagvfnvomc`;
- application: `https://staging.fanmind.ch`;
- release: `<EXACT_MERGED_MAIN_SHA>`;
- SQL source: `docs/operations/sql/support_repair_audit_draft.sql`;
- read-only classifier: `docs/operations/sql/support_repair_audit_verify.sql`;
- feature flags, initially and finally:
  - `NEXT_PUBLIC_FANMIND_INAPP_HELP_ENABLED=false`;
  - `FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED=false`;
  - `FANMIND_INAPP_HELP_REPAIR_ENABLED=false`.

The isolated Browser E2E build is the only prepared environment where `NEXT_PUBLIC_FANMIND_INAPP_HELP_ENABLED=true`; its diagnostics and repair endpoints are intercepted and Meta Graph requests are blocked. This build-time test setting is not a Staging activation.

## Exact SQL artifacts

Before any protected target action, recompute with `sha256sum` and stop on any mismatch:

| Artifact | Reviewed SHA-256 |
| --- | --- |
| `docs/operations/sql/support_repair_audit_draft.sql` | `6afedb605fbe71e99f0d1c1b53bd088f7011da6f4e7d1d96cdc5182067dc661a` |
| `docs/operations/sql/support_repair_audit_verify.sql` | `87918c38dd8ca31ef72c982d4f01ea17a0dd07ca897e18bfd21d081af3219168` |

The APPLY checksum authorizes only the exact draft SQL on the named isolated Staging project. It grants no authority for Production, a different project or a modified file.

## Release and merge sequence

1. Confirm PR #1355 still targets current `main`, remains conflict-free and contains the complete cumulative diff from #1351 through #1354.
2. Confirm the PR #1355 final head has complete exact-head FanMind CI, Supply Chain, Browser E2E, CodeQL, Mobile CI, Mobile Native CI and all governance/Project-Memory gates.
3. Confirm the independent R3 countercheck is bound to that exact final head with no open P0/P1/P2 finding or unresolved review thread.
4. Require a human review of the complete cumulative diff and an explicit decision on `docs/operations/SUPPORT_INTEGRATION_SECURITY_DECISION.md`. Opening or testing the PR does not accept the Mobile exception.
5. With a separate owner merge authorization naming PR #1355 and its exact final head, merge only PR #1355 to `main`. Record the resulting immutable merge SHA.
6. Verify the resulting `main` tree equals the reviewed PR #1355 tree and run the required post-merge repository checks. Any mismatch is `RECONCILIATION_REQUIRED`.
7. Only after the merge and post-merge verification may #1351 through #1354 be marked superseded with references to PR #1355 and the exact merge SHA. Do not delete branches automatically.
8. Stop. Deployment, schema APPLY, flag activation and provider testing remain separately controlled actions; merging authorizes none of them.

Do not print connection strings, service keys, access tokens, cookies or provider payloads. Protected credentials must be supplied only by the approved environment.

## Source and mock acceptance matrix

| ID | Class | Purpose | Input | Expected |
| --- | --- | --- | --- | --- |
| SRC-01 | SOURCE_REVIEW | PR dependency | #1352 base/head and #1351 head | #1352 is mergeable and based on the exact #1351 head |
| SRC-02 | SOURCE_REVIEW | Browser privacy | diagnostics and help UI source | no token, raw provider error, account ID or service-role value reaches the browser |
| AUTH-01 | INTEGRATION_TEST | Owner | role `owner`, entitled workspace | repair preflight may continue |
| AUTH-02 | INTEGRATION_TEST | Admin | role `admin`, entitled workspace | repair preflight may continue |
| AUTH-03 | INTEGRATION_TEST | Member denial | role `member` | no rate-limit, audit or provider call |
| AUTH-04 | SOURCE_REVIEW | Invalid session | missing authenticated user | HTTP 401 before workspace/rate/audit/provider |
| AUTH-05 | SOURCE_REVIEW | Missing entitlement | denied or failed entitlement lookup | HTTP 403 before rate/audit/provider |
| TENANT-01 | MOCK_TEST | Foreign workspace postcheck | matching connection ID/platform but different workspace | `verification_failed`, never success |
| TARGET-01 | MOCK_TEST | Connection swap | selected connection replaced before postcheck | `verification_failed`, never success |
| FLOW-01 | MOCK_TEST | Verified success | explicit consent, rate allowed, audit started, exact fresh postcheck | exactly one provider adapter call and terminal `succeeded` |
| FLOW-02 | MOCK_TEST | Provider failure | adapter returns failure | terminal `failed`, user never sees success |
| FLOW-03 | MOCK_TEST | Timeout | adapter throws timeout | terminal `failed`, user never sees success |
| FLOW-04 | MOCK_TEST | Partial continuation | adapter reports continuation | terminal `partial`, user never sees verified success |
| AUDIT-01 | MOCK_TEST | Start write failure | audit insert rejects | zero provider calls |
| AUDIT-02 | MOCK_TEST | Terminal write failure | all three updates reject | `audit_incomplete`, never success |
| REPLAY-01 | MOCK_TEST | Duplicate request UUID | audit insert reports conflict | zero provider calls |
| RATE-01 | MOCK_TEST | Shared limit denied | limiter denies | zero audit and provider calls |
| UI-01 | SOURCE_REVIEW | Explicit consent | unchecked and checked UI states | request is possible only after checkbox confirmation |
| UI-02 | SOURCE_REVIEW | Customer explanation | error, action, success and failure copy | clear coarse text without secrets or raw provider diagnostics |
| UI-E2E-01 | INTEGRATION_TEST | Explicit browser consent | local authenticated fixture, mocked Instagram sync error | action disabled before checkbox; one minimal repair request after confirmation |
| UI-E2E-02 | INTEGRATION_TEST | Verified browser result | mocked `{verified:true,status:succeeded}` response | success copy shown only for verified success; zero Meta requests |
| UI-E2E-03 | INTEGRATION_TEST | Unverified browser result | mocked `verification_failed` response | failure guidance shown and success absent; zero Meta requests and no sensitive text |

The exact test name, commit, environment, input, expected result, actual result, log reference and `PASS|FAIL|INCONCLUSIVE|NOT_RUN` must be recorded for each row.

## Read-only schema classification

This step is external target observation and may run only when the exact read-only target access is configured and authorized.

Command shape:

```bash
psql -X --set=ON_ERROR_STOP=1 \
  --file docs/operations/sql/support_repair_audit_verify.sql
```

Required output:

- `ABSENT`: table is not installed. APPLY remains a separate protected action.
- `INSTALLED`: expected columns, constraints, indexes, RLS and browser-role denial match.
- `DRIFT`: stop. Do not apply over the existing object. Record the redacted classifier details and prepare a separate remediation review.

The classifier begins a read-only transaction and contains no DDL, DML or grant operation.

## Protected schema step

This step is not authorized by the preparation task.

Required owner action must name:

- operation: one controlled Staging-only schema APPLY;
- target: `vshyhvgcmrlagvfnvomc`;
- exact merged/deployed main SHA;
- exact SQL SHA-256;
- precondition: read-only classification is `ABSENT`;
- Production exclusion proof;
- expected postcondition: classifier returns `INSTALLED`;
- stop conditions: `DRIFT`, wrong target, wrong release, checksum mismatch, missing RLS/denials or any unexpected object.

The SQL must execute transactionally through the repository-approved protected path. A normal web deployment must not apply it.

## Rollback-only database acceptance

After an authorized APPLY and a fresh `INSTALLED` readback, a separately authorized rollback-only transaction should verify:

1. valid `started` row accepts exact workspace, actor, connection, platform, action and request UUID;
2. duplicate request UUID is rejected;
3. consent-required without consent is rejected;
4. `started` with `completed_at` is rejected;
5. terminal state without `completed_at` is rejected;
6. the same terminal transition is idempotent;
7. a different second terminal transition affects zero rows;
8. browser roles cannot read or write the table;
9. the transaction rolls back and row count is unchanged.

Use only generated synthetic UUIDs. Do not use real users, customer workspaces, customer connections or provider credentials.

## Protected runtime-negative acceptance

This is a later, separately authorized Staging action. It must start with all three flags off and use marked synthetic identities only.

Required fixtures:

- one synthetic owner;
- one synthetic admin;
- one synthetic ordinary member;
- one foreign synthetic workspace;
- one synthetic Facebook or Instagram connection with no provider token and a coarse sync-error marker;
- processing entitlement allowed only for the intended synthetic workspace.

Allowed no-provider checks after temporary flag activation:

1. missing/invalid session returns 401;
2. ordinary member returns 403 and does not consume the repair rate-limit;
3. missing entitlement returns 403 and does not consume the repair rate-limit;
4. foreign-workspace and client-supplied target data cannot select a connection;
5. missing consent returns 400;
6. first valid synthetic request reaches the expected missing-token failure without network egress and records `started -> failed`;
7. repeated UUID is rejected without a second provider adapter invocation;
8. browser responses contain no token, raw provider error or internal database detail.

Activation order for the authorized runtime window is fail-closed: first verify the deployed SHA and installed schema, then enable diagnostics, then the browser launcher, and only then the repair endpoint. After the checks, disable the repair endpoint first, then the launcher and diagnostics. Any unexpected release, flag state, schema state, outbound request or non-synthetic identifier stops the run immediately and starts recovery.

## Required owner approvals

| Boundary | Approval must bind | Not implied |
| --- | --- | --- |
| Mobile risk decision | PR #1355 exact head, audit artifact, affected package paths, expiry `2026-11-08T12:40:47Z` and explicit accept/reject/remediate choice | merge, renewal after expiry or Production acceptance |
| Merge PR #1355 | PR number, exact final head, complete CI, independent R3 countercheck and human Mobile decision | deploy, schema, flags or provider action |
| Staging deploy | isolated target and exact merged `main` SHA | database or runtime acceptance |
| Read-only classification | target, verifier checksum and read-only command | schema APPLY |
| Schema APPLY | target, deployed SHA, draft checksum and `ABSENT` precondition | feature activation |
| Runtime-negative window | target, deployed SHA, synthetic fixtures, three exact flags and zero-provider control | real provider repair |
| Provider-positive test | separately reviewed Meta sandbox identity and exact request plan | any customer connection or Production action |

Positive `succeeded` runtime evidence is not available in the no-provider phase. It remains `NOT_RUN` until a separately approved Meta sandbox/provider test or a separately reviewed staging-only provider adapter exists. Mock success must never be relabelled as Staging success.

## Network and log controls

For the no-provider phase:

- deny or observe outbound Meta Graph traffic at the controlled test boundary;
- expected Meta request count is zero;
- redact cookies, authorization headers, database URLs and payloads;
- log only request UUID, coarse outcome, exact release, target identifier and test ID;
- abort immediately if any real account, token or provider request is observed.

## Aborted and uncertain operations

A durable `started` row without a terminal status is an explicit unknown, never success.

- API completion persistence is retried three times with the same terminal state.
- After persistent failure the API returns `audit_incomplete`/503 and does not report success.
- Do not automatically replay provider work for an orphaned `started` row.
- Read-only reconciliation identifies stale `started` rows by request, workspace, actor, connection and creation time.
- Any later terminal reconciliation write is a separate controlled action. Mark it `failed` unless independent exact-target evidence proves another terminal state.
- Preserve the original row and evidence; never delete it merely to make the acceptance green.

## Recovery and rollback

Before any protected run, capture:

- exact deployed release;
- classifier state and redacted details;
- all three feature-flag states;
- synthetic fixture identifiers;
- baseline audit row count for the synthetic workspace;
- expected zero provider egress.

Recovery order:

1. disable all three support flags and restart only the approved Staging application service;
2. verify the exact release endpoint and both support endpoints return the disabled response;
3. stop all fixture use and verify zero external provider requests/messages;
4. remove only marked synthetic fixtures through the approved cleanup path;
5. re-run the read-only schema classifier;
6. reconcile any stale `started` audit row without replaying provider work;
7. independently verify zero synthetic residue.

Do not automatically drop an installed audit table after a runtime failure. If rollback to `ABSENT` is required, it needs separate destructive authorization, zero non-synthetic rows and an independently reviewed rollback statement.

## Evidence record template

| Field | Required value |
| --- | --- |
| Test ID and name | stable matrix identifier |
| Exact commit | immutable tested SHA |
| Environment | local mock, CI, or exact Staging target |
| Inputs | synthetic IDs and coarse state only |
| Expected | deterministic expected status and side-effect count |
| Actual | redacted observed status and counts |
| Log | workflow run/job or local command |
| Result | PASS, FAIL, INCONCLUSIVE or NOT_RUN |
| Provider requests | integer, expected zero in no-provider phase |
| Cleanup | PASS/FAIL/NOT_APPLICABLE |

## Executed repository evidence (2026-10-25)

Tested source commit: `44a9cd9e2a1313df0c5a90be8ceafe831dc0684e`.
Environment: local isolated checkout, Node `v24.19.0`, no database, browser, Staging target or provider network. The registered test imports the repository `typescript` dev dependency, which was unavailable in this checkout. Therefore the identical test body was executed through Node 24 native type stripping; the only harness substitution was the TypeScript loader. Command/log: `node --experimental-strip-types --test tests/support-confirmed-repair.node24.test.mjs`, 16 passed, 0 failed, duration 100 ms. The temporary harness is not committed.

| Test name and purpose | Class | Synthetic input | Expected / actual | Result |
| --- | --- | --- | --- | --- |
| rate limited before side effects | MOCK_TEST | limiter denies | zero audit/provider calls / observed | PASS |
| audit start failure blocks repair | MOCK_TEST | start insert throws | zero provider calls / observed | PASS |
| duplicate request blocks repair | MOCK_TEST | replay conflict | zero provider calls / observed | PASS |
| terminal audit retries fail closed | MOCK_TEST | three update failures | `audit_incomplete`, no success / observed | PASS |
| exact connection postcheck | MOCK_TEST | different connection ID | `verification_failed` / observed | PASS |
| invalid postcheck variants | MOCK_TEST | stale, error, disconnected, duplicate, wrong platform/workspace | every variant rejected / observed | PASS |
| role authorization matrix | INTEGRATION_TEST | owner, admin, member, viewer, empty, null, platform_admin | only owner/admin allowed / observed | PASS |
| provider timeout handling | MOCK_TEST | adapter throws | terminal failed, never verified / observed | PASS |
| successful operation ordering | MOCK_TEST | deterministic successful dependencies | rate → started → provider → postcheck → succeeded / observed | PASS |
| failure and partial continuation | MOCK_TEST | failed and continuation responses | failed/partial, never verified / observed | PASS |
| fresh exact success postcheck | MOCK_TEST | matching fresh connection | verified success / observed | PASS |
| route authorization and boundary order | SOURCE_REVIEW | route source | consent/auth/entitlement before rate/audit/provider; exclusions retained / observed | PASS |
| exact provider target binding | SOURCE_REVIEW | Facebook/Instagram entrypoints | selected connection ID required / observed | PASS |
| audit replay and terminal binding | SOURCE_REVIEW | persistence and draft SQL | request uniqueness plus exact transition filters / observed | PASS |
| UI consent and disclosure | SOURCE_REVIEW | launcher/diagnostic source | explicit consent, clear action, no secrets/raw errors / observed | PASS |
| read-only classifier safety | SOURCE_REVIEW | verifier SQL | classifier only; no DDL/DML/grants / observed | PASS |

Direct registered-test result: `NOT_RUN` locally because the checkout had no installed `typescript` package. Exact-head GitHub CI remains required. Schema execution, database integration, browser E2E, Staging runtime and provider execution were `NOT_RUN` and must not be inferred from this table.

The added Browser E2E source and workflow guard passed local syntax/static validation at commit `a379a343d4f730476d7316f8e0b58c9f9858dc52`. Actual Playwright execution remains `NOT_RUN` locally and must be evidenced by the exact-head Browser E2E workflow. This distinction prevents source inspection from being presented as browser runtime evidence.

## Current preparation conclusion

Repository source and mock evidence may establish implementation readiness. It cannot establish that the schema is installed, flags are active, the deployed Staging release is current or a provider repair succeeds.

Open protected prerequisites:

- complete human review and the explicit Mobile Security decision on PR #1355;
- merge only PR #1355 through a separately authorized action and record the exact resulting `main` SHA;
- perform post-merge tree and repository-check reconciliation;
- deploy that exact reconciled `main` SHA to isolated Staging through a separately authorized action;
- obtain explicit target/commit/checksum-bound authorization for read-only target classification if current access is unavailable;
- obtain a distinct authorization for schema APPLY;
- obtain a distinct authorization for temporary flag activation and synthetic Staging runtime-negative acceptance;
- retain provider-positive acceptance as a separate action.

Until those prerequisites are satisfied, Staging runtime and provider rows remain `NOT_RUN`.

