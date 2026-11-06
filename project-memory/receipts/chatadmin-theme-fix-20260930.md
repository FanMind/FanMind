# ChatAdmin theme/readability fix — 2026-09-30

- Scope: user-visible CSS-only correction for `/chatadmin`.
- Owner evidence: Production screenshots showed the ChatAdmin route in a light standalone surface inconsistent with the FanMind dark UI, and typed form values were unreadable white-on-white.
- Branch: `fix/chatadmin-fanmind-theme`.
- PR: #1232.
- Implementation head at first publication: `690aa372ef82848547631e0aa529d8a15198baa2`.
- Change: reuse FanMind theme variables for page, cards, buttons, fan/history/reply surfaces and all form controls; add visible text/caret/placeholder/focus/autofill states and responsive spacing.
- Acceptance contract: ChatAdmin remains functionally unchanged; the page is visually coherent with FanMind and entered text is readable in inputs/textareas, including browser autofill.
- Boundary: no authorization, capability, schema/RLS, AI, provider, Billing, customer-data or auto-send behavior changed.
- Risk: R1/R2 presentation correction. Normal PR checks plus owner-visible browser retest are sufficient; no new Staging/Production protected mutation or additional hardening layer is part of this task.
