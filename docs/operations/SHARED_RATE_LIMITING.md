# FanMind Shared Rate Limiting

## Zweck

KI-Antwortvorschläge, Kommunikationsanalysen und öffentliche Anfragen dürfen
nicht auf prozesslokale JavaScript-Maps angewiesen sein. FanMind verwendet
deshalb einen atomaren PostgreSQL-Fixed-Window-Zähler in Supabase.

Der öffentliche Demo-Start bleibt unverändert auf seiner bereits vorhandenen eigenen Supabase-RPC-Policy. Er wird nicht doppelt neu gebaut.

## Datenschutz- und Sicherheitsmodell

In `public.shared_rate_limit_buckets` werden ausschließlich gespeichert:

- ein technischer Scope wie `ai_reply_user_ip`,
  `ai_analysis_workspace_user` oder `inquiry_ip`;
- ein 64-stelliger HMAC-SHA256-Hash;
- Fensterbeginn und Fensterlänge;
- Zähler, Reset- und Ablaufzeit.

Nicht gespeichert werden:

- rohe IP-Adressen;
- E-Mail-Adressen;
- Kontaktinhalte;
- Supabase-User-IDs im Klartext;
- API-Schlüssel oder sonstige Secrets.

Der Hash wird serverseitig mit `FANMIND_SHARED_RATE_LIMIT_SECRET` und einer Scope-Bindung erzeugt:

```text
fanmind-shared-rate-limit:v1:<scope>:<subject>
```

Der Secret-Wert muss mindestens 32 Zeichen lang sein und darf niemals im Browser, in Git, in Issues oder in Logs erscheinen.

## Atomare Datenbank-Policy

Migration:

```text
supabase/migrations/20260723102000_shared_rate_limits.sql
```

`public.consume_shared_rate_limit(...)`:

- richtet das Fenster serverseitig an der Unix-Epoche aus;
- validiert Scope, 64-stelligen Hash, Fenster und Maximum;
- inkrementiert den aktuellen Bucket mit einem einzigen `INSERT ... ON CONFLICT DO UPDATE`;
- serialisiert konkurrierende Inkremente über den eindeutigen Primärschlüssel;
- gibt `allowed`, `remaining`, `reset_at` und `current_count` zurück;
- entfernt pro Aufruf höchstens 100 abgelaufene Buckets;
- ist ausschließlich für `service_role` ausführbar.

`public.cleanup_shared_rate_limit_buckets(...)` entfernt bei Bedarf einen begrenzten größeren Satz abgelaufener Buckets. Auch diese Funktion ist ausschließlich für `service_role` freigegeben.

RLS ist auf der Tabelle aktiv. `PUBLIC`, `anon` und `authenticated` besitzen weder Tabellenrechte noch Ausführungsrechte auf den beiden Funktionen.

## Phase A — produktiv abgeschlossen

Foundation-PR: `#667`  
Foundation-Commit: `cff00dcd80995794fe87895706c9fbec992687ea`  
Migrations-/Verifikationslauf: `30000453708`

Vor der Migration wurde ein neues verschlüsseltes Datenbank-Backup erstellt. Das vollständige `.age`-/`.age.sha256`-Paar wurde checksum-only verifiziert. Anschließend wurden Migration und Rechte geprüft.

Der reale Production-Paralleltest bestätigte:

- 25 konkurrierende RPC-Aufrufe;
- exakt 10 erlaubte Aufrufe bei `max_requests=10`;
- höchster Zähler 25;
- 25 unterschiedliche fortlaufende Zählerstände;
- keine verlorenen Inkremente;
- anonymer RPC-Zugriff abgelehnt;
- alle synthetischen Probezeilen anschließend entfernt;
- dedizierter serverseitiger HMAC-Secret ohne Ausgabe erzeugt;
- Anwendung nach der Migration weiterhin gesund.

## Phase B — Endpunktvertrag

### KI-Antwortvorschläge

- Scope: `ai_reply_user_ip`;
- Identität: serverseitig gebundene Kombination aus autorisierter User-ID und kanonischer Client-IP;
- Maximum: 20 Anfragen;
- Fenster: 10 Minuten;
- bei Überschreitung: HTTP 429 mit verständlicher Meldung;
- bei fehlender Konfiguration, nicht erreichbarem RPC oder ungültiger Antwort: generische HTTP-503-Antwort;
- bei Infrastrukturfehler wird keine OpenAI-Anfrage ausgeführt;
- bestehende Workspace-/Kontakt-Autorisierung und AI-Usage-Messung bleiben erhalten.

### Kommunikationsanalyse

- Scope: `ai_analysis_workspace_user`;
- Identität: serverseitig gebundene Kombination aus autorisierter Workspace-
  und User-ID;
- Maximum: 10 Analysen;
- Fenster: 10 Minuten;
- bei Überschreitung: verständliche generische Meldung im Server-Action-State;
- bei fehlender Konfiguration, nicht erreichbarem RPC oder ungültiger Antwort:
  generische Fehlermeldung;
- bei Infrastrukturfehler werden weder Nachrichten-/Kontaktwissen-Kontext
  geladen noch eine OpenAI-Anfrage ausgeführt;
- der bekannte Vertragsende-Zustand wird als Lifecycle-Verhalten vor dem
  Limiter geprüft; er ist keine vollständige Billing-Autorisierung.

### Öffentliche Anfrage

- Scope: `inquiry_ip`;
- Identität: kanonische Client-IP;
- Maximum: 5 Anfragen;
- Fenster: 10 Minuten;
- Honeypot-Antwort bleibt vor dem Limiter, damit Bots keine Seiteneffekte auslösen;
- bei Überschreitung: HTTP 429 `RATE_LIMITED`;
- bei Shared-Limit-Ausfall: HTTP 503 `SERVICE_UNAVAILABLE`;
- bei Infrastrukturfehler wird weder eine Anfrage gespeichert noch eine E-Mail gesendet.

### Gemeinsame Regeln

- `src/lib/rateLimit.ts` enthält nur noch die kanonische Client-IP-Auflösung und keinerlei Bucket-Map;
- alle drei Endpunkte beziehungsweise Server-Actions verwenden
  `await consumeSharedRateLimit(...)`;
- `shared_rate_limit_config` ist eine blockierende öffentliche Health-Komponente;
- die Health-Prüfung validiert den serverseitigen Secret mit mindestens 32 Zeichen, gibt ihn aber nie aus;
- Public-Demo-Limits bleiben getrennt und unverändert;
- PM2-Cluster-/Mehrinstanzbetrieb darf erst nach erfolgreicher Production-Abnahme dieser Phase aktiviert werden.

## Production-Abnahme für Phase B

Die Abnahme muss mindestens nachweisen:

1. `/api/version`, Server-HEAD und `origin/main` entsprechen exakt dem Merge-Commit.
2. `/api/health` enthält `shared_rate_limit_config=healthy`; alle Pflichtkomponenten sind gesund.
3. Deployed Source enthält keine Nutzung des alten `checkRateLimit` und keine prozesslokale Bucket-Map.
4. Ein synthetischer direkter Shared-Limit-Aufruf funktioniert und hinterlässt keine Probezeile.
5. Der echte Inquiry-Endpunkt liefert innerhalb eines frischen Testfensters fünfmal den erwarteten Validierungsstatus und beim sechsten Aufruf HTTP 429.
6. Die verwendeten ungültigen synthetischen Daten erzeugen keinen Inquiry-Datensatz und keine Benachrichtigungs-E-Mail.
7. Landingpage, Login, Registrierung, Version und Health bleiben erreichbar.
8. Es werden keine rohe IP-Adresse, keine HMAC-Werte, keine User-ID und keine Secrets in Artefakten oder Issues ausgegeben.

## Migration anwenden

Die Migration ist bereits angewendet. Der folgende Ablauf bleibt als Wiederholungs- und Recovery-Referenz dokumentiert. Er darf nur nach einem frischen verifizierten Datenbank-Backup und ohne Ausgabe der DB-Konfiguration verwendet werden:

```bash
set -a
. /etc/fanmind-backup/worker.env
set +a
export PGPASSFILE="$FANMIND_BACKUP_PGPASSFILE"

psql \
  --host="$FANMIND_BACKUP_DB_HOST" \
  --port="${FANMIND_BACKUP_DB_PORT:-5432}" \
  --username="$FANMIND_BACKUP_DB_USER" \
  --dbname="$FANMIND_BACKUP_DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260723102000_shared_rate_limits.sql
```

Kein `set -x`. Keine ENV-Werte oder Verbindungsparameter in CI-/Issue-Ausgaben übernehmen.

## Rollback

Bei einem Anwendungsausfall nach Endpunkt-Aktivierung:

1. Route-PR auf den vorherigen Release zurückrollen.
2. Health und Kernrouten prüfen.
3. Datenbank-Grundlage bestehen lassen; sie ist additiv und enthält nur pseudonymisierte kurzlebige Buckets.
4. Die neue Tabelle nicht während aktiver Shared-Limit-Nutzung entfernen.
5. Erst nach Ursachenanalyse erneut aktivieren.

Ein vollständiges Datenbank-Rollback wäre nur nach gesonderter Prüfung zulässig. Die additive Migration wird nicht allein wegen eines Route-Rollbacks rückgängig gemacht.

## Bewusste Grenzen

- kein Redis-Zwang für den aktuellen Stand;
- keine Änderung an Preisen, KI-Modellen, Kontingenten oder Workspace-Autorisierung;
- kein Umbau des Public-Demo-RPC;
- keine Rohidentitäten in Tabellen oder Logs;
- keine automatische Datenbankmigration allein durch Merge oder Deployment.
