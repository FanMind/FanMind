# FM-CHATADMIN-003 postflight follow-up — 2026-09-28

- State: repository correction in progress on PR #1223; end-to-end feature remains IMPLEMENTED_NOT_VERIFIED.
- PR #1222 merged as `cff301bdcab927a648e1cf0fdd880678da1980da`. Exact review findings are being closed iteratively; earlier code/check evidence is superseded by later commits.
- Review of `990e88cefa48b78be556a987d20163d96e9f543d` found that parent Character drift was checked after ABSENT, extra parent checks were omitted, and the PG17 exclusion expression was non-immutable. These were corrected in the follow-up recorded at `5afb920ce82b3993bcda968dac42d6c82c766667`; independent review found no major issues.
- The exact 5afb PG17 run passed ChatAdmin Operations tests but failed restoring one system-catalog FK trigger after a negative test because the test changed/restored only one internal trigger row. Commit `1ee9ff1f142ac23a8ea3f6ee9c39a6c7af496327` now disables/restores the complete FK trigger group before asserting PARTIAL/VERIFIED.
- No Staging, Production, provider or customer mutation occurred. The controlled checksum-pinned SQL remains unapplied pending reviewed-main gates.
- Next: rerun all required checks including native PG17 and independent review. Then merge, run protected read-only Staging schema VERIFY, and APPLY only if absent. Confirm postflight and cleanup; Production remains unchanged.
