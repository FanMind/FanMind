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
