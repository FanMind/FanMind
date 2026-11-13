# CHATADMIN-MEDIA-CATALOGUE-1425-20261113

Owner assignment: development/Staging catalogue continuation#1425, reuse#1427
and#1440; source changes authorized. No Production, no second DB, no automatic
media delivery, no provider image/video analysis activation. Phone app excluded.

R3 boundaries: FM-CONTRACT-CHATADMIN-AI-001 and
FM-CONTRACT-CHATADMIN-STORAGE-001; generation/context/UI/erasure/export consumers.
Affected integration gates: ChatAdmin AI context and private storage isolation.
Source implementation and isolated independent countercheck are separate;
no release authority inferred from local tests or ordinary CI.

Implementation uses one existing media table/bucket and Character playbook.
New controlled SQL is unapplied; default-off catalogue/video gates. Independent
read-only QA found false video/transaction claims, follow-up ambiguity, preview
cost and erasure inventory; regression fixes are included. Preview full-object
range reads remain a bounded limitation. NativePG17 and desktop CI/Staging remain
open; no target mutation has occurred. See docs/CHAT_ADMIN_MEDIA_CATALOGUE.md.

Main moved independently from798fa177 to0def924b via Support#1467; no overlapping
changed paths in that comparison. Preserve the new Main tree and deployed
Facebook Staging lineage. No merge/deploy dispatched. PR1440 remains separate.
