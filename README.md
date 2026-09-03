# FanMind

FanMind ist ein KI-gestütztes CRM und Copy-&-Open-Kommunikationssystem für Fan-/Kontaktbeziehungen. Der aktive Web-Kern umfasst Login, temporären Demo-Workspace, Dashboard, Kontakte, Kontaktdetail, CSV-Import, serverseitige KI-Antwortvorschläge, Kontaktwissen, Follow-ups und Roadmap. Zusätzlich besteht unter `apps/mobile` ein eigenständiger nativer Android-/iOS-App-Kern.

## Schnellentscheidung / Reader-Stand

Dieser Reader folgt der aktuellen Source of Truth in `docs/SOURCE_OF_TRUTH.md`.

- Aktive Kernfunktionen: Login, Registrierung, geschütztes Dashboard, Kontakte, Kontaktdetail, CSV-Import, KI-Antwortvorschläge, Kontaktwissen, Follow-ups, Roadmap und temporärer Demo-Workspace.
- Meta Content Intelligence: mandantengetrennte Facebook-/Instagram-Verbindung, eigener Post-/Insight-Cache, inkrementell gespeicherte autorisierte Chats/Kommentare sowie Fan-/Nutzer-Schreibstilanalyse sind als fail-closed Grundlage vorbereitet. Beim ersten Facebook- oder Instagram-DM-Abgleich werden höchstens 150 aktuelle Nachrichten je Thread geladen, danach nur neue Ereignisse ergänzt. Verbindungsweite Conversation-Seiten sind auf 25 Einträge je Ausführung begrenzt; eine server-only Fortsetzung verhindert das Fortschreiben des globalen Sync-Zeitpunkts vor der letzten Provider-Seite. Inbound-Webhooks führen keine Meta-Historienabfrage mehr im Request aus. Die langlebige, workspace-/connection-/thread-gebundene Nachholqueue bündelt Duplikate und lässt ausschließlich einen service-role-Worker mit Lease, fünf begrenzten Versuchen und festen Fehlercodes arbeiten. Fortsetzungs- und Queue-Objekte wurden am 26. August 2026 im isolierten Staging als vorhanden/read-only korrekt beobachtet; der Ledger-Zeitstempel der ledger-geführten Fortsetzung wurde dabei nicht separat bewiesen, während die kontrollierte Queue absichtlich ledgerfrei ist. Worker und Flag bleiben inaktiv, synthetische Acceptance und reale Provider-Abnahme offen. KI Standard/Plus/Ultra verwenden serverseitig 50/100/150 aktuelle Nachrichten. Persönliche fremde Profile/Posts werden nicht gespiegelt oder gescrapt. Bis Staging-Acceptance, Meta App Review und Rechtsfreigabe bleibt alles Beta/inaktiv; Details in `docs/integrations/META_CONTENT_INTELLIGENCE.md`.
- Meta-Nachholqueue: `npm run db:meta-catchup-queue:check` prüft den einzeln freizugebenden SQL-Schritt bytegenau offline. Der read-only Objekt-/Postflight-Verify vom 26. August 2026 ist abgeschlossen. Als kontrollierter Schritt besitzt die Queue absichtlich keinen Supabase-Migrationsledger-Eintrag; eine spätere Datenbankaktion muss Queue-Objekte und vollständigen Postflight über den gemeinsamen Rollout-State frisch als `verify`, `apply` oder `block` klassifizieren. Bloße Tabellenpräsenz autorisiert keinen Apply. Die rollback-only Acceptance verwendet nur den markierten synthetischen Workspace und prüft Browser-Sperren, Scope, Coalescing, Generationen, exklusive Leases, Restart-Übernahme sowie fünf Retries bis `dead_letter`, ohne Meta-, Analyse- oder Versandaufruf. Diese Acceptance, Worker-E2E und Aktivierung bleiben offen; kein Web-Deploy wendet die Migration an oder startet den Worker. Ablauf und Rollback: `docs/operations/META_CATCHUP_QUEUE.md`.
- Meta-Conversation-Fortsetzung: `npm run db:meta-conversation-continuation:check` prüft die bytegenau gebundene server-only Migration offline. Der read-only Objekt-/Postflight-Verify vom 26. August 2026 bestätigte Spalten, Paar-/Cursor-Constraint und Browser-Sperren mit Rollback; der Migration-Ledger-Zeitstempel wurde nicht separat bewiesen. Vor jeder späteren Datenbankaktion muss der gemeinsame Rollout-State den exakten Zeitstempel und die Objekte für denselben Commit und dasselbe Ziel frisch als `verify`, `skip`, `apply` oder `block` klassifizieren. Realer Meta-Test und Aktivierung bleiben offen; Ablauf: `docs/operations/META_CONVERSATION_CONTINUATION_STAGING.md`.
- Workspace-Verarbeitungsgrenze: Ein eigener exakter-Commit- und Staging-gebundener rollback-only Workflow ist für die reale Sperr-/Grace-/Override-/Testzugang-/Reaktivierungsabnahme vorbereitet. Er akzeptiert nur einen speziell markierten synthetischen Workspace, ruft weder Meta noch Stripe auf und gibt ausschließlich feste Zähler aus. Der externe Lauf und der spätere Meta-Ende-zu-Ende-Nachweis bleiben offen; Ablauf: `docs/operations/WORKSPACE_PROCESSING_STAGING_ACCEPTANCE.md`.
- Meta-Staging-Migration: `npm run db:meta-content:check` prüft die beiden
  unveränderten SQL-Dateien offline. Der manuelle Workflow `FanMind Meta
  Content Staging Resource Readiness` prüft davor ohne Schreibfreigabe die
  getrennte Zielbindung, den IPv4-kompatiblen Supabase-Session-Pooler und den
  Schema-Zustand; partielle oder driftende Schemata werden gesperrt. Erst der
  getrennte Workflow `FanMind Meta Content Staging Migration` ist an `main`,
  den exakten geprüften Commit, ein geschütztes isoliertes Staging, getrennte
  Production-Zielwerte und TLS gebunden. Apply und RLS-/Spaltenrechte-
  Postflight sind getrennt vom Web-Deploy; Meta-Verbindungen und Analysen
  bleiben deaktiviert. Ablauf:
  `docs/operations/META_CONTENT_STAGING_MIGRATION.md`.
- Mobile-App: eigenständiger React-Native-/Expo-Kern für Android und iOS mit Login, Passwort-Recovery, Dashboard, Owner-Kontaktanlage/-bearbeitung, Member-Nur-Lesezugang, sichtbarem read-only Gesprächsverlauf, Kontaktwissen, KI-Antwortvorschlägen, kopierbarer und nativ teilbarer Antwort, Follow-ups, verschlüsselter Offline-Kontaktübersicht und sicherem lokalen Daten-Purge. Repositoryseitig sind außerdem datenschutzarme `message_received`- und höchstens eine gebundene `message_reminder`-Entscheidung samt authentifiziertem Tap zum exakten Fan in `Nachrichten` vorbereitet; Provider-Zustellung, Delivery-Ledger-Apply, Route/Timer/Worker und Production-Aktivierung bleiben deaktiviert. Signierte Builds und Store-Verteilung bleiben separat abzunehmen.
- Mobile-Signing-Gate: ein manueller `main`-gebundener Ablauf kann nach
  erfolgreichem Ressourcencheck genau einen credential-frozen internen
  Development-/Preview-Build einreihen und dessen EAS-Endstatus read-only bis
  zum erfolgreichen internen HTTPS-Artefakt prüfen. Eine unklare Queue- oder
  Abschlussantwort darf nicht automatisch wiederholt werden, sondern muss
  zuerst direkt im geschützten EAS-Projekt geprüft werden; Gerätetest und
  Store-Verteilung bleiben externe Nachweise.
- Öffentliche Registrierung: dauerhaft ausschließlich Starter Flex und Starter 12 Monate; der 1-€/Tag-Test ist kein öffentliches Katalogangebot und kann nur für ein ausdrücklich gestartetes, maximal 24 Stunden offenes Beta-Fenster sichtbar werden. Die Freigabe bleibt fail-closed, bis der getrennte `service_role`-Provisioning-RPC, der Entzug direkter Browser-Inserts sowie Daily-Preis, Stripe-Secret, App-URL und Webhook-Konfiguration gemeinsam bereit sind.
- Kostenlose Demo: temporärer, geschützter Demo-Workspace; kein entgeltliches Pilot-Paket.
- Beta-/Testzugang: Das interne Stripe-Live-Testabo `internal_daily_test` kostet 1 €/Tag, ist täglich kündbar und bleibt von Referral ausgeschlossen. Es nutzt dieselbe Checkout-, Zahlungs-, Webhook-, Verlängerungs-, Fehlzahlungs-, Reaktivierungs- und Kündigungs-Engine wie der Starter-Tarif, ist aber kein drittes dauerhaftes öffentliches Paket. Eine ausnahmsweise Registrierungsfreigabe läuft spätestens nach 24 Stunden automatisch ab. Nach E-Mail-Bestätigung ist eine erneute ausdrückliche Daily-Auswahl nur bei frisch serverseitig bestätigtem Zeitfenster, RPC und vollständigem Stripe-Vertrag möglich; gespeicherte Profilmetadaten gelten dafür nicht als Tarif- oder Zustimmungsnachweis. Der sichere Datenbank-Rollout folgt `docs/operations/INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING.md`.
- Billing-Steuermodus: veröffentlichte Beträge sind Nettopreise. `FANMIND_TAX_MODE=stripe_tax` plus die getrennte Registrierungsbestätigung sind Pflicht; ohne beides bleibt Checkout fail-closed. Für steuerpflichtige Österreich-Umsätze gelten 20 %, international bestimmt Stripe Tax den anwendbaren Satz oder Reverse Charge. Die externe steuerliche Prüfung bleibt im Freigaberegister offen.
- Kommerzielle Wahrheit: Starter-Grundgebühr `312 €/Monat`.
- Starter Flex: `990 € einmalige Einrichtung + 312 €/Monat`; jederzeit zum Ende des laufenden, vollständig zu bezahlenden Abrechnungsmonats kündbar.
- Starter 12 Monate: `0 € Setup + 312 €/Monat`; zwölf Monate Mindestlaufzeit, danach Verlängerung um jeweils einen Monat.
- Starter-Abos können unter `/settings/package` zum serverseitig berechneten Vertragsende vorgemerkt und vor Wirksamkeit zurückgenommen werden; Account-Löschung bleibt ein separater DSGVO-Prozess.
- KI Standard: in der Starter-Grundgebühr enthalten.
- KI Plus: zusätzlich `100 €/Monat`.
- KI Ultra: zusätzlich `200 €/Monat`.
- Im Core sind `10` Social-/Kommunikations-Connections enthalten; je weitere
  fünf Connections sind als Add-on für `49 €/Monat` vorgesehen.
- Agency bleibt Coming Soon: selbstzahlende Creator können kostenlos durch
  eine Agentur verwaltet werden. Zahlt die Agentur, gelten ein Agency Hub zu
  `312 €/Monat` plus Creator-Lizenzen mit `0/5/10/15 %` Mengenrabatt.
- Zentrale KI-Stufen-Policy: `src/config/aiTiers.mjs` führt Standard, Plus und Ultra; Plus/Ultra bleiben bis zur Modell-/Fallback-, Kontingent-, Runtime-, Stripe-/Staging-, Qualitäts-/Kosten-, Rechts-/Steuer- und ausdrücklichen Production-Freigabe nicht automatisch buchbar.
- Redigierte KI-Stufen-Prüfung: `npm run ai:tiers:readiness` bestätigt aktuell Standard als bereit sowie Plus/Ultra als blockiert. Stufenspezifische externe und technische Nachweise werden nur als feste Blocker-Codes ausgewertet; konkrete Stripe-IDs, Modelle, Limits, Beleg-IDs oder Secrets werden nicht ausgegeben.
- Nicht aktivierende KI-Stufen-Arbeitsempfehlung:
  `npm run ai:tiers:recommendation` prüft die datierte Modellklassen-,
  Kontingent- und Kostenmatrix offline; produktive KI-Pfade importieren sie
  nicht und Plus/Ultra bleiben blockiert.
- Privater Antwortqualitäts-Eval: `npm run ai:reply-quality:eval` validiert
  ausschließlich numerische Blindbewertungen aus dem von Git ausgeschlossenen
  Eval-Verzeichnis. Prompts, Antworten, Fall-IDs, Reviewer und Provider-
  Modellzuordnungen werden nicht ausgegeben; ein gültiges Ergebnis besitzt
  ausdrücklich keine Aktivierungswirkung.
- Admin-Kostenvergleich: Die KI-Verbrauchsansicht zählt Kontakte/Fans je
  Workspace exakt und zeigt die geschätzten Kosten pro Fan sowie pro
  100/1.000 Fans; fehlende oder leere Fan-Basen bleiben ohne Scheinwert.
  Validierte Schnellansichten decken 24 Stunden sowie 7, 30 und 90 Tage ab;
  die Modellverteilung zeigt Anfragen, geschätzte Kosten, Tokens und Fehler.
  Paginationsbegrenzte Monatsbudget- und Spike-Hinweise beobachten nur,
  blockieren keine KI-Anfrage und behaupten ohne Konfiguration keine Quote.
  Vollständige Tokenwerte der OpenAI Responses API werden serverseitig
  bevorzugt; bei fehlender oder inkonsistenter Provider-Usage greift weiterhin
  die konservative Zeichenlängen-Schätzung. Für erfolgreiche, konsistente
  Events zeigt die Adminansicht zusätzlich P50, P90 und P95 der Input-,
  Output- und Gesamttokens je Feature als nicht aktivierende
  Kontingent-Entscheidungsgrundlage.
- Serverseitiger Entitlement-Vertrag: fehlende, unbekannte, client-kontrollierte, pausierte, nicht gestartete, abgelaufene oder unvollständig freigegebene Plus-/Ultra-Zustände fallen immer auf KI Standard zurück.
- Persistenter Entitlement-Speicher: server-only Tabelle und redigierender
  Loader sind auf dem getrennten Supabase-Staging migriert und nachgeprüft;
  der echte Stripe-Webhook enthält nun eine standardmäßig inaktive Lifecycle-
  Brücke. Eine noch nicht angewendete kontrollierte Erweiterung bereitet ein
  persistentes Event-Ledger und eine atomare CAS/RPC-Grenze vor. Sie arbeitet
  erst bei eigenem Persistence- und Ledger-Gate, bestätigtem Workspace-Vertrag
  und zwei unterschiedlichen serverseitigen KI-Price-IDs. Sekundenkollisionen
  werden dauerhaft `reconciliation_needed` und fallen auf Standard zurück;
  Event-IDs werden nicht als Reihenfolge missbraucht.
  Kanonische Reconciliation bindet einen legitimen Wechsel der Basis-
  Subscription an die exakt erwartete alte Entitlement-Subscription, Revision,
  Request-ID und Fingerprint. Ihr persistierter Snapshot-Cutoff verhindert
  auch ohne bezahlte Zeile, dass ältere oder gleichzeitige signierte Events
  erneut aktivieren.
  Production-Migration und produktive KI-Nutzung sind nicht freigegeben,
  der kanonische Reconciliation-Worker und die echte Abnahme fehlen weiterhin,
  daher bleiben Plus/Ultra blockiert.
- Basis-Billing-Event-Ledger: Eine zweite, ebenfalls nicht angewendete und
  standardmäßig dormante kontrollierte Erweiterung umfasst Checkout, Invoice,
  Subscription, PaymentIntent, Refund/Dispute und Tax. Sie persistiert
  unaufgelöste signierte Events, bindet rotierende/historische Stripe-Objekte
  tenant-sicher, verhindert verspätete Reaktivierung und verlangt bei
  Sekundenkollisionen einen request-id-/Fingerprint-/Revision-gebundenen
  kanonischen Abgleich. Ein zweistufiges Gate kann nach kontrolliertem Apply
  zuerst nur Events erfassen/fail-closed halten und Projektionen erst nach dem
  kanonischen Cutover freigeben. Bestehende Stripe-Workspaces starten im
  `controlled_cutover`; kein Web-Deploy wendet SQL an oder aktiviert das Gate.
  Der Apply prüft das exakte Schema sowohl innerhalb seiner Transaktion als
  auch danach unabhängig read-only; beide Ledger-Workflows verlangen zuvor
  den gemeinsamen Rollout-State mit der exakten Aktion `apply` und `PASS`.
  Ablauf: `docs/operations/STRIPE_BILLING_EVENT_LEDGER.md`.
- Kontrollierter Entitlement-Migrationspfad: `npm run db:ai-tier-entitlements:check` prüft die festgeschriebene Migration offline; `verify` und `apply` sind explizit zielgebunden und führen niemals automatisch durch einen Web-Deploy aus. Der manuelle, ausschließlich auf `main` und das GitHub-Environment `staging` begrenzte Workflow `FanMind AI Tier Staging Migration` bereitet den echten Staging-Apply samt Postflight vor.
- KI-Stufen-Staging-Abnahme: manueller rollback-only Workflow für getrennte
  Staging-Datenbank, synthetischen Owner-/Member-Workspace und Stripe-Testpreise
  ist vorbereitet; er wendet keine Migration an und der echte externe Lauf
  steht noch aus.
- KI-Stufen-Ressourcencheck: ein vorgelagerter manueller Read-only-Workflow
  prüft auf `main` die getrennte Staging-Bindung, zwei aktive Stripe-Testpreise
  zu 100/200 Euro pro Monat sowie einen synthetischen Workspace mit
  unterschiedlichem Owner und Member. Er aktiviert keine Schreibfreigabe,
  liest keine Entitlement-Daten und wendet keine Migration an.
- Restore-Host- und Ressourcencheck: Vor jedem geschützten Restore-Job prüft
  ein eigener secretfreier Workflow das root-owned Host-Gate auf der
  exakten Fünf-Label-Route und der erwarteten Runner-Identität
  `fanmind-restore-01`. Die Labels sind nur Scheduler-Selektoren. Im derzeit
  öffentlichen, persönlich gehaltenen Repository bleiben alle drei Workflows
  vor dem Self-hosted-Job gesperrt. Erst ein Organisations-Transfer, die auf
  diese drei `main`-Workflows beschränkte Gruppe `fanmind-restore-drill` und die
  danach gesetzte Scope-Bestätigung erlauben eine Runner-Registrierung.
  Ressourcen- und Datenbankworkflow
  benötigen anschließend jeweils einen zweiten frischen One-Job-JIT-Runner;
  kein persistenter oder nur gleich gelabelter Runner genügt. Der manuelle,
  nur auf `main` ausführbare checksum-only Ressourcenworkflow prüft danach das
  isolierte Ziel und das verschlüsselte Full-Backup. Er verbindet sich nicht
  mit PostgreSQL, entschlüsselt keine Daten und aktiviert keine
  Schreibfreigabe. Der getrennte transaktionale Restore-Runner erzeugt nach
  einem echten isolierten Restore zusätzlich nur bei 5/5 vorhandenen
  Kerntabellen, 5/5 aktivierter RLS und 5/5 Policy-Abdeckung einen privaten,
  SHA-gebundenen Datenbank-Postcheck-Beleg. Ein getrennter commit-genauer
  Workflow führt die Datenbankphase nach dieser externen Freigabe kontrolliert auf dem isolierten Runner
  aus: private age-Identity, Passfile und CA werden symlink-sicher eingefroren,
  jede Verbindung nutzt TLS `verify-full`, und nur die drei privaten
  Receipts werden drei Tage geschützt bereitgestellt. Das Full-Backup-Receipt
  ist dabei ein vertraulicher privater Beleg mit einer begrenzten Liste
  erforderlicher Datenbankrollennamen; nur Runner- und Postcheck-Receipt sind
  namenfrei. Wegwerfziel-Cleanup,
  Storage-Sample, Server-Konfigurationsprüfung und finaler Evidenznachweis
  bleiben für den echten externen Drill offen.
- Mobile-Release-Ressourcencheck: ein manueller, nur auf `main` ausführbarer
  Read-only-Workflow prüft je geschützter Development-/Preview-/Production-
  Umgebung die EAS-Projektbindung, App-Identität und ausschließlich öffentliche
  Client-Konfiguration. Geschützte Owner-/Projektvariablen ergänzen die
  statische App-Konfiguration erst bei der Expo-Auswertung. Der Workflow
  verwendet weder Build, Submit noch Update und lädt keine Signing Credentials;
  Preview und Production sind über die geschützten Läufe `33298699290` und
  `33316105624` für ihre jeweiligen exakten Merge-Commits bestätigt.
- Mobile-Build-Abschluss: Der getrennte signierte Build-Ablauf prüft nach
  exakt einer validierten Queue-Antwort mit `build:view` denselben Commit,
  Plattform, Profil, interne Distribution, erfolgreichen EAS-Endstatus und
  das vorhandene HTTPS-Artefakt. Build-ID und URL bleiben privat; Submit,
  Update, Gerätetest und Store-Verteilung werden dadurch nicht ausgeführt.
- Mobile-Android-Store-Build: Der eigenständige, manuell bestätigte
  Production-Ablauf läuft nur auf `main` und Android. Er prüft auf demselben
  Commit zuerst Store-Metadaten, Branding, Version, native Identität und das
  AAB-Profil, danach die exakte EAS-/FanMind-Production-Bindung. Vorhandene
  Credentials werden eingefroren; akzeptiert wird genau ein erfolgreiches
  Store-Artefakt mit redaktiertem Receipt. Auf exaktem `main`
  `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` bestand der geschützte
  Production-Ressourcencheck; der getrennte Lauf `33316172583` erzeugte und
  verifizierte genau ein Android-`1.0.0`-AAB. Submit, Update, Play-App-Anlage
  und Veröffentlichung blieben getrennt und deaktiviert. Google prüft das
  Entwicklerkonto weiterhin; Telefonbestätigung und App-Anlage sind bis dahin
  gesperrt. Dieses AAB bleibt das Artefakt für den späteren Play-App-Datensatz,
  Test-Track und den bestehenden Android-Baseline-Nachweis; es wurde vor dem
  nativen `message_received`-/`message_reminder`-Tap-Handler gebaut und kann
  deshalb die neue Nachrichten-Push-Funktion nicht abnehmen. Deren späterer
  realer Gerätenachweis erfordert nach den Push-Staging-/Delivery-Ledger-Gates
  einen separat geprüften signierten Android-Build mit dem gemergten Handler.
- Mobile-Push-Staging-Kontrolle: Die Registrierungstabelle ist auf dem
  getrennten Supabase-Staging mit RLS angewendet und besitzt
  jetzt getrennte manuelle Pfade für read-only Ressourcenprüfung,
  checksum-gebundenen Staging-Apply und rollback-only Acceptance. Alle sind an
  `main`, den manuell geprüften exakten Commit und das geschützte
  `staging`-Environment gebunden; Production-Ziele, echte Push-Tokens und
  Zustellung bleiben ausgeschlossen. Die rollback-only Acceptance steht noch
  aus.
- Mobile-Push-Delivery-Grundlage: Ein serverseitiger Einzelsender für fällige
  offene Follow-ups, feste inhaltsfreie Payloads mit einstündiger TTL, exakte Tenant-Bindung und
  unabhängig geprüfte EAS-, Staging-App-, Staging-Supabase- und Production-
  Supabase-Ziele, Retry-Entscheidung und Expo-Ticket-/Receipt-Auswertung ist
  synthetisch testbar vorbereitet. Zusätzlich ist repositoryseitig eine
  datenschutzarme Policy für `message_received` und höchstens eine gebundene
  `message_reminder`-Entscheidung vorbereitet; ein gültiger Tap wartet auf Auth
  und öffnet ausschließlich den exakt gebundenen Fan in `Nachrichten`.
  Nachrichten-Provider-Zustellung, Delivery-Ledger-Apply, Route/Timer/Worker
  und Production-Aktivierung bleiben ebenso deaktiviert. Der Follow-up-Sender
  besitzt bewusst weder Route noch Timer/Worker und bleibt ohne geprüfte
  Bindings und einen separat genehmigten atomaren Delivery-Ledger vollständig
  deaktiviert. Dessen Reserve-RPC muss dasselbe validierte Supabase-Binding wie
  der Loader sowie den aktuellen Registrierungs-/Token-Fingerprint atomar
  revalidieren; Production ist strukturell gesperrt. CI verhindert eine
  unbemerkte Verdrahtung als Route, Worker, Timer oder Migration.
- Website-Chat-Sicherheitsgrundlage: deaktivierte, workspace-gebundene
  Installationen, exakt verifizierte HTTPS-Origins und kurzlebige,
  consent-gebundene Besuchersitzungen sind als service-role-only Grundlage
  vorbereitet. Im Browser bleibt nur ein zufälliges Sitzungstoken; gespeichert
  wird ausschließlich dessen HMAC-SHA256-Bezug. Eine getrennte, idempotente
  server-only Ingestion kann gültige Besuchernachrichten als Kontakt,
  Conversation und eingehende Nachricht in die vorhandene Admin-Inbox
  übernehmen. Ein cookie-freies, consent-first Einweg-Widget ist vorbereitet
  und nutzt ausschließlich diese Session- und Ingestion-Endpunkte. Es hält das
  Sitzungstoken nur im Speicher und bestätigt lediglich den Empfang;
  Besucher-KI, Rückkanal und Outbound-Versand sind nicht aktiviert.
- WhatsApp Cloud API besitzt einen getrennten, standardmäßig deaktivierten
  und in Production technisch gesperrten Inbound-Textpfad. Getrennte Secrets,
  Raw-Body-HMAC, exakte Phone-ID-Tenant-Bindung, atomarer Lease-/CRM-Store und
  Disconnect sind vorbereitet; Controlled Migration, reales Staging-/Meta-
  Konto, Provider-/Legal-Freigaben und jede Aktivierung bleiben offen. Es gibt
  keinen Send-Endpunkt und keine Provider-Aufrufe.
- Vorbereitetes Inbox-Handoff: Production besitzt `assigned_user_id` noch
  nicht; die Anwendung erkennt die fehlende Spalte und blendet Übernehmen und
  Freigeben fail-closed aus. Der Codepfad darf erst nach einem getrennten, in
  Staging abgenommenen Datenbank-, RLS- und Spaltenrechte-Rollout aktiviert
  werden. Danach können autorisierte Workspace-Mitglieder eine Conversation
  exklusiv übernehmen und nur ihre eigene Zuweisung freigeben; Status,
  nächster Schritt und Nachrichtentext bleiben unverändert und es wird nichts
  automatisch versendet.
- Vorbereiteter KI-Add-on-Lifecycle: eine serverseitige Price-Allowlist sowie
  fail-closed Regeln für Workspace-Ziel, Subscription-Item, doppelte,
  verspätete und gleichzeitige Stripe-Events. Der echte Webhook enthält die
  standardmäßig inaktive, zielgebundene Persistenzbrücke; der Speicher ist nur
  auf dem getrennten Staging angewendet. Production-Datenbank, produktive
  KI-Routen und Plus-/Ultra-Aktivierung bleiben gesperrt.
- Referral-Rabatte gelten nur auf die Starter-Grundgebühr von 312 €/Monat. Einrichtung, KI-Add-ons, Connection-Pakete und Agency-Erweiterungen sind nicht rabattfähig; Referral und Agency-Mengenrabatt sind nicht kombinierbar.
- Growth, Agency und Enterprise bleiben Roadmap / Coming Soon / Auf Anfrage, bis sie ausdrücklich freigegeben sind.
- Verbindliche Roadmap: Phase 3 = Facebook, Instagram und WhatsApp; Phase 7 = TikTok, X/Twitter, Discord und die unverbindliche OnlyFans-Prüfung; Phase 8 = Website-KI-Assistent, iOS/TestFlight, LinkedIn und weitere spätere Plattformanbindungen. Die deaktivierte Sicherheits-, Widget- und Nachrichteningestion-Basis des Website-Assistenten ist begonnen; KI-Dialog, menschliche Eskalation, E-Mail-Rückkanal und produktive Aktivierung fehlen noch. Die übrigen Phase-8-Anbindungen zählen nicht zum aktuellen Verkaufsübergabe-Gate.
- FanMind ist kein Bot: KI bereitet Antworten vor; der Mensch prüft, kopiert und sendet final selbst.
- FanMind garantiert keine fehlerfreien KI-Antworten.
- Externe Integrationen dürfen nicht als allgemein aktive Vollfunktion dargestellt werden, solange sie nicht technisch und rechtlich validiert sind.
- Legal-Readiness: Eine klar als nicht unterschriftsreif begrenzte
  AVV-Arbeitsfassung und ein technisches Retention-Register bündeln Rollen,
  Datenarten, Personengruppen, TOM, Anbieter sowie im Code belegte Fristen.
  Die Datenschutzerklärung nennt das aktive parameterlose Meta-Event und die
  technischen Löschkriterien konsistent. Anbieter-DPAs, Regionen,
  Drittlandgrundlagen, steuerliche Fristen und die finale Rechtsfreigabe
  bleiben externe Abschlussnachweise.
- Ein externes Freigaberegister ordnet UID-/Registerstatus,
  Rechts-/Steuerprüfung, Anbieter-DPAs, Regionen, Transfers, finale Fristen
  und AVV-Annahme konkreten Nachweisen zu. `npm run legal:evidence:check`
  validiert die Struktur; `npm run legal:evidence:require-complete` ist das
  absichtlich fail-closed gesetzte Gate vor echtem Drittpersonen-Onboarding.
  Vertrauliche Belege bleiben außerhalb von GitHub, im Register stehen später
  nur SHA-256-Prüfsummen. `npm run legal:evidence:hash` erzeugt eine solche
  Referenz ausschließlich aus einer lokalen, privaten Belegdatei, ohne Inhalt
  oder Pfad auszugeben und ohne den Registerstatus automatisch zu ändern.
  `npm run legal:evidence:handoff` erzeugt daraus eine datensparsame,
  zuständigkeitsbezogene Liste der noch offenen Controls und Belegarten, ohne
  Werte, Pfade, Kontokennungen, vorhandene Hashes oder abgeschlossene Controls
  auszugeben und ohne einen Status zu verändern.

## Betreiber

Vertragspartner ist **Bernd Guggenberger, Einzelunternehmen unter der Geschäftsbezeichnung FanMind**.

- Geschäftsanschrift: Turnerstraße 18, 2345 Brunn am Gebirge, Österreich
- Inhaber und vertretungsberechtigt: Bernd Guggenberger
- Zuständige Gewerbebehörde: Bezirkshauptmannschaft Mödling
- Kontakt: `kontakt@fanmind.ch`
- Telefon: `+43 676 5367236`

Der Zusatz `e.U.` wird erst nach bestätigter Firmenbucheintragung samt Firmenbuchnummer und Firmenbuchgericht verwendet.

## Gefrorener Gerhard-Demo-Pfad

Der Verkaufsdemo-Pfad ist fest und soll nicht durch Nebenfunktionen überlagert werden:

1. Landingpage öffnen.
2. Login oder kostenlose Demo starten.
3. Dashboard zeigen.
4. Kontakte öffnen.
5. CSV-Import kurz zeigen oder direkt einen Demo-Kontakt öffnen.
6. Kontaktdetail öffnen.
7. letzte eingehende Nachricht als Kontext verwenden.
8. KI-Antwortvorschläge erzeugen.
9. Antwort kopieren.
10. Vorschlag fürs Kontaktwissen speichern.
11. Follow-up-Vorschlag speichern.
12. Follow-up-Liste und/oder Roadmap zeigen.

Alles, was nicht zu diesem Pfad gehört, muss versteckt, als Roadmap/Beta markiert oder aus der Standarddemo herausgehalten werden.

`npm run test:e2e:core-flow` schützt diesen Ablauf zusätzlich als
deterministischen lokalen Code-Nachweis: Der gebaute Server durchläuft echte
FanMind-Routen und Server-Actions gegen eine ausschließlich lokale
Auth-/PostgREST-Fixture; nur die KI-Antwort wird synthetisch erfüllt. Dieser
Nachweis ersetzt weder die isolierte Staging-, Provider- noch
Production-Abnahme.

Der manuelle Workflow `FanMind Staging Core and CSV Acceptance` ist für den
darauffolgenden realen Nachweis vorbereitet. Er bindet sich an den exakt auf
dem isolierten Staging deployten `main`-Commit, führt den Owner-/Member-
Kernfluss mit echter KI Standard und einer kontrollierten CSV aus und beweist
anschließend das vollständige Cleanup. Er ist noch nicht ausgeführt und gilt
deshalb nicht als abgeschlossene Staging-Abnahme.

## Technik

- Framework: Next.js `16.3.0`
- UI: React `19.2.8`
- Mobile: React Native / Expo unter `apps/mobile` mit eigener Navigation, CI und Releasegrenze
- Sprache: TypeScript
- Auth und Daten: Supabase Auth / Supabase PostgREST
- KI: serverseitige OpenAI Responses API
- Deployment: Exoscale + PM2 + nginx über `.github/workflows/deploy-fanmind.yml`
- Produktionsdomain: `https://fanmind.ch`

Installieren und lokal starten:

```bash
npm ci
npm run dev
```

Release-Prüfung:

```bash
npm run verify:truth
npm run lint
npm run test:operations
npm run build
```

## Optionale Marketing-Messung

FanMind besitzt eine zentral im Next.js-Root-Layout eingebundene, consent-gesteuerte Meta-Pixel-Struktur für eine eng begrenzte Allowlist öffentlicher Seiten. Sie ist keine Produkt-Analytics-Suite, läuft nicht auf geschützten CRM-/Admin-/Billing-Seiten und bleibt ohne gültige öffentliche Pixel-ID vollständig deaktiviert.

- Konfiguration: `NEXT_PUBLIC_META_PIXEL_ID`;
- Production-Dataset: `FanMind Dataset`, Pixel-ID `2069553844439892`;
- aktives Event: ausschließlich `PageView`, dedupliziert je freigegebenem öffentlichen App-Router-Pfad und unsensitivem Queryzustand;
- vorbereitet, aber nicht mit Produktaktionen verbunden: `CompleteRegistration`, `Lead`, `ViewContent`, `Contact`, `Schedule`, `StartTrial`, `Purchase`;
- kein Laden vor ausdrücklicher Marketing-Einwilligung;
- keine E-Mail, Namen, CRM-, Kontakt-, Nachrichten-, KI- oder Zahlungsdaten; geschützte same-origin Referrer werden blockiert;
- kein Advanced Matching, keine Conversions API und kein serverseitiges Meta-Tracking.

Die Codeintegration allein aktiviert den Pixel nicht auf Production. Nach gesetzter ENV ist ein neuer Build erforderlich; Consent, Widerruf, genau ein initiales PageView und deduplizierte Client-Navigationen werden gemäß `docs/analytics/META_PIXEL.md` kontrolliert abgenommen.

## Mobile-App

Die Mobile-App ist ein eigener Produktstream und keine eingebettete Website. Web und Mobile teilen ausschließlich freigegebene, RLS-geschützte Backend-Verträge und die serverseitige KI-API.

Bereits vorhanden:

- native E-Mail-/Passwort-Anmeldung und sichere Gerätesitzung;
- PKCE-basierte Passwort-Recovery über `fanmind://reset-password` mit strikter Callback-Validierung;
- Start-Dashboard mit ausschließlich Fans mit ungesehenen eingehenden
  Nachrichten, Kontaktliste, Suche und Kontaktdetail;
- sichtbarer, auf Workspace und Kontakt begrenzter read-only Gesprächsverlauf
  mit bis zu 100 aktuellen Nachrichten; Nachrichten bleiben vom Offline-Cache
  ausgeschlossen und lassen sich für jeden Fan über `Alle` sowie seine
  tatsächlich vorhandenen Plattformen umschalten;
- Kontakte als Workspace-Owner in Mobile anlegen und bearbeiten, jeweils mit Workspace-Filter und RLS; Teammitglieder bleiben im CRM-Nur-Lese-Modus;
- Kontaktwissen und serverseitige KI-Antwortvorschläge;
- Antwort kopieren oder ausschließlich den ausgewählten Antworttext über die
  native Android-/iOS-Teilen-Auswahl weitergeben; FanMind wählt weder Ziel noch
  Empfänger und sendet nicht selbst;
- Follow-ups als Owner direkt beim Fan oder aus einem KI-Vorschlag anlegen,
  offene Follow-ups vollständig seitenweise anzeigen und mit `completed`
  abschließen; Teammitglieder lesen nur, Altdaten mit `done` bleiben
  abgeschlossen und Altdaten mit leerem Status bleiben als offen sichtbar;
- gespeicherte Fan-Analysen nur mit vollständig datiertem Nachrichtenkontext
  und gültiger Provenienz anzeigen; menschlich verworfene Berichte zeigen nur
  den Ablehnungsstatus, niemals ihre Schlussfolgerungen;
- verschlüsselte, höchstens 24 Stunden alte Offline-Übersicht mit maximal 50 Kontakten; nur Name, Handle, Plattform, Status und Änderungszeit, ausschließlich lesbar;
- sicherer lokaler Logout mit Purge aller registrierten FanMind-SecureStore-Schlüssel und des Workspace-Zustands;
- native Push-Grundlage mit validierter Follow-up-Navigation, sicherem
  Login-Handoff, ausdrücklichem Nutzer-Opt-in und vorbereiteter verschlüsselter
  Ein-Gerät-Registrierung für Owner oder autorisierte Workspace-Mitglieder;
  zusätzlich verarbeitet der native Response-Handler die vorbereiteten
  `message_received`- und `message_reminder`-Ereignisse fail-closed und öffnet
  nach Auth-Handoff ausschließlich den exakt gebundenen Fan im Bereich
  `Nachrichten`. Öffentliche Demo-Workspaces und nicht freigegebene EAS-
  Projekte werden abgelehnt. Der getrennte Staging-only Zustellungsbaustein
  besitzt keine Nachrichten-Providerverdrahtung und bleibt ohne Route, Timer,
  Worker und persistenten Delivery-Ledger vollständig inaktiv;
- strikt Staging-only Push-Kontrollpfad mit read-only Ressourcencheck,
  separat bestätigtem checksum-Apply sowie rollback-only Browser-/service-role-
  Abnahme für synthetische Nicht-Demo-Owner/-Member/-Geräte; kein echter Token
  und keine Delivery-Aktivierung;
- nativer Splashscreen mit bestätigter FanMind-Wortmarke, eigenständige
  1024×1024-App-Icons für iOS/Legacy-Android und Android Adaptive Icon sowie
  vorbereitete deutsche/englische Store-Metadaten;
- iOS-Privacy-Manifest mit den Required-Reason-APIs der installierten nativen
  Bibliotheken, ohne Tracking-Domains, sowie fail-closed Android-API-36-Prüfung;
- erster iOS-Release bewusst iPhone-only; iPad erst nach separater Layout-,
  Geräte- und Screenshot-Abnahme;
- getrennte technische Entwürfe für Apple App Privacy und Google Play Data
  Safety; externe Datenschutz-/Rechts- und Portalabnahme bleibt offen;
- fail-closed Store-Preflight für Apple-/Google-Zeichenlimits, bestätigte
  Wortmarke, 1024×1024-Native-Icons, reproduzierbare Google-Play-Grafiken,
  App-IDs, Screenshot-Matrix, Apple-Metadaten-Handoff und eine maschinengeprüfte
  33-Felder-App-Store-Connect-Matrix mit 13/12/8-Trennung in technisch bereit,
  Owner-/Rechtsentscheidung und Phase-8-Nachweis, exakt gepinnte EAS CLI
  `21.2.0` und ausschließlich interne Android-Draft-Submission;
- eigener SDK-57-Development-Client sowie explizite EAS-Umgebungen;
- separate Mobile-CI, Expo Doctor, TypeScript-Check, Android-/iOS-JavaScript-Bundles, isolierter Native-Prebuild sowie echtes Android-Debug-APK und codesign-freie iOS-Simulator-App als reine Build-Nachweise.
- kontrollierter signierter EAS-Workflow mit redigierter Abschlussprüfung für
  exakten Commit, Plattform, Profil, interne Distribution, erfolgreichen
  Endstatus und vorhandenes internes HTTPS-Artefakt; ein exakter Android-
  Preview-Build und die begrenzte UI-/Runtime-Abnahme sind bestätigt.

Noch extern beziehungsweise als nächste Mobile-Phase abzunehmen:

- realer E-Mail-/Gerätetest für `fanmind://reset-password`; der exakte Redirect
  ist in der bestätigten Production-Auth-Allowlist gespeichert;
- vollständiger privater receipt-gebundener 19-Punkte-Android-Gerätenachweis
  erst nach Download und Installation aus dem Play-Test-Track;
- Google-Freigabe des Entwicklerkontos, Kontakttelefon, Play-App-Datensatz,
  Data Safety, Screenshots, portalgefordertes Testprogramm und Upload des
  bereits verifizierten Android-`1.0.0`-AAB. Dieses AAB bleibt der Play-
  Baseline-Artefakt, wurde jedoch vor dem nativen Nachrichten-Push-Handler
  gebaut und ist deshalb kein Nachweis für `message_received` oder
  `message_reminder`; deren realer Gerätenachweis benötigt später einen
  separat geprüften signierten Android-Build mit dem gemergten Handler;
- visuelle Icon-Abnahme sowie reale Push-Berechtigungs-/Registrierungsabnahme
  im signierten Build; anschließend eigener Delivery-Ledger-Entscheid,
  rollback-only Staging-Abnahme und genau ein synthetischer serverseitiger
  Send-/Receipt-Nachweis. Nachrichten-Providerzustellung und Production-Push
  bleiben bis dahin deaktiviert;
- finale Datenschutz-/Rechts- und Play-Portalabnahme;
- iPhone-App-Store-Texte, Review-/Tester-Handoff, Screenshotplan, öffentliche
  Supportseite und die 33-Felder-App-Store-Connect-Arbeitsmatrix sind
  vorbereitet; Konto-/Rechts-/Steuerwerte bleiben offen. Apple Developer /
  App Store Connect, iOS-Build, Gerätenachweis und TestFlight bleiben Phase 8.

Verbindliche Details: `apps/mobile/README.md`, `docs/mobile/ARCHITECTURE.md`,
`docs/mobile/PUSH_DELIVERY.md` und `docs/mobile/BETA_RELEASE.md`.

## Wichtige Routen

| Route | Zweck | Status |
| --- | --- | --- |
| `/` | öffentliche Landingpage | aktiv |
| `/login` | Login und Demo-Einstieg | aktiv |
| `/register` | Starter-Registrierung | aktiv |
| `/support` | öffentliche Hilfe- und App-Store-Supportseite | aktiv |
| `/dashboard` | geschützter Arbeitsbereich | aktiv |
| `/fans` | Kontaktliste | aktiv |
| `/fans/import` | CSV-Import | aktiv |
| `/fans/[id]` | Kontaktdetail, Verlauf, KI, Kontaktwissen und Follow-ups | aktiv |
| `/followups` | Follow-up-Übersicht | aktiv |
| `/settings/profile` | Profil und Workspace-Basisdaten | aktiv |
| `/settings/package` | Starter-Paket, KI-Add-ons und sichere Self-Service-Kündigung zum Vertragsende | aktiv |
| `/settings/invoices` | Rechnungsarchiv | aktiv |
| `/settings/referral` | Referral-Code, Status und Rabattübersicht | aktiv; Billing-Verrechnung separat freizugeben |
| `/referral-bedingungen` | öffentliche Referral-Teilnahmebedingungen | aktiv; automatische Rabattverrechnung weiterhin deaktiviert |
| `/settings/ai-usage` | monatliche KI-Nutzungsanzeige sowie Unternehmens-Prompt und Antwortprofile | aktiv |
| `/billing/start` | Starter-Checkout | aktiv; Legacy-Pilot-Checkout gesperrt |
| `/admin/...` | Admin- und Billing-Grundlagen | admin-only |
| `/api/ai/reply-suggestions` | serverseitiger KI-Endpunkt | aktiv |
| `/api/demo/start` | temporärer Demo-Workspace | aktiv |
| `/api/stripe/webhook` | Stripe-Lifecycle und Referral-Synchronisierung | aktiv; Referral-Rabattverrechnung per Flag deaktiviert |
| `/api/webhooks/meta` | Meta-Webhooks | vorbereitet/Beta |
| `/api/integrations/facebook/start` | Workspace-gebundener Facebook-Login mit ausdrücklicher Seitenauswahl | vorbereitet/Beta; Webhook ergänzt autorisierte Chats inkrementell |
| `/api/integrations/instagram/start` | Workspace-gebundener Instagram Business Login | vorbereitet/Beta; begrenzter DM-Erstabgleich und Webhook-Grundlage für inkrementelle DMs/Kommentare |

## Pakete und KI-Add-ons

| Produkt | Status | Preislogik |
| --- | --- | --- |
| Öffentliche Demo | aktiv | kostenloser temporärer Demo-Zugang; kein entgeltliches Paket |
| Starter Flex | aktiv | 990 € Einrichtung + 312 €/Monat; Kündigung zum Ende des bezahlten Monats |
| Starter 12 Monate | aktiv | 0 € Setup + 312 €/Monat; 12 Monate Mindestlaufzeit, danach monatlich |
| KI Standard | aktiv | in 312 €/Monat enthalten |
| KI Plus | freigegebener Preis, technische Add-on-Aktivierung separat | +100 €/Monat |
| KI Ultra | freigegebener Preis, technische Add-on-Aktivierung separat | +200 €/Monat |
| Internes Live-Testabo | kontrollierter interner Beta-Test | 1 €/Tag; täglich kündbar; gleicher Billing-Lifecycle wie Starter, keine Referral-Verrechnung; kein dauerhaftes öffentliches Paket, temporäre Registrierungsfreigabe höchstens 24 Stunden |
| Growth | Coming Soon | nicht produktiv buchbar |
| Agency | Coming Soon / auf Anfrage | nicht produktiv buchbar |
| Enterprise / Custom | später | individuelle Prüfung |

Keine alten Preise wie `299 €/Monat`, `499 €/Monat` oder `Agency ab 990 €/Monat` wieder einführen.

## Kündigungslogik

### Starter Flex

Starter Flex kann jederzeit gekündigt werden. Die Kündigung wird zum Ende des laufenden, bereits bezahlten Abrechnungsmonats wirksam. Der laufende Monat wird vollständig verrechnet und nicht anteilig rückerstattet.

### Starter 12 Monate

Starter 12 Monate hat eine Mindestlaufzeit von zwölf Monaten. Danach verlängert sich der Vertrag jeweils um einen weiteren Monat, sofern er nicht gekündigt wird.

## Referral Growth Window

Das Empfehlungsprogramm ist bis zum globalen Ziel von 2.000 aktiven zahlenden Workspaces begrenzt:

- 5 % Rabatt je aktivem geworbenem zahlenden Workspace;
- maximal 20 aktive Referrals beziehungsweise 100 % Rabatt;
- Rabatt ausschließlich auf die Starter-Grundgebühr von 312 €/Monat;
- kein Rabatt auf Einrichtung oder KI Plus/Ultra;
- kein negativer Rechnungsbetrag und keine Barauszahlung;
- bei Kündigung, Nichtzahlung, Refund oder Chargeback entfällt der jeweilige Rabatt;
- Referral-Live-Billing bleibt bis zur kontrollierten Freigabe mit `FANMIND_ENABLE_REFERRAL_BILLING=false` deaktiviert.
- Attribution-Integrität und Lifecycle werden in Staging über getrennte,
  commitgebundene Verify/Apply/Acceptance-Workflows abgenommen; Details stehen
  in `docs/operations/REFERRAL_ATTRIBUTION_STAGING.md`.

Details: `docs/REFERRAL_PROGRAM.md` und `docs/operations/referral-stripe-sandbox-runbook.md`.

## ENV und Secrets

Siehe `.env.example` für Platzhalter. Echte Werte gehören nur in lokale oder Server-ENV-Dateien und niemals ins Repository.

Regel: Alles mit Service Role, Secret, Token, Stripe, OpenAI, Plattform-App-Secret oder Admin-E-Mail ist server-only. Keine echten Werte in `.env.example`, Logs, Screenshots, Client-Code oder Dokumentation.

## Datenbank und RLS

Die aktuelle Datenbankwahrheit steht in:

- `docs/database/fanmind_current_schema.md`
- `supabase/migrations/`
- `supabase/controlled/` für einzeln freizugebende Contract-Schritte
- `src/lib/supabase/server.ts`

Workspace-scoped Daten müssen per RLS und serverseitiger Autorisierung geschützt sein. Vor echten Kundendaten ist `docs/SECURITY_RLS_SECRETS_CHECK.md` abzuarbeiten.

Die vorbereitete Member-Datengrenze liegt checksum-gebunden unter
`supabase/controlled/20260816120000_workspace_member_data_boundary.sql` und
steht auf `CHECKED_NOT_APPLIED`. Der App-/Renderer-Stand gibt Membern nur das
Safe-DTO und hält Web- und Mobile-Mutationen Owner-only. Die direkte
PostgREST-/JWT-Grenze ersetzt den Zugriff auf die volle Workspace-Zeile,
härtet CRM-/AI-/Content-Writes auf aktive Owner und reduziert
`social_connections` jedoch erst nach dem isoliert nachgewiesenen Control-
Apply. Bis Apply plus Postflight belegt sind, bleibt diese direkte DB-Grenze
ein Go-live- und Member-Aktivierungsblocker. Auch danach aktiviert sie keine
Member-Schreibrechte; dafür wäre ein separat geprüfter atomarer DB-RPC-Vertrag
nötig. Der getrennte, geschützte Staging-Pfad ist vorbereitet: exakten
App-Commit zuerst deployen, kontrollierten Apply ausführen, unabhängig
read-only verifizieren und erst dann die reale Chromium-/CSV-Abnahme mit
abschließendem Postflight starten. Kein normaler Deploy und keine generische
Migration wenden den Control an. Runbook:
`docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md`.

Die Härtung serververwalteter Workspace-Felder wird deploy-before-migrate als
Expand-/Contract-Rollout ausgerollt: Der App-Brückenstand fällt ausschließlich
bei einem exakt fehlenden RPC auf den bisherigen Insert-Pfad und bei einer
exakt fehlenden Step-A-Spalte auf den älteren kommerziellen Core zurück.
Allgemeine Reads und Demo-Updates setzen diese Spalten nicht voraus. Danach
folgen Production-Preflight, additive Spalten-/RPC-Migration und
Schema-Nachweis. Der abschließende Privileg-Entzug liegt absichtlich als
kontrollierter SQL-Schritt außerhalb des automatischen Migration-Sets. Ein
normaler Web-Deploy wendet beides nicht automatisch an; verbindlicher
Production-Preflight und Abnahme stehen in
`docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md`.

## KI und Kostenkontrolle

- KI läuft serverseitig.
- API-Keys werden nicht im Browser verwendet.
- Eingaben, geladene Kontextzeilen, Ausgaben und Aufrufraten werden technisch
  begrenzt; diese Missbrauchs- und Kostengrenzen sind keine vertraglichen
  KI-Kontingente.
- Ausgaben sind strukturiert.
- KI-Nutzung wird je Workspace gemessen.
- Ein Workspace-Unternehmens-Prompt und bis zu acht auswählbare Antwortprofile steuern Ton, Wortwahl und belegte nächste Schritte; der Browser sendet an die KI-Route nur die Profil-ID, die Prompttexte werden serverseitig geladen.
- Sicherheits-, Wahrheits-, Datenschutz-, Schema- und Manuell-Senden-Regeln haben immer Vorrang vor Workspace-Prompts.
- Es gibt keine automatische Sendefunktion.
- Nutzer müssen KI-Ausgaben vor Verwendung prüfen.
- FanMind garantiert keine fehlerfreien, vollständigen oder aktuellen KI-Antworten.

Provider-Preise bleiben serverseitig konfigurierbar und werden nicht als statische UI-Wahrheit hartcodiert.

Details zur Promptverwaltung: `docs/AI_PROMPT_PROFILES.md`.

## Harte Stop-Regeln

Nicht als aktiv bauen oder verkaufen, sofern nicht ausdrücklich freigegeben und validiert:

- vollständige Instagram-, TikTok-, WhatsApp-, Facebook-, X- oder Discord-Integration außerhalb des ausdrücklich abgegrenzten Meta-Pilots;
- Scraping;
- ungeprüftes automatisches Senden;
- externe Plattform-Login-Daten speichern;
- Kampagnenversand-Automation;
- vollständige Analytics-Suite;
- Enterprise-Rollen-/Rechte-Komplexität;
- Fake-Kunden, Fake-Live-Integrationen oder Fake-Metriken.

## Deployment

Deployments auf `main` laufen über `.github/workflows/deploy-fanmind.yml` auf dem Self-Hosted Runner:

Der auf Production aktive isolierte Release-Pfad:

1. löst den exakten 40-stelligen Commit von `origin/main` auf;
2. führt `scripts/operations/deploy-isolated-release.sh` commitgebunden in
   einem neuen unveränderlichen Release-Verzeichnis aus;
3. prüft Product Truth, Lint, Operations-Tests, Next.js-Production-Build,
   Build-Metadaten und nginx, während das bisherige Release weiterläuft;
4. schaltet `/var/www/fanmind-current` atomar auf den neuen Stand und lädt den
   einzelnen PM2-Cluster-Worker rollierend neu;
5. verlangt die exakte Release-ID über `/api/version`, gesunde öffentliche
   Kernrouten und eine lückenlose `200`-Verfügbarkeitsprobe;
6. rollt bei einem Fehler auf das zuvor aktive Release zurück.

Der frühere In-Place-Pfad ist nur noch ein ausdrücklich deaktivierbarer
Notfall-Fallback. Der verbindliche Ablauf und die Rollback-Grenzen stehen in
`docs/operations/ISOLATED_RELEASE_DEPLOY.md`.

Nach jedem erfolgreichen Production-Deploy sowie täglich um 04:17 UTC läuft
zusätzlich der Workflow `FanMind Production Read-only Audit`. Er verwendet nur
die zuvor root-owned installierten Auditdateien, prüft Release/Runtime,
acht Health-Komponenten, PM2, nginx, Login, Hostressourcen, lokale und
Offsite-Backup-Paare sowie Backup-Worker-Fehler und nimmt keine
Service-, Datenbank-, Restore- oder Remote-Mutation vor.

Das Admin Operations Center lädt seine serverseitigen Betriebsdaten nach einer
erfolgreichen Job-Anforderung sofort neu. Solange ein Job `queued`, `claimed`
oder `running` ist, aktualisiert die sichtbare Seite alle 15 Sekunden sowie beim
Zurückkehren in den sichtbaren Tab. Bei erledigten Jobs und im Hintergrund
findet kein Polling-Verkehr statt.

Alle manuellen Backup- und Checksum-Verifikationsanforderungen verlangen eine
ausdrückliche Bestätigung und teilen ein serverseitiges atomares Limit von fünf
Anforderungen je Platform-Admin in zehn Minuten. Die Limiter-Identität ist
HMAC-SHA256-pseudonymisiert; bei fehlendem Limiter wird kein Job eingereiht.
Die für `verify_backup` notwendige Constraint-Erweiterung besitzt einen
eigenen checksum- und release-gebundenen Production-Verify/Apply-Ablauf. Ein
normaler Web-Deploy installiert nur den root-owned Kontrollpfad und wendet die
Datenbankmigration nicht automatisch an.

Die für den Operations Monitor benötigte Constraint-Erweiterung bleibt von
diesem Deploy getrennt. Sie wurde am 1. August 2026 kontrolliert angewendet und
unabhängig read-only verifiziert; der Zehn-Minuten-Timer ist aktiv und
Operations-E-Mail bleibt deaktiviert. Der manuelle Production-Control-Workflow
kann nach einem gesunden Probe zusätzlich die feste, E-Mail-freie Folge
Warnung, Kritisch und Recovery auf einer reservierten technischen Komponente
abnehmen. Timer, Probe und Lifecycle teilen ein exklusives Laufzeit-Lock.
Zugangsdaten, SQL-Fehlertext und ungefilterte Journalzeilen werden nicht in
GitHub-Logs ausgegeben. Der reguläre Lauf speichert außerdem den normalisierten
Aktivzustand von `nginx.service` über einen unprivilegierten Read-only-Aufruf;
nginx-Konfiguration und Journal werden dabei nicht gelesen. Ein CPU-
Momentwert wird wegen des Fehlalarmrisikos nicht als eigener Zehn-Minuten-
Alarm geführt.

Die datenschutzsparsame Server-Fehlertelemetrie wurde am 1. August 2026 auf dem
Release `04f2a472c57559393dd2d9c89575edf0ce8141ba` kontrolliert repariert,
unabhängig verifiziert, E-Mail-frei abgenommen und rollback-gesichert aktiviert.
Sie speichert weder Fehlermeldungen noch Stacks, Header, Queryparameter, Bodies,
IP-Adressen oder Kundendaten. Kritische E-Mails bleiben deaktiviert; ein
öffentlicher Fehler-Testendpunkt existiert nicht. Der getrennte read-only
Abschlussaudit vom 1. August 2026 belegte bei unveränderten 40 PM2-Restarts
2.213 Sekunden kontinuierliche Uptime, 8/8 gesunde Komponenten, denselben
Release-Commit sowie weiterhin gesunde lokale und externe Backups.

Ein getrenntes Staging wird ausschließlich manuell über `.github/workflows/deploy-staging.yml` auf einem eigenen `fanmind-staging`-Runner ausgerollt. Der Workflow akzeptiert nur einen von `main` erreichbaren Commit, verlangt den Staging-Preflight und startet den separaten PM2-Prozess `fanmind-staging`. Host, Supabase-Staging-Projekt, Stripe-Testmodus, nginx-vHost und synthetische Testdaten bleiben externe Voraussetzungen.

## Dokumentations-Synchronisierung

Wenn Preise, Pakete, Referral-Logik, aktiver Scope, Demo-Pfad, Billing, KI-Leistungsstufen, Datenbank, Security, Mobile-Verträge oder öffentliche Versprechen geändert werden, müssen `docs/SOURCE_OF_TRUTH.md`, `README.md`, `AGENTS.md`, `apps/mobile/README.md`, `docs/mobile/ARCHITECTURE.md`, `docs/mobile/BETA_RELEASE.md` und die betroffenen Legal-/Pricing-Dateien im selben PR geprüft und synchronisiert werden.
