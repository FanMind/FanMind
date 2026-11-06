import { isIP } from "node:net";
import { isAbsolute } from "node:path";

import { evaluateEnvironmentBoundary } from "./environmentBoundaryPolicy.mjs";

const RESTORE_TARGET_ACKNOWLEDGEMENT =
  "I_UNDERSTAND_EMPTY_DISPOSABLE_DATABASE_ONLY";
const RESTORE_READINESS_CONFIRMATION =
  "verify-isolated-restore-resources";
const SIMPLE_DATABASE_IDENTIFIER = /^[A-Za-z0-9_.-]{1,128}$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DIRECT_SUPABASE_HOST = /^db\.([a-z0-9]{8,40})\.supabase\.co$/;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function rawString(value) {
  return typeof value === "string" ? value : "";
}

function normalizeHost(value) {
  let candidate = clean(value).toLowerCase();
  if (!candidate) return null;

  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    candidate = candidate.slice(1, -1);
  }

  candidate = candidate.replace(/\.+$/, "");
  const addressFamily = isIP(candidate);
  if (addressFamily === 4) return candidate;
  if (addressFamily === 6) {
    try {
      return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
    } catch {
      return null;
    }
  }

  const labels = candidate.split(".");
  if (!labels.length || labels.some((label) => !HOST_LABEL.test(label))) {
    return null;
  }

  try {
    const parsedHostname = new URL(`http://${candidate}/`).hostname.toLowerCase();
    if (isIP(parsedHostname)) {
      // WHATWG accepts legacy numeric IPv4 spellings such as 127.1,
      // 0127.0.0.1 or 0x7f.1. libpq/libc may resolve them to the same
      // endpoint as a canonical address, so they are intentionally rejected.
      return null;
    }
  } catch {
    return null;
  }

  return candidate;
}

function normalizePort(value) {
  const candidate = clean(value);
  if (!/^\d{1,5}$/.test(candidate)) return null;

  const port = Number(candidate);
  return port >= 1 && port <= 65535 ? String(port) : null;
}

function normalizeIdentifier(value) {
  const candidate = clean(value);
  return SIMPLE_DATABASE_IDENTIFIER.test(candidate) ? candidate : null;
}

function databaseTarget(environment, names) {
  const input = {
    host: rawString(environment[names.host]),
    port: rawString(environment[names.port]),
    database: rawString(environment[names.database]),
    user: rawString(environment[names.user]),
  };
  const raw = {
    host: clean(input.host),
    port: clean(input.port),
    database: clean(input.database),
    user: clean(input.user),
  };
  const normalized = {
    host: normalizeHost(raw.host),
    port: normalizePort(raw.port),
    database: normalizeIdentifier(raw.database),
    user: normalizeIdentifier(raw.user),
  };
  const complete = Object.values(raw).every(Boolean);
  const valid = complete && Object.values(normalized).every(Boolean);
  const canonical = Boolean(
    valid
    && input.host === normalized.host
    && input.port === normalized.port
    && input.database === normalized.database
    && input.user === normalized.user
  );

  return {
    complete,
    valid,
    canonical,
    host: normalized.host,
    signature: valid
      ? [
          normalized.host,
          normalized.port,
          normalized.database,
          normalized.user,
        ].join("\u0000")
      : null,
  };
}

function sameTarget(left, right) {
  return Boolean(left.valid && right.valid && left.signature === right.signature);
}

export function evaluateRestoreReadiness(environment = {}) {
  const errors = [];
  const boundary = evaluateEnvironmentBoundary(environment, {
    allowWrite: false,
  });
  const runtimeAllowed = new Set(["staging", "test"]).has(
    boundary.runtimeEnvironment,
  );
  const target = databaseTarget(environment, {
    host: "FANMIND_RESTORE_TARGET_DB_HOST",
    port: "FANMIND_RESTORE_TARGET_DB_PORT",
    database: "FANMIND_RESTORE_TARGET_DB_NAME",
    user: "FANMIND_RESTORE_TARGET_DB_USER",
  });
  const production = databaseTarget(environment, {
    host: "FANMIND_PRODUCTION_DB_HOST",
    port: "FANMIND_PRODUCTION_DB_PORT",
    database: "FANMIND_PRODUCTION_DB_NAME",
    user: "FANMIND_PRODUCTION_DB_USER",
  });
  const targetSupabaseProjectRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const directSupabaseMatch = target.host?.match(DIRECT_SUPABASE_HOST);
  const sharedSupabasePooler = Boolean(
    target.host?.endsWith(".pooler.supabase.com"),
  );
  const productionHostSeparated = Boolean(
    target.valid
      && production.valid
      && target.host !== production.host,
  );
  const hiddenTargetOverridesClear = [
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGPASSFILE",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
  ].every((name) => !clean(environment[name]));

  errors.push(...boundary.errors.map(() => "environment_boundary"));
  if (!runtimeAllowed) errors.push("runtime_environment");
  if (
    boundary.appProduction
    || boundary.supabaseProductionMatch
    || !boundary.productionProjectIdentified
    || !boundary.supabaseTargetRefMatchesUrl
  ) {
    errors.push("production_boundary");
  }
  if (
    clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "false"
    || clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK)
  ) {
    errors.push("non_production_write_gate");
  }
  if (
    clean(environment.FANMIND_RESTORE_READINESS_CONFIRM)
    !== RESTORE_READINESS_CONFIRMATION
  ) {
    errors.push("readiness_confirmation");
  }
  if (
    clean(environment.FANMIND_ENABLE_RESTORE_DRILL) !== "false"
    || clean(environment.FANMIND_RESTORE_TARGET_ACK)
  ) {
    errors.push("restore_write_gate");
  }
  if (!target.complete || !target.valid || !target.canonical) {
    errors.push("restore_target");
  }
  if (!production.complete || !production.valid || !production.canonical) {
    errors.push("production_comparison");
  }
  if (!productionHostSeparated || sameTarget(target, production)) {
    errors.push("production_database_target");
  }
  if (sharedSupabasePooler) errors.push("shared_supabase_pooler");
  if (directSupabaseMatch) errors.push("managed_supabase_target_unsupported");
  if (
    directSupabaseMatch
    && directSupabaseMatch[1] !== targetSupabaseProjectRef
  ) {
    errors.push("supabase_database_binding");
  }
  if (!hiddenTargetOverridesClear) errors.push("libpq_target_override");

  return Object.freeze({
    ok: errors.length === 0,
    mode: "isolated-restore-readiness",
    runtimeAllowed,
    environmentBoundaryOk: boundary.ok,
    targetConfirmed: target.complete && target.valid && target.canonical,
    productionComparisonConfirmed:
      production.complete && production.valid && production.canonical,
    productionHostSeparated,
    directSupabaseProjectBound: Boolean(
      !directSupabaseMatch
      || directSupabaseMatch[1] === targetSupabaseProjectRef,
    ),
    managedSupabaseTarget: Boolean(directSupabaseMatch),
    sharedSupabasePooler,
    hiddenTargetOverridesClear,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export function evaluateRestoreTarget(environment = {}) {
  const errors = [];
  const warnings = [];
  const environmentBoundary = evaluateEnvironmentBoundary(environment, {
    allowWrite: true,
  });
  const restoreEnabled =
    clean(environment.FANMIND_ENABLE_RESTORE_DRILL) === "true";
  const acknowledgementConfirmed =
    clean(environment.FANMIND_RESTORE_TARGET_ACK)
      === RESTORE_TARGET_ACKNOWLEDGEMENT;
  const actualTarget = databaseTarget(environment, {
    host: "PGHOST",
    port: "PGPORT",
    database: "PGDATABASE",
    user: "PGUSER",
  });
  const expectedTarget = databaseTarget(environment, {
    host: "FANMIND_RESTORE_TARGET_DB_HOST",
    port: "FANMIND_RESTORE_TARGET_DB_PORT",
    database: "FANMIND_RESTORE_TARGET_DB_NAME",
    user: "FANMIND_RESTORE_TARGET_DB_USER",
  });
  const productionTarget = databaseTarget(environment, {
    host: "FANMIND_PRODUCTION_DB_HOST",
    port: "FANMIND_PRODUCTION_DB_PORT",
    database: "FANMIND_PRODUCTION_DB_NAME",
    user: "FANMIND_PRODUCTION_DB_USER",
  });
  const hiddenTargetOverrides = [
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
  ].filter((name) => clean(environment[name]));
  const passfilePath = clean(environment.PGPASSFILE);
  const passfileConfigured = Boolean(passfilePath);
  const passfileAbsolute = passfileConfigured && isAbsolute(passfilePath);
  const passwordInEnvironment = Boolean(clean(environment.PGPASSWORD));
  const sslMode = clean(environment.PGSSLMODE).toLowerCase();
  const sslRootCertificatePath = clean(environment.PGSSLROOTCERT);
  const sslRootCertificateConfigured = Boolean(sslRootCertificatePath);
  const sslRootCertificateAbsolute =
    sslRootCertificateConfigured && isAbsolute(sslRootCertificatePath);
  const gssEncryptionMode = clean(environment.PGGSSENCMODE).toLowerCase();
  const tlsVerified =
    sslMode === "verify-full"
    && sslRootCertificateAbsolute
    && gssEncryptionMode === "disable";
  const targetSupabaseProjectRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const directSupabaseMatch = actualTarget.host?.match(DIRECT_SUPABASE_HOST);
  const sharedSupabasePooler = Boolean(
    actualTarget.host?.endsWith(".pooler.supabase.com"),
  );

  for (const error of environmentBoundary.errors) {
    errors.push(`Umgebungsgrenze: ${error}`);
  }
  for (const warning of environmentBoundary.warnings) {
    warnings.push(`Umgebungsgrenze: ${warning}`);
  }

  if (!restoreEnabled) {
    errors.push("Restore-Drill verlangt FANMIND_ENABLE_RESTORE_DRILL=true.");
  }
  if (!acknowledgementConfirmed) {
    errors.push(
      `Restore-Drill verlangt FANMIND_RESTORE_TARGET_ACK=${RESTORE_TARGET_ACKNOWLEDGEMENT}.`,
    );
  }
  if (!actualTarget.complete) {
    errors.push("PGHOST, PGPORT, PGDATABASE und PGUSER müssen vollständig gesetzt sein.");
  } else if (!actualTarget.valid) {
    errors.push(
      "PG*-Zielwerte müssen einfache Host-, Port-, Datenbank- und Benutzerwerte sein; Connection-Strings und Mehrfach-Hosts sind verboten.",
    );
  } else if (!actualTarget.canonical) {
    errors.push(
      "PGHOST, PGPORT, PGDATABASE und PGUSER müssen bereits kanonisch und ohne führende oder nachgestellte Zeichen gesetzt sein.",
    );
  }
  if (!expectedTarget.complete) {
    errors.push(
      "Die explizite Restore-Zielbestätigung mit FANMIND_RESTORE_TARGET_DB_HOST, _PORT, _NAME und _USER fehlt.",
    );
  } else if (!expectedTarget.valid) {
    errors.push("Die explizite Restore-Zielbestätigung enthält ungültige Werte.");
  }
  if (!productionTarget.complete) {
    errors.push(
      "Der Production-Vergleich mit FANMIND_PRODUCTION_DB_HOST, _PORT, _NAME und _USER fehlt.",
    );
  } else if (!productionTarget.valid) {
    errors.push("Der Production-Datenbankvergleich enthält ungültige Werte.");
  }

  const targetConfirmed = sameTarget(actualTarget, expectedTarget);
  if (actualTarget.valid && expectedTarget.valid && !targetConfirmed) {
    errors.push(
      "Die von pg_restore verwendeten PG*-Werte stimmen nicht exakt mit der expliziten Restore-Zielbestätigung überein.",
    );
  }

  const productionHostSeparated = Boolean(
    actualTarget.valid
    && productionTarget.valid
    && actualTarget.host !== productionTarget.host
  );
  const productionSeparated = Boolean(
    productionHostSeparated
    && !sameTarget(actualTarget, productionTarget)
  );
  if (actualTarget.valid && productionTarget.valid && !productionHostSeparated) {
    errors.push(
      "Das pg_restore-Ziel verwendet den Production-Datenbankhost und ist nicht isoliert.",
    );
  }
  if (sharedSupabasePooler) {
    errors.push(
      "Shared Supabase-Pooler sind für den Restore-Drill gesperrt.",
    );
  }
  if (directSupabaseMatch) {
    errors.push(
      "Gehostete Supabase-Datenbanken sind kein gültiges Restore-Ziel; der exakte Eigentümer- und ACL-Roundtrip verlangt ein isoliertes, selbst kontrolliertes PostgreSQL-17-Ziel mit Bootstrap-Superuser.",
    );
  }
  if (
    directSupabaseMatch
    && directSupabaseMatch[1] !== targetSupabaseProjectRef
  ) {
    errors.push(
      "Der direkte Supabase-DB-Host gehört nicht zur bestätigten nicht-produktiven Zielprojektreferenz.",
    );
  }

  if (hiddenTargetOverrides.length) {
    errors.push(
      "PGHOSTADDR, PGSERVICE und PGSERVICEFILE dürfen beim Restore-Drill nicht gesetzt sein.",
    );
  }
  if (!passfileConfigured) {
    errors.push("Restore-Drill verlangt einen geschützten PGPASSFILE-Pfad.");
  } else if (!passfileAbsolute) {
    errors.push("PGPASSFILE muss ein absoluter Pfad sein.");
  }
  if (passwordInEnvironment) {
    errors.push("PGPASSWORD ist beim Restore-Drill verboten; PGPASSFILE verwenden.");
  }
  if (sslMode !== "verify-full") {
    errors.push("Restore-Drill verlangt PGSSLMODE=verify-full.");
  }
  if (!sslRootCertificateConfigured) {
    errors.push("Restore-Drill verlangt einen geschützten PGSSLROOTCERT-Pfad.");
  } else if (!sslRootCertificateAbsolute) {
    errors.push("PGSSLROOTCERT muss ein absoluter Pfad sein.");
  }
  if (gssEncryptionMode !== "disable") {
    errors.push("Restore-Drill verlangt PGGSSENCMODE=disable.");
  }

  return {
    ok: errors.length === 0,
    mode: "isolated-restore-write",
    restoreEnabled,
    acknowledgementConfirmed,
    environmentBoundaryOk: environmentBoundary.ok,
    actualTargetComplete: actualTarget.complete,
    actualTargetValid: actualTarget.valid,
    actualTargetCanonical: actualTarget.canonical,
    expectedTargetComplete: expectedTarget.complete,
    expectedTargetValid: expectedTarget.valid,
    productionTargetComplete: productionTarget.complete,
    productionTargetValid: productionTarget.valid,
    targetConfirmed,
    productionHostSeparated,
    productionSeparated,
    directSupabaseProjectBound: Boolean(
      !directSupabaseMatch
      || directSupabaseMatch[1] === targetSupabaseProjectRef,
    ),
    managedSupabaseTarget: Boolean(directSupabaseMatch),
    sharedSupabasePooler,
    hiddenTargetOverridesClear: hiddenTargetOverrides.length === 0,
    passfileConfigured,
    passfileAbsolute,
    passwordInEnvironment,
    sslRootCertificateConfigured,
    sslRootCertificateAbsolute,
    tlsVerified,
    errors,
    warnings,
  };
}

export {
  RESTORE_READINESS_CONFIRMATION,
  RESTORE_TARGET_ACKNOWLEDGEMENT,
  normalizeHost,
  normalizePort,
};
