# Adminchat1425 — existing hosted media acceptance preparation

Owner explicitly requested a narrow review PR extending the existing authorized
Staging test workflow, using only existing runners/accounts and the existing
synthetic Model FM1425-20261114-1945-A. R3 source preparation; no target dispatch,
merge, deployment, flag/schema/guard apply or Production action authorized by
this source PR. Old manual-flow modes and parallel specialist work retained.

Contracts FM-CONTRACT-CHATADMIN-STORAGE-001 and
FM-CONTRACT-DISCLOSURE-DELETE-001; gates FM-IGATE-CHATADMIN-STORAGE-001 and
FM-IGATE-DISCLOSURE-DELETE-001. Main499ae5c preparation baseline; non-overlapping parallel Main changes through
e48eea970e5c0b541ebfe58e8aeb7ccd3dea8ae8 incorporated in the review commit. Shared Staging deploy lease
retained. Fixed Model UUID protected binding and actual synthetic-account mapping
remain prerequisites to prove before any write run. No invented fixture IDs or
new accounts. Existing Abendkleidung25EUR and real Models preserved.

Source tests, negative boundary and recovery tests are not target acceptance.
Actual E2E remains BLOCKED until review, exact live binding, preflight and the
separate precise synthetic lifecycle/cleanup acknowledgement. Hard runner-loss
recovery is fail-closed; no automatic cross-run artifact admission is prepared.
