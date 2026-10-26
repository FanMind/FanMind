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


## Mehrere ausdrücklich benannte Artikel — 17. Oktober 2026

Nennt die aktuelle Anfrage mehrere unterschiedliche aktive Artikel, gibt der
Server keinen Artikel/Preis frei, auch wenn ein späterer Privat-/Kategorie-/
Anruffilter nur einen übriglassen würde. Beispiel: „Was kostet Foto oder
Privates Foto?“ bleibt mehrdeutig. requested_offer=null und offers=[] lassen
eine sichere Rückfrage zu; ein dennoch erzeugter Preis wird mit dem vorhandenen
reply_price_not_permitted verworfen, bevor Vorschläge persistiert werden.

Die Zählung verwendet die bestehenden literalen, wortgebundenen Namen desselben
Character-Playbooks. Enthaltene generische Namen (Foto in Privates Foto) zählen
nicht doppelt; Wiederholung desselben Artikels bleibt eindeutig. Eindeutige
Anfragen, Preise aus dem aktuellen Serverdatensatz, Verkaufspausen, Ablehnungs-
Cooldown, Aftercare, historische Quellenbindung, Stil und manuelles Senden
behalten ihre Verträge. Kein Kauf-/Interesse-Score oder Bestätigung wird erzeugt.

Abgeschlossen ist nur diese synthetisch geprüfte Auswahlgrenze. Allgemeine
Kaufabsichts-/Negationserkennung, unbekannte/inaktive Artikel und semantische
Modellantworten sind dadurch nicht vollständig klassifiziert. Insbesondere die
aktuelle Negation bei einer einzelnen Anfrage („Ich möchte kein Foto, nur reden“)
war beim Abschluss von #1336 ein separater Folgeumfang. Der folgende Abschnitt
beschreibt dessen Source-Implementierung in #1337; #1335–#1337 sind inzwischen gemergt.
Reale Modellqualität und geschützte Zielabnahme bleiben offen.

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
synthetisch geprüft und in #1337 gemergt. Aktuelle Staging-Abnahme und produktive
Aktivierung dieser Source sind damit nicht belegt. Phase 7b bleibt offen.


## Kontextbewusste Angebotsnegation — begrenzter Sourceumfang 17. Oktober 2026

Das Veto hat eine enge, deterministische Ausnahme: Die gesamte Nachricht muss
„Nicht schlecht“ + Komma/Punkt/Ausrufezeichen + „Was kostet das [private]
Foto/Video?“ oder „Not bad“ + denselben Trenner + „How much is the [private]
photo/video?“ entsprechen. Groß-/Kleinschreibung und Leerraum sind unerheblich;
das abschließende Fragezeichen ist erforderlich. Es wird kein Nachrichtenteil
entfernt und keine allgemeine Negationsreichweite geschätzt. Anschließend läuft
die vollständige bisherige Namens-/Kategorie-/Mehrdeutigkeitsprüfung auf dem
Originaltext. Bei dieser Ausnahme muss jeder erkannte aktive Artikelname
innerhalb der abschließenden Medienbezeichnung beginnen und bis zum Mediennomen
reichen. Ein Artikelname „Not bad“, „Was kostet das Foto“ oder nur „private“
darf nicht die tatsächlich erfragten Medien ersetzen; solche Kollisionen bleiben
konservativ gesperrt, auch bei nur einem aktiven Artikel. Nur ein bereits
eindeutig auflösbarer, aktiver Artikel ohne Bestätigungspflicht wird freigegeben. Englisches „photo“ ist in diesem
Testumfang ein gespeicherter Artikelname; der Kategorienwortschatz wird nicht
erweitert. Eine Preisfrage allein erzeugt keinen Kauf oder Versand.

„Nicht schlecht“ ohne Preisfrage, zusätzliche oder zitierte Sätze, „Kein Video,
aber ein Foto?“, „No thanks, just chat.“ und „Ich möchte nicht warten. Was kostet
das Video?“ bleiben konservativ ohne Angebot. Auch angehängte Ablehnungen ohne
bisher erkanntes Negationstoken („Ich lehne ab“, „I decline“, „Non merci“)
passen nicht in die ganze Nachrichtenform und erhalten keine neue Freigabe.
Andere Formulierungen/Sprachen werden nicht als vollständig verstanden behauptet.

Gemeinsamer Preisvalidator, kommerzielle Reviews/Holds/Cooldowns/Aftercare,
Workspace-/Character-/Fan-Bindung und manuelle Sendefreigabe bleiben unverändert.
Die vorhandene gemeinsame Antwortqualitäts- und Wiederholungsprüfung bleibt der
einzige Qualitätspfad. Synthetische Policy-/Route-Tests belegen diesen Source-Fix,
keine neue reale Modell-, Staging- oder Production-Abnahme.


## Bestätigte Kommunikationspräferenzen bei Themenwechseln — 17. Oktober 2026

Der bestehende Wissensspeicher verwendet weiterhin denselben Marker in den
Fan-Notizen, höchstens acht Fakten, 4.000 Zeichen und dieselben Quellen-/Sequenz-
prüfungen. Ein belegter Retentionsfehler ließ acht neuere Interessen die ältere
Kommunikationspräferenz verdrängen. Dann fehlte sie in `fan.learned_preferences`
auch bei korrekt gekürztem Verlauf; ein älterer Generation-Retry konnte mangels
neuerer gespeicherter Sequenz wieder eine alte Kommunikationspräferenz eintragen.

Der folgende Absatz beschreibt den Retentionsstand aus #1339. Die anschließende
Dimensionserweiterung ersetzt dessen bisherige Ganzsatz-Ersetzung.

Nur die vorhandene Platzvergabe ändert sich: Schutzgrenzen behalten ihren bisherigen
Vorrang; in den übrigen Plätzen kommt die aktuelle Kommunikationspräferenz vor den
neuesten Interessen. Alter, Quelle und `source_sequence` werden nicht umgeschrieben.
Interessen dürfen bei Platzmangel altern, eine neuere belegte Kommunikationsaussage
ersetzt die bisherige weiterhin nach den bestehenden Sequenzregeln. Acht bereits
gespeicherte Schutzgrenzen werden auch für eine neue Kommunikationspräferenz nicht
verdrängt. Bereits früher verlorenes Wissen wird nicht rekonstruiert.

Die Verlaufskürzung selbst hielt gespeichertes Fanwissen bereits separat vor;
dieser Vertrag bleibt unverändert. Synthetische Tests prüfen leeren, teilweise
und vollständig erhaltenen Verlauf, Themenwechsel, DE/EN, widersprechende manuelle
Notizen/Zusammenfassungen, alte/ungeeignete Quellen und fremde Bindungen. Die echte
Reply-Route erhält die bewahrte Präferenz auch nach Wegfall ihrer Ursprungsnachricht.
Die vollständigen History-IDs bleiben für die atomare Persistenzprüfung erhalten.

Interessen werden durch die bestehenden Promptregeln nur passend zur neuen Frage
verwendet; dieser Fix führt keine neue Relevanzklassifikation ein. Zusammenfassung
und manuelle Notizen bleiben getrennte untrusted Daten, keine Kaufbestätigung oder
automatische Fan-Einstufung. Die kleine Lernwortliste wird nicht erweitert.

Character-Stimme, Preis-/Angebotswächter, Holds/Cooldowns/Aftercare, Isolation,
manuelle Freigabe und der gemeinsame Wiederholungs-/Qualitätspfad bleiben gleich.
Keine zusätzlichen Provideraufrufe, kein neues Kontextfeld oder größeres Limit,
keine Migration und keine Änderung produktiver Notizen. Tests mit Providerersatz
belegen Erhalt und Übergabe des Wissens, keine allgemeine Garantie für kurze,
emoji-freie oder semantisch natürliche echte Modellantworten. Dafür bleibt die
separate reale Mehrturn-Bewertung nach autorisiertem Deployment erforderlich.


## Kommunikationspräferenzen zusammenführen — 17. Oktober 2026

Der vorhandene Lernpfad unterscheidet innerhalb seiner begrenzten DE/EN-Grammatik
Länge (kurz/lang), Stil (direkt/locker/freundlich) und Emojis (mit/ohne).
Unabhängige Dimensionen bleiben gemeinsam bestehen; innerhalb einer Dimension
ersetzt die neuere bestätigte Aussage die bisherige. Die Stilwerte gehören zum
bestehenden einzelnen Adjektivplatz und gelten hier als gegenseitige Updates,
nicht als allgemeine sprachwissenschaftliche Gegensätze.

Ein Teilkonflikt verwirft nicht mehr den gesamten früheren Satz. Aus
„Ich mag kurze Antworten ohne Emojis.“ und später „Ich mag lange Antworten.“
bleibt „ohne Emojis.“ mit unveränderter alter Quelle/Sequenz erhalten; daneben
steht die neu bestätigte Längenpräferenz. Wird nur die Emoji-Präferenz geändert,
bleibt der wörtliche Präfix „Ich mag kurze Antworten“ ohne erfundenen Schlusspunkt.
Dasselbe gilt für englische Quellen. Vollständig unabhängige Fakten bleiben
unverändert. Es werden keine Sätze zusammengesetzt, Quellen umgebunden oder neuen
Dimensionen aus Freitext erschlossen. Die bestehende v1-Struktur erhält kein Feld.

Die eng verankerte Wortliste unterstützt dafür zusätzlich die eigenständigen
Klauseln „Mit Emojis“, „With emojis“ und „Without emojis“; diese Bedeutungen waren
bereits in zusammengesetzten Aussagen unterstützt. Keine freie Paraphrase,
Negation oder sensible Begründung wird dadurch lernbar. Nicht von dieser
Grammatik abgedeckte gespeicherte Altsätze behalten bei einem bestätigten Update
die bisherige konservative Ganzsatz-Ersetzung; keine erfundene Teilinterpretation.

Der globale ältere-Kommunikation-Veto bleibt bestehen: Ein älteres Ereignis wird
auch dann nicht nachgetragen, wenn es eine bislang fehlende Dimension enthalten
könnte. Restzitate behalten deshalb ihre ursprüngliche Sequenz. Fehlende oder
ungeeignete Quellen, abweichende Zitate und Entwürfe erzeugen kein Wissen. Die
reale Route verlangt weiterhin eine gespeicherte passende Inbound-Nachricht mit
sicherer Sequenz, erneute Autorisierung und revisionsgebundene Speicherung.

Schutzgrenzen behalten Vorrang. Selbst identischer Kommunikationstext darf eine
bestehende Schutzgrenze nicht durch Entdoppelung in Kommunikation umwandeln.
Danach bleiben Kommunikationsfakten vor Interessen erhalten. Bei sieben bereits
gespeicherten Schutzgrenzen passt nur ein Kommunikationsfakt; bei acht keiner.
Reicht der Platz nicht für getrennt belegte Dimensionen, bleibt die bestehende
Begrenzung mit den zuletzt gehaltenen Kommunikationsfakten maßgeblich. Es werden
keine Quellen verschmolzen, keine Grenzen geopfert und keine Fakten außerhalb
des Acht-Fakten-/4.000-Zeichen-Limits gespeichert. Bereits verlorenes Wissen wird
nicht rekonstruiert. v1-Notizen sind ohne Migration lesbar und schreibbar.

Character-Stimme, Kontextfelder/-limits, Quellenbindung/Isolation, manuelle
Versandfreigabe, gemeinsamer Qualitäts-/Wiederholungsschutz und sämtliche Preis-,
Angebots-, Hold-, Cooldown- und Aftercare-Regeln bleiben erhalten. Keine zusätzlichen
Provideraufrufe oder Datenbankaktionen. Synthetische Tests belegen die deterministische
Zusammenführung und Kontextübergabe; reale Modellbefolgung bleibt separat offen.


## Expliziter Widerruf gelernter Interessen — 18. Oktober 2026 (Draft, noch nicht abgenommen)

Eine eindeutig zuordenbare neue Fan-Aussage wie „Ich mag Musik nicht mehr.“ oder „I don't like music anymore.“ wird im bestehenden v1-Kontaktwissen als quellengestützte, datierte Reihenfolge-Aussage gespeichert. Der ältere positive Eintrag für dasselbe Thema wird im bestehenden acht Fakten umfassenden Speicher verdrängt; der originale negative Wortlaut bleibt als aktuellere Aussage erhalten. Die echte ChatAdmin-Route lernt weiterhin erst nach erfolgreicher Antwortgenerierung, autorisierter Speicherung der zugehörigen eingehenden Nachricht und erneuter Quellen-/Workspace-/Character-/Fan-Prüfung. Kein zweiter Speicher und keine Schemaänderung.

Nur ausdrücklich benannte, im bisherigen engen Interessenvokabular enthaltene Themen werden erkannt. „Das stimmt inzwischen nicht mehr“ ohne Bezug wird nicht automatisch ausgelegt. Verspätete ältere Generationswiederholungen dürfen neuere widersprechende Interessen nicht wiederherstellen. Ein späteres eindeutiges neues positives Interesse kann eine ältere negative Aussage ablösen. Ein zusammengesetzter alter Interessen-Fakt wird bei Teilwiderruf vorsichtshalber ganz entfernt, statt eine niemals so geäußerte Restbehauptung zu erfinden. Kommunikationspräferenzen und Schutzgrenzen bleiben unabhängig. Bei Überfüllung gilt weiterhin das acht-Fakten-Limit; ältere positive Fakten werden vor expliziten Widerrufen und Kommunikationspräferenzen entfernt. Mehr als acht konkurrierende schutzwürdige Einträge können nicht unbegrenzt vorgehalten werden.

Test-first: isolierter Regressionstest-Commit auf eigenem Branch vor Laufzeitänderung. Die unabhängige vollständige API-/CI-/Runtime-Abnahme steht bis zur Veröffentlichung und Prüfung des PR-Heads ausdrücklich aus. Keine Aussage über echte Modellhäufigkeit, keine Anti-Rückfrage-Featureabnahme von PR #1341, kein Auto-Senden, Provideraufruf, Merge, Deploy oder Datenbank-Apply. Recovery: geprüfter Repository-Revert vor einer späteren Freigabe.


### Fortgeschriebene Gegenprüfung — 18. Oktober 2026

Die frühere Draft-Beschreibung oben ist keine Abnahme. PR #1342 bleibt PARTIAL:
`I do not like music anymore`, typografisches `don’t` und explizites deutsches
`liebe/bevorzuge ... nicht mehr` werden zusätzlich erkannt. Spätere Sätze desselben
Quellereignisses lösen überlappende frühere Aussagen ab, ohne Teilzitate zu erfinden.
Die drei Extractor-Plätze priorisieren Schutzgrenzen und danach Widerrufe vor
weiteren Aussagen, behalten dabei die ursprüngliche Satzreihenfolge. Mehr als drei
konkurrierende Fakten/Widerrufe derselben Nachricht werden nicht vollständig gelernt.

Gegen Wiederauferstehung eines verdrängten Widerrufs werden Interessenupdates unter
der höchsten erhaltenen Faktensequenz konservativ abgewiesen. Dadurch können auch
verspätete neue unabhängige Interessen entfallen. Dies ist keine unbegrenzte Historie.
Bei 4.000-Zeichen-Überlauf bleibt der alte Stand unverändert, die Route meldet
`not_saved`. Manuelle Notizen werden niemals automatisch gekürzt; ein Widerruf kann
in diesem Zustand weiterhin fehlen. Ohne weiteren freigegebenen Speicherkonflikt-
Entscheid ist die universelle Persistenzanforderung nicht erfüllt.

Tests laufen direkt in der bereits verpflichtend registrierten Knowledge-Suite;
der separate Testdateiname wird entfernt, package.json bleibt bytegleich zum
frisch überprüften GitHub-main. Geschützte Capacity-Prüfsummen/Workflows bleiben
unverändert. Synthetische tatsächliche Routeprüfungen belegen autorisierte
Persistenz, Replay/CAS/Fehlerpfade und den nächsten Modellkontext ohne History.
Sie belegen keine tatsächliche Modellbefolgung oder Production-/Staging-Abnahme.

## Bekannte Angaben: aktueller Diagnoseabschluss — 26. Oktober 2026

Die in #1341 beobachtete Datenambiguität ist für den vorbereiteten Current-Facts-Pfad
behoben: positive und ausdrücklich widerrufene Interessen sind quellgebunden,
geordnet und im Modellkontext unterscheidbar; ein aktueller Topic-Fakt verdrängt dort
einen älteren Legacy-Fakt desselben Themas. Die Funktion bleibt jedoch default-off
und uninstalled.

Davon unabhängig prüft der gemeinsame Antwortqualitätswächter Wiederholung und Form,
aber keine semantische Übereinstimmung einer Rückfrage mit Current Facts. Aktuelle
synthetische Routefälle charakterisieren daher weiterhin die Akzeptanz einer
redundanten breiten Frage. Zulässige Detailfragen und manuelle/unbestätigte Notizen
bilden die Gegenkontrollen. Keine neue Laufzeitregel, kein Provideraufruf, kein
automatisches Senden und keine Aktivierung werden aus dieser Diagnose abgeleitet.
