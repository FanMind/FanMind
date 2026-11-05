# Support release Expo dependency alignment — 2026-11-05

Owner authorized the new Production release and automatic Support retention/monitoring. PR1423 is merged at71208510, but the unmodified Production preflight rejects its failed optional Mobile CI. Nine Expo SDK dependency versions are aligned with the actual Doctor report; all release checks remain enforced.

The existing secret-free hosted Mobile runner resolved the npm lock from those explicit package constraints. Artifact13429856232 from run42055859385, exact source dea6bc2d45b596513a1c561e89dabb8918002eb6, SHA256 df6b70d21ec684a7097afac5839c6edfbd0926a19e81fbdec8e2b94c797a512d, was independently downloaded and hash-verified. The generated manifest matches the reviewed constraints. Temporary resolution/export workflow steps are removed; final CI uses the original npm ci and all normal checks.

No signed Mobile build, store release, environment/provider/secret/schema change, Production deployment or Support activation is included in this source fix. Final exact-head CI including Mobile/native/Supply Chain and the repository's protected merge remain required. Current live release/Support state is not inferred from source tests.
