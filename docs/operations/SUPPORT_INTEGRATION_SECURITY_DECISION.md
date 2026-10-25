# Support Integration Security Decision

Status: `OWNER_DECISION_REQUIRED`. This document records evidence and choices; it does not accept risk or authorize merge.

## Candidate

- Integration PR: #1355
- Branch: `integration/support-release-20261025`
- Base: `main` at preparation SHA `109c0274c867d5ff8128196b50c585fb9833972f`
- Reviewed cumulative source baseline: #1354 head `fcb2d6cf455e2f28056a25dff8c9302f3adb87cc`
- Final candidate SHA: read from PR #1355 after the documentation binding commit; any later head change invalidates this decision.
- Included development chain: #1351, #1352, #1353 and #1354.

## Verified remediation

- Root `next` and `eslint-config-next` are pinned to `16.4.3`; the exact-head root audit must remain at zero findings.
- Mobile Expo patch packages, `sharp`, `shell-quote`, `xcode` and generated lockfile resolutions were updated before this integration candidate.
- The renewed Mobile review is bound to the exact remaining package set and severity counts, not only to a date.

## Remaining Mobile findings

| Severity | Audit package nodes | Root advisory / reachability | Current remediation status |
| --- | --- | --- | --- |
| High | `node-forge`, `@expo/code-signing-certificates`, `@expo/cli`, `expo` | RSA PKCS#1 v1.5 signature-verification flaw in the Expo CLI/code-signing dependency path | No patched `node-forge` release was available at preparation time; do not apply an unsupported override |
| High | `zod` | Memory exhaustion on oversized invalid collections; present through `@expo/cli` | Patched line requires an Expo/vendor-compatible Zod upgrade; no direct major override is approved |
| High | `image-size` | ICNS parsing infinite-loop DoS through Metro/build tooling | Patched `2.0.3` is outside Metro's current 1.x range; a major override requires compatibility evidence |
| Moderate | `decode-uri-component`, `query-string`, `expo-router` | Malformed percent-encoding DoS in a runtime-adjacent routing chain | Fixed decoder release is outside `query-string@7`'s declared range; requires vendor-compatible routing update and deep-link regression evidence |
| Moderate | `uuid@7.0.3` | Buffer bounds advisory | Lockfile-only orphan: no parent edge and absent from the exact-head Mobile SBOM; remove through a separately verified lockfile regeneration |

Expected exact-head audit budget: `0 critical`, `6 high`, `4 moderate`, `0 low`, `0 unknown packages`.

## Expiry and mandatory re-evaluation

- Current exception expires at `2026-11-08T12:40:47Z`.
- A merge is forbidden after expiry unless a new exact-head audit and SBOM have been reviewed and this decision is replaced.
- Re-evaluation must check current advisories, vendor patch availability, the exact dependency graph, runtime/build-time reachability, relevant regression tests and the candidate head.
- Changing only `reviewedAt` or `reviewExpiresAt` is forbidden.
- Newly available compatible patches must be applied and fully retested rather than deferred without evidence.

## Human decision

Select exactly one outcome and bind it to the exact PR #1355 head:

- [ ] `ACCEPT_UNTIL_EXPIRY`: accept only the documented residual risk until `2026-11-08T12:40:47Z`, with no Production/provider authorization implied.
- [ ] `REQUIRE_REMEDIATION`: keep the PR unmerged until named findings are remediated and exact-head CI is repeated.
- [ ] `REJECT`: do not release this candidate.

Required record:

- Decider and role: `<REQUIRED>`
- Decision timestamp: `<REQUIRED>`
- Exact PR #1355 head: `<REQUIRED>`
- Audit run and artifact: `<REQUIRED>`
- Selected outcome and rationale: `<REQUIRED>`
- Required follow-up owner and due date: `<REQUIRED>`

An unfilled record means `OWNER_DECISION_REQUIRED`, never acceptance.

## Supersession after an authorized merge

Do not close, merge or relabel #1351 through #1354 before PR #1355 is authorized and merged. After the exact merge SHA is recorded and post-merge checks pass:

1. add a concise comment to each predecessor linking PR #1355 and the exact merge SHA;
2. state that the predecessor is superseded by the cumulative integration tree, not independently accepted;
3. verify no unique unresolved review finding or commit was omitted;
4. close or label the predecessor only through a separately authorized normal GitHub action;
5. retain branches and evidence until repository retention policy permits cleanup; do not auto-delete them.

## Protected boundaries

This decision does not authorize merge, deployment, schema APPLY, feature activation, Production/customer data changes, provider access, secrets, signing or store release.
