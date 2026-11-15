# Admin-Chat Staging continuation: committed source validation

Task: existing FM-ADMINCHAT-STAGING-HARNESS-20261104; R3.
Baseline main: `0a965fd49d9552326c2ff96952b37282b7dac63a`.
Owner explicitly authorizes current-main Staging deployment and synthetic acceptance.
Reuse the existing serialized harness lock; no second queue or competing writer.

## Failure and correction

Actual authorized deploy run 42023184088 failed before restart. Three tests in
ai-capacity-staging-integration/preflight require Git history. The runtime source
copy intentionally excludes `.git`; Operations was incorrectly run there.
Run the unchanged complete Operations suite in the exact reviewed checkout in
a subshell, installing its dependencies after rsync. Release integration and
build retain the runtime directory. Keep runtime Git exclusion and every target,
SHA, environment, recovery and Billing control. No application, SQL, secret,
permission, provider activation or Production change.

## Evidence and recovery

Independent final-diff QA PASS; deployment policy tests 8/8 PASS, none skipped;
actual extracted shell block proves committed-source npm execution and runtime
cwd restoration; removing cd fails. Diff whitespace check PASS.
A broader local Capacity integration run reached MAIN_FETCH_FAILED in its
synthetic self-fetch fixture; it is not claimed PASS. Exact-head CI must validate
this suite in its normal environment before merge. No checks are removed.

Existing live release remains f353f3e1c853c6104797d4db9ab578b8695b14bd as observed
via Staging /api/version after the failed run. No successful deployment or
current-main application acceptance is claimed. Existing guarded workflow will
retry only after green exact-head CI and independent review; existing recovery
and release metadata controls stay intact. Then verify actual version and run
only the existing synthetic acceptance, including cleanup and absence.
