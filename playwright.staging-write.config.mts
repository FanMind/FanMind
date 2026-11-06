import { defineConfig, devices } from "@playwright/test";

const rawTarget = process.env.FANMIND_E2E_STAGING_URL?.trim() || "";
const rawSupabase =
  process.env.FANMIND_E2E_STAGING_SUPABASE_URL?.trim() || "";
const acknowledgement =
  process.env.FANMIND_E2E_STAGING_WRITE_ACK?.trim() || "";
const reviewedCommit =
  process.env.FANMIND_E2E_STAGING_REVIEWED_COMMIT?.trim() || "";
const githubSha = process.env.GITHUB_SHA?.trim() || "";
const STAGING_APP_ORIGIN = "https://staging.fanmind.ch";

let target: URL;
let supabase: URL;
try {
  target = new URL(rawTarget);
  supabase = new URL(rawSupabase);
} catch {
  throw new Error("staging_write_e2e_target_invalid");
}

const productionRef =
  process.env.FANMIND_E2E_STAGING_PRODUCTION_SUPABASE_REF?.trim() || "";
const supabaseRef = supabase.hostname.endsWith(".supabase.co")
  ? supabase.hostname.slice(0, -".supabase.co".length)
  : "";
if (
  target.origin !== STAGING_APP_ORIGIN ||
  supabase.protocol !== "https:" ||
  supabase.pathname !== "/" ||
  !supabaseRef ||
  !productionRef ||
  supabaseRef === productionRef.toLowerCase() ||
  acknowledgement !== "fanmind-staging-core-csv-write" ||
  !/^[0-9a-f]{40}$/u.test(reviewedCommit) ||
  reviewedCommit !== githubSha
) {
  throw new Error("staging_write_e2e_boundary_rejected");
}

export default defineConfig({
  testDir: "./e2e-staging-write",
  outputDir: "test-results/playwright-staging-write",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: target.origin,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
  },
});
