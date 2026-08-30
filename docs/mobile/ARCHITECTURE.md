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
- `fan_analysis_reports` (read-only mit Workspace- und Kontaktfilter; die
  Neuerzeugung läuft ausschließlich über die autorisierte Serveraktion);
- `followups` (global, pro Kontakt und für das aktuelle Tagesdatum jeweils
  explizit nach `workspace_id` begrenzt).

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

The Mobile contact detail exposes the same three sections for every fan:
`Nachrichten`, `Follow-ups` and `Kontaktwissen`. The fan-analysis endpoint
accepts a Mobile Bearer token only through the active owner authorization path,
reuses the existing authorized Web action and never moves provider credentials
or service-role access into the app. Workspace members cannot create or update
analysis state or consume provider quota. Mobile
renders a stored report only with source period, sample size, confidence and
review state. Production activation is still fail-closed: while the required
Workspace analysis/privacy contract, active-processing entitlement and complete
report-provenance schema are not all applied and validated, Mobile and Web show
the feature as `In Vorbereitung` and expose no generation control. The route
returns typed 400/403/422/429/503 failures for future authorized clients.
An inactive/read-only Workspace is a permission denial, never a missing-contact
response. Until the controlled provenance migration is verified in Production,
the shared Web/server reader may fall back to the old report column set only
when PostgREST explicitly reports missing provenance and parallel individual probes prove
that the complete new column set is absent. A partial schema is an error. The
legacy reader returns null provenance, and both Web and Mobile remain fail-closed
and do not render its conclusions. Current reports expose source period,
confidence and review state on both surfaces. A rejected review state is also
fail-closed: Web and Mobile show only rejection metadata, never the rejected
conclusions. Rejected or incomplete-provenance reports are also excluded from
the productive reply-suggestion prompt context. Capability lookup failures map to the typed service-unavailable
state before the disabled-capability branch. An analysis-read error and any
saved report hidden for incomplete provenance gate the empty state because
neither proves that no saved report exists.
Until the capability gate is active, Web and Mobile both expose analysis
generation as in preparation and do not render an enabled submission control.

Today's dashboard Follow-ups use an exact count, bounded page loading up to
1,000 rows and explicit truncation state. Priority groups are loaded in semantic
order (`urgent`, `high`, `normal|medium`, `low`) before that cap, and every page
uses `created_at` plus `id` as a stable boundary. The compact dashboard renders
at most the first 20 and links to the central Follow-up screen. Null or custom
legacy priorities are loaded in a final fallback group. Its read error is
section-specific and gates both the empty state and count badge, so an unknown
count is never displayed as a successful zero.
The open-status predicate keeps legacy `NULL` rows readable alongside normal
open rows while excluding both `completed` and historical `done`. The central
Follow-up screen loads the complete open result in stable 200-row pages ordered
by due date, creation time and ID; it is therefore a real destination for work
outside the compact dashboard selection. It reloads on screen focus so a
Follow-up added in a fan detail appears immediately when the user returns.
Per-contact Follow-up load errors remain section-specific on initial load and
after either manual or suggestion-based creation, so a failed refresh can never
be rendered as a valid empty list next to a save-success notice. The bounded
100-row fan list has an exact count and an explicit truncation notice.
Contact-knowledge reads have the same section-specific error/empty-state split.

Model-generated unreviewed analysis confidence remains capped below 100.
Fallback-only guidance saved without an available OpenAI key is capped at a low
20-point scale and is never presented with model-level confidence. A report is
not generated or persisted unless at least one bounded source message provides
a valid source period; that condition returns a typed unprocessable-context
failure before any provider call or report write. Messages with a missing or
invalid timestamp are excluded before context bounding and are excluded again
from the final provider payload, provenance count and confidence calculation.

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
9. explicit internal-device test before EAS distribution;
10. exact-commit `npm run store:check` plus Production target revalidation
    before one Android AAB; Submit, Update and Play publication remain separate.

Ein SHA-gebundener Geräte-Abnahmevalidator in
`docs/mobile/DEVICE_ACCEPTANCE.md` verbindet den aktuellen Android-Nachweis
mit dem redigierten Receipt des exakten signierten Preview-Builds. Sein
Vorbereitungsbefehl übernimmt ausschließlich die Receipt-Bindung und lässt
alle 19 Geräteprüfungen auf `pending`; er ersetzt keinen echten Gerätetest.
Ein separater iOS-Nachweis bleibt für Phase 8 möglich und läuft ebenfalls nur
mit privaten Nachweisen.

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
- [x] main-only Android Production AAB control with an action-time
      Store-readiness gate, frozen existing credentials, terminal artifact
      verification and disabled Submit/Update; exact run `33316172583`
      completed one verified Android `1.0.0` AAB for `e964150...`;
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

- [x] allow `fanmind://reset-password` in the confirmed Production Supabase
      Auth project;
- [ ] real password-recovery e-mail/device test;
- [x] exact EAS project binding and existing frozen Android signing credentials
      proven by the accepted Preview and Production AAB runs;
- [ ] protected `mobile-development` environment acceptance; Preview and
      Production project/public-environment checks are accepted on their exact
      recorded commits;
- [x] signed Android preview build plus bounded owner UI/runtime acceptance;
- [ ] signed iOS preview/TestFlight build and iOS signing acceptance in Phase 8;
- [ ] complete private 19-check Android device record; the iOS device record
      belongs to Phase 8;
- [ ] successful external Mobile Push Staging resource, migration and
      rollback-only acceptance runs before server-key activation;
- [x] one exact-commit Android Production AAB;
- [ ] separate Play app record/internal-test upload after Google account
      readiness;

### Phase C

- approved channel integrations;
- richer native message timeline with attachments and channel actions;
- biometric session unlock;
- externally approved store privacy declarations and signed-binary portal
  submission;
- store release automation after legal and account setup.

The detailed external handoff and test sequence is maintained in `docs/mobile/BETA_RELEASE.md`.
