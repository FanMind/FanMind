import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);
const scriptPath = "scripts/staging-readiness-preflight.mjs";
const workflowPath = ".github/workflows/staging-readiness.yml";
const runbookPath = "docs/operations/STAGING_PROVISIONING.md";
const roadmapPath = "src/config/roadmap.ts";
const versionRoutePath = "src/app/api/version/route.ts";
const smokePath = "scripts/smoke-public-routes.mjs";

const stagingSecrets = {
  anon: "anon_value_1234567890",
  service: "service_value_1234567890",
  stripe: "sk_test_SyntheticOnly1234567890",
  webhook: "whsec_SyntheticOnly1234567890",
  sharedRateLimit: "synthetic_shared_rate_limit_secret_1234567890",
};

function stagingEnvironment(overrides = {}) {
  return {
    ...process.env,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SITE_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stagingSecrets.anon,
    SUPABASE_SERVICE_ROLE_KEY: stagingSecrets.service,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    STRIPE_SECRET_KEY: stagingSecrets.stripe,
    STRIPE_WEBHOOK_SECRET: stagingSecrets.webhook,
    FANMIND_TAX_MODE: "stripe_tax",
    FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED: "true",
    OPENAI_API_KEY: "",
    FANMIND_SHARED_RATE_LIMIT_SECRET: stagingSecrets.sharedRateLimit,
    FANMIND_ENABLE_REFERRAL_BILLING: "false",
    FANMIND_PUBLIC_DEMO_ENABLED: "false",
    FANMIND_ENABLE_TELEGRAM_SEND: "false",
    FANMIND_OPERATIONS_EMAIL_ENABLED: "false",
    FANMIND_SERVER_ERROR_EMAIL_ENABLED: "false",
    ...overrides,
  };
}

async function read(path) {
  return readFile(path, "utf8");
}

test("staging readiness remains fail-closed and test-mode only", async () => {
  const [script, workflow, versionRoute, smoke] = await Promise.all([
    read(scriptPath),
    read(workflowPath),
    read(versionRoutePath),
    read(smokePath),
  ]);

  assert.match(script, /FANMIND_RUNTIME_ENVIRONMENT muss staging sein/);
  assert.match(script, /isStripeTestSecretKey/);
  assert.match(script, /FANMIND_ENABLE_NON_PRODUCTION_WRITES/);
  assert.match(script, /FANMIND_ENABLE_REFERRAL_BILLING/);
  assert.match(script, /FANMIND_TARGET_SUPABASE_PROJECT_REF/);
  assert.match(script, /Supabase-URL und explizite Staging-Zielreferenz müssen exakt übereinstimmen/);
  assert.match(script, /STAGING_SUPABASE_REF_BINDING/);
  assert.match(script, /STAGING_READINESS=OK/);
  assert.match(script, /FANMIND_SHARED_RATE_LIMIT_SECRET muss mindestens 32 Zeichen lang sein/);

  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/);
  assert.match(workflow, /FANMIND_ENABLE_REFERRAL_BILLING: 'false'/);
  assert.match(workflow, /Prepare ephemeral read-only rate-limit probe/);
  assert.match(workflow, /randomBytes\(32\)/);
  assert.match(workflow, /::add-mask::\$value/);
  assert.match(
    workflow,
    /printf 'FANMIND_SHARED_RATE_LIMIT_SECRET=%s\\n' "\$value" >> "\$GITHUB_ENV"/,
  );
  assert.doesNotMatch(
    workflow,
    /FANMIND_SHARED_RATE_LIMIT_SECRET:\s*\$\{\{\s*secrets\./u,
  );
  assert.match(
    workflow,
    /FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED: \$\{\{ vars\.FANMIND_STAGING_STRIPE_TAX_REGISTRATION_CONFIRMED \}\}/u,
  );
  assert.match(workflow, /npm run staging:preflight/);
  assert.match(
    workflow,
    /FANMIND_EXPECTED_RELEASE_COMMIT: \$\{\{ github\.sha \}\}/,
  );
  assert.match(workflow, /FANMIND_EXPECTED_RUNTIME_ENVIRONMENT: staging/);
  assert.match(workflow, /npm run smoke:public/);
  assert.match(versionRoute, /FANMIND_RUNTIME_ENVIRONMENT/);
  assert.match(versionRoute, /KNOWN_RUNTIME_ENVIRONMENTS/);
  assert.match(versionRoute, /runtimeEnvironment/);
  assert.match(smoke, /FANMIND_EXPECTED_RUNTIME_ENVIRONMENT/);
  assert.match(smoke, /validateVersionPayload/);
});

test("staging readiness accepts a restricted Stripe test key", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath],
    {
      env: stagingEnvironment({
        STRIPE_SECRET_KEY: "rk_test_SyntheticRestricted1234567890",
      }),
    },
  );
  assert.match(`${stdout}\n${stderr}`, /STAGING_STRIPE_MODE=test/);
});

test("staging readiness accepts an exact URL-to-target binding without exposing values", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath],
    { env: stagingEnvironment() },
  );
  const output = `${stdout}\n${stderr}`;

  assert.match(output, /STAGING_RUNTIME=staging/);
  assert.match(output, /STAGING_APP_TARGET=separate/);
  assert.match(output, /STAGING_SUPABASE_TARGET=separate/);
  assert.match(output, /STAGING_SUPABASE_REF_BINDING=matching/);
  assert.match(output, /STAGING_STRIPE_MODE=test/);
  assert.match(output, /STAGING_STRIPE_TAX=ready/);
  assert.match(output, /STAGING_SHARED_RATE_LIMIT=ready/);
  assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/);
  assert.match(output, /STAGING_READINESS=OK/);

  for (const value of Object.values(stagingSecrets)) {
    assert.doesNotMatch(output, new RegExp(value));
  }
  assert.doesNotMatch(output, /stagingref12345|productionref123/);
});

test("staging readiness rejects a missing shared rate-limit secret", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [scriptPath],
      {
        env: stagingEnvironment({ FANMIND_SHARED_RATE_LIMIT_SECRET: "" }),
      },
    ),
    (error) => {
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      assert.match(output, /STAGING_SHARED_RATE_LIMIT=blocked/);
      assert.match(output, /FANMIND_SHARED_RATE_LIMIT_SECRET muss mindestens 32 Zeichen lang sein/);
      return true;
    },
  );
});

test("staging readiness rejects a mismatched explicit target without exposing values", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [scriptPath],
      {
        env: stagingEnvironment({
          FANMIND_TARGET_SUPABASE_PROJECT_REF: "differentref123",
        }),
      },
    ),
    (error) => {
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      assert.match(output, /STAGING_SUPABASE_REF_BINDING=invalid/);
      assert.match(output, /Supabase-URL und explizite Staging-Zielreferenz müssen exakt übereinstimmen/);
      assert.doesNotMatch(output, /stagingref12345|differentref123|productionref123/);
      for (const value of Object.values(stagingSecrets)) {
        assert.doesNotMatch(output, new RegExp(value));
      }
      return true;
    },
  );
});

test("staging runbook forbids production data and documents external dependencies", async () => {
  const runbook = await read(runbookPath);

  assert.match(runbook, /ausschließlich synthetische Kontakte/);
  assert.match(runbook, /keine Live-Kunden/);
  assert.match(runbook, /exakt der Projektreferenz in der Supabase-URL entsprechen/);
  assert.match(runbook, /runtimeEnvironment.*staging/);
  assert.match(runbook, /maskierten,\s+kurzlebigen Rate-Limit-Prüfwert/u);
  assert.match(runbook, /niemals das root-verwaltete\s+Laufzeit-Secret/u);
  assert.match(runbook, /Shared-Rate-Limit-Komponente\s+gesund meldet/u);
  assert.match(runbook, /ersetzt nicht die vollständige externe Laufzeitabnahme/);
  assert.match(runbook, /Produktions- und Testdaten trennen/);
});

test("roadmap only checks work that is actually complete", async () => {
  const roadmap = await read(roadmapPath);

  assert.match(roadmap, /label: "Operations-Grundlage", state: "done", status: "Produktiv aktiv"/);
  assert.match(roadmap, /label: "Release-Checks", state: "done", status: "Automatisch aktiv"/);
  assert.match(roadmap, /label: "Umgebungs-Governance", state: "done", status: "Fail-closed aktiv"/);
  assert.match(roadmap, /label: "Produktionsfreigabe", state: "done", status: "Erledigt"/);
  assert.match(roadmap, /label: "Finaler Go-Live-Smoke-Test", state: "done", status: "Erledigt"/);
  assert.match(roadmap, /label: "Produktions- und Testdaten trennen", state: "done", status: "Getrenntes Staging abgenommen"/);
  assert.match(roadmap, /label: "Vollständiger Restore-Test", state: "partial"/);
  assert.doesNotMatch(roadmap, /Steuerberater-Bestätigung/);
});
