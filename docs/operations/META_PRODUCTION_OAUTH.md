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

## Owner Creator reception rollout — 13 November 2026, Issue1464

Existing Production App: `2214477125984114` (FanMind). Never reuse the standalone
Staging reception app1547928503809961 or child test app1637976007865045.
Observed baseline: Production3af87d509e8ffdfc33b14b47f2983645c4ecd5b3,
Staging88898c6f2a8bcede12bdad73a608b9c1b2f29b22. Creator Channels confirms
invalid/missing App-ID, callback and encryption; zero contacts remain.
Meta already lists the exact Production OAuth callback. App publication is
currently disabled and the business portfolio is marked unverified. This is
not evidence of general customer eligibility or an approved App Review.

The manual `production-meta-runtime.yml` path is Owner actor-, exact reviewed
main-, protected Production-, exact live ancestor-, runner-, origin-, app- and
Supabase-target-bound. It uses the shared `fanmind-production-deploy` lock and
reuses the existing renderer and transactional rollback helper. Staging control
checks remain unchanged. No schema/CRM/connection writes or token copying occur.
Actions: `inspect`, `configure`, `subscribe-webhook`, with
`production-meta-<action>` confirmation and public app ID2214477125984114.

`inspect` emits booleans only. `configure` preserves an existing valid key and
verification token, rejects conflicting aliases/inherited overrides and refuses
to generate a key when dependent encrypted social-connection data exist. The
existing App secret is preferred; only if absent may the protected Production
secret `FANMIND_PRODUCTION_META_APP_SECRET` supply the matching secret. Neither
secret is a workflow input or command-line argument. A mode0600 durable host
snapshot is saved before the atomic env update. PM2 reload retains the existing
release and Support setting; health/version failure invokes rollback.

`subscribe-webhook` separately checks the exact Production Page app subscription
and may request only messages/feed. Conflicting callbacks/extra Page fields fail
closed. It does not subscribe a Page or enable a local connection. The normal
Creator OAuth flow performs its own explicit Page selection and Page subscription;
verify that separately after user authorization. Never use a Staging Operator
route as Creator acceptance. Request fresh DM/comments only after both are ready.

Affected boundary: FM-CONTRACT-SOCIAL-CRM-001 and
FM-IGATE-SOCIAL-CRM-001 (see authoritative registries for current identity).
Local controller/negative/recovery policy tests and ordinary green CI are source
checks only. Genuine Creator OAuth, automatic arrival, fan mapping, replay and
logout/re-login acceptance remain pending until actually observed on Production.

Meta's Page webhook UI additionally states that unpublished apps receive no real
production data, even from app admins/developers/testers. Therefore the bounded
Owner reception test also requires publication; permission test readiness does
not bypass that requirement. Controller configuration first authenticates the
secret against the pinned app and rejects inherited runtime target conflicts.
Provider subscription changes also save a private durable prechange inventory.


## Workflow registration continuation — 14 November 2026

On Main8db6c86 the source file exists, but GitHub Actions returns “This workflow
 does not exist” and the exact filename filter returns0runs. Local YAML parsing,
existing workflow-environment/supply-chain checks and controller tests pass;
there is no established YAML/permission fault. The server-side indexing cause
remains unproven. The existing workflow now has a path-limited Main push and
PR validation job to exercise registration through a normal event. This hosted,
secret-free job runs only offline boundary tests. It never takes the Production
lock or reaches the host. The original controller now explicitly requires
workflow_dispatch and retains Owner actor, reviewed current Main, exact live
ancestor, protected environment, pinned app and shared deployment lock. No
runtime code or application deployment changes. Registration and target
inspection must be confirmed after the regular checked merge.

Fresh HTTPS baseline: Productionbb799466d2c235195fedcb4d80568f9f0bd56969;
Staging8db6c86d6319c4fd30b22809eece09148faa311b. Meta app2214477125984114
remains unpublished; portfolio1363510325173493 verification for the legal
operator is incomplete/submission pending. The regular Production Creator URL
currently redirects to login, so no signed-in connection acceptance is claimed.
Affected boundary: FM-CONTRACT-SOCIAL-CRM-001 / FM-IGATE-SOCIAL-CRM-001;
registration alone does not close either live acceptance gate.
