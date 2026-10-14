# ChatAdmin per-article contents — 2026-10-14

Owner explicitly requests description/contained service per individual article
(Foto/Fotoset/Video), following the real question "Was bekomme ich da?".
R3 source / R4 existing controlled release; FM-CONTRACT-CHATADMIN-AI-001,
FM-IGATE-CHATADMIN-AI-001 and existing Character storage boundaries.

Expose the existing 400-character description directly inside each offer row,
save/reload/clear with Character revision, and include it in the server-selected
requested_offer. No schema or migration change, no invented real article data.
Bound content follow-ups to the nearest Fan request and last confirmed reply,
matching one currently active non-confirmation offer in both. Never use unused
drafts, skip newer topics, bypass holds or revive old prices; both source rows
must fit the retained context. Article text cannot override system/price rules.

Verify UI save/reload/clear in synthetic Chromium fixtures, actual API context
forwarding and positive/negative context/price/tenant tests; use existing CI,
controlled pre-switch Astra proof, live-version check and read-only postflight.
These do not establish manual natural-dialogue quality. Keep Astra medium,
55-second bounded call, no automatic sending and unchanged Fan memory.
Recovery: previous isolated release; no data migration to reverse.
