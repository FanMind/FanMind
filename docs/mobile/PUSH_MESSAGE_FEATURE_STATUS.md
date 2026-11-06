# Push message feature status

FM-MOB-005 is accepted for its bounded repository-only message reminder/data-boundary scope after PR #1050 merged.

- Repository policy: ACCEPTED through PR #1050 final head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`, squash merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; issue #1049 is closed `completed` only for this repository scope.
- Eligible recipient for prepared message notifications: Workspace Owner only; Member registration remains available for other approved Push paths, but members are excluded from `message_received` / `message_reminder` until a separate per-recipient acknowledgement contract exists.
- Seen-state behavior: inbound messages are marked seen only while the exact fan's `Nachrichten` section is displayed; opening `Follow-ups` or `Kontaktwissen` does not clear eligibility.
- Android channel: message notifications use the dedicated `message-alerts` / `Nachrichten` channel rather than the Follow-up reminder channel.
- Persisted timestamp validation: bounded PostgreSQL timestamp parsing and microsecond-precise ordering/causality checks are used; impossible, malformed or inconsistent timestamps fail closed.
- Real push provider delivery: not activated.
- Production push delivery: not authorized/activated.
- Follow-up delivery ledger: applied and rollback-only accepted on isolated Staging at `18a6ad79` via `33867831888` / `33867922978`. This does not accept the additional message-specific unseen/recipient reservation or activate delivery.
- Registration Staging migration/rollback-only acceptance: historical success on `084e19c8` via `33800376282` / `33800742158`; reuse those foundations. Fresh registration and provider/device evidence remain open under their protected gates.
- Play baseline artifact: reuse the existing verified Android `1.0.0` AAB for the pending Play app record/test track and the already-defined baseline Android acceptance; FM-MOB-005 produced no replacement AAB.
- Message-push artifact boundary: the existing `1.0.0` AAB predates the new `message_received` / `message_reminder` native tap handler and cannot validate this feature.
- Device candidate: the signed FCM replacement Preview already exists at `6801d687` via `34037085683` and contains the native handler. Reuse it for current opt-in/registration evidence. Message-specific server integration, real delivery acceptance and the later signed publication of #1089 Mobile dependency updates remain open; the old candidate cannot prove those newer patches.
- Broader Mobile status: FM-MOB-001 remains `IMPLEMENTED_NOT_VERIFIED`; real provider/device/Store acceptance stays open.
