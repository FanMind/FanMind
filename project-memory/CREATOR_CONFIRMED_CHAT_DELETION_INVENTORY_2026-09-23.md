# Creator confirmed-chat learning — deletion verification inventory (2026-09-23)

This is a bounded evidence inventory for `FM-CREATOR-001` / `NBA-CREATOR-INTELLIGENCE`. It is **not** a second task queue and it does not authorize schema installation, data mutation, protected APPLY/ACCEPT, provider activation, billing work, restore writes, Mobile work or ChatAdmin APPLY.

Baseline inspected: `main` `7f75409896038dd83ef88d1fecd0b33fa961f772`, immediately after merged PR #1164. The controlled `creator_confirmed_chat_learning` schema remains repository-only and unapplied. The source-controlled disclosure state remains `preinstall`.

## Why this inventory exists

PR #1164 closed the complete-disclosure gap for the new personal-data family. The next safe repository step is to make deletion verification explicit before the controlled table can ever become an installed Production data family. Database cascades remain defense-in-depth; they are not sufficient deletion evidence by themselves.

The correct deletion semantics are deliberately different for Workspace/contact ownership data and for the human confirmer audit reference:

- rows owned by a deleted Workspace must be absent after account deletion;
- rows for a deleted contact must be absent after contact deletion;
- a surviving Workspace may retain legitimate confirmed learning evidence after its former owner deletes their account, but the deleted Auth user ID must not survive in `confirmed_by`;
- therefore a blanket delete of learning rows by `confirmed_by` would be incorrect and would destroy Workspace-owned evidence that is designed to survive only in anonymized form.

## Current source contracts inspected

### Controlled learning schema

`supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql` currently defines:

- `workspace_id`, `creator_id`, `contact_id` and `conversation_id` as the ownership/scope keys;
- `(workspace_id, creator_id)` -> `creators(... ) ON DELETE CASCADE`;
- `(workspace_id, contact_id, conversation_id)` -> `conversations(... ) ON DELETE CASCADE`;
- `confirmed_by uuid references auth.users(id) ON DELETE SET NULL` as audit metadata rather than ownership;
- durable confirmation facts (`confirmed_at`, immutable message binding and outcome IDs) independent of the confirmer account.

This means the schema already expresses the intended lifecycle, but runtime deletion verification must independently prove the resulting state.

### Account deletion processor

`scripts/operations/process-account-deletion.mjs` persists the exact owned-Workspace inventory before Auth deletion and then verifies active-system deletion. `WORKSPACE_DELETION_TABLES` currently checks the established Workspace data families but does **not** yet include `creator_confirmed_chat_learning`.

The account processor also verifies `profiles`, `workspace_members` and owned `workspaces` after Auth deletion. That is necessary but not sufficient for the new table because the learning family must be checked directly rather than inferred only from its foreign-key cascades.

Required installed-state verification contract:

1. for every Workspace ID in the durable `owned_workspace_ids` snapshot, query `creator_confirmed_chat_learning` by exact `workspace_id` with `limit=1`; any returned row is `deletion_verification_failed`;
2. independently query `creator_confirmed_chat_learning` for `confirmed_by = <deleted user id>` with `limit=1`; any returned row is `deletion_verification_failed` because `ON DELETE SET NULL` must have anonymized surviving Workspace evidence;
3. keep the existing fail-closed behavior for network, authorization and malformed-response failures;
4. do not delete learning rows directly from the verification step and do not treat the verifier as repair logic.

The second check is intentionally global by the deleted Auth ID, not limited to the deleted Workspaces: it verifies anonymization for evidence retained in Workspaces that survive an ownership transfer.

### Contact deletion action

`src/app/fans/[id]/contextActions.ts` authorizes the exact contact in the active Workspace and invokes `rpc/delete_contact_with_meta_catchup`, with a narrowly bounded legacy compatibility path when the reviewed RPC is not installed. Success currently proves the exact contact/Workspace delete result but does not independently query the new learning family afterwards.

Required installed-state verification contract after either successful delete path:

1. query `creator_confirmed_chat_learning` by exact `workspace_id` and exact `contact_id`, `select=proposal_id`, `limit=1`;
2. require an empty array; any remaining row, network error, authorization error or malformed response fails closed and the UI must report contact deletion failure rather than claiming complete deletion;
3. never query or mutate another Workspace and never broaden the check to Creator-wide data;
4. the verification query is evidence only; cascade ownership remains in the database contract.

The post-delete check cannot roll back a contact that was already deleted. Therefore the later installed rollout must treat a verification failure as an operational incident requiring reconciliation, not as proof that the deletion itself was undone. Before installation, this path must not claim that the new table was checked when the table does not exist.

## Rollout-state rule

`src/lib/dataDisclosureMetaExport.ts` currently carries the source-controlled state `CONFIRMED_CHAT_LEARNING_SCHEMA_STATE = "preinstall"`. Deletion verification must follow the same lifecycle boundary:

- **preinstall:** absence of `creator_confirmed_chat_learning` is expected and cannot be used as evidence that an installed data family was deleted;
- **installed:** the table is mandatory. Missing schema/cache state, HTTP errors, malformed responses or residual rows are failures; `unknown != success` and `missing evidence != success`.

A later bounded rollout change must switch the source-controlled state before protected schema APPLY, make disclosure and deletion verification mandatory together, pass exact-head CI/review, deploy the fail-closed readers/verifiers, and only then proceed to the separately gated migration APPLY. State synchronization must be regression-tested so disclosure cannot be `installed` while deletion verification still behaves as optional.

## Required regression evidence before installation

The implementation slice following this inventory must add focused tests proving at least:

- account deletion inventories `creator_confirmed_chat_learning` directly for every persisted owned Workspace;
- account deletion rejects any surviving `confirmed_by` reference to the deleted Auth user while allowing rows whose `confirmed_by` has become null;
- contact deletion verifies zero rows for the exact Workspace/contact after both atomic-RPC success and the allowed legacy-success path;
- foreign-Workspace rows cannot satisfy or bypass the verification;
- preinstall missing-schema compatibility is explicit and bounded;
- installed state fails closed on missing schema, network errors, authorization errors, malformed payloads and residual rows;
- no verification path performs a repair/delete mutation;
- the disclosure and deletion rollout-state expectations cannot diverge silently.

## Evidence/acceptance boundary

This inventory does not change runtime behavior and therefore does not constitute deletion acceptance or schema readiness by itself. It closes only the discovery/reconciliation step requested after #1164. The next repository implementation slice is the bounded deletion-verification integration above. Controlled migration runner/checksum, target-bound VERIFY/negative authorization evidence, protected APPLY/ACCEPT and real quality acceptance remain separate downstream gates.

Production backups are also outside this active-system verifier. Existing backup/retention policy and restore evidence remain their own finishline gates; active-system deletion must not be misreported as backup erasure.
