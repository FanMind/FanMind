const FANMIND_HOSTS = new Set(["fanmind.ch", "www.fanmind.ch", "staging.fanmind.ch"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const AUTH_PARAMETERS = new Set([
  "access_token", "refresh_token", "token_type", "type", "expires_in", "expires_at",
  "error", "error_code", "error_description", "code", "token_hash",
]);

export function buildWebPasswordResetRedirect(origin, language = "de") {
  const url = new URL(origin);
  const local = LOCAL_HOSTS.has(url.hostname);
  if (
    url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
    (local ? !["http:", "https:"].includes(url.protocol) :
      url.protocol !== "https:" || !FANMIND_HOSTS.has(url.hostname) || url.port)
  ) {
    throw new Error("recovery_origin_invalid");
  }
  // Keep the callback on the runtime that requested it, including Staging.
  return `${url.origin}/reset-password${language === "en" ? "?lang=en" : ""}`;
}

export function readWebRecoveryAccessToken({ hash = "", search = "" } = {}) {
  if (typeof hash !== "string" || typeof search !== "string" ||
      hash.length > 16384 || search.length > 2048) return null;
  const query = new URLSearchParams(search);
  // The supported implicit flow returns credentials in the fragment only.
  // Query credentials and mixed flows must never become recovery authority.
  if ([...query.keys()].some((key) => AUTH_PARAMETERS.has(key))) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) return null;
  if (["error", "error_code", "error_description", "code", "token_hash"]
    .some((key) => params.has(key))) return null;
  if (params.get("type") !== "recovery") return null;
  if (params.has("token_type") && params.get("token_type") !== "bearer") return null;
  const token = params.get("access_token");
  return token && token.length <= 8192 && /^[A-Za-z0-9._~-]+$/.test(token) ? token : null;
}
