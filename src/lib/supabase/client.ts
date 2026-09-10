"use client";

import { getSupabaseHeaders, getSupabaseRestUrl, getSupabaseAuthUrl } from "./config";

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseAuthSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: SupabaseAuthUser;
};

type SupabaseAuthResponse = {
  data: {
    session: SupabaseAuthSession | null;
    user: SupabaseAuthUser | null;
  };
  error: Error | null;
};

type SupabaseAuthPayload = Partial<SupabaseAuthSession> &
  Partial<SupabaseAuthUser> & {
    session?: SupabaseAuthSession | null;
    user?: SupabaseAuthUser | null;
  };

type SupabaseUserResponse = {
  data: {
    user: SupabaseAuthUser | null;
  };
  error: Error | null;
};

type SignUpInput = {
  email: string;
  password: string;
  options?: {
    data?: Record<string, unknown>;
  };
};

type SignInInput = {
  email: string;
  password: string;
};

type ResetPasswordInput = {
  email: string;
  options?: {
    redirectTo?: string;
  };
};

type SetSessionInput = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
};

type UpdateUserInput = {
  password?: string;
};

type SupabaseMutationResponse<T = unknown> = {
  data: T | null;
  error: Error | null;
};

type SupabaseFilterValue = string | number | boolean;

type SelectQuery<T = Record<string, unknown>> = {
  eq(column: string, value: SupabaseFilterValue): SelectQuery<T>;
  limit(count: number): SelectQuery<T>;
  maybeSingle(): Promise<SupabaseMutationResponse<T>>;
};

type InsertResult = PromiseLike<SupabaseMutationResponse> & {
  select<T = Record<string, unknown>>(columns: string): {
    single(): Promise<SupabaseMutationResponse<T>>;
  };
};

async function parseSupabaseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as { msg?: string; message?: string; error_description?: string; error?: string } | null;
  const message = payload?.msg ?? payload?.message ?? payload?.error_description ?? payload?.error ?? "Supabase konnte die Anfrage nicht verarbeiten.";

  return new Error(message);
}

export async function syncSupabaseSessionForServer(session: SupabaseAuthSession | null): Promise<void> {
  if (!session?.access_token) {
    throw new Error("Login fehlgeschlagen: Die Supabase-Sitzung enthält keinen Access Token.");
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`Login fehlgeschlagen: Server-Sitzung konnte nicht gesetzt werden (${response.status}${responseText ? `: ${responseText}` : ""}).`);
  }
}

function normalizeAuthPayload(payload: SupabaseAuthPayload): SupabaseAuthResponse {
  const topLevelUser = payload.id
    ? {
        id: payload.id,
        email: payload.email,
        user_metadata: payload.user_metadata,
      }
    : null;
  const session = payload.session ?? (payload.access_token ? (payload as SupabaseAuthSession) : null);
  const user = session?.user ?? payload.user ?? topLevelUser;

  if (session && user && !session.user) {
    session.user = user;
  }

  return { data: { session, user }, error: null };
}

async function postAuth(path: string, body: Record<string, unknown>, rememberSession: (session: SupabaseAuthSession | null) => void, accessToken?: string): Promise<SupabaseAuthResponse> {
  try {
    const response = await fetch(getSupabaseAuthUrl(path), {
      method: "POST",
      headers: getSupabaseHeaders(accessToken),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { data: { session: null, user: null }, error: await parseSupabaseError(response) };
    }

    const payload = (await response.json()) as SupabaseAuthPayload;
    const authResponse = normalizeAuthPayload(payload);
    rememberSession(authResponse.data.session);

    return authResponse;
  } catch (error) {
    return { data: { session: null, user: null }, error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler.") };
  }
}

async function getAuthUser(accessToken: string | undefined): Promise<SupabaseUserResponse> {
  if (!accessToken) {
    return { data: { user: null }, error: new Error("Keine gültige Recovery-Sitzung gefunden.") };
  }

  try {
    const response = await fetch(getSupabaseAuthUrl("/user"), {
      method: "GET",
      headers: getSupabaseHeaders(accessToken),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { data: { user: null }, error: await parseSupabaseError(response) };
    }

    const payload = (await response.json()) as SupabaseAuthPayload;
    const user = payload.user ?? (payload.id ? { id: payload.id, email: payload.email, user_metadata: payload.user_metadata } : null);

    return { data: { user }, error: null };
  } catch (error) {
    return { data: { user: null }, error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler.") };
  }
}

async function putAuthUser(body: UpdateUserInput, accessToken: string | undefined, rememberSession: (session: SupabaseAuthSession | null) => void): Promise<SupabaseAuthResponse> {
  if (!accessToken) {
    return { data: { session: null, user: null }, error: new Error("Keine gültige Recovery-Sitzung gefunden.") };
  }

  try {
    const response = await fetch(getSupabaseAuthUrl("/user"), {
      method: "PUT",
      headers: getSupabaseHeaders(accessToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { data: { session: null, user: null }, error: await parseSupabaseError(response) };
    }

    const payload = (await response.json()) as SupabaseAuthPayload;
    const authResponse = normalizeAuthPayload(payload);
    rememberSession(authResponse.data.session);

    return authResponse;
  } catch (error) {
    return { data: { session: null, user: null }, error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler.") };
  }
}

async function postgrestRequest<T>(table: string, method: "POST" | "PATCH", values: unknown, accessToken?: string, select?: string, single?: boolean, upsert?: boolean): Promise<SupabaseMutationResponse<T>> {
  try {
    const url = new URL(getSupabaseRestUrl(table));

    if (select) {
      url.searchParams.set("select", select);
    }

    if (upsert && typeof values === "object" && values && "id" in values) {
      url.searchParams.set("on_conflict", "id");
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...getSupabaseHeaders(accessToken),
        Prefer: `${upsert ? "resolution=merge-duplicates," : ""}${select ? "return=representation" : "return=minimal"}`,
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      return { data: null, error: await parseSupabaseError(response) };
    }

    if (!select) {
      return { data: null, error: null };
    }

    const payload = (await response.json()) as T[];

    return { data: single ? payload[0] ?? null : (payload as T), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler.") };
  }
}

async function postgrestSelect<T>(table: string, accessToken: string | undefined, columns: string, filters: [string, SupabaseFilterValue][], limitCount?: number, single?: boolean): Promise<SupabaseMutationResponse<T>> {
  try {
    const url = new URL(getSupabaseRestUrl(table));
    url.searchParams.set("select", columns);

    for (const [column, value] of filters) {
      url.searchParams.set(column, `eq.${String(value)}`);
    }

    if (limitCount) {
      url.searchParams.set("limit", String(limitCount));
    }

    const response = await fetch(url.toString(), {
      headers: getSupabaseHeaders(accessToken),
    });

    if (!response.ok) {
      return { data: null, error: await parseSupabaseError(response) };
    }

    const payload = (await response.json()) as T[];

    return { data: single ? payload[0] ?? null : (payload as T), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler.") };
  }
}

async function postgrestRpc<T>(
  functionName: string,
  values: Record<string, unknown>,
  accessToken: string | undefined,
): Promise<SupabaseMutationResponse<T>> {
  try {
    const response = await fetch(
      getSupabaseRestUrl(`rpc/${functionName}`),
      {
        method: "POST",
        headers: getSupabaseHeaders(accessToken),
        body: JSON.stringify(values),
      },
    );

    if (!response.ok) {
      return { data: null, error: await parseSupabaseError(response) };
    }

    const payload = (await response.json()) as T | T[];

    return {
      data: Array.isArray(payload) ? (payload[0] ?? null) : payload,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}

function createSelectQuery<T>(table: string, columns: string, getAccessToken: () => string | undefined): SelectQuery<T> {
  const filters: [string, SupabaseFilterValue][] = [];
  let limitCount: number | undefined;

  const query: SelectQuery<T> = {
    eq(column, value) {
      filters.push([column, value]);
      return query;
    },
    limit(count) {
      limitCount = count;
      return query;
    },
    maybeSingle() {
      return postgrestSelect<T>(table, getAccessToken(), columns, filters, limitCount ?? 1, true);
    },
  };

  return query;
}

function createInsertResult(table: string, values: unknown, getAccessToken: () => string | undefined): InsertResult {
  const execute = () => postgrestRequest(table, "POST", values, getAccessToken());

  return {
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    select<T = Record<string, unknown>>(columns: string) {
      return {
        single() {
          return postgrestRequest<T>(table, "POST", values, getAccessToken(), columns, true);
        },
      };
    },
  };
}

export function createSupabaseBrowserClient() {
  let currentSession: SupabaseAuthSession | null = null;
  const rememberSession = (session: SupabaseAuthSession | null) => {
    currentSession = session;
  };
  const getAccessToken = () => currentSession?.access_token;

  return {
    auth: {
      signUp({ email, password, options }: SignUpInput) {
        return postAuth("/signup", { email, password, data: options?.data }, rememberSession);
      },
      signInWithPassword({ email, password }: SignInInput) {
        return postAuth("/token?grant_type=password", { email, password }, rememberSession);
      },
      resetPasswordForEmail({ email, options }: ResetPasswordInput) {
        const recoverPath = options?.redirectTo ? `/recover?redirect_to=${encodeURIComponent(options.redirectTo)}` : "/recover";

        return postAuth(recoverPath, { email }, rememberSession);
      },
      setSession(session: SetSessionInput) {
        const normalizedSession: SupabaseAuthSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
        };
        rememberSession(normalizedSession);
        return Promise.resolve({ data: { session: normalizedSession, user: null }, error: null });
      },
      getUser(accessToken?: string) {
        return getAuthUser(accessToken ?? getAccessToken());
      },
      updateUser(values: UpdateUserInput, accessToken?: string) {
        return putAuthUser(values, accessToken ?? getAccessToken(), rememberSession);
      },
      updateUserWithAccessToken(values: UpdateUserInput, accessToken: string) {
        return putAuthUser(values, accessToken, rememberSession);
      },
      async signOut() {
        await fetch("/api/auth/logout", { method: "POST" });
        currentSession = null;
      },
    },
    from(table: string) {
      return {
        select<T = Record<string, unknown>>(columns: string) {
          return createSelectQuery<T>(table, columns, getAccessToken);
        },
        upsert(values: unknown) {
          return postgrestRequest(table, "POST", values, getAccessToken(), undefined, false, true);
        },
        insert(values: unknown) {
          return createInsertResult(table, values, getAccessToken);
        },
      };
    },
    rpc<T = Record<string, unknown>>(
      functionName: string,
      values: Record<string, unknown>,
    ) {
      return postgrestRpc<T>(functionName, values, getAccessToken());
    },
  };
}
