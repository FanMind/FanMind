# Current 20/13 backup restore compatibility

Production currently has the reviewed 20 public SECURITY DEFINER functions,
including 13 restricted functions. Worker 7 already captures the complete
signature, owner, configuration, ACL, definition and role/container/extension
fingerprints. The former Full Receipt, aggregate evidence and shell postcheck
consumers still rejected every restricted count except 12.

The compatibility change accepts exactly integer 12 or 13 in those consumers.
It does not approve an arbitrary catalog with either count. The unchanged
`database-authorization-contract.mjs` must first validate the exact legacy
13/12 or current 20/13 boundary and all seven reviewed additional functions.
The restored catalog must equal the receipt-bound source fingerprint, including
function definitions; counts alone are insufficient. Every private receipt
retains exact artifact, dump, commit, role, extension and prior-receipt hashes.
Mixed 12/13 receipts, unknown counts, extra members and drift still fail closed.

The CI proof retains the legacy restore and adds a fresh database in the
independent digest-pinned PostgreSQL 17 target container for the new current
backup. It verifies empty-target and role/extension/container preflights,
single-transaction restore and the complete current catalog fingerprint.
Changing a function body while preserving the function count must be rejected.
The receipt tests exercise both full chains and mixed/invalid counts. These
isolated CI checks are not a successful restore of a real Production backup.

Before an actual restore, require a newly successful Worker installation,
sequential fresh DB/Full backups and checksum/offsite evidence, a new empty
isolated target, current organization runner/workflow allowlist evidence,
private locally accessible age/passfile/CA resources and protected Environment
approval. Historical DB_POSTCHECKED run 33178878764/job 98874745740 is consumed
and must never be repeated. An interrupted or indeterminate new restore requires
receipt-bound reconciliation; do not clear its marker or retry blindly.

This PR applies no Production SQL, replaces no installed Worker, creates no
backup and provisions no restore target. Existing backups and legacy receipts
remain intact. Root access, real backup/restore evidence, the missing
sales_playbook Production schema and the separately protected release/rollback
path remain execution prerequisites. The sealed deployment stays sealed.

The controlled Worker preflight also now counts `claimed` alongside `queued`
and `running`, using one shared fixed read-only query. The real claim RPC sets
`claimed` before the Worker starts handling the job. Omitting it could overlook
an already claimed job during installation or post-stop checking. Bootstrap
must stage the corrected controller/policy hashes; never install the old guard
just because its earlier CI passed. The native CI proof verifies claimed=1 and
terminal succeeded=0 in the newly created disposable database, then removes
only that test-created table and rechecks the complete restored fingerprint.
