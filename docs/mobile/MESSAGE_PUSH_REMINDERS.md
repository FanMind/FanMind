# Mobile message push reminders

## Current status

Repository policy and native tap handling are prepared for privacy-minimal reminders for unseen inbound messages. The contract is intentionally Staging-only and does not activate a provider route, timer, worker, Delivery-Ledger migration or Production delivery.

The existing Mobile UI already treats inbound `seen_at is null` messages as unseen and routes the user to the relevant fan. This contract reuses that product truth instead of introducing a second unread state. Because that shared unseen state can currently be cleared only by the Workspace Owner path, prepared message notifications are **Owner-only**. Workspace members may retain their existing push registration for other approved Mobile purposes, but they are not eligible for `message_received` or `message_reminder` until a separately approved per-recipient/member acknowledgement contract exists.

The Mobile fan detail marks inbound messages seen only while the `Nachrichten` section is actually displayed. Opening `Follow-ups` or `Kontaktwissen` must not clear message-notification eligibility.

## User experience

For a newly unseen inbound message:

- title: `FanMind`
- body: `Du hast eine neue Nachricht.`
- Android channel: `message-alerts` / `Nachrichten`
- tap target: after authentication, the exact fan detail in section `Nachrichten`
- initial-candidate freshness: at most 60 minutes from the message timestamp

If the message remains unseen for 30 minutes after the initial delivery, at most one delayed reminder may be prepared, but only after the initial provider lifecycle has reached the explicit terminal success state `accepted` (`provider_receipt_ok`). A queued ticket, rejected request, missing receipt, exhausted lookup or any `indeterminate` result must never trigger the delayed reminder under a second dedupe key.

- title: `FanMind`
- body: `Eine Nachricht wartet noch auf dich.`
- Android channel: `message-alerts` / `Nachrichten`
- reminder freshness: no later than 60 minutes after its due time

Message, seen-state and prior-delivery timestamps are accepted only through the same bounded PostgreSQL timestamp validator used by the existing Mobile Push Delivery policy. Impossible dates such as 30 February and malformed/non-ISO timestamps fail closed instead of being normalized by JavaScript date parsing.

A future timestamp, an already stale initial candidate, a non-accepted initial delivery or a stale delayed reminder fails closed. No further reminder loop is allowed for the same message under this policy.

## Privacy

Visible/provider payloads must never contain:

- message text;
- contact/fan name or handle;
- workspace name or ID;
- user or registration ID;
- EAS project ID;
- notes, tags, summary or AI output.

The navigation payload contains only the minimum contact UUID plus a fixed section discriminator. Workspace/message identity and the recipient binding remain server-side for authorization and idempotency.

## Aggregation and idempotency

When multiple unseen inbound messages exist for one fan, the server-side candidate policy collapses them to one newest candidate per Workspace/contact pair and carries only a numeric unseen count internally. Equal message timestamps are broken deterministically by canonical message UUID so repeated reads cannot choose a different candidate merely because row order changed.

The later delivery reservation must be recipient-specific. Its repository policy binds Workspace, message/contact, authenticated user, concrete push registration and EAS project into the internal dedupe identity. The current message-notification eligibility additionally requires that the recipient's current Workspace role is `owner`. A delivery record from another user, registration, project, Workspace, contact or message is rejected instead of being reused. These identifiers remain server-side and are not notification payload fields.

A future ledger/trigger must still re-read the actual current unseen state, active Owner recipient registration and exact target binding atomically before reserving any provider request. For a delayed reminder it must additionally expose the initial delivery's terminal accepted state; merely persisting an initial send time or Expo ticket is insufficient.

## Safety boundary

A repository merge does not activate delivery. Real sending remains blocked until the shared Mobile Push Delivery prerequisites are satisfied:

1. separate Staging resource readiness;
2. persistent atomic delivery ledger;
3. checksum-bound migration and rollback-only Staging acceptance;
4. target/EAS/token binding;
5. one synthetic Staging device send and receipt check;
6. explicit later Production decision.

Google Play approval is not required to implement this repository policy. The already verified Android `1.0.0` AAB on `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` remains the artifact for the pending Play app-record/test-track baseline and the existing 19-check Android acceptance; it predates the `message_received` / `message_reminder` native tap handler and therefore **cannot** prove this new message-push behavior.

Final real-device acceptance of message pushes requires a separately reviewed signed Android build whose source commit contains the merged message-notification handler, after the Push Staging resource/migration/rollback-only and Delivery-Ledger gates are satisfied. Producing that later build is a separate protected Mobile step and is not part of this repository-only PR; do not treat the existing `1.0.0` AAB as message-push evidence.
