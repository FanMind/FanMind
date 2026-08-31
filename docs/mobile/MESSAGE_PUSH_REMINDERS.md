# Mobile message push reminders

## Current status

Repository policy and native tap handling are prepared for privacy-minimal reminders for unseen inbound messages. The contract is intentionally Staging-only and does not activate a provider route, timer, worker, Delivery-Ledger migration or Production delivery.

The existing Mobile UI already treats inbound `seen_at is null` messages as unseen and routes the user to the relevant fan. This contract reuses that product truth instead of introducing a second unread state.

## User experience

For a newly unseen inbound message:

- title: `FanMind`
- body: `Du hast eine neue Nachricht.`
- tap target: after authentication, the exact fan detail in section `Nachrichten`
- initial-candidate freshness: at most 60 minutes from the message timestamp

If the message remains unseen for 30 minutes after the initial delivery, at most one delayed reminder may be prepared:

- title: `FanMind`
- body: `Eine Nachricht wartet noch auf dich.`
- reminder freshness: no later than 60 minutes after its due time

A future timestamp, an already stale initial candidate or a stale delayed reminder fails closed. No further reminder loop is allowed for the same message under this policy.

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

The later delivery reservation must be recipient-specific. Its repository policy binds Workspace, message/contact, authenticated user, concrete push registration and EAS project into the internal dedupe identity. A delivery record from another user, registration, project, Workspace, contact or message is rejected instead of being reused. These identifiers remain server-side and are not notification payload fields.

A future ledger/trigger must still re-read the actual current unseen state, active recipient registration and exact target binding atomically before reserving any provider request.

## Safety boundary

A repository merge does not activate delivery. Real sending remains blocked until the shared Mobile Push Delivery prerequisites are satisfied:

1. separate Staging resource readiness;
2. persistent atomic delivery ledger;
3. checksum-bound migration and rollback-only Staging acceptance;
4. target/EAS/token binding;
5. one synthetic Staging device send and receipt check;
6. explicit later Production decision.

Google Play approval is not required to implement this repository policy, but final Android push/device acceptance must use the already verified `1.0.0` AAB installed from the Play test track. Do not create another Android build merely for this feature preparation.
