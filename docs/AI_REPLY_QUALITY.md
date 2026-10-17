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
bleiben gemäß `operations/AI_REPLY_QUALITY_EVAL.md` außerhalb Git. Bewerten:
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


## Bekannte Fanangaben erneut erfragen — belegte Grenze, 17. Oktober 2026

Befund-only gemäß Owner-Fallback, **keine neue Laufzeitprüfung implementiert**.
Die vorhandene Anweisung verbietet unnötige Fragen nach bekannten Angaben und
ungefragte Notizaufzählungen bereits. Der gemeinsame deterministische Wächter
prüft jedoch Wiederholungen, nicht die Aktualität oder Bedeutung gespeicherter
Interessen. Die tatsächliche ChatAdmin-Route akzeptiert in synthetischen Fällen
„Magst du Musik?“, „Magst du Reisen?“ bzw. „Do you like music?“ trotz entsprechender
`learned_preferences`. Dies ist eine nachgewiesene ungelöste Lücke, kein Nachweis,
dass echte Modelle diese Fragen regelmäßig erzeugen.

Eine kleine pauschale Interessen-/Fragen-Regex wäre unter den geforderten Grenzen
nicht sicher: Der vorhandene Speicher lernt positive Interessen, aber keinen
quellgebundenen Widerruf durch „Ich mag keine Musik mehr“ oder „Das stimmt inzwischen
nicht mehr“. Nach späteren Themenwechseln oder Kontextkürzung kann dieser neuere
Widerruf fehlen, während das alte positive Interesse weiterhin gespeichert ist.
Tests erzeugen für gültige und widerrufene Interessen **bytegleiche Modellkontexte**
mit derselben Quellenreferenz/Sequenz. Dieselben Eingaben erlauben keine sichere
Unterscheidung zwischen redundanter Rückfrage und sinnvoller neuer Klärung.

Deshalb bleiben Qualitätsprüfung, Provideranzahl und bestehende Retry-Grenze
unverändert, ebenso CRM/Creator/Copilot/Mobile und deren gemeinsamer Contract.
Detailfragen wie „Welche Musik hörst du gerne?“ bleiben zulässig. Manuelle Notizen,
Zusammenfassungen und Vermutungen werden nicht zu bestätigten Interessen erklärt.
Die bestehenden Quellen-, Isolations-, Stil-, Preis-, Angebots- und Versandgrenzen
bleiben erhalten. Insbesondere wird die negative Aussage nicht durch eine erfundene
aktuelle Präferenz ersetzt und altes Wissen nicht allein aufgrund eines Regex-
Treffers als sicher aktuell behandelt.

Der erste reine Testcommit hält die roten Soll-Erwartungen fest; finale Tests
charakterisieren ausdrücklich die bestehende Akzeptanz und die Datengrenze. Ihre
grünen Ergebnisse bedeuten **keine Umsetzung der Anti-Rückfrage-Funktion**. Kein
zusätzliches Modell, kein neuer persistenter Zustand und keine zweite Architektur.
Kanonischer Befund: `project-memory/receipts/chatadmin-known-fact-questions-20261017.md`.
