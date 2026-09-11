# Creator Intelligence & Sales Assistance — Phase 7b

Owner-Entscheidung FM-DEC-015 / FM-CR-029 vom 10. September 2026:
Creator Intelligence und die ausgewählten Social-/Handoff-Arbeiten beginnen
jetzt. Android folgt danach. Dies ersetzt die frühere Startabhängigkeit von
der Verkaufsübergabe (FM-DEC-013), ohne eine offene Abnahme abzuhaken.
`FM-CREATOR-001` ist IN_PROGRESS; Phase 7b bleibt kein zusätzlicher Verkaufs-Gate.
Weitere nicht beauftragte Phase-8-Arbeit bleibt zurückgestellt.

## Ein Creator = ein Account = ein Workspace

Klarstellung FM-DEC-016 vom 11. September 2026: Ein normaler Nutzer ist der
Creator seines Accounts. Jeder Account besitzt genau **einen persönlichen
Schreibstil**: Wortwahl, Satzbau, Satzzeichen, Emojis und Ausdruck. Alle
Antwortvorschläge und zugehörigen Kanäle bleiben in diesem Stil. Eine spätere
Überarbeitung aktualisiert denselben Stil; sie eröffnet keinen zweiten Stil
zur Auswahl. "Voice", "Stimme" und die bestehenden technischen
`creator_voice_profiles`-Bezeichner meinen ausschließlich diesen Textstil.
Audio, echte Stimmen, Sprachsynthese und Stimmklonen gehören nicht dazu.

Nur ein Manager darf später mehrere getrennte Nutzer-/Creator-Accounts und
deren Kanäle betreuen. Der Manager ist dabei der Bediener des ausgewählten
Accounts; die KI verwendet dessen Schreibstil und Fanwissen. Ein Wechsel des
Managers ändert den Stil nicht. Ein Wechsel des betreuten Accounts wechselt
den vollständigen autorisierten Creator-Kontext, ohne Stile oder Fanwissen
zu vermischen. Der Managerzugang mit diesen Rechten bleibt spätere Arbeit.

Bernds anschließende Klarstellung ist maßgeblich: Jeder Creator erhält einen
eigenen FanMind-Account mit eigenem Workspace. Das vorhandene `workspace_id`
trennt bereits Fans, Conversations, Memories, Follow-ups, Prompts und Kanäle.
`creators.workspace_id` ist UNIQUE: genau ein Creator-Profil pro Workspace,
keine zusätzliche Auswahl bei jeder Nachricht und keine gemeinsame Fanbasis.
Derselbe Fan bei zwei Creatorn wird in zwei unabhängigen Workspaces geführt.
Der angemeldete Chatter bleibt Nutzer, niemals automatisch die Persona.

Teamzugänge, erweiterte Rollen/Rechte, auditierbare Freigabeabläufe und die
Verwaltung mehrerer Workspaces bleiben in Phase 11/12. Die bestehende Owner-/
Member-Sicherheit wird beibehalten, ohne hier neue Teamrollen freizuschalten.

## Datenmodell und Rollout-Vertrag

Vor der Pipeline-Integration festgelegt:

| Objekt | Schlüssel und Inhalt | Schreib-/Quellenvertrag |
|---|---|---|
| creators | id, UNIQUE workspace_id, display_name, bio, public_age, location, languages, platforms, status, internal_notes, revision | Owner pflegt bestätigte Persona; keine erfundene Identität oder automatische neue Lizenz |
| Fans / Conversations / Channels | bestehendes workspace_id → genau ein Creator | Bestehende Datensätze werden nicht kopiert, zusammengeführt oder verschoben; Kontakt-Autorisierung bleibt vor jeder KI-Anfrage erforderlich |
| creator_voice_profiles | workspace_id + creator_id, fingerprint, revision, approved_at/by | Strukturierte Tonwerte, Länge, Emojis, Wortschatz und Beispiele; nur die freigegebene aktuelle Revision kommt in die KI |
| creator_sales_playbooks | workspace_id + creator_id, strukturierte rules/offers, revision, approved_at/by | Preise als Minor Units + Währung, Grenzen, Bestätigungspflichten und No-Gos; unbekannt ist nicht freigegeben |
| contact_ai_profiles | existing row plus commercial_profile | Bestätigte Facts/Quelle von Scores mit Review/Zeitraum trennen; unbekannte Werte bleiben NULL |
| conversations | sales_state, sales_state_updated_at, sales_state_source | CONNECT bis REACTIVATE; eine Empfehlung ändert nicht automatisch den bestätigten Zustand |
| creator_commercial_events | Workspace + Creator + Kontakt + optionale Conversation, kind, occurred_at, amount_minor/currency, category, evidence_reference, confirmed_by/at | Bestätigte Kauf-/Angebotsereignisse, niemals Kauf aus Copy, Klick oder KI-Vermutung |

Zusammengesetzte Fremdschlüssel binden neue kommerzielle Ereignisse an denselben
Workspace, Creator, Kontakt und gegebenenfalls dieselbe Conversation. Profil-
Änderungen werden als ein atomarer Bundle-Save mit optimistischer Revision
gespeichert. Eine unvollständige, veraltete oder pausierte Stimme führt zur
Korrekturaufforderung, nicht zum Chatter-/Workspace-Stil eines anderen Creators.
Interne Notizen werden nicht an die Text-KI übergeben.

Die additive SQL-Vorbereitung liegt unter `supabase/controlled/`; normale
Web-Deploys führen sie nicht aus. Der serverseitige Creator-Schalter darf erst
nach kompatibler Schema-/Staging-Abnahme kontrolliert aktiviert werden. Die
Foundation-Abnahme hat keine Aktivierung vorgenommen; der tatsächliche Schalter
im laufenden Staging-Prozess wurde noch nicht unabhängig geprüft. Bestehende Accounts ohne
Creator-Profil behalten ihre bisherigen CRM-Funktionen. Profile werden vom
Owner angelegt, nicht aus einem Accountnamen geraten.

## Vorhandene Architektur erweitern (Ausgangspunkt vor diesem Paket)

Die Prüfung von Main `7004c9ea` belegt Contacts, Conversations, Messages,
Memories, Follow-ups, Summaries, Fan-Analyse, `contact_ai_profiles`,
`workspace_voice_profiles`, `workspace_ai_prompt_settings` und drei strukturierte
Reply-Vorschläge. Die damals geprüfte Pipeline nutzte nur wenige Voice-/Fanprofilfelder
und lud Memories/Summaries nicht unmittelbar. Dieses Paket ergänzt Creator-Kontext,
Memory, Summary und die unten beschriebenen kommerziellen Eingaben. Die vollständige
Ergebnisverkettung bleibt der nächste Ausbau.

Kein separates neues CRM und keine weitere Datenbank: Der unabhängige Workspace
ist zugleich Mandanten-, Abrechnungs- und Creator-Datengrenze. Chatter und
Creator sind unterschiedliche Identitäten.

## Produktumfang

| Baustein | Geplanter Inhalt |
|---|---|
| `creators` | Workspace-Zuordnung, Name, bestätigte Persona-Daten, Sprachen, Status |
| Creator-Zuordnung | Fans, Conversations und Kanäle; konsistente Elternbezüge für Messages, Memories, Summaries, Analysen und Follow-ups |
| `creator_voice_profiles` | Versionierte Stimme, Ton, Satzlänge, Emojis, Wortschatz, gute/schlechte Beispiele, Herkunft und menschliche Freigabe |
| `creator_sales_playbooks` | Bestätigte Produkte/Angebote, Preise, Rabatte, Lieferzeiten, Grenzen und Bestätigungspflichten |
| Fan Commercial Data | Bestehendes Fanprofil erweitern; belegte Kauf-/Angebotsereignisse von Schätzungen trennen; unbekannte Werte nicht erfinden |
| Conversation/Sales State | CONNECT, ENGAGE, BUILD_INTEREST, QUALIFY, TEASE, OFFER, NEGOTIATE, CLOSE, AFTERCARE, REACTIVATE |

Das Datenmodell und seine Autorisierungs-/Migrationsverträge wurden vor der
Pipeline-Änderung definiert. Die geschützte Staging-Grundlagenabnahme 34629009649
auf f0c7a84e belegt echte JWT-Kontentrennung, einen Stil, atomare Freigaben/
Revisionen, PDF-Auskunft und Testbereinigung. Aktivierte Oberfläche, vollständige
Kontakt-/Kontolöschung, reale Qualität/Lernen und Provider-Freigaben bleiben offen. Die bestehende `/api/ai/reply-suggestions`-Pipeline ist im Code erweitert. Der Server
lädt automatisch Agenturregeln, richtigen Creator, freigegebene Voice und
Playbook, Fanwissen, Gesprächskontext und aktuelles Ziel. Keine Prompt-Auswahl
pro Nachricht. Missing-/Mismatch-Kontext darf nicht auf eine fremde Stimme fallen.

Die drei Varianten werden Recommended, Softer und Stronger; jede bleibt in
derselben Creator-Stimme und innerhalb desselben zulässigen Gesprächsziels.
Gemeint sind drei mögliche Formulierungen im einzigen Account-Schreibstil,
keine drei Schreibstile. Bestehende Unternehmens-Prompts und auswählbare
Legacy-Antwortprofile dürfen nur damit vereinbare Geschäftshinweise oder
Gesprächsziele ergänzen. Bei aktiviertem Creator-Rollout ist die Legacy-Auswahl jetzt ausgeblendet.
Bei konfiguriertem Creator werden weder explizite noch Default-Legacy-Profile
als Stil an die KI gegeben. Die Freigabe des tatsächlichen Zielsystems bleibt separat.
Strukturierte Angebots-/Preisempfehlungen kommen ausschließlich aus dem
freigegebenen Server-Datensatz. Freie Antworttexte enthalten keine Preise;
unzulässiger Wortschatz und Währungsangaben werden geprüft. Semantische
Produkt-/Versprechensgrenzen brauchen zusätzlich Promptregeln und menschliche
Prüfung; dieser erste Validator beweist keine vollständige semantische Sicherheit. Keine erfundene Verknappung oder
persönliche Zusage und kein Verkaufsdruck bei erkennbarer Not/Krise. Kopieren
ist kein Versandnachweis. Menschliche Prüfung und manuelles Senden bleiben.

Später: bestätigte echte Creator-Ausgänge beim Onboarding zu einem editierbaren
Voice-Entwurf verarbeiten; KI-Vorschlag, Bearbeitung, tatsächlich bestätigten
Ausgang, Fanreaktion und belegten Kauf nachvollziehbar verknüpfen. Rohtexte
bleiben private Produktdaten, keine öffentlichen Repository-/Usage-Logs.
Korrelation ist kein Kausalitätsbeweis; Preise/Grenzen lernen nicht autonom um.

## Abnahme und Grenzen

- Zwei freigegebene Creator-Profile, gleiche Eingangssituationen und verblindete
  menschliche Bewertung müssen unterscheidbare, konsistente Stimmen belegen.
- Derselbe Fan bei zwei Creatorn sowie ein Chatter-Wechsel dürfen weder Wissen
  vermischen noch die Creator-Identität verändern.
- Bestätigter Kauf führt zunächst zu passender Betreuung/AFTERCARE;
  Stronger darf Verkaufssperren nicht übergehen.
- Quellenlose Kaufzahlen, verbotene Angebote, fremde IDs, veraltete Profil-
  versionen und bloß kopierte Entwürfe müssen korrekt abgefangen werden.
- Web-/Mobile-Kompatibilität, RLS, Datenschutz, Kosten und kontrollierte
  Staging-Migrationen benötigen die passenden Code-, Ziel- und Qualitätsnachweise.
  Der Rollout-Vertrag steht in `docs/operations/CREATOR_FOUNDATION_ROLLOUT.md`.

Diese Roadmap-Entscheidung aktiviert keine Agency-Lizenz, keine Plus-/Ultra-
Stufe, keine Plattformanbindung und keine automatische Kommunikation. Bestehende
Preise bleiben bestehen. Reale Creator-/Fan-Kaufdaten und insbesondere OnlyFans-
Zugriffe benötigen ihre tatsächliche freigegebene Quellen-/Providergrundlage.

## Im ersten Paket umgesetzt

- Editor unter Einstellungen → KI-Nutzung: Persona, strukturierte Stimme,
  echte Beispieltexte, Playbook/Angebote. Änderungen verwerfen die bisherige
  Versionsfreigabe. Name, Alter und freie Beispiele werden nicht erfunden.
- Fan-Detail: explizit bestätigte Einschätzungen mit Quellenreferenz und optional
  tatsächlicher Kauf, gesendetes oder abgelehntes Angebot. Geld als Minor Units
  plus Währung; eindeutig wiederholte Belege werden abgewiesen. Der Server setzt
  Prüfer und Zeitpunkt, kein Klick erzeugt einen Kauf.
- Null statt erfundener Scores; Einschätzungen verfallen für die Verkaufssteuerung
  nach 24 Stunden. Eine manuelle Verkaufspause bleibt wirksam. Aktuelle bestätigte
  Käufe führen zu AFTERCARE, Angebotspause/Ablehnung/Ermüdung verhindern OFFER.
  Ein tatsächliches Offer braucht eine aktuelle explizite Anfrage, hohe geprüfte
  Kaufabsicht und ein aktives Angebot ohne weitere Bestätigungspflicht.
- Die volle Creator-Revision wird nach der Textgenerierung erneut geladen und
  verglichen. Fremde oder währenddessen veränderte Kontexte werden nicht ausgegeben.
- Datenschutzexport umfasst Persona, Stimme, Playbook, kommerzielle Profile und
  Ereignisse; neue Tabellen bleiben für alte Schemas optional. Der alte mehrstufige
  Kontakt-Merge ist in Creator-Accounts vorerst gesperrt, damit Belege nicht
  getrennt vom Fan verschoben werden.

## Fan Commercial Data: vollständiger Ausbauvertrag

| Gewünschte Information | Quelle / Behandlung |
|---|---|
| fan_stage, bevorzugte Inhalte/Stil, VIP | Manuell geprüfte Profileingabe mit Quelle; unbekannt bleibt unbekannt. Ein Label allein beweist keinen Kauf. |
| lifetime_spend, recent_spend, average_purchase, last_purchase_at | Spätere Aggregation bestätigter Kaufereignisse je Creator/Fan/Währung; nur vollständige Importzeiträume dürfen als Lifetime bezeichnet werden. Keine Vermischung von EUR/CHF/USD/GBP. |
| Content-Kategorien, PPV-Käufe, Customs | Belegtes Ereignis mit Kategorie; PPV-/Custom-Typen und Plattformreferenzen folgen im Importvertrag. |
| PPV-Unlock-Rate | Bestätigte Unlocks / tatsächlich zugestellte PPV-Angebote im benannten Zeitraum; fehlender Nenner ist NULL. |
| Engagement, Purchase Intent, Offer Fatigue | In diesem Paket explizit überprüfte nullable Einschätzungen mit Quelle und 24-h-Gültigkeit; keine modell-erfundenen Kaufzahlen. |
| Zeitpunkt letztes Angebot / Ablehnungen | Bestätigte offer-/offer_declined-Ereignisse; Copy/Open zählt nicht als Ereignis. |
| Relationship / Conversation State | Serverempfehlung in der Antwort; gespeicherter Conversation-State wird nicht automatisch als menschlich bestätigt ausgegeben. |
| Korrekturen / Erstattungen | Später über belegte Gegenereignisse mit Verweis auf das Original; keine unbemerkte Umschreibung der Historie. |

## Lernen aus Chats: verbleibender Ausbau

Die SQL-Grundlage erfasst bestätigte Kauf-/Angebotsereignisse, aber noch keine
vollständige Lernschleife. Nächster Vertrag: Vorschlags-ID mit Creator-/Prompt-
Revision → vom Nutzer tatsächlich bestätigte outbound Message-ID und bearbeiteter
Text → belegte inbound Fanreaktion → unabhängige Kaufbeleg-ID. Jede Beziehung
muss denselben Workspace, Fan und gegebenenfalls dieselbe Conversation tragen.
Unbekannte Reaktion/Kauf bleiben NULL; eine ausgewählte Variante ist kein Ausgang.
Lernstatistiken dürfen nur explizit verknüpfte, belegte Ereignisse verwenden und
keinen kausalen Verkaufserfolg aus zeitlicher Nähe behaupten. Preise/Grenzen
ändern sich nicht automatisch. Voice-Onboarding aus 30–100 freigegebenen echten
Creator-Nachrichten und die verblindete Stimmenbewertung sind noch offen.
