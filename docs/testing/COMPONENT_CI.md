# Component CI

PR routing compares the base commit with the synthetic merge commit that Actions checks out. The base must be its first parent. Deletions and additions are both classified when a path moves. Unavailable objects, malformed input, unknown changes and manual diagnostics select the full affected workflow.

| Change | Action |
| --- | --- |
| Only the six mobile store metadata documents in the selector | Run the actual metadata, assets and EAS profile validator. Omit the independent Android/iOS build job. |
| Only sales/roadmap prose, app stylesheets or the standalone native media SQL test | Omit the unrelated synthetic video job. Its conclusion is skipped. |
| Only the separately listed Stripe, OAuth or public support API route files, mobile store metadata and the above unrelated paths | Omit the unrelated video job. Required application, security, integration and native SQL gates run as usual. |
| Shared libraries, dependencies, CI implementation, unknown or mixed changes | Run the normal checks. |
| Release, staging or production admission | Apply the controller's actual commit, target, freshness and authorization checks. |

The protected release evaluator checks successful PR and main job conclusions. A skipped required build, browser, language or native PostgreSQL job cannot fulfill that contract. The two required browser jobs use different app URLs, provider fixtures, feature flags and flows. Staging tests exercise a deployed target. Production admission additionally verifies the live release prerequisites. These are separate validations.

## Observed runs on 25 November 2026

Rounded first-to-last runner log timestamps, excluding queue time. The two PRs changed different source and shared runners vary. These observations do not measure a causal change in total CI time or billing.

| Job | Before, PR 1552 | After, PR 1553 |
| --- | ---: | ---: |
| Standalone native media PG17 | [52 s](https://github.com/FanMind/FanMind/actions/runs/45631092461/job/139264177713) | [skipped](https://github.com/FanMind/FanMind/actions/runs/45633248582/job/139271804505) |
| Media scope selection | absent | [4 s](https://github.com/FanMind/FanMind/actions/runs/45633248582/job/139271802349) |
| Actual synthetic video | [38 s](https://github.com/FanMind/FanMind/actions/runs/45631092461/job/139264178633) | [56 s](https://github.com/FanMind/FanMind/actions/runs/45633248582/job/139271913544) |
| Truth, lint, tests and build | [122 s](https://github.com/FanMind/FanMind/actions/runs/45631092508/job/139264178510) | [106 s](https://github.com/FanMind/FanMind/actions/runs/45633248439/job/139272045255) |

The required native PG17 job still runs media catalogue tests. PR 1553 also removed the second invocation of three portable Capacity test files. Native lifecycle and staging preflight run under PostgreSQL 17. PR 1552 had already removed three duplicated integration file invocations from combined CI. These counts refer to test-file invocations, not individual test cases.
