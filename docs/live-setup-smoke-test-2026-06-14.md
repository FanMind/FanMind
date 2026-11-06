# FanMind Live-Setup Smoke-Test — Conversations, Social Connections, Facebook

Datum: 2026-06-14  
Repository-Pfad: `/workspace/FanMind`  
Ziel-Repository: `Bernds-tech/FanMind`

## Ergebnis-Status

Der Live-Setup-Smoke-Test konnte aus dieser Arbeitsumgebung **nicht vollständig ausgeführt** werden, weil keine Git-Remote-Konfiguration, kein Supabase-CLI und kein Zugriff auf den Produktionsserver `/srv/www/fanmind` bzw. auf produktive Secrets vorhanden waren.

Wichtig: Es wurde **kein Feature-Code gebaut**, **keine neue Migration erstellt**, **keine bestehende Tabelle gelöscht** und **kein produktiver Datenbank-Push behauptet**.

## Schritt 1 — Repository / Main prüfen

### Lokaler Repository-Zustand

- Aktueller Arbeitsbranch: `work`
- Aktueller Commit: `dcd1b11 Merge pull request #194 from Bernds-tech/codex/implement-message-retention-for-conversations`
- `git fetch origin main` konnte nicht ausgeführt werden, weil in dieser Arbeitskopie kein `origin`-Remote konfiguriert ist.

Fehlermeldung:

```text
fatal: 'origin' does not appear to be a git repository
fatal: Could not read from remote repository.
```

### Migrationsdateien

Alle drei geforderten Migrationen sind lokal vorhanden:

- `supabase/migrations/20260613120000_create_conversations_messages.sql`
- `supabase/migrations/20260614090000_create_social_connections.sql`
- `supabase/migrations/20260614120000_conversation_message_retention.sql`

## Schritt 2 — Migrationen live anwenden

Nicht ausgeführt.

Grund:

- `supabase` CLI ist in dieser Umgebung nicht verfügbar.
- Es liegen keine Zugangsdaten bzw. keine sichere, bestätigte Verbindung zum FanMind-Supabase-Projekt vor.
- Der Fallback über den Supabase SQL Editor kann aus dieser Umgebung nicht vorgenommen werden.

Deshalb wurde **keine erfolgreiche Live-Migration behauptet**.

## Schritt 3 — Datenbank prüfen

Nicht live geprüft.

Lokal aus den Migrationsdateien verifiziert:

- `public.conversations` wird per Migration angelegt.
- `public.conversation_messages` wird per Migration angelegt.
- `public.social_connections` wird per Migration angelegt.
- RLS wird auf `public.conversations`, `public.conversation_messages` und `public.social_connections` aktiviert.
- `trim_conversation_messages_to_latest_50()` ist in der Retention-Migration definiert.
- `conversation_messages_trim_to_latest_50` ist in der Retention-Migration als Trigger definiert.

Nicht live verifiziert:

- Ob die Tabellen im FanMind-Produktivprojekt bereits existieren.
- Ob RLS im FanMind-Produktivprojekt aktiv ist.
- Ob Trigger/Funktionen im FanMind-Produktivprojekt aktiv sind.
- Ob die Retention im Produktivprojekt tatsächlich maximal die letzten 50 Messages pro `conversation_id` behält.

## Schritt 4 — Server `.env.local` aktualisieren

Nicht ausgeführt.

Grund:

- Kein SSH-/Serverzugriff auf `/srv/www/fanmind` aus dieser Umgebung.
- Keine produktiven Meta-/Facebook-Secrets vorhanden.

Nicht geprüft bzw. nicht geändert:

- `META_WEBHOOK_VERIFY_TOKEN`
- `META_WEBHOOK_APP_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI=https://fanmind.ch/api/integrations/facebook/callback`
- `FANMIND_TOKEN_ENCRYPTION_KEY`
- `fanmind.service` Restart/Status

Es wurden **keine Secrets in das Repository geschrieben**.

## Schritt 5 — Build/Deploy Status prüfen

Nicht live geprüft.

Grund:

- Kein GitHub-Remote/API-Kontext und keine GitHub-Actions-Zugangsdaten in dieser Umgebung.
- Kein Serverzugriff für `systemctl status fanmind.service` oder `journalctl -u fanmind.service`.

## Schritt 6 — FanMind Live Smoke-Test: Conversations

Nicht live ausgeführt.

Nicht verifiziert:

- Speichern der Eingangsnachricht bei `https://fanmind.ch/fans/63463372-b5a7-4441-a4a9-26ad4e41a2a8`
- Anzeige der Nachricht im Verlauf
- Anlage/Aktualisierung einer Conversation
- Anzeige in `https://fanmind.ch/inbox`
- Speichern eines Antwortentwurfs als nicht gesendet
- Statuswechsel `Wartet`, `Erledigt`, `Offen`
- Sicherstellung über Live-Test, dass nichts extern gesendet wurde

## Schritt 7 — Facebook Channel Test

Nicht live ausgeführt.

Nicht verifiziert:

- Anzeige der Facebook-Karte in `/channels`
- Start von `Facebook verbinden`
- OAuth-Rückleitung zu `/api/integrations/facebook/callback`
- Speicherung in `public.social_connections`
- Sichtbarer Page-Name
- Verschlüsselte Speicherung des Page Tokens
- Abwesenheit von Tokens im Browser

## Schritt 8 — Meta Webhook Test

Nicht live ausgeführt.

Nicht verifiziert:

- Meta Webhook Verify für `https://fanmind.ch/api/webhooks/meta`
- Verarbeitung eines Testevents oder einer echten Page-/Messenger-Testnachricht
- Mapping des Events auf eine Workspace-Verbindung
- Speicherung einer inbound message
- Anzeige in `/inbox` und `/fans/[id]`
- Sicherstellung über Live-Test, dass nichts automatisch gesendet wurde

## Abschlussbericht nach geforderter Struktur

### Migration

- CLI oder SQL Editor verwendet: **Nein — nicht ausgeführt**
- `conversations` existiert live: **Nicht geprüft**
- `conversation_messages` existiert live: **Nicht geprüft**
- `social_connections` existiert live: **Nicht geprüft**
- RLS aktiv live: **Nicht geprüft**
- Retention-Trigger aktiv live: **Nicht geprüft**

### Server

- `.env.local` aktualisiert: **Nein — kein Serverzugriff**
- `FANMIND_TOKEN_ENCRYPTION_KEY` gesetzt: **Nicht geprüft**
- `fanmind.service` läuft: **Nicht geprüft**

### Conversation-Test

- Eingangsnachricht gespeichert: **Nicht getestet**
- `/inbox` zeigt Conversation: **Nicht getestet**
- Antwortentwurf als nicht gesendet gespeichert: **Nicht getestet**
- Status `Wartet`/`Erledigt`/`Offen` funktioniert: **Nicht getestet**

### Facebook-Test

- Facebook verbinden gestartet: **Nicht getestet**
- `social_connections` Eintrag erstellt: **Nicht getestet**
- Page-Name sichtbar: **Nicht getestet**
- Token verschlüsselt gespeichert: **Nicht getestet**
- Webhook Verify funktioniert: **Nicht getestet**
- Testevent in `/inbox` sichtbar: **Nicht getestet**

## Offene Fehler / Blocker

1. In der Arbeitskopie ist kein Git-Remote konfiguriert; `origin/main` kann daher nicht aktualisiert oder geprüft werden.
2. Supabase CLI ist nicht installiert/verfügbar; `supabase login`, `supabase link` und `supabase db push` konnten nicht ausgeführt werden.
3. Es gibt keinen Zugriff auf das FanMind-Supabase-Produktivprojekt oder den Supabase SQL Editor.
4. Es gibt keinen SSH-Zugriff auf den FanMind-Server `/srv/www/fanmind`.
5. Es gibt keine produktiven Meta-/Facebook-Secrets in dieser Umgebung.
6. GitHub Actions Deploy-Status konnte ohne GitHub-Remote/API-Zugriff nicht geprüft werden.

## Nächster empfohlener Schritt

Eine berechtigte Person mit eindeutig bestätigtem Zugriff auf **Bernds-tech/FanMind**, das **FanMind-Supabase-Projekt** und den **FanMind-Server** sollte die Live-Schritte ausführen. Danach sollte dieser Bericht mit den echten Live-Ergebnissen aktualisiert werden.
