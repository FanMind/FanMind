#!/usr/bin/env node

import { evaluateEnvironmentBoundary } from "../src/lib/environmentBoundaryPolicy.mjs";
import { isStripeTestSecretKey } from "../src/lib/stripeKeyPolicy.mjs";

const env = process.env;
const errors = [];
const warnings = [];

function value(name) {
  return String(env[name] ?? "").trim();
}

function configured(name, { prefix, optional = false } = {}) {
  const current = value(name);
  if (!current) {
    if (!optional) errors.push(`${name} fehlt.`);
    return false;
  }

  if (/replace|placeholder|example|stagingprojectref|productionprojectref/i.test(current)) {
    errors.push(`${name} enthält noch einen Platzhalter.`);
    return false;
  }

  if (prefix && !current.startsWith(prefix)) {
    errors.push(`${name} muss mit ${prefix} beginnen.`);
    return false;
  }

  return true;
}

function requireFalse(name) {
  const current = value(name).toLowerCase();
  if (current !== "false") errors.push(`${name} muss für die Staging-Baseline exakt false sein.`);
}

const boundary = evaluateEnvironmentBoundary(env, { allowWrite: false });
for (const error of boundary.errors) errors.push(error);
for (const warning of boundary.warnings) warnings.push(warning);

if (boundary.runtimeEnvironment !== "staging") {
  errors.push("FANMIND_RUNTIME_ENVIRONMENT muss staging sein.");
}

if (!boundary.appConfigured || !boundary.appSecure || boundary.appProduction) {
  errors.push("Staging benötigt einen eigenen HTTPS-Host außerhalb fanmind.ch.");
}

if (!boundary.supabaseProjectIdentified || !boundary.productionProjectIdentified) {
  errors.push("Staging- und Production-Supabase-Projektreferenz müssen identifiziert sein.");
}

if (!boundary.supabaseUrlProjectIdentified) {
  errors.push("Staging benötigt eine standardisierte Supabase-Projekt-URL mit erkennbarer Projektreferenz.");
}

if (!boundary.supabaseExplicitProjectIdentified) {
  errors.push("FANMIND_TARGET_SUPABASE_PROJECT_REF muss als explizite Staging-Zielbestätigung gesetzt sein.");
}

if (boundary.supabaseTargetRefMismatch || !boundary.supabaseTargetRefMatchesUrl) {
  errors.push("Supabase-URL und explizite Staging-Zielreferenz müssen exakt übereinstimmen.");
}

if (boundary.supabaseProductionMatch) {
  errors.push("Staging darf nicht das Production-Supabase-Projekt verwenden.");
}

configured("FANMIND_TARGET_SUPABASE_PROJECT_REF");
configured("FANMIND_PRODUCTION_SUPABASE_PROJECT_REF");
configured("NEXT_PUBLIC_SUPABASE_ANON_KEY");
configured("SUPABASE_SERVICE_ROLE_KEY");
configured("STRIPE_SECRET_KEY");
if (!isStripeTestSecretKey(value("STRIPE_SECRET_KEY"))) {
  errors.push("STRIPE_SECRET_KEY muss ein eingeschränkter oder Standard-Stripe-Testschlüssel sein.");
}
configured("STRIPE_WEBHOOK_SECRET", { prefix: "whsec_" });
configured("OPENAI_API_KEY", { prefix: "sk-", optional: true });
const sharedRateLimitSecret = value("FANMIND_SHARED_RATE_LIMIT_SECRET");
if (sharedRateLimitSecret.length < 32) {
  errors.push("FANMIND_SHARED_RATE_LIMIT_SECRET muss mindestens 32 Zeichen lang sein.");
}

if (value("FANMIND_TAX_MODE") !== "stripe_tax") {
  errors.push("FANMIND_TAX_MODE muss in Staging exakt stripe_tax sein.");
}
if (value("FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED") !== "true") {
  errors.push("Die Stripe-Tax-Testregistrierung muss für Staging ausdrücklich bestätigt sein.");
}

requireFalse("FANMIND_ENABLE_NON_PRODUCTION_WRITES");
requireFalse("FANMIND_ENABLE_REFERRAL_BILLING");
requireFalse("FANMIND_PUBLIC_DEMO_ENABLED");
requireFalse("FANMIND_ENABLE_TELEGRAM_SEND");
requireFalse("FANMIND_OPERATIONS_EMAIL_ENABLED");
requireFalse("FANMIND_SERVER_ERROR_EMAIL_ENABLED");

if (value("FANMIND_NON_PRODUCTION_WRITE_ACK")) {
  errors.push("FANMIND_NON_PRODUCTION_WRITE_ACK muss in der sicheren Staging-Baseline leer sein.");
}

console.log("STAGING_RUNTIME=staging");
console.log(`STAGING_SUPPORT_CENTRE_RUNTIME=${env.FANMIND_SUPPORT_CENTRE_ENABLED === "true" ? "enabled" : "disabled"}`);
console.log(`STAGING_CHAT_ADMIN_MEDIA_RUNTIME=${env.FANMIND_CHAT_ADMIN_MEDIA_ENABLED === "true" ? "enabled" : "disabled"}`);
console.log(`STAGING_CHAT_ADMIN_MEDIA_ANALYSIS_RUNTIME=${env.FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED === "true" ? "enabled" : "disabled"}`);

console.log(`STAGING_APP_TARGET=${boundary.appConfigured && !boundary.appProduction ? "separate" : "invalid"}`);
console.log(`STAGING_SUPABASE_TARGET=${boundary.supabaseProjectIdentified && !boundary.supabaseProductionMatch ? "separate" : "invalid"}`);
console.log(
  `STAGING_SUPABASE_REF_BINDING=${
    boundary.supabaseTargetRefMatchesUrl && !boundary.supabaseTargetRefMismatch
      ? "matching"
      : "invalid"
  }`,
);
console.log(`STAGING_STRIPE_MODE=${isStripeTestSecretKey(value("STRIPE_SECRET_KEY")) ? "test" : "invalid"}`);
console.log(`STAGING_STRIPE_TAX=${value("FANMIND_TAX_MODE") === "stripe_tax" && value("FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED") === "true" ? "ready" : "blocked"}`);
console.log(`STAGING_SHARED_RATE_LIMIT=${sharedRateLimitSecret.length >= 32 ? "ready" : "blocked"}`);
console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");

for (const warning of warnings) console.warn(`STAGING_WARNING=${warning}`);
for (const error of errors) console.error(`STAGING_ERROR=${error}`);

if (errors.length) {
  console.error(`Staging readiness failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("STAGING_READINESS=OK");
