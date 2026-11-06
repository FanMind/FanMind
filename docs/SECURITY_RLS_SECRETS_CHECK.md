# FanMind Security-/RLS-/Secrets-Check

Stand: 2. August 2026

Dieser Check muss vor Pilotkundendaten, produktiver Integration-Aktivierung, Billing-Aktivierung oder größeren Deployments geprüft werden. Ziel ist, dass FanMind als echter CRM-Kern sicher betrieben wird und keine Secrets, Workspace-Daten oder Kundendaten falsch sichtbar werden.

## 1. Ergebnisstatus

Vor einem produktionsrelevanten Release muss ein Status gesetzt werden:

- `[ ]` nicht geprüft
- `[ ]` geprüft, offene Blocker
- `[ ]` geprüft, keine Blocker
- `[ ]` geprüft, nur dokumentierte Restrisiken

Blocker dürfen nicht stillschweigend deployed werden.

## 2. Secrets und ENV

### Server-only Secrets

Diese Werte dürfen niemals in Client-Code, Logs, Screenshots, README-Beispielen mit echten Werten oder Bundles auftauchen:

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_WEBHOOK_APP_SECRET`
- `FANMIND_TOKEN_ENCRYPTION_KEY`
- `FANMIND_PUSH_TOKEN_ENCRYPTION_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- Runner-/Deployment-Tokens
- echte Admin-E-Mail-Listen in nicht geschützten Kontexten

### Server-only Zielbindungen

`FANMIND_MOBILE_PUSH_EAS_PROJECT_ID` ist kein Schlüssel, muss aber
serverseitig aus bestätigter Konfiguration stammen. Sie darf nie aus dem
Mobile-Request übernommen werden und muss exakt mit der freigegebenen
EAS-Projekt-ID übereinstimmen.

### Public ENV

Diese Werte dürfen öffentlich sein, müssen aber trotzdem korrekt gesetzt sein:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Checkliste

- [ ] `.env.example` enthält nur Platzhalter, keine echten Secrets.
- [ ] `.env.local` ist nicht committed.
- [ ] `.env.production` liegt nur auf dem Server und nicht in Git.
- [ ] Keine echten Secrets in Issues, PRs, Screenshots, Logs oder Dokumentation.
- [ ] API-Antworten und Runtime-Logs geben keine Rohfehler von Supabase,
      Stripe, Storage, Telegram oder anderen Providern aus; Browsergrenzen
      verwenden feste Fehlercodes und redigierte Meldungen.
- [ ] `FANMIND_ADMIN_EMAILS` ist in Production gesetzt, wenn Adminbereich genutzt wird.
- [ ] Es gibt keine hardcodierten echten Admin-E-Mail-Fallbacks.
- [ ] Alle Service-Role-Zugriffe laufen serverseitig.
- [ ] Browser-Code nutzt nur Supabase URL und Anon Key.
- [ ] Jeder Mobile-Push-Staging-Workflow verwendet eine eigene absolute
      PGPASS-Datei mit Modus `0600`, gibt keine SQL-Diagnosen aus und entfernt
      die Datei auch nach Fehlern.

## 3. Auth und Session

- [ ] `/dashboard`, `/fans`, `/fans/import`, `/fans/[id]`, `/followups`, `/billing/*` und `/admin/*` prüfen Supabase-Session.
- [ ] Server Actions und API-Routen prüfen Session, bevor sie Daten lesen oder schreiben.
- [ ] Logout entfernt Supabase-Session-Cookies.
- [ ] Temporäre Demo-User haben Ablaufzeit.
- [ ] Temporäre Demo-Workspaces enthalten keine echten Kundendaten.
- [ ] Öffentliche Demo-Fallbacks sind nur Notlösung und nicht primärer Sales-Pfad.

## 4. Workspace-Autorisierung

Jede geschützte Route muss User -> Workspace -> Ressource prüfen.

- [ ] Kontaktzugriff läuft über `requireContactInAuthorizedWorkspace` oder gleichwertige Prüfung.
- [ ] Workspacezugriff läuft über `requireAuthorizedWorkspace` oder gleichwertige Prüfung.
- [ ] Kontakt-ID aus Request reicht nie allein als Berechtigung.
- [ ] API-Routen prüfen, dass Ressource wirklich zum autorisierten Workspace gehört.
- [ ] Server Actions prüfen Kontakt/Workspace vor Mutationen.
- [ ] Admin-Routen prüfen `requirePlatformAdmin`.
- [ ] Admin-Definition kommt nur aus `FANMIND_ADMIN_EMAILS`.

## 5. RLS-Pflicht für Tabellen

RLS muss auf allen workspace- oder userbezogenen Tabellen aktiv und getestet sein.

Zusätzlich dürfen reine Triggerfunktionen nicht als öffentliche RPC-Endpunkte
ausführbar sein. Ihr `search_path` muss fest auf vertrauenswürdige Schemata
gebunden sein. Der frühere `SECURITY DEFINER`-Retention-Trigger bleibt bis zu
seiner kontrollierten Entfernung für `public`, `anon` und `authenticated`
gesperrt. Die kontrollierte SQL liegt deshalb ausschließlich unter
`supabase/controlled/` und darf weder durch einen Web-Deploy noch durch ein
generisches `supabase db push` angewendet werden. Der Staging-Lauf ist
abgenommen. Der getrennte Production-Deploy installiert nur root-eigene,
nicht aktivierte Kontrollartefakte. Read-only Verify und Apply verwenden
unterschiedliche ausdrückliche Bestätigungen, sind an den exakten Live-Commit
und das geschützte Production-Environment gebunden und verlangen davor sowie
danach den vollständigen read-only Production-Audit. Ein Production-Apply
bleibt bis zu einer erneuten ausdrücklichen Freigabe ungestartet. Runbooks:
`docs/operations/TRIGGER_FUNCTION_HARDENING_STAGING.md` und
`docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md`.

### Auth-/Workspace-Kern

- [ ] `profiles`
- [ ] `workspaces`
- [ ] `workspace_members`
- [ ] Workspace-Member-Datengrenze nach
      `docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md` abnehmen:
  - zuerst den exakt geprüften `main`-Commit auf isoliertes Staging deployen
    und `/api/version` auf Commit plus `runtimeEnvironment=staging` prüfen;
  - read-only Rollout-State darf für den Boundary nur `apply` oder bei bereits
    vollständig gültigem Stand `verify`, niemals `block`, melden;
  - Apply ausschließlich über
    `FanMind Workspace Member Data Boundary Staging Apply` mit
    `apply-workspace-member-data-boundary`;
  - danach getrennten read-only Workflow
    `FanMind Workspace Member Data Boundary Staging Verify` mit
    `verify-workspace-member-data-boundary` ausführen;
  - nur vollständigen Preflight, `APPLY=completed`, Postflight und
    `READY=APPLIED_AND_VERIFIED` gemeinsam akzeptieren;
  - danach reale Chromium-/CSV-Abnahme mit synthetischem Owner und Member,
    Cleanup, abschließendem Boundary-Postflight und finalem separatem Verify;
  - kein Apply gegen Production, Restore, generische Migration oder einen
    nicht exakt release-gebundenen Staging-Stand.

### CRM-Kern

- [ ] `contacts`
- [ ] `memories`
- [ ] `followups`
- [ ] `conversations`
- [ ] `conversation_messages`
- [ ] `conversation_summaries`
- [ ] `contact_ai_profiles`
- [ ] `workspace_voice_profiles`
- [ ] `workspace_ai_prompt_settings`
  - kontrollierter Apply-/Postflight-Ablauf:
    `docs/operations/AI_PROMPT_MIGRATION.md`
- [ ] `workspace_ai_tier_entitlements`
  - ausschließlich `service_role`, keine Browser-Policy oder Browserrechte;
  - checksum-gebundener Apply-/Postflight-Ablauf:
    `docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md`
  - vor der Abnahme manuellen Workflow
    `FanMind AI Tier Staging Migration` ausschließlich auf `main` und im
    GitHub-Environment `staging` ausführen; nur
    `AI_TIER_ENTITLEMENT_MIGRATION_APPLY=completed` zusammen mit
    `AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS` akzeptieren;
  - vor Production manuellen Workflow `FanMind AI Tier Staging Acceptance`
    auf getrenntem Staging ausführen; nur
    `AI_TIER_STAGING_ACCEPTANCE=PASS` zusammen mit
    `AI_TIER_STAGING_TRANSACTION=ROLLED_BACK` als technischen Nachweis
    akzeptieren.
- [ ] `mobile_push_registrations`
  - ausschließlich `service_role`, keine Browser-Policy, keine Tabellen- oder
    Spaltenrechte für `anon` oder `authenticated`;
  - checksum-gebundener Staging-Kontrollpfad:
    `docs/operations/MOBILE_PUSH_STAGING_CONTROL.md`;
  - zuerst `FanMind Mobile Push Staging Resource Readiness` read-only für den
    exakten geprüften `main`-Commit ausführen;
  - Apply ausschließlich über `FanMind Mobile Push Staging Migration` und nur
    akzeptieren, wenn `MOBILE_PUSH_REGISTRATION_MIGRATION_APPLY=completed` und
    `MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS` gemeinsam vorliegen;
  - danach `FanMind Mobile Push Staging Acceptance` mit synthetischem
    Nicht-Demo-Owner und -Member ausführen; nur
    `MOBILE_PUSH_STAGING_ACCEPTANCE=PASS`,
    `MOBILE_PUSH_STAGING_TRANSACTION=ROLLED_BACK` und
    `MOBILE_PUSH_STAGING_CLEANUP=PASS` gemeinsam akzeptieren;
  - der Nachweis aktiviert weder echten Token-Upload noch Push-Zustellung.
- [ ] Mobile-Push-Delivery vor jedem realen Staging-Send:
  - `docs/mobile/PUSH_DELIVERY.md` vollständig prüfen;
  - keine Route, kein Timer/Worker und kein Provideraufruf, solange kein
    genehmigter service-role-only Ledger atomare Reservation, maximal drei
    Versuche, Ticket, Receipt, Token-Widerruf und Cleanup beweist;
  - die Reserve-RPC muss exakt dasselbe strukturell validierte Supabase-
    URL-/Ref-/Service-Role-Binding wie der Loader erhalten, Membership,
    Workspace-Verarbeitung, Kontakt, Follow-up, aktive Registrierung und deren
    aktuellen Token-Fingerprint innerhalb derselben Transaktion erneut prüfen
    und Projekt-Ref, Fingerprint sowie einen frischen kanonischen
    Revalidierungsnachweis liefern;
  - `DeviceNotRegistered` muss unter der reservierten Send- oder Receipt-Lease
    Attempt-Terminalisierung und Registrierungsdeaktivierung in derselben
    Datenbanktransaktion ausführen; getrennte Writes sind unzulässig;
  - `FANMIND_MOBILE_PUSH_EXPO_ACCESS_TOKEN` ausschließlich serverseitig und
    niemals in `EXPO_PUBLIC_*`, Logs oder Artefakten setzen;
  - konfigurierte und unabhängig geprüfte EAS-Projekt-ID müssen exakt
    übereinstimmen; zusätzlich müssen `staging.fanmind.ch`, Staging-Supabase-
    Ref und Production-Supabase-Ref unabhängig geprüft und exakt gebunden sein;
    beide Supabase-Refs müssen verschieden sein;
  - ausschließlich feste Payload ohne CRM-Inhalt und mit einstündiger TTL;
    Providertexte verwerfen;
  - CI-Dormanztest muss jede Route, jeden Worker/Timer und jede vorzeitig
    angeschlossene Delivery-Migration ablehnen;
  - Production-Aktivierung bleibt gesperrt.
- [ ] `fan_analysis_reports`
- [ ] `communication_analysis_reports`
- [ ] `workspace_analysis_settings`
- [ ] Meta-Content-Migration nur über
  `docs/operations/META_CONTENT_STAGING_MIGRATION.md`:
  - beide SQL-Dateien müssen die festgeschriebenen SHA-256-Prüfsummen erfüllen;
  - zuerst `FanMind Meta Content Staging Resource Readiness` read-only
    ausführen; der Workflow besitzt keinen Apply-Befehl und keine
    Nicht-Production-Schreibfreigabe;
  - Workflow nur auf `main`, exakter geprüfter Commit, geschütztes `staging`;
  - Staging-Origin und Supabase-Projektidentität müssen von Production
    abweichen; GitHub Hosted verwendet ausschließlich den IPv4-kompatiblen
    Supavisor-Session-Pooler auf Port `5432`, der Nutzer ist fest
    `postgres.<staging-project-ref>`; ein regional geteilter Pooler-Hostname
    ersetzt niemals diese Projektbindung; TLS ausschließlich `verify-full` mit
    absolutem CA-Pfad;
  - Passwort nur über absolutes reguläres `PGPASSFILE` mit `0600`, keine
    Connection-URL oder libpq-Zielumleitung;
  - nur `META_CONTENT_MIGRATION_POSTFLIGHT=PASS` zusammen mit
    `META_CONTENT_ANALYSIS_ACTIVATION=disabled` akzeptieren;
  - partielle/driftende Schemata niemals automatisch reparieren oder erneut
    anwenden; keine Meta-Verbindung, Analyse, App-Review- oder Production-
    Aktivierung aus diesem Workflow.
- [ ] `content_sources`
- [ ] `content_metric_snapshots`
- [ ] `contact_reply_targets`

### Integrations-/Webhook-Tabellen

- [ ] `social_connections`
  - Browser darf `page_access_token_encrypted` weder selektieren noch mutieren;
  - nur Owner/Admin dürfen OAuth starten, Callback abschließen oder trennen;
  - `(platform, external_account_id)` ist für aktive Verbindungen global eindeutig;
  - mehrere verwaltete Seiten verlangen eine ausdrückliche Auswahl;
- [ ] `meta_webhook_events`
- [ ] weitere Integrationstabellen, falls vorhanden

### Billing-/Inquiry-Tabellen

- [ ] Billing-Felder an `workspaces` sind nur für Workspace-Owner/Admin sichtbar.
- [ ] **Rollout-Blocker:** RPC, App-Kompatibilität und exakte
      Workspace-Spaltenrechte sind in
      `supabase/migrations/20260726120000_workspace_provisioning_rpc.sql` und
      `supabase/controlled/20260726121000_workspace_server_owned_columns.sql`
      vorbereitet. Der Contract-Schritt liegt absichtlich außerhalb des
      automatischen Migration-Sets. Der
      Blocker ist erst nach Production-Preflight, Anwendung beider Schritte und
      positiver/negativer Abnahme gemäß
      `docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md` geschlossen.
- [ ] `pilot_inquiries` oder vergleichbare Anfrage-Tabellen sind serverseitig schreibbar und nicht öffentlich lesbar.
- [ ] Stripe-Referenzen sind nicht unnötig im Client sichtbar.
- [ ] `npm run ai:tiers:readiness` meldet `PASS`; die Ausgabe enthält nur
      READY/BLOCKED und feste Blocker-Codes, niemals Stripe-IDs, Modelle,
      Limits oder Secrets.

## 6. RLS-Testfälle

Mindestens diese Testfälle vor Pilotkundendaten prüfen:

- [ ] User A sieht nur eigenen Workspace.
- [ ] User A sieht keine Kontakte von User B.
- [ ] User A kann keine Memories/Follow-ups/Conversations anderer Workspaces lesen.
- [ ] User A kann keine Kontakt-ID aus anderem Workspace mutieren.
- [ ] Owner kann keinen Workspace direkt anlegen oder upserten.
- [ ] Owner kann Plan-, Preis-, Billing-, Stripe-, Invoice-, Subscription-,
      Owner- und `test_access_flags`-Spalten weder einzeln noch in einem
      gemischten PATCH mit erlaubten Stammdaten ändern.
- [ ] Owner kann exakt die zehn dokumentierten Workspace-Stammdatenfelder
      ändern; fremde Workspace-Zeilen bleiben durch RLS gesperrt.
- [ ] `ensure_current_user_workspace(...)` ist idempotent, concurrency-sicher,
      Starter-only und erzeugt Workspace plus Owner-Membership atomar.
- [ ] User ohne Session wird auf Login geleitet oder bekommt 401.
- [ ] Nicht-Admin wird aus Adminbereich auf Dashboard geleitet.
- [ ] Temporärer Demo-User kann keine echten externen Verbindungen benutzen.
- [ ] Demo-Workspace-Ablauf löscht oder blockiert alte temporäre Daten.

## 7. API- und Server-Action-Check

- [ ] `/api/ai/reply-suggestions` prüft Kontakt im Workspace.
- [ ] `/api/ai/prompt-settings` prüft Workspace-Mitgliedschaft, Owner-/Admin-Mutation und vertrauenswürdigen Origin.
- [ ] `/api/demo/start` nutzt Service Role nur serverseitig.
- [ ] `/api/inquiries` validiert, rate-limitiert und speichert serverseitig.
- [ ] `/api/billing/checkout` prüft Session, Workspace und Plan/Commercial Option.
- [ ] Cookie-authentifizierte Browsermutationen für Session, Logout, Demo,
      Inquiry, Referral, Admin-Billing, Admin-Anfragen, Benachrichtigungen,
      Backup-Jobs, Meta-Selbsttest und Facebook-Disconnect prüfen
      `Origin` sowie `Sec-Fetch-Site` gegen die zentrale FanMind-Allowlist.
- [ ] JSON- und Form-Request-Bodies werden vor dem Parsen bytegenau begrenzt;
      auch chunked Streams werden beim ersten Überschreiten abgebrochen und
      nicht erst vollständig in den Speicher geladen.
- [ ] Mobile-/Service-Routen ohne Browser-Origin umgehen diese Grenze nur mit
      einem separat validierten Bearer-/Service-Secret; externe Webhooks
      verwenden weiterhin ihre jeweilige kryptographische Signaturprüfung.
- [ ] `/api/stripe/webhook` prüft Stripe-Signatur.
- [ ] `/api/webhooks/meta` prüft Meta-Signatur, sofern Secret gesetzt ist.
- [ ] `/api/integrations/telegram/send-message` ist nicht Teil der Standarddemo und muss feature-geflaggt, admin-/pilot-only oder deaktiviert sein, sofern nicht explizit freigegeben.
- [ ] Server Actions unter `src/app/fans/actions.ts` prüfen Workspace/Kontakt vor Mutation.

## 8. KI-Sicherheit

- [ ] `OPENAI_API_KEY` ist nur serverseitig.
- [ ] Kein OpenAI-Key im Browser-Bundle.
- [ ] Inputlängen sind begrenzt.
- [ ] Rate Limit ist aktiv.
- [ ] Prompt verbietet automatische Sendung und falsche Integrationsbehauptungen.
- [ ] Workspace-Unternehmens-Prompt und Antwortprofile werden erst nach Workspace-Autorisierung serverseitig geladen.
- [ ] Nur Workspace-Owner oder Plattform-Admins dürfen Prompt-Einstellungen ändern; Mitglieder bleiben lesend.
- [ ] Freier Prompttext erscheint weder in KI-Usage-Logs noch im Browser-Request an die Antwort-API.
- [ ] Workspace-Prompts können Sicherheits-, Wahrheits-, Datenschutz-, Schema-, Kosten- oder Manuell-Senden-Regeln nicht überschreiben.
- [ ] Ausgabe ist strukturiert.
- [ ] Fehlertexte geben keine internen Details/Secrets aus.
- [ ] Model-ID ist idealerweise serverseitig konfigurierbar, nicht breit hardcodiert.
- [ ] Usage/Kosten werden vor Skalierung geloggt oder mindestens geschätzt.

## 9. Integration- und Sendelogik

- [ ] Meta/Facebook/Instagram wird nicht als allgemein live verkauft, solange nicht validiert.
- [ ] Telegram-Senden ist nicht in Gerhards Standarddemo sichtbar, solange es kein explizit freigegebener Pilot ist.
- [ ] WhatsApp Cloud Inbound bleibt standardmäßig deaktiviert und darf nur
      nach kontrollierter Schema-Prüfung in einer expliziten Non-Production-
      Laufzeit aktiviert werden; Production, Outbound und Senden bleiben
      gesperrt. TikTok/X/Discord bleiben Roadmap/Coming Soon.
- [ ] Keine externe Plattform-Passwörter oder Login-Daten speichern.
- [ ] Keine Scraper bauen.
- [ ] Keine automatische Sendefunktion bauen oder bewerben.
- [ ] Buttons müssen ehrlich heißen: `Kopieren`, `Originalkanal öffnen`, `Entwurf speichern`, nicht `automatisch senden`.

## 10. Billing-/Stripe-Check

- [ ] Stripe Checkout nur für Pilot/Starter, solange Growth/Agency Coming Soon sind.
- [ ] `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` sind server-only.
- [ ] Price IDs sind serverseitig gesetzt.
- [ ] Checkout blockiert Demo-User.
- [ ] Checkout prüft Workspace und Commercial Option.
- [ ] Webhook prüft Signatur.
- [ ] Billing-Status darf nicht durch unautorisierte User verändert werden.
- [ ] Stripe-IDs und interne Testflags stammen aus einer server-eigenen Quelle
      und können nicht über die Workspace-Owner-Policy umgebogen werden.
- [ ] Stripe-Webhooks laden das Ziel vor jedem Billing-PATCH serverseitig und
      lehnen feste sowie temporäre Demo-Workspaces einschließlich alter
      direkter `workspace_id`-Metadaten fail-closed ab.
- [ ] Der Demo-Block stützt sich vor dem kontrollierten Spalten-Contract nur
      auf feste Auth-Identität oder serverseitige `demo_start_sessions`, nicht
      allein auf owner-veränderbare Workspace-Status- oder Testflag-Felder.
- [ ] Stripe-Referenz-/Guard-/Auth-/Session-/PATCH-Fehler liefern Stripe einen
      Retry-Fehler; nur erfolgreich bestätigte Referenz-Nulltreffer gelten als
      nicht zugeordnet. Doppelte oder widersprüchliche Stripe-Referenzziele
      scheitern ebenfalls retry-fail-closed. Ein bewusstes Demo- oder
      `manual_suspended`-Block dagegen startet keine Referral-Synchronisierung;
      letzterer muss nach einem Nullzeilen-PATCH nochmals exakt per Service
      Role bestätigt werden, andernfalls bleibt das Event retryable.
- [ ] Ein Webhook-PATCH gibt exakt die erwartete Workspace-ID zurück, bevor
      Referral-Status oder Stripe-Rabatt synchronisiert werden.
- [ ] Admin-Overrides sind admin-only.
- [ ] UI verkauft Billing nicht als vollständige Payment-Plattform, sondern als Setup-/Zahlungsstart.

## 11. Deployment-Check

- [ ] `npm run build` läuft erfolgreich.
- [ ] `npm run lint` läuft oder bekannte Warnungen sind dokumentiert.
- [ ] Migrationen sind angewendet oder Migrationsbedarf ist im PR beschrieben.
- [ ] Production-ENV enthält alle benötigten server-only Werte.
- [ ] Deployment-Workflow bleibt Exoscale/PM2/nginx-konform.
- [ ] Healthcheck auf `/login` erfolgreich.
- [ ] Rollback-Plan ist bekannt: vorheriger Commit / PM2 restart / nginx prüfen.

## 12. Dokumentations-Check

Bei Änderungen an Security, RLS, Secrets, Billing, Integrationen oder KI müssen diese Dateien geprüft werden:

- [ ] `docs/SOURCE_OF_TRUTH.md`
- [ ] `README.md`
- [ ] `AGENTS.md`
- [ ] `docs/database/fanmind_current_schema.md`
- [ ] `.env.example`
- [ ] relevante Legal-/Pricing-Seiten
- [ ] PR-Beschreibung enthält Security/RLS/Secrets-Auswirkung

## 13. Abnahmeformel

Ein Release ist für Pilotkunden sicherer, wenn alle Aussagen wahr sind:

1. Kein Secret ist im GitHub-Repository.
2. Kein Nutzer kann Workspace-Daten eines anderen Nutzers lesen oder ändern.
3. Kein Demo-User kann echte externe Aktionen auslösen.
4. Keine nicht validierte Integration wird als live verkauft.
5. Keine KI-Antwort wird automatisch gesendet.
6. Kostenrisiken sind über Rate Limits und perspektivisch Usage-Logging begrenzt.
7. README, AGENTS und Source of Truth erzählen denselben Stand.


## Serverfehler-Telemetrie

- [x] Migration `20260718203000_privacy_server_error_tracking.sql` ist transaktional und checksum-gepinnt; Anwendung bleibt ein separater Production-Schritt.
- [x] Postflight prüft RLS für `server_error_events` und `server_error_groups`.
- [x] Postflight sperrt Tabellen- und Funktionsrechte für `PUBLIC`, `anon` und `authenticated`.
- [x] `record_server_error_event(...)` und `cleanup_server_error_events(...)` werden als `security definer`, festem `search_path` und service-role-only geprüft.
- [x] Code, Schema und Acceptance speichern keine Fehlermeldungen, Stacks, Header, Query-Parameter, Bodies, IP-Adressen oder Kundendaten.
- [x] Fehlende Route-Schablone wird als `/unknown` gespeichert und fällt nie auf den realen Request-Pfad zurück.
- [x] Kontrollweg hält E-Mail aus, nutzt nur eine reservierte technische Fingerprint-Referenz und entfernt alle synthetischen Zeilen wieder.
- [x] Migration auf Production kontrolliert repariert und unabhängig verifiziert; Tracking rollback-gesichert aktiviert, E-Mail bleibt separat gesperrt.
- [x] Stabiles Betriebsfenster nach Aktivierungs-Reload mit unveränderten 40 PM2-Restarts, 2.213 Sekunden Uptime, 8/8 Health und deaktivierter E-Mail belegt.
