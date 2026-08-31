# FM-MOB-005 exact next integration checks

Before merge:
1. Reconcile `message_received`/`message_reminder` payload and tap navigation with the existing Mobile notification-response handler.
2. Reuse the existing Mobile Push target/registration authorization contract; do not add a second token store or unread state.
3. Verify the focused tests are included by the repository Operations/FanMind CI scripts.
4. Update canonical Source of Truth/Push Delivery wording without claiming provider activation.
5. Run exact-head CI and independent diff/countercheck.
