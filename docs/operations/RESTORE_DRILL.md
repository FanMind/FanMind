# FanMind Backup Verification and Restore Drill

## Purpose

This runbook proves that encrypted FanMind backups can be read and validated without touching Production data. It separates three activities:

1. **checksum verification** on the Production host;
2. **content verification** on an isolated verification host with the age identity;
3. **restore drill** into an empty, disposable test environment.

The verifier is deliberately read-only. It never restores a database, uploads Storage objects, edits Production configuration or writes into the backup directory.

The drill has two separate isolation boundaries. The application and Storage
boundary is a distinct non-Production Supabase project. The database recovery
boundary is a different resource: an isolated, self-controlled bare PostgreSQL
17 cluster and empty disposable database. A hosted Supabase database is not a
supported restore target, even when it belongs to the confirmed non-Production
project.

## Hard safety rules

- Never pass a Production database target to a restore command.
- Never decrypt backups in `/var/backups/fanmind` or `/var/www/fanmind`.
- Never print the age identity, database password, Supabase service-role key or `.env.production` content.
- Use a disposable host or encrypted offline workstation for decryption.
- Use a separate test PostgreSQL database and separate test Storage bucket/project.
- Keep `FANMIND_ENABLE_REFERRAL_BILLING=false` and all write integrations disabled during a restore drill.
- Do not point a restored test application at `fanmind.ch` or Production webhooks.
- Before any write or restore, the shared environment boundary must pass with a distinct Staging/Test Supabase project.

### Mandatory environment boundary before restore writes

Load only the isolated target configuration and run:

```bash
npm run environment:preflight:write
```

Required gates:

```text
FANMIND_RUNTIME_ENVIRONMENT=staging or test
FANMIND_ENABLE_NON_PRODUCTION_WRITES=true
FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY
FANMIND_TARGET_SUPABASE_PROJECT_REF=<isolated target>
FANMIND_PRODUCTION_SUPABASE_PROJECT_REF=<comparison only>
```

The restore drill stops unless `ENVIRONMENT_BOUNDARY=OK`. This shared boundary
is the first gate for the non-Production application and Storage resources; it
does not authorize a database endpoint. Immediately before `pg_restore`, the
restore-specific target preflight below repeats it and additionally binds the
actual PostgreSQL host, port, database and bootstrap restore user to the
separate isolated database target.

## 1. Production checksum-only verification

Choose the encrypted artifact, not a plaintext dump:

```bash
sudo node /usr/local/lib/fanmind-ops/verify-backup-artifact.mjs \
  --artifact /var/backups/fanmind/fanmind-full-<timestamp>.tar.gz.age \
  --json
```

Expected properties:

```text
ok=true
mode=checksum_only
backupType=full
```

This verifies the adjacent `.age.sha256` file, its filename binding, the SHA-256 value and readability. It does not decrypt the artifact.

Failure conditions include:

- missing artifact or checksum file;
- malformed checksum line;
- checksum filename mismatch;
- calculated SHA-256 mismatch;
- unknown backup type.

## 2. Copy encrypted pair off-server

Always copy the pair together:

```text
<artifact>.age
<artifact>.age.sha256
```

Verify the checksum again after transfer. Do not copy the private age identity through GitHub, chat, email or unencrypted cloud storage.

## 3. Isolated content verification

On a disposable verification host with `age`, `tar` and PostgreSQL client tools installed:

```bash
node scripts/operations/verify-backup-artifact.mjs \
  --artifact /secure/input/fanmind-full-<timestamp>.tar.gz.age \
  --identity /secure/keys/fanmind-backup.agekey \
  --json
```

The tool:

- verifies the outer checksum pair;
- decrypts only into a private temporary directory;
- validates tar entries before extraction;
- rejects absolute paths and path traversal;
- validates `manifest.json`;
- requires exactly one database, Storage and server-config part in a full backup;
- validates every nested encrypted part and its checksum;
- validates the Production commit metadata;
- removes temporary plaintext automatically.

For a database restore drill, use a private operator-owned directory with no
group or world permissions and opt in to both new outputs in the same
verification:

```bash
node scripts/operations/verify-backup-artifact.mjs \
  --artifact /secure/input/fanmind-full-<13-digit-timestamp>.tar.gz.age \
  --identity /secure/keys/fanmind-backup.agekey \
  --restore-dump-output /secure/work/verified-database.dump \
  --restore-receipt-output /secure/evidence/full-backup-receipt.json \
  --json
```

Both output paths must be absolute and absent. The verifier decrypts the
database part selected by the validated central manifest, validates it with
`pg_restore --list`, hashes the exact plaintext dump and publishes the dump
plus receipt as new mode-`0600` files without overwriting. The receipt binds
the exact outer artifact SHA-256, 40-character Production commit, encrypted
database-part SHA-256 and plaintext database-dump SHA-256. If any validation
or publication fails, no receipt is accepted. The age identity must be an
absolute, operator-owned, single-link regular file with no group or world
permissions. The verifier reads it without following symlinks, freezes the
stable bytes into its private temporary directory and removes that snapshot
with all other temporary plaintext.

A restore output is created only from a database-part manifest with
`format_version: 2`, authorization contract schema 2 and canonicalization
`postgresql-17-acl-json-array-hex-v2`. The nested
database manifest must prove that privileges and
ownership were archived, bind a PostgreSQL-17 authorization fingerprint from
the same exported read-only snapshot as the dump, bind its complete sorted
owner/grantor/grantee role set, bind the source database container profile,
effective database ACL and current-database role settings, and match the active
`ACL` and `DEFAULT ACL` entries in the decrypted archive TOC. Historical
artifacts created with
`--no-privileges` remain eligible for checksum and structural verification,
but they cannot create a restore dump or restore receipt and cannot be used as
Gate-2 recovery evidence.

For the later Storage phase, use a different pair of outputs. Database and
Storage output modes cannot be combined in one invocation:

```bash
node scripts/operations/verify-backup-artifact.mjs \
  --artifact /secure/input/fanmind-full-<13-digit-timestamp>.tar.gz.age \
  --identity /secure/keys/fanmind-backup.agekey \
  --restore-storage-archive-output /secure/work/verified-storage.tar.gz \
  --restore-storage-receipt-output /secure/evidence/storage-preparation-receipt.json \
  --json
```

The verifier selects the Storage part only through the validated central Full
Backup manifest, decrypts it in private temporary space, rejects unsafe or
duplicate tar members, and requires the extracted regular-file path set to
equal the Storage manifest exactly. Every listed object must match its path,
size and SHA-256; an unlisted archive file is a hard failure. The new plaintext
archive and its receipt are published as non-overwriting mode-`0600` files only
after all checks pass. The receipt binds the outer artifact, Production commit,
encrypted Storage part, plaintext Storage archive, exact manifest bytes,
bucket, object count and aggregate byte count.

Before a later Storage write, validate that private pair against the exact
authorization bindings:

```bash
npm run restore:storage:preparation:verify -- \
  --receipt /secure/evidence/storage-preparation-receipt.json \
  --archive /secure/work/verified-storage.tar.gz \
  --expected-source-artifact fanmind-full-<13-digit-timestamp>.tar.gz.age \
  --expected-outer-sha256 <64-hex> \
  --expected-production-commit <40-hex> \
  --expected-storage-part-sha256 <64-hex>
```

Required final line: `RESTORE_STORAGE_PREPARATION=PASS`. This is preparation,
not `STORAGE_RESTORED`: the command never contacts Supabase, creates a bucket,
uploads an object or enables a write gate. The plaintext pair remains private
and must be deleted with evidence after the separately authorized Storage
phase. A distinct isolated non-Production Supabase project/bucket, a current
environment-boundary check, a dedicated write controller with rollback and a
new exact R4 authorization are still mandatory before any upload.

### Local-only Storage controller proof

The owner decision on 2026-09-07 explicitly selected a local-only proof and
declined an additional Supabase project or Preview branch. Run the bounded
synthetic contract with:

```bash
node --test tests/storage-restore-preparation.test.mjs \
  tests/storage-restore-drill.test.mjs
```

The local controller revalidates the private archive/receipt pair, requires a
private empty `fanmind-assets` target, uploads with overwrite disabled, lists
the complete remote path set, downloads every object for size/SHA-256
comparison and rolls back all objects written by the current attempt after a
bounded failure. It also rejects both the Production and canonical FanMind
Staging project references before provider access.

This test uses a synthetic in-process Storage API double because Docker and the
Supabase CLI are not available in the local execution environment. It neither
contacts Supabase nor decrypts the real backup. A green result proves the
controller contract only and must never advance the state beyond
`DB_POSTCHECKED` or be described as a real `STORAGE_RESTORED` result. The
controller therefore emits only
`STORAGE_RESTORE_EXECUTED_PENDING_EXTERNAL_ACCEPTANCE`; the canonical state
transition requires separately authorized, target-bound external evidence and
Project-Memory acceptance. An indeterminate transport or server outcome has no
provable object ownership, so it stops for external reconciliation and never
authorizes automatic deletion of that path. Only uploads with a confirmed
success response are eligible for rollback. Before the first write, the
controller atomically acquires an invocation-owned directory lock and writes an
immutable per-invocation reservation that binds the artifact, target and
intended write. A concurrent or stale lock blocks before any provider write and
is never removed by a losing invocation. The controller also writes a
reconciliation marker before deleting temporary plaintext, then
atomically updates that marker with the observed local-cleanup result. A
concurrently created pending marker is never superseded by this run. After the
exact remote postcheck, the controller
writes a durable `.pending` recovery receipt before deleting temporary
plaintext; both the receipt and its parent directory are `fsync`ed before
cleanup. The plaintext tree removal and the later pending-marker removal
are each followed by an `fsync` of their owning directory before either cleanup
is recorded as passed. Startup rejects an existing lock, reservation, pending
marker, interrupted replacement or finalization marker before any provider
write so recovery must reconcile it first. After a proven bounded remote
rollback, both the owned pending marker and reservation are durably replaced
with the accurate rollback-passed state; neither continues to imply a populated
target. A local plaintext-cleanup failure emits
`STORAGE_RESTORE_EXECUTED_LOCAL_CLEANUP_REQUIRED`, preserves the verified
remote outcome and exits as reconciliation-required instead of inviting a
retry. A simultaneous remote and local cleanup failure remains the stronger
`storage_restore_remote_and_local_reconciliation_required` condition.
Receipt-publication failure combined with local cleanup failure similarly emits
`storage_restore_receipt_and_local_reconciliation_required` so neither duty is
hidden. Once the remote postcheck is exact, receipt-finalization failure never
authorizes another remote rollback. The controller first publishes an owned
`.finalizing` receipt, then durably removes the owned pending marker and
reservation, releases the owned invocation lock, and only then promotes the
finalizing inode to the terminal receipt without overwriting an existing file.
Failure at any cleanup boundary leaves the terminal receipt absent and retains
the finalizing/recovery evidence for reconciliation. If plaintext cleanup also
failed before a bounded remote rollback, the pending marker is deliberately
preserved by an atomic, parent-directory-synced replacement. Its
replacement status records that rollback passed while local cleanup remains
required, while target cleanup is no longer required. The same replacement is
performed if the initial pending publication was indeterminate but rollback
succeeded and the marker is known to belong to this invocation. A marker created
concurrently by another writer is preserved and forces reconciliation. Every
replacement and marker removal requires the invocation lock and revalidates the
per-invocation identity through one `O_NOFOLLOW` file handle so metadata and
receipt JSON come from the same opened inode. A concurrently published final
receipt is treated as an ownership conflict and never authorizes remote
rollback.
Simultaneous plaintext and pending-marker cleanup failures emit
`storage_restore_pending_receipt_and_local_reconciliation_required`. An
indeterminate pending-receipt publication combined with failed remote rollback
and failed plaintext cleanup emits the complete
`storage_restore_remote_receipt_and_local_reconciliation_required` duty.

For a standalone database backup, content verification runs:

```text
pg_restore --list
```

For a standalone Storage backup, it validates the exact regular-file path set
and every file size and SHA-256 against the Storage manifest.

For a standalone server-config backup, it validates gzip/tar structure and safe archive paths. It does not print file contents.

## 4. Database restore drill

### Restore-secret-free host readiness

Before an isolated restore runner is allowed to load the protected
`restore-drill` environment, run the manual workflow
`FanMind Restore Host Toolchain Readiness` from `main` with the exact confirmation
`verify-isolated-restore-host`. This workflow is deliberately narrower than a
restore drill: it has no checkout, no GitHub Environment, no Restore secrets,
no database target, no encrypted backup and no restore dispatch.

The job is routed through organization runner group `fanmind-restore-drill`
and all five labels `self-hosted`, `fanmind-restore`, `fanmind-restore-01`,
`linux` and `x64`. The labels are routing selectors, not an authorization or
host-readiness boundary. The current public repository is organization-owned
as `FanMind/FanMind`, repository ID `1259448985`. The group is selected for
that repository and restricted to exactly these three reviewed Restore
workflow paths on `refs/heads/main`:

- `FanMind/FanMind/.github/workflows/restore-drill-host-readiness.yml@refs/heads/main`;
- `FanMind/FanMind/.github/workflows/restore-drill-resource-readiness.yml@refs/heads/main`;
- `FanMind/FanMind/.github/workflows/restore-drill-database.yml@refs/heads/main`.

This mutable administrator policy was revalidated immediately before protected
read-only run `32582640853` on 2026-08-22. It is not permanent acceptance:
every later R4 write must repeat the live group/repository/workflow check.
Every dispatch still checks `FANMIND_RESTORE_RUNNER_SCOPE` in its GitHub-hosted
first job and must stop before any Self-hosted job unless its value is exactly
`organization-workflow-allowlist`.

Before relying on the scope variable for any run, verify and retain a private administrator
receipt showing `visibility=selected`, selected repositories exactly
`[1259448985]`,
`restricted_to_workflows=true` and `selected_workflows` exactly the three workflow/ref entries
above. Because the current repository is public, the same receipt must
show `allows_public_repositories=true`; alternatively make the repository
private before any Runner registration. `FANMIND_RESTORE_RUNNER_SCOPE` is only the operator assertion of
that independently verified policy; it does not query the GitHub Admin API.

Normalize the private administrator capture with the exact Schema-1 contract
described below, store it as an owner-only `0600` file in an owner-only
directory, and validate it offline while it is at most one hour old:

```bash
npm run restore:runner-group-scope:verify -- \
  --input /absolute/private/runner-group-scope-capture.json \
  --output /absolute/private/runner-group-scope-receipt.json
```

The capture has exactly `schemaVersion`, `capturedAt`, `capture`,
`organization`, `repository` and `runnerGroup`. `capture` records only method
`github-organization-admin-policy-capture`, role
`organization-runner-group-administrator` and `containsSecrets: false`.
`organization.login` must be `FanMind`. `repository` contains exactly `id`, `name`, `fullName`,
`ownerLogin`, `ownerType` and `private`. `runnerGroup` contains exactly `name`,
`visibility`, `allowsPublicRepositories`, `restrictedToWorkflows`,
`selectedRepositoryIds` and `selectedWorkflows`. Unknown or duplicate members,
an owner mismatch, any repository ID other than `1259448985`, any additional
repository/workflow, a non-`main` ref, stale capture or unsafe file fails closed.

The newly created `0600` receipt is private and redacted: it omits the
organization login/full repository name and workflow strings, binds the input
bytes by SHA-256, and records only fixed policy facts and counts. This is
captured-policy verification, **not remote attestation**. The validator makes
no GitHub API call, cannot create an organization or runner group, cannot
register a runner and cannot start a restore. An administrator must still
create and inspect the real organization policy outside this repository.
The capture method, administrator role and timestamp are operator-supplied
claims rather than authenticated GitHub evidence. Its SHA-256 proves only the
identity of the reviewed capture bytes; the receipt does not detect later
GitHub-policy drift and does not set or enforce
`FANMIND_RESTORE_RUNNER_SCOPE`. Keep that variable unset until the live policy
has been independently rechecked by the responsible organization
administrator.
Only then may the value be set to `organization-workflow-allowlist`. The
externally administered runner must be a fresh one-job JIT runner;
it is removed after that single job. The workflow starts only the fixed
root-owned Node executable
`/opt/fanmind-restore/node-v24.19.0-linux-x64/bin/node` and the fixed root-owned
gate `/opt/fanmind-restore/restore-host-readiness.mjs`. The installed gate must
match SHA-256 `71249afb3364203908d7ecf8bb85d50d02efaf605f2d36b12faf32e1e5f64ac2` before it is executed.
The gate binds the stable GitHub repository ID `1259448985`, which survives an
owner transfer; it does not bind the current `Bernds-tech/FanMind` name.

The gate fails closed unless all of these facts hold:

- Ubuntu 24.04, Linux x64, Node.js 24.19.0 and the dedicated unprivileged
  `fanmind-restore` user and group are exact;
- the runner name is `fanmind-restore-01`, its supplementary-group set contains
  only `fanmind-restore`, `NoNewPrivs` is set, process capabilities are empty,
  non-interactive `sudo` cannot succeed and privileged Docker, Podman, LXD,
  Incus and libvirt sockets are inaccessible;
- runner temp and workspace are distinct, operator-owned non-symlink
  directories, and the temp directory is private;
- the gate, Node executable, PostgreSQL 17.11 tools, age 1.1.1, GNU tar 1.35,
  gzip 1.12, Bash and GNU coreutils 9.4 are fixed root-owned, non-writable
  regular files beneath fixed root-owned, non-writable directories;
- write acknowledgements remain disabled and no libpq target, Restore secret,
  Production/backup/service value, proxy, TLS override, loader variable,
  OpenSSL module configuration, Git config/trace override, Node debug/loader
  option, Python path or unexpected environment value reaches the gate.

The gate receives an explicit allowlist through `env -i`. Its receipt is
redacted, retained for three days and states that database connection,
decryption and writes were not attempted. A pass proves only host readiness;
it is never recovery evidence and never authorizes a restore.

The protected resource-readiness and database-restore workflows repeat this
design as two sequential fresh JIT runners. Job one performs the same
secret-free gate without the GitHub Environment. Only after it passes may a
second, independently registered one-job JIT runner enter the protected
environment; that second job re-checks the installed gate before checkout or
use of step-scoped Restore values. GitHub cannot enforce one-job JIT lifecycle
or outbound firewall policy, so the external runner controller and host
firewall are mandatory parts of this boundary.

### Read-only resource readiness before the drill

Before enabling either restore write gate, run the manual GitHub workflow
`FanMind Restore Drill Resource Readiness` from `main`. Its first job is the
secret-free host gate above. Its protected second job is bound to the GitHub
Environment `restore-drill`, runner group `fanmind-restore-drill` and the exact
five-label route `self-hosted`, `fanmind-restore`, `fanmind-restore-01`,
`linux`, `x64`.

The workflow requires the confirmation
`verify-isolated-restore-resources` and runs two strictly ordered read-only
phases.

The first phase, `restore:resources:preflight`, is checksum-only. It verifies:

- the Staging/Test application and Supabase project are distinct from
  Production;
- the independently recorded restore database target uses a host distinct from
  the Production database host;
- the database endpoint is not a shared Supabase pooler or a hosted direct
  `db.<project-ref>.supabase.co` database, both of which are unsupported restore
  targets;
- no active `PG*` connection target, password or passfile can redirect the
  check;
- the selected encrypted `fanmind-full-*.tar.gz.age` artifact and its adjacent
  checksum are regular, non-symlink files with a matching SHA-256.

This first phase does not connect to PostgreSQL, decrypt the backup, inspect
customer data, enable `FANMIND_ENABLE_NON_PRODUCTION_WRITES`, enable
`FANMIND_ENABLE_RESTORE_DRILL`, or invoke `pg_restore`. Required final line:

```text
RESTORE_DRILL_RESOURCE_READINESS=PASS
```

Only after that line passes, the separate
`restore:target:compatibility` phase makes one read-only connection to the
explicitly confirmed isolated target. It uses the fixed PostgreSQL 17 `psql`
client, a private mode-`0600` passfile snapshot, a private CA snapshot,
`sslmode=verify-full`, and a server-enforced read-only session. Use the target's
canonical DNS hostname covered by its certificate; do not substitute an IP
address or alias.

Its one fixed query reads only `pg_catalog.pg_settings`,
`pg_catalog.pg_roles`, `pg_catalog.pg_extension`, and
`pg_catalog.pg_namespace`. It fails closed unless:

- the target server major is exactly PostgreSQL 17;
- `current_user` is a PostgreSQL superuser, as required to preserve the archived
  ownership and privileges;
- the pre-existing roles `anon`, `authenticated`, and `service_role` are all
  present, because FanMind migrations grant or revoke privileges for them;
- the pre-installed, relocatable `pgcrypto` extension is exactly version 1.3
  in the fixed FanMind Production schema `extensions`, because five FanMind
  migrations declare `create extension if not exists pgcrypto`.

The configured login must additionally be the dedicated bootstrap restore
login outside the receipt-bound source role component. The compatibility query
proves its superuser attribute; the receipt-bound role preflight later proves
the source role component before any write.

The compatibility phase never creates a role or extension, applies a
migration, decrypts a backup, invokes `pg_restore`, or enables either write
gate. Its output contains only the server major and bounded counts, never host,
database, user, file path, catalog name, password, certificate, or query error.
Required final lines:

```text
RESTORE_TARGET_COMPATIBILITY_DATABASE_CONNECTION=read_only_catalog
RESTORE_TARGET_COMPATIBILITY_TLS=verify-full
RESTORE_TARGET_COMPATIBILITY_WRITES=disabled
RESTORE_TARGET_COMPATIBILITY_RESTORE_USER_SUPERUSER=true
RESTORE_TARGET_COMPATIBILITY=PASS
```

One-time external setup for the GitHub Environment `restore-drill`:

- variables `FANMIND_RESTORE_APP_URL`,
  `FANMIND_RESTORE_SUPABASE_PROJECT_REF`,
  `FANMIND_PRODUCTION_SUPABASE_PROJECT_REF`,
  `FANMIND_RESTORE_TARGET_DB_PORT`, `FANMIND_RESTORE_TARGET_DB_NAME`,
  `FANMIND_PRODUCTION_DB_PORT` and `FANMIND_PRODUCTION_DB_NAME`;
- secrets `FANMIND_RESTORE_SUPABASE_URL`,
  `FANMIND_RESTORE_TARGET_DB_HOST`, `FANMIND_RESTORE_TARGET_DB_USER`,
  `FANMIND_PRODUCTION_DB_HOST`, `FANMIND_PRODUCTION_DB_USER` and
  `FANMIND_RESTORE_ARTIFACT_PATH`. The target database user must be a dedicated
  bootstrap superuser outside the receipt-bound source role component;
- secrets `FANMIND_RESTORE_TARGET_PGPASSFILE_PATH` and
  `FANMIND_RESTORE_TARGET_CA_CERT_PATH`, each containing an absolute path on
  the isolated runner. The passfile must already exist as an operator-owned,
  regular, non-symlink mode-`0600` file. The CA bundle must already exist as a
  regular, non-symlink file and must not be group- or world-writable;
- secret `FANMIND_RESTORE_AGE_IDENTITY_PATH`, containing the absolute path to
  the operator-owned, regular, non-symlink age identity on the isolated
  runner. It must have exact private permissions and must never be copied into
  GitHub secrets, logs or artifacts;
- an externally managed JIT controller that registers exactly one fresh
  one-job runner for the secret-free host job and a second fresh one-job runner
  for the protected job, both in `fanmind-restore-drill` with the exact five
  labels. Neither registration
  token nor runner credential may be
  reused;
- an isolated host image with the gate and Node path above, PostgreSQL 17.11
  clients at `/usr/lib/postgresql/17/bin`, age 1.1.1, GNU tar 1.35, gzip 1.12,
  Bash and GNU coreutils 9.4 preinstalled as root-owned, non-writable files.
  Restore jobs do not use `actions/setup-node`, `npm install` or an ambient
  tool lookup;
- read-only filesystem access to the transferred encrypted artifact pair and
  outbound network access only to GitHub endpoints required for the JIT job
  and the isolated restore target. Production database, Storage, Supabase,
  cloud metadata and privileged host endpoints must be blocked externally.

Neither readiness result counts as a restore drill. Content verification, the
transactional database restore, RLS checks, Storage sample, server-config
inspection and cleanup evidence remain mandatory.

### Controlled database restore workflow

After the read-only phases pass, the manual workflow
`FanMind Isolated Database Restore Drill` provides the controlled bridge for
the database portion. It accepts only `main`, requires
`reviewed_commit == github.sha`, binds the exact Production commit recorded in
the selected full backup and requires the confirmation
`run-isolated-database-restore`. It first runs the secret-free fixed host gate
on one JIT runner, then re-checks that gate on a second environment-bound JIT
runner before checkout. It re-runs resource readiness and target compatibility
before either write gate is enabled.

The write step then:

1. proves the restore boundary again;
2. snapshots the private age identity, decrypts and validates the full backup;
3. restores only the receipt-bound database dump into the confirmed empty
   disposable target with `sslmode=verify-full`, the frozen CA and one
   transaction;
4. proves that every receipt-bound owner, grantor and grantee role exists with
   the exact source attributes and memberships, and that the separate
   bootstrap superuser can preserve archived ownership;
5. creates the private full-backup, runner and database-postcheck receipts;
6. uploads only those three private receipts as a three-day artifact;
7. removes the plaintext dump and receipt files from the runner in the final
   cleanup step.

The workflow deliberately does not upload a dump, an age identity, a passfile
or a CA file. It also does not claim final drill completion: the disposable
database still has to be destroyed by the operator, and the Storage sample,
server-config inspection, final evidence record and cleanup proof remain
separate mandatory steps.

The three uploaded receipts also do not prove external JIT registration,
runner-image provenance, firewall enforcement, target provisioning or final
target destruction. Preserve those as separate operator-controlled evidence;
do not infer them from a successful GitHub job.

### Preconditions

- an isolated, self-controlled bare PostgreSQL 17 cluster and disposable
  database that pass the catalog-level empty-target proof. Hosted direct
  Supabase databases and shared Supabase poolers are unsupported. A newly
  provisioned Supabase project is not considered empty merely because it has
  no FanMind rows, since its platform schemas and objects remain present;
- PostgreSQL major 17 plus the pre-existing roles `anon`, `authenticated` and
  `service_role`. The compatibility phase proves the migration-required
  `pgcrypto` 1.3 minimum; after decryption, the receipt-bound authorization
  preflight requires the complete Production extension set to be pre-installed
  with exact name, version, host schema, extension owner, schema owner,
  relocatability and member inventory before any restore write;
- every owner, grantor and grantee role in the authorization contract of
  the selected Full Backup Receipt schema 2, provisioned with the exact source
  attributes and bidirectional memberships before any restore write;
- an exact match for the receipt-bound source database container: database
  owner, encoding, locale provider and locale values, stored and actual
  collation versions, default tablespace, connection limit, effective database
  ACL and current-database role settings. A stored/actual collation-version
  mismatch fails before any restore write;
- a dedicated bootstrap superuser login outside that receipt-bound source role
  component. Do not reuse the target `postgres` login as both bootstrap and a
  source role when doing so would change the receipt-bound `postgres`
  attributes or membership fingerprint. It must be the only additional LOGIN
  and the only additional SUPERUSER outside the source component. Password
  hashes are deliberately not backed up or fingerprinted; keep the one-time
  bootstrap credential separate and destroy it with the target;
- the pre-existing `extensions` and `public` schema containers with their
  fixed Production owners and ACLs, plus every receipt-bound extension host
  schema. For each host schema whose definition is archived, the receipt also
  binds its exact schema owner because the filtered archive deliberately does
  not replay that `CREATE SCHEMA`/owner definition;
- empty disposable target database;
- exclusive administrative control of the disposable cluster for the complete
  preflight, empty-target check and restore transaction. Do not allow another
  administrator or automation to change roles, database settings or catalogs
  during that interval;
- no DNS, webhook or application configuration pointing at Production;
- written target identifier in the drill record.

For the empty-target proof, the fixed PostgreSQL 17 member inventories of
`plpgsql` 1.0 and `pgcrypto` 1.3 remain independently checked. In addition,
the private Full Backup Receipt binds the complete sorted Production extension
descriptor list and a canonical fingerprint over every extension's metadata,
configuration, initial privileges and portable member identities. The target
must match that list, fingerprint and record count exactly: missing, additional
or differently versioned extensions, a different host schema or owner, or any
changed member blocks the run before the first write.
The current Production descriptor set contains `pg_stat_statements` 1.11,
`pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1 and `uuid-ossp` 1.1.
That list is operational guidance only; the selected private receipt, not this
paragraph or an environment variable, is authoritative for a particular dump.
The core namespaces remain part of the fixed FanMind recovery contract:
`plpgsql` must be in `pg_catalog` and `pgcrypto` 1.3 must be in `extensions`.
A target with `pgcrypto` installed in any other schema is rejected before
`pg_restore`; `CREATE EXTENSION IF NOT EXISTS` would otherwise leave the
pre-installed extension in the wrong schema instead of relocating it.
The container proof also pins `extensions` to owner `postgres` and the five
Production ACL principals `postgres`, `anon`, `authenticated`, `service_role`
and `dashboard_user`; it pins `public` to owner `pg_database_owner` and the
six Production ACL principals including `PUBLIC`. The comparisons are
order-independent exact ACL-set checks. A missing or additional entry fails
before restore because the excluded schema definition cannot repair container
ownership or safely remove unknown grants.
The proof compares the receipt-bound extension contract with PostgreSQL's
extension membership catalog in both directions, so an object attached later
with `ALTER EXTENSION ... ADD` still blocks the restore. Its portable member
inventory starts at direct `pg_depend` extension members and follows only the
reverse internal, automatic, partition and sequence dependency closure
(`deptype` `i`, `a`, `P` and `S`). Definitions are fingerprinted for the
Production-bounded classes `pg_proc`, `pg_class`, `pg_type` and `pg_language`
plus derived `pg_attrdef`, `pg_constraint`, `pg_rewrite` and `pg_trigger`
records. Any other class fails closed with
`authorization_extension_class_unsupported`; TOAST identity is expressed
relative to its owning relation rather than by target-local OID or generated
name. The exact host-schema containers and this exact fingerprinted closure
are the only extension baseline exempted from the empty-target object count;
every unrelated object inside those schemas remains visible.
That includes relations, routines, types, collations, conversions, operators,
operator classes and families, extended statistics and text-search objects.
Schema-less database objects such as non-core languages, casts, access methods,
transforms, FDWs, foreign servers, user mappings, default ACLs, event triggers,
large objects, publications and current-database subscriptions also block the
restore unless their exact address is a member of a receipt-verified
extension. Every other non-system schema or object blocks it before
`pg_restore`.

All receipt-bound extensions and their PostgreSQL-17 packages must therefore
be installed on the isolated target before the run. The dump's active
`CREATE EXTENSION IF NOT EXISTS` entries are not a provisioning mechanism:
after the exact preflight they are verified no-ops, while the rest of each TOC
entry remains active. No extension is silently omitted or accepted merely
because its package happens to exist on the host.

Decrypt and verify the full backup on the isolated host. The content verifier
must create a private full-backup receipt that binds the encrypted database
part and the exact decrypted database dump by SHA-256. A free environment
variable or a manually copied expected dump hash is not accepted. The
full-backup receipt, dump and passfile must be regular, non-symlink files owned
by the operator with exact private permissions. The runner- and
database-postcheck-receipt output paths must still be absent inside private,
operator-owned directories. The CA must be a stable regular non-symlink file
that is not group- or world-writable. Use a dedicated TCP
endpoint, `sslmode=verify-full`, the canonical certificate-covered DNS
hostname and absolute paths to the protected `PGPASSFILE` and CA; do not put
the database password in `PGPASSWORD`.

Set the actual libpq target and independently confirmed comparison metadata in the same protected shell:

```bash
export PGHOST=<isolated-target-host>
export PGPORT=<isolated-target-port>
export PGDATABASE=<isolated-target-database>
export PGUSER=<isolated-bootstrap-superuser>
export PGPASSFILE=<protected-passfile-path>
export PGSSLMODE=verify-full
export PGSSLROOTCERT=<protected-ca-certificate-path>
export PGGSSENCMODE=disable

export FANMIND_RESTORE_TARGET_DB_HOST=<same-isolated-target-host>
export FANMIND_RESTORE_TARGET_DB_PORT=<same-isolated-target-port>
export FANMIND_RESTORE_TARGET_DB_NAME=<same-isolated-target-database>
export FANMIND_RESTORE_TARGET_DB_USER=<same-isolated-bootstrap-superuser>

export FANMIND_PRODUCTION_DB_HOST=<production-comparison-host>
export FANMIND_PRODUCTION_DB_PORT=<production-comparison-port>
export FANMIND_PRODUCTION_DB_NAME=<production-comparison-database>
export FANMIND_PRODUCTION_DB_USER=<production-comparison-user>

export FANMIND_ENABLE_RESTORE_DRILL=true
export FANMIND_RESTORE_TARGET_ACK=I_UNDERSTAND_EMPTY_DISPOSABLE_DATABASE_ONLY
export FANMIND_RESTORE_DRILL_ID=2026-07-30-restore-001
export FANMIND_RESTORE_DISPOSABLE_TARGET_ID=<new-random-uuid-v4>
export FANMIND_RESTORE_PRODUCTION_COMMIT=<exact-40-character-source-commit>
export FANMIND_FULL_BACKUP_RESTORE_RECEIPT_PATH=<private-receipt-path>
export FANMIND_RESTORE_RUNNER_RECEIPT_PATH=<new-private-output-path>
export FANMIND_RESTORE_DATABASE_POSTCHECK_RECEIPT_PATH=<new-private-postcheck-output-path>
unset PGPASSWORD PGHOSTADDR PGSERVICE PGSERVICEFILE

npm run restore:preflight
```

The command is read-only and does not decrypt or restore anything. It fails unless:

- the shared write boundary confirms `staging` or `test` and a Supabase project distinct from Production;
- `PGHOST`, `PGPORT`, `PGDATABASE` and `PGUSER` exactly match the separately written restore target;
- the actual four `PG*` values are already canonical: normalized lower-case host without trailing dot, decimal port without leading zeros, and database/user without surrounding whitespace;
- the target host differs from the Production database host, independently of port, database or user;
- canonical IPv4/IPv6 spellings are enforced; legacy numeric IPv4 forms are rejected;
- no `PGHOSTADDR`, `PGSERVICE` or `PGSERVICEFILE` can silently redirect libpq;
- `PGDATABASE` is a plain database name, not a URI or libpq Connection-String;
- shared Supabase poolers and hosted direct
  `db.<project-ref>.supabase.co` databases are blocked; the restore endpoint
  must identify the isolated self-controlled PostgreSQL 17 target;
- absolute protected `PGPASSFILE` and CA paths are configured,
  `PGSSLMODE=verify-full`, `PGGSSENCMODE=disable` and `PGPASSWORD` is absent.

Required final line:

```text
RESTORE_TARGET_BOUNDARY=OK
```

Run the guarded restore runner immediately afterwards in the same shell:

Restore into the empty test database:

```bash
npm run restore:database:drill -- \
  /secure/work/fanmind-database-<timestamp>.dump
```

The runner opens the protected non-symlink dump, full-backup receipt, passfile
and CA once, verifies their type and permissions, and copies those exact file
objects into a new operator-private snapshot directory. The supplied paths are
not trusted again afterwards. It verifies
that the private dump hash equals the hash bound into the full-backup receipt
and that the receipt names the exact Production commit. A separately supplied
free expected hash is forbidden.

It repeats the target preflight against the private passfile copy, rejects any
non-canonical active target value and makes the four checked `PG*` values
read-only inside its process. Before the write-mode call it validates the
private dump snapshot with a target-free `pg_restore --list` and queries the
target with `psql` to prove that no non-system objects exist. A nonzero,
ambiguous or unreadable result stops the runner before `pg_restore`.

The target-free archive listing is held only inside the private snapshot
directory. The Full Backup Receipt declares every unique non-system,
non-`public` extension host schema whose definition pg_dump archived, together
with its exact schema owner. For the current Production set those filter
targets are `SCHEMA - extensions postgres` and
`SCHEMA - vault supabase_admin`. The runner requires exactly one active
PostgreSQL 17 `pg_namespace` TOC entry for every declared target, copies every
TOC entry in its original order and disables only those exact schema-definition
lines before using the list with `pg_restore --use-list`. A descriptor marked
as not archived must have no active schema-definition line. Missing,
duplicated, malformed, differently owned, receipt-unbound or ambiguous schema
and extension entries stop before the empty-target query.

Every receipt-required extension except PostgreSQL 17's built-in `plpgsql`
must have exactly one active `EXTENSION` entry. `plpgsql` is the only permitted
missing built-in entry and an unexpected active `plpgsql` entry fails closed.
Every active entry must name a receipt-bound extension and remains byte-for-byte
active. The following read-only authorization preflight requires the complete
version/schema/owner/member fingerprint before the first target write, so
those `CREATE EXTENSION IF NOT EXISTS` statements are checked no-ops. Schema
and extension comments and security labels, and every non-extension Production
object inside an extension host schema, remain active. Broad
`--exclude-schema` filtering is forbidden because it would omit restored
Production objects. The filtered list is opened and validated once, its path
is removed, and the inherited private descriptor is passed to `pg_restore`.
The raw TOC path and filtered TOC pathname are unlinked before the target query;
the filtered bytes remain reachable only through that private descriptor until
`pg_restore` returns. The snapshot trap also removes either path if preparation
fails earlier.

Before querying target contents, the runner reads the authorization role and
extension sets only from the exact private Full Backup Receipt. One read-only
catalog check requires every role to exist, rebuilds the receipt-bound
bidirectional membership component, and matches its role attributes,
memberships, membership options and grantors, connection limits, validity
timestamps, per-role settings, fingerprint and record count before the first
database write. The same query independently recomputes the complete installed
extension descriptor list and extension/member fingerprint, so an extra,
missing, differently owned or modified extension cannot become an empty-target
exemption. It also compares the receipt-bound database-container fingerprint
and record count, including the owner, effective database ACL,
current-database role settings and stored/actual collation versions. This
detects both additional privilege parents and an unexpected login role that
can assume a receipt-bound role. The separate restore login must be the sole
additional LOGIN and SUPERUSER outside that component so archived ownership
can be preserved without changing a source role's attributes or memberships.
In particular, do not make a receipt-bound target `postgres` role serve both
purposes if that changes its source fingerprint. Role password hashes are out
of scope and no role or extension is created or altered by the drill. The
archive's `ACL` and `DEFAULT ACL` entries stay active in the filtered list.

The restore then uses that exact same snapshot with `--single-transaction`
and restores both ownership and privileges. `--no-owner` and
`--no-privileges` are forbidden. A failed archive check stops the runner before
any write, and any restore error rolls back atomically. Host, port, user and
database are supplied as explicit arguments while hidden libpq target
overrides are removed. Every database connection uses `verify-full` with the
frozen CA snapshot and disables GSS encryption fallback.

Immediately after the restore, the same frozen target and private passfile
snapshot are used for catalog-only post-restore queries. The first checks
exactly `workspaces`, `workspace_members`, `contacts`, `memories` and
`followups`: every table must exist in `public`, have RLS enabled and have at
least one PostgreSQL policy. The shared authorization-contract query then
recomputes the target's deterministic object/ACL fingerprint and requires the
source-bound record and grant counts, the exact role and database-container
fingerprints, all 120 app-role grant tuples on the five core tables, and the
same 12 restricted non-trigger
`SECURITY DEFINER` functions. The remaining executable SECURITY DEFINER is a
trigger-returning function and is still fingerprint-bound. Only after both
queries pass does the commit-bound runner create a new private, atomic runner
receipt and then the separate private `database-postcheck-receipt.json`. The
runner receipt binds the drill ID, opaque disposable-target UUID, empty-target
observation, exact full-backup receipt bytes, database hashes, timestamps and
successful single-transaction result. The postcheck receipt binds its timestamp, drill ID,
opaque disposable-target UUID and Production commit to the exact runner
receipt SHA-256. A missing table, disabled RLS, missing policy, changed
identity, pre-existing output or unsafe output directory fails closed.

The host policy canonicalizes literal IPv4 and IPv6 addresses and rejects legacy numeric IPv4 spellings. It does not perform DNS resolution. The recorded Production and isolated target identities must therefore use their real canonical endpoints, never aliases or CNAMEs; endpoint isolation remains an explicit operator precondition.

After the drill, clear the one-time gates:

```bash
export FANMIND_ENABLE_RESTORE_DRILL=false
unset FANMIND_RESTORE_TARGET_ACK
export FANMIND_ENABLE_NON_PRODUCTION_WRITES=false
unset FANMIND_NON_PRODUCTION_WRITE_ACK
```

The runner now records the core database and authorization postcheck
automatically. Do not copy
`coreSchemaChecks: "passed"` or `rlsVerification: "passed"` into the final
evidence manually; schema 6 rejects both fields. Additionally verify:

- no Production webhook or secret values were restored into application runtime configuration;
- test logins and test data access remain isolated.

Destroy the disposable database after evidence is recorded.

## 5. Storage restore drill

Use a separate test bucket or test Supabase project. Never upload into the Production `fanmind-assets` bucket during a drill.

Steps:

1. verify and decrypt the standalone Storage artifact;
2. inspect `manifest.json` without editing it;
3. upload a small representative subset to the empty test bucket;
4. compare uploaded object count, size and SHA-256 against the manifest;
5. download the sample again and verify SHA-256;
6. delete the disposable test bucket or objects.

A full automated Storage restore is intentionally not part of the verifier. Upload remains an explicit, reviewed test-environment action.

## 6. Server configuration inspection

Decrypt only on the isolated host. Confirm the archive contains the expected categories:

- `.env.production` inside encrypted content;
- PM2 dump;
- nginx configuration;
- systemd units;
- encrypted backup-worker configuration.

Do not paste or log their contents. Compare permissions and file presence against `docs/operations/BACKUP_WORKER.md`.

## 7. Evidence record

Record the result as a protected JSON file and validate it together with the
exact three private receipts before marking the drill complete:

```bash
npm run restore:evidence:verify -- \
  --input /secure/evidence/fanmind-restore-drill.json \
  --full-receipt /secure/evidence/full-backup-receipt.json \
  --runner-receipt /secure/evidence/restore-runner-receipt.json \
  --database-postcheck-receipt /secure/evidence/database-postcheck-receipt.json
```

Required final line:

```text
RESTORE_DRILL_EVIDENCE=PASS
```

Use this exact schema and replace only the bounded placeholder values:

```json
{
  "schemaVersion": 6,
  "drillId": "2026-07-30-restore-001",
  "startedAt": "2026-07-30T08:00:00Z",
  "completedAt": "2026-07-30T08:30:00Z",
  "environment": "staging",
  "sourceArtifactBasename": "fanmind-full-1785398400000.tar.gz.age",
  "outerSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "productionCommit": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "fullBackupReceiptSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "restoreRunnerReceiptSha256": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "databasePostcheckReceiptSha256": "9999999999999999999999999999999999999999999999999999999999999999",
  "databasePartEncryptedSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "databaseDumpSha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "databaseAuthorizationFingerprintSha256": "abababababababababababababababababababababababababababababababab",
  "databaseAuthorizationRecordCount": 500,
  "databaseAuthorizationGrantTupleCount": 1000,
  "databaseAuthorizationRequiredRolesSha256": "1212121212121212121212121212121212121212121212121212121212121212",
  "databaseAuthorizationRoleFingerprintSha256": "3434343434343434343434343434343434343434343434343434343434343434",
  "databaseAuthorizationRoleRecordCount": 42,
  "databaseAuthorizationContainerFingerprintSha256": "5656565656565656565656565656565656565656565656565656565656565656",
  "databaseAuthorizationContainerRecordCount": 12,
  "databaseCoreTableAppGrantTupleCount": 120,
  "databaseRestrictedSecurityDefinerFunctionCount": 12,
  "disposableTargetId": "123e4567-e89b-42d3-a456-426614174000",
  "verifier": "passed",
  "storageSample": "passed",
  "serverConfigInspection": "passed",
  "cleanup": "passed",
  "databasePrivilegesRestore": "passed",
  "databaseOwnershipRestore": "passed",
  "databaseAuthorizationPostcheck": "passed",
  "coreTableAppPrivileges": "passed",
  "securityDefinerExecutionBoundary": "passed",
  "productionModified": false,
  "customerDataRecordedInEvidence": false,
  "secretsRecorded": false,
  "issues": []
}
```

The UTC timestamps must be real calendar instants, and the full-backup
basename must use the worker's exact 13-digit millisecond format. Duplicate
JSON member names are rejected before parsing. Calculate
`fullBackupReceiptSha256` over the exact receipt bytes. Copy
`databasePartEncryptedSha256` and `databaseDumpSha256` from that receipt.
Calculate `restoreRunnerReceiptSha256` over the exact runner-receipt bytes.
Calculate `databasePostcheckReceiptSha256` over the exact database-postcheck
receipt bytes. The verifier requires all three hashes, `drillId`,
`disposableTargetId`, Production commit and the evidence timestamp envelope to
match the runner and postcheck receipts. It accepts database restore and
empty-target success only from the machine-generated runner receipt and core
schema/RLS/policy success only from the machine-generated postcheck receipt.
Schema v5, a manually asserted `databaseRestore: "passed"`, manual
`coreSchemaChecks: "passed"` or manual `rlsVerification: "passed"` fail
closed.

Generate `disposableTargetId` as a new random UUID v4 for this drill. Keep the
private mapping from that opaque ID to the actual disposable host/database in
the protected operator record, never in the attachable evidence. A real
Production backup necessarily transfers customer data into the controlled
disposable restore target; the narrower
`customerDataRecordedInEvidence: false` assertion means that none of those
contents or identifiers were copied into the redacted evidence.

The evidence file, runner receipt and database-postcheck receipt contain no
host names, database names, user names, passwords, keys, customer data or
free-form notes. The private Full Backup Receipt additionally contains the
bounded, sorted database role names required for the prewrite role check; it
must therefore remain confidential and may appear only in the private,
short-lived workflow artifact. None of the three receipts contains passwords,
keys or customer rows. The verifier accepts only the documented evidence and
receipt keys, reads stable private regular files, binds the artifact basename,
outer SHA-256, Production commit, database-part SHA-256, restored-dump SHA-256,
empty-target observation and transactional restore result, prints status codes
only and never echoes record values. The database postcheck receipt exposes
only the fixed counts 5/5/5, the authorization fingerprint and bounded counts,
and the hashes and opaque identities required for binding; it records no table
contents or policy expressions.

On success the verifier also prints:

```text
RESTORE_EVIDENCE_SHA256=<sha256-of-the-exact-validated-json-bytes>
```

Immediately before attachment, calculate `sha256sum` over the exact file and
require it to equal `RESTORE_EVIDENCE_SHA256`. Attach only those validated
bytes, the matching digest and bounded status output. Never attach decrypted
files, credentials or `.env` values.

## 8. Pass criteria

A restore drill passes when:

- the transferred encrypted artifact matches its SHA-256;
- decryption and structural validation succeed;
- a database dump restores into an isolated empty target without errors;
- the machine-bound database postcheck proves 5/5 required tables, 5/5 RLS
  enablement and 5/5 policy coverage;
- the receipt-bound authorization fingerprint matches after restore, including
  archived owners, grants, grantors, grant options, default ACLs, 120 core
  app-role table grants, the exact role graph and database-container contract,
  and the restricted SECURITY DEFINER boundary;
- representative Storage objects validate after upload/download in a test bucket;
- server-config archive contents are present and readable in isolation;
- all plaintext temporary files and disposable targets are removed;
- no Production data, service or configuration was modified.

## 9. Failure handling

If any validation fails:

- do not retry by disabling checksum or path validation;
- preserve the encrypted artifact pair;
- record the verifier error code;
- create a new backup after the cause is understood;
- keep the last previously verified backup within retention;
- do not mark the backup run as restore-tested.
