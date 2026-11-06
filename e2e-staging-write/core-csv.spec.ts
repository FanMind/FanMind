import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const APP_ORIGIN = new URL(
  process.env.FANMIND_E2E_STAGING_URL?.trim() || "",
).origin;
const SUPABASE_ORIGIN = new URL(
  process.env.FANMIND_E2E_STAGING_SUPABASE_URL?.trim() || "",
).origin;
const CONTACT_ID =
  process.env.FANMIND_E2E_STAGING_ACCEPTANCE_CONTACT_ID?.trim() || "";
const IMPORTED_HANDLE =
  process.env.FANMIND_E2E_STAGING_ACCEPTANCE_IMPORTED_HANDLE?.trim() || "";
const PRIMARY_FIXTURE_CONTACT_ID =
  process.env.FANMIND_E2E_STAGING_CONTACT_ID?.trim() || "";
const SECONDARY_FIXTURE_CONTACT_ID =
  process.env.FANMIND_E2E_STAGING_SECONDARY_CONTACT_ID?.trim() || "";
const PRIMARY_WORKSPACE_ID =
  process.env.FANMIND_E2E_STAGING_WORKSPACE_ID?.trim() || "";
const SECONDARY_WORKSPACE_ID =
  process.env.FANMIND_E2E_STAGING_SECONDARY_WORKSPACE_ID?.trim() || "";
const CONTACT_NAME = "Sandra Staging Core Acceptance";
const IMPORTED_NAME = "CSV Staging Core Acceptance";
const INBOUND_MESSAGE =
  "Hallo, bitte erinnere mich am Montag an die neuen Termine und merke dir, dass Montag für mich am besten passt.";
const MEMBER_EMAIL = "fanmind-ai-member-staging@example.invalid";
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const TURNSTILE_SCRIPT_PATH = "/turnstile/v0/api.js";

type Fixture = { email: string; password: string };
type Session = { accessToken: string; anonKey: string };
type AiSuggestionPayload = {
  suggested_memory?: { content?: unknown };
  suggested_followup?: { recommended?: unknown; reason?: unknown };
};

const activeSessions = new WeakMap<Page, Session[]>();

const primary: Fixture = {
  email: process.env.FANMIND_E2E_STAGING_EMAIL?.trim() || "",
  password: process.env.FANMIND_E2E_STAGING_PASSWORD || "",
};
const member: Fixture = {
  email: MEMBER_EMAIL,
  password: process.env.FANMIND_E2E_STAGING_MEMBER_PASSWORD || "",
};
const secondary: Fixture = {
  email: process.env.FANMIND_E2E_STAGING_SECONDARY_EMAIL?.trim() || "",
  password: process.env.FANMIND_E2E_STAGING_SECONDARY_PASSWORD || "",
};

function requireFixtureContract() {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
  const ids = [
    CONTACT_ID,
    PRIMARY_FIXTURE_CONTACT_ID,
    SECONDARY_FIXTURE_CONTACT_ID,
    PRIMARY_WORKSPACE_ID,
    SECONDARY_WORKSPACE_ID,
  ];
  const identities = [primary, member, secondary];
  if (
    ids.some((value) => !uuid.test(value)) ||
    new Set(ids).size !== ids.length ||
    !/^fanmind-staging-core-csv$/u.test(IMPORTED_HANDLE) ||
    identities.some(
      ({ email, password }) =>
        !email || !password || !/staging|synthetic|test/iu.test(email),
    ) ||
    new Set(identities.map(({ email }) => email.toLowerCase())).size !== 3
  ) {
    throw new Error("staging_core_csv_fixture_invalid");
  }
}

async function installNetworkBoundary(context: BrowserContext, page: Page) {
  const unexpectedOrigins: string[] = [];
  const unexpectedWrites: string[] = [];
  const failedResponses: string[] = [];
  const pageErrors: string[] = [];
  const blockedTurnstileRequests: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.name));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      [APP_ORIGIN, SUPABASE_ORIGIN].includes(url.origin) &&
      response.status() >= 400
    ) {
      failedResponses.push(
        `${response.status()} ${response.request().method()} ${url.pathname}`,
      );
    }
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (
      url.origin === TURNSTILE_ORIGIN &&
      method === "GET" &&
      url.pathname === TURNSTILE_SCRIPT_PATH
    ) {
      blockedTurnstileRequests.push(url.pathname);
      await route.abort("blockedbyclient");
      return;
    }
    if (![APP_ORIGIN, SUPABASE_ORIGIN].includes(url.origin)) {
      unexpectedOrigins.push(`${method} ${url.origin}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const allowed =
        (url.origin === SUPABASE_ORIGIN &&
          method === "POST" &&
          ["/auth/v1/token", "/auth/v1/logout"].includes(url.pathname)) ||
        (url.origin === APP_ORIGIN &&
          method === "POST" &&
          (url.pathname === "/api/auth/session" ||
            url.pathname === "/api/ai/reply-suggestions" ||
            url.pathname === `/fans/${CONTACT_ID}` ||
            url.pathname === "/fans/import" ||
            url.pathname === "/followups"));
      if (!allowed) {
        unexpectedWrites.push(`${method} ${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
    }
    await route.continue();
  });
  return {
    unexpectedOrigins,
    unexpectedWrites,
    failedResponses,
    pageErrors,
    blockedTurnstileRequests,
  };
}

async function login(page: Page, fixture: Fixture): Promise<Session> {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "E-Mail", exact: true })
    .fill(fixture.email);
  await page.locator('input[name="password"]').fill(fixture.password);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.origin === SUPABASE_ORIGIN &&
        url.pathname === "/auth/v1/token" &&
        url.searchParams.get("grant_type") === "password"
      );
    }),
    page.getByRole("button", { name: /Einloggen/u }).click(),
  ]);
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { access_token?: unknown };
  const accessToken =
    typeof body.access_token === "string" ? body.access_token : "";
  const anonKey = response.request().headers().apikey || "";
  expect(accessToken).not.toBe("");
  expect(anonKey).not.toBe("");
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/u);
  const session = { accessToken, anonKey };
  activeSessions.set(page, [...(activeSessions.get(page) ?? []), session]);
  return session;
}

async function logout(page: Page, session: Session) {
  const response = await page.request.post(`${SUPABASE_ORIGIN}/auth/v1/logout`, {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  expect(response.ok()).toBe(true);
  activeSessions.set(
    page,
    (activeSessions.get(page) ?? []).filter(
      (candidate) => candidate.accessToken !== session.accessToken,
    ),
  );
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.afterEach(async ({ page }) => {
  const sessions = activeSessions.get(page) ?? [];
  const failedRevocations: number[] = [];
  for (const session of sessions) {
    const response = await page.request.post(
      `${SUPABASE_ORIGIN}/auth/v1/logout`,
      {
        headers: {
          apikey: session.anonKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      },
    );
    if (!response.ok()) failedRevocations.push(response.status());
  }
  activeSessions.delete(page);
  await page.context().clearCookies();
  expect(failedRevocations).toEqual([]);
});

async function contactRows(page: Page, session: Session, ids: string[]) {
  const url = new URL("/rest/v1/contacts", SUPABASE_ORIGIN);
  url.searchParams.set("id", `in.(${ids.join(",")})`);
  url.searchParams.set("select", "id,workspace_id");
  url.searchParams.set("order", "id.asc");
  const response = await page.request.get(url.toString(), {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    },
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<
    Array<{ id: string; workspace_id: string }>
  >;
}

async function importedRows(page: Page, session: Session) {
  const url = new URL("/rest/v1/contacts", SUPABASE_ORIGIN);
  url.searchParams.set("handle", `eq.${IMPORTED_HANDLE}`);
  url.searchParams.set("select", "id,workspace_id");
  const response = await page.request.get(url.toString(), {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    },
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<
    Array<{ id: string; workspace_id: string }>
  >;
}

async function memberIdempotentContactMutationRows(
  page: Page,
  session: Session,
) {
  const url = new URL("/rest/v1/contacts", SUPABASE_ORIGIN);
  url.searchParams.set("id", `eq.${CONTACT_ID}`);
  url.searchParams.set("select", "id");
  const response = await page.request.patch(url.toString(), {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: { display_name: CONTACT_NAME },
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<Array<{ id: string }>>;
}

test.beforeEach(() => requireFixtureContract());

test("owner completes writes while member proves read-only Staging core and CSV access", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "fanmind_marketing_consent",
      value: "denied",
      url: APP_ORIGIN,
      sameSite: "Lax",
    },
  ]);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: APP_ORIGIN,
  });
  const audit = await installNetworkBoundary(context, page);

  const ownerSession = await login(page, primary);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByText("FanMind Staging Processing Acceptance").first(),
  ).toBeVisible();

  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByText(CONTACT_NAME).first()).toBeVisible();
  await expect(page.getByText(INBOUND_MESSAGE).first()).toBeVisible();
  await expect(page.getByText("Antworten nie automatisch senden")).toBeVisible();

  await page.goto(`/fans/${CONTACT_ID}`);
  await expect(
    page.getByRole("heading", { name: CONTACT_NAME }).first(),
  ).toBeVisible();
  await expect(page.getByText(INBOUND_MESSAGE).first()).toBeVisible();
  const aiResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.origin === APP_ORIGIN &&
      url.pathname === "/api/ai/reply-suggestions"
    );
  });
  await page
    .getByLabel("Zusatzanweisung")
    .fill("Erzeuge bitte auch einen Kontaktwissen- und einen Follow-up-Vorschlag.");
  await page.getByRole("button", { name: "KI-Vorschläge erzeugen" }).click();
  const aiResponse = await aiResponsePromise;
  expect(aiResponse.status()).toBe(200);
  const aiPayload = (await aiResponse.json()) as AiSuggestionPayload;
  const memoryContent =
    typeof aiPayload.suggested_memory?.content === "string"
      ? aiPayload.suggested_memory.content.trim()
      : "";
  const followupReason =
    typeof aiPayload.suggested_followup?.reason === "string"
      ? aiPayload.suggested_followup.reason.trim()
      : "";
  expect(memoryContent).not.toBe("");
  expect(aiPayload.suggested_followup?.recommended).toBe(true);
  expect(followupReason).not.toBe("");

  const aiCard = page.locator('article[aria-labelledby="ai-replies-title"]');
  const replyCards = aiCard
    .locator("article")
    .filter({ has: page.getByRole("button", { name: "Antwort kopieren" }) });
  await expect(replyCards).toHaveCount(3);
  const firstReply = replyCards.first();
  await firstReply.getByRole("button", { name: "Antwort kopieren" }).click();
  await expect(firstReply.getByRole("button", { name: "Kopiert" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .not.toBe("");
  await expect(
    aiCard.getByText("Keine automatische Sendefunktion").first(),
  ).toBeVisible();

  const memorySuggestion = aiCard
    .getByText("Vorschlag fürs Kontaktwissen", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await memorySuggestion.getByRole("button", { name: "Speichern" }).click();
  await expect(memorySuggestion.getByRole("status")).toHaveText(
    "Im Kontaktwissen gespeichert.",
  );
  const followupSuggestion = aiCard
    .getByText("Follow-up-Vorschlag", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await followupSuggestion.getByRole("button", { name: "Speichern" }).click();
  await expect(followupSuggestion.getByRole("status")).toHaveText(
    "Follow-up gespeichert.",
  );

  await page.goto("/fans/import");
  const csv = [
    "display_name,handle,source_platform,language,status,tags,summary",
    `${IMPORTED_NAME},${IMPORTED_HANDLE},manual,de,new,"synthetic;staging;core-acceptance",Kontrollierte synthetische Staging-CSV-Acceptance.`,
    "Vorhandene Fixture,fanmind-staging-primary,manual,de,new,synthetic,Duplikatprüfung",
    ",ungueltig,manual,de,new,synthetic,Ungueltige Zeile",
  ].join("\n");
  await page.getByLabel("CSV-Text").fill(csv);
  await page.getByRole("button", { name: "Vorschau erstellen" }).click();
  await expect(page.getByText(/Zeile 4: Name fehlt/u)).toBeVisible();
  await page.getByRole("button", { name: "Kontakte importieren" }).click();
  const importStatus = page.getByRole("status");
  await expect(importStatus).toContainText("1 Kontakte importiert");
  await expect(importStatus).toContainText("1 Duplikate übersprungen");
  await expect(importStatus).toContainText("1 Zeilen mit Fehlern");
  await page.goto("/fans");
  await expect(page.getByText(IMPORTED_NAME).first()).toBeVisible();

  expect(
    await contactRows(page, ownerSession, [
      CONTACT_ID,
      SECONDARY_FIXTURE_CONTACT_ID,
    ]),
  ).toEqual([{ id: CONTACT_ID, workspace_id: PRIMARY_WORKSPACE_ID }]);
  expect(await importedRows(page, ownerSession)).toHaveLength(1);
  await logout(page, ownerSession);

  const memberSession = await login(page, member);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/fans");
  await expect(page.getByText(CONTACT_NAME).first()).toBeVisible();
  await expect(page.getByText(IMPORTED_NAME).first()).toBeVisible();
  await expect(
    page.getByText(/Teamzugang im Nur-Lese-Modus: Fans/u),
  ).toBeVisible();
  await expect(page.getByText("+ Neuer Fan", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CSV importieren", { exact: true })).toHaveCount(0);
  await page.goto(`/fans/${CONTACT_ID}`);
  await expect(
    page.getByRole("heading", { name: CONTACT_NAME }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Teamzugang im Nur-Lese-Modus.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Top Fan/u })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "KI-Vorschläge erzeugen" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Kontaktwissen" }).click();
  await expect(
    page.getByRole("tabpanel").getByText(memoryContent, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tabpanel").getByText("+ Kontaktwissen hinzufügen"),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Follow-ups" }).click();
  await expect(
    page.getByRole("tabpanel").getByText(followupReason, { exact: true }),
  ).toBeVisible();

  await page.goto("/followups");
  const followupRow = page
    .locator("tr")
    .filter({ hasText: CONTACT_NAME })
    .filter({ hasText: followupReason });
  await expect(followupRow).toBeVisible();
  await expect(
    page.getByText("Teamzugang im Nur-Lese-Modus.", { exact: true }),
  ).toBeVisible();
  await expect(followupRow.getByText("Nur Lesen", { exact: true })).toBeVisible();
  await expect(
    followupRow.getByRole("button", { name: "Als erledigt markieren" }),
  ).toHaveCount(0);

  await page.goto("/fans/import");
  await expect(
    page.getByRole("heading", {
      name: "CSV-Import ist dem Workspace-Owner vorbehalten.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("CSV-Text")).toHaveCount(0);

  expect(
    await memberIdempotentContactMutationRows(page, memberSession),
  ).toEqual([]);
  expect(
    await contactRows(page, memberSession, [
      CONTACT_ID,
      SECONDARY_FIXTURE_CONTACT_ID,
    ]),
  ).toEqual([{ id: CONTACT_ID, workspace_id: PRIMARY_WORKSPACE_ID }]);
  expect(await importedRows(page, memberSession)).toHaveLength(1);
  await logout(page, memberSession);

  const secondarySession = await login(page, secondary);
  expect(
    await contactRows(page, secondarySession, [
      CONTACT_ID,
      PRIMARY_FIXTURE_CONTACT_ID,
      SECONDARY_FIXTURE_CONTACT_ID,
    ]),
  ).toEqual([
    {
      id: SECONDARY_FIXTURE_CONTACT_ID,
      workspace_id: SECONDARY_WORKSPACE_ID,
    },
  ]);
  expect(await importedRows(page, secondarySession)).toEqual([]);
  await logout(page, secondarySession);

  expect(audit.unexpectedOrigins).toEqual([]);
  expect(audit.unexpectedWrites).toEqual([]);
  expect(audit.failedResponses).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.blockedTurnstileRequests.length).toBeLessThanOrEqual(6);
});
