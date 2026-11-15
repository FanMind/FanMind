# PR #1282: vorhandenen Fan-Tag-Filter erhalten

Owner-Auftrag: offene PRs konsolidieren, #1531 und Backupworker ausgenommen.
Basis: main b6a2c44a992ad83bea5d608b6e3a90a3c2718627.

Übernommen wird ausschließlich der bestehende funktionale Diff aus c85b22ad559e06f0ddefdffe478e25d7e291d2e8: exakter Tagvergleich, gemeinsame Kanal-/Textfilter, URL-Erhaltung und Rücksetzen, Tagoptionen aus nicht archivierten bereits autorisierten Kontakten, Unit- und synthetischer Browser-Test. Die aktuelle Workspace-/Mitglieds-Autorisierung sowie spätere Main-Änderungen bleiben erhalten. Keine Datenbank-, Provider- oder Runtimeaktion. Veraltete Memory-/Roadmap-Snapshots werden nicht übernommen.

Lokal: 5/5 Filtertests PASS; fokussiertes ESLint PASS. Der bestehende Browser-Test verwendet synthetische HTML-Antworten und ist kein authentifizierter App-/Workspace-End-to-End-Nachweis. GitHub prüft den veröffentlichten Head; kein Merge autorisiert.

CI fand die bestehende zusätzliche Sourcebindung: Der Capacity-Integrationsmanifest hasht package.json vollständig. Dessen einzige Abweichung ist die neue Filter-Testregistrierung. Deshalb wird nur dieser Hash nach Diffprüfung erneuert; alle Capacity-/Transportdateien und Guards bleiben gleich. Kein fachfremder Backupworker-Fix.
