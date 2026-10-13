# Root-access reconciliation / protected bootstrap

Latest owner authorized controlled production actions subject to prerequisites.
PR1315 merged d739797f25a883160f2fa4d4aabeeea8e289d219; tested program bytes unchanged.
Environment backup-production-recovery24216363768 created/protected, Owner User
270165082, main-only, administrator bypass disabled; no secrets added.
Protected verify38464119023/1 passes hosted validation and reaches actual
fanmind-prod-01-exoscale, then fails at missing fixed Worker wrapper.
No installation/DB/backups/App action occurred. Direct local SSH unavailable
is not a general host block: an existing authorized GitHub runner is reachable.

Separate bootstrap proposal uses only the existing sudo Node capability, first
inspect without writes, then bounded staged Controller/bundle files and root
receipt/authorization; no sudoers/SSH grant, sealed deployment unchanged.
Code/CI/countercheck and actual sudo capability must pass before action.
Actual new main must replace d739 in authorization/dispatch after this PR merge,
while Controller program-source provenance remains d739. Bootstrap failure is a
receipt-bound root reconciliation boundary, never an excuse for blind retries.

Dependent backup/Restore/schema/release work stays blocked until its prerequisites
are proved; sales_playbook remains missing, existing base/fan/tier not reapplied.
