# Gemeinsame Antwortqualität für FanMind

Owner-Auftrag vom 15. Oktober 2026: Natürlichkeit, professionelle Gesprächsführung
und weniger Wiederholungen gelten für ganz FanMind, jeweils im freigegebenen
Stil des Creators bzw. Workspaces. Kein einheitlicher Ton für alle Accounts.

## Abdeckung

| Oberfläche | Produktiver Antwortpfad |
| --- | --- |
| Fan-/Kundendetail, Creator-CRM, angebundene Gesprächskontexte | `/api/ai/reply-suggestions` |
| Copilot | re-exportiert denselben Handler über `/api/copilot/reply` |
| Mobile | verwendet denselben allgemeinen Backend-Handler |
| ChatAdmin mit bzw. ohne persistente Fans | `/api/chatadmin/reply-suggestions` |

Das sind die beiden produktiven Antwort-Providerpfade des geprüften Standes.
Analyseberichte, Kampagnenvorschauen und reine Website-Chat-Ingestion sind keine
zusätzlichen Antwortgeneratoren. Diese Änderung aktiviert keine Roadmap-Kanäle,
Website-AI, Mobile-Veröffentlichung oder anderen Creator-Rollout.

## Gemeinsame Grundlage

`src/lib/replyQualityPolicy.mjs` enthält dieselben Schreibregeln und acht
originale synthetische Miniaturen für beide Pfade. Die bisherige
`chatAdminDialogueGuidance.mjs` exportiert nur noch den Kompatibilitätsalias.
Beispiele sind Orientierung je Anfrage, kein dauerhaftes Modelltraining,
keine private ChatGPT-Konfiguration und keine neuen Fan-/Artikel-Fakten.

Die freigegebene Creator-/Character-Stimme bestimmt Sprache, Anrede, Länge,
Emojis, Wortschatz, Humor und Grenzen. Ohne Creator bleiben autorisierte
Workspace-Hinweise maßgeblich. Höchstens eine nötige Rückfrage, konkrete
Antworten statt Standardfloskeln, bekannte Vorlieben passend aufgreifen und
keine erfundenen Erlebnisse. Humor ist situations- und stilabhängig. Menschlich
formulieren erlaubt keine falschen Aussagen über KI oder Identität.

Der allgemeine Gesprächskontext priorisiert jetzt die neuesten vollständigen
Beiträge innerhalb desselben vorhandenen Zeichenbudgets, statt den Anfang
eines ältesten-zuerst-Verlaufs abzuschneiden. Ein nicht passender zu langer
neuer Beitrag wird nicht mittendrin als vollständige Nachricht ausgegeben;
die aktuelle eingehende Nachricht bleibt separat im Kontext.

## Prüfung und begrenzte Korrektur

1. Bestehende Auth-, Workspace-, Creator-/Character- und Kontextbindung laden.
2. Drei strukturierte Vorschläge mit der bestehenden Modellwahl erzeugen.
3. Den jeweiligen bestehenden Preis-/Creator-Vertrag prüfen, bei jedem Versuch.
4. Konservativ auf mechanische Wiederholung prüfen: normalisierte identische
   Varianten, sehr ähnliche lange Texte und wiederkehrende ausgewählte
   Standard-Einstiege. Lange Nähe bedeutet mindestens 80 normalisierte Zeichen,
   zwölf Wörter und mindestens 0,90 Jaccard-Ähnlichkeit der Wortmengen.
   Unterschiedliche Zahlen oder Negationen werden nicht als bloß stilistisch
   gleichgesetzt. Kurze Sachantworten dürfen im Verlauf wiederkehren.
5. Historischer Vergleich ausschließlich mit höchstens sechs tatsächlich
   ausgehenden/`confirmed_reply`-Texten im bereits autorisierten und tatsächlich
   ans Modell übergebenen Kontext. Keine eingehenden Nachrichten, ungenutzten
   KI-Entwürfe, globale Fanlisten oder Account-übergreifenden Stilpools.
6. Bei einem Qualitätsbefund höchstens einmal überarbeiten. Verworfene Texte
   sind getrennt markierte `previous_drafts`, keine bestätigte Unterhaltung und
   keine Faktenquelle. Grundkontext, Modell, Grenzen und JSON-Schema bleiben
   gleich. Das zusätzliche Feedback muss mit dem Grundkontext unter dem
   bestehenden 80.000-Zeichen-Limit bleiben; Systemanweisungen sind separat.
7. Vor einem zweiten Aufruf erneut Autorität und Creator-Kontext prüfen;
   ChatAdmin prüft auch aktuellen Verlauf, letzte bestätigte Antwort und Pause.
   Ein zweiter Slot im bestehenden Ratenlimit ist nötig. Beide Aufrufe teilen
   dasselbe AbortSignal und dasselbe ursprüngliche Provider-Zeitbudget.
8. Provider-, Transport-, Preis- oder Validierungsfehler werden nicht automatisch
   wiederholt. Ein zweiter Qualitätsbefund wird mit verständlicher Fehlermeldung
   verworfen. Keine Wiederholungsschleife, kein schwächeres Ersatzmodell und kein
   ungeprüfter Ersatztext.
9. Erst akzeptierte Vorschläge dürfen die bestehende ChatAdmin-Persistenz und
   das Lernen aus der aktuellen eingehenden Nachricht erreichen. Die erneuten
   Autoritäts-/Kontextprüfungen vor Rückgabe bzw. Persistenz bleiben wirksam.

## Kosten und Datenschutz

Normalfall ein Provideraufruf; bei einer erkannten Wiederholung höchstens zwei.
Jeder tatsächlich gestartete Aufruf verbraucht den bestehenden Rate-Limit-Slot
und erhält genau ein bestehendes Usage-Ereignis, auch bei verworfener Antwort.
Tatsächliche Provider-Tokens werden pro Versuch erfasst. Schätzungen enthalten
jetzt Systemanweisungen und gegebenenfalls Korrekturfeedback. Ein vor dem zweiten
Provideraufruf verlorener Zugriff erzeugt keinen fiktiven zweiten Usage-Eintrag.
Provider-Erfolg ist keine Versand- oder Gesprächsqualitätsbestätigung.

Keine Änderung an Preisen, Entitlements, Capacity-/Stripe-Verträgen, Datenbank,
Modellprofilen oder Berechtigungen. Worst case können zwei Aufrufe Kosten
verursachen; Timeout und Ratenlimit werden nicht verdoppelt. `store:false`,
serverseitige Schlüssel, bestehende Isolation und manueller Versand bleiben.
Usage enthält Zähler/Fehlercodes, keine Prompts, Rohantworten oder privaten Chats.

## Recherche und Grenzen

Die bisher geprüften [OnModel-Demonstrationen](https://onmodelstudios.com/blog/onlyfans-chatting-scripts)
und [Anlora-Szenarien](https://meetanlora.com/onlyfans-chat-scripts) betreffen
Creator-Verkauf. Als breitere Referenzen wurden die Primärbeschreibungen von
[Google Taskmaster](https://research.google/blog/announcing-two-new-natural-language-dialog-datasets/)
und [MultiWOZ](https://github.com/budzianowski/multiwoz) geprüft: aufgabenbezogene
Dialoge und Präferenzklärung statt nur pauschaler Kontaktpflege. Taskmaster
unterscheidet echte Zwei-Personen-Rollenspiele und geschriebene Selbst-Dialoge.
Diese sind keine privaten ChatGPT-Verläufe oder Belege für FanMind-Verkaufserfolg.
Es wurde kein fremder Chat-Korpus importiert oder als Creator-Stimme gespeichert;
die Runtime-Beispiele sind eigenständig verfasst.

Der Wächter ist keine allgemeine semantische Wiederholungs- oder
Natürlichkeitsgarantie. Er erkennt weder jede Paraphrase noch zuverlässig jeden
unpassenden Witz, Stilbruch oder erfundenen Inhalt. Ein Kurzantwort- oder
Faktenvergleich darf nicht behaupten, professionelle Gesprächsqualität bewiesen
zu haben. Bestehende Artikel- und Wahrheitsgrenzen bleiben eigenständig nötig.

## Nachweis und weitere Abnahme

Automatisierte synthetische Tests führen die echten Handler mit einem lokalen
Providerersatz aus: sauberer Einmalaufruf, Korrektur, zweimalige Ablehnung,
zweiter Preisfehler, Rate-Limit, Freigabeentzug, Profilwechsel, Gesprächsabschluss,
Abbruch, unverändertes Zeitbudget, Usage je Versuch und keine Persistenz/kein
Fanlernen aus verworfenen Generationen. Separate Fälle prüfen lange Verläufe,
eingehende gegenüber ausgehenden Quellen und kurze notwendige Sachwiederholungen.
Das sind technische Regressionen, keine als gut bewerteten echten Modellchats.

Nach getrenntem Deployment sind neue Mehrturn-Dialoge zu bewerten: Beratung,
Service, Reklamation, Kompliment, Kaufanfrage, Einwand, Absage, Erinnerung,
Themenwechsel, KI-Frage, Grenze und Gesprächsende; jeweils mit unterschiedlichen
freigegebenen Stilen und mindestens Deutsch/Englisch. Rohtexte echter Bewertungen
bleiben gemäß `docs/operations/AI_REPLY_QUALITY_EVAL.md` außerhalb Git. Bewerten:
konkrete Antwort, Kontinuität, Stimme, unnötige Wiederholung, richtige Fakten,
passender nächster Schritt und Druckfreiheit. Keine erfundenen Qualitätsnoten.

Recovery: geprüfter Source-Revert auf den vorherigen Stand, ohne Migration oder
Kundendaten-Reparatur. Bereits angefallene Providerkosten und Usage-Ereignisse
werden nicht rückgängig gemacht. Technische CI, Quellprüfung und Merge ersetzen
weder ein Deployment noch die manuelle Modellbewertung.


## Fanpräferenzen unter Speicherdruck — 17. Oktober 2026

Die vorhandene ChatAdmin-Wissensretention hält jetzt nach den Schutzgrenzen die
quellbelegte Kommunikationspräferenzen vor zusätzlichen Interessen fest.
Das verhindert deren Verlust bei Themenwechseln vor der bereits bestehenden
Kontextkürzung. Unabhängige Länge-/Stil-/Emoji-Aussagen werden im bestehenden Wissenspfad
zusammengeführt; bei Teilkonflikten bleiben nur wörtlich belegte Restklauseln.
Struktur, Limits, Quellenordnung, Character-Stimme und die gemeinsame
Qualitäts-/Wiederholungsprüfung bleiben unverändert; kein zweiter Outputwächter,
keine neue Memory und kein zusätzlicher Provideraufruf. Vertrag und Grenzen:
[ChatAdmin Reply Style](CHAT_ADMIN_REPLY_STYLE.md#bestätigte-kommunikationspräferenzen-bei-themenwechseln--17-oktober-2026).
Synthetische Tests beweisen Kontextübergabe und Schutzregeln, keine semantische
Befolgung durch ein reales Modell. Echte Mehrturn-Qualitätsabnahme bleibt offen.

## Bekannte Fanangaben: begrenzter Current-Facts-Guard — 30. Oktober 2026

Der ChatAdmin-Fanpfad kann dem gemeinsamen Qualitätswächter optional bereits
validierte Current-Interest-Fakten übergeben. Das geschieht nur bei aktiviertem
bestehendem Current-Facts-Flag und nach der vorhandenen Workspace-/Character-/Fan-/
Conversation-Bindung. Legacy- oder manuelle Notizen und bloße Vorschläge erhalten
dadurch keine höhere Autorität.

Der Wächter lehnt ausschließlich eine endliche DE/EN-Liste breiter Grundsatzfragen
zu einem passend validierten positiven oder negativen Interesse ab, etwa „Magst du
Musik?“ oder „Do you like music?“. Das gilt auch, wenn die gesamte normalisierte
Antwort exakt aus höchstens einem erlaubten neutralen Präfix, der exakten Frage
und höchstens einem erlaubten neutralen Suffix besteht. Erlaubte Präfixe sind
leer, „Danke!“, „Alles klar.“, „Thanks!“ und „All right.“; erlaubte Suffixe sind
leer, „Danke!“ und „Thanks!“. Zusätzliche Sätze, Detailfragen, ausdrückliche
Änderungs- oder Rekonfirmationsfragen, Zitate, Hypothesen und unbekannte Themen
bleiben zulässig; es gibt kein Substring-, Satzsplit- oder NLP-Matching.
Der Befund ist terminal: Ein frischer Modelloutput erzeugt genau ein Usage-Ereignis,
keinen Quality-Rewrite und keine Persistenz oder Memory-Aktualisierung. Ein Cache-
Replay wendet dieselbe Sperre vor Memory/Persistenz an und erzeugt keinen neuen
Provider- oder Usage-Schritt.

Bei deaktivierten Current Facts, im Character-only-Pfad und bei allgemeinen
Reply-Quality-Aufrufen ohne Faktenargument bleibt das bisherige Verhalten unverändert.
Die Duplicate-Rewrite-Grenze bleibt separat bestehen. Current Facts bleiben
default-off; die synthetischen Tests sind keine reale Modell-, Provider- oder
Produktionsabnahme.
