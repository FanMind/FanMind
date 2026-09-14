# Registration investigation — 2026-09-14

Task: FM-REG-002; related full activation FM-BILL-003.
State: RECONCILIATION_REQUIRED. Risk: R3 (authentication investigation; no target writes).

## Owner scope
Finish the existing account journey: registration -> delivered confirmation -> verified account/session -> existing Workspace setup -> explicit package/payment terms. No new login system, automatic charge, database recreation, unrelated Social/Mobile/Restore work or bypass of existing billing/legal gates.

## Owner clarification — missing account explained
The owner explicitly reports deleting the test account after the failed confirmation so that registration could be attempted again, expecting the reported repair to have been completed. This explains the subsequent absent account. The absence is NOT evidence against the reported earlier account creation or confirmation failure. The request for an Authentication -> Users screenshot of that deleted account is superseded; do not repeat it or require account recreation merely to reconcile this observation.

The original failed confirmation predates that deletion. Its actual callback format, provider verification result and Auth lookup outcome remain unverified. Do not infer successful email confirmation from account creation, or infer a wrong environment from the subsequent deletion.

## Current evidence
- GitHub main was independently re-read as 4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b.
- The existing fix/registration-confirm-callback-20260914 branch was re-read at dee53f0ef6dbf3440707294a5324434720c4d573. Its speculative parser/test changes are NOT a verified fix and are NOT deployed. Repeated detached commits and duplicate branch names in the earlier conversation do not establish publication, CI, deployment or successful registration.
- The current main parser accepts the documented bounded implicit signup session. The existing confirmation page maps missing/invalid callback data, a failed Auth user lookup, and an unconfirmed user to the same invalid/expired/used message. A screenshot of that message cannot distinguish these causes.
- Earlier read-only Production/Staging checks found no matching account. Preserve that historical observation together with the owner's later deletion explanation; it is no longer a missing-user blocker. No account address, identifier, credential or token is published here.
- Read-only Production auth.audit_log_entries queries for the reported day returned no rows, including the bounded action-count query. This provides no confirmation/error trace and does not contradict the owner's report.
- The connected Gmail search previously did not return the relevant confirmation message. The live browser callback and Auth configuration are still unavailable through the connected tools used here. The Supabase connector does not expose an Auth-configuration read action. Cached web pages are not current runtime proof.
- Official Supabase documentation distinguishes implicit callbacks, token-hash confirmation templates, one-time-link prefetching and provider redirect configuration. These are diagnostic alternatives, not an established incident cause.
- No SQL mutation, Auth setting change, email send, payment, merge, deployment or service restart occurred during this investigation.

## Reconciliation of earlier chat claims
The assertions that the callback was conclusively broken, that the account was probably already confirmed, or that five seconds excludes every token/provider failure were not established by evidence. They remain hypotheses, not the diagnosis. Never infer email confirmation from user creation alone. The 60-second client cooldown is not delivery evidence. The owner was justified in expecting an actual completed repair after the earlier repeated assurances; do not repeat a success or ongoing-background-work claim without evidence.

## Exact next step
Inspect the configured Production Confirm signup email template, especially the link expression and its placeholders, and the corresponding redirect configuration. A template-source screenshot can establish the link contract without recreating a user or disclosing any live token. Do not request a personal confirmation URL, password, API key or complete network archive. Compare the actual configured contract with the existing callback, reproduce the demonstrated failure, make the smallest code/config correction, run positive and negative tests/current-head CI, review the diff and deploy only through the existing reviewed release path. A fresh owner-controlled real confirmation-to-setup observation is required after deployment, not before a claimed repair. Preserve accounts and all commercial gates.

Do not merge the speculative branch or repeat signup/resend against an absent recipient merely to create activity. No completed registration or paid-workspace acceptance is claimed.
