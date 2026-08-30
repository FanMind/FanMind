# Project Authorizations

## Standing authorizations from Bernd

- Maintain and extend the Project Memory system.
- Create implementation branches and pull requests for project-memory governance changes.
- Update documentation, ledgers, open loops, dependencies, evidence, decisions and handoff files when needed.
- Continue FanMind work according to the recorded roadmap, repository rules and project-memory state.

## Not covered by standing authorization

- production database writes or restores;
- destructive infrastructure changes;
- production secrets, key rotation or secret disclosure;
- payment/billing changes;
- publishing production releases;
- bypassing failing security, supply-chain or governance checks;
- real external account integrations without available credentials/permissions.

## Operating rule

If an action is covered here and technically possible through connected tools, proceed without asking again. If the platform requires confirmation or the action is outside this file, record the blocker in project-memory/OPEN_LOOPS.md or project-memory/SESSION_HANDOFF.md.

## Current caution

FanMind has stricter governance gates than the WellFit repositories. A green Project Memory Guard alone is not enough to merge when other FanMind gates are red.

## FM-AUTH-MOB-REDIRECT-CLOSEOUT-20260830

- Granted by: Bernd through explicit action-time confirmation in the current session.
- Scope 1: save exactly `fanmind://reset-password` in the already confirmed FanMind Production Supabase Auth redirect list; do not change Site URL, existing redirects, Auth providers, users, database/schema/RLS or any other provider setting.
- Scope 2: transmit local closeout commit `ecaa9ec` plus the immediately resulting exact redirect evidence amendments to the existing `github.com/FanMind/FanMind` repository, create a PR, validate exact-head CI and merge only if green.
- Result: Scope 1 is consumed and verified by FM-EV-029. Scope 2 remains active only for the current closeout branch/PR and does not authorize Store submission/publication, another AAB, push activation, iOS/TestFlight or unrelated external changes.
