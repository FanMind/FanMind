# Registration investigation — 2026-09-14

Task: FM-REG-002; related full activation FM-BILL-003.
State: IN_PROGRESS. Risk: R3 (authentication investigation; no target writes).

## Owner scope
Finish the existing account journey: registration -> delivered confirmation -> verified account/session -> existing Workspace setup -> explicit package/payment terms -> payment -> authorized customer Workspace. The owner operates the websites and performs the real customer test; the assistant handles source corrections and technical counterchecks. No manual Supabase account creation, new login system, automatic charge, database recreation, unrelated Social/Mobile/Restore work or bypass of existing billing/legal gates.

## Error 1 — fresh real account is confirmed but FanMind shows the invalid-link screen
- The owner supplied the existing Production Confirm signup template. Its button uses {{ .ConfirmationURL }}. Do not replace a working template on speculation.
- The supplied Production URL Configuration shows Site URL https://fanmind.ch and the existing https://fanmind.ch/** redirect entry, which covers /register/confirm. Other entries were not modified. The supplied screens bind this observation to the existing FanMind Production project.
- In the new controlled test, the owner clicked the confirmation email and again received the generic invalid/expired/already-used screen, instead of reaching Workspace setup.
- A fresh exact-recipient SELECT inside a read-only transaction on FanMind Production proves that the current test account exists, was created at 2026-09-14 12:38:47 UTC, has email_confirmed_at at 12:39:00 UTC and last_sign_in_at at 12:39:00 UTC, and is not deleted. No recipient address, user ID, token or credential is published here.
- This confirms the account's provider-side email verification and recorded sign-in. It does not prove which browser received the verification response, that FanMind received/persisted the session, or which callback/parser/Auth-user-lookup failure produced the displayed page. Do not claim a mail scanner or a specific source defect as the established cause.
- Owner acceptance criterion: the successful intended signup return should automatically establish the correctly verified account session and reach existing Workspace setup, without an extra resend screen or redundant continuation click. Package/payment-terms consent and payment remain explicit later steps; email verification does not grant paid CRM access or start a subscription.
- Source inspection: the current successful callback path still requires an explicit Continue with this account button. That is a separate, known mismatch with the owner's new automatic-continuation criterion. Removing that button alone would not explain or repair the failing confirmation screen.
- For the owner's ongoing walkthrough, normal sign-in with this already confirmed test account can be tested independently to reach the existing setup route. Such a workaround is not acceptance of the automatic email callback. Preserve the account and do not request another signup, resend or deletion merely to repeat this evidence.

## Owner clarification — missing account explained
The owner explicitly reports deleting the earlier test account after the failed confirmation so that registration could be attempted again, expecting the reported repair to have been completed. This explains the earlier absent-account query. The absence is NOT evidence against the reported earlier account creation or confirmation failure. The request for an Authentication -> Users screenshot of that deleted account is superseded; do not repeat it or require account recreation merely to reconcile that observation.

The original failed confirmation predates that deletion. The new successful provider verification above belongs to the later retained test account and does not retroactively establish the older callback outcome.

## Repository and historical evidence
- GitHub main was freshly re-read as 4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b, unchanged from the already-read pinned Project Memory and canonical source snapshot in this conversation.
- The existing fix/registration-confirm-callback-20260914 branch was freshly read at 1a6beb12ada788a87ef0bf1d84e3f01a9de930f9 before this evidence update. Its speculative parser/test changes are NOT a verified fix and are NOT deployed. Repeated detached commits and duplicate branch names in earlier turns do not establish publication, CI, deployment or successful registration.
- The current main parser accepts the documented bounded implicit signup session. The existing confirmation page maps missing/invalid callback data, a failed Auth user lookup, and an unconfirmed user to the same invalid/expired/used message. A screenshot of that message cannot distinguish these causes.
- Earlier read-only Production/Staging checks found no matching account. Preserve that historical observation together with the owner's deletion explanation; it is no longer a missing-user blocker.
- Earlier read-only Production auth.audit_log_entries queries for the reported day returned no rows. That provides no confirmation/error trace and does not contradict the owner's report or the new auth.users evidence.
- The connected Gmail search previously did not return the relevant confirmation message. The Supabase connector does not expose an Auth-configuration read action; the owner subsequently supplied the template and URL Configuration screens. Those specific configuration questions are no longer waiting for screenshots.
- Official Supabase documentation distinguishes implicit callbacks, token-hash confirmation templates, one-time-link prefetching and provider redirect configuration. These are diagnostic alternatives, not an established incident cause.
- This continuation changed only this investigation record on the existing branch. No application source, SQL mutation, Auth setting, email send, payment, merge, deployment or service restart occurred.

## Reconciliation of earlier chat claims
Earlier assertions that the exact callback defect was conclusively known, that the deleted account was probably already confirmed, or that five seconds excludes every token/provider failure were not established at the time. The new retained account now has actual provider-confirmation evidence, but the failing browser boundary still needs a specific diagnosis. The 60-second client cooldown is not delivery evidence. Never infer confirmation from account creation alone or claim a completed repair or ongoing background work without evidence.

## Exact next step
Preserve the retained confirmed account. Diagnose the actual browser callback handover or Auth-user verification outcome using only sanitized parameter names/types/status codes, never a personal confirmation URL, password, API key, access/refresh token or full network archive. Do not repeat the now-completed template, redirect and account-existence checks. Make the smallest demonstrated correction and implement the owner-requested automatic intended-account continuation without removing identity/tenant/consent protection. Run positive and negative tests/current-head CI, review the diff and deploy through the existing reviewed release path. Then the owner's successful real email-to-setup observation is required. Keep actual payment/Workspace activation acceptance separate and preserve all commercial gates.

Do not merge the speculative parser branch as a repair merely to create activity. No completed registration or paid-workspace acceptance is claimed.
