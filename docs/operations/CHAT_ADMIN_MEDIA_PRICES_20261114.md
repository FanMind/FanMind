# Adminchat media prices — #1425

Owner extension 14 November 2026. Implementation work, not live acceptance.

## Existing source and boundaries

Base Main: 067cf53ac5e249fc8528307ff8d09a80bdde32d2, including the existing
verified Storage-absence deletion correction #1494. Retain one private media
library and the existing Character sales_playbook. Do not install sample prices.

Affected R3 contracts: FM-CONTRACT-CHATADMIN-AI-001 and
FM-CONTRACT-CHATADMIN-STORAGE-001; catalogue-only private evidence storage does
not alter existing bucket/object policies. Tenant, Character, human confirmation,
AI cost limits, Storage revocation, protected schema/rollout and payment boundaries
remain authoritative. No evidence quorum, legal/tax approval or target PASS is
inferred from module tests.

## Price resolution

| Product | Priority |
| --- | --- |
| Explicit package at requested quantity | Stored package total; no stacking |
| Single file | Explicit file offer |
| Folder | Closest applicable referenced offer; opt-out stops its inheritance |
| Model | Explicit kind-specific default; no inferred generic offer |

Inactive/missing explicit overrides do not fall back. Unclear, insufficient,
unreviewed, unavailable, deleted or foreign stock cannot substantiate a package.
File IDs and revisions are sorted and bound deterministically. Unit-priced videos
use ceil(actual duration / configured seconds), including a final partial unit.
All new mediaTerms prices use EUR; legacy currencies/prices are retained.

Negotiation must be enabled. Its floor is the stricter of the saved minimum and
the exact cent-rounded percentage floor. A package floor is calculated once from
its total. Explicit upward-unlimited metadata removes the business cap; safe
integer currency representation remains a technical bound. Without that explicit
metadata the existing negotiation behavior is unchanged. Taxes are configured
end-price display, not automatic legal/tax advice or approval. Unconfirmed tax
mode withholds new firm offers. Confirmed inclusive VAT is split in integer cents;
exempt display has no invented tax rate.

## Persistence and rollout

The source normalizer retains validated mediaTerms when editing the existing
playbook. Existing arbitrary media metadata is not treated as instructions.
Changes are guarded by authenticated Owner, Workspace, Character revision,
Origin, size/rate limits and the existing atomic catalogue RPC. New Model/package
writes use a separate CAS RPC over the same Character playbook, not a price table.

Controlled SQL, never part of a normal Web deployment:
`supabase/controlled/chat_admin_media_prices.sql`.
Private schema fanmind_media_price_evidence is not exposed through the Data API.
Its trigger-only definer writes immutable old/new playbook revision evidence;
no anon/authenticated/service_role table privileges are granted. Character erase
cascades to that history. The offer writer validates live Character authority,
revision, approved files/revisions, effective price source, quantity, discount,
upper bound and tax against stored offers. Generation text and its snapshot
commit in one transaction. Evidence attaches to the inbound message, so existing
message retention/erase cascades; historical rows are never repriced.

FANMIND_CHAT_ADMIN_MEDIA_PRICING_V2_ENABLED defaults off. A stored v2 playbook
cannot silently run under the disabled v2 runtime. Keep it off until exact-head
native SQL and source tests pass, controlled schema verification/apply succeeds,
and the checked release is deployed to the existing Staging target. Production
remains outside this release.

## Acceptance still required

- Native PG17: scoped writes, revocation, revision audit, atomic rollback,
  immutable offer conflict, wrong files/source/price/tax, retention/erase.
- Form and browser: folder/file/package, inheritance, default, reload, optional
  upper cap, confirmed tax and video units; 35/70 EUR only in synthetic fixtures.
- Real Desktop Staging: PNG/MP4 upload, review, exact preview/stock, prices,
  independent Storage absence after delete, cleanup. Reuse existing reserved
  synthetic fixtures; do not claim old source checks as this target proof.
- Practical Mobile remains VERSCHOBEN – APP-ABNAHME, no Web blocker or PASS.
- Mandatory exact-head CI/God Mode checks and regular reviewed merge first.

## Verification state

Local regression groups passed (186 and192 cases, with one existing local skip).
Focused pricing/catalogue cases passed18/18. TypeScript and changed-file lint
passed. Local Webpack production build passed; hosted normal build is required.
God Mode preflight passed; this is not a release ALLOW or target acceptance.
Native PG17 cases are wired into the existing media CI job and await execution.
The new feature remains off. The protected schema/runtime control path must be
validated before activation. Actual PNG/MP4 lifecycle, private Storage absence
and complete Desktop acceptance remain required on the existing Staging target.
No real Character data or sample prices are installed by this change.

## Protected Staging procedure (prepared, not executed)

1. Complete current-head CI, native PostgreSQL and review. Merge requires a
   separate Owner decision; this PR must not merge itself.
2. Deploy that exact accepted Main to the existing protected Staging target,
   with the new price flag off. Preserve existing customer/Character data.
3. Require a healthy retention proof younger than30hours on an ancestor with
   the identical retention executable/import/SQL/reference/workflow/TLS/lockfile
   and runtime dependency contract. The retained daily run is not re-executed or
   relabelled. The protected read-only preflight revalidates it on the reviewed
   target: only exact regular-file additions of the pinned catalogue, price
   evidence and existing Consent SQL may differ. Native PG17 compares the full
   base Support catalogue and actual retention behavior before/after additions.
   Changed/removed/renamed/executable/unpinned files and unknown SQL still block.
   Target, Owner, role/schema, latest status and database-clock freshness checks
   remain required; source equivalence alone is not target acceptance.
4. Use `.github/workflows/chat-admin-media-prices-staging.yml`, action `verify`,
   reviewed_commit equal to deployed Main, confirmation `staging-media-prices-verify`.
   ABSENT is readiness information only, not a schema PASS or activation grant.
5. A separately approved `apply` uses confirmation `staging-media-prices-apply`.
   The checksum-pinned runner installs only this additive evidence schema inside
   one transaction with advisory lock, timeout and source-derived postflight;
   partial/drifted existing state blocks. It creates no customer prices or media.
6. Re-run read-only verification. It checks exact function bodies/privileges,
   private schema access, RLS, cascades and the revision trigger. Native tests
   also prove denial on altered grants, disabled trigger and disabled RLS.
7. Only after authorized synthetic acceptance preparation may the existing
   `staging-media-catalogue-runtime.yml` use `pricing-on`. Its independent
   preflight requires an exact price-schema PASS; ABSENT cannot enable it.
   `pricing-verify` reads effective state. `pricing-off` owns only the new price
   flag. Existing catalogue/video, Support, provider and billing flags are
   preserved, with config/process readback and the existing rollback path.
8. Use dedicated disposable synthetic Characters/Fans for example prices and
   package negotiation. Never overwrite an existing real Character's biography,
   media, prices, rules or settings. Prove one image, one normalized video,
   explicit media review, exact offer source/quantity, lower/upper negotiation,
   reload, isolation, revoke/delete and independent private-object absence.
9. Complete cleanup and retain redacted, exact-release evidence. Practical
   Mobile remains deferred to App acceptance. No Production action is prepared
   or authorized by these Staging controls. All steps above remain unexecuted.

## Folder/upload follow-up source correction

The manual evening-dress attempt observed on 14 November targeted an existing non-synthetic Character
and its existing selected folder. No media row was present in the
read-only inventory. That real user attempt is separate from earlier automation
file-transfer failures. Its historical exact HTTP response, bytes and detected
image format were not available; no assertion about its specific cause is made.

A concrete server defect is reproducible independently: the old four-character
repeated-group Base64 regexp can throw RangeError on an otherwise permitted
5-MiB image/25-MiB video payload, resulting in the generic 503 catalogue error
before normalization or Storage. The correction uses bounded alphabet/padding
validation without recursive regexp repetition. Limits, decoding, actual image
and video normalization, owner revalidation and private Storage remain intact.

Folder deletion now uses an explicit in-page confirmation/cancellation over the
same atomic empty-only RPC, without a native confirm dialog. Occupied folders
remain rejected; no media deletion or cascade is added. Direct content and child
navigation replace the misleading recursive file view. Mutation errors retain
the primary HTTP status even when a refresh fails, proxy HTML is never shown,
and retry selection is cleared when its destination changes. The failed batch
state shows file type/size and an explicit failure phase rather than leaving
processing active. Existing retained customer folders/prices are not test data.

Affected contracts: FM-CONTRACT-CHATADMIN-AI-001 and
FM-CONTRACT-CHATADMIN-STORAGE-001; gates unchanged. No SQL, grants, packages,
runtime switches, Support, Meta, Billing or Production changes. Source/CI PASS
must not be described as deployed or as complete real Storage acceptance.
