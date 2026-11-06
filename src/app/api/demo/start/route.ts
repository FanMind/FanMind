import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import {
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
  getSupabaseAuthUrl,
  getSupabaseHeaders,
} from "@/lib/supabase/config";
import {
  createTemporaryDemoWorkspace,
  deleteExpiredTemporaryDemo,
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import {
  DEMO_BROWSER_COOKIE,
  activatePublicDemoStart,
  claimPublicDemoStart,
  failPublicDemoStart,
  getTrustedClientIp,
  hashDemoIdentifier,
  publicDemoEnabled,
  queuePublicDemoCleanup,
  recordPublicDemoStartResources,
  verifyDemoTurnstile,
} from "@/lib/demoProtection";
import {
  getTemporaryDemoExpiryState,
  isTemporaryDemoUser,
} from "@/lib/demoMode";
import {
  FANMIND_LOCALE_COOKIE,
  localeCookieOptions,
  normalizeWorkspaceLocale,
} from "@/lib/workspaceLocale";

const isProduction = process.env.NODE_ENV === "production";
const DEMO_DURATION_MS = 60 * 60 * 1000;
const DEMO_BROWSER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const MAX_DEMO_START_BODY_BYTES = 4_000;

type SupabaseAdminUserResponse = {
  id?: string;
  email?: string;
  user?: { id: string; email?: string };
};

type SupabaseTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string };
  error?: string;
  error_description?: string;
};

type DemoStartBody = {
  locale?: string;
  lang?: string;
  turnstileToken?: string;
};

function randomToken(byteLength = 24): string {
  return randomBytes(byteLength).toString("base64url");
}

function browserCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    maxAge: DEMO_BROWSER_COOKIE_MAX_AGE,
  };
}

function demoJson(
  body: Record<string, unknown>,
  status: number,
  browserToken: string,
  retryAfterSeconds?: number,
) {
  const response = NextResponse.json(body, { status });
  response.cookies.set(
    DEMO_BROWSER_COOKIE,
    browserToken,
    browserCookieOptions(),
  );

  if (retryAfterSeconds && retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

async function cleanupCreatedDemo(input: {
  userId: string;
  email: string;
  workspace: NonNullable<
    Awaited<ReturnType<typeof createTemporaryDemoWorkspace>>["workspace"]
  >;
}) {
  return deleteExpiredTemporaryDemo(
    {
      id: input.userId,
      email: input.email,
      user_metadata: {
        fanmind_demo: true,
        demo_type: "temporary",
        demo_expires_at: new Date(0).toISOString(),
      },
    },
    { ...input.workspace, role: "owner" },
    {
      authUserId: input.userId,
      workspaceId: input.workspace.id,
    },
  );
}

async function deleteCreatedDemoAuthUser(
  userId: string,
  serviceRoleKey: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      getSupabaseAuthUrl(`/admin/users/${encodeURIComponent(userId)}`),
      {
        method: "DELETE",
        headers: getSupabaseHeaders(serviceRoleKey),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function settleFailedDemoStart(input: {
  reservationId: string;
  errorCode: string;
  cleanupSucceeded: boolean;
  authUserId?: string | null;
}): Promise<void> {
  if (input.cleanupSucceeded) {
    await failPublicDemoStart(input.reservationId, input.errorCode);
    return;
  }

  const queued = await queuePublicDemoCleanup({
    reservationId: input.reservationId,
    errorCode: input.errorCode,
    authUserId: input.authUserId,
  });
  if (!queued) {
    console.error("Public demo cleanup could not be queued", {
      code: "demo_cleanup_queue_failed",
    });
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json(
      { error: "Der Demo-Start konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }
  const parsedBody = await readBoundedJsonRequest(request, MAX_DEMO_START_BODY_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        error: parsedBody.reason === "payload_too_large"
          ? "Die Demo-Anfrage ist zu groß."
          : "Die Demo-Anfrage ist ungültig.",
        code: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request",
      },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const body = parsedBody.value as DemoStartBody | null;
  const locale = normalizeWorkspaceLocale(
    body?.locale ?? body?.lang ?? request.nextUrl.searchParams.get("lang"),
  );

  const existingUserResult = await getSupabaseServerUser();
  const existingUser = existingUserResult.data.user;
  if (existingUser) {
    if (isTemporaryDemoUser(existingUser)) {
      const expiry = getTemporaryDemoExpiryState(existingUser);
      if (expiry.isTemporaryDemo && !expiry.isExpired) {
        return NextResponse.json({
          ok: true,
          reused: true,
          redirectTo: "/dashboard",
          expiresAt: expiry.expiresAt.toISOString(),
        });
      }
    } else {
      return NextResponse.json({
        ok: true,
        reused: true,
        redirectTo: "/dashboard",
      });
    }
  }

  const suppliedBrowserToken = request.cookies
    .get(DEMO_BROWSER_COOKIE)
    ?.value?.trim();
  const browserToken =
    suppliedBrowserToken && suppliedBrowserToken.length >= 32
      ? suppliedBrowserToken
      : randomToken(32);

  if (!publicDemoEnabled()) {
    return demoJson(
      {
        error:
          "Der öffentliche temporäre Demo-Start ist derzeit deaktiviert. Nutze den bereitgestellten Demo-Zugang oder registriere einen eigenen Workspace.",
        code: "public_demo_disabled",
      },
      503,
      browserToken,
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return demoJson(
      {
        error: "Demo-Start ist serverseitig noch nicht konfiguriert.",
        code: "demo_not_configured",
      },
      503,
      browserToken,
    );
  }

  const clientIp = getTrustedClientIp(request);
  const ipHash = hashDemoIdentifier("ip", clientIp);
  const browserHash = hashDemoIdentifier("browser", browserToken);

  if (!ipHash || !browserHash) {
    return demoJson(
      {
        error:
          "Der Demo-Schutz ist serverseitig noch nicht vollständig konfiguriert.",
        code: "demo_protection_not_configured",
      },
      503,
      browserToken,
    );
  }

  const turnstile = await verifyDemoTurnstile({
    token: body?.turnstileToken,
    remoteIp: clientIp,
  });
  if (!turnstile.ok) {
    return demoJson(
      {
        error: turnstile.error ?? "Bot-Schutz konnte nicht bestätigt werden.",
        code: "turnstile_failed",
      },
      400,
      browserToken,
    );
  }

  const claim = await claimPublicDemoStart({ ipHash, browserHash });
  if (claim.error) {
    console.error("Public demo reservation failed", {
      decision: claim.decision,
      code: "demo_reservation_failed",
    });
    return demoJson(
      {
        error: "Der Demo-Start konnte gerade nicht reserviert werden.",
        code: "demo_reservation_failed",
      },
      503,
      browserToken,
      claim.retryAfterSeconds,
    );
  }

  if (claim.decision === "existing") {
    return demoJson(
      {
        error:
          "Für diesen Browser läuft bereits eine temporäre Demo. Öffne die bestehende Demo im ursprünglichen Browserfenster oder versuche es nach Ablauf erneut.",
        code: "demo_already_active",
      },
      429,
      browserToken,
      claim.retryAfterSeconds,
    );
  }

  if (claim.decision === "capacity") {
    return demoJson(
      {
        error:
          "Alle öffentlichen Demo-Plätze sind derzeit belegt. Bitte versuche es in wenigen Minuten erneut.",
        code: "demo_capacity_reached",
      },
      503,
      browserToken,
      claim.retryAfterSeconds,
    );
  }

  if (
    claim.decision === "blocked_ip_short" ||
    claim.decision === "blocked_ip_day" ||
    claim.decision === "blocked_browser_day"
  ) {
    return demoJson(
      {
        error:
          "Das Demo-Limit wurde erreicht. Bitte nutze deine bestehende Demo oder versuche es später erneut.",
        code: claim.decision,
      },
      429,
      browserToken,
      claim.retryAfterSeconds,
    );
  }

  if (claim.decision !== "reserved" || !claim.reservationId) {
    return demoJson(
      {
        error: "Der Demo-Start wurde aus Sicherheitsgründen abgebrochen.",
        code: "invalid_demo_claim",
      },
      503,
      browserToken,
      claim.retryAfterSeconds,
    );
  }

  const reservationId = claim.reservationId;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEMO_DURATION_MS);
  const email = `demo+${randomToken(12)}@fanmind.local`;
  const password = `${randomToken(18)}aA1!`;

  const createUserResponse = await fetch(getSupabaseAuthUrl("/admin/users"), {
    method: "POST",
    headers: getSupabaseHeaders(serviceRoleKey),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        fanmind_demo: true,
        demo_type: "temporary",
        demo_started_at: now.toISOString(),
        demo_expires_at: expiresAt.toISOString(),
        demo_workspace_name: "FanMind Demo Workspace",
        display_name: locale === "en" ? "Demo User" : "Demo Nutzer",
        fanmind_locale: locale,
        locale,
      },
    }),
    cache: "no-store",
  });

  if (!createUserResponse.ok) {
    await failPublicDemoStart(reservationId, "auth_user_create_failed");
    return demoJson(
      {
        error: "Demo-User konnte nicht erstellt werden.",
        code: "auth_user_create_failed",
      },
      500,
      browserToken,
    );
  }

  const createdUser =
    (await createUserResponse.json()) as SupabaseAdminUserResponse;
  const userId = createdUser.id ?? createdUser.user?.id;
  if (!userId) {
    await failPublicDemoStart(reservationId, "auth_user_id_missing");
    return demoJson(
      {
        error: "Demo-User wurde ohne ID erstellt.",
        code: "auth_user_id_missing",
      },
      500,
      browserToken,
    );
  }

  const authResourceRecorded = await recordPublicDemoStartResources({
    reservationId,
    authUserId: userId,
  });
  if (!authResourceRecorded) {
    const authDeleted = await deleteCreatedDemoAuthUser(
      userId,
      serviceRoleKey,
    );
    await settleFailedDemoStart({
      reservationId,
      errorCode: "auth_user_record_failed",
      cleanupSucceeded: authDeleted,
      authUserId: authDeleted ? null : userId,
    });
    return demoJson(
      {
        error: "Demo-User konnte nicht sicher registriert werden.",
        code: "auth_user_record_failed",
      },
      500,
      browserToken,
    );
  }

  const workspaceResult = await createTemporaryDemoWorkspace({
    userId,
    userEmail: email,
    expiresAt,
    locale,
  });

  if (workspaceResult.workspace) {
    const workspaceResourceRecorded =
      await recordPublicDemoStartResources({
        reservationId,
        authUserId: userId,
        workspaceId: workspaceResult.workspace.id,
      });
    if (!workspaceResourceRecorded) {
      const cleanup = await cleanupCreatedDemo({
        userId,
        email,
        workspace: workspaceResult.workspace,
      });
      await settleFailedDemoStart({
        reservationId,
        errorCode: "workspace_record_failed",
        cleanupSucceeded: cleanup.deleted && !cleanup.error,
      });
      return demoJson(
        {
          error: "Demo-Workspace konnte nicht sicher registriert werden.",
          code: "workspace_record_failed",
        },
        500,
        browserToken,
      );
    }
  }

  if (workspaceResult.error || !workspaceResult.workspace) {
    const cleanupSucceeded = workspaceResult.workspace
      ? await cleanupCreatedDemo({
          userId,
          email,
          workspace: workspaceResult.workspace,
        }).then((cleanup) => cleanup.deleted && !cleanup.error)
      : await deleteCreatedDemoAuthUser(userId, serviceRoleKey);
    await settleFailedDemoStart({
      reservationId,
      errorCode: "workspace_create_failed",
      cleanupSucceeded,
    });

    return demoJson(
      {
        error: "Demo-Workspace konnte nicht erstellt werden.",
        code: "workspace_create_failed",
      },
      500,
      browserToken,
    );
  }

  const tokenResponse = await fetch(
    getSupabaseAuthUrl("/token?grant_type=password"),
    {
      method: "POST",
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    },
  );

  if (!tokenResponse.ok) {
    const cleanup = await cleanupCreatedDemo({
      userId,
      email,
      workspace: workspaceResult.workspace,
    });
    await settleFailedDemoStart({
      reservationId,
      errorCode: "session_create_failed",
      cleanupSucceeded: cleanup.deleted && !cleanup.error,
    });

    return demoJson(
      {
        error: "Demo-Sitzung konnte nicht erstellt werden.",
        code: "session_create_failed",
      },
      500,
      browserToken,
    );
  }

  const session = (await tokenResponse.json()) as SupabaseTokenResponse;
  if (!session.access_token) {
    const cleanup = await cleanupCreatedDemo({
      userId,
      email,
      workspace: workspaceResult.workspace,
    });
    await settleFailedDemoStart({
      reservationId,
      errorCode: "session_access_token_missing",
      cleanupSucceeded: cleanup.deleted && !cleanup.error,
    });

    return demoJson(
      {
        error: "Supabase hat keine gültige Demo-Session zurückgegeben.",
        code: "session_access_token_missing",
      },
      500,
      browserToken,
    );
  }

  const activated = await activatePublicDemoStart({
    reservationId,
    authUserId: userId,
    workspaceId: workspaceResult.workspace.id,
    expiresAt,
  });

  if (!activated) {
    const cleanup = await cleanupCreatedDemo({
      userId,
      email,
      workspace: workspaceResult.workspace,
    });
    await settleFailedDemoStart({
      reservationId,
      errorCode: "reservation_activation_failed",
      cleanupSucceeded: cleanup.deleted && !cleanup.error,
    });

    return demoJson(
      {
        error: "Die Demo-Reservierung konnte nicht aktiviert werden.",
        code: "reservation_activation_failed",
      },
      500,
      browserToken,
    );
  }

  const response = demoJson(
    {
      ok: true,
      redirectTo: "/dashboard",
      expiresAt: expiresAt.toISOString(),
    },
    200,
    browserToken,
  );
  response.cookies.set(
    FANMIND_LOCALE_COOKIE,
    locale,
    localeCookieOptions(),
  );
  response.cookies.set(SUPABASE_ACCESS_TOKEN_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: Math.min(session.expires_in ?? 60 * 60, 60 * 60),
  });

  if (session.refresh_token) {
    response.cookies.set(SUPABASE_REFRESH_TOKEN_COOKIE, session.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 60 * 60,
    });
  }

  return response;
}
