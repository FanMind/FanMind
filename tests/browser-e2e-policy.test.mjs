import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("Playwright stays exactly pinned and exposes separate public and staging commands", async () => {
  const manifest = JSON.parse(await read("package.json"));

  assert.equal(manifest.devDependencies?.["@playwright/test"], "1.62.1");
  assert.equal(
    manifest.scripts?.["test:e2e"],
    "playwright test --config=playwright.config.mts",
  );
  assert.equal(
    manifest.scripts?.["test:e2e:core-flow"],
    "playwright test --config=playwright.core-flow.config.mts",
  );
  assert.equal(
    manifest.scripts?.["test:e2e:staging"],
    "playwright test --config=playwright.staging.config.mts",
  );
  assert.match(
    manifest.scripts?.["test:operations"] ?? "",
    /tests\/browser-e2e-policy\.test\.mjs/u,
  );
});

test("local regular-user config starts only the acknowledged loopback fixture and real app", async () => {
  const source = await read("playwright.core-flow.config.mts");

  assert.match(source, /fanmind-local-synthetic-core-flow/u);
  assert.match(source, /http:\/\/localhost:3100/u);
  assert.match(source, /http:\/\/127\.0\.0\.1:54321/u);
  assert.match(
    source,
    /node scripts\/testing\/regular-user-core-flow-fixture\.mjs/u,
  );
  assert.match(source, /npm run start -- -H 127\.0\.0\.1 -p 3100/u);
  assert.match(source, /reuseExistingServer: false/u);
  assert.match(source, /workers: 1/u);
  assert.match(source, /devices\["Desktop Chrome"\]/u);
  assert.match(source, /serviceWorkers: "block"/u);
  assert.match(source, /trace: "retain-on-failure"/u);
  assert.match(source, /screenshot: "only-on-failure"/u);
  assert.match(source, /video: "off"/u);
  assert.doesNotMatch(source, /https:\/\/fanmind\.ch|firefox|webkit/iu);
});

test("local provider fixture is loopback-only, acknowledged and fail-closed", async () => {
  const source = await read(
    "scripts/testing/regular-user-core-flow-fixture.mjs",
  );

  assert.match(source, /FIXTURE_HOST = "127\.0\.0\.1"/u);
  assert.match(source, /FANMIND_CORE_FLOW_FIXTURE_ACK/u);
  assert.match(source, /fixture_ack_invalid/u);
  assert.match(source, /server\.listen\(port, FIXTURE_HOST\)/u);
  assert.match(source, /Access-Control-Allow-Origin/u);
  assert.equal(
    source.match(/new Set\(\[FIXTURE_SERVICE_ROLE_KEY\]\)/gu)?.length,
    2,
  );
  assert.doesNotMatch(source, /requestBoundaryAllowed/u);
  assert.doesNotMatch(source, /\^Bearer\\s\+/u);
  assert.match(source, /fixture_table_unknown/u);
  assert.match(source, /query_select_invalid/u);
  assert.match(source, /mutation_scope_invalid/u);
  assert.match(source, /fixture_write_role_invalid/u);
  assert.match(source, /workspace_ai_prompt_settings: new Set/u);
  assert.match(
    source,
    /workspace_ai_prompt_settings: new Set\(\["GET", "HEAD"\]\)/u,
  );
  assert.match(source, /followups:PATCH:completed/u);
  assert.match(source, /followups:PATCH:open/u);
  assert.doesNotMatch(source, /0\.0\.0\.0|https:\/\//u);
});

test("regular-user browser proof exercises real routes and permits only a synthetic AI response", async () => {
  const source = await read("e2e-core-flow/regular-user-core-flow.spec.ts");

  for (const route of [
    "/inbox",
    "/fans",
    "/followups",
    "/roadmap",
  ]) {
    assert.match(source, new RegExp(`page\\.goto\\("${route}"\\)`, "u"));
  }
  assert.equal(source.match(/route\.fulfill\(/gu)?.length, 1);
  assert.match(
    source,
    /requestUrl\.pathname === "\/api\/ai\/reply-suggestions"/u,
  );
  assert.match(source, /ancestor::article\[1\]/u);
  assert.match(
    source,
    /getByRole\("tabpanel"\)\.locator\("p"\)\.filter\(\{ hasText: MEMORY_CONTENT \}\)/u,
  );
  assert.match(source, /failedResponses[\s\S]*toEqual\(\[\]\)/u);
  assert.match(source, /pageErrors[\s\S]*toEqual\(\[\]\)/u);
  assert.match(source, /response\.status\(\) >= 400/u);
  assert.match(source, /unexpectedRequests[\s\S]*toEqual\(\[\]\)/u);
  assert.match(
    source,
    /Authorization: "Bearer fanmind-local-core-flow-service-role-key"/u,
  );
  assert.match(
    source,
    /conversation_messages:PATCH:seen_at[\s\S]*memories:POST[\s\S]*followups:POST[\s\S]*followups:PATCH:completed[\s\S]*followups:PATCH:open/u,
  );
  assert.doesNotMatch(
    source,
    /https:\/\/fanmind\.ch|OPENAI_API_KEY|STRIPE_SECRET_KEY|\/api\/demo\/start/u,
  );
});

test("Browser E2E runs the local core flow without environments, provider secrets or Production", async () => {
  const workflow = await read(".github/workflows/browser-e2e.yml");
  const jobStart = workflow.indexOf("  regular-user-core-flow-local:");
  const jobSource = workflow.slice(jobStart);

  assert.ok(jobStart >= 0);
  assert.match(jobSource, /Synthetic regular-user core flow on local providers/u);
  assert.match(jobSource, /NEXT_PUBLIC_SUPABASE_URL: http:\/\/127\.0\.0\.1:54321/u);
  assert.match(jobSource, /FANMIND_CORE_FLOW_FIXTURE_ACK: fanmind-local-synthetic-core-flow/u);
  assert.match(jobSource, /npm run test:e2e:core-flow/u);
  assert.match(jobSource, /npx playwright install --with-deps chromium/u);
  assert.match(jobSource, /playwright-report-core-flow/u);
  assert.match(jobSource, /retention-days: 7/u);
  assert.doesNotMatch(jobSource, /environment:|\$\{\{ secrets\.|OPENAI_API_KEY|STRIPE_SECRET_KEY|https:\/\/fanmind\.ch/u);
});

test("public browser config runs deterministic desktop and mobile Chromium with failure-only evidence", async () => {
  const source = await read("playwright.config.mts");

  assert.match(source, /baseURL[\s\S]*127\.0\.0\.1:3100/u);
  assert.match(source, /workers: 1/u);
  assert.match(source, /name: "desktop-chromium"/u);
  assert.match(source, /devices\["Desktop Chrome"\]/u);
  assert.match(source, /name: "mobile-chromium"/u);
  assert.match(source, /devices\["Pixel 7"\]/u);
  assert.match(source, /trace: "retain-on-failure"/u);
  assert.match(source, /screenshot: "only-on-failure"/u);
  assert.match(source, /video: "off"/u);
  assert.doesNotMatch(source, /firefox|webkit/iu);
});

test("public Browser E2E workflow is immutable, Chromium-only and read-only", async () => {
  const source = await read(".github/workflows/browser-e2e.yml");

  assert.match(
    source,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/u,
  );
  assert.match(
    source,
    /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/u,
  );
  assert.match(
    source,
    /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u,
  );
  assert.match(source, /permissions:\s*\n\s*contents: read/u);
  assert.doesNotMatch(source, /contents: write|write-all/u);
  assert.match(source, /npx playwright install --with-deps chromium/u);
  assert.doesNotMatch(source, /install[^\n]*(?:firefox|webkit)/iu);
  assert.match(source, /npm run test:e2e/u);
  assert.match(source, /retention-days: 7/u);
});

test("public browser spec uses synthetic responses and cannot create a demo or account", async () => {
  const source = await read("e2e/public-critical.spec.ts");

  assert.match(source, /e2e\.invalid@example\.com/u);
  assert.match(source, /e2e\.recovery@example\.com/u);
  assert.match(source, /auth\/v1\/token/u);
  assert.match(source, /auth\/v1\/recover/u);
  assert.match(source, /Demo-Bestätigung[\s\S]*startet aber keine Demo/u);
  assert.match(source, /geschütztes Dashboard führt ohne Sitzung zum Login/u);
  assert.doesNotMatch(source, /\/api\/demo\/start/u);
  assert.match(source, /context.route\("\*\*\/auth\/v1\/signup\*\*", \(route\) => route.abort\(\)\)/u);
  assert.match(source, /context.route\("\*\*\/auth\/v1\/resend\*\*", \(route\) => route.abort\(\)\)/u);
  assert.match(source, /fulfillCorsJson\(route, 200, \{ id: "synthetic-signup-user"/u);
  assert.doesNotMatch(source, /signUp/u);
  assert.doesNotMatch(
    source,
    /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/u,
  );
  assert.doesNotMatch(source, /https:\/\/fanmind\.ch/u);
});

test("staging config rejects Production and disables authenticated artifacts", async () => {
  const source = await read("playwright.staging.config.mts");

  assert.match(source, /FANMIND_E2E_STAGING_URL/u);
  assert.match(source, /fanmind-staging-readonly/u);
  assert.match(source, /target\.protocol !== "https:"/u);
  assert.match(source, /"fanmind\.ch", "www\.fanmind\.ch"/u);
  assert.match(source, /hostname[\s\S]*includes\("staging"\)/u);
  assert.match(source, /trace: "off"/u);
  assert.match(source, /screenshot: "off"/u);
  assert.match(source, /video: "off"/u);
  assert.doesNotMatch(source, /webServer:/u);
});

test("manual staging workflow uses the staging environment and never uploads session evidence", async () => {
  const source = await read(".github/workflows/browser-e2e-staging.yml");

  assert.match(source, /workflow_dispatch:/u);
  assert.doesNotMatch(source, /pull_request:|push:/u);
  assert.match(source, /if: github\.ref == 'refs\/heads\/main'/u);
  assert.match(source, /environment: staging/u);
  assert.match(source, /FANMIND_STAGING_E2E_EMAIL/u);
  assert.match(source, /FANMIND_STAGING_E2E_PASSWORD/u);
  assert.match(source, /FANMIND_STAGING_E2E_SECONDARY_EMAIL/u);
  assert.match(source, /FANMIND_STAGING_E2E_SECONDARY_PASSWORD/u);
  assert.match(source, /FANMIND_STAGING_E2E_WORKSPACE_ID/u);
  assert.match(source, /FANMIND_STAGING_E2E_CONTACT_ID/u);
  assert.match(source, /FANMIND_E2E_STAGING_SUPABASE_URL/u);
  assert.match(
    source,
    /FANMIND_E2E_STAGING_SUPABASE_URL: \$\{\{ secrets\.FANMIND_STAGING_SUPABASE_URL \}\}/u,
  );
  assert.doesNotMatch(source, /vars\.NEXT_PUBLIC_SUPABASE_URL/u);
  assert.match(source, /FANMIND_E2E_STAGING_PRODUCTION_SUPABASE_REF/u);
  assert.match(source, /permissions:\s*\n\s*contents: read/u);
  assert.doesNotMatch(source, /upload-artifact/u);
  assert.doesNotMatch(source, /contents: write|write-all/u);
  assert.match(source, /npx playwright install --with-deps chromium/u);
  assert.match(source, /npm run test:e2e:staging/u);
});

test("authenticated staging spec allows only auth session operations and exact-origin reads", async () => {
  const source = await read("e2e-staging/readonly-critical.spec.ts");

  assert.match(source, /isAuthSessionExchange/u);
  assert.match(source, /url\.pathname === "\/auth\/v1\/token"/u);
  assert.match(source, /isAppSessionSync/u);
  assert.match(source, /sameApp[\s\S]*method === "POST"[\s\S]*url\.pathname === "\/api\/auth\/session"/u);
  assert.match(source, /isExplicitLogout/u);
  assert.match(source, /url\.pathname === "\/auth\/v1\/logout"/u);
  assert.match(source, /closeAndClearBrowserSession/u);
  assert.match(source, /page\.request\.post\(logoutUrl\.toString\(\)/u);
  assert.match(source, /url\.origin === supabaseOrigin/u);
  assert.match(source, /url\.origin === appOrigin/u);
  assert.match(source, /\["GET", "HEAD", "OPTIONS"\]/u);
  assert.match(source, /route\.abort\("blockedbyclient"\)/u);
  assert.match(source, /blockedWrites[\s\S]*toEqual\(\[\]\)/u);
  assert.doesNotMatch(
    source,
    /\/api\/demo\/start|\/api\/ai|signUp|\.insert\(|\.update\(|\.delete\(/u,
  );
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/u);
});

test("authenticated staging spec proves bidirectional contact RLS, admin denial and logout", async () => {
  const source = await read("e2e-staging/readonly-critical.spec.ts");

  assert.match(source, /primarySession[\s\S]*readContacts/u);
  assert.match(source, /secondarySession[\s\S]*readContacts/u);
  assert.match(source, /id,workspace_id/u);
  assert.match(source, /rows\)\.toEqual\(\[/u);
  assert.match(source, /page\.goto\("\/admin"\)/u);
  assert.match(source, /not\.toHaveURL\(\/\\\/admin/u);
  assert.match(source, /page\.goto\("\/logout"\)/u);
  assert.match(source, /toHaveURL\(`\$\{appOrigin\}\/`\)/u);
  assert.match(source, /page\.goto\("\/dashboard"\)/u);
  assert.doesNotMatch(source, /service.role|SERVICE_ROLE/iu);
});

test("browser E2E runbook preserves existing test layers and external staging truth", async () => {
  const source = await read("docs/testing/BROWSER_E2E.md");

  assert.match(source, /ergänzt die bestehenden Unit-, Policy-, Build-, Public-Smoke- und Sprachprüfungen/u);
  assert.match(source, /startet keine öffentliche Demo/u);
  assert.match(source, /niemals `fanmind\.ch`/u);
  assert.match(source, /Jede andere POST-, PATCH-, PUT- oder DELETE-Anfrage wird browserseitig blockiert/u);
  assert.match(
    source,
    /erst ausgeführt, wenn die\s+getrennten externen Staging-Ressourcen vorhanden sind/u,
  );
  assert.match(source, /niemals auf Production ausweichen/u);
});

test("staging login targets the rendered accessible email field and stable password name", async () => {
  const source = await read("e2e-staging/readonly-critical.spec.ts");

  assert.match(
    source,
    /getByRole\("textbox", \{[\s\S]*name: "E-Mail",[\s\S]*exact: true,[\s\S]*\}\)/u,
  );
  assert.match(source, /locator\('input\[name="password"\]'\)/u);
  assert.doesNotMatch(source, /getByLabel\("(?:E-Mail|Passwort)"/u);
});

test("staging login arms its response waiter only after the form is ready", async () => {
  const source = await read("e2e-staging/readonly-critical.spec.ts");
  const loginStart = source.indexOf("async function login(");
  const loginEnd = source.indexOf("async function readContacts(", loginStart);
  const loginSource = source.slice(loginStart, loginEnd);
  const navigation = loginSource.indexOf('await page.goto("/login")');
  const emailReady = loginSource.indexOf("await expect(emailField).toBeVisible()");
  const responseWait = loginSource.indexOf("page.waitForResponse(");
  const submit = loginSource.indexOf(
    'page.getByRole("button", { name: /Einloggen/u }).click()',
  );

  assert.ok(loginStart >= 0 && loginEnd > loginStart);
  assert.ok(navigation >= 0);
  assert.ok(emailReady > navigation);
  assert.ok(responseWait > emailReady);
  assert.ok(submit > responseWait);
  assert.match(
    loginSource,
    /const \[response\] = await Promise\.all\(\[[\s\S]*page\.waitForResponse\([\s\S]*\.click\(\)[\s\S]*\]\);/u,
  );
});

test("dedicated Staging admin workflow is manual, commit-bound and read-only", async () => {
  const source = await read(".github/workflows/admin-e2e-staging.yml");

  assert.match(source, /workflow_dispatch:/u);
  assert.doesNotMatch(source, /pull_request:|push:/u);
  assert.match(source, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(source, /verify-staging-admin-readonly/u);
  assert.match(source, /environment: staging/u);
  assert.match(source, /FANMIND_STAGING_ADMIN_EMAILS/u);
  assert.match(source, /FANMIND_STAGING_ADMIN_E2E_EMAIL/u);
  assert.match(source, /FANMIND_STAGING_ADMIN_E2E_PASSWORD/u);
  assert.match(source, /FANMIND_STAGING_E2E_EMAIL/u);
  assert.match(source, /FANMIND_STAGING_E2E_SECONDARY_EMAIL/u);
  assert.match(source, /adminEmails\.includes\(normalizedAdmin\)/u);
  assert.match(source, /npm run test:e2e:staging/u);
  assert.match(source, /permissions:\s*\n\s*contents: read/u);
  assert.doesNotMatch(source, /upload-artifact/u);
  assert.doesNotMatch(source, /contents: write|write-all/u);
});

test("authenticated Staging spec separates admin credentials and proves both admin pages without writes", async () => {
  const source = await read("e2e-staging/readonly-critical.spec.ts");

  assert.match(source, /FANMIND_E2E_STAGING_ADMIN_EMAIL/u);
  assert.match(source, /FANMIND_E2E_STAGING_ADMIN_PASSWORD/u);
  assert.match(source, /configuredAdminEmails\.includes\(normalizedAdminEmail\)/u);
  assert.match(source, /page\.goto\("\/admin\/billing"\)/u);
  assert.match(source, /page\.goto\("\/admin\/operations"\)/u);
  assert.match(source, /Admin Operations Center/u);
  assert.match(source, /closeAndClearBrowserSession\(page, session\)/u);
  assert.match(
    source,
    /freigegebener Staging-Admin[\s\S]*blockedWrites[\s\S]*toEqual\(\[\]\)/u,
  );
  assert.doesNotMatch(
    source,
    /FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/u,
  );
});
