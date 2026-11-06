# Owner-requested backup audit window

Date: 2026-10-14
PR: #1320
Risk: R3 source policy change; protected Production installation remains separate.

The Owner explicitly requested changing the backup-worker failure-free release window from 24 hours to one hour and clarified that the site has not officially launched. Collector and verifier now use BACKUP_WORKER_1H_FAILURE_EVENT_COUNT and BACKUP_WORKER_1H_FAILURE_FREE. Historical 24h/14d diagnostic counters remain visible. Backup freshness, checksum-only verification, encrypted artifact pairs, offsite and runtime criteria are retained.

Local evidence: production-readonly-audit suite 46 passed, 1 environment-dependent native test skipped, 0 failures. The executed collector test proves exact one-hour boundary behavior, older diagnostic failure retention and no raw error disclosure. Verifier negatives reject legacy-only, contradictory and duplicate evidence. Diff whitespace validation passed.

State: SOURCE_PREPARED. CI, merge and protected joint installation of collector/verifier are pending. Installed Production code still uses 24h. A repository merge alone does not install these files. No Production deployment, audit acceptance or full restore claim is made by this receipt.
