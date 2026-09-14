# Registration investigation — 2026-09-14

Task: FM-REG-002; related full activation FM-BILL-003.
State: RECONCILIATION_REQUIRED. Risk: R3 (authentication investigation; no target writes).

## Owner scope
Finish the existing account journey: registration -> delivered confirmation -> verified account/session -> existing Workspace setup -> explicit package/payment terms. No new login system, automatic charge, database recreation, unrelated Social/Mobile/Restore work or bypass of existing billing/legal gates.

## Current evidence
- GitHub main was independently re-read as 4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b.
- The existing fix/registration-confirm-callback-20260914 branch was read at 07b2ebe26f028a1a903fd7122e351af92beb0601. Its speculative parser/test changes are NOT a verified fix and are NOT deployed. Repeated detached commits and duplicate branch names in the earlier conversation do not establish publication, CI, deployment or successful registration.
- The current main parser accepts the documented bounded implicit signup session. The existing confirmation page maps missing/invalid callback data, a failed Auth user lookup, and an unconfirmed user to the same invalid/expired/used message. A screenshot of that message cannot distinguish these causes.
- Supabase list_projects verified the existing FanMind Production and FanMind Staging targets as distinct and active. Read-only exact-email checks for the address visible in the supplied screenshot returned no account in either target. Production contained three accounts, all created in June; Staging contained five accounts and none created since September 10. A Gmail-equivalence check (dot normalization and gmail/googlemail domain) also found no matching account. No account address, identifier, credential or token is published here.
- Therefore the owner's observed newly created account has not yet been bound to the inspected target/account. This does not establish that the owner is mistaken or that an account never existed; deletion, a different test address or a different environment have not been excluded.
- The connected Gmail search did not return the relevant confirmation message. The live browser callback and Auth configuration were not accessible in this investigation. Cached web pages are not current runtime proof.
- No SQL mutation, Auth setting change, email send, payment, merge, deployment or service restart occurred during this investigation.

## Reconciliation of earlier chat claims
The assertions that the callback was conclusively broken, that the account was probably already confirmed, or that five seconds excludes every token/provider failure were not established by evidence. They remain hypotheses, not the diagnosis. Never infer email confirmation from user creation alone. The 60-second client cooldown is not delivery evidence.

## Exact next step
Bind the reported account to its actual Supabase project and email-confirmation status using the owner's Authentication -> Users detail view (project header, address and confirmation status; no passwords or tokens). Then inspect only that account's verification event and callback format. Reproduce the demonstrated failure, make the smallest code/config correction, run positive and negative tests/current-head CI, review the diff, deploy through the existing reviewed release path and obtain a real successful confirmation-to-setup observation. Preserve the original accounts and all commercial gates.

Do not merge the speculative branch or repeat signup/resend against an absent recipient merely to create activity. No completed registration or paid-workspace acceptance is claimed.
