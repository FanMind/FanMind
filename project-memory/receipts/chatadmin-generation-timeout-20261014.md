# ChatAdmin generation timeout — 2026-10-14

Owner reports a failed real reply despite provider credit. Read-only Production
usage shows two Astra calls ending after 45,702/45,712 ms with no output usage;
the existing request deadline was 45 seconds. This is strong timeout evidence,
not a provider balance diagnosis. The previous greeting-only provider probe did
not exercise the full Fan conversation and did not establish real reply success.

R3 source / R4 controlled release, FM-CONTRACT-CHATADMIN-AI-001 and
FM-IGATE-CHATADMIN-AI-001. Keep owner-authorized strongest Astra model, use medium
reasoning for short ChatAdmin replies and a bounded 55-second provider deadline.
No automatic retry or model fallback. Distinguish timeout in usage and return a
readable retry message. Timeout cannot persist replies or learned Fan facts.

The one-request pre-switch provider probe now uses the real context builder,
fictitious identities and twenty synthetic confirmed/inbound history entries.
No real Fan/Character data reads or writes, schema changes, new credentials,
paid-tier activation or changed authorization/price/manual-send boundaries.
Local and CI checks precede controlled deployment. Provider proof and exact live
version must still pass; real dialogue quality remains manual acceptance.
Recovery uses the existing isolated-release rollback.
