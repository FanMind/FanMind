# FanMind Mobile Architecture

## Decision

FanMind Mobile is a native React Native / Expo product, not a mobile rendering of the public website.

```text
Repository
├── src/                  Next.js Web application and server API
├── apps/mobile/          Independent Android/iOS application
└── supabase/             Shared, RLS-protected data model
```

## Independence contract

Mobile owns its own:

- package and lockfile;
- Expo SDK and React Native version;
- navigation and route structure;
- design tokens and UI primitives;
- Android package and iOS bundle identifier;
- EAS build profiles;
- JavaScript export artifacts plus credential-separated native build evidence;
- native session persistence;
- release cadence and store distribution.

Web owns its own:

- Next.js routes;
- public landingpage;
- CSS modules;
- desktop and responsive workspace shell;
- nginx/PM2 production deployment;
- web cookie session.

Neither surface may import UI code from the other. Backend contracts are shared deliberately and tested separately.

## Authentication

1. Mobile signs in directly against Supabase Auth using the public anon key.
2. The session is stored with a chunked `expo-secure-store` adapter.
3. Contact, memory and follow-up access uses the user JWT and Supabase RLS; mutations are Owner-only and Member sessions remain read-only.
4. The AI endpoint receives the same user JWT in a strict `Authorization: Bearer` header.
5. The server validates the JWT with Supabase, resolves the authorized workspace and confirms contact ownership.
6. The server loads the workspace company prompt and the active default reply profile after authorization. Mobile never receives or transmits raw workspace prompt text; a future selector may send only a stored profile ID.
7. Workspace prompt instructions cannot override truthfulness, privacy, schema, cost, authorization or manual-send rules.
8. Stored conversation history is loaded server-side after contact and Workspace authorization. Mobile may send the current manually entered inbound message, but never a client-selected historical transcript or a higher context tier. The effective server-owned tier bounds history to 50/100/150 current messages.
9. Existing Web requests continue to use the secure FanMind cookies when no Bearer header is present.

A malformed Authorization header fails with 401 and never falls back to a Web cookie.

### Password recovery

- Supabase Auth uses the PKCE flow in Mobile.
- The only accepted recovery route is `fanmind://reset-password`.
- The callback parser accepts either one PKCE code or one complete access-/refresh-token pair, never a mixture or partial pair.
- Foreign schemes, foreign routes, provider errors, excessive lengths and ambiguous credentials fail closed.
- Recovery codes, tokens and complete callback URLs are never logged.
- `updateUser({ password })` is reachable only while the AuthProvider holds a confirmed recovery state and session.
- Supabase must externally allow the exact recovery redirect before a real e-mail/device test can pass.

## Secret boundary

Allowed in the compiled app:

- Supabase project URL;
- public Supabase anon/publishable key;
- FanMind API base URL.

Never allowed in the compiled app:

- Supabase service-role key;
- OpenAI key;
- Stripe secret or webhook secret;
- Meta or Telegram tokens;
- backup identities;
- Production database credentials.

## Data access

Mobile uses direct Supabase queries only for tables already protected by RLS:

- the parameterless member-safe Workspace RPC / `workspace_members`; only an Owner lookup reads the base `workspaces` table;
- `contacts`;
- `conversation_messages` (Inhalt read-only, höchstens 100 aktuelle Nachrichten
  je Kontakt; zusätzlich nach `workspace_id` und `contact_id` gefiltert;
  neueste zuerst, dynamischer Plattformfilter und explizite Aktualisierung).
  Das Start-Dashboard liest ausschließlich `direction = inbound` und
  `seen_at is null`; beim Öffnen eines Kontakts darf nur der Owner diese
  Workspace-/Kontakt-gebundenen Zeilen über das vorhandene `seen_at`-Feld als
  gesehen markieren;
- `memories`;
- `followups`.

All queries include the current `workspace_id` even though RLS remains the final authorization layer.

Owner contact create and update additionally:

- validate and normalize every field before the request;
- insert `workspace_id` explicitly;
- update by both `workspace_id` and contact `id`;
- reject missing authorized update rows;
- perform a minimal handle-plus-source duplicate check in the current workspace;
- never use a service-role credential in Mobile.

Owner Follow-up create uses the existing RLS-protected `followups` contract,
validates reason, non-past calendar date and `low|normal|high` priority in the
client policy, and always includes both current Workspace and contact IDs.

Server-only functions remain server-only:

- AI provider calls;
- admin operations;
- billing and referral reconciliation;
- backup and monitoring;
- webhook ingestion;
- external channel credentials.

## Secure local state

The SecureStore adapter maintains a bounded registry of FanMind-owned storage keys. A safe local logout:

1. stops and drains pending offline-cache writes;
2. ends the local Supabase session;
3. removes every registered key and all chunks;
4. clears the registry;
5. resets the React session and recovery state;
6. immediately clears the WorkspaceProvider state.

The one encrypted offline read cache is registered with that same purge contract. It is account- and workspace-bound, expires after 24 hours, contains at most 50 contacts and is limited to 80,000 UTF-8 bytes before SecureStore chunking. Only workspace name plus contact ID, workspace ID, display name, handle, source/platform, status and update time are retained. Contact knowledge, summaries, messages, AI content, internal notes, follow-ups and credentials are excluded. The UI exposes the cache only after a transport-level failure and remains read-only; authentication, RLS and server errors fail closed.

Upgrades probe the former colon-delimited v1 SecureStore namespace through a read/delete-only native compatibility bridge. A complete legacy value is registered and written into the current v2 namespace before v1 is removed. Partial values are never returned, the current v2 value always wins, and logout retains retry metadata whenever either namespace cannot be fully purged.

## Native route map

```text
/
├── (auth)
│   ├── login
│   ├── forgot-password
│   └── reset-password       Deep link: fanmind://reset-password
└── (app)
    ├── index                 Dashboard
    ├── contacts
    │   ├── index             Contact search/list and create entry point
    │   ├── new               Create contact
    │   ├── [id]              Read-only message history, contact knowledge and AI workflow
    │   └── [id]/edit         Edit contact
    ├── followups             Open tasks
    └── settings              Session, purge and architecture boundary
```

## Product constraints

- FanMind is an assistant, not an autonomous bot.
- Reply options are prepared, never sent automatically.
- Saving contact knowledge or a follow-up requires an Owner action; Members can view but not save or complete.
- Coming-Soon integrations are not shown as active.
- Mobile does not execute billing, referral or social-channel write automation.
- A source/platform field on a contact is metadata, not an active external integration.

## Release boundary

A Web merge can modify shared API contracts but cannot publish a mobile binary. A Mobile merge can modify native code but cannot deploy the website. Contract changes require:

1. normal FanMind CI;
2. separate Mobile CI;
3. mobile TypeScript check;
4. Expo Doctor;
5. Android and iOS JavaScript bundle exports;
6. isolated Android-/iOS-Native-Prebuild mit Identity-, Deep-Link-,
   SecureStore-, Splashscreen-, Privacy-Manifest-, Android-API-36-,
   Berechtigungs- und Secret-Grenzen;
7. Android-Debug-APK mit lokalem Debug-Key ohne Release-/Store-Credentials und codesign-freie iOS-Simulator-App in der Native-CI;
8. main-only read-only EAS resource verification before any signed build;
9. explicit internal-device test before EAS distribution.

Ein SHA-gebundener Geräte-Abnahmevalidator in
`docs/mobile/DEVICE_ACCEPTANCE.md` verbindet Android und iOS jeweils getrennt
mit dem redigierten Receipt des exakten signierten Preview-Builds. Er ersetzt
keinen echten Gerätetest und läuft ausschließlich mit privaten Nachweisen.

## Implementation phases

### Phase B — repository implementation

- [x] create/edit contacts;
- [x] bounded read-only contact message history without offline persistence;
- [x] copy replies or hand only the selected reply text to the native
      Android/iOS share sheet; FanMind selects no recipient or channel and
      performs no send;
- [x] password reset and deep-link callback;
- [x] strict local SecureStore and workspace purge;
- [x] EAS profiles and beta handoff documented;
- [x] SDK-compatible Development-Client and explicit EAS environments;
- [x] credential-free Android/iOS native configuration verification;
- [x] Android debug with a local debug key and code-signing-free iOS Simulator native compilation in CI, both without release/store credentials;
- [x] main-only read-only EAS project/public-environment resource check
      prepared without build, submit, update or signing access;
- [x] bounded offline read cache with the central purge contract;
- [x] native notification configuration and fail-closed follow-up response routing;
- [x] native wordmark splashscreen and prepared store metadata;
- [x] dedicated opaque 1024×1024 iOS/legacy icon plus safe-zone Android
      adaptive foreground from editable vector sources;
- [x] app-owned iOS required-reason privacy manifest, no tracking domains and
      fail-closed Android compile/target API 36 verification;
- [x] separate technical Apple App Privacy and Google Play Data Safety drafts;
- [x] explicit push-permission opt-in and encrypted, service-role-only
      one-device token registration prepared without delivery activation;
- [x] checksum-pinned, main-/reviewed-commit- and protected-Staging-bound
      push resource, migration and rollback-only acceptance controls prepared;
      Production targets, real tokens and every delivery action fail closed;
- [x] default-disabled server-side single-reminder policy, minimal payload,
      one-hour TTL, tenant/resource authorization, common server-only target
      binding, bounded retry and Expo ticket/receipt handling covered with a
      synthetic provider only; CI preserves the no-route/worker/migration state;
- [ ] controlled push migration/key activation, signed-device registration
      proof, separately approved atomic delivery ledger with transactional
      target revalidation and one explicit Staging send/receipt proof;

### Phase B — external verification

- [ ] allow `fanmind://reset-password` in the correct Supabase Auth project;
- [ ] real password-recovery e-mail/device test;
- [ ] EAS project ID and credentials;
- [ ] protected `mobile-development`, `mobile-preview` and
      `mobile-production` environments plus successful read-only resource
      checks;
- [ ] signed Android preview build;
- [ ] signed iOS preview/TestFlight build;
- [ ] real Android and iOS device test records.
- [ ] successful external Mobile Push Staging resource, migration and
      rollback-only acceptance runs before server-key activation;

### Phase C

- approved channel integrations;
- richer native message timeline with attachments and channel actions;
- biometric session unlock;
- externally approved store privacy declarations and signed-binary portal
  submission;
- store release automation after legal and account setup.

The detailed external handoff and test sequence is maintained in `docs/mobile/BETA_RELEASE.md`.
