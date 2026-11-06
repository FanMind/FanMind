export const TELEGRAM_BOT_USERNAME = "@FanMindBot";
export const TELEGRAM_EXPECTED_WEBHOOK_URL =
  "https://fanmind.ch/api/integrations/telegram/webhook";

export type TelegramWebhookStatus = {
  configured: boolean;
  botTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  checked: boolean;
  webhookUrlMatches: boolean;
  webhookUrl: string | null;
  pendingUpdateCount: number | null;
  lastErrorMessage: string | null;
  error: string | null;
  checkedAt: string | null;
};

type TelegramGetWebhookInfoResponse = {
  ok?: boolean;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
  description?: string;
};

export async function getTelegramWebhookStatus(): Promise<TelegramWebhookStatus> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const configured = Boolean(botToken && webhookSecret);

  const baseStatus: TelegramWebhookStatus = {
    configured,
    botTokenConfigured: Boolean(botToken),
    webhookSecretConfigured: Boolean(webhookSecret),
    checked: false,
    webhookUrlMatches: false,
    webhookUrl: null,
    pendingUpdateCount: null,
    lastErrorMessage: null,
    error: null,
    checkedAt: null,
  };

  if (!botToken) {
    return baseStatus;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as TelegramGetWebhookInfoResponse;

    if (!response.ok || !payload.ok || !payload.result) {
      return {
        ...baseStatus,
        checked: true,
        checkedAt: new Date().toISOString(),
        error:
          payload.description ??
          `Telegram getWebhookInfo fehlgeschlagen (${response.status}).`,
      };
    }

    const webhookUrl = payload.result.url?.trim() || null;

    return {
      ...baseStatus,
      checked: true,
      checkedAt: new Date().toISOString(),
      webhookUrlMatches: webhookUrl === TELEGRAM_EXPECTED_WEBHOOK_URL,
      webhookUrl,
      pendingUpdateCount: payload.result.pending_update_count ?? null,
      lastErrorMessage: payload.result.last_error_message ?? null,
    };
  } catch (error) {
    return {
      ...baseStatus,
      checked: true,
      checkedAt: new Date().toISOString(),
      error:
        error instanceof Error
          ? error.message
          : "Telegram getWebhookInfo konnte nicht geprüft werden.",
    };
  }
}
