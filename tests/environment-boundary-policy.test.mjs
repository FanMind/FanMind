import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import "./data-environment-boundary.spec.mjs";
import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
  normalizeHostname,
  supabaseProjectRefFromUrl,
} from "../src/lib/environmentBoundaryPolicy.mjs";

const deployWorkflow = await readFile(new URL("../.github/workflows/deploy-fanmind.yml", import.meta.url), "utf8");
const stagingTemplate = await readFile(new URL("../.env.staging.example", import.meta.url), "utf8");
const preflightSource = await readFile(new URL("../scripts/environment-boundary-preflight.mjs", import.meta.url), "utf8");

const productionEnvironment = {
  FANMIND_RUNTIME_ENVIRONMENT: "production",
  NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
  NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
};

const stagingEnvironment = {
  FANMIND_RUNTIME_ENVIRONMENT: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
  FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
};

test("read-only Production must match the Production hostname and Supabase project", () => {
  const result = evaluateEnvironmentBoundary(productionEnvironment);
  assert.equal(result.ok, true);
  assert.equal(result.runtimeEnvironment, "production");
  assert.equal(result.appProduction, true);
  assert.equal(result.supabaseProductionMatch, true);
  assert.equal(result.writesEnabled, false);
});

test("production hostname comparison canonicalizes trailing dots", () => {
  assert.equal(normalizeHostname("FanMind.CH."), "fanmind.ch");
  assert.equal(normalizeHostname("www.fanmind.ch..."), "www.fanmind.ch");

  const production = evaluateEnvironmentBoundary({
    ...productionEnvironment,
    NEXT_PUBLIC_APP_URL: "https://fanmind.ch.",
  });
  assert.equal(production.ok, true);
  assert.equal(production.appProduction, true);

  const unsafeWrite = evaluateEnvironmentBoundary(
    {
      ...stagingEnvironment,
      NEXT_PUBLIC_APP_URL: "https://www.fanmind.ch.",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );
  assert.equal(unsafeWrite.ok, false);
  assert.equal(unsafeWrite.appProduction, true);
  assert.match(unsafeWrite.errors.join("\n"), /fanmind\.ch/);
});

test("read-only staging is accepted but remains write-disabled", () => {
  const result = evaluateEnvironmentBoundary(stagingEnvironment);
  assert.equal(result.ok, true);
  assert.equal(result.runtimeEnvironment, "staging");
  assert.equal(result.appProduction, false);
  assert.equal(result.supabaseProductionMatch, false);
  assert.match(result.warnings.join("\n"), /Schreibzugriff bleibt/);
});

test("read-only preflight rejects a stale non-production write gate", () => {
  const result = evaluateEnvironmentBoundary({
    ...stagingEnvironment,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Read-only Preflight/);
});

test("write mode rejects Production, missing acknowledgement and the Production database", () => {
  const result = evaluateEnvironmentBoundary(
    {
      ...productionEnvironment,
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    },
    { allowWrite: true },
  );
  assert.equal(result.ok, false);
  const message = result.errors.join("\n");
  assert.match(message, /staging oder test/);
  assert.match(message, /Bestätigung|WRITE_ACK|NON_PRODUCTION_WRITE_ACK/);
  assert.match(message, /fanmind\.ch/);
  assert.match(message, /Production-Supabase-Projekt/);
});

test("write mode requires two explicit gates and a distinct staging project", () => {
  const missingGates = evaluateEnvironmentBoundary(stagingEnvironment, { allowWrite: true });
  assert.equal(missingGates.ok, false);
  assert.match(missingGates.errors.join("\n"), /ENABLE_NON_PRODUCTION_WRITES/);
  assert.match(missingGates.errors.join("\n"), /NON_PRODUCTION_WRITE_ACK/);

  const allowed = evaluateEnvironmentBoundary(
    {
      ...stagingEnvironment,
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );
  assert.equal(allowed.ok, true);
  assert.equal(allowed.mode, "non-production-write");
  assert.equal(allowed.supabaseProductionMatch, false);
});

test("write mode fails when Production project reference is missing or equal", () => {
  const missingProductionRef = evaluateEnvironmentBoundary(
    {
      ...stagingEnvironment,
      FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );
  assert.equal(missingProductionRef.ok, false);
  assert.match(missingProductionRef.errors.join("\n"), /PRODUCTION_SUPABASE_PROJECT_REF/);

  const productionMatch = evaluateEnvironmentBoundary(
    {
      ...stagingEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );
  assert.equal(productionMatch.ok, false);
  assert.equal(productionMatch.supabaseProductionMatch, true);
});

test("non-production runtime cannot point to fanmind.ch even read-only", () => {
  const result = evaluateEnvironmentBoundary({
    ...stagingEnvironment,
    NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Nicht-produktive Umgebungen/);
});

test("Supabase refs are parsed only from standard project URLs", () => {
  assert.equal(supabaseProjectRefFromUrl("https://abcdefgh12345678.supabase.co"), "abcdefgh12345678");
  assert.equal(supabaseProjectRefFromUrl("https://abcdefgh12345678.supabase.co."), "abcdefgh12345678");
  assert.equal(supabaseProjectRefFromUrl("https://db.example.com"), null);
  assert.equal(supabaseProjectRefFromUrl("not-a-url"), null);
});

test("app target skips an empty primary URL and uses the first configured fallback", () => {
  const result = evaluateEnvironmentBoundary({
    ...stagingEnvironment,
    NEXT_PUBLIC_APP_URL: "   ",
    NEXT_PUBLIC_SITE_URL: "https://staging-fallback.fanmind.example",
  });

  assert.equal(result.ok, true);
  assert.equal(result.appConfigured, true);
  assert.equal(result.appProduction, false);
  assert.equal(result.appSecure, true);
});

test("Supabase URL and explicit target reference must identify the same project", () => {
  const matching = evaluateEnvironmentBoundary(stagingEnvironment);
  assert.equal(matching.ok, true);
  assert.equal(matching.supabaseUrlProjectIdentified, true);
  assert.equal(matching.supabaseExplicitProjectIdentified, true);
  assert.equal(matching.supabaseTargetRefMatchesUrl, true);
  assert.equal(matching.supabaseTargetRefMismatch, false);

  const mismatchedEnvironment = {
    ...stagingEnvironment,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "differentref123",
  };
  const readOnly = evaluateEnvironmentBoundary(mismatchedEnvironment);
  assert.equal(readOnly.ok, false);
  assert.equal(readOnly.supabaseTargetRefMismatch, true);
  assert.equal(readOnly.supabaseTargetRefMatchesUrl, false);
  assert.match(readOnly.errors.join("\n"), /dasselbe Supabase-Projekt/);

  const write = evaluateEnvironmentBoundary(
    {
      ...mismatchedEnvironment,
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );
  assert.equal(write.ok, false);
  assert.equal(write.supabaseTargetRefMismatch, true);
});

test("write mode requires an explicit target reference even for a standard Supabase URL", () => {
  const result = evaluateEnvironmentBoundary(
    {
      ...stagingEnvironment,
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );

  assert.equal(result.ok, false);
  assert.equal(result.supabaseUrlProjectIdentified, true);
  assert.equal(result.supabaseExplicitProjectIdentified, false);
  assert.match(result.errors.join("\n"), /explizite Zielbestätigung/);
});

test("preflight output never prints actual URLs, project refs or secret values", () => {
  assert.match(preflightSource, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/);
  assert.doesNotMatch(preflightSource, /console\.log\([^\n]*(?:NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY)/);
  assert.doesNotMatch(preflightSource, /console\.log\([^\n]*projectRef/);
});

test("Production deployment never enables non-production writes", () => {
  assert.doesNotMatch(deployWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES\s*=\s*true/);
  assert.doesNotMatch(deployWorkflow, /I_UNDERSTAND_NON_PRODUCTION_ONLY/);
});

test("staging template starts with all dangerous switches disabled", () => {
  assert.match(stagingTemplate, /FANMIND_RUNTIME_ENVIRONMENT=staging/);
  assert.match(stagingTemplate, /FANMIND_ENABLE_NON_PRODUCTION_WRITES=false/);
  assert.match(stagingTemplate, /FANMIND_ENABLE_REFERRAL_BILLING=false/);
  assert.match(stagingTemplate, /FANMIND_PUBLIC_DEMO_ENABLED=false/);
  assert.match(stagingTemplate, /FANMIND_OPERATIONS_MONITOR_ENABLED=false/);
  assert.match(stagingTemplate, /FANMIND_SERVER_ERROR_TRACKING_ENABLED=false/);
  assert.doesNotMatch(stagingTemplate, /sk_live_/);
});
