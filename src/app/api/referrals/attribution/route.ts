import { NextResponse } from "next/server";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { createReferralAttribution } from "@/lib/referrals";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";

const MAX_REFERRAL_ATTRIBUTION_BODY_BYTES = 2_000;

type ReferralAttributionRequest = {
  referralCode?: string;
};

export async function POST(request: Request) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json(
      { error: "Die Empfehlungsanfrage konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }

  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const parsedBody = await readBoundedJsonRequest(
    request,
    MAX_REFERRAL_ATTRIBUTION_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        error: parsedBody.reason === "payload_too_large"
          ? "Die Empfehlungsanfrage ist zu groß."
          : "Die Empfehlungsanfrage ist ungültig.",
        code: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request",
      },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const body = parsedBody.value as ReferralAttributionRequest | null;
  const referralCode = String(body?.referralCode ?? "").trim();
  if (!referralCode) return NextResponse.json({ ok: true });

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace) return NextResponse.json({ error: "Workspace nicht gefunden." }, { status: 404 });

  const result = await createReferralAttribution({
    referralCode,
    referredWorkspaceId: workspaceResult.workspace.id,
    referredUserId: data.user.id,
  });

  if (result.error) {
    return NextResponse.json(
      { error: "Die Empfehlung konnte gerade nicht gespeichert werden.", code: "referral_attribution_failed" },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
