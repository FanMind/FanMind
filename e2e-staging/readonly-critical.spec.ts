import { expect, test, type Page } from "@playwright/test";

type SyntheticFixture = {
  email: string;
  password: string;
  workspaceId: string;
  contactId: string;
};

type AuthSession = {
  accessToken: string;
  anonKey: string;
};

const appOrigin = new URL(
  process.env.FANMIND_E2E_STAGING_URL?.trim() || "",
).origin;
const supabaseTarget = new URL(
  process.env.FANMIND_E2E_STAGING_SUPABASE_URL?.trim() || "",
);
const supabaseOrigin = supabaseTarget.origin;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const primary: SyntheticFixture = {
  email: process.env.FANMIND_E2E_STAGING_EMAIL?.trim() || "",
  password: process.env.FANMIND_E2E_STAGING_PASSWORD || "",
  workspaceId: process.env.FANMIND_E2E_STAGING_WORKSPACE_ID?.trim() || "",
  contactId: process.env.FANMIND_E2E_STAGING_CONTACT_ID?.trim() || "",
};

const secondary: SyntheticFixture = {
  email:
    process.env.FANMIND_E2E_STAGING_SECONDARY_EMAIL?.trim() || "",
  password: process.env.FANMIND_E2E_STAGING_SECONDARY_PASSWORD || "",
  workspaceId:
    process.env.FANMIND_E2E_STAGING_SECONDARY_WORKSPACE_ID?.trim() || "",
  contactId:
    process.env.FANMIND_E2E_STAGING_SECONDARY_CONTACT_ID?.trim() || "",
};

const admin = {
  email: process.env.FANMIND_E2E_STAGING_ADMIN_EMAIL?.trim() || "",
  password: process.env.FANMIND_E2E_STAGING_ADMIN_PASSWORD || "",
};

const configuredAdminEmails = (
  process.env.FANMIND_E2E_STAGING_ADMIN_EMAILS || ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function requireAdminFixture() {
  const normalizedAdminEmail = admin.email.toLowerCase();

  if (!admin.email || !admin.password) {
    throw new Error("staging_admin_e2e_credentials_missing");
  }
  if (
    !configuredAdminEmails.includes(normalizedAdminEmail) ||
    [primary.email, secondary.email]
      .map((email) => email.toLowerCase())
      .includes(normalizedAdminEmail)
  ) {
    throw new Error("staging_admin_e2e_boundary_rejected");
  }
}

function requireSyntheticFixtures() {
  const fixtures = [primary, secondary];
  const identifiers = fixtures.flatMap(({ workspaceId, contactId }) => [
    workspaceId,
    contactId,
  ]);

  for (const fixture of fixtures) {
    if (!fixture.email || !fixture.password) {
      throw new Error("staging_e2e_credentials_missing");
    }
    if (!/staging|synthetic|test/iu.test(fixture.email)) {
      throw new Error("staging_e2e_email_not_marked_synthetic");
    }
  }
  if (
    primary.email.toLowerCase() === secondary.email.toLowerCase() ||
    identifiers.some((value) => !uuid.test(value)) ||
    new Set(identifiers).size !== identifiers.length
  ) {
    throw new Error("staging_e2e_fixture_boundary_rejected");
  }
}

async function installReadOnlyNetworkGuard(page: Page) {
  const blockedWrites: string[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const sameApp = url.origin === appOrigin;
    const sameSupabase = url.origin === supabaseOrigin;
    const isRead = ["GET", "HEAD", "OPTIONS"].includes(method);
    const isAuthSessionExchange =
      sameSupabase &&
      method === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password";
    const isAppSessionSync =
      sameApp &&
      method === "POST" &&
      url.pathname === "/api/auth/session";
    const isExplicitLogout =
      sameSupabase &&
      method === "POST" &&
      url.pathname === "/auth/v1/logout";

    if (
      (isRead && (sameApp || sameSupabase)) ||
      isAuthSessionExchange ||
      isAppSessionSync ||
      isExplicitLogout
    ) {
      await route.continue();
      return;
    }

    blockedWrites.push(`${method}:${url.origin}:${url.pathname}`);
    await route.abort("blockedbyclient");
  });

  return blockedWrites;
}

async function login(
  page: Page,
  fixture: Pick<SyntheticFixture, "email" | "password">,
): Promise<AuthSession> {
  await page.goto("/login");

  const emailField = page.getByRole("textbox", {
    name: "E-Mail",
    exact: true,
  });
  const passwordField = page.locator('input[name="password"]');
  await expect(emailField).toBeVisible();
  await expect(passwordField).toBeVisible();
  await emailField.fill(fixture.email);
  await passwordField.fill(fixture.password);

  const [response] = await Promise.all([
    page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.origin === supabaseOrigin &&
        url.pathname === "/auth/v1/token" &&
        url.searchParams.get("grant_type") === "password"
      );
    }),
    page.getByRole("button", { name: /Einloggen/u }).click(),
  ]);
  expect(response.ok()).toBe(true);
  expect(new URL(response.url()).origin).toBe(supabaseOrigin);
  const payload = (await response.json()) as { access_token?: unknown };
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : "";
  const anonKey = response.request().headers().apikey || "";
  if (!accessToken || !anonKey) {
    throw new Error("staging_e2e_session_boundary_missing");
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/u);
  return { accessToken, anonKey };
}

async function readContacts(
  page: Page,
  session: AuthSession,
  fixture: SyntheticFixture,
  peer: SyntheticFixture,
) {
  const url = new URL("/rest/v1/contacts", supabaseOrigin);
  url.searchParams.set(
    "id",
    `in.(${fixture.contactId},${peer.contactId})`,
  );
  url.searchParams.set("select", "id,workspace_id");
  const response = await page.request.get(url.toString(), {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/json",
    },
  });
  expect(response.ok()).toBe(true);
  const rows = (await response.json()) as Array<{
    id?: unknown;
    workspace_id?: unknown;
  }>;
  expect(rows).toEqual([
    {
      id: fixture.contactId,
      workspace_id: fixture.workspaceId,
    },
  ]);
}

async function closeAndClearBrowserSession(
  page: Page,
  session: AuthSession,
) {
  const logoutUrl = new URL("/auth/v1/logout", supabaseOrigin);
  const logoutResponse = await page.request.post(logoutUrl.toString(), {
    headers: {
      apikey: session.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  expect(logoutResponse.ok()).toBe(true);

  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

test.beforeEach(() => {
  requireSyntheticFixtures();
});

test("synthetischer Staging-Nutzer erreicht Dashboard und Kontaktliste ohne Geschäftsdatenschreibzugriff", async ({
  page,
}) => {
  const blockedWrites = await installReadOnlyNetworkGuard(page);
  await login(page, primary);

  await expect(page.locator("main")).toBeVisible();
  await page.locator('a[href="/fans"]').first().click();
  await expect(page).toHaveURL(/\/fans(?:\?|$)/u);
  await expect(page.locator("main")).toBeVisible();

  expect(blockedWrites).toEqual([]);
});

test("zwei synthetische Workspaces dürfen über RLS nur den jeweils eigenen Kontakt lesen", async ({
  page,
}) => {
  const blockedWrites = await installReadOnlyNetworkGuard(page);
  const primarySession = await login(page, primary);
  await readContacts(page, primarySession, primary, secondary);

  await closeAndClearBrowserSession(page, primarySession);
  const secondarySession = await login(page, secondary);
  await readContacts(page, secondarySession, secondary, primary);

  expect(blockedWrites).toEqual([]);
});

test("normaler synthetischer Nutzer bleibt aus Admin gesperrt und nach Logout ohne Sitzung", async ({
  page,
}) => {
  const blockedWrites = await installReadOnlyNetworkGuard(page);
  await login(page, primary);

  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin(?:\/|\?|$)/u);

  await page.goto("/logout");
  await expect(page).toHaveURL(`${appOrigin}/`);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login(?:\?|$)/u);

  expect(blockedWrites).toEqual([]);
});

test("freigegebener Staging-Admin erreicht Billing und Operations ausschließlich lesend", async ({
  page,
}) => {
  test.skip(
    !admin.email || !admin.password,
    "dedicated_staging_admin_credentials_not_configured",
  );
  requireAdminFixture();

  const blockedWrites = await installReadOnlyNetworkGuard(page);
  const session = await login(page, admin);

  await page.goto("/admin/billing");
  await expect(page).toHaveURL(`${appOrigin}/admin/billing`);
  await expect(
    page.getByText("Adminbereich", { exact: true }).first(),
  ).toBeVisible();

  await page.goto("/admin/operations");
  await expect(page).toHaveURL(`${appOrigin}/admin/operations`);
  await expect(
    page.getByRole("heading", { name: "Admin Operations Center" }),
  ).toBeVisible();

  await closeAndClearBrowserSession(page, session);
  expect(blockedWrites).toEqual([]);
});
