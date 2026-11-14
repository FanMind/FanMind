# Creator Support pilot — 14 November 2026

Issue #1350. Owner authorizes checked source development/merges and protected
Staging release. New Creator data tools and mutations are NOT authorized for
Production activation. Original Dashboard repair PR1485 is separately deployed
and accepted on Production `bb799466d2c235195fedcb4d80568f9f0bd56969`:
protected runs Staging43588190240 / Production43590049168; actual authenticated
Desktop1504×778, mobile390×844 /320×568, real opt-in AI answer, persistence,
minimize/reopen/reload, withdrawal, diagnostic disabled/retry and keyboard
scroll/focus/Escape PASS. Physical virtual keyboard and destructive live deletion
NOT_TESTED; existing automated privacy tests PASS.

## Implemented boundaries (source, not yet target acceptance)

The existing SupportConversation composer, history, shell tokens and privacy
controls are extended. There is no second chat store or support platform.
`/api/support/creator-context` is private/no-store and hard-denies Production
before auth/content access. On Staging it requires the already configured exact
Operator user + Workspace, active Owner processing entitlement and existing
ChatAdmin capability. No new role, credential, SQL, schema, environment switch,
provider setting, database or public private-data route is introduced. Member
writes stay denied. Existing public Support remains unchanged.

Affected existing compatibility contracts/gates: FM-CONTRACT-CHATADMIN-AI-001 /
FM-IGATE-CHATADMIN-AI-001 (same canonical synthetic Character context/model and
reply semantics); FM-CONTRACT-CHATADMIN-STORAGE-001 /
FM-IGATE-CHATADMIN-STORAGE-001 (existing JWT/RLS, resource scopes and CAS);
FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001 (existing model prices/usage,
no entitlements/Stripe change); FM-CONTRACT-DISCLOSURE-DELETE-001 /
FM-IGATE-DISCLOSURE-DELETE-001 (same own Support retained turns/export/purge).
No prior gate is changed from BLOCK to ALLOW by module tests or this document.

### Read tools

- Explicitly selected Character and optional Fan, derived Workspace only.
- Current style/revision, current approved offer min/recommended/max/discount
  limits, authorized media counts/manual review state, existing coarse channel
  diagnosis (no token/provider error disclosure).
- Latest20 own Character/Fan/conversation messages, at most3 reply observations:
  revision/date/length/question count, price validation against current rules
  only when the message revision and paired inbound are available. No external
  transmission of Fan text. No historical cause invented when configuration or
  generation traces are missing. This is a bounded local diagnostic, **not** a
  semantic evaluation of every CRM message or a reconstruction of deleted data.
- Recent signed style evidence is read only from the actor's existing retained
  Support history. No independent long-term memory or reconstructed erasure.

### Write tools

Two explicit, fixed commands: make answers more casual/friendly (`writing_style`)
or shorter/fewer routine questions (`sentence_style`), one field at a time.
Natural-language parsing is deterministic and only applies to the Creator's
current Support instruction. Stored Fan text, model output and media metadata
are never action instructions. Ambiguous/negated/question-form, financial,
permission, delete and external-send requests cannot select a write tool.

An explicit session grant avoids repeated confirmation for supported reversible
style requests. Character/account/panel/focus changes revoke the grant. No AGB
acceptance is inferred as an AI or management consent. AI comparison has a
separate opt-in explaining that selected Model settings are sent to the existing
OpenAI integration; no Fan content is used. It performs two fixed neutral test
prompts with existing model instructions/structured output/semantic guards,
store:false, timeout, own Workspace usage attribution and a shared4calls/10min
limit. Examples are shown as examples, never as proven future behavioral guarantees.

Existing user-JWT/RLS `updateChatCharacter` performs the single-field CAS. A
server-HMAC signed write-ahead audit and independently verified completion are
stored in existing Support turns. Both bind purpose, actor, Workspace, request
and exact before/after/revision; ordinary chat messages cannot forge them.
Support own-data export/erase and30day retention therefore cover the evidence
without SQL changes. Before values over300characters or overlong receipts fail
closed before a write. Ordinary Character editing still supports longer values.

**Concurrency limitation:** audit POST and Character CAS are not one database
transaction. Write-ahead evidence precedes the mutation; completion is never
claimed until readback and completion persistence succeed. Uncertain operations
can reconcile only the same request ID/current exact revision and value; retries
never blindly repeat a completed CAS. Other revision changes fail closed. This
is an explicitly limited pilot, not a transactional universal settings manager.
Undo requires the retained, correctly signed original audit + verified completion,
same actor/Workspace/Character, exact current revision/value and a new CAS with its
own audit. It cannot overwrite intervening manual edits. Deletion/expiration of
evidence disables undo; no hidden restore copy exists. Aborting a browser request
cannot undo a mutation already accepted while authorization was valid.

## Legal / registration review draft — not published terms

Existing AGB, public privacy notice, Support opt-in, own-data export/erase,
Workspace roles and `LEGAL_COMPLETION_STATUS`, AVV working draft and retention
register were reviewed. Current registrations do not establish a blanket mandate
for arbitrary support reading/writing. Do not silently amend accepted contracts.

| Category | Proposed authority | Current pilot |
| --- | --- | --- |
| Selected settings/status/local diagnostic | Authenticated scoped role + transparent support purpose | Explicit session read grant, exact synthetic Operator only |
| Two reversible style presets | Explicit scoped management mandate, current CAS revision | Session grant + current direct instruction; audit/readback/undo |
| External AI processing of Model configuration | Separate informed, revocable processing decision; verify provider/DPA/region/legal basis | Separate opt-in for fixed synthetic comparison only |
| Fan-content external semantic analysis | Specific purpose/minimized content, proper legal basis and third-party-data/provider review | NOT IMPLEMENTED / NOT ACTIVATED |
| Payments/contracts/permissions/large deletion/external sending | Separate consequential authorization and suitable confirmation | DENIED by this tool layer |

Required before general Creator release: legal review of purposes/legal basis,
Controller/Processor roles, registration/onboarding mandate/version evidence,
DPA/subprocessor/region/transfer status, withdrawal/erasure and retention notices;
independent tenant/role/privacy/usage acceptance. No legal clearance is inferred
from technical consent checkboxes or Owner development authorization. Relevant
primary references: GDPR Articles5,6,7,13,28,44 at
https://eur-lex.europa.eu/eli/reg/2016/679/oj . Public legal texts remain unchanged.

## Production release plan

1. Complete checked PR, actual protected Staging synthetic end-to-end evidence,
   read/write/undo/AI tests, screenshot review and independent isolation negatives.
2. Resolve external legal/provider prerequisites and approved mandate recording;
   decide remaining scope (general CRM semantic analysis, arbitrary greeting,
   multi-setting management are not implemented by these two presets).
3. Present exact reviewed commit, fields/tools, rollout target, rates, audit and
   rollback limitations, Staging evidence and remaining risks for explicit
   Production activation authorization.
4. A later reviewed code change is required to remove the structural Production
   denial; a merge/deploy or environment typo cannot activate this pilot.
5. Protected exact-current-release deployment, synthetic canary and own-data
   lifecycle checks; preserve Billing/Meta/Operator/Adminchat and stop/rollback
   on any scope, permission, privacy or unexpected-write failure.

At source preparation: implementation/tests local PASS where recorded in PR;
actual Staging pilot and final-head hosted checks NOT_TESTED. General Support2.0
completion and Production activation remain BLOCKED on the declared scope and
external prerequisites, not disguised as complete by the original UI repair.
