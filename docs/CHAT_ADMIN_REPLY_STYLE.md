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


## ChatAdmin: eigene Angebote — 14. Oktober 2026

Im Character-Editor kann der berechtigte Nutzer mit „+ Angebot“ bis zu 20 eigene
Angebote anlegen, Namen bearbeiten und Angebote entfernen. Name und empfohlener
Preis werden selbst gepflegt; leere Mindest-/Höchstpreise übernehmen den empfohlenen
Preis. Währungen bleiben EUR/CHF/USD/GBP. Erst „Speichern“ übernimmt die Änderungen.
Bestehende IDs, Flags und ergänzende Angebotsdaten bleiben erhalten. Umbenannte
Standardangebote werden als eigene Kategorie geführt, damit der alte Medienname
nicht versehentlich auf einen anderen Inhalt verweist. Leere Preiszeilen bleiben
unveröffentlicht. Die vorhandene Character-gebundene JSON-Speicherung wird verwendet;
keine neue Migration oder Zahlungs-/Upload-/Versandfunktion ist enthalten.

Die KI erkennt wörtliche Angebotsnamen in ausdrücklichen Anfragen oder einer kurzen
reinen Namensanfrage. Mehrere Treffer, doppelte Namen, bestätigungspflichtige oder
inaktive Angebote geben keinen Preis frei. Standard-Medienkategorien bleiben
kompatibel, aber ein öffentliches Video ersetzt keine private Videoanfrage. Bei
fehlender Eindeutigkeit bleibt eine Rückfrage möglich. Preiswächter, Character-/Fan-
Trennung und Speicherverfügbarkeit bleiben wirksam. Diese Erweiterung aktiviert
kein stärkeres Modell und erweitert nicht das automatische Fan-Gedächtnis.

Source-/CI-Nachweise ersetzen keine echte Production-Abnahme mit vom Nutzer
gepflegten Preisen oder eine manuelle Bewertung der Antwortqualität.


## ChatAdmin: stärkeres Modell — 14. Oktober 2026

Der Owner hat ein stärkeres Modell für bessere ChatAdmin-Antworten freigegeben.
Die ChatAdmin-Route verwendet dafür das bestehende serverseitige Profil
„Premium“ aus dem versionierten Provider-Katalog, einschließlich dessen
Standard-Verarbeitungswerten. Für kurze Chatantworten verwendet ChatAdmin
Reasoning „medium“, während das allgemeine Premium-Profil unverändert bleibt. Dies aktiviert keine allgemeinen
bezahlten KI-Stufen, Entitlements oder andere CRM-KI-Pfade. Character-Stimme,
Fanwissen, manuelle Versandgrenze und Preiswächter bleiben unverändert.

Das gemeinsame Tokenlimit beträgt 8192 einschließlich Reasoning; die bestehenden
kurzen Antwort- und Kontextgrenzen bleiben wirksam. Die Provider-Wartefrist ist
auf 55 Sekunden begrenzt. Usage verwendet tatsächliche Provider-Tokens inklusive
Reasoning und Cache sowie den vorhandenen USD-Preiskatalog für diesen ChatAdmin-
Pfad. Fehlende Provider-Usage bleibt als Schätzung erkennbar.

Vor dem Live-Wechsel prüft der geschützte isolierte Release-Weg den bestehenden
Serverzugang durch genau eine begrenzte synthetische Responses-Anfrage mit
store=false und vollständigem synthetischem Fan-/Character-Kontext sowie 20
Gesprächseinträgen über denselben Kontextbuilder wie die Route. Modellbindung, vollständiges Ergebnis, drei Antworten und Preiswächter
müssen bestehen; sonst bleibt der bisherige Release aktiv. Es gibt keinen stillen
Modell-Fallback. Keine Fan-/Character-Daten werden für diese Probe gelesen oder
geschrieben und keine Provider-Inhalte oder Schlüssel protokolliert. Ein erfolgreicher
Probeaufruf belegt API-Zugang und Antwortvertrag, keine allgemeine Qualitätsabnahme.
Echte Natürlichkeit und Gedächtniswirkung sind anschließend manuell zu beurteilen.
