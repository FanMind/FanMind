# Existing Admin-Chat completion: source-only Staging test correction

Task: FM-ADMINCHAT-STAGING-HARNESS-20261104. Risk: R3 source-only.
Baseline: main `b9693fb5a14ace4cd6ade8f753868d878aed3d30`.
Coordination: resumes existing `LOCK-FM-ADMINCHAT-STAGING-HARNESS-20261011`;
its paused record reserved no worker. No competing source writer or running
Staging workflow was found. No second lock, queue, product implementation or
protected action is introduced.

## Actual evidence and stale records

The original issue #1219 CLI-authentication blocker was superseded by successful
Staging deploy 36686671173 on preview commit
`973a7991ac476f807ec19bc2063fd807e486c2f1`. Do not replay that old commit.

Actual application acceptance 38432481036, acceptance job 115417997840,
on `f353f3e1c853c6104797d4db9ab578b8695b14bd`, passed on 2026-10-13:
probe, reservation, prepare, browser, verify, cleanup, absence and final manual
acceptance. It exercised ten three-suggestion generations, 41 persisted messages,
manual confirmation/reload, Character/Fan isolation and authority/RLS negatives.
Independent read-only QA verified the actual source and logs. Prior failed run
38419536176 remains FAILED_NOT_ACCEPTED and its original receipt is unchanged.
The older claim that no later application acceptance completed is superseded
for this historical release; it does not establish current-main acceptance.

Deploy 38432076878/job 115416559026 confirms that same historical release.
A fresh public GET `/api/version` observed 2026-11-04T07:12:14.663Z confirms it
still runs on Staging, 291 commits behind the baseline main. Public health
reports all seven required components healthy; optional email configuration is
unknown. Anonymous `/api/chatadmin/characters` returns 401. Anonymous `/chatadmin`
returns the intentional guarded 404, not a successful authenticated test.

Current-main Browser E2E 41604142628/job 125809698904 passed all 32 existing
ChatAdmin component/boundary cases. Latest merged ChatAdmin PR #1409 and main's
parent PR #1410 have all 14 observed exact-head check records successful.
Source/component evidence does not replace current-main Staging acceptance.

## Concrete correction

Fresh synthetic Characters receive the unchanged SQL default `offers=[]`.
Since merged #1323, the UI creates custom offers through `+ Angebot`; the old
Staging test immediately looked for four nonexistent fixed headings and would
fail at `offers_fields` before ChatAdmin generation.

The existing offer helper now creates each missing named editor through the
actual UI and reuses existing rows. The Staging flow retains its four names,
prices, inactive-offer case, payload/reload checks, generation/message counts,
negative tests and cleanup boundaries. A real-component browser regression
covers empty rows, all four names/prices, inactive state, idempotent editor
selection and reopening the editor from the simulated saved API response. APIs are synthetic only in that local
component test; no live Staging acceptance is claimed.

Product code, SQL, existing runner/workflow, credential handling, network
allowlist and recovery/absence logic are unchanged. Recovery is a repository
revert; there is no external state to undo.

## Verification and remaining boundary

- Existing manual-flow contracts: 23/23 passed, zero failures/skips.
- Changed-file ESLint and TypeScript after `next typegen`: passed.
- Diff whitespace validation: passed.
- Local Chromium installation returned invalid/truncated archives. The new
  browser case could not launch without the binary; this is an environment
  blocker, not a browser PASS. Existing GitHub Browser E2E must execute it.
- Independent final-diff source QA: PASS, no blocking finding. Independent
  structured-offers suite: 75/75 passed, zero failures/skips; syntax/diff checks
  passed. The mocked editor reopening is not a real DB or page reload proof.
  Final-commit binding and exact-head CI are recorded in the PR.

After green exact-head CI/review and an expressly authorized merge, use the
existing `deploy-staging.yml` with the actual resulting current-main SHA,
`confirmation=deploy-staging-only` and `billing_write_freeze=preserve`.
Then use the existing serialized manual-flow workflow on that exact deployed
release with fresh scoped authorization. No previously accepted schema apply
or historical test is replayed. This receipt authorizes no dispatch, merge,
deployment, fixture/capability write, Production, Billing, secrets, IAM,
customer-data or external Fan-message action.
