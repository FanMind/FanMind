# Telegram Webhook für FanMind

FanMind verarbeitet Telegram in Phase 2 ausschließlich als Eingangskanal. Der Bot sendet keine automatischen Antworten und der Bot-Token bleibt serverseitig.

## Server-Variablen

In der Produktivumgebung müssen die Variablen gesetzt werden:

- `TELEGRAM_BOT_TOKEN` – BotFather-Token für `@FanMindBot`, nur serverseitig.
- `TELEGRAM_WEBHOOK_SECRET` – geheimer Header-Wert für Telegrams `X-Telegram-Bot-Api-Secret-Token`.
- `SUPABASE_SERVICE_ROLE_KEY` – serverseitig für Webhook-Ingestion.
- `FANMIND_DEFAULT_WORKSPACE_ID_FOR_TELEGRAM_TEST` – eindeutiger Workspace, in den der optionale Testbot schreiben darf.

## Webhook setzen

Beispiel ohne echten Token:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://fanmind.ch/api/integrations/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Die Webhook-Route ist:

```text
POST /api/integrations/telegram/webhook
```

Wenn `TELEGRAM_WEBHOOK_SECRET` gesetzt ist, muss Telegram den Header `X-Telegram-Bot-Api-Secret-Token` mitsenden. Ungültige Secrets werden mit `401` abgelehnt.

## Verhalten

- Es werden nur Textnachrichten übernommen.
- Nicht-Text-Updates werden bewusst ignoriert und mit `200 OK` bestätigt.
- FanMind antwortet nicht automatisch an Telegram.
- Aus eingehenden Telegram-Texten werden Kontakte und eingehende Nachrichten nur erstellt, wenn `FANMIND_DEFAULT_WORKSPACE_ID_FOR_TELEGRAM_TEST` serverseitig auf genau einen Workspace zeigt.
- Ohne diese eindeutige Workspace-Zuordnung bestätigt der Webhook das Update, legt aber keine Kontakte oder Nachrichten an.
- Es gibt keinen globalen Fallback auf `social_connections` und kein workspaceübergreifendes Auto-Matching von Telegram-IDs oder Handles.
- Für eine spätere Multi-Tenant-Integration ist ein explizites Mapping vorgesehen, z. B. über `/start <workspace_connection_token>` und danach Telegram-Chat/User → Workspace.
