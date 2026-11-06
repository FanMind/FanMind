# Monitoring und Healthchecks

## Health-Endpunkt
`GET /api/health` liefert eine datensparsame Antwort mit Gesamtstatus und Komponentenstatus.

Statuswerte:
- `healthy`
- `degraded`
- `unavailable`
- `unknown`

HTTP-Status:
- `200` bei `healthy`
- `207` bei `degraded`
- `503` bei `unavailable`

## Geprüfte Komponenten
- FanMind-Anwendung
- Supabase-Konfiguration
- Supabase-Datenbank
- Supabase Storage
- Stripe-Konfiguration
- OpenAI-Konfiguration
- E-Mail-Konfiguration

## Datenschutz und Secrets
Der öffentliche Scope enthält keine Secrets, Tokens, personenbezogenen Daten, Prompts oder Fan-Nachrichten. Für eingeloggte Platform-Admins werden nur technische Zusatzhinweise wie HTTP-Status oder `service_role_configured=true/false` ergänzt, niemals Schlüsselwerte.

## Bekannte Einschränkungen
- Health-Ergebnisse werden in diesem PR noch nicht automatisch persistiert.
- Backup-Status nutzt echte Tabellenstrukturen, aber noch keine angebundene externe Backup-Automation.
- Externe Alarmierung wird vorbereitet, aber noch nicht erzwungen.
