# Bestehende Admin-Gruppe #1411 / #1412 / #1413 / #1414

Owner-Auftrag: vorhandene Entwicklung konsolidieren, keine SQL-Anwendung; #1531 und Backupworker ausgenommen. Basis main b6a2c44a992ad83bea5d608b6e3a90a3c2718627.

Alle vorhandenen Bestandteile werden unverändert fachlich wiederverwendet:
- #1411 Status-/Audit-/Retention-Entwurf und Redaktions-/Gruppierungsregressionen;
- #1412 Admin-Oberfläche und bestehende Browserregression;
- #1413 native PG17-Retention-/Rollback-Beweisführung;
- #1414 ausschließlich lesendes, fail-closed geprüftes Exzerpt-Derivat mit eigenem PG17-Beweis.

Der bisherige Stack 1411 -> 1412 -> 1414 und der parallele 1413 -> 1411-Beweis werden in #1414 gegen Main zusammengeführt. Konflikt docs/operations/ai-capacity-staging-integration.json: neuere Main-Evidence vollständig erhalten; ausschließlich package.json-Checksumme nach überprüfter Testregistrierung erneuert. Workflow-Konflikt: beide PG17-Beweisschritte erhalten, keine Prüfung entfernt. Keine neue Medien-/Billing-/Backupfunktion, keine SQL-/Staging-/Production-Aktion.

Lokal: 34/34 fokussierte Gruppierungs-, Redaktions-, Review-, Privacy-, Retention-Policy- und CI-Abdeckungstests PASS; next typegen + tsc --noEmit PASS. Historische native PG17-/Browsernachweise bleiben historische Evidence; der neue Head muss seine vorhandenen GitHub-Schritte bestehen. Lokal keine neue Datenbank und kein Staging-Zugriff.

DRAFT / NO_MERGE bleibt verbindlich: erneute SHA-gebundene unabhängige Delta-Prüfungen (historische Conditional-PASS bleiben erhalten) und tatsächliche geschützte Retention-/Isolationsabnahme A1-A7 bleiben offen; bestehende Executor-Readiness ist BLOCKED. Kein Review-Schreibpfad/Importierer neu entwickelt: ohne zulässig erzeugte aktuelle Freigabederivate bleibt der Exzerptpfad leer/fail-closed. Keine alte Freigabe als Fallback, kein Rohtext im DTO, kein Completeness-/Population-Claim aus dem begrenzten Fenster.

Die drei enthaltenen Eltern-/Beweis-PRs können als konsolidiert geschlossen werden, sobald der neue #1414-Head samt vollständigem Inhalt unabhängig zurückgelesen ist. Das überträgt die obigen offenen Grenzen auf den verbleibenden Draft und erteilt keine Merge-, Schema- oder Runtimefreigabe.

CI-Integration: Retention-Beweis steht entsprechend dem vorhandenen #1413-Isolationsvertrag zuerst; anschließend Exzerpt-Beweis, danach unveränderte Authorization-/Capacity-/Creator-Roundtrips. Jeder vorhandene PG17-Harness hält seine eigene DB-/Rollencleanup-Grenze. Push nach Retarget auf main bindet die fehlenden Pflichtworkflows auf den endgültigen integrierten Head; kein manueller unveränderter Rerun.
