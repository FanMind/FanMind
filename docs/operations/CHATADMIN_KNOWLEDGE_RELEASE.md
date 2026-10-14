# ChatAdmin knowledge / sales source integration — 2026-10-14

Task: FM-CHATADMIN-KNOWLEDGE-20261014. Risk: R3 source.
Affected boundary: FM-CONTRACT-CHATADMIN-AI-001 / FM-IGATE-CHATADMIN-AI-001.
Owner requested integration and immediate controlled publication.

This source-only PR connects the existing Character/Fan context to manual customer
tier, relationship stage, evidenced commercial events and canonical sales strategy.
An existing Fan notes envelope preserves manual notes and up to eight explicit
bounded non-sensitive preferences with source generation and sequence. No new table,
schema migration, provider call, automatic outbound send or automatic price/Character
change is introduced. Existing export/deletion covers the same Fan notes row.

Automatic extraction is finite whole-statement DE/EN matching, not unrestricted
Extended Learning: short/long reply and emoji preferences, selected ordinary
interests and sales/question/emoji boundaries. Free personal narratives and
sensitive attributes are not inferred. Manual notes remain available.
Sales hold, recent sourced purchase aftercare, actual offer cooldown and explicit
sales refusal suppress selling. Copying is not a purchase or actual-send proof.

Durable generation precedes CAS memory save. Same-generation retries can repair
partial storage without another provider call; old replay cannot replace newer
communication facts. Independent sales boundaries survive retention/emoji edits.
Known authority loss prevents reply disclosure.

Local build, targeted negatives and full Operations command passed on the complete
local draft. Independent R3 review drove fixes for sensitive quotes, boundary
eviction/overflow, chronology, editor validation, authority and interrupted saving.
GitHub CI on this source-only commit remains required.

The separate local Production-workflow unsealing package was denied twice by the
GitHub App; the calls returned only "user rejected MCP tool call". A branch create
succeeded. This PR deliberately contains no deployment workflow, host/root
controller, permission, branch protection, SQL or Production operation change.
Owner authorization exists, but no deployment or runtime acceptance is claimed.
Production was last observed at 707d22702a784e3b9999d1c9ae9c1e11c096a1bc.
Release work remains blocked until an accepted publication/execution path exists.

Recovery: normal source revert; stored Fan notes remain backward-compatible text.
No data deletion or schema reversal is part of recovery.
