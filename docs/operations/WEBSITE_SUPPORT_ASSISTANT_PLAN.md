# FanMind Support Assistant – implementation contract (Issue #1350)

Status: development specification only; no production activation.

## Existing implementation to reuse
- Website chat session, consent, origin allowlist, message ingestion, inbox, and handoff foundations.
- PR #1250: default-off website AI reply route and visitor/assistant chat bubbles. Verify whether merged and reconcile with current main before touching implementation.
- Do not bypass the controlled staging database migration and legal/privacy gates described in WEBSITE_CHAT_FOUNDATION.md.

## Release 1: FanMind public support
- Bottom-right accessible, keyboard-operable and mobile-friendly support launcher on public pages; no pre-consent session or processing.
- Answer documented FanMind FAQs, registration, product usage, current verified prices and troubleshooting with source-grounded retrieval. Unknown information must trigger a transparent fallback rather than invented claims.
- Support handoff retains the complete conversation with explicit visitor consent; do not imply an email was sent unless delivery is verified.
- Demo behavior may show capabilities but must never expose another customer's knowledge or messages.

## Release 2: authenticated in-app assistance
- Persistent collapsible launcher throughout authenticated FanMind pages; accessible across navigation, safely clears private context on logout/workspace change.
- Server derives user and workspace from verified auth, never from client-provided identifiers. Read-only account diagnostics only for authorized resources.
- All API paths enforce tenant isolation and least privilege, with negative cross-workspace tests.

## Release 3: bounded repairs
- Read-only diagnosis may inspect connection health without altering tokens or provider state.
- Repair actions are explicit allowlisted operations (initially supported connection reinitialization only). Show effect, risk and account; require fresh per-action customer confirmation.
- Check auth and workspace again at execution time; enforce replay protection, idempotency, rate limits, audit records and post-action health verification.
- Never expose credentials, silently reauthorize providers, delete messages or perform irreversible changes. Failure yields support escalation with safe diagnostic context.

## Release 4: customer embed
- Workspace-scoped installation and exact verified HTTPS origin, individual embed snippet, consent-first handling and strict knowledge segregation.
- Conversation and human handoff belong exclusively to the installation's workspace.

## Acceptance gates
1. Inspect current main, PR #1250, existing work locks and any parallel implementation before coding; avoid duplicate PRs.
2. Separate small implementation PRs; CI, unit, integration, accessibility and adversarial tenant tests.
3. Isolated staging E2E for public, authenticated and embedded modes; negative origin/consent/auth tests.
4. All features default off until security, privacy and release review; no production deploy or provider mutation without distinct authorization.

Owner authorization: start development, 2026-10-22. This document does not authorize live repair operations.
