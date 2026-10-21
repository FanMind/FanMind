# Getrennte Produkt-Roadmaps — Owner-Entscheidung 21.10.2026

## Verbindliche Abgrenzung
- **Öffentliche FanMind-Roadmap**: ausschließlich FanMind-Produktfunktionen. Quelle: `src/config/roadmap.ts`; dargestellt auf Landingpage, /roadmap und in der Admin-Roadmap. Kein ChatAdmin-Entwicklungsstatus, keine ChatAdmin-Hakerl auf der Landingpage.
- **Interne ChatAdmin-Roadmap**: eigenständiger Entwicklungsstrang, siehe unten. Nicht in die öffentliche FanMind-Roadmap einspeisen.
- Geteilte technische Komponenten bleiben möglich, erzeugen aber keine pauschale gegenseitige Release-Abhängigkeit. Echte technische Abhängigkeiten ausdrücklich dokumentieren.
- Keine Umbenennung einer ChatAdmin-Funktion in eine angebliche FanMind-Funktion; keine Verkaufs-/Live-Freigabe aus bloßer CI ableiten.

## Statuslogik
- DONE: klar abgegrenzte Arbeit mit Beleg abgeschlossen (nicht automatisch produktiv).
- TESTED: nachweislich getestet, Zielaktivierung ggf. offen.
- LIVE: Zielumgebung tatsächlich aktiviert und abgenommen.
- SALES_READY: echte Verkaufs- und Vertrags-/Zahlungsvoraussetzungen erfüllt.
- PARTIAL / BLOCKED / LATER: offen, extern blockiert oder bewusst zurückgestellt.

## FanMind — öffentliche Roadmap / interne Abschlussabgrenzung
- Phase 1 Produktkern und Phase 2 Import-Basis: bereits in `src/config/roadmap.ts` als erledigt markiert. Bestehende Hakerl beibehalten.
- Phase 4 Produktions-/Billing-Basis: die bestehende Roadmap markiert technische Teilpunkte als erledigt; **nicht** mit uneingeschränkter kommerzieller Freigabe gleichsetzen. Steuer-/UID-/Vertragsbedingungen getrennt behandeln.
- Phase 5: getrenntes Staging, Release-Checks und Governance sind in der Roadmap als erledigt markiert; vollständiger Restore, Registrierung, KI-/Billing-Gesamtabnahme und Security/Meta bleiben PARTIAL.
- Phase 6: signiertes Android-Artefakt DONE; Google-Play-/Geräte- und Push-Zustellabnahme PARTIAL.
- Phase 3 und 7: echte Social-Provider-Verbindungen nicht als LIVE ausgeben; Creator-Teilfunktionen von der externen Kanalabnahme trennen.
- Phasen 8 ff.: als später/teilweise begonnen kennzeichnen, keine vorgezogene Freigabe.

Quellen: #874 (Finishline), #492 (Roadmap-Status), `src/config/roadmap.ts`. Alte Issue-Checklisten und aktuellere Runtime-/Owner-Entscheidungen sind bei Widerspruch getrennt zu prüfen; kein automatisches Grün.

## ChatAdmin — ausschließlich interne Entwicklungsroadmap
| Arbeitspaket | Code/CI | Produktionsstand | Beleg |
| --- | --- | --- | --- |
| Kommunikationspräferenzen nach Dimension | DONE (gemergt) | keine separate Live-Abnahme aus Merge abgeleitet | PR #1339, #1340 |
| Angebots-/Preis- und Negationsprüfungen | DONE (gemergt) | Ziel-/Modellqualität gesondert prüfen | PR #1335–#1338 |
| Fragen nach bereits bekannten Fan-Fakten vermeiden | diagnostiziert, NICHT behoben | OPEN | PR #1341 (Draft) |
| Widerruf aktueller Interessen im bestehenden Notizspeicher | PARTIAL, Tests grün | nicht gemergt / nicht live | PR #1342 (Draft) |
| Dedizierter aktueller Fan-Wissensspeicher | OFFLINE_PROFILE_READY | BLOCKED, nicht installiert / nicht aktiviert | PR #1345 (Draft) |
| Host-/Environment-Evidence für Installation | BLOCKED | keine reale Host-Attestierung | PR #1347 (Draft) |

## Ausführung und Schutzgrenzen
Dieser Roadmap-Abgleich ist Dokumentation, **kein** Merge, Deploy, Schema-Apply, Checkout, Provider- oder Host-Eingriff. Bestehende produktive Funktionen bleiben unverändert. Eine neue Roadmap-Markierung benötigt ihren konkreten Nachweis und den richtigen Produktbereich.
