# ChatAdmin: natürliche Antworten mit gebundenem Kontext

Ein kurzes Foto-Kompliment wurde bisher durch bloße Medien-Schlüsselwörter einem
Verkaufsangebot zugeordnet. Außerdem enthielt der KI-Verlauf die drei unbenutzten
Alternativen früherer Generationen. Das konnte Verkaufsdruck und Wiederholungen
begünstigen. Der Server hält solche Alternativen jetzt aus dem Modellkontext heraus
und gibt bei reinen Medien-Komplimenten keinen Angebotspreis frei.

## Bestehende Character-Felder

| Feld | Wirkung |
| --- | --- |
| Schreibstil und Satzstil | Wortwahl, Länge und Form aller drei Alternativen |
| Emoji-Stil | Character-spezifischer Einsatz, keine Emoji-Pflicht |
| Typische Phrasen und Beispiele | Orientierung, keine wiederkehrenden Bausteine |
| No-Gos | Grenzen für alle Varianten, auch die direkte |
| Flirt-/Kommunikationsstil | Passende Nuance innerhalb der bisherigen Dynamik |
| Zusätzliche Verkaufsregeln | Anlass und Grenzen; kein Ersatz für strukturierte Preise |

Die Vorschläge sind einzelne Alternativen, kein dreiteiliger Dialog. Eine Antwort
darf ohne Frage enden. Die direkte Variante wird nicht automatisch intimer oder
verkäuferischer. Bekannte Fan-Fakten sollen nicht erneut erfragt oder aufgezählt
werden. Keine künstlichen Tippfehler, Dringlichkeit oder erfundenen Zusagen.

## Gedächtnis und Preise

- Die bestehenden Workspace-/Character-/Fan-/Conversation-Prüfungen bleiben vor
  der Kontextfilterung wirksam, auch für ausgeschlossene Entwürfe.
- Nur `fan_inbound` und `confirmed_reply` gelangen in `recent_messages`. Die
  letzten vollständigen Nachrichten passen weiterhin in das kanonische Limit.
- Die vollständige gespeicherte History mit Entwürfen bleibt Basis der atomaren
  Persistenzprüfung. Zusammenfassung und Notizen bleiben separat gebunden.
- Reine positive Medien-Kommentare wie ein Foto-Kompliment liefern
  `requested_offer=null`. Eine ausdrückliche Preis-/Medienanfrage mit Kompliment
  und kurze Kategorienanfragen behalten die bisherige Offer-Auswahl.
- Die Kompliment-Erkennung ist eine begrenzte deutsche/englische Heuristik,
  keine allgemeine Sprach- oder Kaufabsichtserkennung. Die Promptregeln ergänzen
  sie; eine erlaubte Offer-Auswahl erzwingt keine Preisnennung.
- Ausschließlich der gespeicherte empfohlene Preis des gebundenen aktiven,
  nicht bestätigungspflichtigen Angebots darf genannt werden. Der bestehende
  serverseitige Preiswächter bleibt unverändert.

## Abnahme

Die Tests prüfen Entwurfs-Ausschluss trotz begrenztem Kontext, erhaltene Fan-Fakten,
Cross-Character-Abweisung vor Filterung, vollständige History-IDs an der echten
Reply-Route und Komplimente gegenüber ausdrücklichen Angebotsanfragen.

Keine gespeicherte Persona wird durch die Source-Änderung überschrieben. Sie gilt
für die aktuell ausgewählte Character-Stimme. Sie erstellt keine Verbindung zu
OnlyFans und sendet keine Nachricht. Es gibt keine Schema-/Capability-Aktivierung.
Live-Qualität muss nach Deployment anhand mehrerer echter manueller Gesprächsturns
bewertet werden; lokale Tests belegen keine Natürlichkeit eines Modelloutputs.

Der separate Vier-Angebote-Staging-Harness wird in diesem Task nicht verändert.
Sein Lauf `38306814508` auf `613e452ced0105da4c718b3d4aafb30f77c88ff4` scheiterte
am 12. Oktober 2026 bei `offers_reload_close`; auch der automatische Recovery-Schritt
war rot. Dies bleibt fehlgeschlagene Runtime-Evidence, keine erfolgreiche Abnahme.


## ChatAdmin-Korrektur nach manuellem Production-Test — 14. Oktober 2026

Der Character-Editor zeigt den Preisbereich auch bei fehlgeschlagener
Serverprüfung an. In diesem Fall sind die Preise gesperrt und eine Meldung nennt
die ausstehende Speicherverfügbarkeit; die Prüfung wird nicht umgangen.
Bestehende Angebote werden beim Speichern anderer Character-Felder erhalten.
Es werden keine neuen Verkaufskategorien oder automatisch erfundene Preise angelegt.
Die Antwortanweisungen bevorzugen kurze Alltagssprache, erhalten passendes
spielerisches Necken und verbieten routinemäßige Bewertungen der Fan-Formulierung
sowie erfundene aktuelle Tageszeit-/Tätigkeitsbezüge. Historische Zeitstempel
belegen keine aktuelle lokale Zeit. Automatisches Fanwissen bleibt auf explizite
ausgewählte Interessen, Antwortvorlieben und Grenzen begrenzt; freie Angaben
können manuell in Notizen gepflegt werden.
Diese Quellkorrektur ist kein Nachweis funktionierender Production-Preisspeicherung
oder natürlicher Modellantworten; dafür sind ein authentifizierter
Server-/Schemaabgleich und anschließende echte manuelle Gesprächstests erforderlich.
