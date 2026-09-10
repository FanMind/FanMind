import { expect, test, type Page, type Route } from "@playwright/test";

const E2E_BASE_URL = "http://127.0.0.1:3100";
const META_PIXEL_ID = "2069553844439892";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function fulfillCorsJson(
  route: Route,
  status: number,
  payload: Record<string, unknown>,
) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, apikey, content-type",
        "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      },
    });
    return;
  }

  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    },
    body: JSON.stringify(payload),
  });
}

async function metaQueue(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => {
    const queue = window.fbq?.queue ?? [];
    return Array.from(queue, (entry) => Array.from(entry as ArrayLike<unknown>));
  });
}

test.describe("öffentliche kritische FanMind-Flows", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "fanmind_marketing_consent",
        value: "denied",
        url: E2E_BASE_URL,
        sameSite: "Lax",
      },
    ]);
  });

  test("deutsche Landingpage zeigt aktive Kernfunktion und Human-in-the-loop-Grenze", async ({
    page,
  }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("KI-Antwortvorschläge", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText(/Keine automatische Sendefunktion|Du prüfst, kopierst und sendest selbst/u).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Registrieren|Zugang/u }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Meta Pixel bleibt ohne Consent aus und sendet deduplizierte PageViews erst nach Opt-in", async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    let metaScriptRequests = 0;
    await context.route(
      "https://connect.facebook.net/en_US/fbevents.js",
      async (route) => {
        metaScriptRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "window.__fanmindSyntheticMetaScriptLoaded=true;",
        });
      },
    );

    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: "Nur notwendige" }),
    ).toBeVisible();
    expect(metaScriptRequests).toBe(0);
    expect(await page.evaluate(() => typeof window.fbq)).toBe("undefined");

    await page.getByRole("button", { name: "Nur notwendige" }).click();
    await expect(
      page.getByRole("button", { name: "Datenschutz-Einstellungen" }),
    ).toBeVisible();
    expect(metaScriptRequests).toBe(0);

    await page
      .getByRole("button", { name: "Datenschutz-Einstellungen" })
      .click();
    await page.getByRole("button", { name: "Marketing erlauben" }).click();

    await expect.poll(() => metaScriptRequests).toBe(1);
    await expect.poll(async () => {
      const current = await metaQueue(page);
      return current.filter(
        ([command, value]) => command === "track" && value === "PageView",
      ).length;
    }).toBe(1);

    let calls = await metaQueue(page);
    expect(
      calls.filter(
        ([command, value]) => command === "init" && value === META_PIXEL_ID,
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([command, setting, enabled, pixelId]) =>
          command === "set" &&
          setting === "autoConfig" &&
          enabled === false &&
          pixelId === META_PIXEL_ID,
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([command, value]) => command === "track" && value === "PageView",
      ),
    ).toHaveLength(1);
    const eventCalls = calls.filter(([command]) =>
      ["init", "track", "consent"].includes(String(command)),
    );
    expect(eventCalls.every((call) => call.length === 2)).toBe(true);

    await page
      .getByRole("button", { name: "Datenschutz-Einstellungen" })
      .click();
    await page
      .getByRole("link", { name: "Details in der Datenschutzerklärung" })
      .click();
    await expect(page).toHaveURL(/\/datenschutz#marketing-messung$/u);
    await expect.poll(async () => {
      const current = await metaQueue(page);
      return current.filter(
        ([command, value]) => command === "track" && value === "PageView",
      ).length;
    }).toBe(2);

    await page.getByRole("button", { name: "Marketing erlauben" }).click();
    calls = await metaQueue(page);
    expect(metaScriptRequests).toBe(1);
    expect(
      calls.filter(
        ([command, value]) => command === "init" && value === META_PIXEL_ID,
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([command, setting, enabled, pixelId]) =>
          command === "set" &&
          setting === "autoConfig" &&
          enabled === false &&
          pixelId === META_PIXEL_ID,
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([command, value]) => command === "track" && value === "PageView",
      ),
    ).toHaveLength(2);

    await page
      .getByRole("button", { name: "Datenschutz-Einstellungen" })
      .click();
    await page.getByRole("button", { name: "Nur notwendige" }).click();
    await page.goto("/register");
    expect(metaScriptRequests).toBe(1);
    await expectNoHorizontalOverflow(page);

    await context.clearCookies();
    await context.addCookies([
      {
        name: "fanmind_marketing_consent",
        value: "granted",
        url: E2E_BASE_URL,
        sameSite: "Lax",
      },
    ]);
    const unsafePage = await context.newPage();
    await unsafePage.goto(
      "/login?returnTo=%2Ffans%2Fsynthetic-contact-reference",
    );
    expect(metaScriptRequests).toBe(1);
    expect(await unsafePage.evaluate(() => typeof window.fbq)).toBe("undefined");
    await expect(
      unsafePage.getByRole("button", { name: "Datenschutz-Einstellungen" }),
    ).toHaveCount(0);
    await unsafePage.close();
  });

  test("englische Landingpage bleibt übersetzt und manuell freigegeben", async ({ page }) => {
    const response = await page.goto("/?lang=en");

    expect(response?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
    await expect(
      page.getByText(
        /AI suggestions remain suggestions: a human reviews and approves them|no automatic sending/iu,
      ).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Login zeigt Passwort sicher an und normalisiert ungültige Zugangsdaten", async ({
    page,
  }) => {
    await page.route("**/auth/v1/token**", (route) =>
      fulfillCorsJson(route, 400, {
        error: "invalid_grant",
        error_description: "Invalid login credentials",
        msg: "Invalid login credentials",
      }),
    );

    const response = await page.goto("/login");
    expect(response?.ok()).toBe(true);

    const email = page.locator('input[name="email"]');
    const password = page.locator('input[name="password"]');
    await expect(email).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");

    const showPassword = page.getByRole("button", { name: "Passwort anzeigen" });
    await showPassword.click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Passwort verbergen" }).click();
    await expect(password).toHaveAttribute("type", "password");

    await email.fill("e2e.invalid@example.com");
    await password.fill("Synthetic-Invalid-Password-2026");
    await page.getByRole("button", { name: /Einloggen/u }).click();

    await expect(page.locator('form [role="alert"]')).toContainText(
      "Login nicht möglich",
    );
    await expect(page).toHaveURL(/\/login(?:\?|$)/u);
    await expectNoHorizontalOverflow(page);
  });

  test("Demo-Bestätigung ist tastaturbedienbar, startet aber keine Demo", async ({ page }) => {
    await page.goto("/login");

    const trigger = page.getByRole("button", { name: "Kostenlos testen" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Demo jetzt starten?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("60 Minuten");
    await expect(page.getByRole("button", { name: "Demo starten" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test("Passwort-Reset meldet synthetischen Erfolg ohne Konto-Offenlegung", async ({ page }) => {
    let redirectTo: string | null = null;
    await page.route("**/auth/v1/recover**", async (route) => {
      if (route.request().method() === "POST") {
        redirectTo = new URL(route.request().url()).searchParams.get("redirect_to");
      }
      await fulfillCorsJson(route, 200, {});
    });

    await page.goto("/forgot-password");
    await page
      .locator('input[name="email"]')
      .fill("e2e.recovery@example.com");
    await page.getByRole("button", { name: "Link senden" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Falls ein Konto mit dieser E-Mail existiert",
    );
    await expect(page.locator('form [role="alert"]')).toHaveCount(0);
    expect(redirectTo).toBe(`${E2E_BASE_URL}/reset-password`);
    await expectNoHorizontalOverflow(page);
  });

  test("Recovery entfernt Tokens vor der Benutzerprüfung und speichert erst nach Bestätigung", async ({ page }) => {
    const token = "synthetic-recovery-access-token";
    let releaseUserCheck!: () => void;
    const userCheckGate = new Promise<void>((resolve) => { releaseUserCheck = resolve; });
    let userChecks = 0;
    let passwordUpdates = 0;
    await page.route("**/auth/v1/user", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        userChecks += 1;
        expect(request.headers().authorization).toBe(`Bearer ${token}`);
        await userCheckGate;
      }
      if (request.method() === "PUT") {
        passwordUpdates += 1;
        expect(request.headers().authorization).toBe(`Bearer ${token}`);
        expect(request.postDataJSON()).toEqual({ password: "Synthetic-New-Password-2026" });
      }
      await fulfillCorsJson(route, 200, { id: "synthetic-recovery-user" });
    });
    await page.route("**/api/auth/logout", (route) => fulfillCorsJson(route, 200, {}));

    try {
      await page.goto(`/reset-password?lang=en#access_token=${token}&refresh_token=synthetic-refresh&type=recovery&token_type=bearer`);
      await expect.poll(() => userChecks).toBeGreaterThan(0);
      await expect(page).toHaveURL(`${E2E_BASE_URL}/reset-password?lang=en`);
      await expect(page.getByRole("status")).toHaveText("Checking your reset link…");
      await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
      expect(passwordUpdates).toBe(0);
    } finally {
      releaseUserCheck();
    }

    const passwords = page.locator('input[autocomplete="new-password"]');
    await expect(passwords).toHaveCount(2);
    await passwords.nth(0).fill("Synthetic-New-Password-2026");
    await passwords.nth(1).fill("Synthetic-New-Password-2026");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("status")).toContainText("Your password has been changed");
    expect(passwordUpdates).toBe(1);
    await expect(passwords).toHaveCount(0);
    await expect(page).toHaveURL(`${E2E_BASE_URL}/reset-password?lang=en`);
  });

  test("Recovery lehnt falsche Linktypen, doppelte Tokens und Providerfehler ohne Auth-Aufruf ab", async ({ page }) => {
    let authRequests = 0;
    await page.route("**/auth/v1/**", async (route) => {
      authRequests += 1;
      await fulfillCorsJson(route, 401, { message: "synthetic unexpected request" });
    });
    const invalidCallbacks = [
      "#access_token=synthetic&type=signup",
      "#access_token=synthetic&type=recovery&access_token=second",
      "#access_token=synthetic&type=recovery&error_description=synthetic-private-error",
      "?access_token=synthetic&type=recovery",
      "?code=synthetic#access_token=synthetic&type=recovery",
    ];
    for (const callback of invalidCallbacks) {
      await page.goto(`/reset-password${callback}`);
      await expect(page.locator('form [role="alert"]')).toContainText("Der Link ist ungültig oder abgelaufen");
      await expect(page).toHaveURL(`${E2E_BASE_URL}/reset-password`);
      await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("synthetic-private-error");
    }
    expect(authRequests).toBe(0);
  });

  test("Ein neuer ungültiger Recovery-Link entfernt eine bereits bestätigte Sitzung", async ({ page }) => {
    let userChecks = 0;
    await page.route("**/auth/v1/user", async (route) => {
      if (route.request().method() === "GET") userChecks += 1;
      await fulfillCorsJson(route, 200, { id: "synthetic-first-user" });
    });
    await page.goto("/reset-password#access_token=synthetic-first&type=recovery");
    const passwords = page.locator('input[autocomplete="new-password"]');
    await expect(passwords).toHaveCount(2);
    await passwords.nth(0).fill("Synthetic-Unsubmitted-Password");
    const checksBeforeChange = userChecks;
    // Same-document fragment navigation deliberately keeps the component mounted.
    await page.goto("/reset-password#access_token=synthetic-second&type=signup");
    await expect(page.locator('form [role="alert"]')).toContainText("Der Link ist ungültig oder abgelaufen");
    await expect(passwords).toHaveCount(0);
    await expect(page).toHaveURL(`${E2E_BASE_URL}/reset-password`);
    expect(userChecks).toBe(checksBeforeChange);
  });

  test("Eine verspätete Benutzerprüfung kann einen neu geöffneten ungültigen Link nicht freischalten", async ({ page }) => {
    let releaseUserCheck!: () => void;
    const gate = new Promise<void>((resolve) => { releaseUserCheck = resolve; });
    let userChecks = 0;
    await page.route("**/auth/v1/user", async (route) => {
      if (route.request().method() === "GET") {
        userChecks += 1;
        await gate;
      }
      await fulfillCorsJson(route, 200, { id: "synthetic-late-user" });
    });
    const oldResponse = page.waitForResponse((response) =>
      response.url().endsWith("/auth/v1/user") && response.request().method() === "GET",
    );
    try {
      await page.goto("/reset-password#access_token=synthetic-pending&type=recovery");
      await expect.poll(() => userChecks).toBeGreaterThan(0);
      await page.goto("/reset-password#access_token=synthetic-new&type=signup");
      await expect(page.locator('form [role="alert"]')).toContainText("Der Link ist ungültig oder abgelaufen");
    } finally {
      releaseUserCheck();
    }
    await (await oldResponse).finished();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
    await expect(page.locator('form [role="alert"]')).toContainText("Der Link ist ungültig oder abgelaufen");
    await expect(page).toHaveURL(`${E2E_BASE_URL}/reset-password`);
  });

  for (const scenario of ["expired", "missing-user", "network-error"] as const) {
    test(`Recovery bleibt bei ${scenario} ohne Passwortformular`, async ({ page }) => {
      await page.route("**/auth/v1/user", async (route) => {
        if (scenario === "network-error" && route.request().method() !== "OPTIONS") {
          await route.abort("failed");
          return;
        }
        await fulfillCorsJson(route, scenario === "expired" ? 401 : 200,
          scenario === "expired" ? { message: "JWT expired" } : {});
      });
      await page.goto("/reset-password#access_token=synthetic&type=recovery");
      await expect(page.locator('form [role="alert"]')).toContainText("Der Link ist ungültig oder abgelaufen");
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
      await expect(page).toHaveURL(`${E2E_BASE_URL}/reset-password`);
    });
  }

  test("Recovery meldet einen fehlgeschlagenen Speicherversuch und erlaubt einen bewussten erneuten Versuch", async ({ page }) => {
    let passwordUpdates = 0;
    await page.route("**/auth/v1/user", async (route) => {
      if (route.request().method() === "PUT") {
        passwordUpdates += 1;
        if (passwordUpdates === 1) {
          await route.abort("failed");
          return;
        }
      }
      await fulfillCorsJson(route, 200, { id: "synthetic-recovery-user" });
    });
    await page.route("**/api/auth/logout", (route) => fulfillCorsJson(route, 200, {}));
    await page.goto("/reset-password#access_token=synthetic&type=recovery");
    const passwords = page.locator('input[autocomplete="new-password"]');
    await expect(passwords).toHaveCount(2);
    await passwords.nth(0).fill("Synthetic-New-Password-2026");
    await passwords.nth(1).fill("Synthetic-New-Password-2026");
    const save = page.getByRole("button", { name: "Passwort speichern" });
    await save.click();
    await expect(page.locator('form [role="alert"]')).toContainText("Das Passwort konnte gerade nicht gespeichert werden");
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(save).toBeEnabled();
    expect(passwordUpdates).toBe(1);
    await save.click();
    await expect(page.getByRole("status")).toContainText("Dein Passwort wurde geändert");
    expect(passwordUpdates).toBe(2);
    await expect(page.locator('form [role="alert"]')).toHaveCount(0);
  });

  test("öffentliche Account-Löschressource führt direkt zum authentifizierten Gesamtprozess", async ({
    page,
  }) => {
    const response = await page.goto("/account-deletion");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "FanMind-Account vollständig löschen" }),
    ).toBeVisible();
    await expect(page.getByText(/bloße Deaktivierung ist nicht/iu)).toBeVisible();
    await expect(page.getByText(/maximale Bearbeitungsfrist.*30 Tage/iu)).toBeVisible();
    const deletionLink = page.getByRole("link", {
      name: "Anmelden und Löschung einleiten",
    });
    await expect(deletionLink).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fsettings%2Faccount-deletion",
    );
    await expectNoHorizontalOverflow(page);
  });

  test("entgeltliche Registrierung bleibt bis zur bestätigten Zahlungsbedingungen-Version geschlossen", async ({
    page,
  }) => {
    await page.goto("/register");

    await expect(
      page.getByRole("heading", {
        name: "Entgeltliche Aktivierung ist vorübergehend nicht verfügbar",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/verbindliche Version der Zahlungsbedingungen/u),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Kostenlose Demo starten" }),
    ).toHaveAttribute("href", "/login?demo=1");
    await expect(
      page.getByRole("link", { name: "Bestehenden Zugang öffnen" }),
    ).toHaveAttribute("href", "/login");
    await expect(
      page.getByText("payment_terms_version_unresolved", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveCount(0);
    const pausedPrices = page.locator(
      '[aria-label="Preise der Starter-Pakete"]',
    );
    await expect(
      pausedPrices.getByText("Starter Flex", { exact: true }),
    ).toBeVisible();
    await expect(
      pausedPrices.getByText("990 € Setup + 312 €/Monat", { exact: true }),
    ).toBeVisible();
    await expect(
      pausedPrices.getByText("Starter 12", { exact: true }),
    ).toBeVisible();
    await expect(
      pausedPrices.getByText("0 € Setup + 312 €/Monat", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("geschütztes Dashboard führt ohne Sitzung zum Login zurück", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login(?:\?|$)/u);
    await expect(page.locator('section[aria-label="FanMind Login"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
