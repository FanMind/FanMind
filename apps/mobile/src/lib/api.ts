import { getMobileEnvironment } from "@/lib/env";
import type { Contact, FanAnalysisResponse, ReplySuggestions } from "@/types";

const environment = getMobileEnvironment();

export async function requestReplySuggestions(input: {
  accessToken: string;
  contact: Contact;
  incomingMessage: string;
  responseMode?: string;
  responseInstruction?: string;
}): Promise<{ data: ReplySuggestions | null; error: string | null }> {
  const incomingMessage = input.incomingMessage.trim();
  if (!incomingMessage) {
    return { data: null, error: "Bitte füge zuerst eine eingehende Nachricht ein." };
  }

  let response: Response;
  try {
    response = await fetch(`${environment.apiUrl}/api/ai/reply-suggestions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-FanMind-Client": "mobile",
      },
      body: JSON.stringify({
        contactId: input.contact.id,
        incomingMessage: incomingMessage.slice(0, 4000),
        responseMode: input.responseMode ?? "Freundlich",
        responseInstruction: input.responseInstruction?.trim().slice(0, 1000) ?? "",
      }),
    });
  } catch {
    return {
      data: null,
      error: "FanMind ist gerade nicht erreichbar. Bitte prüfe deine Verbindung.",
    };
  }

  const payload = (await response.json().catch(() => null)) as
    | ReplySuggestions
    | { error?: string }
    | null;
  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    return {
      data: null,
      error: error || "Antwortvorschläge konnten gerade nicht erzeugt werden.",
    };
  }
  if (!payload || !("reply_options" in payload)) {
    return { data: null, error: "FanMind hat ein unerwartetes Antwortformat geliefert." };
  }
  return { data: payload, error: null };
}

export async function requestFanAnalysis(input: {
  accessToken: string;
  contactId: string;
  analysisMode: "short" | "standard" | "detailed";
  analysisInstruction?: string;
}): Promise<{ data: FanAnalysisResponse | null; error: string | null }> {
  let response: Response;
  try {
    response = await fetch(`${environment.apiUrl}/api/ai/fan-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-FanMind-Client": "mobile",
      },
      body: JSON.stringify({
        contactId: input.contactId,
        analysisMode: input.analysisMode,
        analysisInstruction: input.analysisInstruction?.trim().slice(0, 500) ?? "",
      }),
    });
  } catch {
    return {
      data: null,
      error: "FanMind ist gerade nicht erreichbar. Bitte prüfe deine Verbindung.",
    };
  }

  const payload = (await response.json().catch(() => null)) as
    | FanAnalysisResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    return {
      data: null,
      error: error || "Fan-Analyse konnte gerade nicht erstellt werden.",
    };
  }
  if (!payload || !("ok" in payload) || !payload.ok) {
    return { data: null, error: "FanMind hat ein unerwartetes Analyseformat geliefert." };
  }
  return { data: payload, error: null };
}
