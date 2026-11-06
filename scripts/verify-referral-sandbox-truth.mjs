#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const files = [
  ".env.example",
  ".env.staging.example",
  "src/lib/environmentBoundaryPolicy.mjs",
  "src/lib/referralLifecyclePolicy.mjs",
  "src/lib/referralSandboxPolicy.mjs",
  "src/lib/stripeKeyPolicy.mjs",
  "src/app/api/stripe/webhook/route.ts",
  "scripts/environment-boundary-preflight.mjs",
  "scripts/referral-sandbox-preflight.mjs",
  "tests/environment-boundary-policy.test.mjs",
  "tests/referral-lifecycle-policy.test.mjs",
  "tests/referral-sandbox-policy.test.mjs",
  "docs/operations/ENVIRONMENT_SEPARATION.md",
  "docs/operations/referral-stripe-sandbox-runbook.md",
];

const contents = new Map();
const errors = [];

for (const file of files) {
  try {
    contents.set(file, await readFile(resolve(root, file), "utf8"));
  } catch (error) {
    errors.push(
      `${file}: Datei konnte nicht gelesen werden (${error instanceof Error ? error.message : "unbekannter Fehler"}).`,
    );
  }
}

function content(file) {
  return contents.get(file) ?? "";
}

function requireText(file, value, explanation) {
  if (!content(file).includes(value)) {
    errors.push(
      `${file}: ${explanation} Erwarteter Wert fehlt: ${JSON.stringify(value)}.`,
    );
  }
}

function forbidIn(file, pattern, explanation) {
  if (pattern.test(content(file))) errors.push(`${file}: ${explanation}`);
}

requireText(
  ".env.example",
  "FANMIND_ENABLE_REFERRAL_BILLING=false",
  "Referral-Billing muss standardmäßig deaktiviert bleiben.",
);
requireText(
  ".env.example",
  "FANMIND_REFERRAL_SANDBOX_ACK=",
  "Die ausdrückliche Referral-Sandbox-Schreibfreigabe muss dokumentiert sein.",
);
requireText(
  ".env.staging.example",
  "FANMIND_ENABLE_NON_PRODUCTION_WRITES=false",
  "Die Staging-Vorlage muss allgemeine Schreibzugriffe standardmäßig sperren.",
);
requireText(
  ".env.staging.example",
  "FANMIND_ENABLE_REFERRAL_BILLING=false",
  "Auch Staging muss Referral-Billing standardmäßig deaktivieren.",
);
requireText(
  "src/lib/environmentBoundaryPolicy.mjs",
  "I_UNDERSTAND_NON_PRODUCTION_ONLY",
  "Die gemeinsame Umgebungs-Schreibfreigabe muss einen exakten Bestätigungswert verlangen.",
);
requireText(
  "src/lib/environmentBoundaryPolicy.mjs",
  "FANMIND_PRODUCTION_SUPABASE_PROJECT_REF",
  "Schreibtests müssen das Ziel-Supabase-Projekt mit Production vergleichen.",
);
requireText(
  "src/lib/environmentBoundaryPolicy.mjs",
  'replace(/\\.+$/, "")',
  "Production-Hostnamen müssen vor dem Vergleich abschließende Punkte entfernen.",
);
requireText(
  "src/lib/referralLifecyclePolicy.mjs",
  'type === "charge.refunded"',
  "Refunds müssen im zentralen Lifecycle-Mapping berücksichtigt werden.",
);
requireText(
  "src/lib/referralLifecyclePolicy.mjs",
  'type === "customer.subscription.deleted"',
  "Kündigungen müssen im zentralen Lifecycle-Mapping berücksichtigt werden.",
);
requireText(
  "src/app/api/stripe/webhook/route.ts",
  'from "@/lib/referralLifecyclePolicy.mjs"',
  "Der Stripe-Webhook muss das getestete Lifecycle-Mapping verwenden.",
);
requireText(
  "src/lib/stripeKeyPolicy.mjs",
  'key.startsWith("sk_live_") || key.startsWith("rk_live_")',
  "Der Preflight muss Live-Stripe-Schlüssel erkennen und blockieren.",
);
requireText(
  "src/lib/referralSandboxPolicy.mjs",
  'hostname === "fanmind.ch"',
  "Schreibende Sandbox-Tests müssen das Production-Ziel erkennen.",
);
requireText(
  "src/lib/referralSandboxPolicy.mjs",
  "evaluateEnvironmentBoundary(environment, { allowWrite })",
  "Referral-Preflight muss die gemeinsame Grenze in Read-only- und Write-Modus ausführen.",
);
requireText(
  "scripts/environment-boundary-preflight.mjs",
  "SECRETS_WURDEN_NICHT_AUSGEGEBEN=true",
  "Der gemeinsame Preflight darf keine Secrets ausgeben.",
);
requireText(
  "scripts/referral-sandbox-preflight.mjs",
  "ENVIRONMENT_BOUNDARY=",
  "Der Referral-Preflight muss den gemeinsamen Grenzstatus sichtbar machen.",
);
requireText(
  "scripts/referral-sandbox-preflight.mjs",
  "SECRETS_WURDEN_NICHT_AUSGEGEBEN=true",
  "Der Referral-Preflight muss ausdrücklich bestätigen, dass keine Secrets ausgegeben wurden.",
);
requireText(
  "tests/referral-lifecycle-policy.test.mjs",
  "refunds and disputes deactivate referral eligibility",
  "Refunds und Disputes müssen automatisiert getestet werden.",
);
requireText(
  "tests/referral-sandbox-policy.test.mjs",
  "live Stripe keys are rejected in every sandbox mode",
  "Live-Schlüssel müssen automatisiert als unzulässig getestet werden.",
);
requireText(
  "tests/referral-sandbox-policy.test.mjs",
  "read-only referral preflight rejects a stale global write gate",
  "Read-only-Referral-Preflight muss einen stehen gebliebenen globalen Schreibschalter ablehnen.",
);
requireText(
  "tests/referral-sandbox-policy.test.mjs",
  "trailing-dot Production hostnames remain blocked in write mode",
  "Production-FQDNs mit abschließendem Punkt müssen ebenfalls blockiert werden.",
);
requireText(
  "tests/referral-sandbox-policy.test.mjs",
  "Production Supabase",
  "Referral-Schreibtests müssen ein versehentliches Production-Supabase-Ziel testen.",
);
requireText(
  "tests/environment-boundary-policy.test.mjs",
  "Production deployment never enables non-production writes",
  "Die Production-Deployment-Grenze muss automatisiert geprüft werden.",
);
requireText(
  "docs/operations/ENVIRONMENT_SEPARATION.md",
  "Fünf Bedingungen für schreibende Tests",
  "Die verbindliche Production-/Staging-Grenze muss dokumentiert sein.",
);
for (const value of [
  "FANMIND_RUNTIME_ENVIRONMENT=staging",
  "FANMIND_ENABLE_NON_PRODUCTION_WRITES=true",
  "FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY",
  "FANMIND_PRODUCTION_SUPABASE_PROJECT_REF=<PRODUCTION_PROJECT_REF>",
  "npm run environment:preflight:write",
  "ENVIRONMENT_BOUNDARY=ok",
]) {
  requireText(
    "docs/operations/referral-stripe-sandbox-runbook.md",
    value,
    "Das Referral-Runbook muss die gemeinsame Production-/Staging-Grenze vollständig anleiten.",
  );
}
requireText(
  "docs/operations/referral-stripe-sandbox-runbook.md",
  "FANMIND_ENABLE_REFERRAL_BILLING=false",
  "Das Runbook muss Production-Billing ausdrücklich deaktiviert lassen.",
);
requireText(
  "docs/operations/referral-stripe-sandbox-runbook.md",
  "Diesen Test niemals in Production ausführen.",
  "Der Cap-Test muss klar auf die isolierte Sandbox begrenzt sein.",
);
forbidIn(
  "scripts/environment-boundary-preflight.mjs",
  /console\.(?:log|warn|error)\([^\n]*(?:STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)\s*\)/u,
  "Der gemeinsame Preflight darf Secret- oder Zielwerte nicht direkt ausgeben.",
);
forbidIn(
  "scripts/referral-sandbox-preflight.mjs",
  /console\.(?:log|warn|error)\([^\n]*(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY)\s*\)/u,
  "Der Referral-Preflight darf Secret-Werte nicht direkt ausgeben.",
);

if (errors.length) {
  for (const error of errors) console.error(`REFERRAL_TRUTH_ERROR: ${error}`);
  console.error(
    `Referral sandbox truth verification failed with ${errors.length} error(s).`,
  );
  process.exit(1);
}

console.log(
  `Referral sandbox truth verified across ${files.length} checked files.`,
);
