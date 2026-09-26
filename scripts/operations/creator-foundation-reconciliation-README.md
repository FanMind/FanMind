# Creator Foundation reconciliation preflight

This source-only tool exports a fixed PostgreSQL 17 catalog query and compares
catalog files offline. It contains no database connection, workflow dispatch,
environment activation or apply mode. It does not change the historical
Foundation Apply/PT409 authorization or the confirmed-chat runner.

The historical SQL files are byte-for-byte copies from accepted commit
`f0c7a84e6105752d34b489520fb92d2bb7e5b61a`. Both their SHA256 and Git blob IDs,
and those of the current controlled artifacts, are pinned in the preflight.

```sh
node scripts/operations/creator-foundation-reconciliation-preflight.mjs --check
node scripts/operations/creator-foundation-reconciliation-preflight.mjs --sql
```

`--sql` prints one fixed catalog SELECT inside a repeatable-read, read-only
transaction. It creates no reference objects or temporary functions and reads
no application rows. Executing it on a target remains a separate protected,
target-bound observation; this CLI deliberately cannot do that. Keep exported
catalogs private. The query reads no CRM rows, but raw role configuration can
contain sensitive values. Never print or publish a raw target snapshot.

The export covers the four Creator tables, their full policies, columns, keys,
indexes, triggers and direct/effective ACLs, the controlled parent extensions,
parent privacy prerequisites, exact Creator function overloads and metadata,
complete `auth.uid()` overloads, `public`/`auth` namespace owners and direct/effective
CREATE/USAGE rights,
and the complete connected role/member authority graph, including every edge's
grantor identity and attributes. Array order
within signatures, composite keys and indexes is significant. Export row order
and JSON object-key order are not.

Parent authorization is compared separately for `workspaces`, `workspace_members`,
`contacts`, `conversations`, `contact_ai_profiles`, and the real trigger dependency
`workspace_analysis_settings`: full table owner/RLS flags,
ACLs, inheritance and rewrite rules; every policy's command, permissiveness,
roles, USING and WITH CHECK; every column's complete metadata, defaults and
direct/effective column privileges; full triggers, constraints and indexes;
and the full workspace-helper metadata/ACLs. Parent columns have their own
`parentColumns` section, including server-owned Workspace and membership columns,
in addition to the existing Creator extension-column scope.
An additional permissive policy is a difference, even if all named canonical
policies still exist.

The supported parent profile is
`canonical_daily_without_optional_billing_baseline_aug16_v1`. It pins and
replays the complete table DDL from the MVP baseline, the controlled Daily
workspace CHECK expansion, the relevant June–August migrations, and the
controlled server-owned-column and member-boundary layers. The optional Billing
preparation baseline is deliberately absent. Native CI has 144
parent/dependency columns after either Creator variant, 22 policies, seven original
helper definitions and five original user triggers. These are full source tables,
not shortened fixtures. Native CI executes the actual workspace INSERT trigger
and UPDATE timestamp trigger and checks the real analysis-settings dependency. Original timestamps, defaults,
constraints, indexes and ACLs are retained. The parent module pins the upstream
Supabase initializer's exact bytes and reproduces its postgres-owned public
TABLE/FUNCTION default privileges before creating product objects; subsequent
pinned source revokes and column grants are then applied unchanged.

This is an explicit supported source replay, not evidence that Staging installed
every controlled product module. Optional Billing preparation,
account-deletion and Admin-CRM variants are not inferred. Additional parent
columns, policies, user triggers, constraints, indexes, privileges or unknown
helpers prevent an exact result. Target definitions never supply expected values.
The chosen profile identity and source pins are required in every reference and
export manifest, together with the exact generated reference SQL hash.

Only incoming internal foreign-key action triggers whose owning constraint is
on a table outside these six relations and the four Creator relations are outside
the parent projection. Those belong to unrelated installed features. Every user
trigger and every outgoing scoped FK remains included. Native CI adds an unrelated
feature table with incoming workspace/contact FKs and proves that the scoped
catalog is unchanged. This classifier does not approve those external feature
constraints or their lifecycle; a full database acceptance remains separate.

Catalog-recorded function dependencies of policies, triggers, constraints,
expression indexes, defaults/generated expressions and rewrite rules are exported,
including unknown helpers. PostgreSQL does not record every dependency inside SQL/PLpgSQL string
bodies: the supported source-reviewed closure explicitly includes both workspace
authority helpers, all five original timestamp/analysis-settings trigger helpers,
the complete analysis-settings table dependency, and the separately pinned
`auth.uid()` contract. No completeness claim
is inferred from `pg_depend` alone. An unreviewed helper such as a target-only
`is_workspace_member` or `is_workspace_admin` yields
`parent_helper_contract_unreviewed` / INCOMPLETE. New parent authorization
variants require separate source evidence. Native negative tests alter the real
profile SELECT policy to USING(true), add a permissive policy, change policy
roles/WITH CHECK, and change authority helper body, owner, config, ACL or security.
Further native negatives grant UPDATE on `workspaces.billing_status` and
`workspace_members.user_id`, revoke membership SELECT, alter parent trigger
state, and add a constraint/index. Unreviewed trigger, expression-index,
constraint or default helpers remain INCOMPLETE. Actual additional parent
columns or privileges are compared; they are never copied into the reference
or normalized away to obtain an exact result. A non-null trigger `when` field
contains PostgreSQL's complete canonical trigger definition, which preserves the
OLD/NEW context that `pg_get_expr` cannot deparse. Only an internal autogenerated
trigger name's exact header token is stabilized; conditions and other names
remain unchanged. Native cases cover both NEW-only and OLD/NEW conditions.

The executable PG17 test constructs separate disposable databases from the
pinned historical Foundation plus PT409 correction and from the current
Foundation plus correction. After all native positive/negative checks and
fixture cleanup succeed, the existing CI job exports `legacy.json`,
`current.json` and `manifest.json`. The seven-day artifact is named
`fanmind-creator-foundation-reference-<GITHUB_SHA>`. Its manifest binds the
actual tested checkout, run/attempt, PostgreSQL version, query hash, all source
pins, provider source pins/contract hash, parent profile/source pins/reference SQL hash
and both file hashes. Check the successful exact-SHA job and artifact
identity before consuming it. The files contain only the isolated CI catalogs;
their role and provider data is explicitly **not an approved Staging profile**.
For pull requests, `githubSha` is the tested checkout/merge-ref SHA and
`reviewedSourceSha` is the PR head; these values need not be equal. Bind both
identities and the query/source pins to the reviewed final head when downloading.

Export is opt-in only in this existing CI job. It uses an exclusively created,
mode-0700 directory beneath the validated owned runner temporary directory and
mode-0600, create-only files. Symlinks, writable-by-others roots, dirty controlled
source files and checkout/SHA mismatches fail. Upload runs only after the whole
native test step succeeds; a test or cleanup failure cannot publish references.

Use the two downloaded native catalogs plus the separately reviewed target
role profile as inputs. The reference builder accepts complete exports:

```sh
node scripts/operations/creator-foundation-reconciliation-preflight.mjs \
  --build-reference --legacy legacy-pg17.json --current current-pg17.json \
  --role-profile reviewed-role-profile.json
```

A role profile has `roles`, `memberships` and `provenance` arrays, plus a
`providerContract` object. This source profile is fixed to 21 complete role rows
and 22 complete membership edges. Each membership
retains its role, member, grantor and all three membership options. Each needs an
exact `provenance` entry with the complete `membership` object and a `source` URL
bound to a full commit in `supabase/postgres` or `supabase/realtime`. Known provider
names never skip comparison. A role profile requires independent source review;
copying target observations does not establish that its grants are authorized.
The builder and classifier require exact equality with
`creatorFoundationHostedPg17RoleProfile()`; a caller cannot authorize a partial
or altered profile merely by supplying matching provenance fields.

Only the complete `supabase_upstream_source_pg17_v1` provider contract exported
by `creatorFoundationUpstreamProviderContract()` in the provider module is
supported. It is a reproducible source profile, **not a Hosted-default claim**.
The independently reviewed bundle must include its exact source pins and values.
Missing or altered provider contracts yield `auth_uid_provider_contract_missing`;
a different observed schema owner, ACL or function contract yields DRIFT. New
Hosted/provider variants need separate source review; no target value is silently
copied into the expected profile.

The pinned original Supabase Auth statement reads the JWT subject. Every
function body uses native PostgreSQL SHA256 over its exact UTF-8 `prosrc`, with
no extension dependency. Owner, all function metadata, configuration and direct
and effective ACLs remain exact comparison fields. The NULL-returning CI stub
is removed and cannot serve as a reference. The native test creates the pinned
function under its original `postgres` owner, asserts that owner before any
transition, transfers ownership to `supabase_auth_admin`, and only then
materializes the explicit routine grants to `postgres`/`dashboard_user` under
that new owner. This preserves the former owner's privilege as an explicit ACL
entry instead of relying on an owner-implicit privilege that disappears at the
transfer.
This reproduces the reviewed grants and grantors; it does not infer a Hosted
installation history. The owner migration can warn on failure, so observations
still must match the successful source profile exactly.

The namespace source matrix pins explicit roles and owners. Its `pg_roles` join
omits PUBLIC: the required native PG17 test separately checks creation defaults
(PUBLIC USAGE on `public`, no PUBLIC privilege on `auth`, and PUBLIC EXECUTE for
new functions). The source reproduction and exact native comparison cover those
otherwise omitted ACLs. The current database owner must be `postgres` and is
also a role-graph seed: PostgreSQL grants it implicit `pg_database_owner`
membership outside `pg_auth_members`. Database names are never compared. Native negative cases change namespace owner/CREATE/
USAGE and auth.uid body/owner/security/config/ACL, and must all fail comparison.
Both isolated Creator reference exports must match this full provider contract
before the builder can emit a reference.

Role traversal follows actual membership edges in both directions. It does not
turn every grant issued by the seeded `postgres` role into an incoming privilege
path. PostgreSQL 17 requires each non-bootstrap grantor to retain ADMIN OPTION
membership in the granted role; that membership already joins it to this graph.
Superuser grants are recorded under the bootstrap superuser, already a seed.
See [PostgreSQL 17 GRANT](https://www.postgresql.org/docs/17/sql-grant.html),
the `GRANTED BY` rules for role membership. Unrelated built-in `pg_monitor`
memberships therefore need no fabricated Supabase provenance. An actual new
membership into `postgres`, a provider service role or a non-bootstrap grantor
is still traversed and fails comparison unless independently reviewed.

The resulting reference file must be reviewed and its SHA256 recorded outside
that file in the execution evidence. A self-declared hash inside the reference
is not trusted. Do not derive the expected reference from the target under test.
The query SHA, source pins, variant function-body hashes, coverage and role
provenance are checked again during classification:

```sh
node scripts/operations/creator-foundation-reconciliation-preflight.mjs \
  --classify --snapshot target-catalog.json --reference reviewed-reference.json \
  --reference-sha256 INDEPENDENTLY_RECORDED_SHA256
```

- `LEGACY_EXACT` / `CURRENT_EXACT`: every supported catalog value matches the
  independently pinned historical/current reference. Exit 0.
- `DRIFT`: a complete catalog differs, including unknown role paths, grantors,
  policy expressions, function bodies, ACLs or positional argument/key changes.
  Exit 2.
- `INCOMPLETE`: coverage, query/source binding, reference trust or role provenance
  is missing. Exit 2. Optional Admin-CRM installation is explicitly unsupported
  until a separate reference variant covers its dynamic helper and restrictive
  policies. Both install orders produce `admin_crm_variant_unreviewed`.

Every result keeps `targetAccepted=false`, `applyAllowed=false`,
`learningState=UNDETERMINED` and `runtimeActivated=false`. Exact catalog equality
is not a fresh release/target binding, learning-schema absence, staging acceptance
or permission to write. Local unit success does not establish PG17 semantics;
the separately registered required PG17 CI test must pass.
