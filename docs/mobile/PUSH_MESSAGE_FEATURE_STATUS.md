# Push message feature status

FM-MOB-005 prepares message reminder semantics while Google Play account review is pending.

- Repository policy: in progress on PR #1050.
- Eligible recipient for prepared message notifications: Workspace Owner only; Member registration remains available for other approved Push paths, but members are excluded from `message_received` / `message_reminder` until a separate per-recipient acknowledgement contract exists.
- Seen-state behavior: inbound messages are marked seen only while the exact fan's `Nachrichten` section is displayed; opening `Follow-ups` or `Kontaktwissen` does not clear eligibility.
- Android channel: message notifications use the dedicated `message-alerts` / `Nachrichten` channel rather than the Follow-up reminder channel.
- Persisted timestamp validation: bounded PostgreSQL timestamp parsing is reused; impossible or malformed timestamps fail closed.
- Real push provider delivery: not activated.
- Production push delivery: not authorized/activated.
- Delivery ledger migration: not applied.
- Play baseline artifact: reuse the existing verified Android `1.0.0` AAB for the pending Play app record/test track and the already-defined baseline Android acceptance; no replacement AAB is produced by this repository-only work.
- Message-push artifact boundary: the existing `1.0.0` AAB predates the new `message_received` / `message_reminder` native tap handler and cannot validate this feature.
- Final message-push device acceptance: only after the Push Staging and Delivery-Ledger gates, using a separately reviewed signed Android build bound to a commit that contains the merged message-notification handler.
