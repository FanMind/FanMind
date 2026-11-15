# Website Chat acceptance environment repair – 6 November 2026

Direct Staging acceptance task, no delegation. R3; Main-only protected Staging
workflows keep their existing write concurrency and guaranteed rollback/cleanup.
No Production, secret, permission or provider changes.

ChatAdmin PR1435 passed 14/14 checks and merged as
4d1a81c69bd6978d971443615a326b151efef9ae. Deployment42190334293 succeeded.
Complete ChatAdmin runtime42190562514 succeeded, including browser/invented_price,
six exact counts 3/2/2/41/10/0, independent usage-ID verification and cleanup/absence.

Additional Website retention acceptance42190721551 failed at its SQL postflight,
before synthetic writes. The exact unchanged read-only SQL passed through the
Staging connector. Unlike the working Support/ChatAdmin controls, both Website
acceptance workflows omit PGSSLROOTCERT while requiring verify-full. They also
reference an unset synthetic-workspace variable. The target already has the
explicitly marked workspace58a18c7e-4af0-459d-b44d-7d924ee7ffe9 with both required
staging_synthetic_fixture and workspace_processing_acceptance flags.

Use the existing checked-in Supabase CA, preserving verify-full. Require the
reviewed synthetic workspace as an explicit workflow input; the unchanged SQL
continues to require both target-side fixture flags before any write. No workspace
creation, entitlement change, secret edit or TLS reduction is needed. Both actions
remain Main/commit-bound, protected by environment staging, with original
rollback-only acceptance, browser denials and always-run password-file removal.

Focused local workflow/CA validation:3PASS,0FAIL,0SKIP. Exact-head CI and fresh
Staging runtime still required. The failed workflow remains FAIL; a successful
connector preflight is not represented as a successful workflow or full acceptance.
Support repair audit remains a separate protected schema drift; no apply bundled.
