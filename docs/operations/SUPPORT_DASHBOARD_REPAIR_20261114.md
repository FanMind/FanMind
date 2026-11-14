# Dashboard Support repair — 14 November 2026

Issue #1350; explicit Owner authorization covers correction, checked merge,
protected Staging/Production rollout and synthetic browser acceptance.

## Reproduction and cause

- PASS: actual authenticated Production `/dashboard`, normal Creator account,
  Help opened. Runtime independently read as
  `3af87d509e8ffdfc33b14b47f2983645c4ecd5b3`.
- Main and Staging were independently confirmed at
  `f8a3737f9a47430e9c97ad76c7a483ae84f31fc8`. Latest observed Staging deploy
  succeeded; no active deployment appeared in the fresh Actions list.
- PASS: computed DOM panel width 340px, white background, `max-height:none`,
  `overflow:visible`. Buttons/textarea had zero padding, browser dark native
  backgrounds and inherited light text; global reset removes all spacing.
  Neither component had a stylesheet. This is missing component styling and
  viewport constraints, not a missing Tailwind build or an OAuth fault.
- PASS: live authenticated `/api/support/diagnostics` returned
  `{"error":"not_available"}`. The route emits this exact branch at HTTP404
  before auth/database access when its diagnostics switch is not true.
  The old UI collapsed a deliberately disabled capability into a transient
  account-check warning. No session or permission is relaxed by this repair.

## Changes and boundaries

Scoped shell-token CSS, bounded responsive panel and conversation scrolling,
readable controls, 44px touch targets, keyboard focus/return and Escape.
Channel checks and own-data/handoff controls remain available in named details.
Disabled diagnostics and transport failures have separate nonblocking text and
an explicit retry. Existing API authorization, identity revalidation,
idempotent request IDs, privacy preview/confirmation and handoff remain intact.
No flags, SQL, Retention, provider, Billing, Social or Adminchat settings change.

The existing authenticated `/api/support/conversation` uses `supportAnswer`
from approved local product knowledge. It does **not** call a model; the public
support endpoint does. A stored authenticated reply must not be reported as an
actual model answer. This UI repair does not silently introduce new customer
content disclosure/provider processing or claim complete AI parity.

No registered API/schema/AI contract is changed. The affected consumers are
WorkspaceHelpLauncher and SupportConversation; public support and OwnerInbox
are regression consumers. Existing privacy scope boundaries remain unchanged.

## Validation and rollout status at source preparation

- PASS: webpack production build including TypeScript.
- PASS: 22 Support Centre/rollout/auth/privacy unit and route tests.
- PASS: God Mode structural preflight; existing conservative unsigned release
  decision stays BLOCK and is not rewritten into authorization.
- Browser regression: pending final CI, using actual shell/reset CSS and actual
  mounted components on desktop/mobile. Coverage includes scroll geometry,
  diagnostics disabled/retry, send/persist/reopen, focus and privacy regression.
- Staging/Production rollout and actual dashboard acceptance: NOT_TESTED on
  this candidate until the protected release and live-version checks finish.
- Actual authenticated model answer: NOT_TESTED; existing endpoint is knowledge
  based as stated above. Do not close the full requested acceptance on that basis.
