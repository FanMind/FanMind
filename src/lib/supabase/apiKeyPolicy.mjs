export function isOpaqueSupabaseApiKey(value) {
  return /^sb_(?:publishable|secret)_/u.test(String(value ?? "").trim());
}

export function buildSupabaseApiKeyHeaders(apiKey, accessToken) {
  const normalizedApiKey = String(apiKey ?? "").trim();
  const normalizedAccessToken = String(accessToken ?? "").trim();
  const effectiveApiKey = isOpaqueSupabaseApiKey(normalizedAccessToken)
    ? normalizedAccessToken
    : normalizedApiKey;

  const headers = {
    apikey: effectiveApiKey,
    "Content-Type": "application/json",
  };
  const authorizationToken = normalizedAccessToken
    ? isOpaqueSupabaseApiKey(normalizedAccessToken)
      ? ""
      : normalizedAccessToken
    : isOpaqueSupabaseApiKey(effectiveApiKey)
      ? ""
      : effectiveApiKey;

  if (authorizationToken) {
    headers.Authorization = `Bearer ${authorizationToken}`;
  }
  return headers;
}
