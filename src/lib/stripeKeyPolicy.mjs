function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getStripeSecretKeyMode(value) {
  const key = clean(value);
  if (!key) return "missing";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}

export function isStripeTestSecretKey(value) {
  return getStripeSecretKeyMode(value) === "test";
}
