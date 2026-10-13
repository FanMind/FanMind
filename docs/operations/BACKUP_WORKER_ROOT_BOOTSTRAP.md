# Protected bootstrap through the existing Production runner

This route fills the missing bootstrap prerequisite of PR1315. The owner
explicitly authorized controlled Environment/bootstrap/Worker/backup/schema/
release work on 2026-10-13, subject to all technical and repository gates.
It does not unseal Deploy FanMind and grants no new sudo/SSH permissions.

Observed protected verify 38464119023/1 passed Environment/main/actor validation,
reached fanmind-prod-01-exoscale, and stopped at the missing fixed wrapper.
No Worker restart, DB apply, new backup, or program replacement occurred.
Environment backup-production-recovery (24216363768) now requires User270165082,
permits only main, and has administrator bypass disabled (UI confirmation).

The new workflow has inspect and bootstrap actions, is main/current-SHA/owner
bound, uses the existing protected Environment and Production concurrency group.
The bootstrap-specific Environment variable must be exactly
`CURRENT_MAIN:ACTION:8e5dcbdca844972fb2f133c188ecfee5d5252273:707d22702a784e3b9999d1c9ae9c1e11c096a1bc:admin-bypass-disabled`.
Record an independent fresh UI check of the disabled bypass before setting it.
Dispatch confirmation is backup-worker-inspect or backup-worker-bootstrap.

First execute inspect only after all required CI and independent code review
pass. It proves the existing sudo Node capability without persistent installation writes,
checks actual root ownership/modes, active fixed Unit, old Worker hashes,
unchanged App/release.env, exact Production TLS identity, full20/13 contract and
empty backup/verify queue. It reads credentials only for the existing verified
connection, never logs them. Both queries use frozen root-private temporary passfile/CA copies, removed
in finally; originals are checked before/after queries; a rotation blocks writes. No arbitrary credential/target is accepted.

Bootstrap uses a small reviewed inline launcher to open the downloaded source
without symlink traversal, freeze bytes, check exact SHA and stable inode/size/
times, then execute only those frozen bytes in a fresh root subprocess. It never
executes an unchecked Runner path as root. The existing broad sudo Node capability
is an existing host risk, not a new permission and not proof by itself.

Only six pinned files are staged: three Controller files from d739797... and
three Worker bundle files from 8e5dcbd... . No installed Worker file is replaced.
No service mutation, DB mutation, backup/retention action, PM2/release.env write,
secret provisioning or sudoers change is included. Unknown existing destinations,
authorization or bootstrap receipt block; no blind retry after partial bootstrap.
PREPARED is fsynced before copies; COMPLETED follows original Controller verify. Provisional authorization permits
only verify; install/rollback are enabled atomically only after COMPLETED.
The source inventory is compared before and after bootstrap. Private root
paths/modes, exclusive creates and the shared nonblocking host lock are mandatory.

The root authorization binds the actual current main, real observed old hashes
and Unit hash, actual App707..., Worker8e5..., owner, two-hour TTL and authorized
verify/install/rollback. The original Worker controller performs all fresh
pre/postflights and rollback before any separately dispatched Worker install.

Important: this PR's merge changes main. The Controller program source remains
byte-identical d739..., but authorization/controllerCommit and subsequent dispatch
must bind the NEW actual reviewed main. Never disable exact-main verification.
Update FANMIND_BACKUP_WORKER_ACTION_APPROVAL to the actual main for each action.

If existing sudo Node or the fixed wrapper invocation is not permitted, stop
only that host operation. Do not grant a generic shell, modify sudoers, route
through a sealed workflow or create a privileged runner. A host administrator
must supply the missing narrowly scoped prerequisite. Existing backups and the
old running Worker remain intact. A partial bootstrap needs exact root-side
reconciliation; its receipt is not an installation or backup success receipt.

Next dependent actions remain fresh DB/Full backups with retained old artifacts,
Offsite/content evidence, new isolated Restore, then exact absent sales_playbook
apply and a separately reviewed protected release/rollback controller. No schema
apply or application deployment is embedded in bootstrap.
