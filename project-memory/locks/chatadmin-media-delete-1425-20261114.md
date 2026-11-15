# ChatAdmin #1425 bounded deletion continuation

Owner explicitly authorizes minimal existing deletion repair, one small
follow-up PR, required checks, regular merge and protected Staging rollout.
Work is isolated from the parallel Meta working tree on a dedicated worktree.
Affected contracts/gates: FM-CONTRACT-CHATADMIN-STORAGE-001,
FM-CONTRACT-DISCLOSURE-DELETE-001; FM-IGATE-CHATADMIN-STORAGE-001 and
FM-IGATE-DISCLOSURE-DELETE-001. Preserve tenant/Character authority, private
Storage, no automatic sends, controlled migration separation and evidence quorum.

Exact NoSuchKey diagnosis and source/target evidence boundaries are documented
in docs/operations/CHAT_ADMIN_MEDIA_DELETE_CONFIRMATION_20261114.md. No schema,
permissions, provider switch, Billing or Production mutation authorized here.
Recheck common Main, actual target and shared fanmind-staging-deploy lease before
merge/rollout. Do not replace newer parallel Staging source.
