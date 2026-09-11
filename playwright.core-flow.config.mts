import { defineConfig, devices } from "@playwright/test";

const CORE_FLOW_ACK = "fanmind-local-synthetic-core-flow";
const APP_ORIGIN = "http://localhost:3100";
const FIXTURE_ORIGIN = "http://127.0.0.1:54321";

if (process.env.FANMIND_CORE_FLOW_FIXTURE_ACK !== CORE_FLOW_ACK) {
  throw new Error(
    "FANMIND_CORE_FLOW_FIXTURE_ACK must explicitly enable the local fixture",
  );
}

if (process.env.NEXT_PUBLIC_APP_URL !== APP_ORIGIN) {
  throw new Error(`NEXT_PUBLIC_APP_URL must equal ${APP_ORIGIN}`);
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL !== FIXTURE_ORIGIN) {
  throw new Error(`NEXT_PUBLIC_SUPABASE_URL must equal ${FIXTURE_ORIGIN}`);
}

export default defineConfig({
  testDir: "./e2e-core-flow",
  outputDir: "test-results/playwright-core-flow",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["line"],
    [
      "html",
      {
        outputFolder: "playwright-report-core-flow",
        open: "never",
      },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: APP_ORIGIN,
    actionTimeout: 10_000,
    navigationTimeout: 25_000,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
  },
  webServer: [
    {
      command: "node scripts/testing/regular-user-core-flow-fixture.mjs",
      url: `${FIXTURE_ORIGIN}/__health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        FANMIND_CORE_FLOW_FIXTURE_ACK: CORE_FLOW_ACK,
      },
    },
    {
      command: "npm run start -- -H 127.0.0.1 -p 3100",
      url: `${APP_ORIGIN}/api/version`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: "3100",
        // Isolated browser fixtures intercept both OAuth routes; these are not real apps.
        META_APP_ID: "fanmind-synthetic-meta-app",
        META_APP_SECRET: "fanmind-synthetic-meta-secret",
        INSTAGRAM_REDIRECT_URI: `${APP_ORIGIN}/api/integrations/instagram/callback`,
        FACEBOOK_REDIRECT_URI: `${APP_ORIGIN}/api/integrations/facebook/callback`,
        FANMIND_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      },
    },
  ],
});
