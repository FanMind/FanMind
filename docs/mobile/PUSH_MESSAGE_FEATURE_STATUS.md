# Push message feature status

FM-MOB-005 is accepted for its bounded repository-only message reminder/data-boundary scope after PR #1050 merged.

- Repository policy: ACCEPTED through PR #1050 final head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`, squash merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; issue #1049 is closed `completed` only for this repository scope.
- Eligible recipient for prepared message notifications: Workspace Owner only; Member registration remains available for other approved Push paths, but members are excluded from `message_received` / `message_reminder` until a separate per-recipient acknowledgement contract exists.
- Seen-state behavior: inbound messages are marked seen only while the exact fan's `Nachrichten` section is displayed; opening `Follow-ups` or `Kontaktwissen` does not clear eligibility.
- Android channel: message notifications use the dedicated `message-alerts` / `Nachrichten` channel rather than the Follow-up reminder channel.
- Persisted timestamp validation: bounded PostgreSQL timestamp parsing and microsecond-precise ordering/causality checks are used; impossible, malformed or inconsistent timestamps fail closed.
- Real push provider delivery: not activated.
- Production push delivery: not authorized/activated.
- Delivery ledger migration: not applied.
- Push Staging migration/rollback-only acceptance: remains a separate protected gate.
- Play baseline artifact: reuse the existing verified Android `1.0.0` AAB for the pending Play app record/test track and the already-defined baseline Android acceptance; FM-MOB-005 produced no replacement AAB.
- Message-push artifact boundary: the existing `1.0.0` AAB predates the new `message_received` / `message_reminder` native tap handler and cannot validate this feature.
- Final message-push device acceptance: only after the Push Staging and Delivery-Ledger gates, using a separately reviewed signed Android build bound to a commit that contains the merged message-notification handler.
- Broader Mobile status: FM-MOB-001 remains `IMPLEMENTED_NOT_VERIFIED`; real provider/device/Store acceptance stays open.
