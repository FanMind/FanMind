# ChatAdmin: natürliche Antworten mit gebundenem Kontext

## Gemeinsame Antwortqualität — 15. Oktober 2026

Der Owner hat den ursprünglichen Lehrbeispiel-Auftrag auf ganz FanMind erweitert.
ChatAdmin verwendet deshalb dieselbe stilgebundene Grundlage und denselben
konservativen Wiederholungsschutz wie CRM, Creator, Copilot und Mobile-Backend.
Die frühere ChatAdmin-Beispieldatei ist ein Kompatibilitätsalias. Der vollständige
Vertrag, Rechercheabgrenzung, Kosten, Korrekturversuch und Abnahme stehen in
[AI_REPLY_QUALITY.md](AI_REPLY_QUALITY.md).

Verglichen werden nur tatsächlich im gebundenen Modellkontext enthaltene
`confirmed_reply`-Texte. Ungenutzte Entwürfe sind keine Stil- oder Dialogquelle.
Bei einem Qualitätsbefund höchstens ein Korrekturversuch, mit erneutem Zugriff-,
Kontext-, Abschluss- und Ratenlimitcheck und demselben Provider-Zeitbudget.
Beide gestarteten Versuche werden erfasst; bei erneutem Befund keine Generation
persistieren oder aus der verworfenen Generation Fanwissen lernen. Preise und
Character-Grenzen gelten bei jedem Versuch. Kein automatischer Versand und
keine Änderung der gespeicherten Persona.

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


## ChatAdmin: Beschreibung je Artikel — 14. Oktober 2026

Jedes Character-Angebot hat direkt unter seinem eigenen Namen ein optionales
Feld „Beschreibung / enthaltene Leistung“ (maximal 400 Zeichen). Es gehört zum
konkreten Artikel, etwa Foto, Fotoset oder Video, und wird mit dessen Preis und
ID im bestehenden sales_playbook gespeichert. Speichern, erneutes Bearbeiten
und Leeren verwenden dieselbe Character-Revision; keine Migration ist nötig.

Die serverseitig ausgewählte requested_offer enthält diese Beschreibung und die
bereits vorhandenen Liefer-/Exklusivitätsangaben. Die KI darf daraus enthaltene
Leistungen erklären, aber keine fehlenden Mengen, Motive oder Lieferzeiten
erfinden. Beschreibungen sind Daten, keine privilegierten Anweisungen.

Eine kurze Inhaltsnachfrage wie „Was bekomme ich da?“ kann auf den letzten
Fan-Eintrag und die letzte manuell verwendete Antwort Bezug nehmen, wenn beide
dasselbe eindeutige, aktuell aktive und nicht bestätigungspflichtige Angebot
benennen. Nur die letzten 20 gebundenen Dialogeinträge werden betrachtet; beide
Quelleneinträge müssen im tatsächlich übergebenen Kontext bleiben. Ungenutzte
Entwürfe, neue Themen, Mehrdeutigkeit, andere Characters/Fans und Verkaufspausen
geben kein Angebot frei. Preis und Inhalt stammen immer aus dem aktuellen
Artikel, niemals aus früheren KI-Zusagen. Bei fehlender Zuordnung bleibt eine
Rückfrage nötig. Keine Änderung an Astra, Fan-Gedächtnisgrenzen oder Versand.

Automatisierte Formular-/Route-/Kontextprüfungen belegen Speicherung und Bindung;
die Formulierung einer echten Antwort bleibt manuell zu beurteilen.


## ChatAdmin: Verkauf und Ende ohne Antwortschleife — 14. Oktober 2026

Bei einer eindeutigen aktiven Artikelanfrage führt die KI vom belegten Inhalt und
Nutzen über den aktuellen Artikelpreis zu einer kurzen Kaufentscheidung. Kein
Vertrösten durch eine spätere Beziehung, keinen Druck und keine erfundenen
Leistungen. Aufgezeichnete Videos ersetzen niemals Videoanrufe; ein Anruf wird
nur über ein eigenes eindeutig angefragtes aktives Angebot freigegeben.

Eine klare, manuell verwendete Abschlussantwort pausiert weitere KI-Antworten.
Die Route lädt dafür die letzte bestätigte Antwort mit exakter Workspace-,
Character-, Fan- und Conversation-Bindung unabhängig vom 20-Zeilen-Verlauf.
Fan-Nachrichten, ungenutzte Entwürfe, zitierte Beispiele und bedingte Warnungen
lösen keine Pause aus. Die Oberfläche zeigt den Zustand; der Server prüft ihn
vor dem Provideraufruf, vor der Rückgabe und vor weiteren Bestätigungen. Im
pausierten Zustand werden keine neuen Vorschläge, Fan-Fakten oder KI-Aufrufe
erzeugt. Eine während des Provideraufrufs verwendete Abschlussantwort sperrt die
Rückgabe und Speicherung; tatsächlich verbrauchte Usage bleibt erfasst.

Der Owner kann mit „Gespräch bewusst fortsetzen“ gezielt wieder freigeben. Die
Freigabe ist an die bestätigte Antwort-ID gebunden, wird innerhalb des vorhandenen
Fan-Notizformats mit Revision gespeichert und hebt bestehende Verkaufspausen
oder Fan-Grenzen nicht auf. Notizen und gelerntes Fanwissen bleiben erhalten.
Keine automatische Nachricht, kein Blockieren auf OnlyFans und keine Migration.
Astra medium und das begrenzte Provider-Zeitbudget bleiben unverändert.

Erkannt werden explizite Abschlussformulierungen wie „Das Gespräch ist beendet“
oder „Ich antworte nicht weiter“, keine allgemeine Modellklassifizierung jeder
möglichen Formulierung. Allgemeine Natürlichkeit, Verkaufswirkung und semantische
Abwechslung bleiben manuell zu prüfen; ein stärkerer Prompt allein beweist sie
nicht. Historische Testdialoge mit echten Fan-Inhalten werden nicht committed.

## Explizite aktuelle Angebotsablehnung — Sourceumfang 17. Oktober 2026

Der bestehende ChatAdmin-Resolver behandelt alleinstehende deutsche/englische
Negationstokens (z. B. kein/keine, nicht, nichts, ohne, no, not, don't/don’t,
can't, won't) konservativ als Veto gegen jede Angebotsauswahl in dieser
Nachricht. Auch eine nachgestellte Ablehnung und eigene benannte Artikel sind
erfasst. `requested_offer` bleibt null, die erlaubte Artikelliste leer und
Preise bleiben durch den unveränderten Preisvalidator gesperrt.

Gemischte Wünsche wie „Kein privates Foto, aber ein normales Bild“ werden
bewusst nicht in eine vermeintlich sichere Auswahl übersetzt: kein Angebot,
gegebenenfalls Rückfrage. Wortteile wie „No“ in „Nocturne“ lösen kein Veto aus.
Das ist eine begrenzte DE/EN-Tokenregel, keine allgemeine semantische
Negationserkennung. Auch harmlose, zitierte oder anders bezogene Negationen
können konservativ eine Rückfrage erforderlich machen. Formulierungen ohne
diese Tokens und andere Sprachen sind damit nicht vollständig abgedeckt.

Die Regel erzeugt keine persistente Verkaufspause, kein `offer_declined` und
keinen Kauf. Bestehende bestätigte Holds, Cooldowns, Aftercare, Workspace- und
Character-Bindung, Stil und manuelle Sendefreigabe bleiben unverändert. Eine
spätere Inhaltsfrage kann eine vorher abgelehnte Anfrage nicht über den
bestehenden Confirmed-Dialogue-Pfad freigeben. Source implementiert und
synthetisch geprüft; Merge, Staging-Abnahme und produktive Aktivierung sind
getrennte, hier nicht erfolgte Schritte. Phase 7b bleibt offen.
