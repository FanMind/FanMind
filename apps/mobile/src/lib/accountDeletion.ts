import { getMobileEnvironment } from "@/lib/env";

const environment = getMobileEnvironment();

export type AccountDeletionRequestStatus = {
  id?: string;
  status: string;
  requestedAt?: string;
  processingDeadlineAt?: string;
  requiresOwnershipTransfer?: boolean;
  requiresSubscriptionResolution?: boolean;
  cancellable: boolean;
};

type AccountDeletionPayload = {
  ok?: boolean;
  request?: AccountDeletionRequestStatus;
  message?: string;
  error?: string;
};

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-FanMind-Client": "mobile",
  };
}

async function parsePayload(response: Response): Promise<AccountDeletionPayload | null> {
  return (await response.json().catch(() => null)) as AccountDeletionPayload | null;
}

function connectionError() {
  return "FanMind ist gerade nicht erreichbar. Bitte prüfe deine Verbindung.";
}

export async function getAccountDeletionStatus(accessToken: string): Promise<{
  request: AccountDeletionRequestStatus | null;
  error: string | null;
}> {
  let response: Response;
  try {
    response = await fetch(`${environment.apiUrl}/api/account-deletion`, {
      method: "GET",
      headers: headers(accessToken),
    });
  } catch {
    return { request: null, error: connectionError() };
  }
  const payload = await parsePayload(response);
  if (!response.ok || !payload?.request) {
    return {
      request: null,
      error: payload?.error ?? "Der Löschstatus konnte nicht geladen werden.",
    };
  }
  return { request: payload.request, error: null };
}

export async function requestAccountDeletion(input: {
  accessToken: string;
  emailConfirmation: string;
  confirmation: string;
}): Promise<{
  request: AccountDeletionRequestStatus | null;
  message: string | null;
  error: string | null;
}> {
  let response: Response;
  try {
    response = await fetch(`${environment.apiUrl}/api/account-deletion`, {
      method: "POST",
      headers: headers(input.accessToken),
      body: JSON.stringify({
        emailConfirmation: input.emailConfirmation,
        confirmation: input.confirmation,
      }),
    });
  } catch {
    return { request: null, message: null, error: connectionError() };
  }
  const payload = await parsePayload(response);
  if (!response.ok || !payload?.request) {
    return {
      request: null,
      message: null,
      error: payload?.error ?? "Die Löschanfrage konnte nicht aufgenommen werden.",
    };
  }
  return {
    request: payload.request,
    message: payload.message ?? "Die Löschanfrage wurde aufgenommen.",
    error: null,
  };
}

export async function cancelAccountDeletion(input: {
  accessToken: string;
  requestId: string;
  confirmation: string;
}): Promise<{ message: string | null; error: string | null }> {
  let response: Response;
  try {
    response = await fetch(`${environment.apiUrl}/api/account-deletion`, {
      method: "DELETE",
      headers: headers(input.accessToken),
      body: JSON.stringify({
        requestId: input.requestId,
        confirmation: input.confirmation,
      }),
    });
  } catch {
    return { message: null, error: connectionError() };
  }
  const payload = await parsePayload(response);
  if (!response.ok) {
    return {
      message: null,
      error: payload?.error ?? "Die Löschanfrage konnte nicht widerrufen werden.",
    };
  }
  return {
    message: payload?.message ?? "Die Löschanfrage wurde widerrufen.",
    error: null,
  };
}
