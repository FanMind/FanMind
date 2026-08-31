# Mobile message push reminders

## Current status

Repository policy is prepared for privacy-minimal reminders for unseen inbound messages. It is intentionally Staging-only and does not activate a provider route, timer, worker or Production delivery.

The existing Mobile UI already treats inbound `seen_at is null` messages as unseen and routes the user to the relevant fan. This contract reuses that product truth instead of introducing a second unread state.

## User experience

For a newly unseen inbound message:

- title: `FanMind`
- body: `Du hast eine neue Nachricht.`
- tap target: authenticated fan detail, section `Nachrichten`

If the message remains unseen for 30 minutes, at most one delayed reminder may be prepared:

- title: `FanMind`
- body: `Eine Nachricht wartet noch auf dich.`

No further reminder loop is allowed for the same message under this policy.

## Privacy

Visible/provider payloads must never contain:

- message text;
- contact/fan name or handle;
- workspace name or ID;
- notes, tags, summary or AI output.

The navigation payload contains only the minimum contact identifier plus a fixed section discriminator. Workspace/message identity remains server-side for authorization and idempotency.

## Aggregation and anti-spam

When multiple unseen inbound messages exist for one fan, the server-side candidate policy collapses them to one newest candidate per Workspace/contact pair and carries only a numeric unseen count internally. A future ledger/trigger must re-read the actual current unseen state before reserving any provider request.

## Safety boundary

A repository merge does not activate delivery. Real sending remains blocked until the shared Mobile Push Delivery prerequisites are satisfied:

1. separate Staging resource readiness;
2. persistent atomic delivery ledger;
3. checksum-bound migration and rollback-only Staging acceptance;
4. target/EAS/token binding;
5. one synthetic Staging device send and receipt check;
6. explicit later Production decision.

Google Play approval is not required to implement this repository policy, but final Android push/device acceptance must use the already verified `1.0.0` AAB installed from the Play test track. Do not create another Android build merely for this feature preparation.
