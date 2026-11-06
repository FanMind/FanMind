const NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT = "I_UNDERSTAND_NON_PRODUCTION_ONLY";
const RUNTIME_ENVIRONMENTS = new Set(["production", "staging", "test", "development"]);
const WRITE_ENVIRONMENTS = new Set(["staging", "test"]);
const PRODUCTION_HOSTNAMES = new Set(["fanmind.ch", "www.fanmind.ch"]);
const SUPABASE_REF_PATTERN = /^[a-z0-9]{8,40}$/;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const candidate = clean(value);
    if (candidate) return candidate;
  }
  return "";
}

function normalizeHostname(value) {
  return clean(value).toLowerCase().replace(/\.+$/, "");
}

function parseUrl(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function normalizeRuntimeEnvironment(value) {
  const candidate = clean(value).toLowerCase();
  return RUNTIME_ENVIRONMENTS.has(candidate) ? candidate : "unknown";
}

function normalizeProjectRef(value) {
  const candidate = clean(value).toLowerCase();
  return SUPABASE_REF_PATTERN.test(candidate) ? candidate : null;
}

function supabaseProjectRefFromUrl(value) {
  const url = parseUrl(value);
  if (!url) return null;
  const hostname = normalizeHostname(url.hostname);
  const match = hostname.match(/^([a-z0-9]{8,40})\.supabase\.co$/);
  return match ? match[1] : null;
}

function appTarget(environment) {
  const url = parseUrl(
    firstNonEmpty(
      environment.NEXT_PUBLIC_APP_URL,
      environment.NEXT_PUBLIC_SITE_URL,
      environment.FANMIND_APP_URL,
    ),
  );
  const hostname = url ? normalizeHostname(url.hostname) : null;
  return {
    configured: Boolean(url),
    hostname,
    secure: url?.protocol === "https:",
    production: hostname ? PRODUCTION_HOSTNAMES.has(hostname) : false,
  };
}

function supabaseTarget(environment) {
  const rawUrl = clean(environment.NEXT_PUBLIC_SUPABASE_URL);
  const url = parseUrl(rawUrl);
  const urlProjectRef = supabaseProjectRefFromUrl(rawUrl);
  const explicitProjectRef = normalizeProjectRef(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  );
  const projectRef = urlProjectRef ?? explicitProjectRef;
  const productionRef = normalizeProjectRef(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const targetRefMismatch = Boolean(
    urlProjectRef
      && explicitProjectRef
      && urlProjectRef !== explicitProjectRef,
  );
  return {
    configured: Boolean(url),
    secure: url?.protocol === "https:",
    urlProjectRef,
    explicitProjectRef,
    projectRef,
    productionRef,
    productionMatch: Boolean(projectRef && productionRef && projectRef === productionRef),
    targetRefMismatch,
    targetRefMatchesUrl: Boolean(
      urlProjectRef
        && explicitProjectRef
        && urlProjectRef === explicitProjectRef,
    ),
    standardProjectUrl: Boolean(urlProjectRef),
  };
}

export function evaluateEnvironmentBoundary(
  environment = {},
  { allowWrite = false } = {},
) {
  const errors = [];
  const warnings = [];
  const runtimeEnvironment = normalizeRuntimeEnvironment(
    environment.FANMIND_RUNTIME_ENVIRONMENT,
  );
  const app = appTarget(environment);
  const supabase = supabaseTarget(environment);
  const writesEnabled = clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) === "true";
  const acknowledgement = clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK);

  if (runtimeEnvironment === "unknown") {
    errors.push("FANMIND_RUNTIME_ENVIRONMENT muss production, staging, test oder development sein.");
  }
  if (!app.configured) {
    errors.push("Eine gültige FanMind-Ziel-URL fehlt.");
  } else if (!app.secure && app.hostname !== "localhost" && app.hostname !== "127.0.0.1") {
    errors.push("FanMind-Ziel-URLs müssen HTTPS verwenden.");
  }
  if (!supabase.configured) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL fehlt oder ist ungültig.");
  } else if (!supabase.secure) {
    errors.push("Supabase-Ziel-URLs müssen HTTPS verwenden.");
  }
  if (supabase.targetRefMismatch) {
    errors.push(
      "NEXT_PUBLIC_SUPABASE_URL und FANMIND_TARGET_SUPABASE_PROJECT_REF müssen dasselbe Supabase-Projekt benennen.",
    );
  }

  if (runtimeEnvironment === "production" && app.configured && !app.production) {
    errors.push("Production muss auf fanmind.ch oder www.fanmind.ch zeigen.");
  }
  if (runtimeEnvironment !== "production" && runtimeEnvironment !== "unknown" && app.production) {
    errors.push("Nicht-produktive Umgebungen dürfen nicht auf fanmind.ch zeigen.");
  }
  if (runtimeEnvironment === "production" && supabase.productionRef && supabase.projectRef && !supabase.productionMatch) {
    errors.push("Production zeigt nicht auf das bestätigte Production-Supabase-Projekt.");
  }

  if (allowWrite) {
    if (!WRITE_ENVIRONMENTS.has(runtimeEnvironment)) {
      errors.push("Schreibtests sind ausschließlich in staging oder test erlaubt.");
    }
    if (!writesEnabled) {
      errors.push("Schreibtests verlangen FANMIND_ENABLE_NON_PRODUCTION_WRITES=true.");
    }
    if (acknowledgement !== NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT) {
      errors.push(
        `Schreibtests verlangen FANMIND_NON_PRODUCTION_WRITE_ACK=${NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT}.`,
      );
    }
    if (app.production) {
      errors.push("Schreibtests dürfen niemals gegen fanmind.ch laufen.");
    }
    if (!app.configured || !app.secure) {
      errors.push("Schreibtests verlangen eine gültige HTTPS-Staging-/Test-URL.");
    }
    if (!supabase.projectRef) {
      errors.push("Schreibtests verlangen eine eindeutig erkennbare Ziel-Supabase-Projektreferenz.");
    }
    if (!supabase.explicitProjectRef) {
      errors.push(
        "Schreibtests verlangen FANMIND_TARGET_SUPABASE_PROJECT_REF als explizite Zielbestätigung.",
      );
    }
    if (!supabase.productionRef) {
      errors.push("Schreibtests verlangen FANMIND_PRODUCTION_SUPABASE_PROJECT_REF zum Vergleich.");
    }
    if (supabase.productionMatch) {
      errors.push("Schreibtests dürfen niemals das Production-Supabase-Projekt verwenden.");
    }
  } else if (writesEnabled) {
    errors.push("Read-only Preflight verlangt FANMIND_ENABLE_NON_PRODUCTION_WRITES=false.");
  }

  if (!allowWrite && runtimeEnvironment !== "production" && runtimeEnvironment !== "unknown") {
    warnings.push("Nicht-produktive Umgebung erkannt; Schreibzugriff bleibt ohne --allow-write gesperrt.");
  }
  if (supabase.configured && !supabase.standardProjectUrl && !supabase.projectRef) {
    warnings.push("Supabase-Custom-Domain erkannt; FANMIND_TARGET_SUPABASE_PROJECT_REF sollte gesetzt werden.");
  }
  if (runtimeEnvironment === "production" && !supabase.productionRef) {
    warnings.push("Production-Supabase-Projektreferenz ist noch nicht als Vergleichswert dokumentiert.");
  }

  return {
    ok: errors.length === 0,
    mode: allowWrite ? "non-production-write" : "read-only",
    runtimeEnvironment,
    writesEnabled,
    appConfigured: app.configured,
    appHostnameConfigured: Boolean(app.hostname),
    appProduction: app.production,
    appSecure: app.secure,
    supabaseConfigured: supabase.configured,
    supabaseProjectIdentified: Boolean(supabase.projectRef),
    supabaseUrlProjectIdentified: Boolean(supabase.urlProjectRef),
    supabaseExplicitProjectIdentified: Boolean(supabase.explicitProjectRef),
    supabaseTargetRefMismatch: supabase.targetRefMismatch,
    supabaseTargetRefMatchesUrl: supabase.targetRefMatchesUrl,
    productionProjectIdentified: Boolean(supabase.productionRef),
    supabaseProductionMatch: supabase.productionMatch,
    errors,
    warnings,
  };
}

export {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  normalizeHostname,
  normalizeRuntimeEnvironment,
  supabaseProjectRefFromUrl,
};
