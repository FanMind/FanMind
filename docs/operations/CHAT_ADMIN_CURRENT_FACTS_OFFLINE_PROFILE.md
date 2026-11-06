# Current-Facts PostgreSQL 17 offline extension profile

Status: OFFLINE_PROFILE_READY after the native and independent checks recorded in
`project-memory/receipts/chatadmin-current-facts-20261018.md`. This is an offline
source result; live installation and activation remain BLOCKED.

## Exact binding

- Controlled SQL, unchanged: `supabase/controlled/chat_admin_current_facts.sql`.
  SHA256 `a980ccc6268e4515f71d2be2ce486d6fd3f7a38745d819b8cd83245505701947`.
- Read-only catalog query: `scripts/operations/chat-admin-current-facts-catalog.sql`.
  SHA256 `7db4480ceb0af094bc91ae8d910782321961b191293d767d6a9a565fa6792f0c`.
- Fixed synthetic reference: `docs/operations/chat-admin-current-facts-profile-reference.json`.
  SHA256 `86a00c2039c841dbde3cd8d28f64a8bec1d8c889621b6e04e9ba6c2e234ed5ab`.
- Verifier: `scripts/operations/chat-admin-current-facts-profile.mjs`.
  It validates all source/query/reference checksums before comparing the entire
  logical catalog. It has no connection, executor, apply, flag or reference-learning
  path. An externally supplied expected catalog cannot authorize a different state.
- The fixed baseline has 328 records; the extended state has 413. PostgreSQL major
  must be 17. Native execution uses `postgres:17.11-trixie` pinned to image digest
  `sha256:e38411452a464af89e5adadb8d223bf53b898d47d6ef918b2d58c08707350449`.

## Admission boundary

All four canonical Base/Fan/Offers/Tier SQL files and original verifier modules,
composed Base postflight, synthetic prerequisite fixture and existing database
backup authorization contract are checksum-pinned and remain byte-identical.
No broad allowlist, skipped assertion or altered legacy postflight is introduced.
The complete original read-only exports execute before the extension. After full
restore they execute again in a separate disposable inverse copy: only the exact
extension objects are removed there using RESTRICT. This is a synthetic regression
proof, not an uninstall instruction for a real database. The actual restored
extended database is checked independently and remains intact.

The new profile checks the exact five parent relations, current-facts relation,
visible columns, types/defaults/nullability, constraints and validation/deferral,
indexes, triggers and enabled state, sequence definition, RLS and policies,
function identity/result/language/owner/full-definition hash/ACL, private schema
contents and dependent views/rules/objects. It also checks table/column/schema
ACLs including grant options, schema ownership, effective schema USAGE/CREATE,
database owner/encoding/provider/locale/ICU rules/collation version, relevant default privileges, transitive role
membership in both directions and role/database defaults. Extra scoped objects
or changes fail comparison. Function bodies, SECURITY DEFINER, volatility and
search_path are covered by the full pg_get_functiondef hash. The private six
functions and public invoker wrapper are checked explicitly in the fixed catalog.

Scope is the closed ChatAdmin relation/routine dependency graph plus the entire
private namespace. Neutral-name dependent views/materialized views are included.
This is not a whole-database scanner, a universal dynamic-SQL analyzer or a hosted
provider role acceptance check. Owner postgres and the three synthetic provider
roles are fixed prerequisites, not inferred Supabase host approval. Unknown target
roles, ownership or defaults require a separate reviewed binding; never regenerate
this reference from the target being checked. The existing backup authorization
contract is not changed or declared compatible with a real installed worker.

Physical OIDs, generated internal FK trigger names and dropped-column storage
positions are not logical identities. One named quote CHECK has exactly two
accepted PG17 renderings: the original BETWEEN/AND form and the observed flattened
AND form emitted after dump/reparse. There is no general expression normalization;
a 239-character limit or OR in place of AND fails native negative tests.

## Reproduce offline

From the repository root, with the pinned image already available locally:

```sh
FANMIND_CREATOR_PG17_REQUIRED=true node --test tests/chat-admin-current-facts-profile.cases.mjs
```

This explicitly enables the native test; a run without this environment variable
skips it and is insufficient evidence. The cases are also statically imported by
the existing required `tests/chat-admin-structured-offers-pg17.test.mjs` suite.
No package, workflow or legacy suite registration was changed.

The native test creates two fresh containers with `--pull=never --network none`,
no published ports or host bind mounts, and disposable PGDATA volumes. Its
initialization exactly matches the existing PG17 architecture fixture:
`--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8`.
Provider i, locale en-US, ICU collation version 153.128 and null custom rules are
fixed reference facts. ICU-locale, rules and collation-version tampering each fail
a native rollback-only negative test. Source and
target are distinct containers. It creates only synthetic data: a fan with exactly
4000 manual note characters, positive then negative music statements, persisted
source generations, drafts, revision/authority markers and an independent fan.
It executes full `pg_dump --format=custom` and `pg_restore --exit-on-error
--single-transaction` without schema, owner, ACL or data filters. The identical
archive bytes restore into an empty target and an independent parent-check copy.
Cluster roles are explicit synthetic prerequisites: pg_dump does not archive
cluster globals. All test containers and anonymous volumes are removed in finally.

The test compares every restored row in all synthetic relations and the sequence
state, then the entire catalog. After restore it verifies private/public ACLs,
foreign-owner and cross-fan denial, denied direct writes, protected source and
marker updates, late/replayed generation rejection, later explicit replacement,
4000 unchanged notes, Fan/Character/Workspace cascade and independent-fan survival.
All 40 native mutations must execute successfully and then be rejected by the
verifier; a syntax error cannot count as a successful rejection. Parent failure
counts prevent a PASS diagnostic after any failed child test. Mutation and cascade
probes roll back before checking that the restored data/catalog remain unchanged.

## Still blocked outside this offline task

No Staging/Production connection or target SQL apply occurred in this continuation.
There was no real capability/flag write, merge, deploy, workflow dispatch or real
fan-data processing. Synthetic fixture capability rows are confined to disposable
local databases.

A later installation still needs independently checked current deployed release,
host configuration and sustained preview/autogrant/capability exclusion; applicable
Harness/Live-Repair lock coordination; exact hosted role/owner/default compatibility;
installation and backup-worker private-function contract integration; actual fresh
backup artifact/provenance/retention evidence and a real isolated recovery drill
for that artifact. This synthetic archive proves none of those host/backup facts.
Installation and activation require their own protected authorization and exact
commit/target preflight. Global release BLOCK and FM-DEC-031 remain unchanged.
