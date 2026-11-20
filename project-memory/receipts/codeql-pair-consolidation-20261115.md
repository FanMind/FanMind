# CodeQL-Paar #1407 / #1405

Owner-Auftrag: bestehende PRs konsolidieren; #1531 und Backupworker ausgenommen.
Basis: main b6a2c44a992ad83bea5d608b6e3a90a3c2718627.

Nachgewiesene Ursache: Job 132979391568 scheitert an init 4.37.9 / analyze 4.39.3 (Loaded a configuration file for version 4.37.9, but running version 4.39.3). Beide vorhandenen PR-Deltas werden in #1407 auf denselben SHA 33d7b85da1a04171e211befe2c739303b9a4c066 / v4.39.3 gebunden. Berechtigungen, Queries und Trigger bleiben erhalten. Dependabot gruppiert künftig github/codeql-action/*, um das Paar nicht erneut zu trennen. Der bestehende Pin-Regressionstest und der Supply-Chain-Reader werden mitgeführt.

Lokal: 12/12 github-actions-supply-chain Tests PASS; verify-actions-pinned PASS (111 Workflows, 254 Referenzen). GitHub muss den endgültigen Head inklusive echter CodeQL-Analyse bestätigen. Keine Runtime-/Provider-/Datenbankaktion und kein Merge. #1405 darf erst nach unabhängig zurückgelesener vollständiger Übernahme als superseded geschlossen werden.
