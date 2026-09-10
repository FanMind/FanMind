# Creator Intelligence & Sales Assistance — Phase 7b

Owner-Entscheidung: 10. September 2026, FM-DEC-013 / FM-CR-025.
Implementierung: `FM-CREATOR-001`, `DEFERRED` bis zur akzeptierten technischen
Verkaufsübergabe `FM-SALES-001`. Diese Datei beschreibt geplanten Scope.

## Verbindliche Reihenfolge

1. Bestehende Finishline einschließlich der erforderlichen Phase-3- und
   Phase-7a-Social-Kanäle abschließen; OnlyFans-Machbarkeit separat klären.
2. Technische Verkaufsübergabe an Gerhard akzeptieren.
3. Creator Intelligence & Sales Assistance als **Phase 7b** umsetzen und abnehmen.
4. Weitere Arbeit an Phase 8 aufnehmen.

Phase 7b ist keine Voraussetzung für die vorherige Verkaufsübergabe. Der
maschinenlesbare Gate `creator_intelligence` hat `required_for_sales=false`
und seine nächste Aktion benötigt `sales_handoff=ACCEPTED` oder
`PRODUCTION_CONFIRMED`. Die bereits deaktiviert vorbereitete Website-KI-Basis
bleibt historisch begonnen; ihre Existenz hebt die neue Arbeitsreihenfolge
nicht auf. Weitere Team-/Agency-/Analytics-Roadmap-Flächen werden durch diese
gezielte Creator-Erweiterung nicht pauschal vorgezogen oder freigeschaltet.

## Vorhandene Architektur erweitern

Die Prüfung von Main `7004c9ea` belegt Contacts, Conversations, Messages,
Memories, Follow-ups, Summaries, Fan-Analyse, `contact_ai_profiles`,
`workspace_voice_profiles`, `workspace_ai_prompt_settings` und drei strukturierte
Reply-Vorschläge. Die aktuelle Pipeline nutzt nur wenige Voice-/Fanprofilfelder
und lädt Memories/Summaries nicht unmittelbar. Creator-Identität, Creator-
Playbook, kommerzielle Zustände und eine vollständige Ergebnisverkettung fehlen.

Kein separates neues CRM und keine weitere Datenbank: Workspace bleibt die
Mandanten-/Abrechnungsgrenze; Creator ist die zusätzliche Identität. Ein Kontakt
bildet die Beziehung eines Fans zu genau einem Creator ab. Derselbe Mensch
kann mehrere getrennte Beziehungen haben; vertrauliches Fanwissen wird nicht
zwischen Creatorn geteilt. Chatter und Creator sind unterschiedliche Identitäten.

## Geplante Datenmodell-Bausteine

| Baustein | Geplanter Inhalt |
|---|---|
| `creators` | Workspace-Zuordnung, Name, bestätigte Persona-Daten, Sprachen, Status |
| Creator-Zuordnung | Fans, Conversations und Kanäle; konsistente Elternbezüge für Messages, Memories, Summaries, Analysen und Follow-ups |
| `creator_voice_profiles` | Versionierte Stimme, Ton, Satzlänge, Emojis, Wortschatz, gute/schlechte Beispiele, Herkunft und menschliche Freigabe |
| `creator_sales_playbooks` | Bestätigte Produkte/Angebote, Preise, Rabatte, Lieferzeiten, Grenzen und Bestätigungspflichten |
| Fan Commercial Data | Bestehendes Fanprofil erweitern; belegte Kauf-/Angebotsereignisse von Schätzungen trennen; unbekannte Werte nicht erfinden |
| Conversation/Sales State | CONNECT, ENGAGE, BUILD_INTEREST, QUALIFY, TEASE, OFFER, NEGOTIATE, CLOSE, AFTERCARE, REACTIVATE |

Zuerst das Datenmodell und seine Autorisierungs-/Migrationsverträge abnehmen,
danach die bestehende `/api/ai/reply-suggestions`-Pipeline erweitern. Der Server
lädt automatisch Agenturregeln, richtigen Creator, freigegebene Voice und
Playbook, Fanwissen, Gesprächskontext und aktuelles Ziel. Keine Prompt-Auswahl
pro Nachricht. Missing-/Mismatch-Kontext darf nicht auf eine fremde Stimme fallen.

Die drei Varianten werden Recommended, Softer und Stronger; jede bleibt in
derselben Creator-Stimme und innerhalb desselben zulässigen Gesprächsziels.
Angebots-/Preisgrenzen gelten serverseitig. Keine erfundene Verknappung oder
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
- Web-/Mobile-Kompatibilität, RLS, Lizenzgrenzen, Datenschutz, Kosten und
  kontrollierte Staging-Migrationen gehören zur späteren Umsetzung.

Diese Roadmap-Entscheidung aktiviert keine Agency-Lizenz, keine Plus-/Ultra-
Stufe, keine Plattformanbindung und keine automatische Kommunikation. Bestehende
Preise bleiben bestehen. Reale Creator-/Fan-Kaufdaten und insbesondere OnlyFans-
Zugriffe benötigen ihre tatsächliche freigegebene Quellen-/Providergrundlage.
