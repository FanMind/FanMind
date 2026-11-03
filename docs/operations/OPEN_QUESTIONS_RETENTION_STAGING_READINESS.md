# Open Questions Option A — Staging Executor Readiness

Status: **STAGING_EXECUTOR_READINESS: BLOCKED**

Kein Staging-Lauf gestartet. Dieses Dokument bereitet genau einen späteren, gesondert autorisierten, synthetischen und rollback-only Lauf vor; es ist weder DB-Apply noch Aktivierung.

## Read-back vor dem Lauf

Folgende Werte müssen vor Ausführung durch den tatsächlich berechtigten Executor im PR #1411 zurückgelesen und belegt werden:

- Executor: **nicht in dieser Builder-Laufzeit verfügbar oder nachgewiesen**. Erforderlich ist eine benannte Identität mit Zugriff ausschließlich auf die isolierte Staging-Datenbank.
- Ziel: **noch nicht nachgewiesen**. Erforderlich sind getrennte Staging-API- und DB-Hosts, die beide die Production-Negativbindung der Website-Chat-Staging-Policy bestehen.
- Head: der dann aktuelle stabile PR-Head; \`FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT\` muss exakt diesem SHA entsprechen. Solange der PR ungemergt ist, muss die Laufbindung den tatsächlichen PR-Branch/Ref belegen; \`GITHUB_REF=refs/heads/main\` darf nicht behauptet werden. Ref-/SHA-Read-back bleibt Teil des separaten BT-039-Gates.
- Fixture: workspaceweit genau eine Open-Question-Zeile und genau eine Ursprungsnachricht. Der Workspace trägt \`staging_synthetic_fixture=true\`, \`workspace_processing_acceptance=true\` und \`open_question_retention_acceptance=true\`; die Nachricht trägt \`source_platform=staging_synthetic\`, \`external_message_id=staging-synthetic-open-question:<QUESTION_ID>\` und exakt \`content=open-question-retention-fixture:<QUESTION_ID>\`. Zusätzliche Zeilen oder ein fehlender Marker brechen vor der ersten Mutation ab.
- Secrets: ausschließlich über eine lokale \`PGPASSFILE\` mit Modus \`0600\`; keine Ausgabe in Logs oder PR-Kommentaren.

## Genau ein Ausführungskommando

Nach vollständig positivem Read-back ist für den einen autorisierten Lauf ausschließlich dieses Kommando zulässig:

\`\`\`bash
node scripts/operations/open-questions-retention-staging-acceptance.mjs --run
\`\`\`

Der Wrapper bindet Ziel, Commit, Fixture-IDs und Statuswerte über die bereits dokumentierten Umgebungsvariablen. Keine zweite Ausführung ohne neue, separate Autorisierung.

## Prechecks, Postchecks und Rollback

Prechecks:

1. PR-Head stabil und vollständige CI grün.
2. Executor, isoliertes Ziel und Production-Negativbindung positiv zurückgelesen.
3. Synthetische Fixture exakt; keine Kunden- oder Produktionsdaten.
4. Source-Check: \`node scripts/operations/open-questions-retention-staging-acceptance.mjs --check\`.
5. Passfile vorhanden, reguläre Datei, Eigentümer = Executor, Modus \`0600\`.

Der SQL-Harness prüft vor jeder temporären oder fachlichen Mutation die exakt-eine markierte Fixture. Danach persistiert er vollständige JSONB-Baselines der Ziel-Question, Ursprungsnachricht, aller zugehörigen Auditzeilen und aller fremden Question-/Audit-/Message-Zeilen sowie die ACLs von \`workspaces\`, \`conversation_messages\`, \`website_chat_open_questions\` und \`website_chat_open_question_audit_events\`. Er installiert das kontrollierte Option-A-Delta nur in seiner Testtransaktion und prüft Status/Audit, 52→50/Cascade, 30-/180-Tage-Fristen, dokumentierte Verlängerung, 12-/24-Monatsgrenzen, Legal Hold, Vertragsende, Workspace-Isolation und wiederholten No-op. Danach führt er \`ROLLBACK\` aus und bestätigt in einer separaten read-only Transaktion, dass die Ausgangsfixture wieder vorhanden ist.

Erwartete Postchecks:

- alle acht PASS-Marker sowie \`OPEN_QUESTION_RETENTION_TRANSACTION=ROLLED_BACK\`;
- byte-/feldgleich wiederhergestellte vollständige Ziel-Question, Ursprungsnachricht und Auditzeilen;
- feldgleiche Fremd-Workspace-Snapshots für Questions, Audits und Messages;
- exakt unveränderte ACLs aller vier bestehenden berührten Tabellen;
- keine persistierten Tabellen-, Spalten-, Funktions- oder Kontrolldaten aus dem Harness;
- Evidence ausschließlich als redigierte Marker, Run-Zeit, Executor, Zielklassifikation und Commit-SHA im PR.

## Abort-Bedingungen

Sofort abbrechen bei fehlendem oder abweichendem Commit, unbekanntem Executor, nicht isoliertem Ziel, Production-Host/-Projekt, nichtsynthetischen Daten, mehr als einem Fixture-Datensatz, fehlenden Flags, unsicherer Passfile, SQL-/Markerfehler, verbleibendem Schreibzustand oder unklarem Rollback. Danach kein Retry ohne Ursachenanalyse und neue Autorisierung.

## Getrennte Gates

Backup-Runoff bis maximal 90 Tage, externe Rechts-/Rollenprüfung, Kundeninstruktionen und Transparenz bleiben außerhalb des technisch durchsetzbaren Repository-Deltas. Alert 69 sowie unabhängige Retests BT-006/036/051 bleiben separate Nachweise. Merge, Deployment, generisches DB-Apply, Provider-/Produktionszugriff und Feature-Aktivierung sind nicht autorisiert.
