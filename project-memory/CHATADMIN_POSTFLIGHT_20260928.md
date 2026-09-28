# FM-CHATADMIN-003 postflight follow-up — 2026-09-28

- State: repository correction in progress on PR #1223; end-to-end feature remains IMPLEMENTED_NOT_VERIFIED.
- PR #1222 merged as `cff301bdcab927a648e1cf0fdd880678da1980da`. Exact review findings are being closed iteratively; earlier code/check evidence is superseded by later commits.
- Review of `990e88cefa48b78be556a987d20163d96e9f543d` found that parent Character drift was checked after ABSENT, extra parent checks were omitted, and the PG17 exclusion expression was non-immutable. These were corrected at `5afb920ce82b3993bcda968dac42d6c82c766667`; independent review found no major issues.
- The 5afb PG17 run confirmed the immutable test now works but exposed incomplete restoration of the internal fan-FK trigger group. Commit `6876f92fada561f383befe1c757b7ed4d854ca9c` restores all internal trigger rows; its ChatAdmin Operations/native PG17 test passed.
- Latest review requested checking non-CHECK constraints on parent status/revision too. Commit `863c8776373b6caafa01450f7da887f65a7b8db7` compares every constraint on those runtime columns and adds an unexpected-UNIQUE negative test.
- No Staging, Production, provider or customer mutation occurred. The controlled checksum-pinned SQL remains unapplied.
- Next: rerun all required checks including native PG17 and independent review. Then merge, run protected read-only Staging schema VERIFY, and APPLY only if absent. Confirm postflight and cleanup; Production remains unchanged.
