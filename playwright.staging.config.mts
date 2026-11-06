import { defineConfig, devices } from "@playwright/test";

const rawTarget = process.env.FANMIND_E2E_STAGING_URL?.trim() || "";
const acknowledgement = process.env.FANMIND_E2E_STAGING_ACK?.trim() || "";

let target: URL;
try {
  target = new URL(rawTarget);
} catch {
  throw new Error("staging_e2e_target_invalid");
}

if (
  target.protocol !== "https:" ||
  ["fanmind.ch", "www.fanmind.ch"].includes(target.hostname.toLowerCase()) ||
  !target.hostname.toLowerCase().includes("staging") ||
  acknowledgement !== "fanmind-staging-readonly"
) {
  throw new Error("staging_e2e_boundary_rejected");
}

export default defineConfig({
  testDir: "./e2e-staging",
  outputDir: "test-results/playwright-staging",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: target.origin,
    actionTimeout: 12_000,
    navigationTimeout: 25_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
  },
});
