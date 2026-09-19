# Meta Production OAuth – Facebook/Instagram

## Purpose

This runbook binds the existing FanMind Facebook/Instagram Beta connector to the
real central Meta app without exposing credentials. It does **not** authorize
automatic sending, payment, Mobile work or any unrelated Production mutation.

## Current production finding — 2026-09-19

A real Facebook connection attempt from the already accepted Admin-CRM account
reached Meta with example deployment placeholders instead of the real app
configuration. Meta rejected the request with `Ungültige App-ID`. No
`social_connections` row was created.

FanMind must therefore fail closed whenever example values such as
`replace_with_...` or `*.example` remain in the runtime environment.

## Required protected Production values

Keep all real values only in the protected Production environment file/provider
console. Never paste secrets into chat, GitHub issues, PRs, screenshots or logs.

- `FACEBOOK_APP_ID` — real numeric Meta App ID.
- `FACEBOOK_APP_SECRET` — matching server-side Meta App Secret.
- `FACEBOOK_REDIRECT_URI=https://fanmind.ch/api/integrations/facebook/callback`.
- `FANMIND_TOKEN_ENCRYPTION_KEY` — valid 32-byte base64 or 64-hex server-only key.
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN` — required before real webhook verification.
- Instagram uses its dedicated `INSTAGRAM_APP_ID`,
  `INSTAGRAM_APP_SECRET` and
  `INSTAGRAM_REDIRECT_URI=https://fanmind.ch/api/integrations/instagram/callback`.

Legacy `META_*` fallbacks may exist during migration, but Production must never
rely on example placeholders.

## Required Meta Developer configuration

For the exact central FanMind app:

1. Register the exact Facebook OAuth callback
   `https://fanmind.ch/api/integrations/facebook/callback`.
2. Keep the app/account roles and provider permission state explicit.
3. Messenger connection needs FanMind's bounded Messenger scopes.
4. Facebook comments are a **separate** authorization path. They require the
   comment scopes before FanMind may read/import Page comments.
5. Do not enable content-publishing automation. The FanMind connector remains
   human-send only.

## Expected Facebook flow

1. Existing FanMind user opens `/channels`.
2. FanMind shows Facebook server configuration as `bereit` only when the real
   App ID, App Secret, exact callback and token-encryption key are valid.
3. User clicks `Eigene Facebook-Seite verbinden`.
4. Browser goes to Meta/Facebook.
5. User authenticates only at Meta and grants the requested permissions.
6. If multiple Pages are managed, FanMind requires explicit Page selection.
7. Meta callback returns to FanMind.
8. FanMind saves the workspace-bound encrypted Page token.
9. The existing bounded initial Messenger import runs automatically.
10. For comments, the user separately grants the comment permission; FanMind can
    then synchronize comments into the CRM.

## Acceptance

A successful provider login alone is not enough. Acceptance requires:

- return to FanMind;
- connected Page shown in `/channels`;
- server-side token-present indicator;
- expected granted scopes;
- bounded first Messenger import result;
- comment permission plus comment sync result;
- tenant isolation;
- duplicate/idempotency behavior;
- disconnect/reconnect behavior;
- no automatic sending.

If any provider/runtime setting is missing or still a placeholder, FanMind must
stop before external provider navigation and show configuration as incomplete.
