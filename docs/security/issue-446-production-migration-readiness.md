# Issue #446 – Production/Migration Readiness

Stand: 2026-07-06

Ziel: keine neuen Features bauen, sondern Blocker für Production/Migration Readiness rund um PR #444 (`ai_usage_events`) und PR #445 (Referral-Admin-Grundlage) finden, minimal beheben und dokumentieren.

## Ergebnis

- Lokale Migrationsdateien aus PR #444 und PR #445 sind im Branch vorhanden.
- Die RLS-Erwartungen für `ai_usage_events`, `referral_program_state`, `referral_program_members`, `referrals` und `referral_discount_snapshots` sind in den Migrationen und der Datenbank-Dokumentation nachvollziehbar.
- Ein konkreter Readiness-Blocker wurde behoben: `.env.example` und `docs/AI_COST_MONITORING.md` nannten alte KI-Preis-ENV-Namen, während der Runtime-Code `FANMIND_AI_PRICE_*_PER_MILLION_CENTS` und `FANMIND_AI_USAGE_CURRENCY` erwartet.
- Production-Live-Verifikation konnte aus dieser Umgebung nicht abgeschlossen werden, weil HTTPS-Aufrufe auf `https://fanmind.ch` mit `CONNECT tunnel failed, response 403` blockiert wurden und keine lokale `.env.production` verfügbar ist.

## Migrationen aus PR #444 und PR #445

### PR #444: `ai_usage_events`

Datei: `supabase/migrations/20260706120000_ai_usage_events.sql`

Geprüft:

- Tabelle `public.ai_usage_events` wird mit Workspace-, User-, Contact-, Feature-, Modell-, Token-, Kosten-, Status- und Zeitstempelfeldern angelegt.
- Indexe sind für Workspace/Zeitraum, Feature/Zeitraum und Contact/Zeitraum vorhanden.
- RLS wird aktiviert.
- Select-Policy erlaubt nur Workspace-Mitgliedern Zugriff.
- Insert-Policy erlaubt nur Workspace-Mitgliedern Inserts; die aktuelle Runtime nutzt zusätzlich serverseitig die Service Role für Logging.

Production-Readiness:

- Vor dem Produktiv-Rollout muss in Supabase Production geprüft werden, dass die Migration angewendet ist, z. B. über `supabase_migrations.schema_migrations` oder die Supabase CLI gegen das Production-Projekt.
- Admin-Aggregation `/admin/ai-usage` setzt `SUPABASE_SERVICE_ROLE_KEY` serverseitig voraus.

### PR #445: Referral-Admin-Grundlage

Datei: `supabase/migrations/20260706143000_referral_program_admin_foundation.sql`

Geprüft:

- `public.referral_program_state` wird als Singleton-Grundlage mit `open/closing/closed/reopened` und Cap `2000` angelegt.
- `public.referral_program_members` enthält Referral-Code, Eligibility/Status und Admin-Override-Felder.
- `public.referrals` enthält Referrer-/Referred-Workspace-Bezüge, Status, Programmphase und Billing-Snapshot.
- `public.referral_discount_snapshots` enthält vorbereitete Rabatt-Snapshots, aber keine aktive Billing-Verrechnung.
- RLS wird für alle vier Referral-Tabellen aktiviert.
- Es gibt bewusst keine öffentlichen `authenticated` Policies; die Admin-Seite nutzt serverseitige Service-Role-Abfragen nach `requirePlatformAdmin()`.

Production-Readiness:

- Vor dem Produktiv-Rollout muss in Supabase Production geprüft werden, dass die Migration angewendet ist.
- Referral bleibt admin-only und ist keine öffentliche Rabatt-/Billing-Automation.

## Production-ENV-Readiness

Aus dem Repository geprüft:

- `.env.example` enthält nur Platzhalter und keine echten Secrets.
- `FANMIND_ENABLE_TELEGRAM_SEND=false` ist dokumentiert und bleibt Standard.
- `FANMIND_ADMIN_EMAILS` ist als server-only Liste dokumentiert.
- `src/lib/admin.ts` nutzt ausschließlich `FANMIND_ADMIN_EMAILS`; es gibt keinen hardcodierten echten Admin-Fallback.
- `src/lib/aiUsage.ts` erwartet:
  - `FANMIND_AI_MODEL`
  - `FANMIND_AI_PRICE_INPUT_PER_MILLION_CENTS`
  - `FANMIND_AI_PRICE_OUTPUT_PER_MILLION_CENTS`
  - optional `FANMIND_AI_PRICE_<NORMALIZED_MODEL>_INPUT_PER_MILLION_CENTS`
  - optional `FANMIND_AI_PRICE_<NORMALIZED_MODEL>_OUTPUT_PER_MILLION_CENTS`
  - `FANMIND_AI_USAGE_CURRENCY`

Nicht aus dieser Umgebung verifizierbar:

- Der echte Inhalt von `/var/www/fanmind/.env.production` auf `fanmind-prod-01`.
- Ob `FANMIND_ENABLE_TELEGRAM_SEND=false`, `FANMIND_ADMIN_EMAILS`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` und die KI-Preisvariablen dort gesetzt sind.
- Direkter SSH-Check schlug fehl, weil `fanmind-prod-01` aus dieser Umgebung nicht auflösbar war: `ssh: Could not resolve hostname fanmind-prod-01: Temporary failure in name resolution`.

Empfohlene Production-Prüfung auf dem Server, ohne Werte auszugeben:

```bash
cd /var/www/fanmind
for key in FANMIND_ENABLE_TELEGRAM_SEND FANMIND_ADMIN_EMAILS FANMIND_AI_MODEL FANMIND_AI_PRICE_INPUT_PER_MILLION_CENTS FANMIND_AI_PRICE_OUTPUT_PER_MILLION_CENTS FANMIND_AI_USAGE_CURRENCY SUPABASE_SERVICE_ROLE_KEY OPENAI_API_KEY; do
  if grep -q "^${key}=" .env.production; then echo "${key}=SET"; else echo "${key}=MISSING"; fi
done
```

## Routen- und Demo-Check

Angefragte Routen:

- `/login`
- `/dashboard`
- `/fans`
- `/fans/import`
- `/admin/ai-usage`
- `/admin/referrals`

Gerhard-Demo-Pfad:

1. Landingpage
2. Login oder Demo starten
3. Dashboard
4. Fans/Kontakte
5. CSV-Import oder Sandra/demo-Kontakt
6. Kontaktdetail
7. letzter inbound Nachrichtenkontext
8. KI-Antwortvorschläge
9. Antwort kopieren
10. Memory speichern
11. Follow-up speichern
12. Follow-up-Liste/Roadmap

Aus dieser Umgebung ausgeführter Production-Smoke-Versuch:

```bash
curl -k -L -sS -o /tmp/fanmind_page.html -w 'HTTP:%{http_code} URL:%{url_effective} TIME:%{time_total}\n' https://fanmind.ch/login
```

Ergebnis: `curl: (56) CONNECT tunnel failed, response 403`. Derselbe Netzwerk-/Proxy-Blocker trat für die angefragten Production-Routen auf. Der Live-Demo-Pfad konnte deshalb nicht belastbar gegen Production durchgeklickt werden.

Lokaler Smoke-Test nach `npm run build` und `npm run start`:

- `/login` liefert `HTTP 200`.
- `/dashboard`, `/fans`, `/fans/import`, `/admin/ai-usage` und `/admin/referrals` leiten ohne Session erwartungsgemäß nach `/login` weiter und liefern dort `HTTP 200`.
- `POST /api/demo/start` liefert ohne lokale Supabase-/Demo-ENV erwartungsgemäß `HTTP 500` mit `Demo-Start ist serverseitig noch nicht konfiguriert.` Das ist in dieser lokalen Umgebung ein ENV-Limit, kein Code-Fix für Issue #446.

## Offene Production-Checks

- Supabase Production: Migrationen `20260706120000_ai_usage_events.sql` und `20260706143000_referral_program_admin_foundation.sql` als angewendet bestätigen.
- Supabase Production: RLS für alle fünf Tabellen bestätigen.
- Production Server: `.env.production` auf die oben genannten Schlüssel prüfen, ohne Werte zu loggen.
- Production Browser/Server-Netz: Routen und Gerhard-Demo-Pfad mit Demo-Workspace und Admin-Account testen.
