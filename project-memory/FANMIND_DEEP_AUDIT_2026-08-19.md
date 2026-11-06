# FanMind Deep Audit — 19. August 2026

## Zweck und Verbindlichkeit

Dieses Dokument ist der detaillierte Reconciliation-/Finishline-Nachweis für FanMind am 19. August 2026. Es soll verhindern, dass bereits erledigte Arbeit erneut gebaut, vorbereitete Arbeit fälschlich als extern abgenommen oder offene Finishline-Arbeit vergessen wird.

Es ergänzt `docs/SOURCE_OF_TRUTH.md`, ersetzt sie aber nicht. Bei Widersprüchen gilt folgende Reihenfolge:

1. aktueller verifizierter Git-/PR-/CI-/Runtime-/Providerzustand;
2. `docs/SOURCE_OF_TRUTH.md` und ausdrücklich kanonische Runbooks;
3. aktueller Project-Memory-Stand;
4. aktuelle zentrale Finishline #874 und spezialisierte Issues;
5. ältere Tracker/Issue-Bodies/Chat-Aussagen nur als Historie.

Der Status wird bewusst getrennt in `IMPLEMENTED`, `VERIFIED`, `COUNTERCHECKED`, `ACCEPTED` und `PRODUCTION_CONFIRMED`. Ein vorhandener Workflow oder grüner Unit-Test ist nicht automatisch eine reale externe Abnahme.

## Audit-Snapshot

- Repository: `FanMind/FanMind`.
- Repository-ID: `1259448985`.
- Aktueller Owner-Typ: GitHub Organization `FanMind`.
- Default Branch: `main`.
- Auditierter `main`-Ausgangspunkt: `2c0bebc9d4b343e4b67ab225b75ee4956680ceca`.
- Aktiver Governance-/Memory-Integrationspfad: PR #975, Branch `project-memory-v4-started-work`.
- Phase 8 ist ausdrücklich nicht begonnen und nicht Bestandteil der aktuellen Finishline.
- Zentrale Finishline: Issue #874.

## 1. Produktkern — gebaut, nicht erneut bauen

### Produktdefinition

FanMind ist ein KI-gestütztes CRM und Copy-&-Open-Kommunikationssystem. Es ist kein Autoresponder, keine Scraping-Plattform und keine automatische Versandmaschine. Der Mensch prüft und sendet externe Nachrichten final selbst.

### Kernfunktionen mit Repository-/Produktwahrheit

Folgende Grundlagen sind implementiert und gehören nicht in einen Neuaufbau:

- deutsche und englische Landingpage samt Sprach-/Truth-Prüfungen;
- Login und öffentliche Starter-Registrierung;
- kostenloser temporärer Demo-Workspace, getrennt vom entgeltlichen Angebot;
- geschütztes Dashboard;
- Kontakte, Suche, Kontaktdetail;
- manuelle Kontaktpflege und CSV-Import;
- gespeicherter Nachrichten-/Gesprächskontext;
- Kontaktwissen mit Bearbeiten/Löschen;
- Follow-ups;
- serverseitige KI-Antwortvorschläge;
- Vorschläge für Kontaktwissen und Follow-ups aus KI-Ausgabe;
- Copy-&-Open/Copy-/Share-Grenze ohne automatischen externen Versand;
- Profil-/Paket-/Rechnungsseiten und Self-Service-Kündigung;
- Admin-, Operations-, Billing- und Backup-Grundlagen;
- Legal-Seiten und AVV-Anforderungsseite;
- produktive Production-/Health-/Version-/Deployment-/Audit-Grundlage;
- nativer Mobile-App-Kern unter `apps/mobile`.

**Status:** Produktkern `PRODUCTION_CONFIRMED` für die bestehenden freigegebenen Web-Funktionen; dies bedeutet ausdrücklich nicht, dass Social-Finishline, Mobile Stores oder Plus/Ultra fertig sind.

## 2. Kommerzielle Wahrheit — nicht aus alten Chats rekonstruieren

Kanonische aktuelle Pakete:

- Öffentliche Demo: kostenlos, temporär, kein entgeltliches Paket.
- Starter Flex: 990 EUR Einrichtung + 312 EUR/Monat.
- Starter 12 Monate: 0 EUR Setup + 312 EUR/Monat, 12 Monate Mindestlaufzeit, danach monatlich.
- KI Standard: im Starter enthalten.
- KI Plus: +100 EUR/Monat, Coming Soon/fail-closed bis vollständige Freigabe.
- KI Ultra: +200 EUR/Monat, Coming Soon/fail-closed bis vollständige Freigabe.
- Core: ein Creator/Workspace, KI Standard und zehn Connections.
- fünf weitere Connections: +49 EUR/Monat.
- Agency: Coming Soon; keine stillschweigende Aktivierung.
- internes Live-Testabo: kontrollierter interner 1-EUR/Tag-Lifecycle, kein öffentliches Dauerangebot.

Alte Preisstände oder frühere vereinfachte Chat-Zusammenfassungen dürfen diese Wahrheit nicht überschreiben.

## 3. Roadmap-/Verkaufsgrenze

### Verbindliche Kanalzuordnung

- Phase 3: Facebook, Instagram, WhatsApp.
- Phase 7: TikTok, X/Twitter, Discord, OnlyFans ausschließlich nach positiver technischer/rechtlicher Machbarkeit.
- Phase 8: LinkedIn und weitere spätere Kanäle; nicht begonnen, nicht in aktuellem Fortschritt.

### Verkaufsübergabe

Phase 4 ist **nicht** die Verkaufsübergabe. Phase 4 ist die technisch abgeschlossene Produktions-/Billing-Basis. Die technische Verkaufsübergabe an Gerhard erfolgt erst nach realer technischer Abnahme der geforderten Phase-3- und Phase-7-Kanäle sowie abschließendem Production-Demo-/Sales-Flow. Rechts-/Steuer-/AVV-Arbeit bleibt getrennt und kann nach technischer Übergabe parallel laufen; entgeltliche Aktivierung bleibt dort fail-closed, wo externe Freigaben zwingend sind.

## 4. Production / Operations / Backups

### Belegt vorhanden

- Production auf Exoscale `fanmind-prod-01`.
- nginx Reverse Proxy.
- PM2 Cluster-Prozess `fanmind` über stabilen Release-Symlink.
- isolierter atomarer Release-Deploy mit Rolling-Reload/-Rollback.
- `/api/health` und `/api/version`.
- read-only Production-Audit nach Deploy und täglich.
- Uptime-Monitoring.
- Operations Center und Admin-Benachrichtigungsgrundlage.
- Operations Monitor, zehnminütiger Timer, E-Mail-freier Lifecycle.
- Server-Fehlertracking aktiv; E-Mail dafür bewusst deaktiviert.
- verschlüsselte DB-/Storage-/Serverkonfig-/Full-Backups.
- Offsite-Transfer und read-only Retention-Planung.
- checksum-only Verifikation aus dem Operations Center wurde real abgenommen.

### Bewusst offen / nicht Finishline-falsch schließen

- kritische E-Mail-Alarmierung ist nicht allgemein extern/produktiv abgenommen;
- breitere reale Fehlerfallmatrix bleibt optional/offen;
- Remote-Offsite-Löschwirkung bleibt in #658 absichtlich **nicht autorisiert**;
- vollständiger Restore bleibt eigener R4-Gate.

Keine dieser offenen Betriebsoptionen berechtigt zu Remote-Löschung oder Restore gegen Production.

## 5. Staging — Infrastruktur abgeschlossen, einzelne fachliche Gates separat

Issue #874 führt Gate 1 als technisch abgeschlossen. Belegt sind insbesondere:

- separates Supabase-Staging;
- getrennte Web-Staging-Runtime und eigener `fanmind-staging`-Pfad;
- DNS/TLS/Staging-Host;
- relevante kontrollierte Staging-Schemata;
- Stripe Test Mode Katalog/Preise/Webhook-Grundlagen für die aktuell benötigten Testpositionen;
- zwei getrennte synthetische Workspaces/Nutzer mit RLS-Isolation;
- Workspace-/Daily-Provisioning-Vertrag;
- dauerhafte synthetische Identitäten und Admin-Akzeptanzpfad;
- Referral-/Billing-Lifecycle in Staging wurde rollback-gesichert ausgeführt.

**Status:** Staging-Infrastruktur/Grundabnahme `ACCEPTED`. Das schließt nicht automatisch KI Plus/Ultra, Meta External E2E, Social oder Mobile ab.

### Post-Go-Live Regression #643

Der Issue-Body enthält noch historische offene Checkboxen. Diese müssen bei Fortsetzung einzeln gegen neuere Browser-/Staging-Tests reconciled werden. Nicht pauschal neu implementieren. Besonders bei Token-Manipulation, Cross-Workspace-Mutationen, Export/PDF/AI-Workspacebindung und Browser-Secret-/Shell-Grenzen ist nur aktuelle test-/run-gebundene Evidence als Abschluss zulässig.

## 6. Restore-Drill — detaillierter aktueller Stand

### 6.1 Code-/Backup-Sicherheitsvertrag — weit fortgeschritten

Der frühere ACL-/Default-ACL-Blocker wurde technisch geschlossen:

- PR #943 wurde als `14a1e2d0e100f2ec8cfa14486c96f128fb431878` in `main` gemergt.
- Echter digest-gepinnter Zwei-Cluster-PostgreSQL-17-CI-Roundtrip war grün.
- `--no-privileges`/`--no-owner` wurden aus dem neuen Backup-/Restorepfad entfernt.
- Objekt-/Spalten-/Default-ACL-/Owner-/Grantor-Zustand wird aus demselben exportierten Snapshot gebunden.
- Required Roles werden vor erstem Write geprüft.
- Datenbank-Container-, ACL-, Rollen- und Extension-Fingerprints werden receipt-gebunden geprüft.
- Core-Grant-Matrix und eingeschränkte `SECURITY DEFINER`-Funktionen werden Source/Target geprüft.
- historische ACL-lose Backups sind als Gate-2-Recovery-Evidence gesperrt.
- Production-Backup-Worker v6 wurde deployed und healthy gemeldet.

### 6.2 Neues vollständiges Recovery-Backup — real akzeptiert

Nach ausdrücklicher Einzelgenehmigung wurde genau ein neues verschlüsseltes Full Backup erzeugt und geprüft:

- Full Backup Run `b74c1c60-1d61-4a39-9f0d-648ec003a12c`: succeeded, validation passed, offsite uploaded.
- Datenbank-Manifest Format 2.
- Authorization Contract Schema 2 / `postgresql-17-acl-json-array-hex-v2`.
- Privilegien und Ownership archiviert.
- 23 Required Roles.
- 5 Required Extensions.
- 174 ACL-TOC- und 24 DEFAULT-ACL-TOC-Einträge.
- Core-Grant-Matrix 120.
- 12 eingeschränkte SECURITY-DEFINER-Funktionen.
- checksum-only Verification Run `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`: succeeded/passed.

Damit ist #944 **nicht mehr ein offener Code-/Backup-Erzeugungsblocker**. Das Issue bleibt zu Recht bis zum artefaktgebundenen isolierten Restore-/Postcheck-Nachweis offen.

### 6.3 Isolierte Restore-Infrastruktur — in der Operator-Session bereits aufgebaut

Historisch verifizierter Arbeitsstand aus der Restore-Session vom 17.–19. August, vor jeder Mutation live zu revalidieren:

- kein zweiter Restore-Server gewünscht oder erforderlich;
- isolierte Restore-VM vorhanden;
- Ubuntu 24.04;
- PostgreSQL 17.11;
- Node 24.19.0;
- Ziel-DB `fanmind_restore`;
- Bootstrap-DB-User `fanmind_restore_bootstrap`;
- PostgreSQL bindet lokal auf `127.0.0.1:5432`;
- TLS `verify-full` erfolgreich geprüft;
- Restore-Arbeitsnutzer `fanmind-restore` ohne sudo;
- GitHub Environment `restore-drill` und Age-Identity-Pfad wurden eingerichtet;
- Runner-Gruppe `fanmind-restore-drill` wurde eingerichtet;
- Host-/Runner-/TLS-/PostgreSQL-Grundlagen dürfen nicht von Null wiederholt werden, solange Revalidation keine Drift zeigt.

Diese Fakten sind **Operator-Evidence**, nicht dauerhaft driftfreie Tatsachen. Direkt vor dem realen Restore müssen Runner-Gruppe, Labels/Workflow-Allowlist, Environment, Host-Gate, Toolchain, Backup-Bindung, Ziel-DB und TLS erneut geprüft werden.

### 6.4 Harte Source-of-Truth-Inkonsistenz entdeckt

`docs/SOURCE_OF_TRUTH.md`, `AGENTS.md` und `docs/operations/RESTORE_DRILL.md` enthalten noch Text, wonach das Repository user-owned sei und erst in eine zukünftige Organisation transferiert werden müsse. Der aktuelle GitHub-Repositoryzustand ist jedoch `FanMind/FanMind` mit Owner-Typ Organization `FanMind`.

**Bewertung:** alte Ownership-Aussage `INVALIDATED`. Die genaue aktuelle Runner-Group-Policy/Allowlist kann mit dem vorhandenen Connector nicht vollständig als GitHub-Admin-Remote-Attestation gelesen werden und bleibt deshalb `NEEDS_VERIFICATION` vor Dispatch. Es ist falsch, deshalb entweder „Transfer noch nötig“ oder „Policy sicher aktuell“ ohne neuen Nachweis zu behaupten.

### 6.5 Was real noch fehlt

Der vollständige Restore ist **noch nicht ACCEPTED**. Noch nachzuweisen sind in der richtigen Reihenfolge:

1. aktueller Organisation-/Runner-Group-/Workflow-Allowlist-/JIT-Status live revalidieren;
2. exakt ausgewähltes Schema-2-Full-Backup/Receipt an den Drill binden;
3. read-only Resource Readiness;
4. read-only PG17/TLS/Role/Extension Target Compatibility;
5. separat freigegebener DB-Restore in das leere isolierte Ziel;
6. receipt-gebundener ACL/Owner/RLS/Policy/Auth-/Container-/Extension-Postcheck;
7. Storage-Restore/-Postcheck in isoliertem Testziel;
8. Server-Konfigurations-Restore/-Postcheck ohne Production-Übergriff;
9. Wegwerfziel-Cleanup;
10. finales Evidence-Schema/Execution Receipt/Countercheck.

**Status:** `PARTIAL`, Risk R4. Nicht „0 % vorbereitet“, aber auch nicht „fertig“.

## 7. Mobile — Repository technisch weit, externe Auslieferung offen

### Implementiert/verifiziert im Repository

- echter React-Native-/Expo-Kern, keine WebView-Hülle;
- E-Mail/Passwort-Auth;
- PKCE-Recovery-Grenzen;
- SecureStore/Purge;
- geschützte Navigation;
- Dashboard/Kontakte/Suche/Kontaktdetail/Knowledge;
- Kontakt CRUD mit RLS/Workspace-Grenzen;
- KI-Antwortvorschläge;
- Copy/native Share ohne automatischen Versand;
- Follow-ups;
- verschlüsselter Offline-Read-Cache;
- Push-Grundlage;
- Icons/Splash/Store-Metadaten;
- Privacy Manifest/API-36-Prüfungen;
- EAS Resource-Readiness- und kontrollierter interner Build-Workflow;
- Native CI einschließlich Android-Debug-/iOS-Simulator-Buildnachweis.

### Noch nicht als reale Mobile-Auslieferung akzeptiert

- Supabase Redirect `fanmind://reset-password` am exakt geprüften Ziel real freigeben/verifizieren;
- echten Recovery-E-Mail-/Gerätetest durchführen;
- EAS-Projekt/Token/geschützte Environments live abnehmen;
- Signing Credentials;
- signierter interner Android-Build;
- Android Realgerät-End-to-End-Abnahme;
- Apple Developer/App Store Connect;
- signierter iOS-Build/TestFlight;
- iOS Realgerät-End-to-End-Abnahme;
- Push Permission/Registration/Delivery nach getrennten Gates real;
- Store Screenshots/Privacy/Data Safety aus signierten Builds.

**Status:** Code/CI `VERIFIED`; externe Mobile-Release-/Store-Abnahme `OPEN`. Nicht neu bauen, sondern extern abnehmen.

## 8. KI Standard / Plus / Ultra

### Standard

KI Standard ist Bestandteil des Core/Starter und produktive Grundlage. Server-only, menschliche Prüfung, kein Auto-Send.

### Plus/Ultra technische Foundation

Vorhanden:

- zentrale Policy `src/config/aiTiers.mjs`;
- serverseitiger fail-closed Entitlement-Resolver;
- Plus +100 EUR, Ultra +200 EUR;
- Staging-Schema/Entitlement-Grundlagen;
- Stripe-Testkatalog mit relevanten Testpreisen wurde in der Staging-Finishline inzwischen nachgewiesen;
- serverseitige Stripe-Lifecycle-/Ledger-Grundlagen sind vorbereitet und bewusst dormant/fail-closed;
- Usage-/Kostenmonitoring, P50/P90/P95, Kosten-pro-Fan und Recommendation-/Eval-Verträge;
- Empfehlungstabellen existieren, aktivieren jedoch keine Stufe.

### Noch zwingend offen vor Plus/Ultra Production

- schriftliche Modell-/Fallback-Freigabe je Tier;
- verbindliche Monatskontingente, Kontextgrenzen, Verbrauchs-/Overage-Verhalten;
- Wechsel/Kündigung/Proration/Refund-Regeln;
- Kosten-/Margenfreigabe;
- realer privater verblindeter Qualitäts-Eval;
- repräsentative Nutzungs-/Kostendaten gemäß Produktentscheidung;
- vollständiger Staging Upgrade/Downgrade/Cancellation/Failed-Payment/Webhook/Entitlement-Lifecycle gegen den aktuellen Contract;
- Rechts-/Steuerabgrenzung;
- ausdrückliche Production-Aktivierung.

**Status:** Standard produktiv; Plus/Ultra Foundation `IMPLEMENTED/teilweise VERIFIED`, Aktivierung `BLOCKED/DEFERRED` bis Entscheidungen/Evidence vollständig.

## 9. Stripe / Billing / Referral

### Aktive Basis

- Starter Checkout/Billing-Grundlage und Production-Billing-Basis vorhanden.
- Staging/Test Mode Infrastruktur vorhanden.
- Referral-Policy/Attribution/Lifecycle-Code weitgehend implementiert.
- zentraler Finishline-Tracker dokumentiert einen rollback-gesicherten Referral-/Billing-Lifecycle in Staging.

### Nicht automatisch aktivieren

- Referral-Billing Production bleibt bewusst fail-closed bis externe Rechts-/Steuer-/Aktivierungsentscheidung erfüllt ist.
- #642 enthält teilweise veraltete Vorbedingungscheckboxen, weil Staging/Stripe/Lifecycle später fortgeschritten sind. Nicht erneut von Null aufbauen; Rest ist gegen aktuelle Evidence zu bestimmen.
- internes 1-EUR/Tag-Abo #627 darf nicht ohne ausdrückliche finanzielle Einzelgenehmigung real bezahlt/gestartet werden. Audit-/Repo-Freigaben sind keine Zahlungsfreigabe.

## 10. Meta Pixel / Events Manager

### Technisch fertig

Consent-gesteuertes Meta Pixel ist auf erlaubte öffentliche Seiten begrenzt:

- kein Laden vor Marketing-Consent;
- nur parameterloses `PageView`;
- keine geschützten CRM/Admin/Billing-Routen;
- kein Advanced Matching;
- keine Conversions API;
- keine PII-/CRM-/Billing-Parameter;
- `CompleteRegistration` und `Lead` sind bewusst nicht verdrahtet.

### Extern offen (#714)

- Meta Events Manager/Test Events im normalen Browser;
- kein Event vor Consent;
- exakt erwartete PageViews nach Consent/Navigation;
- kein `CompleteRegistration`/`Lead`;
- Eventdetails ohne PII/Advanced Matching;
- ergänzender Browser/Pixel-Helper-Nachweis;
- finale rechtliche Datenschutzfreigabe.

**Status:** Code `PRODUCTION_CONFIRMED`; externe Meta-Empfangs-/Rechtsabnahme `OPEN`.

## 11. Meta Facebook/Instagram Content/DM Foundation

Nicht neu bauen:

- mandantengetrennte Meta-Verbindungsgrundlage;
- serverseitige Tokenbehandlung;
- Facebook/Instagram OAuth-/Login-/Auswahlgrundlagen;
- Graph API v25.0 Grundlage;
- Webhook-/begrenzte DM-/Conversation-Historie;
- Content-/Insight-/Communication-Analysis-Datenmodell;
- Staging Meta-Content-Migrationen und RLS-/Idempotenzgrundlagen;
- Pagination-/Continuation-/Catch-up-Queue-Verträge sind teilweise implementiert/vorbereitet.

Noch offen vor echter Phase-3-Abnahme:

- aktuelle Meta Live-Credentials/Testkonto;
- App Review/Permissions;
- externe Kontoauswahl;
- echter Webhook-/Conversation-/Token-/Reconnect-/Revocation-E2E;
- erforderliche rechtliche Freigabe/Transparenz/Retention;
- nur danach aktive Produktkennzeichnung.

## 12. WhatsApp

Dormante Cloud-API-Inbound-Grundlage ist gemergt (`e7b46bd...`) und enthält Tenant-/Phone-/WAMID-/Idempotenz-/Tombstone-/Logging-Grenzen. Sie ist **keine live abgenommene Phase-3-Integration**.

Noch offen:

- kontrolliertes Schema/Apply am vorgesehenen Staging-Ziel;
- Meta/WhatsApp Business Credentials/Permissions;
- realer Staging-E2E;
- Token-/Revocation-/Reconnect-Grenzen;
- rechtliche Provider-/Retention-Grenze;
- Production-Aktivierung erst nach eigener Freigabe.

## 13. Phase 3 Social Finishline

### Facebook

Foundation weit fortgeschritten; keine Neuimplementierung. Externe Live-/App-Review-/E2E-Abnahme offen.

### Instagram

Foundation weit fortgeschritten; keine Neuimplementierung. Business Login/Permissions/App Review/E2E offen.

### WhatsApp

Dormanter Inbound-Code vorhanden; echte Connector-/Schema-/Credentials-/Staging-/E2E-/Production-Abnahme offen.

**Phase 3 als Gesamtphase:** `NOT_ACCEPTED`.

## 14. Phase 7 Social Finishline

### TikTok

Kein Scraping/Fake-Inbox. Vor Umsetzung muss der offiziell verfügbare Scope für den gewünschten FanMind-Inbox-/Kommentar-/DM-Anwendungsfall erneut verifiziert werden. Login/Content-Posting allein ist kein Inbox-Nachweis.

### X / Twitter

Offizielle Developer-/User-Auth-/DM-Grundlage wurde als grundsätzlich machbar eingeschätzt; externe Developer-App und gegebenenfalls kostenpflichtige API-Nutzung/Credits sind separate Voraussetzungen. Keine Kosten ohne separate Freigabe.

### Discord

Zulässiger Zielweg: offizieller Bot/Guild-Connector über OAuth2/Gateway/HTTP API. Kein Self-Bot.

### OnlyFans

Keine Umgehung, kein Reverse Engineering/Scraping. Erst offizielle/vertraglich zulässige API-/Plattformgrundlage nachweisen; andernfalls bleibt die Plattform ehrlich nicht verfügbar.

**Phase 7 als Gesamtphase:** `NOT_STARTED/NOT_ACCEPTED` für reale Integrationen; Machbarkeitsvorarbeit teilweise dokumentiert.

## 15. Website Chat / Telegram / sonstige Foundations

- Website Chat: sicherheitsorientierte, standardmäßig deaktivierte Foundation vorhanden; Staging-/Rechtsabnahme und Aktivierung offen. Kein Zweiweg-/Auto-KI-/Outbound-Chat behaupten.
- Telegram: Webhook-/Bot-Grundlagen vorhanden, aber nicht als Teil der aktuellen Phase-3/7-Verkaufsfinishline mit realer Abnahme zählen, sofern #874 nichts Gegenteiliges festlegt.
- Phase 8/LinkedIn/weitere Plattformen: ausdrücklich nicht beginnen.

## 16. Security / RLS / Member Boundary / Trigger Hardening

### Stark belegt

- `FANMIND_ADMIN_EMAILS` einzige Adminquelle;
- server-only Secrets;
- RLS-/Workspace-Grenzen;
- immutable Action Pins/Supply-Chain Gates;
- Dependency Audit/CodeQL/SBOM/Dependabot;
- Shared Rate Limits;
- CSP/Proxy/IP hardening;
- Webhook/Log PII/Secret minimization;
- read-only Production Audit und Health.

### Kontrolliert offene Grenzarbeiten

Einzelne `supabase/controlled`-Schritte sind absichtlich nicht durch normalen Deploy aktiviert. Bei Member-Data-Boundary, Trigger-Function-Hardening, AI-/Billing-Ledgers und ähnlichen kontrollierten SQL-Pfaden gilt jeweils der aktuelle Runbook-/Staging-/Production-Gate. Ein vorhandener SQL-Runner bedeutet nicht, dass Production-DDL bereits freigegeben ist.

Vor der finalen Social-/Sales-Finishline muss der aktuelle Security-/Production-Smoke erneut gegen den dann finalen Nicht-Social-/Social-Stand laufen.

## 17. Legal / Tax / AVV

Technische/public Truth ist vorbereitet, externe Freigabe bleibt getrennt.

Bestätigte Betreibergrundlage:

- Bernd Guggenberger, Einzelunternehmen — Geschäftsbezeichnung FanMind;
- Turnerstraße 18, 2345 Brunn am Gebirge, Österreich;
- zuständige Gewerbebehörde BH Mödling;
- B2B-only Produktpositionierung;
- `FanMind e.U.` erst nach tatsächlicher Firmenbucheintragung.

Extern offen (#564):

- Gewerbe-/Steuer-/UID-/Registerprüfung;
- finale Impressum-/AGB-/Payment-/Referral-/Privacy-Rechtsprüfung;
- unterschriftsfähige AVV;
- Subprocessor/Region/Transfer-/Retention-Freigaben;
- kundenseitige wirksame AVV-Annahme, soweit erforderlich.

Diese Punkte sind kein Grund, vorhandenen Code neu zu bauen. Sie dürfen aber auch nicht als juristisch erledigt ausgegeben werden.

## 18. Sales Handoff / Verkaufsbereitschaft

Noch **nicht erreicht**.

Erforderlich vor technischer Übergabe:

1. Nicht-Social-Finishline ausreichend technisch grün: Restore, Mobile, AI/Billing, Meta Events/Security gemäß #874.
2. Phase 3 real abgenommen.
3. Phase 7 real abgenommen bzw. OnlyFans ehrlich als technisch/rechtlich nicht zulässig dokumentiert, falls keine offizielle Grundlage existiert.
4. 5-Minuten-Demo-/Sales-Flow auf dem dann aktuellen Production-Commit vollständig abnehmen.
5. Sales-Unterlagen/Roadmap exakt mit realem Production-Scope synchronisieren.
6. Phase 8 unverändert Coming Soon/not started.

Sales-Unterlagen unter `docs/sales/` sind vorbereitet, aber „Unterlagen existieren“ ist nicht gleich „Verkaufsübergabe erfolgt“.

## 19. Open-Issue-Reconciliation

### #874 — zentraler aktiver Finishline-Tracker

Bleibt offen und ist der operative Master für Gates 2–6 und Sales Handoff. Gate 1 ist nach neueren Nachweisen abgeschlossen. Gate-2-Checkboxen sind als realer Restore-E2E weiterhin offen, obwohl Vorbereitung inzwischen wesentlich weiter ist als der ursprüngliche Body.

### #944 — Restore ACL/default ACL

Issue-Body ist technisch teilweise überholt: Code, realer PG17-CI, Worker-Deployment und neues Schema-2-Backup sind abgeschlossen. Offen bleibt der artefaktgebundene echte isolierte Restore/Postcheck; Issue daher nicht einfach löschen, sondern als Restore-Acceptance-Loop fortführen.

### #643 — Staging Session/RLS/Admin Regression

Teilweise durch neuere Staging-/Browser-Acceptance überholt. Restcheckliste gegen heutige Tests/Run-IDs mappen; keine pauschale Neuentwicklung.

### #642 — Referral Lifecycle

Vorbedingungen und Lifecycle wurden später stark weitergeführt. Production Referral Billing/legal activation bleiben offen. Body muss bei nächster Bearbeitung reconciled werden.

### #560 — KI Plus/Ultra

Foundation weit fortgeschritten; Produkt-/Kosten-/Qualitäts-/vollständige Lifecycle-/Legal-/Production-Freigaben bleiben offen.

### #524 — Operations

Weitgehend erledigt; echte Restpunkte: Restore, optional Remote Delete separat, persönliche Notification Settings/optionale Alert-Features. Kein Grund für Ops-Neubau.

### #690 / #584 — Mobile

Repository-/CI-Kern fertig; externe EAS/Signing/Redirect/Realdevice/TestFlight/Store-Abnahme offen.

### #564 — Legal/Tax/AVV

Extern offen, technischer Reader-/Evidence-Rahmen vorhanden.

### #644 — historischer P1 Umbrella

Viele ältere offene Checkboxen sind durch spätere Arbeit überholt. Als Historie nutzen, nicht als heutige Finishline-Quelle; #874 ist aktueller.

### #714 — Meta Events Manager

Technischer Pixelpfad fertig, externer Events-Manager-/Browser-/Legal-Nachweis offen.

### #534 — Admin Operations

Kern weitgehend produktiv. Optionale E-Mail-/Failure-Matrix/Remote-Retention/Restore-Punkte getrennt offen.

### #658 — Remote Offsite Delete

Bewusst nicht freigegeben. Keine Implementierung/Mutation ohne neue ausdrückliche Löschfreigabe.

### #627 — interner 1-EUR/Tag-Test

Reale Zahlung bewusst nicht durch Repository-/Routinefreigabe abgedeckt. Nur nach separater finanzieller Bestätigung.

## 20. Gefundene Widersprüche / stale Truth

1. **Restore Repository Ownership:** alte kanonische Texte sagen user-owned/future org; tatsächliches Repo ist Organization-owned `FanMind/FanMind`. Alte Aussage invalidiert; Admin-Policy live vor Restore revalidieren.
2. **Restore „0/4“ vs Vorbereitung:** reale Restore-E2E-Checkboxen können weiter 0/4 sein, aber Backup-/CI-/Host-/Workflow-Vorbereitung ist wesentlich weiter. Managementkommunikation muss beides getrennt nennen.
3. **#944 Body vs aktueller Backupvertrag:** ursprünglicher ACL-Fehler ist implementiert/deployed/backupseitig akzeptiert; echter Restore bleibt offen.
4. **#642/#643/#644 ältere Staging-Checkboxen vs später Gate-1-Abschluss:** historische Bodies nicht als heutigen Nullstand interpretieren.
5. **Sales-Handoff-Historie:** ältere Aussagen „Verkaufsstart/Übergabe“ sind durch die spätere verbindliche Entscheidung ersetzt: Übergabe erst nach Phase 3/7.
6. **KI Plus/Ultra Testpreise:** ältere Issue-Checkbox „Preise fehlen“ kann gegenüber dem inzwischen nachgewiesenen Staging-Testkatalog stale sein; vollständiger Lifecycle und aktive Produktentscheidung bleiben trotzdem offen.

## 21. Do-not-repeat-Liste

- keinen zweiten Restore-Server bauen;
- Restore-VM/PostgreSQL/TLS/Runner-Grundlagen nicht ohne Drift erneut provisionieren;
- niemals Restore gegen Production oder Supabase Staging;
- keine alten Cloudzy-/systemd-Deploypfade reaktivieren;
- Facebook/Instagram-Foundation nicht neu bauen;
- Mobile-App nicht neu anfangen und nicht als WebView umbauen;
- Plus/Ultra nicht über erfundene Modelle/Quoten aktivieren;
- Referral nicht durch Merge produktiv aktivieren;
- keine Remote-Offsite-Löschung ohne separate Freigabe;
- keinen echten 1-EUR/Tag-Test ohne finanzielle Einzelbestätigung;
- keine Phase-8-Arbeit;
- kein Scraping/Self-Bot/inoffizielle Plattformumgehung;
- keine rote Security-/Governance-CI umgehen;
- nicht aus altem Issue-Checkboxstatus auf aktuellen technischen Stand schließen.

## 22. Exakte Finishline-Reihenfolge ab jetzt

### Gate A — Project Memory V5

PR #975 auf dem exakten aktuellen Head vollständig grün bekommen und mergen. Danach Memory-State auf `ACCEPTED` aktualisieren.

### Gate B — Restore

Aktuelle Org-/Runner-/Host-/Backup-/Target-Fakten revalidieren; dann Resource Readiness → Target Compatibility → DB Restore → DB Postcheck → Storage → Server Config → Cleanup → finale Evidence. Keine Neubeschaffung eines Servers.

### Gate C — Mobile

EAS/Redirect/Signing → signierter Android internal build + Realgerät → Apple/TestFlight/iOS + Realgerät → Push/Store Evidence.

### Gate D — KI/Billing

Produktentscheidungen/Quality/Cost → kompletter Staging Lifecycle → Legal/Tax-Abgrenzung → ausdrückliche Production Activation für Plus/Ultra nur wenn alles erfüllt.

### Gate E — Meta Events/Security

Events Manager im normalen Browser + PII-Negativnachweis + finaler Security/Production Smoke.

### Gate F — Social absolut zuletzt

Facebook → Instagram → WhatsApp real E2E; danach TikTok-Scope, X, Discord und OnlyFans-Machbarkeit/Integration. Jeder Kanal mit Auth/Revocation/Reconnect/Idempotenz/Tenant-/No-Auto-Send-Nachweis.

### Gate G — Sales Handoff

Finaler Production-Demo-Flow, Sales-Unterlagen/Produktwahrheit synchron, technische Übergabe an Gerhard. Phase 8 bleibt nicht begonnen; Legal/Tax/AVV parallel und entgeltliche Aktivierung fail-closed, wo nötig.

## 23. Abschlussbewertung dieses Audits

FanMind ist **nicht bei Null und nicht weit von einem fertigen technischen Kern entfernt**. Der Web-/CRM-/Production-/Operations-/Staging-Unterbau ist sehr weit fortgeschritten. Die verbleibende Finishline besteht überwiegend aus realen, externen und kontrollierten Acceptance-Gates: vollständiger isolierter Restore, signierte Mobile-Builds/Realgeräte/Stores, Plus/Ultra-Produkt-/Lifecycle-Evidence, Meta Events Manager/Security-Endabnahme und schließlich echte Phase-3-/Phase-7-Social-Verbindungen.

Der wichtigste operative Schutz lautet: Von nun an wird bei jeder Arbeit zuerst dieses Audit zusammen mit `CURRENT_STATE.md`, `STARTED_WORK.md`, `OPEN_LOOPS.md`, #874 und der aktuellen Git-/CI-/Runtime-Evidence gelesen. Kein älterer Prozentwert oder Checkbox-Body darf ohne Revalidation als aktuelle Wahrheit verwendet werden.
