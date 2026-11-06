#!/usr/bin/env node

import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "../src/lib/environmentBoundaryPolicy.mjs";

const allowWrite = process.argv.includes("--allow-write");
const result = evaluateEnvironmentBoundary(process.env, { allowWrite });

console.log(`MODE=${result.mode}`);
console.log(`RUNTIME_ENVIRONMENT=${result.runtimeEnvironment}`);
console.log(`APP_TARGET=${result.appProduction ? "production" : result.appConfigured ? "non-production" : "unknown"}`);
console.log(`APP_HTTPS=${result.appSecure ? "yes" : "no"}`);
console.log(`SUPABASE_TARGET=${result.supabaseProjectIdentified ? "identified" : "unknown"}`);
console.log(`SUPABASE_URL_PROJECT_REF=${result.supabaseUrlProjectIdentified ? "identified" : "missing"}`);
console.log(`SUPABASE_EXPLICIT_TARGET_REF=${result.supabaseExplicitProjectIdentified ? "identified" : "missing"}`);
console.log(
  `SUPABASE_TARGET_REF_MATCHES_URL=${
    result.supabaseTargetRefMismatch
      ? "no"
      : result.supabaseTargetRefMatchesUrl
        ? "yes"
        : "unknown"
  }`,
);
console.log(`PRODUCTION_SUPABASE_REFERENCE=${result.productionProjectIdentified ? "identified" : "missing"}`);
console.log(`SUPABASE_MATCHES_PRODUCTION=${result.supabaseProductionMatch ? "yes" : "no"}`);
console.log(`NON_PRODUCTION_WRITES=${result.writesEnabled ? "enabled" : "disabled"}`);
console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");

for (const warning of result.warnings) {
  console.warn(`WARNUNG=${warning}`);
}

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`FEHLER=${error}`);
  }
  if (allowWrite) {
    console.error(
      `HINWEIS=Schreibtests benötigen FANMIND_NON_PRODUCTION_WRITE_ACK=${NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT}, einen separaten Staging/Test-Host und ein anderes Supabase-Projekt als Production.`,
    );
  }
  process.exit(1);
}

console.log("ENVIRONMENT_BOUNDARY=OK");
