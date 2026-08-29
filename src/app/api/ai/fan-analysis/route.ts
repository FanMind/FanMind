import { NextRequest, NextResponse } from "next/server";

import {
  analyzeFanCommunication,
  type FanAnalysisActionState,
  type FanAnalysisFailureReason,
} from "@/app/fans/[id]/analysisActions";
import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import {
  BearerAccessTokenError,
  getOptionalBearerAccessToken,
} from "@/lib/requestAccessToken";
import {
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorization";

const MAX_FAN_ANALYSIS_BODY_BYTES = 16_000;
const MAX_INSTRUCTION_LENGTH = 500;

type FanAnalysisRequest = {
  contactId?: unknown;
  analysisMode?: unknown;
  analysisInstruction?: unknown;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMode(value: unknown): "short" | "standard" | "detailed" {
  return value === "standard" || value === "detailed" ? value : "short";
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function failureStatus(reason: FanAnalysisFailureReason | undefined): number {
  if (reason === "forbidden" || reason === "capability_disabled") return 403;
  if (reason === "rate_limited") return 429;
  if (reason === "service_unavailable") return 503;
  if (reason === "unprocessable_context") return 422;
  return 400;
}

export async function POST(request: NextRequest) {
  let accessToken: string | undefined;
  try {
    accessToken = getOptionalBearerAccessToken(request);
  } catch (error) {
    if (error instanceof BearerAccessTokenError) {
      return jsonError("Bitte melde dich in der FanMind-App erneut an.", 401);
    }
    return jsonError("Mobile Sitzung konnte nicht geprüft werden.", 401);
  }
  if (!accessToken) {
    return jsonError("Die Fan-Analyse benötigt eine angemeldete Mobile Sitzung.", 401);
  }

  const parsedBody = await readBoundedJsonRequest(
    request,
    MAX_FAN_ANALYSIS_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return jsonError(
      parsedBody.reason === "payload_too_large"
        ? "Die Analyse-Anfrage ist zu groß."
        : "Ungültiger JSON-Body.",
      parsedBody.reason === "payload_too_large" ? 413 : 400,
    );
  }

  const payload = parsedBody.value as FanAnalysisRequest | null;
  const contactId = normalizeString(payload?.contactId);
  if (!contactId) return jsonError("contactId ist Pflicht.", 400);

  const formData = new FormData();
  formData.set("contact_id", contactId);
  formData.set("locale", "de");
  formData.set("analysis_mode", normalizeMode(payload?.analysisMode));
  formData.set(
    "analysis_instruction",
    normalizeString(payload?.analysisInstruction).slice(0, MAX_INSTRUCTION_LENGTH),
  );

  let state: FanAnalysisActionState;
  try {
    state = await analyzeFanCommunication(
      { ok: false, message: "" },
      formData,
      accessToken,
    );
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      if (error.code === "unauthenticated") {
        return jsonError("Bitte melde dich erneut an.", 401);
      }
      if (
        error.code === "resource_forbidden" ||
        error.code === "workspace_member_mutations_disabled"
      ) {
        return jsonError(
          "Fan-Analyse ist für diesen Workspace-Zugang nicht freigegeben.",
          403,
        );
      }
    }
    return jsonError("Kontakt konnte nicht autorisiert geladen werden.", 404);
  }

  if (!state.ok) return jsonError(state.message, failureStatus(state.failure_reason));
  return NextResponse.json(state);
}
