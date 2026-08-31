# Push message feature status

FM-MOB-005 prepares message reminder semantics while Google Play account review is pending.

- Repository policy: in progress on PR #1050.
- Real push provider delivery: not activated.
- Production push delivery: not authorized/activated.
- Delivery ledger migration: not applied.
- Play baseline artifact: reuse the existing verified Android `1.0.0` AAB for the pending Play app record/test track and the already-defined baseline Android acceptance; no replacement AAB is produced by this repository-only work.
- Message-push artifact boundary: the existing `1.0.0` AAB predates the new `message_received` / `message_reminder` native tap handler and cannot validate this feature.
- Final message-push device acceptance: only after the Push Staging and Delivery-Ledger gates, using a separately reviewed signed Android build bound to a commit that contains the merged message-notification handler.
