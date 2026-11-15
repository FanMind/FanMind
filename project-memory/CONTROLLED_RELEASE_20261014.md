# Controlled production release activation

Owner explicitly authorized releasing ChatAdmin changes and lifting the sealed production workflow on 2026-10-14. PR #1318 merged as 3c99e3e7293ac5ce776579078156510222049c2d after all nine PR workflows succeeded.

This scoped follow-up restores manual deployment only for the Owner on protected current main with exact commit confirmation, completed main and merged PR checks, expected current production release, and the existing isolated build/switch/rollback path. In-place legacy deployment remains disabled. No credentials, repository permissions, database schemas, or runner access are changed.

The local combined draft passed operations tests and build; release preflight and workflow assertions were independently reviewed. GitHub CI must pass on this exact follow-up before merging and dispatch. Publication and production health remain unconfirmed until verified separately.
