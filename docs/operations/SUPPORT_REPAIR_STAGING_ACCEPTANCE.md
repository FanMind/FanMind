# Support Repair Staging Acceptance

Status: post-merge R3 preparation for exact `main` `7368305db778165d6a6dd8f83265445a6863a25b`. Repository evidence is reconciled; Staging target work remains `NOT_RUN`. This runbook does not authorize execution.

## Exact source chain

- Current `main` and verified merge commit: `7368305db778165d6a6dd8f83265445a6863a25b`.
- The merge has parents `109c0274c867d5ff8128196b50c585fb9833972f` and reviewed PR #1356 head `4b4e5edd97842aa79225b2a8052f954f85667f57`.
- The merge and reviewed head have the identical tree `ce4c21b994a15e4b21ee363cd408ecd33b8128a7`; their compare contains zero changed files. No merge-only conflict resolution or unreviewed file change exists.
- #1351 head `556ec86488ccd9cc815804e23fb4c6761c792bfa`, #1352 head `4fe1a43afc28f7706afe626e5f9768c0eb544e0c`, #1353 head `8c8e904abf82421c1be9c9e93c884639c7e43d36`, #1354 head `fcb2d6cf455e2f28056a25dff8c9302f3adb87cc`, #1355 head `47c4f437a98ddc4b7990de8195af54c08223da29` and #1356 head `4b4e5edd97842aa79225b2a8052f954f85667f57` are all ancestors of the merge.
- The cumulative Support, Capacity and Supply-Chain implementation is therefore present without omission. #1356 adds the reviewed Mobile remediation that removed `image-size` and orphan `uuid`.
- #1351, #1355 and #1356 are merged/closed at the same cumulative merge. #1352, #1353 and #1354 remain open and may only be commented, labelled or closed through a separately authorized GitHub action.
- A later source commit, deployed-release change, schema change, authorization change, Mobile audit change or flag change invalidates the affected evidence and requires a fresh review.

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
- release to deploy and verify: `7368305db778165d6a6dd8f83265445a6863a25b`;
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

## Post-merge and supersession sequence

1. Preserve the immutable merge proof: current `main` is `7368305db778165d6a6dd8f83265445a6863a25b`, its second parent is the reviewed #1356 head, and both trees are identical.
2. Preserve the exact-head #1356 CI and independent review, then distinguish those checks from the post-merge checks listed below.
3. Treat the Owner decision on #1356 as acceptance of H1-H5 and M1-M3 only until `2026-11-08T12:40:47Z`. It is not a renewal and does not authorize Staging.
4. #1351 needs no closure action because GitHub already records it merged. #1352, #1353 and #1354 may be marked superseded only after a separately authorized metadata action and only with the exact merge SHA.
5. The prepared comment for each open predecessor is: “Superseded by cumulative PR #1356, merged as `7368305db778165d6a6dd8f83265445a6863a25b`. This PR head is an ancestor of that merge; no unique commit or unresolved review finding was omitted. This status records inclusion, not independent runtime acceptance. Branch and evidence are retained.”
6. Do not delete predecessor branches. Do not infer target acceptance from source inclusion.
7. Stop before deployment. Staging deployment, read-only target classification, schema APPLY, flag activation and provider testing are separately controlled actions.

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
| Mobile risk decision | Owner record on PR #1356, exact head `4b4e5edd97842aa79225b2a8052f954f85667f57`, eight residual paths and expiry `2026-11-08T12:40:47Z` | renewal after expiry, Staging or Production acceptance |
| Source merge | completed merge `7368305db778165d6a6dd8f83265445a6863a25b` with tree equality to reviewed #1356 head | deploy, schema, flags or provider action |
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

## Post-merge verification evidence (2026-10-25)

| Evidence | Exact object | Result | Classification |
| --- | --- | --- | --- |
| Reviewed candidate tree | #1356 head `4b4e5edd97842aa79225b2a8052f954f85667f57`, tree `ce4c21b994a15e4b21ee363cd408ecd33b8128a7` | PASS | exact-head, pre-merge |
| Full candidate CI | 11/11 successful: CodeQL `40214706549`; Project Memory Status `40214706609`; Project Memory Guard `40214706496`; God Mode `40214706649`; Project Memory Quality `40214706575`; Supply Chain `40214706605`; Landing `40214706741`; Mobile CI `40214706583`; Browser E2E `40214706544`; FanMind CI `40214706476`; Mobile Native CI `40214706563` | PASS | exact-head, pre-merge |
| Independent candidate QA | PR #1356 comment `6400804857`, P0/P1/P2/P3 = 0/0/0/0 | PASS | independent, exact-head |
| Merge identity | merge `7368305db778165d6a6dd8f83265445a6863a25b`, same tree as reviewed head, zero-file compare | PASS | post-merge |
| Push-triggered checks | Supply Chain `40217141672`; God Mode `40217141673`; Browser E2E `40217141663`; CodeQL `40217141661` | PASS 4/4 | new post-merge |
| Non-push workflows | FanMind CI, Mobile CI, Mobile Native CI, Landing, Project Memory Status, Guard and Quality | NOT_RERUN | covered by identical-tree exact-head evidence; not represented as post-merge execution |
| Dependency audit | artifact `12607463275`, digest `sha256:9a83fc3c2f2d33724a25bc6a902f5429ed76445a75350c45ef13e80224bbad9a` | PASS | new post-merge |
| CycloneDX SBOM | artifact `12607393509`, digest `sha256:d0eeb3ba608b9222b051bfb521f4f65b743d8311aa6f14e039d9455d79dd577e`, 563 components | PASS | new post-merge |

The post-merge audit reports root zero and Mobile 0 critical, 5 high, 3 moderate, 0 low; the reviewed set is exactly `@expo/cli`, `@expo/code-signing-certificates`, `decode-uri-component`, `expo`, `expo-router`, `node-forge`, `query-string` and `zod`. It reports no unknown package or error. The SBOM contains neither `image-size` nor `uuid` and contains exactly `metro@0.84.5` and `ob1@0.84.5`.

## Earlier repository evidence (2026-10-25)

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

The repository source, cumulative merge, Support/Capacity/Supply-Chain preservation and current dependency audit are verified. They do not establish that the exact release is deployed to Staging, that the audit schema is installed, that flags are disabled on the target, or that any provider repair succeeds.

Open protected prerequisites:

- obtain a separate authorization to deploy exact `7368305db778165d6a6dd8f83265445a6863a25b` to isolated Staging;
- independently verify the deployed release and the three flags are initially false;
- obtain target/commit/checksum-bound authorization for the read-only schema classifier;
- if and only if the classifier returns `ABSENT`, obtain a distinct authorization for the exact schema APPLY;
- obtain a distinct authorization for temporary runtime-negative flag activation with synthetic identities and zero provider egress;
- retain provider-positive acceptance as a separate action using a reviewed Meta sandbox identity;
- reassess H1-H5 and M1-M3 before `2026-11-08T12:40:47Z`; no automatic extension is allowed.

Current blockers are external target evidence and authorization, not repository-source ambiguity. God Mode's checked-in `RELEASE_DECISION.json` remains `BLOCK`; the relevant social/CRM and registration/entitlement gates remain `REGISTERED` without target evidence. Staging runtime, schema state, flag state, rollback execution and provider behavior therefore remain `NOT_RUN`.

The next safe protected step is a separately authorized deployment of the exact merge to isolated Staging, followed by release/flag verification and the read-only classifier. No schema APPLY or flag activation is bundled with that step.
