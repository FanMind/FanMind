# Restore schema ACL recovery finding — 2026-08-20

Task: `FM-RST-001`  
Risk: `R4`  
Branch: `restore-schema-acl-recovery-20260820`

## Current evidence

The real isolated database restore completed, but the receipt-bound authorization postcheck rejected the target. Subsequent read-only diagnostics established all of the following:

- canonical TLS `verify-full` connectivity passes on the actual Restore hostname;
- receipt-bound role/principal, database-container and extension preflight passes;
- full authorization capture executes successfully;
- receipt comparison fails with `authorization_target_contract_mismatch`;
- record count matches while the target has exactly eight fewer authorization grant tuples;
- archive TOC contains the same 198 ACL/DEFAULT ACL entries on source and restored target;
- rendered archive ACL SQL is an exact 567-statement multiset match;
- all delta-only pg_catalog/extension ACL classes match current read-only Production evidence;
- the remaining eight-tuple difference is entirely in schema ACLs;
- `graphql` is short four tuples and `graphql_public` is short four tuples;
- on each source schema, `pg_init_privs` binds six initial ACL tuples, while the bare restored target has only the two owner defaults;
- the missing source privileges are `USAGE` for `anon`, `authenticated`, `service_role`, and `postgres` with grant option, all granted by `supabase_admin`.

## Root cause

`pg_dump` correctly treats those `graphql` / `graphql_public` privileges as extension-initial/baseline privileges because the source has corresponding `pg_init_privs` records. A bare self-controlled PostgreSQL target does not carry that Supabase initial-privilege baseline. The archive therefore remains internally correct while normal `pg_restore` cannot reconstruct those eight effective schema grant tuples. The existing full authorization postcheck correctly detects the gap and prevents `DB_POSTCHECKED` acceptance.

## Repair contract

The code change must not weaken or bypass the final receipt fingerprint. Recovery is allowed only when:

1. role/container/extension preflight passes;
2. every authorization contract field other than the overall fingerprint/grant count already matches;
3. the exact grant-count delta is eight;
4. `graphql` and `graphql_public` both exist, are owned by `supabase_admin`, are not extension members and have exactly the owner-only ACL baseline;
5. only the four proven missing privileges per schema are granted as `supabase_admin`;
6. the unchanged full receipt-bound authorization contract matches afterwards;
7. any post-apply mismatch triggers an exact rollback to the proven owner-only state and rollback verification.

No Production or Supabase Staging mutation is part of this repair. The real Restore remains `RECONCILIATION_REQUIRED` / `PARTIAL` until the protected isolated workflow is rerun and the state machine reaches `DB_POSTCHECKED` with current evidence.
