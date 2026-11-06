import { NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { markAdminNotificationRead } from "@/lib/operations";
import { getSupabaseServerUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };
const MAX_NOTIFICATION_UPDATE_BODY_BYTES = 1_000;

export async function POST(request: Request, context: Context) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  if (!isPlatformAdminEmail(data.user.email)) return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const { id } = await context.params;
  const parsedBody = await readBoundedJsonRequest(
    request,
    MAX_NOTIFICATION_UPDATE_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const payload = parsedBody.value as { acknowledge?: unknown } | null;
  const result = await markAdminNotificationRead(id, data.user.id, payload?.acknowledge === true);
  if (result.error) return NextResponse.json({ error: "notification_update_failed" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
