# Website Chat offene Fragen — Integrations- und QA-Stand (2026-11-03)

- Auftrag: Owner hat die Entwicklung der echten Adminansicht und Tests für offene Website-Chatfragen bestätigt; PR #1410.
- Scope: nur Entwicklungsbranch, keine Produktionsmigration, kein Deployment und keine Aktivierung des Feature-Flags.
- Umsetzung: konservative Antwort-Kandidaten-Erkennung; deduplizierende workspacegebundene SQL-Migration als Entwurf; serverseitige Speicherfunktion hinter standardmäßig deaktiviertem Flag; Plattformadmin-Leseansicht mit expliziter Workspace-ID.
- Schutzgrenzen: Workspacefilter bei Fall- und Nachrichtentext-Abfrage; service_role ausschließlich serverseitig; kein kopierter Frageinhalt in der neuen Tabelle. Plattformadmin-Recht ersetzt keine Mandantenfreigabe für andere Rollen.
- Unvollständig: Statusänderungen, Häufigkeitsgruppierung, vollständige E2E-Tests, Migration-Apply, Deployment.
- CI-Befund: Project Memory Guard fehlgeschlagen, da diese Zustandsänderung noch nicht in Project Memory dokumentiert war. Weitere CI-Jobs beim letzten Abruf noch nicht vollständig.
- Risiko: Klassifikation anhand ausdrücklicher Unsicherheit ist weder vollständig noch semantisch sicher; Datenbank- und Zugriffsregeln vor Aktivierung unabhängig prüfen.
- Nächste Aktion: GitHub CI erneut prüfen und Build-/Security-Befunde korrigieren, anschließend unabhängige QA; geschützte Aktivierung gesondert freigeben.
