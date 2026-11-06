import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KNOWN_RUNTIME_ENVIRONMENTS = new Set([
  "production",
  "staging",
  "test",
  "development",
]);

export async function GET() {
  const releaseCommit =
    process.env.FANMIND_RELEASE_COMMIT?.trim().toLowerCase() || "unknown";
  const runtimeCandidate =
    process.env.FANMIND_RUNTIME_ENVIRONMENT?.trim().toLowerCase() || "";
  const runtimeEnvironment = KNOWN_RUNTIME_ENVIRONMENTS.has(runtimeCandidate)
    ? runtimeCandidate
    : "unknown";

  return NextResponse.json(
    {
      application: "fanmind",
      releaseCommit,
      environment: process.env.NODE_ENV || "unknown",
      runtimeEnvironment,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
