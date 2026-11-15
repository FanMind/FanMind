# ChatAdmin custom offers — 2026-10-14

Owner requests free offer names, own prices, plus/add and rename in the Character
editor. R3 source: FM-CONTRACT-CHATADMIN-AI-001 / FM-IGATE-CHATADMIN-AI-001 and
FM-IGATE-CHATADMIN-STORAGE-001. Existing bounded Character JSON contract is reused.
No schema, credentials, provider/model, permissions, billing or automatic send change.

Draft supports at most twenty saved rows, stable IDs, explicit deletion, recommended
price with optional min/max, supported currency and retained flags/metadata. Rename
of a standard offer removes its legacy category alias. Literal name matching and
ambiguity refusal retain the server-side exact-price guard. Synthetic tests cover
custom names, regex characters, multiple/duplicate offers, private/public mismatch,
create/rename/reload/remove, disabled storage and maximum count. Browser API fixtures
are not actual storage or model acceptance.

Recovery is normal source revert; the previous canonical JSON validator already
accepts custom offers. Removing offers requires saving; cancellation preserves data.
Local and required CI evidence must pass before merge. Production acceptance remains
separate: owner-supplied real prices and manual dialogue quality; no invented prices
or synthetic live fan writes. Governance BLOCK baseline is not rewritten as ALLOW.
