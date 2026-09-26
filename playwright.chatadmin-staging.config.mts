import { defineConfig, devices } from "@playwright/test";

const env=process.env;
const target=env.NEXT_PUBLIC_APP_URL;
const ref=env.FANMIND_TARGET_SUPABASE_PROJECT_REF ?? "";
const production=env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF ?? "";
if(target!=="https://staging.fanmind.ch" || env.FANMIND_TARGET_API_ORIGIN!==target ||
   env.FANMIND_RUNTIME_ENVIRONMENT!=="staging" || env.GITHUB_REF!=="refs/heads/main" ||
   !/^[0-9a-f]{40}$/u.test(env.GITHUB_SHA ?? "") || env.GITHUB_SHA!==env.FANMIND_CHAT_ADMIN_REVIEWED_COMMIT ||
   env.NEXT_PUBLIC_SUPABASE_URL!==`https://${ref}.supabase.co` ||
   !["probe","acceptance"].includes(env.FANMIND_CHAT_ADMIN_BROWSER_MODE??"") ||
   !/^[a-z0-9]{8,64}$/u.test(ref) || !/^[a-z0-9]{8,64}$/u.test(production) || ref===production ||
   env.FANMIND_CHAT_ADMIN_MANUAL_CONFIRM!=="run-chat-admin-manual-flow" ||
   env.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=="true" || env.FANMIND_NON_PRODUCTION_WRITE_ACK!=="I_UNDERSTAND_NON_PRODUCTION_ONLY") {
  throw new Error("chat_admin_manual_browser_boundary");
}
export default defineConfig({
  testDir:"./e2e-chatadmin-staging", outputDir:"test-results/chatadmin-staging",
  fullyParallel:false,forbidOnly:true,retries:0,workers:1,timeout:180_000,
  expect:{timeout:15_000}, reporter:[["line"]],
  use:{...devices["Desktop Chrome"],baseURL:target,actionTimeout:15_000,navigationTimeout:30_000,
    trace:"off",screenshot:"off",video:"off",locale:"de-CH",timezoneId:"Europe/Zurich",
    permissions:["clipboard-read","clipboard-write"],serviceWorkers:"block"},
});
