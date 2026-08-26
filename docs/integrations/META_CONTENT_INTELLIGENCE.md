# Meta-Kanäle und Content Intelligence

Stand: 26. August 2026

Dieses Dokument ist die technische und rechtliche Arbeitsgrundlage für
Facebook-/Instagram-Verbindungen, Nachrichtenimport, Post-Reichweitenanalyse,
Fan-Kommunikationsanalyse und Workspace-Schreibstil. Es ist keine anwaltliche
Freigabe und aktiviert keine externe Verbindung.

## Verbindliche Speicherentscheidung vom 3. August 2026

- Eigene Posts/Reels/Videos des verbundenen Business-/Creator-Kontos und ihre
  freigegebenen aggregierten Insights werden als Workspace-Cache gespeichert,
  damit unveränderte Daten nicht wiederholt vollständig abgerufen werden.
- Autorisierte DMs und Kommentare mit dem verbundenen Konto werden gespeichert.
  Der erste Facebook- oder Instagram-DM-Abgleich lädt höchstens die letzten
  150 Nachrichten je Thread. Danach werden neue Ereignisse per Webhook beziehungsweise seit dem
  letzten Sync und externer Ereignis-ID inkrementell ergänzt; vorhandene ältere
  Nachrichten werden nicht wegen einer KI-Stufe gelöscht.
- Persönliche fremde Profile, persönliche Posts eines Fans und vollständige
  Followerlisten werden weder gespiegelt noch gescrapt. Soweit Meta einzelne
  Inhalte über eine genehmigte API für einen zulässigen Zweck liefert, dürfen
  sie nur für diese Analyse verarbeitet werden.
- Das abgeleitete Fanprofil und Nutzer-Schreibstilprofil speichern nur die für
  passende Antwortvorschläge nötigen Signale, Quellenzeitraum, Stichprobe und
  Konfidenz. Sie bleiben korrigier- und löschbar.
- Automatische Hintergrundanalyse bleibt deaktiviert. Webhooks ergänzen nur
  autorisierte Chats/Kommentare; sie lösen keine selbständige Profilanalyse
  und keine automatische Antwort aus.

## Verbindliche Produktgrenze

- Jeder FanMind-Kunde verbindet in seinem eigenen Workspace sein eigenes
  Facebook-/Instagram-Geschäftskonto über Meta OAuth beziehungsweise Meta
  Business Login.
- FanMind speichert keine Facebook-/Instagram-Passwörter. Zugriffstokens werden
  verschlüsselt und ausschließlich serverseitig verarbeitet.
- Ein externes Konto darf zu einem Zeitpunkt nur einem aktiven FanMind-
  Workspace zugeordnet sein. Ein fremdes Konto oder fremde Nachrichten dürfen
  niemals durch bloße Workspace-Auswahl sichtbar werden.
- Verbindungen dürfen nur Owner oder Admins anlegen, ändern oder trennen.
- Bei mehreren verwalteten Seiten oder Konten ist eine ausdrückliche Auswahl
  erforderlich. FanMind darf niemals automatisch die erste Seite wählen.
- FanMind erstellt Antwortvorschläge. Der Mensch prüft und sendet selbst; es
  gibt keine automatische Nachrichtenversendung.
- Es gibt kein Scraping, keinen Import fremder Followerlisten und keine
  Anreicherung aus privaten Profilen oder Drittquellen.

## Status

| Bereich | Stand |
| --- | --- |
| Facebook OAuth, verschlüsselte Seitentokens, Webhook- und Nachrichten-Grundlage | implementiert/Beta; Meta-Kontotest und Freigaben offen |
| Facebook Graph API | auf stabile `v25.0` festgelegt |
| Instagram Webhook-Parser, begrenzter DM-Erstabgleich und inkrementelle Chat-/Kommentargrundlage | implementiert; echter Staging-/Meta-Kontotest offen |
| Instagram Business Login/OAuth und Professional-Kontobindung | implementiert; echter Staging-/Meta-Kontotest noch offen |
| Post-/Account-Cache, Metrik-Snapshots und Formeln | implementiert; Schema im isolierten Staging angewendet und read-only nachgeprüft; echter Meta-Datentest offen |
| Fan-/Gesprächs-/Schreibstil-Provenienz und Reviewstatus | implementiert; Schema im isolierten Staging angewendet und read-only nachgeprüft; Analyse-Aktivierung bleibt gesperrt |
| Begrenzte Conversation-Pagination | Implementierung und Migration im isolierten Staging installiert; exakter read-only Verify mit gemeinsamem Rollout-State und zurückgerolltem Postflight bestanden; Production, Acceptance, Aktivierung und realer Meta-Test offen |
| Langlebige Webhook-Catch-up-Queue | Controlled Migration im isolierten Staging installiert und read-only verifiziert; Worker bleibt inaktiv; rollback-only Acceptance, Worker-/Webhook-E2E, Production und Aktivierung offen |
| Workspace-Verarbeitung nach Vertragsende | gemeinsame fail-closed Policy in Meta-Ingress, manuellem Sync und Queue-Worker umgesetzt; rollback-only Staging-Abnahmepfad vorbereitet, externer Lauf und Meta-E2E offen |
| Isolierter Staging-Migrationspfad | beide Meta-Content-Migrationen im getrennten Supabase-Staging angewendet und read-only nachgeprüft; Production unverändert |
| Meta App Review, Advanced Access und Business Verification | extern offen |
| Rechtsgrundlage, Transparenz, AVV und Aufbewahrung | extern beziehungsweise je Kunde offen; Analysen standardmäßig aus |
| Produktive Drittpersonenfreigabe | blockiert bis Technik-, Staging- und Rechtsabnahme |

## Mandanten- und Datenhierarchie

| Ebene | Identität | Zulässige Verknüpfung |
| --- | --- | --- |
| Workspace | `workspace_id` | genau ein FanMind-Mandant |
| Meta-Verbindung | `social_connection_id` | Workspace + Plattform + externes Konto |
| Post/Reel/Video | `content_source_id` | eigenes verbundenes Konto + externe Content-ID |
| Fan/Kontakt | `contact_id` | ausschließlich im Workspace |
| Meta-Gespräch/Nachricht/Kommentar | Conversation-/Message-ID | konkreter Thread/Post + externe Ereignis-ID; fortlaufend inkrementell gespeichert |
| Abgeleitetes Fanprofil | Profil-ID | Workspace + Kontakt + Zeitraum + Anzahl + Konfidenz + Reviewstatus |
| Nutzer-Schreibstil | Profil-ID | Workspace + Nutzer + ausschließlich bestätigte manuelle Ausgänge |

Ein Fan-Gespräch bleibt an seinen konkreten Thread beziehungsweise Post
gebunden. Nachrichten aus zehn oder hundert Posts werden nicht zu einem
scheinbar einheitlichen Gespräch vermischt.

## Über freigegebene Meta-APIs verfügbare Daten

Die tatsächlich verfügbaren Felder hängen von Kontotyp, App-Modus,
Berechtigung, Reviewstatus, API-Version und dem jeweiligen Meta-Endpunkt ab.
FanMind behandelt fehlende Metriken als nicht verfügbar und erzeugt keine
Ersatzwerte.

| Quelle | Nutzbare Daten | Nicht verfügbar / nicht zulässig |
| --- | --- | --- |
| Facebook Page | eigene Posts/Videos, veröffentlichte Metadaten, Page-Kommentare, Messenger-Threads mit der Seite, freigegebene Page-/Post-Insights | private Profile, vollständige Followerliste, fremde Seiteninterna, Profile ohne Interaktion |
| Instagram Professional | eigene Medien/Reels, Kommentare, DMs mit dem Professional-Konto, freigegebene Account-/Media-Insights | private Consumer-Konten, vollständige Followerliste, fremde DMs, private Profilanalyse |
| FanMind-Kommunikation | gespeicherte eingehende und bestätigte manuell ausgehende Texte, Zeitstempel, Thread-/Postbezug, minimale Anhangsmetadaten | Passwort, versteckte Profildaten, Gesichtserkennung, Bilddiagnosen |

Die Reichweite eines einzelnen Fans ist nicht als personenbezogene
„Posting-Reichweite“ verfügbar. Reichweite und Impressionen sind aggregierte
Account-/Content-Metriken. Personenbezogene Analysen sind nur für Kontakte
möglich, die über Nachricht, Kommentar oder einen anderen zulässigen
FanMind-Kontaktpunkt tatsächlich im Workspace vorkommen.

## Benötigte Berechtigungsklassen

Die endgültigen Scopes werden vor App Review noch einmal gegen die dann aktive
Meta-Konfiguration geprüft.

| Plattform/Funktion | Vorbereitete Scopes |
| --- | --- |
| Facebook Messenger | `pages_show_list`, `pages_manage_metadata`, `pages_messaging` |
| Facebook Kommentare | `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_read_user_content` |
| Facebook Insights | `pages_show_list`, `pages_read_engagement`, `read_insights` |
| Instagram DMs | `instagram_business_basic`, `instagram_business_manage_messages` |
| Instagram Kommentare | `instagram_business_basic`, `instagram_business_manage_comments` |
| Instagram Insights | `instagram_business_basic`, `instagram_business_manage_insights` |

Standard Access reicht nur für App-Rollen beziehungsweise zulässige eigene
Testkonten. Für allgemeine Kundenkonten sind die passenden Advanced-Access-
Berechtigungen, App Review und gegebenenfalls Business Verification nötig.

## Reichweiten- und Postinganalysen

FanMind speichert eigene Posts und Reichweiten-Snapshots des verbundenen
Kontos, damit Entwicklungen über Zeit vergleichbar bleiben und unveränderte
Werte nicht bei jeder Ansicht erneut vollständig von Meta geladen werden.
Originale Meta-Metriknamen werden auf eine kleine interne Allowlist abgebildet;
unbekannte, negative oder nicht numerische Werte werden verworfen.

Zulässige Kernmetriken:

- Reichweite, Impressionen, Views/Plays;
- Likes, Kommentare, Shares und Saves;
- Link-Klicks, Profilbesuche und Follows, soweit der Endpunkt sie liefert;
- zuordenbare DMs und neu entstandene FanMind-Kontakte;
- Paid Reach und Paid Impressions getrennt von Gesamtwerten.

Berechnungen:

- Interaktionen = Likes + Kommentare + Shares + Saves;
- organische Reichweite = Gesamt-Reichweite minus Paid Reach, nie unter null;
- Engagement-Rate = Interaktionen / Reichweite;
- Save-, Share-, DM- und Kontakt-Conversion-Rate jeweils / Reichweite;
- Vergleich eines Posts mit dem Median historisch vergleichbarer Posts;
- Konfidenz `low` unter 5 Posts oder 1.000 Gesamt-Reichweite, `medium` ab 5
  Posts und 1.000 Reichweite, `high` ab 20 Posts und 10.000 Reichweite.

Die UI muss immer Zeitraum, Stichprobengröße, Quelle und Konfidenz zeigen.
Organisch, bezahlt, Engagement, Leads und Umsatz dürfen nicht als dieselbe
Kennzahl dargestellt werden. Eine Korrelation ist keine Kausalitätsaussage.

## Zulässige Fan- und Gesprächsanalyse

Aus tatsächlich vorhandener Kommunikation dürfen vorsichtig abgeleitet werden:

- Sprache und beobachteter Kommunikationsstil;
- Stimmung nur innerhalb des konkreten Gesprächs und nicht als dauerhafte
  Persönlichkeitseigenschaft;
- ausdrücklich genannte Themen, Interessen, Fragen und Einwände;
- konkrete Absicht, offene Zusagen und nächster sinnvoller Schritt;
- bevorzugte Antwortlänge, Formalität und Reaktionsmuster;
- Antwortzeiten und Verlauf der Beziehung, soweit die Datenbasis dies trägt.

Das gespeicherte Fanprofil enthält Quellenzeitraum, Nachrichtenanzahl,
Konfidenz und Reviewstatus. Die autorisierten Chats liegen getrennt im
konkreten Thread; das Profil selbst dupliziert ihre Rohtexte nicht. Es muss
korrigierbar, verwerfbar und löschbar sein. Bei weniger als drei relevanten
Nachrichten ist ausdrücklich auf geringe Datenlage hinzuweisen.

Nicht abgeleitet oder gespeichert werden insbesondere ethnische Herkunft,
politische Meinung, Religion/Weltanschauung, Gewerkschaftszugehörigkeit,
Gesundheit, genetische oder biometrische Identifikation, Sexualleben,
sexuelle Orientierung oder psychologische Diagnosen. Auch Kaufwahrscheinlichkeit
und Persönlichkeit dürfen nicht als Tatsachen ausgegeben werden.

## Analyse des FanMind-Nutzers

Ein Workspace-Schreibstil darf ausschließlich aus Nachrichten lernen, die ein
angemeldeter Nutzer selbst als manuelle ausgehende Nachricht bestätigt hat.
KI-Entwürfe, Notizen, eingehende Fan-Nachrichten und automatisch importierte
Texte sind keine zulässigen Stilbeispiele. Das Profil darf Sprache, Ton,
Satzlänge, Begrüßung, Abschluss, Emoji-Nutzung und wiederkehrende Formulierungen
enthalten. Es bleibt ein editierbarer Arbeitsvorschlag, keine Bewertung der
Person.

## Technische Schutzmaßnahmen

- Meta-Webhook-HMAC gegen die konfigurierten Facebook-/Instagram-App-Secrets
  und Verify-Token fail-closed; autorisierte neue Chats/Kommentare werden
  inkrementell gespeichert;
- Meta-Providerfehler dürfen weder Nachrichtentext, Token-, Konto- noch
  Objektangaben in Logs, UI oder gespeicherte Sync-Status übernehmen. Nur ein
  begrenzter numerischer Providercode und ein formatgeprüfter Fehlertyp bleiben
  als technische Diagnose erhalten; Nutzertexte sind feste FanMind-Meldungen;
- OAuth-State an User und Workspace gebunden;
- Owner-/Admin-Prüfung vor Start, Callback und Trennung;
- verschlüsselte Tokens nur über Service Role; Browser erhalten höchstens
  nicht geheime Statusfelder;
- global eindeutige aktive Bindung von Plattform + externer Konto-ID;
- idempotente externe Ereignis-IDs und Schutz vor doppelten Webhooks;
- keine Graph-Profil- oder Conversation-Historienabfrage im Webhook-Request;
  gezielte Nachholarbeit wird bei ausdrücklicher Aktivierung atomar nach
  Workspace, Connection, Plattform und Fan-Thread gebündelt. Ausschließlich
  ein service-role-Worker darf per Lease arbeiten; fünf begrenzte Versuche,
  Backoff, Dead Letter und Generationszähler verhindern Doppelarbeit und den
  Verlust neuer Webhook-Impulse. Worker-Ausgaben enthalten keine IDs, Tokens,
  Payloads, Profile oder Paging-URLs;
- erster Facebook- oder Instagram-DM-Abruf höchstens 150 aktuelle Nachrichten je Thread; danach
  nur neue Ereignisse mit fünf Minuten Sicherheitsüberlapp;
- pro verbindungsweitem Lauf innerhalb eines festen 45-Sekunden-Zeitbudgets
  höchstens eine auf 25 Conversations begrenzte Provider-Seite; ein strikt
  validierter `after`-Cursor und der ursprüngliche
  Intervallstart bleiben ausschließlich serverseitig gespeichert, bis Meta
  keine Folgeseite mehr liefert. Erst dann darf `last_messenger_sync_at` auf
  den ursprünglichen Intervallstart vorrücken; Fehler bewahren die bestehende
  Fortsetzung und Wiederholungen bleiben über externe Nachrichten-IDs
  idempotent;
- KI-Kontext ausschließlich serverseitig nach effektiver Stufe: Standard 50,
  Plus 100, Ultra 150 aktuelle Nachrichten; Browserwerte werden ignoriert;
- keine Nachrichten-/Kommentar-Rohinhalte in technischen Diagnoseprotokollen;
- eigene Posts und erlaubte Metrik-Snapshots werden getrennt vom Fanprofil
  gecacht; fremde persönliche Posts/Profile werden nicht gespiegelt;
- getrennte Datenbankmigration und Staging-Abnahme vor Production;
- Trennen löscht den gespeicherten Zugriffstoken und stoppt weitere Abrufe;
- Datenexport, Korrektur und Löschung müssen Chats, eigene Post-Caches,
  Metrik-Snapshots sowie Fan-/Schreibstilprofile einschließen, bevor sie
  aktiviert werden.
- Cache-, Chat- und Profilobjekte werden serverseitig geschrieben;
  Browserzugriffe sind read-only und Workspace-Prüfungen verhindern fremde
  Zuordnungen.
- `meta_sync_mode = incremental_cache` und null Tage Aufbewahrung für
  gespiegelte persönliche Fremdinhalte sind
  Datenbankbedingungen und Teil des Aktivierungsgates.

## Rechtliches Aktivierungsgate

In `workspace_analysis_settings` sind alle Analysearten standardmäßig
deaktiviert. Eine Aktivierung ist technisch nur zulässig, wenn alle fünf
Punkte auf `confirmed` stehen und die bestätigende Person sowie der Zeitpunkt
gespeichert sind:

1. Rechtsgrundlage für den konkreten Zweck;
2. transparente Information der betroffenen Personen, einschließlich
   Profiling/Analyse und Betroffenenrechten;
3. gültige AVV-/Anbieter- und Transferprüfung für die aktiv verwendeten
   Dienste;
4. verbindliche Nachrichten- und Analyse-Aufbewahrungsfristen.
5. funktionsfähiger Datenexport sowie Korrektur-, Widerspruchs- und
   Löschprozess für Kontakte, Chats, Post-Caches, Metrik-Snapshots und Profile.

Vor Drittpersonenbetrieb sind zusätzlich Zweckbindung, Datenminimierung,
Widerspruch/Korrektur/Löschung, Meta-Datenlösch-Callback, Account-Trennung,
Unterauftragsverarbeiter und gegebenenfalls Datenschutz-Folgenabschätzung mit
Rechtsberatung zu prüfen. FanMind darf keine pauschale DSGVO-Konformität
behaupten.

## Abnahmefolge

1. Meta-App-Produkte und Business-Verknüpfungen im Developer Dashboard prüfen.
2. Facebook- und Instagram-Berechtigungen nur für Testkonten einrichten.
3. explizite Facebook-Seitenauswahl und Instagram-Professional-Kontobindung
   mit Testkonten verifizieren.
4. Bereits angewendetes isoliertes Staging-Schema für den jeweils geprüften Commit read-only nachweisen und die RLS-/Token-Negativtests wiederholen; bei Drift fail-closed stoppen.
5. Die server-only Conversation-Continuation-Migration über den getrennten
   exakter-Commit- und Staging-gebundenen Apply-Pfad anwenden und mit dem
   read-only Workflow nachprüfen. Paar-/Cursor-Constraint und Browser-Sperren
   müssen vollständig bestehen; Meta-Abruf und Analyse bleiben aus.
6. Die Controlled Migration der Meta-Catch-up-Queue getrennt anwenden und
   read-only nachprüfen. Danach den vorbereiteten rollback-only Workflow für
   Browser-Sperren, service-role-only RPCs, Scope, Duplikat-Coalescing,
   exklusive Leases, Restart-Übernahme und fünf Retries bis Dead Letter mit dem
   markierten synthetischen Workspace ausführen. Entitlement-/Disconnect-
   Abbruch und gleichzeitige Mehrprozess-Claims anschließend im getrennten
   Worker-/Webhook-E2E prüfen. Worker und Flag bleiben bis zum vollständigen
   Nachweis aus.
7. 150er-Erstabruf für Facebook und Instagram-DMs, inkrementelle Webhooks, Deduplizierung, vollständige
   Verlaufserhaltung sowie 50/100/150-KI-Kontexte und Post-/Insight-Cache mit
   synthetischen Daten testen.
8. Trennung, Widerruf, Tokenablauf, Datenexport und Löschung testen.
9. Datenschutzinformation, AVV, Anbieter-/Transferregister und Fristen extern
   freigeben.
10. Meta App Review/Advanced Access abschließen.
11. Erst danach begrenzten Pilot je Workspace aktivieren; kein globaler
   Standardschalter.

Der kontrollierte Schritt 4 ist in
`docs/operations/META_CONTENT_STAGING_MIGRATION.md` beschrieben. Die beiden
Meta-Content-Migrationen wurden im getrennten Supabase-Staging angewendet und
read-only nachgeprüft. Ein normaler Web-Deploy wendet sie weiterhin nicht an;
Production blieb unverändert und weder Verbindung noch Analyse wurden aktiviert.
Der separate Continuation-Pfad ist in
docs/operations/META_CONVERSATION_CONTINUATION_STAGING.md beschrieben; sein
externer Apply-/Verify-Lauf ist noch offen und wird nicht vom normalen
Web-Deploy ausgeführt.

Offizielle Prüfeinstiege:

- [Meta Graph API Versions](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- [Instagram Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights)
- [Instagram App Review](https://developers.facebook.com/docs/instagram-platform/app-review)
- [Meta Page Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/reference/page/)
- [Meta Platform Terms](https://developers.facebook.com/terms/dfc_platform_terms/)
- [DSGVO-Grundsätze](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [DSGVO-Volltext](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
