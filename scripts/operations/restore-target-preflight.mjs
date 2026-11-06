#!/usr/bin/env node

import {
  RESTORE_TARGET_ACKNOWLEDGEMENT,
  evaluateRestoreTarget,
} from "../../src/lib/restoreTargetPolicy.mjs";

const result = evaluateRestoreTarget(process.env);

console.log(`MODE=${result.mode}`);
console.log(
  `ENVIRONMENT_BOUNDARY=${result.environmentBoundaryOk ? "ok" : "blocked"}`,
);
console.log(`RESTORE_GATE=${result.restoreEnabled ? "enabled" : "blocked"}`);
console.log(
  `RESTORE_ACK=${result.acknowledgementConfirmed ? "confirmed" : "missing"}`,
);
console.log(
  `RESTORE_TARGET=${result.targetConfirmed ? "confirmed" : "invalid"}`,
);
console.log(
  `RESTORE_INPUT=${result.actualTargetCanonical ? "canonical" : "blocked"}`,
);
console.log(
  `PRODUCTION_TARGET=${result.productionSeparated ? "separate" : "blocked"}`,
);
console.log(
  `DATABASE_TARGET_CLASS=${
    result.managedSupabaseTarget || result.sharedSupabasePooler
      ? "hosted-supabase-blocked"
      : "self-controlled"
  }`,
);
console.log(
  `LIBPQ_TARGET_OVERRIDES=${
    result.hiddenTargetOverridesClear ? "clear" : "blocked"
  }`,
);
console.log(
  `DATABASE_PASSWORD_SOURCE=${
    result.passfileConfigured
      && result.passfileAbsolute
      && !result.passwordInEnvironment
      ? "passfile"
      : "invalid"
  }`,
);
console.log(`DATABASE_TLS=${result.tlsVerified ? "verify-full" : "invalid"}`);
console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");

for (const warning of result.warnings) {
  console.warn(`RESTORE_WARNING=${warning}`);
}

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`RESTORE_ERROR=${error}`);
  }
  console.error(
    `HINWEIS=Restore-Ziel, Production-Vergleich und FANMIND_RESTORE_TARGET_ACK=${RESTORE_TARGET_ACKNOWLEDGEMENT} müssen vollständig und getrennt bestätigt sein.`,
  );
  process.exit(1);
}

console.log("RESTORE_TARGET_BOUNDARY=OK");
