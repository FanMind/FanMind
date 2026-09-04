# FanMind technisches Retention-Register

Stand: 30. Juli 2026

Dieses Register trennt im Code belegte technische Grenzen von noch
festzulegenden rechtlichen oder geschäftlichen Aufbewahrungsfristen. Es ist
keine Rechtsberatung. Eine im Repository definierte Frist ist erst dann ein
Produktionsnachweis, wenn Migration, Konfiguration und Worker für den
betroffenen Stand geprüft wurden.

Die DSGVO verlangt, Speicherdauer oder zumindest die Kriterien dafür
transparent zu machen und personenbezogene Daten nicht länger als erforderlich
identifizierbar zu halten. Maßgebliche Prüfeinstiege sind insbesondere
[Art. 5 und Art. 13 DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

## Statusbegriffe

- **umgesetzt:** Grenze ist in Code, Migration oder Runtime-Konfiguration
  definiert und getestet;
- **produktiv nachgewiesen:** zusätzlich ist der aktive Produktionsstand
  dokumentiert;
- **vorbereitet:** Code existiert, die externe Aktivierung oder Migration ist
  noch nicht vollständig belegt;
- **Entscheidung offen:** es gibt bewusst keine erfundene Frist.

## Technische Fristen und Kriterien

| Datenbereich | Technische Grenze oder Kriterium | Status | Quelle |
| --- | --- | --- | --- |
| Marketing-Einwilligung | Consent-Cookie höchstens 180 Tage; jederzeit änderbar | umgesetzt | `src/lib/metaPixelPolicy.mjs` |
| Meta-Pixel-Ereignisse | nur nach Einwilligung; ausschließlich parameterloses `PageView`; vorbereitete Conversion-Events unverdrahtet; keine FanMind-seitige Event-Payload-Retention | umgesetzt | `src/lib/metaPixelPolicy.mjs`, `src/lib/metaPixel.ts` |
| Auth-Session | Access-Cookie höchstens Provider-Ablauf beziehungsweise 1 Stunde; Refresh-Cookie 30 Tage | umgesetzt | `src/app/api/auth/session/route.ts` |
| öffentlicher Demo-Zugang | Zugang 1 Stunde; danach Cleanup-Queue; pseudonymer Browser-Schutz-Cookie höchstens 30 Tage | umgesetzt | `src/app/api/demo/start/route.ts`, `src/lib/demoProtection.ts` |
| Mobile Offline-Kontaktübersicht | höchstens 50 Einträge, 24 Stunden, verschlüsselt, account-/workspacegebunden und nur bei Transportfehlern | umgesetzt | `apps/mobile/src/lib/offlineContactCache.ts`, `apps/mobile/README.md` |
| Mobile Push-Registrierung | 30 Tage nach letzter bestätigter Aktivität; abgelaufene Registrierung wird gelöscht | vorbereitet, Zustellung inaktiv | `src/lib/mobilePushRegistrationPolicy.mjs`, `src/lib/mobilePushRegistrations.ts` |
| Website-Chat-Besuchersitzung | konfigurierbar zwischen 5 Minuten und 24 Stunden; nur HMAC-Tokenbezug, Consent-Version und exakte Origin; keine rohe IP | vorbereitet, nicht produktiv aktiviert | `src/lib/websiteChatPolicy.mjs`, `supabase/migrations/20260808223000_website_chat_security_foundation.sql` |
| Website-Chat-Ingestion-Receipt | an Besuchersitzung gebunden und bei deren Löschung kaskadierend entfernt; nur Client-UUID und CRM-Referenzen, kein Nachrichtentext | vorbereitet, nicht produktiv aktiviert | `supabase/migrations/20260808234500_website_chat_message_ingestion.sql` |
| Website-Chat-Übergabenachweis | höchstens eine Übergabe je Sitzung; nur E-Mail-SHA-256-Fingerprint, Zweck/Version/Zeitpunkt der Einwilligung und CRM-Referenzen; Löschziel gemäß Installations-Nachrichtenaufbewahrung, auf höchstens 90 Tage begrenzt; eine automatische Löschung ist noch nicht aktiviert | kontrolliert vorbereitet, nicht angewandt und nicht produktiv aktiviert | `supabase/controlled/20260904120000_website_chat_handoff.sql` |
| Webhook- und Serverfehler-Diagnosen | Standard 30 Tage; begrenzte Löschläufe; nur minimierte technische Merkmale | produktiv dokumentiert | `docs/security/WEBHOOK_LOG_RETENTION.md`, `scripts/operations/webhook-diagnostic-retention.mjs` |
| PM2-Anwendungslogs | tägliche Rotation, 14 Rotationen, maximal 10 MiB je aktive Datei, komprimiert | produktiv nachgewiesen | `docs/security/WEBHOOK_LOG_RETENTION.md` |
| journald | maximal 14 Tage, zusätzlich 512 MiB persistent und 128 MiB runtime | umgesetzt; Hostprüfung bei Änderung erforderlich | `ops/systemd/journald-fanmind.conf`, `docs/security/WEBHOOK_LOG_RETENTION.md` |
| Account-Löschanfragen | reguläres manuelles Bearbeitungsziel 30 Tage; Status und Blocker werden transparent geführt | umgesetzt | `src/lib/accountDeletionPolicy.mjs`, `supabase/migrations/20260724103000_account_deletion_requests.sql` |
| lokale verschlüsselte Backups | Datenbank, Storage und Serverkonfiguration: je 1 täglicher, 1 wöchentlicher, 1 monatlicher Stand; Full: 1 wöchentlich, 1 monatlich; mindestens neuester Stand geschützt | umgesetzt und produktiv geplant | `scripts/operations/backup-retention.mjs` |
| verschlüsselte Offsite-Backups | gleiche zählerbasierte Auswahl; aktueller Planer ist strikt read-only und löscht noch nicht | Dry-Run nachgewiesen, Ausführung offen | `docs/operations/OFFSITE_RETENTION.md` |
| GitHub-CI-Artefakte | je Workflow 5, 7 oder 14 Tage | umgesetzt | `.github/workflows/` |

## Fachliche Daten mit Kriterien statt erfundener Endfrist

| Datenbereich | Aktuelles Kriterium | Noch verbindlich festzulegen |
| --- | --- | --- |
| Account und Workspace | Dauer von Konto, Vertrag oder freigegebenem Zugang; danach bestätigter Lösch-/Rückgabeprozess | Nachlauf für Support, Streitfälle und abweichende Vertragsbeendigung |
| Kontakte, Nachrichten, Kontaktwissen und Follow-ups | Dauer des Workspace oder frühere nutzer-/kundenveranlasste Löschung, soweit keine Pflicht entgegensteht | maximale Inaktivitätsfrist und Umgang mit Kunden-Backups |
| Website-Chat-E-Mail am Kontakt | bestehender Kontakt-/Workspace-Lebenszyklus; der getrennte Übergabenachweis enthält nur einen Fingerprint und ein Löschziel | maximale Kontakt-Inaktivitätsfrist und kontrollierter Löschlauf für abgelaufene Übergabenachweise |
| KI-Ausgaben und Analyseberichte | solange im autorisierten Workspace fachlich gespeichert oder vom Nutzer gelöscht | maximale Nachlauf- oder Inaktivitätsfrist |
| Meta-Nachrichten, Kommentare und Kommunikationsanalysen | Analyse technisch standardmäßig deaktiviert; Aktivierung verlangt bestätigte Nachrichten- und Analysefrist je Workspace | verbindliche Fristen, Löschworker, Verhalten nach Trennung und in Backups |
| Eigene Meta-Posts und aggregierte Reichweitenwerte | Workspace-Cache für das verbundene Business-/Creator-Konto; keine Spiegelung fremder persönlicher Posts | konkrete Cache-/Löschfrist, Verhalten bei Trennung und Löschworker extern festzulegen |
| Autorisierte Meta-Chats und Kommentare | fortlaufende inkrementelle Speicherung per externer Ereignis-ID; Facebook-Erstabruf höchstens 150 aktuelle Nachrichten je Thread, danach nur neue Ereignisse | verbindliche Zeitfrist, Verhalten nach Trennung und in Backups extern festzulegen |
| Minimale abgeleitete Fan-/Schreibstilprofile | nur für passende Antwortvorschläge notwendige Signale; standardmäßig deaktiviert, editier- und löschbar | konkrete Löschfrist und regelmäßige Überprüfung extern festzulegen |
| KI-Kostenereignisse | minimierte Nutzungsmetrik ohne Prompt-/Antwortvolltext; noch keine automatische fachliche Löschfrist | Produktionsfrist für Abrechnung, Kostenanalyse und Missbrauchsschutz |
| Support- und Vertragsanfragen | solange für Bearbeitung, Vertragsanbahnung und Nachweis erforderlich | reguläre Frist nach Abschluss oder letzter Kommunikation |
| Vertrags-, Rechnungs- und Steuerdaten | solange gesetzliche Aufbewahrungs- und Nachweispflichten gelten | Steuerberatung bestätigt konkrete österreichische Frist und Beginn |
| Anbieter-Konto- und Zahlungsdaten | Anbieterregeln sowie gesetzliche Pflichten, soweit der Anbieter eigenständig Verantwortlicher ist | Rollen, Fristen und Löschmöglichkeiten je produktivem Konto |

## Konkreter Freigabevorschlag

`EXTERNAL_APPROVAL_REGISTER.md` enthält nun einen entscheidungsreifen
Fristenvorschlag für CRM-Daten, Support-/Vertragsanfragen, KI-Kostenereignisse,
Steuerbelege und Backups. Diese Werte sind noch keine öffentliche Zusage und
werden erst nach Bernds Entscheidung sowie Rechts-/Steuerbestätigung von hier
in Code, Datenschutzerklärung und AVV übernommen.

Für steuerrelevante Bücher, Aufzeichnungen und zugehörige Belege nennt
[§ 132 BAO](https://www.ris.bka.gv.at/eli/bgbl/1961/194/P132/NOR12056847)
grundsätzlich sieben Jahre ab dem gesetzlichen Fristbeginn und bei relevanten
anhängigen Verfahren gegebenenfalls länger. Welche FanMind-Datensätze darunter
fallen, muss die Steuerberatung verbindlich abgrenzen.

## Produktions- und Rechtsabschluss

Vor echtem Drittpersonen-Onboarding müssen mindestens folgende Nachweise
zusammengeführt werden:

1. produktive Supabase-Region und aktive Lösch-/Retention-Migrationen;
2. Exoscale-Zone, PM2-/journald-Status und aktuelle Hostkonfiguration;
3. konkret akzeptierte DPA und Unterauftragsliste jedes aktiven Anbieters;
4. rechts-/steuergeprüfte Fristen für CRM-, Support-, Vertrags-,
   Rechnungs- und KI-Kostenereignisse;
5. kontrollierte Offsite-Löschregel mit Quarantäne-/Rollback-Schutz;
6. Restore-Drill, der auch das Verhalten gelöschter Daten in Backup-Zyklen
   belegt;
7. Abgleich der freigegebenen Werte mit `/datenschutz`, AVV und
   Kundenvertrag.

Der externe Status wird strukturell mit
`npm run legal:evidence:check` validiert. Vor echtem Drittpersonen-Onboarding
muss zusätzlich `npm run legal:evidence:require-complete` erfolgreich sein.

Bis diese Punkte bestätigt sind, darf weder dieses Register noch die
öffentliche Datenschutzerklärung als pauschale DSGVO-Konformitätsgarantie
ausgegeben werden.
