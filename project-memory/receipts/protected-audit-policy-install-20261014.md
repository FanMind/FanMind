# Protected one-hour audit policy installation source

Date: 2026-10-14
Risk: R4 protected Production audit-policy installation; source preparation only.

Owner requested one hour in place of 24h, then requested publication after the hour elapsed. PR #1320 merged as 935d1d806d09bd7291e89bcffb2250864dcf6739 with green exact-head CI. Production still executes installed root-owned old audit bytes; merge alone does not activate that change.

This bounded manual controller uses the existing Owner-reviewed backup-production-recovery environment and existing sudo Node capability, explicit exact-main/action/source/runtime approval variable, exact host/actor/repository identity and frozen SHA-bound installer bytes. It installs only the two pinned audit files from #1320, accepts only the pinned previous or new pair, holds the backup install lock, verifies unchanged production runtime 707d22702a784e3b9999d1c9ae9c1e11c096a1bc and runs the complete audit as ubuntu. A failed installation/postcheck restores both old files. No service restart, app deployment, database write, decryption or restore is performed.

State: SOURCE_PREPARED; protected variable save, dispatch, environment approval, real host installation and independent installed audit remain pending. Never infer Production installation from this document, a merge or local tests.
