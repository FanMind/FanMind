import { NextResponse } from "next/server";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { enqueueBackupJob } from "@/lib/backupOperations";

const MAX_BACKUP_JOB_BODY_BYTES = 1_000;

export async function POST(request: Request) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsedBody = await readBoundedJsonRequest(request, MAX_BACKUP_JOB_BODY_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_json" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const body = parsedBody.value as { jobType?: unknown } | null;
  const result = await enqueueBackupJob(request, data.user, body?.jobType);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: "headers" in result ? result.headers : undefined,
  });
}
