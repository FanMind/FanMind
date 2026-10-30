# ChatAdmin Stilprofil und Gesprächsgedächtnis: Anforderungsabgleich

Task: `FM-CHATADMIN-STYLE-MEMORY-REQUIREMENTS-20261030-01`  
Stand: FanMind `main` `70d70bd5c41fadf2cc0c3ec080986b6daeedee0c`  
Datum: 2026-10-30  
Status: neutrale Bestandsprüfung und Anforderungsentwurf; keine Runtime-, Schema- oder Produktfreigabe.

## Ziel und feste Grenzen

Der manuelle Admin-Chat soll pro Model einen ausdrücklich freigegebenen, nicht
expliziten Schreibstil verwenden können. Das Stilprofil umfasst nur
Formulierungsmerkmale wie Wortwahl, Länge, Satzbau, Humor und Emojis. Das
personenbezogene Gesprächsgedächtnis bleibt davon getrennt und wird je
Gegenüber geführt. Vorschläge bleiben Entwürfe: Ein Mensch prüft, kopiert und
sendet weiterhin selbst.

Die gewünschte Kommunikation ist persönlich, charmant und spielerisch innerhalb
einer erkennbaren Rolle. Nicht erlaubt sind explizite erotische Generierung,
Liebes- oder reale Beziehungsversprechen, erfundene Exklusivität,
Abhängigkeitsmechanik, fingierte menschliche Erlebnisse oder Gefühle und
Kaufdruck. Angebote dürfen nur aus verifizierten Quellen des ausgewählten Models
kommen. Eine Zustimmung ist kein Zahlungs- oder Versandnachweis.

Dieser Entwurf aktiviert weder Training noch eine Modell-/Providerfunktion. Er
überträgt keine echten Verläufe, installiert kein Schema und ändert keine
Runtime, Datenbank, Berechtigung, Kosten oder externe Kommunikation.

## Belegter Ist-Stand

| Bereich | Code-/Vertragsbeleg | Belegte Fähigkeit | Nicht belegt oder fehlend |
| --- | --- | --- | --- |
| ChatAdmin-Stil je Model | `ChatCharacter` in `src/lib/chatAdmin.ts`; Character-Editor in `src/app/chatadmin/ChatAdminClient.tsx`; `src/lib/chatAdminPolicy.mjs` | Jeder ChatAdmin-Character besitzt eigene Felder für Schreib-, Emoji- und Satzstil, typische/verbotene Phrasen sowie Beispielnachrichten. Speichern erhöht die Character-Revision; die Antwortpipeline bindet den ausgewählten Character. | Es gibt keinen getrennten Freigabestatus je Beispiel, keine Einzelkorrektur/-widerrufsmarkierung und keine Vorschau des effektiv freigegebenen Stilprofils vor dessen Nutzung. Ein normales Character-Speichern ist noch keine ausdrückliche Beispiel-Freigabe. |
| Creator-Voice-Vertrag | `src/lib/creatorIntelligence.ts`, `src/lib/creatorIntelligencePolicy.mjs`, `docs/CREATOR_INTELLIGENCE.md` | Creator-Voice und Playbook besitzen Revision sowie `approved_at/by`; Entwurf, widerrufene oder veraltete Revisionen fallen geschlossen aus. | Creator Intelligence setzt einen Creator pro Workspace voraus. Dieser Speicher darf nicht stillschweigend als Mehr-Character-Speicher des ChatAdmin wiederverwendet werden. |
| Stilbeispiel-Onboarding | `src/lib/creatorVoiceOnboarding.mjs`; `tests/creator-voice-onboarding.test.mjs` | Reiner Validator für 30–100 bestätigte, manuelle Outbound-Nachrichten desselben Workspace/Creators; Inbound, KI-Entwürfe, gemischte Scopes und Duplikate werden abgewiesen. Die Zusammenfassung enthält keine Rohtexte oder Message-IDs und verändert kein Profil. | Keine Persistenz, keine UI-Freigabe, keine ChatAdmin-Character-Anbindung und kein Beleg realer Sprachqualität. Der Vertrag ist nicht automatisch auf KI-unterstützte AdminChat-Ausgänge oder echte Verlaufssammlungen übertragbar. |
| Gedächtnis je Gegenüber | `ChatCharacterFan`, Conversations und Messages in `src/lib/chatAdmin.ts`; `src/lib/chatAdminKnowledge.mjs`; Current-Facts-Vertrag | Fan, Conversation, Messages und aktuelle Fakten sind mit Workspace, Character und Fan gebunden; Messages zusätzlich mit Conversation. Bestätigte Antworten sind von Vorschlägen getrennt. Begrenzte Kommunikationspräferenzen, Interessen, Grenzen und Korrekturen können in der bestehenden Fan-Datenfamilie geführt werden. | Vollständige natürliche Erinnerung, offene Themen und das Vermeiden jeder Wiederfrage sind nicht als Produktqualität bewiesen. Fan-Notizen/Current Facts sind personenbezogene Daten und dürfen nicht in das Model-Stilprofil kopiert werden. |
| Korrektur und Löschung | Character-/Fan-PATCH und DELETE in den ChatAdmin-Routen; bestehende Disclosure-/Deletion-Verträge | Character- und Fan-Zugriffe sind Workspace-/Character-gebunden und revisionsgesichert; Fan- und Character-Löschung existieren. | Einzelne Stilbeispiele haben keinen eigenen Lifecycle. Die vorhandenen Privacy-Verträge geben keine Freigabe für eine neue Sammlung realer Verlaufstexte. |
| Manuelle Antwortgrenze | Reply-Suggestions-Route, bestätigte Antwortpersistenz und PR #1383 Baseline | Drei Vorschläge, lokale Persistenz und ausdrücklich bestätigte Replies sind getrennt; automatische Nachrichtenzustellung ist nicht Teil des Vertrags. | Stubtests beweisen keine Natürlichkeit, Humorqualität oder stabile Model-Persönlichkeit. |
| Safety | `docs/CHATADMIN_MULTITURN_QUALITY_BASELINE.md` | Nicht explizite, erwachsene, einvernehmliche Zielgrenze und manuelle Sendekontrolle sind dokumentiert. | Der RED-Befund bleibt offen: Eine ausdrückliche Minderjährigkeitsangabe stoppt noch nicht deterministisch vor dem Provider. Manipulative Beziehungs-/Kaufsprache wird ebenfalls nicht vollständig deterministisch verworfen. |

## Verbindliche Trennung der Daten

### Model-Stilprofil

Ein Stilprofil gehört ausschließlich zu genau
`workspace_id + character_id + style_revision`. Es enthält nur kuratierte
Stilmerkmale und ausdrücklich ausgewählte nicht explizite Beispiele. Es enthält
keine `fan_id`, `contact_id`, `conversation_id`, Message-ID, Kaufhistorie,
Fan-Notiz, offene persönliche Themen oder aus einem Gegenüber abgeleitete
Eigenschaft.

Ein Model-/Character-Wechsel muss den vollständigen Stilkontext wechseln.
Fehlende, veraltete, korrigierte, widerrufene oder gelöschte Beispielrevisionen
dürfen nicht auf einen anderen Character oder einen Chatter-Default zurückfallen.

### Gesprächsgedächtnis

Gesprächsgedächtnis gehört mindestens zu
`workspace_id + character_id + fan_id`; konkrete Verlaufsteile zusätzlich zu
`conversation_id`. Es darf bestätigte, relevante Fan-Details, Korrekturen,
Grenzen und offene Themen enthalten, aber keine dauerhafte Character-Stilquelle
werden. Korrekturen müssen ältere widersprechende Fakten verdrängen; Löschung
des Fans oder der betreffenden Datenfamilie muss den bestehenden
Disclosure-/Deletion-Verträgen folgen.

Ein gleich benanntes Gegenüber bei zwei Characters oder Workspaces bleibt zwei
getrennte Datenscopes. Ein Gespräch darf weder den Model-Stil noch das Gedächtnis
eines anderen Gegenübers verändern.

## Freigabe-Lifecycle für Stilbeispiele

1. **Auswahl:** Nur ein Mensch wählt ein einzelnes Beispiel ausdrücklich aus.
   Automatisches Einsammeln sämtlicher Verläufe ist ausgeschlossen.
2. **Vorschau:** Vor Freigabe zeigt eine Vorschau exakt Text, Model/Character,
   Revision, Quelle und die nicht explizite/rollenbezogene Prüferklärung.
3. **Freigabe:** Nur die aktuelle, vollständig scoped Revision darf als
   `approved` gelten. Prüfer und Zeitpunkt sind Auditmetadaten, keine
   Product-Quality-Abnahme.
4. **Korrektur:** Jede Text- oder Metadatenänderung erzeugt eine neue
   Entwurfsrevision und entzieht der geänderten Fassung die bisherige Freigabe,
   bis erneut geprüft wurde.
5. **Widerruf:** Ein Widerruf schließt das Beispiel unmittelbar von zukünftigen
   Stilkontexten aus; er schreibt keinen historischen Chat um.
6. **Löschung:** Löschung entfernt das Beispiel aus der aktiven Stilquelle und
   folgt dem später festzulegenden Aufbewahrungs-/Auditvertrag. Sie darf keine
   Fan- oder Conversation-Daten berühren.
7. **Nutzung:** Nur aktuelle, freigegebene und nicht widerrufene Beispiele des
   exakt ausgewählten Workspace/Characters dürfen in eine spätere
   Antwortanfrage gelangen. Die menschliche Vorschau der drei resultierenden
   Antworten vor Copy/Send bleibt bestehen.

Eine menschliche Freigabe ersetzt keine semantische Safety-Prüfung und beweist
keine Natürlichkeit. Sie ist eine notwendige Herkunfts- und Nutzungsgrenze.

## Offene Anforderung: echte Verläufe als Lernmaterial

Der Nutzer wünscht, künftig auch echte Verläufe als mögliche Lernquelle zu
prüfen. Dieser Wunsch ist **keine Freigabe** für Upload, Training, Provider-
Übermittlung, Speicherung oder automatische Übernahme.

Vor jeder technischen Umsetzung sind mindestens gesondert zu klären und
nachweisbar freizugeben:

- Befugnis und Einwilligung des jeweiligen Models sowie Rechtsgrundlage für
  Daten der Gesprächspartner;
- Plattformbeschreibung und tatsächliche Disclosure-Erfahrung;
- Datenminimierung, Auswahl statt Vollimport und Entfernung nicht erforderlicher
  Personen-, Zahlungs-, Konto- und Zugangsdaten;
- Anbieter/Verarbeitungsort, Unterauftragsverarbeitung und Providervertrag;
- Speicherort, Mandanten-/Model-/Fan-Isolation, Aufbewahrung, Widerruf,
  Löschung, Auskunft und Backup-/Restore-Folgen;
- Kosten-, Mengen- und Missbrauchsgrenzen;
- Trennung von Stilableitung, Gesprächsgedächtnis und Erfolgs-/Kaufdaten;
- aktuelle Safety-, Datenschutz- und Qualitätsabnahme.

Die Angaben, Models hätten dem Rollenschreiben zugestimmt und die inszenierte
Unterhaltung sei in der Plattformbeschreibung angekündigt, stammen vom Nutzer
und wurden in dieser Bestandsprüfung nicht unabhängig verifiziert.

## Kleinster nächster Entwicklungstask

**Task:** `FM-CHATADMIN-STYLE-EXAMPLE-LIFECYCLE-CONTRACT-01`

**Ziel:** Einen repository-only, nebenwirkungsfreien Policyvertrag für manuell
kuratierte, nicht explizite ChatAdmin-Stilbeispiele definieren. Der Vertrag
validiert Scope, Revision und Lifecycle und erzeugt eine exakte menschliche
Vorschau. Er persistiert nichts und wird noch nicht in die Reply-Route oder UI
eingebunden.

**Erlaubte Dateien:**

- neu: `src/lib/chatAdminStyleExamplePolicy.mjs`
- neu: `src/lib/chatAdminStyleExamplePolicy.d.mts`
- neu: `tests/chat-admin-style-example-policy.test.mjs`
- Update ausschließlich dieser Anforderungsdatei für belegte Testergebnisse

**Nicht im Task:**

- Schema/Migration, Route-, UI- oder Prompt-Wiring;
- Import oder Fixture aus echten Verläufen;
- Provider-/Modellaufruf, Training oder Kosten;
- Fan-/Conversation-Memory-Änderung;
- erotische oder explizite Beispielgenerierung;
- automatische Freigabe, Nachricht oder Modelvertretung;
- Umsetzung des separaten Adult-Safety-Guards.

**Akzeptanzfälle mit ausschließlich synthetischen Texten:**

1. Ein `draft`-Beispiel wird in der Vorschau angezeigt, aber nicht als nutzbar
   kompiliert.
2. `approved` benötigt exakten Workspace, Character, aktuelle Revision,
   menschlichen Prüfer/Zeitpunkt und eine ausdrückliche nicht-explizite
   Prüferklärung.
3. Workspace-/Character-Mismatch, unbekannter Status, veraltete Revision,
   fehlende Vorschau oder fehlende Prüferklärung schlagen geschlossen fehl.
4. Eine Korrektur erzeugt eine neue Draft-Revision; die Freigabe der alten
   Textfassung kann die Korrektur nicht autorisieren.
5. `revoked` und `deleted` werden niemals in den nutzbaren Stilkontext
   aufgenommen.
6. Der Stil-Datensatz weist Fan-, Contact-, Conversation-, Message-, Kauf- oder
   Gedächtnisfelder zurück.
7. Zwei Characters mit denselben synthetischen Eingaben liefern getrennte
   Vorschauen und niemals einen gemischten Beispielkontext.
8. Der Vertrag führt keine Persistenz, keinen Fetch/Provideraufruf und keine
   Profil- oder Runtimeänderung aus.

## Abhängigkeit und Reihenfolge

Der offene Task `FM-CHATADMIN-ADULT-SAFETY-GUARD-01` bleibt eine zwingende
Abhängigkeit vor jeder späteren Runtime-Nutzung von Stilbeispielen. Der reine
Lifecycle-Policyvertrag darf ohne Runtime-Wiring vorbereitet werden; eine
spätere Route-/Prompt-Anbindung darf erst separat geplant werden, wenn der
Safety-Guard und die erforderlichen Datenschutz-/Freigabeverträge belegt sind.

## Abnahmegrenze dieses Dokuments

Dieses Dokument belegt nur den Repository-Ist-Stand und die neutralen
Anforderungen. Es ist keine Bestätigung von Model-Zustimmung, Plattform-
Disclosure, Rechtsgrundlage, Providerfähigkeit, realer Sprachqualität,
Produktverfügbarkeit oder sicherer Runtime-Nutzung.
