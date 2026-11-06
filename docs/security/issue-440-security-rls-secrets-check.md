# Issue #440 – Security-/RLS-/Secrets-Check

Stand: 2026-07-06

## Ergebnisstatus

- [x] geprüft, nur dokumentierte Restrisiken
- [x] konkreter Sicherheitsfehler gefunden und minimal behoben: Telegram-Senden war für jeden authentifizierten Workspace-Nutzer mit Telegram-Kontakt erreichbar. Es ist jetzt standardmäßig per `FANMIND_ENABLE_TELEGRAM_SEND=false` deaktiviert, im UI versteckt und serverseitig zusätzlich auf Plattform-Admins sowie Nicht-Demo-User begrenzt.
- [x] keine offenen kritischen Blocker im Repository-Check gefunden; deshalb wurden keine separaten GitHub-Issues für kritische Blocker angelegt.

## Geprüfte Punkte

### 1. Secrets und ENV

- `.env.example` geprüft: nur Platzhalter; neues `FANMIND_ENABLE_TELEGRAM_SEND=false` dokumentiert.
- `.env.local` und `.env.production` sind nicht im Arbeitsbaum committed.
- Server-only Werte (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Meta-/Telegram-/Resend-Secrets) wurden per `rg` gegen Code, Docs und Workflow geprüft. Es wurden keine echten Schlüsselwerte im Repository gefunden; Dokumentationsbeispiele nutzen Platzhalter.
- Admin-Quelle geprüft: `src/lib/admin.ts` nutzt ausschließlich `FANMIND_ADMIN_EMAILS`; es gibt keinen hardcodierten echten Admin-Fallback.
- Service-Role-Nutzung geprüft: Service Role wird in Server-Dateien und API-Routen verwendet, nicht in Client-Komponenten.

### 2. Auth, Session und geschützte Seiten

- Geschützte Seiten `/dashboard`, `/fans`, `/fans/import`, `/fans/[id]`, `/followups`, `/billing/*` und `/admin/*` wurden auf serverseitige Session-/Workspace- bzw. Admin-Prüfung geprüft.
- Logout-Route löscht Supabase-Session-Cookies.
- Temporäre Demo-User enthalten `demo_expires_at`; Demo-Status wird serverseitig ausgewertet.
- Demo-Workspaces werden über `areDemoConnectionsDisabled` für echte externe Verbindungen geblockt; Telegram-Senden ist zusätzlich serverseitig gesperrt.

### 3. Workspace-Isolation

- Zentrale Guards geprüft: `requireAuthorizedWorkspace`, `requireContactInAuthorizedWorkspace` und `requireResourceInAuthorizedWorkspace` prüfen User → Workspace → Ressource.
- Kontaktzugriffe in AI-Route und Fan-Server-Actions laufen über Kontakt-im-Workspace-Prüfung.
- Adminbereiche und Admin-API-Routen prüfen `requirePlatformAdmin`.
- Risiko bleibt: Die Prüfung basiert zusätzlich auf dokumentierten Supabase-RLS-Policies; ein Live-DB-Test mit zwei echten Supabase-Testusern wurde in dieser lokalen Umgebung nicht ausgeführt.

### 4. Supabase RLS

- Migrationen und `docs/database/fanmind_current_schema.md` geprüft.
- RLS ist in Migrationen für Kern-/Workspace-Tabellen dokumentiert bzw. aktiviert: `contacts`, `memories`, `followups`, `conversations`, `conversation_messages`, `conversation_summaries`, `contact_ai_profiles`, `workspace_voice_profiles`, `fan_analysis_reports`, `contact_reply_targets`, `social_connections`, `meta_webhook_events`, `pilot_inquiries`.
- `profiles`, `workspaces` und `workspace_members` sind in der aktuellen Datenbank-Source-of-Truth als RLS-geschützt dokumentiert.
- Offenes Restrisiko: Ohne Zugriff auf die produktive Supabase-Instanz konnte nicht verifiziert werden, ob alle Migrationen dort tatsächlich angewendet sind.

### 5. API-Routen und Server Actions

- `/api/ai/reply-suggestions`: prüft Kontakt im autorisierten Workspace, begrenzt Inputlängen, rate-limitiert und nutzt `OPENAI_API_KEY` serverseitig.
- `/api/copilot/reply`: re-exportiert die geprüfte AI-Route.
- `/api/demo/start`: nutzt Service Role serverseitig, erzeugt temporäre Demo-User mit Ablaufzeit und Session-Cookies.
- `/api/inquiries`: validiert Eingaben, nutzt Honeypot und Rate Limit, speichert serverseitig.
- `/api/billing/checkout`: prüft Session, blockiert temporäre Demo-User, validiert Plan/Commercial Option gegen Workspace und nutzt Stripe serverseitig.
- `/api/stripe/webhook`: prüft Stripe-Signatur vor Billing-Updates.
- `/api/webhooks/meta`: prüft Meta-Signatur, sofern ein App Secret gesetzt ist.
- `/api/integrations/facebook/*`: prüft Session/Workspace und blockiert Demo-Workspaces für echte Verbindungen.
- `/api/integrations/telegram/webhook`: prüft Telegram-Secret, sofern gesetzt; verarbeitet externe Inbound-Events serverseitig.
- `/api/integrations/telegram/send-message`: war der konkrete Sicherheitsfund; jetzt standardmäßig deaktiviert, admin-only und demo-blockiert.
- `src/app/fans/actions.ts`: Server Actions wurden stichprobenartig auf Workspace-/Kontaktguards vor Mutationen geprüft.

### 6. Demo-User und externe Aktionen

- Temporäre Demo-User werden mit Ablaufmetadaten angelegt.
- Demo-Verbindungen sind für Facebook/Meta geblockt.
- Telegram-Senden ist jetzt nicht mehr im Standarddemo-UI sichtbar und serverseitig für Demo-User gesperrt.
- Keine automatische Sendefunktion wurde neu gebaut.

### 7. Adminbereich

- Admin-Seiten und Admin-API-Routen verwenden `requirePlatformAdmin`.
- Admin-Definition kommt nur aus `FANMIND_ADMIN_EMAILS`.
- Billing-Admin-Overrides sind admin-only.

### 8. Billing/Stripe

- Checkout ist auf konfigurierte Pilot-/Starter-Optionen beschränkt und gleicht Plan/Commercial Option gegen den Workspace ab.
- Demo-User können Checkout nicht starten.
- Stripe-Secrets und Price IDs werden serverseitig gelesen.
- Stripe-Webhook verifiziert Signaturen, bevor Workspace-Billing-Felder geändert werden.
- Restrisiko: Produktive Stripe-Konfiguration und Webhook-Endpoint-Registrierung konnten lokal nicht live geprüft werden.

### 9. KI-Sicherheit und Kosten

- `OPENAI_API_KEY` wird serverseitig verwendet.
- AI-Eingaben sind in `/api/ai/reply-suggestions` begrenzt.
- AI-Route nutzt Rate Limit.
- Prompt/Schema halten human-in-the-loop Safety Note fest.
- Ausgabe ist strukturiert.
- Restrisiko: Usage-/Kostenlogging ist laut Source of Truth nächster Ausbau und noch nicht als vollständige Skalierungsüberwachung aktiv.

### 10. Deployment und Doku

- Exoscale/PM2/nginx-Deploymentworkflow wurde nicht geändert.
- Produktwahrheit, Pricing und Referral-Logik wurden nicht verändert; deshalb waren keine README-/Source-of-Truth-Inhaltsänderungen nötig.
- Diese Audit-Datei dokumentiert geprüfte Punkte, gefundene Fixes und Restrisiken.

## Offene Blocker

Keine offenen kritischen Blocker aus dem Repository-Check.

## Restrisiken / vor Produktivfreigabe erneut prüfen

1. Live-Supabase-RLS-Test mit zwei getrennten Nutzern/Workspaces durchführen: Cross-Workspace-Reads/-Writes für Kontakte, Memories, Follow-ups, Conversations und Billing-Felder müssen aktiv fehlschlagen.
2. Prüfen, ob alle Migrationen in Production angewendet sind.
3. Production-ENV auf Vollständigkeit prüfen: `FANMIND_ADMIN_EMAILS`, Supabase Public/Service-Role-Werte, Stripe-Secrets/Webhook-Secret, OpenAI-Key, Meta-/Telegram-Secrets nur falls die jeweilige Integration ausdrücklich aktiviert wird.
4. `FANMIND_ENABLE_TELEGRAM_SEND` in Production auf `false` lassen, bis ein explizit freigegebener Admin-/Pilotbetrieb validiert ist.
5. Usage-/Kostenlogging für AI vor Skalierung produktiv ergänzen.
6. Meta-/Telegram-Webhooks nur mit gesetzten Signatur-/Secret-Werten produktiv freischalten.

## Kritische Blocker-Issues

Keine angelegt, weil nach dem Fix keine offenen kritischen Blocker verblieben sind.
