# Public Demo Protection – Production Runbook

Stand: 2026-07-26

## Ziel

Der öffentliche temporäre Demo-Start darf erst aktiviert werden, wenn Rate-Limit, Reservierung, automatische Löschung und Production-Konfiguration gemeinsam geprüft sind.

## Sicherheitszustand vor Freigabe

```env
FANMIND_PUBLIC_DEMO_ENABLED=false
```

Dieser Wert bleibt bis zum letzten Schritt unverändert. Der kontrollierte Sandra-Demo-Zugang bleibt davon getrennt.

## 1. Migration anwenden

In Supabase Production im SQL Editor den vollständigen Inhalt dieser Datei ausführen:

```text
supabase/migrations/20260713180000_public_demo_abuse_protection.sql
```

Der aktuelle Cleanup-Vertrag wird zusätzlich mit dem additiven Expand-Schritt
A aus `docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md` aktualisiert:

```text
supabase/migrations/20260726120000_workspace_provisioning_rpc.sql
```

Diese zweite Datei macht vor Aktivierung gespeicherte Auth-Ressourcen,
reservierte sowie fehlgeschlagene Rollbacks und mehr als 15 Minuten alte
`cleanup_pending`-Leases erneut claimbar. Ihr Backfill normalisiert die
Workspace-Identität für `reserved`, `active`, `expired`, `failed`,
`cleanup_pending` und `cleanup_failed`. Sie muss nach dem kompatiblen
App-Brückenstand und vor der erneuten Freigabe der öffentlichen Demo mit
abgenommen werden. Ressourcenfreie `failed`-Auditzeilen werden nicht erneut
geclaimt.

Danach prüfen:

```sql
select to_regclass('public.demo_start_sessions') as demo_start_sessions;

select proname
from pg_proc
where proname in (
  'claim_public_demo_start',
  'activate_public_demo_start',
  'fail_public_demo_start',
  'claim_expired_demo_cleanup',
  'complete_demo_cleanup'
)
order by proname;

select relrowsecurity
from pg_class
where oid = 'public.demo_start_sessions'::regclass;
```

Erwartung:

- `demo_start_sessions` ist nicht `null`;
- alle fünf Funktionen werden angezeigt;
- `relrowsecurity = true`.

## 2. Production-Secrets setzen

Die Werte direkt auf dem Server erzeugen und in `.env.production` schreiben. Secrets niemals in Chat, Screenshot oder Logs kopieren.

Erforderlich:

```env
FANMIND_PUBLIC_DEMO_ENABLED=false
FANMIND_DEMO_RATE_LIMIT_SECRET=<mindestens 32 zufällige Zeichen>
FANMIND_DEMO_CLEANUP_SECRET=<mindestens 32 zufällige Zeichen>
FANMIND_DEMO_MAX_PER_IP_10_MIN=1
FANMIND_DEMO_MAX_PER_IP_DAY=10
FANMIND_DEMO_MAX_PER_BROWSER_DAY=5
FANMIND_DEMO_MAX_ACTIVE=50
FANMIND_DEMO_MAX_AI_REQUESTS=5
FANMIND_DEMO_MAX_CONTACTS=30
FANMIND_DEMO_CLEANUP_LIMIT=25
```

Die kontrollierten Tageslimits erlauben legitime Neustarts nach einer abgelaufenen Demo oder während eines internen Smoke-Tests. Der Abuse-Schutz bleibt erhalten: höchstens ein neuer Start je IP innerhalb von zehn Minuten, getrennte Browser- und IP-Tageslimits, globales Aktiv-Limit, HMAC-Pseudonymisierung und automatisches Cleanup.

Turnstile ist zusätzlich zum Datenbank-Rate-Limit vorbereitet. Solange die Schlüssel noch nicht eingerichtet sind, bleibt der verpflichtende Modus aus:

```env
FANMIND_REQUIRE_TURNSTILE_FOR_PUBLIC_DEMO=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Sobald im Cloudflare-Dashboard ein Widget für `fanmind.ch` angelegt wurde:

1. öffentlichen Site Key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` setzen;
2. geheimen Schlüssel ausschließlich serverseitig in `TURNSTILE_SECRET_KEY` setzen;
3. Anwendung neu bauen und PM2 mit aktualisierter Umgebung starten;
4. Widget im Browser lösen und einen erfolgreichen Demo-Start prüfen;
5. abgelaufenen, fehlerhaften und wiederverwendeten Token prüfen;
6. erst danach `FANMIND_REQUIRE_TURNSTILE_FOR_PUBLIC_DEMO=true` setzen.

Bei nur einem gesetzten Schlüssel oder bei `required=true` ohne vollständige Konfiguration blockiert FanMind den öffentlichen Demo-Start. Der Turnstile-Token wird vom Browser an `/api/demo/start` übergeben und dort serverseitig gegen Siteverify, Hostname und Action `fanmind_demo_start` geprüft. Rate-Limit, Kapazitätslimit und Cleanup bleiben unabhängig davon aktiv.

## 3. Deployment und Cleanup-Endpunkt

Nach Merge des Cleanup-PRs und erfolgreichem Deployment:

```bash
curl -fsS https://fanmind.ch/api/version
```

Der geschützte Cleanup-Endpunkt ist ohne Secret nicht zugänglich:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST https://fanmind.ch/api/demo/cleanup \
  -H 'Content-Type: application/json' \
  --data '{"limit":1}'
```

Erwartung: `401`.

Der Cleanup-Worker liest das Secret direkt aus `/var/www/fanmind/.env.production` und gibt es nicht aus. Zulässige Löschfehler stammen aus einer festen Code-Allowlist; unbekannte Antwortcodes werden verworfen. Unlesbare ENV-Dateien, Netzwerkfehler, ungültige Zähler und sonstige unerwartete Exceptions erscheinen im systemd-Journal ausschließlich als feste `FANMIND_DEMO_CLEANUP_*`-Codes, nie mit Pfad, URL, Payload oder rohem Exception-Text.

## 4. Timer bewusst aktivieren

Erst nach Migration und gesetztem Cleanup-Secret:

```bash
sudo systemctl enable --now fanmind-demo-cleanup.timer
sudo systemctl start fanmind-demo-cleanup.service
sudo systemctl status fanmind-demo-cleanup.timer --no-pager
sudo journalctl -u fanmind-demo-cleanup.service -n 50 --no-pager
```

Erwartung bei leerem Bestand:

```text
FanMind demo cleanup: claimed=0 deleted=0 failed=0
```

## 5. Fail-closed-Test

Solange die öffentliche Demo deaktiviert ist:

```bash
curl -sS -i \
  -X POST https://fanmind.ch/api/demo/start \
  -H 'Content-Type: application/json' \
  --data '{"locale":"de"}'
```

Erwartung:

- HTTP `503`;
- Code `public_demo_disabled`;
- kein neuer Auth-User;
- kein neuer Workspace.

## 6. Öffentliche Demo kontrolliert aktivieren

Erst wenn alle vorherigen Prüfungen erfolgreich sind:

```env
FANMIND_PUBLIC_DEMO_ENABLED=true
```

Danach:

```bash
cd /var/www/fanmind
pm2 restart fanmind --update-env
pm2 save
```

Abnahme:

1. Erster Demo-Start erzeugt genau einen temporären User und Workspace.
2. Sofortiger zweiter Start derselben IP erhält `429` und `Retry-After`.
3. Ein bereits eingeloggter temporärer Demo-Nutzer wird wiederverwendet.
4. Nach Ablauf kann derselbe Browser im Rahmen der Tageslimits kontrolliert eine neue Demo starten.
5. Nach Ablauf wird der alte Datensatz vom Timer beansprucht und vollständig gelöscht.
6. `demo_start_sessions` erhält für den alten Lauf den Status `deleted`.
7. Keine Roh-IP-Adresse wird gespeichert.
8. Ein absichtlich vor Aktivierung abgebrochener Start wird nach Ablauf
   vollständig gelöscht.
9. Ein absichtlich veralteter `cleanup_pending`-Lease wird erneut beansprucht;
   ein frischer Lease nicht.

## 7. Not-Aus

Bei Auffälligkeiten sofort:

```env
FANMIND_PUBLIC_DEMO_ENABLED=false
```

und anschließend:

```bash
cd /var/www/fanmind
pm2 restart fanmind --update-env
pm2 save
```

Der Cleanup-Timer bleibt aktiv, damit bereits erzeugte temporäre Demos weiter entfernt werden.
