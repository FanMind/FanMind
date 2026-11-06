export const REQUIRED_PUBLIC_HEALTH_COMPONENTS = Object.freeze([
  "application",
  "supabase_config",
  "supabase_database",
  "supabase_storage",
  "stripe_config",
  "openai_config",
  "shared_rate_limit_config",
]);

export const OPTIONAL_PUBLIC_HEALTH_COMPONENTS = Object.freeze([
  "email_config",
]);

export function evaluatePublicHealth(payload) {
  const checks = Array.isArray(payload?.checks) ? payload.checks : [];
  const byComponent = new Map(
    checks
      .filter((check) => typeof check?.component === "string")
      .map((check) => [check.component, check]),
  );
  const errors = [];
  const warnings = [];

  for (const component of REQUIRED_PUBLIC_HEALTH_COMPONENTS) {
    const check = byComponent.get(component);
    if (!check) {
      errors.push(`Pflichtkomponente fehlt: ${component}`);
      continue;
    }
    if (check.status !== "healthy") {
      errors.push(
        `Pflichtkomponente ${component} ist ${String(check.status ?? "unknown")}`,
      );
    }
  }

  for (const component of OPTIONAL_PUBLIC_HEALTH_COMPONENTS) {
    const check = byComponent.get(component);
    if (!check) {
      warnings.push(`optionale Komponente fehlt: ${component}`);
      continue;
    }
    if (check.status !== "healthy") {
      warnings.push(
        `optionale Komponente ${component} ist ${String(check.status ?? "unknown")}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    detail:
      errors.length > 0
        ? errors.join("; ")
        : warnings.length > 0
          ? `${REQUIRED_PUBLIC_HEALTH_COMPONENTS.length} Pflichtkomponenten healthy; ${warnings.join("; ")}`
          : `${REQUIRED_PUBLIC_HEALTH_COMPONENTS.length} Pflichtkomponenten healthy`,
  };
}
