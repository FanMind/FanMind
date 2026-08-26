# FanMind Source of Truth

Stand: 16. August 2026

Dieses Dokument ist die fachliche Source of Truth für FanMind. README, AGENTS.md, Landingpage, Pricing, Legal-Texte, Datenbank-Dokumentation, Roadmap und Codex-Tasks müssen mit diesem Stand synchron bleiben.

## 1. Produktdefinition

FanMind ist ein KI-gestütztes CRM und Copy-&-Open-Kommunikationssystem für Fan- und Kontaktbeziehungen.

FanMind ist:

- ein CRM-Kern für Kontakte und Fans;
- ein Arbeitsbereich für Nachrichtenkontext, Kontaktwissen und Follow-ups;
- ein serverseitiger KI-Assistent für Antwortvorschläge;
- ein Copy-&-Open-Assistent: Antwort vorbereiten, kopieren, Originalkanal öffnen, Mensch sendet selbst;
- ein System mit klarer Roadmap für Integrationen, Kampagnen, Analytics und spätere Erweiterungen;
- ein System mit einer ausdrücklich freigegebenen, aber noch nicht produktiv aktivierten Grundlage für mandantengetrennte Facebook-/Instagram-Konten, eigene Content-Insights und vorsichtige Kommunikationsanalyse;
- ein eigenständiger nativer Mobile-App-Kern für Android und iOS, nicht als WebView-Hülle.

FanMind ist nicht:

- ein Bot oder Autoresponder;
- eine Scraping-Plattform;
- eine allgemein freigegebene Social-Media-Vollintegration;
- eine Kampagnenversand-Maschine;
- eine vollständige Enterprise-Rollen-, Analytics- oder Payment-Suite.

## 2. Aktiver CRM-Kern

Aktiv beziehungsweise produktnah:

- deutsche und englische Landingpage mit automatischer Sprachprüfung;
- Login und öffentliche Starter-Registrierung;
- kostenloser temporärer Demo-Workspace, getrennt vom entgeltlichen Angebot;
- geschütztes Dashboard;
- Kontakte, Kontaktdetail und Suche;
- CSV-Import und manuelle Kontaktpflege;
- gespeicherter Nachrichten- und Gesprächskontext;
- Kontaktwissen mit Bearbeiten und Löschen;
- Follow-ups;
- serverseitige KI-Antwortvorschläge;
- Kontaktwissen- und Follow-up-Vorschläge aus der KI-Ausgabe;
- Kopieren von Antwortvorschlägen ohne automatische Sendung;
- eigenständiger React-Native-/Expo-App-Kern mit Login, Passwort-Recovery, Dashboard, Kontaktanlage/-bearbeitung, Kontaktwissen, KI und Follow-ups;
- Admin-, Billing-, Operations- und Backup-Grundlagen;
- getrennte kompakte Konto-Seiten:
  - `/settings/profile` für Profil und Workspace-Basisdaten;
  - `/settings/package` für Paket, Status, Betrag, Setup und kontrollierte Paketoptionen;
  - `/settings/invoices` für eigene Stripe-Rechnungen mit Öffnen- und PDF-Links;
  - Self-Service-Kündigung für Starter-Abos zum serverseitig erzwungenen Vertragsende mit separatem Account-/DSGVO-Löschprozess;
- Admin-only Asset-Upload in den Supabase-Storage-Bucket `fanmind-assets`;
- Legal-Seiten, Zahlungsbedingungen und AVV-Anforderungsseite;
- deterministischer lokaler Browser-Code-Nachweis über
  `npm run test:e2e:core-flow`: Login, Dashboard, Inbox, Fan-Detail,
  KI-Antwort, Kopieren, Kontaktwissen, Follow-up samt
  Abschließen/Wiederöffnen und Roadmap laufen durch echte FanMind-Routen und
  Server-Actions gegen eine ausschließlich lokale In-Memory-Provider-Fixture;
  nur die KI-Antwort ist synthetisch. Der Nachweis ersetzt keine isolierte
  Staging-, Provider- oder Production-Abnahme;
- commitgenauer manueller Staging-Kern-/CSV-Abnahmepfad: Der vorbereitete
  Workflow bindet den tatsächlich deployten `main`-Commit, den markierten
  synthetischen Owner-/Member-Workspace, reale KI Standard, CSV-Duplikat- und
  Fehlerzeilen, Zwei-Workspace-RLS sowie ein `always()`-Cleanup. Das
  Member-Passwort wird nicht persistent konfiguriert: Es entsteht maskiert im
  geschützten Hosted Runner, darf erst nach exakter Auth-Marker- und einzelner
  Workspace-Membership-Prüfung gesetzt werden und wird im Cleanup durch ein
  unbekanntes Passwort ersetzt; der bekannte Wert muss danach real als
  `invalid_credentials` abgewiesen werden. Profilbindung, Auth, Membership und
  Workspace werden nach jedem Admin-Write vollständig neu gelesen; Drift oder
  ein unbestimmtes Providerergebnis bleibt auch nach einer bestmöglichen
  unbekannten Rotation auf der zuvor gebundenen UUID rot. Die private
  `GITHUB_ENV`-Datei muss regulär, Runner-eigen, einfach verlinkt und exakt
  `0600` sein. Owner-/Secondary-Zugangsdaten bleiben davon unberührt. Bis zum
  tatsächlichen grünen Lauf bleibt die externe Staging-Abnahme offen;
- consent-gesteuerte Meta-Pixel-Infrastruktur als ausdrücklich begrenzte Marketing-Messung auf einer festen Allowlist öffentlicher Seiten: ausschließlich `PageView` ohne Eventparameter; keine geschützten CRM-/Admin-/Billing-Routen, keine Produkt-Analytics-Suite, kein Laden ohne Einwilligung, keine PII-/CRM-/Billing-Daten, blockierte geschützte same-origin Referrer, kein Advanced Matching und keine Conversions API; vorbereitete Conversion-Events bleiben ohne separate fachliche und datenschutzrechtliche Freigabe unverdrahtet; ohne gültige `NEXT_PUBLIC_META_PIXEL_ID` vollständig deaktiviert;
- internes Live-Testabo `internal_daily_test` mit 1 € pro Tag als kontrollierter echter End-to-End-Billing-Test; gleicher Checkout-, Zahlungs-, Webhook-, Verlängerungs-, Fehlzahlungs-, Reaktivierungs- und Kündigungs-Lifecycle wie Starter; kein Referral-Rabatt, kein dauerhaftes öffentliches Paket; eine temporäre Registrierungsfreigabe läuft spätestens nach 24 Stunden ab, lehnt fehlende, ungültige oder in der Zukunft liegende Startzeitpunkte fail-closed ab und bleibt bis zum abgenommenen `service_role`-Provisioning- und Browser-INSERT-Contract sowie vollständiger Daily-Stripe-/Webhook-Konfiguration geschlossen. Nach einer erforderlichen E-Mail-Bestätigung kann ein noch workspace-loses Konto den Daily-Test auf `/workspace/setup` erneut ausdrücklich auswählen, aber nur solange Zeitfenster, RPC-Readiness und Stripe-Vertrag frisch serverseitig bereit sind; persistente Auth-Metadaten gelten weder als Tarif- noch als Zustimmungsnachweis. Der zugehörige SQL-Schritt liegt einzeln freizugebend unter `supabase/controlled/` und bleibt außerhalb generischer Migration Discovery (`docs/operations/INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING.md`).

Das entgeltliche öffentliche Pilot-/Setup-Paket ist eingestellt. Legacy-Pilot-Checkout bleibt gesperrt. Die kostenlose Demo ist kein entgeltliches Paket.

Vorbereitet, aber in Production noch nicht aktiviert:

- Inbox-Handoff: Production besitzt `assigned_user_id` noch nicht; die
  Anwendung erkennt die fehlende Spalte und blendet Übernehmen und Freigeben
  fail-closed aus. Der Codepfad darf erst nach einem getrennten, in Staging
  abgenommenen Datenbank-, RLS- und Spaltenrechte-Rollout aktiviert werden.
  Danach dürfen autorisierte Workspace-Mitglieder eine Conversation exklusiv
  übernehmen und nur ihre eigene Zuweisung freigeben; Status, nächster Schritt
  und Nachrichtentext bleiben unverändert und es wird nichts automatisch
  versendet.

## 3. Eigenständige Mobile-App

Der Mobile-App-Kern liegt unter `apps/mobile` und wird unabhängig von der Next.js-Website gebaut und veröffentlicht. Er ist keine eingebettete Website und importiert keine Website-CSS- oder Next.js-UI-Komponenten.

Aktiv im App-Kern:

- native Supabase-E-Mail-/Passwort-Anmeldung;
- PKCE-basierte Passwort-Recovery über `fanmind://reset-password` mit strikter Callback-Validierung;
- verschlüsselte Sitzung über `expo-secure-store` und zentralen lokalen Purge beim Abmelden;
- geschützte Expo-Router-Navigation;
- Dashboard, Kontaktliste, Suche und Kontaktdetail;
- Kontakt als Workspace-Owner in Mobile anlegen und bearbeiten, jeweils mit Workspace-Filter und RLS; Teammitglieder bleiben im CRM-Nur-Lese-Modus;
- Kontaktwissen;
- Bearer-authentifizierte serverseitige KI-Antwortvorschläge;
- Antwort kopieren oder ausschließlich den ausgewählten Antworttext an die
  native Android-/iOS-Teilen-Auswahl übergeben; Zielwahl und finaler Versand
  bleiben beim Menschen;
- offene Follow-ups anzeigen und als Owner mit dem kanonischen Status `completed` abschließen; Teammitglieder lesen nur, bestehende `done`-Altdaten bleiben lesekompatibel;
- verschlüsselte, User-/Workspace-gebundene Offline-Kontaktübersicht mit maximal 50 Einträgen, 24-Stunden-Ablauf und Nur-Lesen-Oberfläche;
- native Push-Grundlage mit validierter Follow-up-Navigation, Auth-Handoff,
  Einmalverarbeitung und ausdrücklichem Opt-in für eine verschlüsselte,
  kontogebundene Ein-Gerät-Registrierung für Owner oder autorisierte
  Workspace-Mitglieder. Öffentliche Demo-Workspaces, ungebundene Requests und
  nicht serverseitig freigegebene EAS-Projekte werden abgelehnt; die Migration,
  Serverkey-Aktivierung und echte Geräteabnahme bleiben getrennt. Ein
  Staging-only Serververtrag für genau eine inhaltsfreie Follow-up-Erinnerung
  mit einstündiger TTL ist synthetisch getestet, besitzt aber ohne genehmigten
  atomaren Delivery-Ledger samt transaktionaler Target-Revalidierung und
  unabhängig geprüfte EAS-, Staging-App-, Staging-Supabase- und
  Production-Supabase-Bindings weder Route noch Timer/Worker und bleibt
  deaktiviert;
- checksum-festgeschriebener, strikt Staging-only Kontrollpfad für diese
  Push-Tabelle: ein read-only Ressourcencheck, ein separat bestätigter
  Migrations-Apply und eine rollback-only Acceptance sind vorbereitet. Jeder
  Lauf ist an `main`, den manuell bestätigten exakten Commit und das geschützte
  `staging`-Environment gebunden; Production-API, -Supabase und -DB-Host sind
  ausgeschlossen. Die Acceptance verwendet nur synthetische Nicht-Demo-
  Owner/-Member/-Geräte, prüft Browserverweigerung und service-role CRUD und
  aktiviert weder echte Tokens noch Zustellung;
- nativer Splashscreen mit bestätigter FanMind-Wortmarke, eigenständiges
  hochauflösendes FanMind-App-Icon für iOS/Legacy-Android, sicher skaliertes
  Android-Adaptive-Foreground sowie vorbereitete deutsche/englische
  Store-Metadaten;
- iOS-Privacy-Manifest mit den Required-Reason-APIs der installierten nativen
  Bibliotheken, ohne Tracking-Domains, fail-closed Android-API-36-Nachweis und
  getrennte technische Entwürfe für Apple App Privacy sowie Google Play Data
  Safety;
- fail-closed Store-Preflight für Apple-/Google-Zeichenlimits, bestätigte
  Wortmarke, beide 1024×1024-Iconverträge, App-IDs, sechs synthetische
  Screenshot-Slots, exakt EAS CLI `21.2.0` und eine ausschließlich interne
  Android-Draft-Submission ohne Portalzugriff;
- erster iOS-Store-Scope bewusst iPhone-only; iPad bleibt bis zu einer
  separaten Layout-, Geräte- und Screenshot-Abnahme nicht freigegeben;
- eigener SDK-57-Development-Client sowie explizite EAS-Umgebungen;
- separate Mobile-CI mit TypeScript, Expo Doctor, Architekturgrenze, Android-/iOS-JavaScript-Bundles, isoliertem Native-Prebuild sowie echtem Android-Debug-APK und codesign-freier iOS-Simulator-App als reine Build-Nachweise.
- manueller, `main`-gebundener Read-only-Ressourcencheck für die externe
  EAS-Projektbindung, App-Identität und getrennte öffentliche
  Development-/Preview-/Production-Konfiguration. Die geschützten
  Owner-/Projektwerte ergänzen die statische Expo-Konfiguration erst bei der
  Laufzeitauswertung; ohne Build, Submit, Update oder Signing-Credentials.
- separater manueller, `main`- und Environment-gebundener Queue-Ablauf für
  genau einen signierten internen Development- oder Preview-Build; erst nach
  demselben Ressourcencheck, mit eingefrorenen vorhandenen Credentials und
  ohne Submit, Update, Production-Profil oder Ausgabe von Build-IDs/URLs. Nach
  einer validierten Queue-Antwort bindet eine read-only `build:view`-Prüfung
  den Endstatus und das interne HTTPS-Artefakt an denselben Commit, dieselbe
  Plattform und dasselbe Profil.

Noch nicht als ausgelieferte Store-App freigegeben:

- Supabase-Redirect-Freigabe und realer E-Mail-/Gerätetest für `fanmind://reset-password`;
- EAS-Projekt, Expo-Token, geschützte Mobile-Environments und erstmaliger
  externer Read-only-Ressourcencheck;
- Signing Credentials;
- signierter interner Android-Build;
- Apple Developer / App Store Connect und TestFlight;
- visuelle App-Icon-Abnahme sowie reale Push-Berechtigungs- und
  Registrierungsabnahme im signierten Build; echte Zustellung erst nach
  separater Server-/Staging-Freigabe;
- finale Store-Screenshots, Datenschutzangaben und Portalabnahme aus signierten Builds;
- realer End-to-End-Gerätetest auf Android und iOS.

Mobile führt kein Billing, Referral-Reconciliation, Admin-Operationen, Webhook-Ingestion, externe Kanal-Credentials oder automatische Kommunikation aus. Verbindliche Architektur- und Beta-Details stehen in `apps/mobile/README.md`, `docs/mobile/ARCHITECTURE.md` und `docs/mobile/BETA_RELEASE.md`.

## 4. Roadmap- und Go-Live-Stand

Die Kanalzuordnung ist verbindlich und darf nicht zwischen Phasen verschoben
oder doppelt geführt werden: Phase 3 umfasst Facebook, Instagram und WhatsApp.
Phase 7 umfasst TikTok, X/Twitter, Discord und OnlyFans. Phase 8 bündelt
LinkedIn sowie alle weiteren noch zu verbindenden Medien-, Creator-, Review-,
Shop- und internationalen Plattformen. Phase 8 ist noch nicht begonnen, wird
im aktuellen Arbeitsumfang nicht gebaut und nicht als Fortschritt eingerechnet.
OnlyFans bleibt auch in Phase 7 eine unverbindliche, vor Umsetzung technisch
und rechtlich zu prüfende Plattform.

Die technische Verkaufsübergabe erfolgt erst nach realer technischer Abnahme
der erforderlichen Phase-3- und Phase-7-Kanäle. Phase 4 ist deshalb keine
Verkaufsfreigabe mehr, sondern ausschließlich die abgeschlossene technische
Produktions- und Billing-Basis. Nach der technischen Übergabe können
Verkaufsansprache und die separat dokumentierte Rechts-/Steuer-/AVV-Arbeit
parallel laufen; entgeltliche Aktivierung bleibt dort fail-closed, wo eine
zwingende externe Freigabe noch fehlt.

### Phase 4 – Produktions- & Billing-Basis technisch abgeschlossen

- Stripe-Live-Schritte: erledigt.
- Abrechnung & Admin-Basis: erledigt.
- Profil/Paket/Rechnungen: erledigt.
- Sales-Unterlagen: vorbereitet unter `docs/sales/`.
- Produktionsfreigabe: erledigt.
- Finaler Go-Live-Smoke-Test: erledigt.

### Phase 5 – Produktion und Testumgebung

- Operations-Grundlage: produktiv aktiv. Das Admin Operations Center lädt nach
  einer erfolgreichen Job-Anforderung sofort neue serverseitige Daten. Solange
  ein Job `queued`, `claimed` oder `running` ist, aktualisiert die sichtbare
  Seite alle 15 Sekunden sowie beim Zurückkehren in den sichtbaren Tab; bei
  erledigten Jobs und im Hintergrund findet kein Polling-Verkehr statt. Jede
  manuelle Backup- oder Checksum-Verifikationsanforderung verlangt eine
  ausdrückliche Bestätigung und teilt ein serverseitiges atomares Limit von fünf
  Anforderungen je Platform-Admin in zehn Minuten. Die Limiter-Identität ist
  HMAC-SHA256-pseudonymisiert; bei fehlendem Limiter wird kein Job eingereiht.
  Die notwendige `verify_backup`-Constraint-Erweiterung besitzt einen eigenen
  checksum-, `main`-, Environment- und Release-gebundenen Production-
  Verify/Apply-Ablauf mit read-only Vor-/Nachprüfung. Ein normaler Web-Deploy
  installiert nur diesen root-owned Kontrollpfad und wendet die Migration
  nicht automatisch an.
- Release-Checks: automatisch aktiv.
- Operations-Monitor: Die SHA-256-gebundene Komponenten-Constraint-Migration
  wurde am 1. August 2026 kontrolliert auf Production angewendet und
  unabhängig read-only verifiziert. Der Zehn-Minuten-Timer ist aktiv,
  Operations-E-Mail bleibt deaktiviert. Ein normaler Web-Deploy führt
  weiterhin keine Datenbankmigration aus. Der manuelle Production-Control-
  Workflow kann nach gesundem Probe zusätzlich eine feste, E-Mail-freie
  Warnung-Kritisch-Recovery-Abnahme auf der reservierten technischen
  Komponente `operations_monitor` ausführen. Timer, Probe und Lifecycle teilen
  ein exklusives Host-Lock; GitHub erhält nur allowlist-redigierte Ergebnisse.
  Der reguläre Monitor persistiert zusätzlich den ausschließlich normalisierten
  Aktivzustand von `nginx.service` über einen unprivilegierten Read-only-Aufruf.
  nginx-Konfiguration und Journal bleiben ungelesen; ein einzelner CPU-
  Momentwert wird wegen seines Fehlalarmrisikos nicht als eigener
  Zehn-Minuten-Zustand geführt.
- Server-Fehlertelemetrie: Der datensparsame Next.js-Hook, die RLS-geschützte
  Aggregation und das Admin-Operations-Reader-Modul sind implementiert. Die
  SHA-256-gebundene Migration wurde am 1. August 2026 auf Production für den
  exakt erkannten Legacy-Zustand kontrolliert repariert und unabhängig
  verifiziert. Die reservierte E-Mail-freie Folge Warnung, Kritisch und
  vollständiges Cleanup war vor und nach der rollback-gesicherten Aktivierung
  erfolgreich. Auf Release `04f2a472c57559393dd2d9c89575edf0ce8141ba` ist
  Tracking aktiv; kritische E-Mail bleibt deaktiviert. Der normale Web-Deploy
  wendet keine Migration an und aktiviert keinen Schalter für eine neue
  Umgebung. Eine öffentliche Fehler-Teststrecke existiert nicht. Der getrennte
  read-only Betriebsfenster-Nachweis vom 1. August 2026 bestätigte nach dem
  erwarteten Aktivierungs-Reload unveränderte 40 PM2-Restarts, 2.213 Sekunden
  kontinuierliche Uptime, 8/8 Health, denselben Release-Commit, gesunde lokale
  und externe Backups sowie die unverändert E-Mail-freie laufende Instanz.
- Production-Audit: Ein dauerhaft installierter, commitgebundener und
  fail-closed Read-only-Audit läuft nach jedem erfolgreichen
  Production-Deploy sowie täglich um 04:17 UTC. Er prüft ohne
  Repository-Checkout und ohne Artifact-Upload den exakten Release,
  Production-Runtime, alle acht öffentlichen Health-Komponenten, PM2, nginx,
  Login, Hostressourcen, lokale und Offsite-Backup-Paare, das aktuelle
  Vollbackup checksum-only und Backup-Worker-Fehler. Audit und
  Ergebnis-Verifier liegen getrennt vom root-only Operationsverzeichnis
  root-owned unter `/usr/local/lib/fanmind-audit`; Service-Restarts,
  Datenbankverbindungen, Entschlüsselung, Restore und Remote-Mutationen sind
  ausgeschlossen.
- isolierter Release-Deploy mit atomischem Release-Symlink, PM2-Rolling-Reload,
  commit-gebundener Next.js-Deployment-ID und öffentlicher
  Übergangs-Verfügbarkeitsprüfung, Health, Version, Public Smoke, Product
  Truth, Lint, Operations-Tests, Build und Sprachprüfung sind aktiv. Der
  steady-state Deploy löscht den laufenden PM2-Prozess nicht mehr; ein
  nicht-`200` während des Release-Wechsels verwirft den neuen Stand und löst
  den Rolling-Rollback aus. Die einmalige Fork-zu-Cluster-Umstellung bleibt
  ein kontrollierter Übergang.
- Produktions- und Testdaten-Trennung: Fail-closed-Policy, Preflight, Staging-Vorlage und ein ausschließlich manuell auslösbarer, commit-genauer Deploy-Workflow für einen getrennten `fanmind-staging`-Runner sind implementiert.
- Staging-E-Mail bleibt in der öffentlich erreichbaren App absichtlich
  unkonfiguriert (`email_config=unknown`). Ein separater, geschützter
  Provider-Control ist vorbereitet: Er prüft den exakt deployten Main-Commit,
  GitHub-Environment-Schutz, feste SPF-/MX-/DKIM-Evidenz und einen
  `sending_access`-Key und darf ausschließlich ein idempotentes synthetisches
  Resend-Ereignis an `delivered+fanmind-staging@resend.dev` auslösen. Der
  Control wurde noch nicht ausgeführt; Domain, Key-Scope und Environment sind
  externe Blocker. Er ersetzt keine reale Signup-, Reset- oder App-Mail-
  Abnahme und aktiviert keinen App-Mailpfad.
- Staging-Workspace-Vertrag: Der Browser-INSERT für `anon` und `authenticated`
  ist im getrennten Supabase-Staging gesperrt; Owner-UPDATE ist auf die
  definierte zehnspaltige Allowlist begrenzt. Zwei synthetische Nutzer in zwei
  getrennten Workspaces wurden transaktional auf bidirektionale
  Mandantentrennung/RLS geprüft und vollständig zurückgerollt.
- Staging-Daily-Provisioning: Der service-role-only RPC wurde real gegen das
  getrennte Supabase-Staging ausgeführt. Ein dabei gefundener mehrdeutiger
  PL/pgSQL-Conflict-Target wurde auf den kanonischen benannten Unique
  Constraint korrigiert. Erstaufruf, idempotenter Wiederholungsaufruf und genau
  eine Owner-Membership sind nachgewiesen; die Readiness-Funktion liefert
  unter dem vorgesehenen `service_role`-Claim `ready=true`. Production wurde
  dafür nicht verändert.
- Triggerfunktions-Härtung: Der checksum-gebundene Staging-Pfad ist abgenommen.
  Der getrennte Production-Kontrollpfad ist vorbereitet: Der normale Deploy
  installiert ausschließlich root-eigene, nicht aktivierte Artefakte. Verify
  und Apply sind manuell, aktionsspezifisch bestätigt, an `main`, den exakten
  Live-Commit, den Production-Runner und das geschützte `production`-
  Environment gebunden; davor und danach muss der vollständige read-only
  Production-Audit grün sein. In Production sind derzeit drei veränderliche
  Triggerfunktions-Suchpfade und beim optionalen alten Retention-Trigger zwei
  Browser-`EXECUTE`-Warnungen offen. Production-DDL wurde nicht ausgeführt und
  bleibt bis zu einer erneuten ausdrücklichen Freigabe gesperrt. Runbook:
  `docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md`.
- Umgebungs-Governance: schreibende Remote-Tests sind außerhalb eindeutig identifizierter Staging- oder Testumgebungen blockiert.
- Restore-Drill: Zielgrenzen, transaktionaler Runner und ein strikt redigierter Evidence-Validator sind implementiert. Vor jeder geschützten Phase prüft ein root-owned, SHA-gebundenes und secretfreies Host-Gate die erwartete Runner-Identität `fanmind-restore-01` und die feste lokale Toolchain. Das Repository ist als `FanMind/FanMind` organisationsgeführt; die Self-hosted-Jobs verlangen die ausgewählte Organisationsgruppe `fanmind-restore-drill` plus fünf exakte Labels und die auf genau drei `main`-Restore-Workflows begrenzte Allowlist. Die Labels allein sind keine Sicherheitsgrenze, und die veränderliche Gruppenrichtlinie muss vor jedem späteren R4-Schreibschritt erneut geprüft werden. Der geschützte Read-only-Lauf `32582640853` auf Commit `b75f68ecc7999a9b492051aecc2421b9b597dd18` bestätigte am 2026-08-22 die Host-/Gruppenbindung, einen mit dem root-owned Ubuntu-Truststore verifizierten TLS-Checkout, das verschlüsselte Full-Backup im checksum-only-Modus sowie den isolierten PostgreSQL-17-Zielkatalog mit TLS `verify-full`, allen drei Rollen und `pgcrypto`; keine Entschlüsselung und kein Write liefen. Ressourcen- und Datenbankworkflow benötigen jeweils zwei frische One-Job-JIT-Runner; ein persistenter Host oder das Label allein genügt nicht. Der getrennte commit-genaue Datenbank-Workflow wiederholt alle Gates, friert age-Identity, Passfile und CA symlink-sicher ein, erzwingt TLS `verify-full` und stellt nach dem Restore ausschließlich drei kurzlebige private Receipts bereit. Das vertrauliche Full-Backup-Receipt enthält die begrenzte Liste erforderlicher Datenbankrollennamen für die Prewrite-Prüfung; Runner- und Postcheck-Receipt bleiben namenfrei. Der Datenbankpfad verwendet einen isolierten, selbst kontrollierten PostgreSQL-17-Cluster statt eines gehosteten Supabase-Ziels, archiviert Owner und ACLs aus demselben exportierten Snapshot und bindet Objekt-/ACL-, Rollen- und Datenbank-Containerfingerprints durch Manifest und Receipts. Der Runner akzeptiert die receipt-gebundene vorinstallierte Extension-Baseline beim Leernachweis und erzeugt nur bei 5/5 vorhandenen Kerntabellen, 5/5 aktivierter RLS, 5/5 Policy-Abdeckung und exaktem Authorization-Postcheck einen separaten privaten, SHA-gebundenen Datenbank-Postcheck-Beleg; manuelle Schema-/RLS-Freigaben akzeptiert Evidence-Schema 6 nicht. Datenbank-Restore, Storage, Server-Konfiguration, Wegwerfziel-Cleanup und finale Evidenznachweise bleiben offen und benötigen ihre jeweils exakte geschützte Freigabe.
- Mobile-Release: Ein eigener manueller `main`-gebundener
  Read-only-Ressourcencheck ist vorbereitet. Er prüft pro geschützter
  `mobile-development`-, `mobile-preview`- oder `mobile-production`-Umgebung
  nur die EAS-Projektbindung, die native App-Identität und die drei erlaubten
  öffentlichen Clientwerte. Build, Submit, Update und Signing bleiben
  deaktiviert; der tatsächliche EAS-Lauf und signierte Builds bleiben extern
  offen.
- Mobile-Signing: Ein getrennter manueller Workflow ist als kontrollierte
  Brücke zum ersten signierten internen Build vorbereitet. Er akzeptiert nur
  `development` oder `preview`, Android oder iOS, prüft zuerst Projektbindung
  und öffentliche Umgebung, friert bestehende Credentials ein und reiht genau
  einen Build ohne blockierenden Queue-Aufruf ein. Anschließend prüft er den
  EAS-Endstatus read-only und akzeptiert nur ein erfolgreich abgeschlossenes
  internes HTTPS-Artefakt für exakt denselben Commit, dieselbe Plattform und
  dasselbe Profil. Ohne externe EAS-Einrichtung und vorher
  vorhandene Signing-Credentials schlägt er vor dem Queue-Versuch fail-closed
  fehl. Nach begonnenem EAS-Aufruf wird eine fehlende oder ungültige
  Queue- oder Abschlussantwort als nicht automatisch wiederholbarer, unklarer Zustand
  ausgewiesen und muss zuerst direkt im geschützten EAS-Projekt geprüft werden;
  auch ein bestätigtes internes Artefakt ist noch kein Geräte-, Push-, Recovery-
  oder Store-Nachweis.
- Mobile-Geräteabnahme: Der erfolgreiche signierte Build erzeugt nur einen
  kurzlebigen redigierten Receipt ohne Build-ID oder Artefakt-URL. Der private
  Android-/iOS-Gerätenachweis wird an dessen SHA sowie den exakten geprüften
  `main`-Commit gebunden und umfasst Login, Recovery-Negativgrenzen, Neustart,
  Offline-Fail-closed-Grenzen, Logout-Purge, Branding und Account-Löschanfrage
  samt Widerruf. Push bleibt darin optional und bis zu den getrennten
  Staging-Gates gesperrt.
- Mobile-Push-Staging: Die Migration
  `20260729120000_mobile_push_registrations.sql` ist mit ihrer SHA-256-Prüfsumme
  festgeschrieben und auf dem getrennten Supabase-Staging mit aktivem RLS
  angewendet. Der getrennte Ressourcenworkflow liest nur Staging-Ziel und
  synthetische Nicht-Demo-Principals und kann vor dem Apply laufen. Migration
  und rollback-only Acceptance besitzen unterschiedliche Freigaben und einen
  gemeinsamen exklusiven Staging-Schreib-Lock. Die Acceptance prüft `anon`,
  Owner und Member als nicht schreibberechtigt, führt synthetisches
  service-role CRUD vollständig transaktional aus und verlangt danach einen
  leeren Cleanup-Nachweis. Kein normaler Deploy kann den Runner aufrufen; reale
  Push-Registrierung, Serverkey und Delivery bleiben extern deaktiviert.
- Mobile-Push-Delivery: feste Expo-HTTPS-Endpunkte, unabhängige EAS-
  Projektbindung, Workspace-/Member-/Kontakt-/Follow-up-/Registrierungsprüfung,
  Minimalpayload mit einstündiger TTL sowie Retry-, Ticket- und Receipt-
  Entscheidung sind lokal mit einem synthetischen Provider geprüft. Der
  server-only Loader und die spätere Ledger-Reservation erhalten exakt
  dasselbe bereits geprüfte Supabase-URL-/Ref-/Service-Role-Binding; die
  Reservation muss außerdem den aktuellen Registrierungs-/Token-Fingerprint
  atomar binden. Ohne eine separat genehmigte service-role-only Ledger-
  Migration mit atomarer Revalidierungs-RPC wird kein Sender verdrahtet; eine CI-
  Invariante schützt diese Dormanz. Production bleibt strukturell gesperrt.
- Website-Chat bleibt bis zur getrennten Staging- und Rechtsabnahme
  deaktiviert. Seine Sicherheitsgrundlage darf nur workspace-gebundene,
  standardmäßig deaktivierte Installationen, exakt verifizierte HTTPS-Origins,
  ausdrücklichen versionsgebundenen Consent und kurzlebige HMAC-referenzierte
  Besuchersitzungen verwenden. `public`, `anon` und `authenticated` erhalten
  keinen direkten Tabellenzugriff. Der öffentliche Session-Endpunkt muss
  bounded, atomar rate-limitiert, fail-closed und CORS-exakt bleiben. Ein
  öffentlicher Installationswert ist kein Geheimnis. Die getrennte
  Nachrichteningestion akzeptiert nur ein gültiges Sitzungstoken derselben
  Installation und Origin, verarbeitet Client-UUIDs idempotent und erzeugt
  ausschließlich einen workspace-gebundenen Kontakt, eine Conversation und
  eine eingehende Inbox-Nachricht. Receipt-Daten enthalten keinen
  Nachrichtentext. Die Ingestion benötigt zusätzlich einen atomaren
  DB-Processing-Entitlement-Check in derselben Transaktion; ohne diesen Check
  bleibt jede Installation gesperrt. Das vorbereitete cookie-freie
  Einweg-Widget verlangt aktiv bestätigten Consent, hält sein Sitzungstoken
  ausschließlich im Speicher und
  sendet je Nachricht eine Client-UUID. Es stellt keinen Zweiweg-Chat dar;
  Besucher-KI, automatische Antworten und Outbound-Versand bleiben
  unverdrahtet.
- Meta-Content-Staging: Die zwei Migrationen
  `20260803120000_meta_content_intelligence_foundation.sql` und
  `20260803210000_preserve_incremental_conversation_history.sql` sind
  checksum-festgeschrieben und auf dem getrennten Supabase-Staging
  angewendet. RLS, die neuen Analyseobjekte und Indizes, die fortlaufende
  Historie, das Entfernen des alten 50er-Löschtriggers und die
  tenant-spezifischen Meta-Idempotenzindizes wurden katalogseitig
  nachgeprüft. Ein vorgelagerter manueller Read-only-
  Ressourcencheck bindet ohne Schreibfreigabe den exakten `main`-Commit, das
  getrennte Ziel, den IPv4-kompatiblen Supabase-Supavisor-Session-Pooler auf
  Port `5432`, den aus der Staging-Projektreferenz abgeleiteten DB-Benutzer und
  den Schema-Zustand; partielle oder driftende Zustände werden gesperrt. Der
  getrennte manuelle Apply läuft ausschließlich auf
  `main`, für den exakt geprüften Commit und gegen ein per Origin,
  Supabase-Projektreferenz und projektqualifizierter Datenbankidentität von
  Production getrenntes, TLS-verifiziertes Staging. Der read-only Postflight
  prüft RLS, nur lesende
  Browser-Policies und -Spaltenrechte, Tokenausschluss, Service-Role-Zugriff,
  Indizes, Kontextbedingungen und die Entfernung des alten 50er-Löschtriggers.
  Ein Wiederholungslauf überspringt SQL nur nach vollständigem Postflight;
  partielle oder abweichende Schemata bleiben fail-closed. Web-Deploy,
  Meta-Kontoverbindung, Analyse, App-Review-Einreichung und Production-
  Migration bleiben davon getrennt und deaktiviert. Runbook:
  `docs/operations/META_CONTENT_STAGING_MIGRATION.md`.
- Die begrenzte Facebook-/Instagram-Conversation-Pagination und ihre
  server-only Fortsetzungsfelder sind mit
  `20260811220000_meta_conversation_sync_continuation.sql` vorbereitet. Pro
  Ausführung wird innerhalb eines festen 45-Sekunden-Zeitbudgets höchstens eine
  Provider-Seite mit bis zu 25 Conversations verarbeitet. Solange Meta eine
  Folgeseite liefert, bleibt
  `last_messenger_sync_at` unverändert; erst nach vollständiger Erschöpfung
  rückt der globale Abschlusszeitpunkt auf den Start des ursprünglichen
  Intervalls vor. Fehler bewahren den Cursor und Wiederholungen bleiben über
  externe Nachrichten-IDs idempotent. Für die weiterhin weder in Staging noch
  Production angewendete Migration ist jetzt ein checksum-gebundener,
  exakter-Commit-, TLS- und Staging-gebundener Apply-/Verify-Pfad vorbereitet.
  Er verlangt vor Apply und Verify den gemeinsamen read-only Rollout-Entscheid,
  blockiert partielle Schemata und prüft Paar-/Cursor-Constraint sowie
  Browser-Sperren rollback-only. Der externe Apply-/Verify-Lauf und der echte
  Meta-Kontotest bleiben vor Aktivierung getrennt offen. Runbook:
  docs/operations/META_CONVERSATION_CONTINUATION_STAGING.md.
- Inbound-Meta-Webhooks führen keine Graph-Historien- oder Profilabfrage mehr
  innerhalb des HTTP-Requests aus. Die vorbereitete
  `meta_conversation_catchup_jobs`-Queue ist strikt an Workspace,
  Social Connection, Plattform und Fan-Thread gebunden, bündelt doppelte
  offene Aufträge atomar und verwendet generationserhaltende Leases,
  höchstens fünf Versuche, Backoff sowie `dead_letter`/`cancelled`. Tabellen-
  und RPC-Zugriff sind ausschließlich serverseitig für `service_role`
  vorgesehen; Worker-Protokolle enthalten nur feste Status-/Fehlercodes und
  Zähler. Vertragsende oder fehlender Verarbeitungsanspruch stoppt den
  Hintergrundabruf fail-closed, ohne vorhandene CRM-Historie zu löschen.
  Controlled SQL, Worker und Systemd-Vorlage sind nur vorbereitet;
  `FANMIND_META_CATCHUP_QUEUE_ENABLED` ist standardmäßig aus. Weder Migration,
  Worker-Aktivierung noch Staging-/Production-Deploy werden durch den normalen
  Web-Deploy ausgeführt. Zusätzlich ist ein exakter-Commit-gebundener,
  rollback-only Staging-Acceptance-Pfad vorbereitet. Er akzeptiert nur den
  markierten synthetischen Workspace, verlangt eine bereits vollständig
  verifizierte Queue-Migration und prüft ohne Meta-, Analyse- oder Versandaufruf
  Browser-Sperren, Workspace-/Connection-/Kontakt-Scope, Coalescing,
  Generationserhalt, Lease-Exklusivität und -Übernahme sowie fünf Retries bis
  `dead_letter`; danach müssen alle synthetischen Zeilen verschwunden sein. Der
  getrennte Ablauf steht in `docs/operations/META_CATCHUP_QUEUE.md` und ist
  noch nicht extern ausgeführt. Worker-/Webhook-E2E und Meta-Testkonto bleiben
  eigene offene Gates.
- Die gemeinsame Workspace-Verarbeitungsgrenze besitzt zusätzlich einen
  getrennten rollback-only Staging-Acceptance-Pfad. Er ist an `main`, den
  exakten geprüften Commit, das geschützte Staging, den gemeinsamen read-only
  Rollout-State und einen speziell markierten synthetischen Workspace
  gebunden. Innerhalb einer vollständig zurückgerollten Transaktion werden
  aktives Billing, Archivierung, Vertragsende, Suspendierung, Grace, manueller
  Override, temporärer Testzugang, Ablauf und Reaktivierung gegen die
  kanonische Policy geprüft. Der Pfad ruft weder Meta noch Stripe auf,
  aktiviert keinen Worker und ersetzt nicht den späteren Webhook-/Cursor-E2E-
  Test. Runbook:
  `docs/operations/WORKSPACE_PROCESSING_STAGING_ACCEPTANCE.md`.
- Das separate Supabase-Staging-Projekt sowie die getrennte Web-Staging-
  Runtime mit eigenem `fanmind-staging`-Runner, eigener DNS-/TLS-Bindung und
  eigenem Exoscale-Ziel sind vorhanden. Der isolierte Stripe-Testkatalog mit
  fünf Testpreisen einschließlich KI Plus/Ultra ist read-only nachgewiesen.
  Die exakte Test-Webhook-Konfiguration ist read-only nachgewiesen und der
  signierte mutationsfreie Bindungs-Smoke wurde mit HTTP 200 abgeschlossen;
  eine echte Stripe-Testzustellung und der Billing-Lifecycle bleiben getrennt
  offen. Für die
  dauerhaften synthetischen E2E-Identitäten ist ein kontrollierter,
  commit-genauer Staging-Provisionierungspfad vorbereitet. Er verwendet die
  vorhandene Workspace-Provisionierungs-RPC, erzeugt zwei getrennte Workspaces
  und einen zusätzlichen AI-Member und gibt nur die sechs nicht geheimen
  UUID-Zuordnungen aus. Der reale Lauf und die anschließenden Browser-/Billing-
  Abnahmen sind noch nicht erfolgt. Runbook:
  `docs/operations/STAGING_SYNTHETIC_FIXTURES.md`. Die Core-/CSV-Abnahme nutzt
  danach keinen persistenten Member-Zugang, sondern den getrennten
  kurzlebigen Lifecycle aus
  `docs/operations/STAGING_EPHEMERAL_MEMBER_CREDENTIAL.md`.

Die noch fehlenden Stripe-Webhook-/Lifecycle-Abnahmen blockieren nicht den
read-only Produktions-Smoke-Test. Sie bleiben Voraussetzung für Referral-
Lifecycle- und andere schreibende Nicht-Production-Tests. Der Restore-Drill
verwendet niemals die bereits migrierte Staging-Datenbank, sondern ein eigenes
leeres Wegwerfziel.

## 5. Kommerzielle Wahrheit

Alte Preise wie `299 €/Monat`, `499 €/Monat` oder `Agency ab 990 €/Monat` dürfen nicht wieder eingeführt werden.

| Paket | Status | Preis / Logik |
| --- | --- | --- |
| Öffentliche Demo | aktiv | kostenloser temporärer Demo-Zugang; kein entgeltliches Paket |
| Starter Flex | aktiv | 990 € Einrichtung + 312 €/Monat; Kündigung zum Ende des laufenden bezahlten Abrechnungsmonats |
| Starter 12 Monate | aktiv | 0 € Setup + 312 €/Monat; 12 Monate Mindestlaufzeit, danach monatliche Verlängerung |

Starter-Abos können unter `/settings/package` sicher zum Vertragsende gekündigt werden. Starter Flex endet frühestens zum bezahlten Periodenende; Starter 12 Monate frühestens zum Ende der Mindestlaufzeit. Nach Vertragsende bleiben Account, Login, CRM-Historie, Rechnungen und Export sichtbar; neue Nachrichten, Channel-Sync, externe Ingress-Webhooks, KI-Vorschläge, KI-Analysen und kostenpflichtige Hintergrundverarbeitung sind fail-closed zu deaktivieren.
| Internes Live-Testabo | kontrollierter interner End-to-End-Beta-Test | 1 € pro Tag; täglich kündbar; identischer Billing-Lifecycle wie Starter; keine Referral-Automation; kein dauerhaftes öffentliches Katalogangebot; eine ausdrückliche Admin-Freigabe endet automatisch nach spätestens 24 Stunden; bestehende Abos bleiben davon unberührt |
| Growth | Coming Soon | nicht produktiv buchbar |
| Agency | Coming Soon / auf Anfrage | nicht als Vollversion freigeschaltet |
| Enterprise / Custom | später | individuelle Prüfung |

### KI-Leistungsstufen

KI Standard, KI Plus und KI Ultra sind keine eigenständigen CRM-Hauptpakete.

- **KI Standard** ist im Starter-Basispaket enthalten.
- **KI Plus** kostet zusätzlich 100 €/Monat und bleibt bis zur Freigabe der Modelle, Kontingente und Billing-Items Coming Soon.
- **KI Ultra** kostet zusätzlich 200 €/Monat und bleibt bis zur Freigabe der Modelle, Kontingente und Billing-Items Coming Soon.
- FanMind Core umfasst einen Creator/Workspace, KI Standard und zehn
  Social-/Kommunikations-Connections. Je weitere fünf Connections sind als
  getrenntes Add-on für 49 €/Monat vorgesehen.
- Agency bleibt Coming Soon. Selbstzahlende Creator werden der Agentur nicht
  nochmals verrechnet. Bei Agenturzahlung gelten ein Hub zu 312 €/Monat plus
  Creator-Lizenzen mit 0 % für 1-4, 5 % für 5-9, 10 % für 10-19 und 15 % ab
  20 Creator.
- `src/config/aiTiers.mjs` ist die technische Source of Truth.
- `npm run ai:tiers:readiness` gleicht Status, Modell-/Fallback-Zuordnung,
  Kontingente, Stripe-Items, Workspace-Contract, serverseitige
  Kontingentdurchsetzung, Stripe-Lifecycle, Qualitäts-/Kostenfreigabe,
  Staging-Akzeptanz, Recht/Steuer, Runtime-Integration und ausdrückliche
  Production-Aktivierung stufenspezifisch und redigiert ab; aktuell muss
  Standard bereit und Plus/Ultra blockiert sein.
- `docs/operations/AI_TIER_DECISION_PROPOSAL.md` bündelt die noch offenen
  Modell-, Kontingent-, Overage- und Wechselentscheidungen ohne
  Aktivierungswirkung. Solange die Matrix nicht vollständig schriftlich
  freigegeben ist, bleiben Plus und Ultra fail-closed.
- `docs/operations/AI_TIER_COST_AND_QUOTA_RECOMMENDATION.md` und
  `src/config/aiTierRecommendation.mjs` liefern dazu eine datierte,
  reproduzierbare Arbeitsempfehlung mit Kosten-Szenarien. Sie werden von
  produktiven KI-Pfaden nicht importiert, ersetzen keine schriftliche
  Entscheidung und aktivieren keine Stufe.
- `npm run ai:tiers:recommendation` prüft diese Arbeitsmatrix offline und
  redigiert; die aktive Policy behält bis zur Freigabe ihre `null`-Felder.
- `npm run ai:reply-quality:eval` prüft ein privates, von Git ausgeschlossenes
  Ergebnis eines verblindeten Antwortqualitäts-Evals. Der Prüfer akzeptiert
  keine Prompt- oder Antworttexte, Reviewer-Identitäten, Kontaktwerte oder
  Provider-Modellnamen, gibt nur aggregierte Basiswerte je KI-Stufe aus und
  meldet immer `activation=none`. Ein valides Ergebnis füllt keinen
  `UNENTSCHIEDEN`-Wert und aktiviert weder Plus noch Ultra.
- Die Admin-KI-Auswertung zählt Kontakte je Workspace über exakte
  PostgREST-Count-Header, unabhängig von Zeilen-Pagination, und zeigt
  geschätzte Kosten pro Fan sowie pro 100/1.000 Fans. Ohne positive Fan-Basis
  bleibt die Verhältnisanzeige leer statt eine scheinpräzise Zahl zu erfinden.
  Der Zeitraum ist auf validierte Schnellansichten für 24 Stunden sowie 7, 30
  und 90 Tage begrenzt; zusätzlich werden Anfragen, geschätzte Kosten, Tokens
  und Fehler je verwendetem Modell aggregiert. Erfolgreiche, konsistente
  Usage-Ereignisse werden je Feature zusätzlich als nearest-rank P50-, P90-
  und P95-Verteilung für Input-, Output- und Gesamttokens ausgewertet; Fehler,
  Null-Usage und widersprüchliche Werte zählen nicht zur Stichprobe. Die
  Auswertung lädt aktuelle und vorherige gleich lange Zeiträume stabil
  paginiert bis jeweils 10.000 Ereignisse. Optionale interne Monatsbudget- und
  Spike-Hinweise sind rein
  beobachtend: ohne Budgetkonfiguration oder bei begrenzten Daten behaupten
  sie weder Quote noch Entwarnung, blockieren keine KI-Anfrage und ändern
  weder Billing noch KI-Stufe.
- Der gemeinsame serverseitige Entitlement-Resolver in `src/config/aiTiers.mjs`
  behandelt KI Standard als sicheren Default. Plus/Ultra werden nur bei
  serververwaltetem, aktivem Stripe-Lifecycle, verknüpftem Subscription-Item,
  gültigem Zeitraum und vollständig positiver zentraler Readiness wirksam.
  Die Readiness verlangt zusätzlich getrennte Provider-/Fallback-Modelle,
  Kontingentdurchsetzung, Lifecycle-/Staging-/Qualitäts-/Kosten-/Rechts-/
  Steuer-Nachweise, produktive Runtime-Integration und eine ausdrückliche
  Production-Aktivierung je Stufe; jeder andere Zustand fällt auf Standard
  zurück.
- Die server-only Tabelle `workspace_ai_tier_entitlements` und ihr redigierender
  Loader sind als deploy-before-migrate-Brücke vorbereitet. Die Migration ist
  auf dem getrennten Supabase-Staging angewendet und mit RLS, fehlenden
  Browser-Policies sowie server-only Zugriff nachgeprüft; auf Production ist
  sie nicht angewendet. Der echte Stripe-Webhook ruft die serverseitige
  Lifecycle-Brücke nur auf, wenn ihr eigenes Persistence-Gate, der
  Workspace-Vertrag und beide unterschiedlichen KI-Price-IDs explizit
  konfiguriert sind. Produktive KI-Routen verwenden den Speicher weiterhin
  nicht; Plus/Ultra bleiben zusätzlich durch ihre zentrale Readiness
  blockiert.
- Der checksum-gebundene Entitlement-Migrationsrunner besitzt getrennte
  Offline-Check-, Read-only-Verify- und explizite Apply-Modi. Merge und
  Web-Deploy wenden die Migration nicht automatisch an; Staging-Abnahme bleibt
  vor jedem Production-Schritt verpflichtend.
- Der manuelle Workflow `FanMind AI Tier Staging Migration` bindet den
  schreibenden Apply zusätzlich an `main`, das GitHub-Environment `staging`,
  zwei unabhängige Nicht-Production-Schreibfreigaben, getrennte
  Supabase-Projekt-/Datenbankziele und eine private Passwortdatei. Er endet
  mit dem read-only Metadaten-Postflight und startet weder die rollback-only
  Abnahme noch einen Production-Schritt automatisch.
- Der serverseitige Stripe-Lifecycle-Vertrag akzeptiert nur
  zwei vollständige, unterschiedliche Price-IDs, eine explizit vollständige
  Item-Liste, genau ein passendes Subscription-Item und ein zuvor verifiziertes
  Workspace-Ziel. Alle direkten Workspace-IDs müssen gültig und untereinander
  sowie mit vorhandenen Stripe-Referenzen identisch sein. Jeder mutierende
  Eventtyp muss außerdem seine vollständige typisierte Referenzmenge liefern:
  Invoice und Subscription benötigen Customer plus Basis-Subscription.
  PaymentIntent-Events müssen Customer plus die neue, typisierte
  PaymentIntent-ID liefern, werden aber über den stabil gespeicherten Customer
  aufgelöst, weil wiederkehrende Zahlungen neue PaymentIntent-IDs erzeugen.
  Refund/Dispute benötigen den PaymentIntent und nutzen den Customer, wenn das
  Objekt ihn enthält; andernfalls bleibt nur ein bereits gespeicherter
  PaymentIntent auflösbar. Tax-ID benötigt den Customer. Ein einzelner Treffer
  neben einer
  unbekannten oder fremden Referenz innerhalb dieser erforderlichen Menge ist
  kein Zielnachweis, sondern verlangt Stripe-Retry. Event-lokale Zusatz-IDs,
  etwa der neue PaymentIntent einer wiederkehrenden Invoice, werden nicht
  fälschlich als bereits persistierte Tenant-Bindung verlangt. Nur Checkout
  darf eine noch nicht
  persistierte Bindung aus übereinstimmender servergesetzter Workspace-
  Metadatenbindung plus Customer kontrolliert anlegen. Subscription-Events
  dürfen vor jedem Billing-Write nur die exakt gespeicherte Customer- und
  Basis-Subscription-Bindung verwenden; ein separates KI-Abo darf die
  Basis-Subscription nicht überschreiben. Doppelte und
  ältere Events werden nicht erneut angewendet; unvollständige Item-Listen
  und beschädigte Perioden stoppen fail-closed. Entfernt ein neueres
  Subscription-Event das zuvor
  gespeicherte Plus-/Ultra-Item, wird der Datensatz `canceled` statt stale
  aktiv belassen. Insert und Update verwenden ohne Upsert eine persistente
  Event-Grenze. Die auf Staging angewendete, aber nicht für die Runtime
  aktivierte kontrollierte Erweiterung
  `workspace_ai_tier_stripe_event_ledger` ersetzt direkte Lifecycle-Writes
  durch ein service-role-only Event-Ledger und eine atomare RPC mit internem
  Revisions-CAS. Gleichzeitige Events werden weder nach Event-ID noch
  willkürlich sortiert: Bei identischer Stripe-Sekunde oder Subscription-
  Konflikt wird `reconciliation_needed` dauerhaft gespeichert, der Loader
  fällt auf Standard zurück und der unveränderliche Event darf ohne endlosen
  Retry bestätigt werden. Eine zweite RPC kann den Zustand nur mit
  Workspace-/Customer-/kanonischer Basis-Subscription-Bindung, exakt
  erwarteter bisheriger Entitlement-Subscription, Stripe-Request-ID, Snapshot-
  Fingerprint und exakt erwarteter Revision auflösen. Der Snapshot-Zeitpunkt
  wird als dauerhafte Event-Cutoff-Grenze in der Quittung gespeichert und
  schützt dadurch auch einen Starter-only-Zustand ohne Entitlement-Zeile vor
  verspäteter Reaktivierung. Der dafür nötige
  kanonische Stripe-Abruf ist noch nicht verdrahtet. Der aktuelle read-only
  Katalog-Postcheck bestätigt den installierten leeren Ledger und seine
  Rechte-/RLS-Grenzen. Die ältere rollback-only Lifecycle-Abnahme lief vor
  diesem Apply und belegt den angewendeten Ledger-Pfad deshalb nicht. Die
  Brücke aktiviert keine KI-Stufe und bleibt ohne ihr zusätzliches
  Ledger-Gate inaktiv.
- Dieses KI-Ledger umfasst nicht die allgemeinen Billing-Felder auf
  `workspaces`. Checkout-, Invoice-, Subscription-, PaymentIntent-, Refund-
  und Tax-Mutationen besitzen nun ein kontrolliertes, noch nicht angewendetes
  gemeinsames Basis-Billing-Event-Ledger mit kanonischer Reconciliation.
  Nach einem späteren kontrollierten Apply ersetzt zunächst eine zweifach
  bestätigte Capture-only-Stufe den Legacy-PATCH, ohne Projektionen zuzulassen;
  erst die dritte kanonische Bestätigung erlaubt Projektionen.
  Für Apply→Capture gilt ein dokumentierter Billing-Write-Freeze mit
  anschließender vollständiger DB-Re-Inventarisierung. Ein fehlender Stream mit
  bestehender Stripe-Identität oder historischer Objektbindung darf selbst bei
  offenem dritten Gate nicht automatisch `in_sync` werden; nur ein erster
  signierter Checkout eines vollständig unberührten Workspace darf
  bootstrapen. Vor der dritten Bestätigung müssen die DB-Postflight-Zähler für
  offene und nicht inventarisierte Cutover-Zustände beide exakt `0` sein.
  Insbesondere darf ein
  verspätetes `invoice.paid` nach `customer.subscription.deleted` nicht ohne
  eine solche Grenze reaktivieren. Bis Apply, vollständiger kanonischer
  Cutover, der gemeinsame Basis-/KI-/Referral-Reconciliation-Operator und der
  echte Stripe-Testlebenszyklus abgeschlossen sind, bleiben produktives
  Billing und Plus/Ultra blockiert.
- Die beiden kontrollierten Ledger-Apply-Transporte verlangen denselben exakt
  eingegebenen und ausgeführten `main`-Commit, das geschützte Staging-
  Environment, den Session-Pooler mit projektqualifiziertem Datenbankbenutzer,
  einen separaten und tatsächlich gegen das Ziel verglichenen Production-Host
  als negativen Vergleichsanker und TLS
  `verify-full` mit der eingecheckten Supabase-Root-CA. Sie aktivieren keine
  Runtime-Flags und führen keinen Stripe-Aufruf aus. Vor jedem Apply binden
  sie den gemeinsamen read-only Rollout-State auf denselben Commit, dasselbe
  Ziel und dieselbe Passfile und verlangen exakt ihre Ledger-Aktion `apply`
  plus Gesamtzustand `PASS`; absent, vollständig und partiell werden getrennt
  ermittelt. Der Basis-Ledger verifiziert Spalten, Constraints/FKs/CHECKs,
  Indizes, RLS/ACLs und Funktionen einmal in der Apply-Transaktion und danach
  mit bytegenau an das checksum-gepinnte Control gebundenem Verifier erneut in
  einer unabhängigen read-only Transaktion.
- Ein manueller, rollback-only Staging-Abnahmeworkflow ist vorbereitet. Er
  prüft bei bereits angewendeter Staging-Migration beide aktiven
  Stripe-Testpreise, Owner-/Member-Sperren, Service-Role-CRUD sowie
  Duplikat-/Reihenfolgeverhalten, gibt keine internen IDs aus und wendet
  selbst keine Migration an. Der echte Lauf bleibt bis zur Bereitstellung der
  Stripe-Testpreise und synthetischen Owner-/Member-Ressourcen offen.
- Davor steht ein eigener manueller, strikt read-only Ressourcencheck auf
  `main` und im GitHub-Environment `staging`. Er bestätigt die getrennte
  Supabase-/Datenbankbindung, zwei aktive Stripe-Testpreise zu 100/200 Euro
  pro Monat und einen synthetischen Workspace mit unterschiedlichem Owner und
  Member. Schreibfreigaben bleiben aus; Entitlement-Zeilen und Migrationen
  werden nicht berührt.
- Einrichtung und KI-Add-ons sind nicht referral-rabattfähig.
- Keine KI-Stufe aktiviert automatische Sendung.
- Nicht festgelegte Modelle oder Limits bleiben `null` und dürfen nicht erfunden werden.

### Betreiber- und Steuerstatus

- Vertragspartner: Bernd Guggenberger, Einzelunternehmen unter der Geschäftsbezeichnung FanMind.
- Geschäftsanschrift: Turnerstraße 18, 2345 Brunn am Gebirge, Österreich.
- Inhaber und vertretungsberechtigt: Bernd Guggenberger.
- zuständige Gewerbebehörde: Bezirkshauptmannschaft Mödling.
- Kontakt: kontakt@fanmind.ch, +43 676 5367236.
- Angebot ausschließlich für B2B-Unternehmer.
- `FanMind e.U.` darf erst nach bestätigter Firmenbucheintragung verwendet werden.
- Die veröffentlichten Beträge sind Nettopreise. Für steuerpflichtige Umsätze in Österreich gilt die technische Vorgabe von 20 % Umsatzsteuer; international bestimmt Stripe Tax anhand Rechnungsadresse und steuerlichem Kundenstatus den anwendbaren Satz oder Reverse Charge.
- Checkout ist fail-closed an `FANMIND_TAX_MODE=stripe_tax` und die getrennte Bestätigung der tatsächlich eingerichteten Stripe-Tax-Registrierung gebunden. Eine fehlende oder alte Kleinunternehmer-Konfiguration erzeugt keinen steuerfreien Checkout.
- Die technische Entscheidung ersetzt nicht die im externen Freigaberegister weiterhin offene steuerliche Prüfung von UID, internationalen Fällen, Pflichtangaben und Aufbewahrungsfristen.

### Datenschutz- und AVV-Readiness

- `docs/legal/AVV_WORKING_DRAFT.md` enthält eine ausdrücklich nicht
  unterschriftsreife Arbeitsfassung mit Rollen, Verarbeitung, Datenarten,
  Personengruppen, TOM, Unterstützung, Löschung und technischer Anbieterliste.
- `docs/legal/RETENTION_REGISTER.md` trennt implementierte technische
  Grenzen von noch offenen rechtlichen, steuerlichen und geschäftlichen
  Endfristen.
- Die öffentliche Datenschutzerklärung nennt das aktive, consent-gesteuerte
  und parameterlose Meta-Event `PageView` sowie die im Code belegten Demo-,
  Consent-, Diagnose-, Log-, Mobile-,
  Account-Lösch- und Backup-Kriterien.
- Eine öffentliche Anbieter-DPA ist nur Prüfeinstieg. Wirksame Annahme,
  kontobezogene Unterauftragsliste, Region und Transfergrundlage müssen je
  aktivem FanMind-Konto extern bestätigt werden.
- `docs/legal/EXTERNAL_APPROVAL_REGISTER.md` definiert dafür jetzt die
  zuständige Fachprüfung, den konto- und versionsbezogenen Mindestbeleg, den
  Fristenvorschlag und den AVV-Unterschriftsweg. Das zugehörige JSON enthält
  nur Status und spätere SHA-256-Beweis-Hashes; private Vertragsunterlagen
  bleiben außerhalb von GitHub.
- `npm run legal:evidence:check` validiert die Registerstruktur. Der
  absichtlich strengere Check `npm run legal:evidence:require-complete` muss
  vor echtem Drittpersonen-Onboarding grün sein und bleibt bis zu den realen
  externen Freigaben rot.
- `npm run legal:evidence:hash` liest ausschließlich private, lokal
  zugriffsbeschränkte Belegdateien unter dem von Git ausgeschlossenen
  Evidenzverzeichnis und gibt nur die registrierbare SHA-256-Referenz aus.
  Registeränderung, fachliche Freigabe und Vertragsannahme bleiben getrennte
  manuelle Schritte.
- `npm run legal:evidence:handoff` leitet aus demselben Register ausschließlich
  die offenen Control-IDs und benötigten Belegarten ab und gruppiert sie nach
  externer Zuständigkeit. Werte, Beleg-Hashes, Pfade, Kontokennungen und
  abgeschlossene Controls bleiben aus der Ausgabe ausgeschlossen; der Befehl
  besitzt keine Freigabe- oder Aktivierungswirkung.
- Die technische Vorbereitung ersetzt weder Rechts-/Steuerberatung noch eine
  unterschriebene AVV oder den isolierten Backup-Lösch-/Restore-Nachweis.

## 6. Verbindliche Terminologie

- Deutsch: **KI**; Englisch: **AI**.
- Nutzerseitig: **Kontaktwissen**, nicht Memory oder Fan-Gedächtnis.
- Analysebereich: **Kommunikationsübersicht**.
- öffentliche Seiten verwenden Produkt oder aktuelle Version, keinen MVP-Jargon.
- Datenschutz wird konkret beschrieben; keine pauschale Konformitätsgarantie.
- Plattformlogos verwenden die gemeinsame `PlatformLogo`-Komponente.
- Funktionssymbole verwenden die gemeinsame `FanMindFunctionIcon`-Registry.

## 7. Referral Growth Window

Die technische Policy ist vorbereitet, die produktive automatische Verrechnung bleibt deaktiviert.

- 5 % Rabatt je aktiv zahlendem geworbenen Workspace;
- maximal 20 aktive Referrals beziehungsweise 100 % auf die Starter-Grundgebühr;
- globales Growth Window bis 2.000 aktive zahlende Workspaces;
- Rabatt nur auf 312 €/Monat Grundgebühr;
- kein Rabatt auf Einrichtung, KI-Add-ons, Connection-Pakete oder
  Agency-Erweiterungen;
- ein Creator ist entweder Referral oder rabattierte Agency-Lizenz, niemals
  beides gleichzeitig;
- Demo- und interne Test-Workspaces ausgeschlossen;
- Kündigung, Zahlungsausfall oder Inaktivität entfernt den betreffenden Rabatt;
- keine Barauszahlung und kein negativer Rechnungsbetrag.

Vor Aktivierung erforderlich:

- vorhandenes separates Supabase-Staging plus vollständig getrenntes
  Stripe-Test-Staging;
- vollständige Lifecycle-Tests;
- Missbrauchsschutz;
- Rechts- und Steuerfreigabe der Teilnahmebedingungen.

## 8. Gefrorener Demo-Pfad

1. Landingpage öffnen.
2. Login oder kostenlose Demo starten.
3. Dashboard zeigen.
4. Kontakte öffnen.
5. CSV-Import kurz zeigen oder Sandra M. öffnen.
6. Kontaktdetail und Nachrichtenkontext zeigen.
7. letzte eingehende Nachricht als KI-Kontext verwenden.
8. KI-Antwortvorschläge erzeugen.
9. Antwort kopieren.
10. Kontaktwissen-Vorschlag speichern.
11. Follow-up-Vorschlag speichern.
12. Follow-up-Liste und Roadmap zeigen.
13. Abschlussfrage: „Wäre dieser Ablauf für euer Team nützlich?“

Das vollständige Sales-Skript steht in `docs/sales/FANMIND_DEMO_SCRIPT.md`.

## 9. Integrationsstatus

Aktiv im Standardprodukt:

- manuelle Kontaktpflege;
- CSV-Import;
- gespeicherter Nachrichtenkontext;
- Webformular- und Inquiry-Grundlagen.

Vorbereitet / Beta / nicht allgemein live verkaufen:

- mandantengetrennte Meta-/Facebook-/Instagram-Grundlagen: jeder Kunde verbindet sein eigenes Geschäftskonto mit seinem eigenen Workspace; verschlüsselte Tokens bleiben serverseitig; eine externe Konto-ID darf nur einem aktiven Workspace gehören;
- Facebook-Messenger-/Kommentar-Grundlage und Graph API `v25.0`; Instagram-Webhook- und begrenzte DM-Verlaufsgrundlage; Instagram Business Login, explizite Mehrfachkontoauswahl, App Review und reale Ende-zu-Ende-Abnahme bleiben offen;
- eigener Post-/Insight-Cache, fortlaufend und inkrementell gespeicherte autorisierte Chats/Kommentare sowie vorsichtige Fan-/Nutzer-Schreibstilanalyse als fail-closed Meta-Datenmodell; der einmalige Facebook- oder Instagram-DM-Erstabruf ist auf 150 aktuelle Nachrichten je Thread begrenzt, danach werden nur neue Ereignisse ergänzt. Verbindungsweite Conversation-Seiten bleiben auf 25 Einträge je Ausführung begrenzt und dürfen den globalen Abschlusszeitpunkt erst nach vollständiger Provider-Pagination fortschreiben. Webhook-Requests rufen keine Provider-Historie ab; ein gezielter Thread-Catch-up darf erst über die vorbereitete, standardmäßig deaktivierte service-role-Queue laufen. KI Standard/Plus/Ultra erhalten serverseitig ausschließlich die letzten 50/100/150 Nachrichten. Persönliche fremde Profile/Posts werden nicht gespiegelt oder gescrapt. Alle Analysearten bleiben standardmäßig aus, bis Rechtsgrundlage, Transparenz, AVV/Anbieterprüfung, Betroffenenrechte und Aufbewahrung je Workspace bestätigt sind;
- Meta Pixel als consent-gesteuerte Marketing-Messung ausschließlich mit parameterlosem `PageView` auf freigegebenen öffentlichen Seiten; geschützte und dynamische CRM-Routen sowie unsichere Query-/Fragmentwerte sind fail-closed ausgeschlossen; `CompleteRegistration`, `Lead` und weitere Conversion-Events bleiben vorbereitet und unverknüpft, bis sie einzeln fachlich und datenschutzrechtlich freigegeben sind;
- Facebook-Reply-Target- und Messenger-Hilfen;
- Telegram-Webhook- und Bot-Grundlagen;
- WhatsApp-Cloud-API-Inbound-Textpfad als standardmäßig deaktivierte,
  nicht-produktive Vorbereitung mit getrennten Secrets, exakter
  Phone-ID-Tenant-Bindung, Connection-/Phone-/WAMID-Identity,
  SHA-256-Payload-Fingerprint, connection-gebundenen Kontakten/Threads,
  atomarem Store und Disconnect. Ein Receipt-Tombstone verhindert nach einer
  CRM-Nachrichtenlöschung die Wiederanlage per Provider-Retry; seine konkrete
  Retention und Legal-Grenze bleibt extern freizugeben. Der unvermeidliche
  GET-Query-Transport des Verify-Tokens ist im versionierten Staging-nginx für
  die exakte Route aus Access- und route-lokalen Error-Logs ausgeschlossen;
  ein zukünftiger Edge-Layer braucht dieselbe Grenze. Schema-Apply, realer
  Staging-/Meta-Lauf, externe Freigaben und Production-Aktivierung bleiben
  offen; Production ist technisch verboten;
- Stripe Checkout für Starter.

Roadmap / Coming Soon:

- WhatsApp (trotz vorbereiteten deaktivierten Inbound-Codes nicht live),
  TikTok, X, Discord und weitere Kanäle;
- vollständige Social-Synchronisation jenseits der ausdrücklich abgegrenzten Meta-Pilotfunktionen;
- Kampagnen und vollständige Analytics-Suite; die abgegrenzte Meta-Content-Intelligence-Grundlage ist separat in `docs/integrations/META_CONTENT_INTELLIGENCE.md` definiert;
- komplexe Rollen und Enterprise-Governance;
- Referral-Billing-Automation;
- KI Plus/Ultra Auto-Buchung.

Pflichtsatz:

> Geplante Integrationen werden erst nach technischer und rechtlicher Prüfung umgesetzt. FanMind sendet keine Nachrichten automatisch. Der Mensch prüft, kopiert und sendet final selbst im Originalkanal.

## 10. Security, RLS und Umgebungsgrenzen

- keine Secrets im Repository;
- OpenAI- und Supabase-Service-Role-Keys nur serverseitig;
- KI-Prompt-Migrationen werden nicht durch den Web-Deploy angewendet; der
  festgeschriebene Apply-/Postflight-Ablauf steht in
  `docs/operations/AI_PROMPT_MIGRATION.md`;
- die KI-Stufen-Speichermigration wird ebenfalls nicht durch den Web-Deploy
  angewendet; ihr checksum-gebundener Apply-/Postflight-Ablauf steht in
  `docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md`;
- `FANMIND_ADMIN_EMAILS` ist die einzige Admin-Quelle;
- alle workspace-bezogenen Daten benötigen RLS und serverseitige Autorisierung;
- Der App-/Renderer-Vertrag gibt Membern ausschließlich ein minimales
  Workspace-Safe-DTO und hält CRM-/AI-/Content-Mutationen sowie Connector-
  Administration Owner-only und processing-gebunden. Die direkte
  PostgREST-/JWT-Grenze für volle Workspace-/Legal-Zeilen,
  Connector-Bindungen, Token-/Syncdaten und zwölf Member-writable Tabellen ist
  noch nicht als geschlossen belegt: Der checksum-gebundene Control
  `20260816120000_workspace_member_data_boundary.sql` ist
  `CHECKED_NOT_APPLIED`. Der geschützte, getrennte Staging-Apply-/Verify-Pfad
  ist vorbereitet, aber noch nicht extern ausgeführt. App-first-Deploy,
  isolierter Apply, unabhängiger Postflight, reale Chromium-Abnahme und finaler
  Verify sind deshalb ein Go-live- und Member-Aktivierungsblocker. Auch ein
  erfolgreicher RLS-Postflight aktiviert keine Member-Schreibrechte
  (`docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md`).
- jede Mutation prüft User, Workspace und Ressource;
- Demo-Workspaces enthalten keine echten Kundendaten;
- externe Plattform-Login-Daten werden nicht gespeichert;
- Meta-Zugriffstokens sind verschlüsselt. Erst nach dem kontrollierten
  Member-Datengrenzen-Apply ist auch die direkte Browser-ACL nachgewiesen auf
  nicht geheime Owner-Statusfelder begrenzt; serverseitige Token-Nutzung bleibt
  davon unabhängig geschützt;
- schreibende Staging-/Testläufe benötigen alle Bedingungen aus `docs/operations/ENVIRONMENT_SEPARATION.md`;
- kein Restore gegen Production.

## 11. Datenbank-Source-of-Truth

Verbindliche Quellen:

- `docs/database/fanmind_current_schema.md`;
- `supabase/migrations/`;
- `supabase/controlled/` für einzeln freizugebende Contract-Schritte;
- `src/lib/supabase/server.ts`.

Relevante Objekte umfassen unter anderem:

- `profiles`, `workspaces`, `workspace_members`;
- `contacts`, `memories`, `followups`;
- `conversations`, `conversation_messages`, `conversation_summaries`;
- `contact_ai_profiles`, `workspace_voice_profiles`, `workspace_ai_prompt_settings`, `fan_analysis_reports`, `workspace_analysis_settings`;
- `content_sources`, `content_metric_snapshots`, `communication_analysis_reports`, `contact_reply_targets`, `social_connections`, `meta_webhook_events`;
- Billing-, Referral-, Inquiry-, Operations- und Backup-Tabellen laut aktueller Migrationen.

Interne Tabellen- oder Feature-Keys wie `memories`, `memory` oder `pilot` dürfen aus Kompatibilitätsgründen bestehen bleiben, sind aber keine öffentliche Terminologie.

## 12. KI und Kostenbeobachtung

- serverseitige Endpunkte;
- Workspace-Unternehmens-Prompt plus bis zu acht Antwortprofile unter `/settings/ai-usage`; Prompttexte werden nach Workspace-/Kontakt-Autorisierung serverseitig geladen, der Browser übergibt an die Antwort-Route nur die gewählte Profil-ID;
- Owner-/Admin-geschützte Prompt-Mutationen, RLS-gebundene Speicherung und feste Grenzen von 3.000 Zeichen global sowie 1.500 Zeichen je Profil;
- Workspace-Prompts steuern nur Stil und belegte Geschäftshinweise; Sicherheits-, Wahrheits-, Datenschutz-, Schema- und Manuell-Senden-Regeln bleiben höherrangig;
- kein API-Key im Browser;
- begrenzte Eingabelänge, begrenzte Datenbank-Kontextzeilen,
  Provider-Ausgabe und gemeinsame fail-closed Kurzzeit-Rate-Limits;
- strukturierte Ausgabe;
- Usage-Logging mit bevorzugten vollständigen OpenAI-Responses-Tokenwerten
  sowie sicherem Zeichenlängen-Schätz-Fallback; Kosten und gemischte
  historische Werte bleiben konservativ als geschätzt gekennzeichnet;
- Admin-Dashboard `/admin/ai-usage`;
- optionale Soft-Hinweise sind weder vertragliche Kontingente noch automatische Sperren;
- technische Aufruf-/Kontext-/Ausgabegrenzen sind Missbrauchs- und
  Kostenschutz, keine Standard-/Plus-/Ultra-Monatskontingente;
- der Vertragsende-Check an den beiden produktiven KI-Pfaden ist
  Lifecycle-Verhalten, keine autoritative Billing-Freigabe;
- **Rollout-Blocker vor Standard-/Plus-/Ultra-Aktivierung:** atomare
  Starter-Workspace-Erstellung und exakte Spaltenrechte sind technisch
  vorbereitet. Erst Production-Preflight, Anwendung der additiven Migration
  und des separat kontrollierten Contract-Schritts sowie die
  positive/negative Abnahme gemäß
  `docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md` belegen, dass normale
  Workspace-Owner Billing-, Stripe-, Subscription- und
  `test_access_flags`-Felder nicht mehr direkt ändern können;
- keine automatische Sendefunktion.

Details: `docs/AI_COST_MONITORING.md` und `docs/AI_PROMPT_PROFILES.md`.

## 13. Finale technische Go-Live-Freigabe

- automatischer read-only Preflight: `npm run smoke:go-live:public`;
- permanenter Workflow `FanMind Final Go-Live Readiness` nach erfolgreichem Production-Deploy;
- vollständiges Runbook: `docs/operations/FINAL_GO_LIVE_SMOKE_TEST.md`;
- Sales-One-Pager, Demo-Skript und Einwandbehandlung: `docs/sales/`;
- die technische Production-Basis ist nicht mit der Verkaufsübergabe gleichzusetzen; die Verkaufsübergabe erfolgt erst nach technischer Abnahme der erforderlichen Phase-3- und Phase-7-Kanäle;
- technische Freigabe und externe Steuer-/Rechtsfreigabe werden getrennt dokumentiert und können nach der technischen Verkaufsübergabe parallel zur Verkaufsansprache weiterlaufen;
- entgeltliche Aktivierung bleibt dort fail-closed, wo eine zwingende externe Rechts-/Vertragsfreigabe noch fehlt;
- Referral-Attribution wird vor der rollback-only Lifecycle-Acceptance über
  einen getrennten checksum-, commit- und Staging-gebundenen
  Integritäts-Verify/Apply-Pfad abgenommen; dieser Pfad aktiviert weder
  Billing noch Stripe;
- Referral-Billing, KI Plus/Ultra Auto-Buchung und schreibende Staging-Tests bleiben bis zur separaten Freigabe deaktiviert.

## 14. Reader-Synchronisierung

Bei Änderungen an Preis, Paketen, Referral, aktivem Scope, Demo, Integrationen, Billing, KI, Datenbank, Security oder öffentlichen Versprechen müssen mindestens geprüft werden:

- `docs/SOURCE_OF_TRUTH.md`;
- `README.md`;
- `AGENTS.md`;
- `docs/database/fanmind_current_schema.md`;
- `apps/mobile/README.md`, `docs/mobile/ARCHITECTURE.md` und `docs/mobile/BETA_RELEASE.md` bei Mobile- oder Backend-Vertragsänderungen;
- relevante Security-, KI-, Referral-, Landingpage- und Legal-Dateien.
