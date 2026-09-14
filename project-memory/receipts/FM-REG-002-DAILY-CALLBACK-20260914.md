# FM-REG-002 / FM-BILL-003 — retained registration failures, 2026-09-14

Status: DIAGNOSED_IN_PART; no application correction or complete acceptance is claimed. Risk: R3 read-only investigation; any later Production schema operation remains R4.

## Current scope and preflight
The owner reports a fresh confirmation returning to the invalid-link page, missing Daily (EUR 1/day) after normal login, and repeated confirmation requests without another email. Preserve the existing account, selected commercial intent, existing Stripe configuration and explicit payment consent. Do not send the owner through another signup/deletion or substitute a monthly offer.

Current GitHub main is 3067fc248c7c0b0f12985852610a320fdb39d88d. GitHub compare against 4d6d0c4f independently confirms the already-read mandatory Project Memory and canonical readers are unchanged except the new switch receipt; the only runtime change is the payment-terms flag. The normal release and its read-only Production audit 34856071033 succeeded. That release did not change the confirmation callback or install any provisioning SQL. The existing investigation branch still contains unverified speculative parser edits and must not be merged as a fix.

## Fresh target observations
- Supabase get_project confirms the existing FanMind Production project, ACTIVE_HEALTHY.
- Exact-recipient read-only auth.users observation: account created 14:44:13 UTC, email_confirmed_at 14:44:33 UTC, last_sign_in_at 14:46:42 UTC; not deleted. No identity, email, token or credential is retained here.
- The same record currently has registration_plan_preference=starter and registration_option_preference=starter_paid_setup. This does not match the owner's reported Daily selection. Reproduce preference propagation; do not silently reinterpret the owner's intended tariff or treat editable metadata as commercial authorization.
- Independent exact-signature read-only pg_catalog query: public.ensure_current_user_workspace(text,text,boolean) absent; public.ensure_internal_daily_test_workspace(uuid,text,boolean) absent; public.internal_daily_test_workspace_provisioning_ready() absent.
- The deployed setup source hides Daily when its combined readiness check is false. The missing Daily RPC/readiness contract is therefore a concrete blocking prerequisite, separate from Stripe configuration. Showing a button alone cannot repair Workspace creation.
- Supabase upstream internal/api/resend.go explicitly returns HTTP 200 with an empty object, without sending mail, for an already confirmed signup account. This explains the recorded confirmed-account resend behavior; the FanMind cooldown is not a delivery receipt. No general SMTP outage is established.

## Required correction and boundaries
1. Diagnose and correct the actual browser callback/session handover. The provider-side confirmation is proved, but the exact lost/rejected fragment or Auth lookup failure remains unknown. Preserve identity validation and implement the requested automatic intended-account continuation; never auto-authenticate from an email address.
2. Preserve Daily intent through the account/setup journey and show its actual availability rather than silently offering only monthly plans. Keep server-owned tariff and explicit consent checks.
3. Finish the existing Workspace/Daily controlled Production rollout, not Stripe catalog recreation. The canonical Daily runbook explicitly has only a Staging apply controller and requires a separately reviewed Production path; do not run its Staging-only runner or generic db push against Production. No such schema operation was performed in this investigation.
4. Keep confirmed-account recovery distinct from an actual unconfirmed-account resend, without exposing another person's account status through an unauthenticated lookup.

No customer charge, SQL mutation, Auth/template setting change, merge, deployment, new account or deletion occurred in this continuation. This receipt records diagnosis only; the customer journey remains unaccepted.
