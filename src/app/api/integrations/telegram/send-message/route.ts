import { sendManualTelegramMessage } from "@/lib/supabase/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isTemporaryDemoUser } from "@/lib/demoMode";
import {
  isTrustedMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import {
  requireContactInActiveAuthorizedWorkspace,
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorization";

const MAX_TELEGRAM_REQUEST_BYTES = 12_000;
const MAX_TELEGRAM_TEXT_CHARACTERS = 4096;

export async function POST(request: Request) {
  if (process.env.FANMIND_ENABLE_TELEGRAM_SEND !== "true") {
    return Response.json(
      {
        error:
          "Telegram-Senden ist in dieser Umgebung deaktiviert und nicht Teil der Standarddemo.",
        code: "telegram_send_disabled",
      },
      { status: 403 },
    );
  }

  if (!isTrustedMutationRequest(request, [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.FANMIND_APP_URL,
  ])) {
    return Response.json(
      { error: "Die Sendeanfrage konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }

  const parsedBody = await readBoundedJsonRequest(
    request,
    MAX_TELEGRAM_REQUEST_BYTES,
  );
  if (!parsedBody.ok) {
    const tooLarge = parsedBody.reason === "payload_too_large";
    return Response.json(
      {
        error: tooLarge
          ? "Der Antwortentwurf ist zu groß."
          : "Die Sendeanfrage ist ungültig.",
        code: tooLarge ? "payload_too_large" : "invalid_request",
      },
      { status: tooLarge ? 413 : 400 },
    );
  }

  const body = parsedBody.value as {
    contactId?: string;
    text?: string;
  } | null;
  const contactId = body?.contactId?.trim();
  const text = body?.text?.trim();
  if (
    !contactId ||
    contactId.length > 128 ||
    !text ||
    text.length > MAX_TELEGRAM_TEXT_CHARACTERS
  ) {
    return Response.json(
      {
        error:
          text && text.length > MAX_TELEGRAM_TEXT_CHARACTERS
            ? "Der Telegram-Entwurf darf höchstens 4.096 Zeichen enthalten."
            : "Kontakt und geprüfter Antworttext sind erforderlich.",
        code:
          text && text.length > MAX_TELEGRAM_TEXT_CHARACTERS
            ? "text_too_long"
            : "invalid_request",
      },
      { status: 400 },
    );
  }

  let authorized;
  try {
    authorized = await requireContactInActiveAuthorizedWorkspace(contactId);
  } catch (error) {
    const status =
      error instanceof WorkspaceAuthorizationError &&
      error.code === "unauthenticated"
        ? 401
        : 403;
    return Response.json(
      {
        error:
          status === 401
            ? "Deine Sitzung ist abgelaufen."
            : "Kein Workspace-Zugriff.",
        code: status === 401 ? "authentication_required" : "workspace_access_denied",
      },
      { status },
    );
  }

  if (
    isTemporaryDemoUser(authorized.user) ||
    !isPlatformAdminEmail(authorized.user.email)
  ) {
    return Response.json(
      {
        error:
          "Telegram-Senden ist nur für ausdrücklich freigegebene Admin-/Pilotprüfungen erlaubt.",
        code: "telegram_pilot_required",
      },
      { status: 403 },
    );
  }

  const result = await sendManualTelegramMessage({
    workspaceId: authorized.workspace.id,
    contactId: authorized.contact.id,
    text,
  });
  if (result.error) {
    const messages = {
      bot_blocked: "Telegram-Versand fehlgeschlagen: Bot wurde blockiert.",
      chat_not_found: "Telegram-Versand fehlgeschlagen: Chat nicht gefunden.",
    } as const;
    const message =
      result.errorCode && result.errorCode in messages
        ? messages[result.errorCode as keyof typeof messages]
        : "Telegram-Nachricht konnte nicht gesendet werden.";
    return Response.json(
      { error: message, code: result.errorCode ?? "telegram_send_failed" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, messageId: result.message?.id ?? null });
}
