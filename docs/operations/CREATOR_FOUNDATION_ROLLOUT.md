# Creator foundation: controlled rollout contract

Status: source preparation, not a completed Staging or Production rollout.
Decision: FM-DEC-015 / FM-CR-029, 2026-09-10. One Creator per own account and Workspace.

## Reviewed artifact and target boundary

- SQL: `supabase/controlled/creator_intelligence_foundation.sql`
- SHA-256: `8065596853f07feffd419ac1473a34fe727a6152f1f742161af16a909d2f457f`
- Required PostgreSQL major: 17. Real isolated CI checks use the existing pinned PG17 service and a dedicated disposable database only.
- Observed FanMind Staging on 2026-09-10: PostgreSQL 170006; creators, creator_voice_profiles and creator_sales_playbooks absent. This read proves absence, not permission or successful application.
- No migration was applied during this implementation. No customer records or provider settings were changed.
- A Supabase CLI scaffold attempt was interrupted during dependency acquisition; an empty scaffold and temporary version marker were removed. The reviewed SQL remains outside the generic migration ledger. No generic db push or ledger repair is authorized by this file.

## Before a target write

Bind the reviewed commit and artifact hash to the explicit isolated Staging target,
current source/release, target schema, existing RLS/ACLs and recovery evidence.
Confirm that the three new profile tables and event table are absent and that
contacts/conversations/contact_ai_profiles have the expected existing parent
columns and the Meta SELECT-only authenticated profile permissions. Verify
constraint/function names are unused, workspace isolation is current, and the
normal application still operates with the Creator flag absent/false. Stop on
drift or an already/partially installed artifact; do not rerun or repair blindly.

The protected, target-bound Apply/Verify path is implemented in `creator-foundation-staging.yml`. Synthetic signed-in owner/member runtime acceptance is still required. This document is not an executable deployment
runner or an automatic authorization for Production. The new SQL contains no
backfill and no real fan or Creator data. Its transaction rolls back on errors;
locks time out after 5 seconds and statements after 60 seconds.

## SQL and API counterchecks

The required CI job applies the actual artifact to its disposable database and
checks one Creator per Workspace, authenticated owner/member/foreign/anonymous
access, composite event parents, explicit approval revisions, duplicate purchase
evidence, server-owned reviewer/time, and atomic rollback after a partial-save
failure. The existing contact_ai_profiles table remains authenticated SELECT-only.
Only `record_creator_fan_review`, a fixed-search-path, explicitly owner- and
contact-scoped SECURITY DEFINER function, updates its commercial_profile column.
It cannot update existing AI-derived profile fields. Profile bundle saving uses a fixed-search-path, explicitly owner-checked
SECURITY DEFINER RPC. All four Creator tables are authenticated SELECT-only:
no direct table INSERT/UPDATE can bypass expected revisions or approval. Trigger
EXECUTE is revoked from PUBLIC/anon/authenticated/service_role. The two RPCs are
executable only by authenticated and their owner; unexpected table, column and
function grantees fail postflight. These controls are not future team approval workflows.

Then verify the same contracts with real Staging JWTs, including the existing
legacy account, two independent synthetic Creator accounts, stale profile changes
while a request is in flight, DSAR export and account/contact deletion. No real
purchase, provider send, scraped text or customer data is needed for this check.

## Activation and recovery

`FANMIND_CREATOR_INTELLIGENCE_ENABLED` is server-only and defaults false. It may
be enabled on a compatible reviewed target only after the target checks above.
With the flag off, the original reply system remains in use; settings show the
extension as being prepared. With a configured Creator, incomplete/unapproved/
paused profiles block Creator generation instead of borrowing the chatter voice.
No Creator profile is invented from signup metadata.

Recovery for a bad application release: disable the target's Creator flag and
revert the reviewed application change through normal release controls. Preserve
all created persona and purchase records. Do not automatically drop tables,
columns or event history. A schema rollback after real writes requires a separate
export/recovery plan. Ordinary deletion follows Workspace/contact cascades;
deleting a historical approving user clears the actor and invalidates that
approval. Contact merging inside Creator accounts is blocked until an atomic
merge can preserve all commercial parent relationships.

## Remaining acceptance

Real target migration/runtime proof, two-Creator blinded voice quality, complete
purchase/outcome attribution and provider/legal acceptance remain open. A green
code build is not evidence for any of these external gates. Android, paid
activation and the already accepted Restore/Staging sub-gates are unchanged.

## Resumed Staging controller — 11 September 2026

The preserved controller from cd5cac7c is resumed against reviewed main d19254f0.
`npm run db:creator-foundation:check` checks the reviewed SQL checksum offline.
The protected workflow accepts only `main`, the exact reviewed commit and
`verify-creator-foundation` / `apply-creator-foundation` for the respective action.
It reuses the existing isolated Staging session pooler with `verify-full`, a
private password-file snapshot, Production-target exclusion and two write gates.
Verify classifies absence or performs an exact temporary-reference catalog
comparison. Apply is advisory-locked and transactional, compares before COMMIT
and independently verifies afterwards. Indeterminate writes stop for Verify;
no automatic retry, global migration or schema deletion. Runtime stays disabled.

Actual PG17 CI tests include parent RLS prerequisites, rollback after an unsafe
parent, rejection of weakened constraints/policies/column rights/functions and
original single-Creator, stale-revision and cross-account behavior.

The source now excludes both explicit and default legacy reply-profile prompts
from a configured Creator's AI context. When the Creator rollout is enabled,
settings expose business rules and the one Creator style; the reply menu does
not offer legacy profiles. Stored legacy settings are preserved for recovery.
