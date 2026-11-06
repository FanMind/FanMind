#!/usr/bin/env node

import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  WRITE_ACKNOWLEDGEMENT,
  evaluateReferralSandboxConfiguration,
} from "../src/lib/referralSandboxPolicy.mjs";

const allowWrite = process.argv.includes("--allow-write");
const result = evaluateReferralSandboxConfiguration(process.env, { allowWrite });

console.log(`MODE=${result.mode}`);
console.log(`STRIPE_KEY_MODE=${result.stripeKeyMode}`);
console.log(
  `WEBHOOK_SECRET=${result.webhookConfigured ? "gesetzt" : "nicht gesetzt"}`,
);
console.log(
  `SUPABASE_SERVICE_ROLE_KEY=${
    result.serviceRoleConfigured ? "gesetzt" : "nicht gesetzt"
  }`,
);
console.log(
  `REFERRAL_RECONCILE_SECRET=${
    result.reconcileSecretConfigured ? "gesetzt" : "nicht gesetzt"
  }`,
);
console.log(
  `REFERRAL_BILLING=${result.billingEnabled ? "aktiv" : "deaktiviert"}`,
);
console.log(
  `TARGET=${result.productionHostname ? "production" : result.hostnameConfigured ? "non-production" : "unbekannt"}`,
);
console.log(
  `ENVIRONMENT_BOUNDARY=${
    result.environmentBoundaryOk === null
      ? "not-required"
      : result.environmentBoundaryOk
        ? "ok"
        : "blocked"
  }`,
);
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
      `HINWEIS=Schreibtests benötigen FANMIND_REFERRAL_SANDBOX_ACK=${WRITE_ACKNOWLEDGEMENT} und FANMIND_NON_PRODUCTION_WRITE_ACK=${NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT}; Host und Supabase-Projekt müssen eindeutig von Production getrennt sein.`,
    );
  }

  process.exit(1);
}

console.log("PREFLIGHT=OK");
