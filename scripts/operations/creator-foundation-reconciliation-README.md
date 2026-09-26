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
catalogs private. They contain schema/role metadata, not credentials or CRM rows.

The export covers the four Creator tables, their full policies, columns, keys,
indexes, triggers and direct/effective ACLs, the controlled parent extensions,
parent privacy prerequisites, exact Creator function overloads and metadata,
and the complete connected role/member authority graph, including every edge's
grantor identity and attributes. Array order
within signatures, composite keys and indexes is significant. Export row order
and JSON object-key order are not.

The executable PG17 test constructs separate disposable databases from the
pinned historical Foundation plus PT409 correction and from the current
Foundation plus correction. The reference builder accepts complete exports:

```sh
node scripts/operations/creator-foundation-reconciliation-preflight.mjs \
  --build-reference --legacy legacy-pg17.json --current current-pg17.json \
  --role-profile reviewed-role-profile.json
```

A role profile has `roles`, `memberships` and `provenance` arrays. Each membership
retains its role, member, grantor and all three membership options. Each needs an
exact `provenance` entry with the complete `membership` object and a `source` URL
bound to a full commit in `supabase/postgres` or `supabase/realtime`. Known provider
names never skip comparison. A role profile requires independent source review;
copying target observations does not establish that its grants are authorized.

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
