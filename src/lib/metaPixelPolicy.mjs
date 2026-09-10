export const FANMIND_MARKETING_CONSENT_COOKIE =
  "fanmind_marketing_consent";
export const FANMIND_MARKETING_CONSENT_MAX_AGE_SECONDS =
  180 * 24 * 60 * 60;

export const META_PIXEL_SCRIPT_URL =
  "https://connect.facebook.net/en_US/fbevents.js";
export const META_PIXEL_READY_EVENT = "fanmind:meta-pixel-ready";

export const META_PIXEL_ACTIVE_EVENTS = Object.freeze(["PageView"]);
export const META_PIXEL_PREPARED_EVENTS = Object.freeze([
  "CompleteRegistration",
  "Lead",
  "ViewContent",
  "Contact",
  "Schedule",
  "StartTrial",
  "Purchase",
]);
export const META_PIXEL_STANDARD_EVENTS = Object.freeze([
  ...META_PIXEL_ACTIVE_EVENTS,
  ...META_PIXEL_PREPARED_EVENTS,
]);

export const META_PIXEL_PUBLIC_ROUTES = Object.freeze([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/roadmap",
  "/landing-v2",
  "/account-deletion",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/avv",
  "/zahlungsbedingungen",
  "/referral-bedingungen",
]);

const PIXEL_ID_PATTERN = /^[0-9]{5,32}$/u;
const SAFE_QUERY_VALUES = Object.freeze({
  lang: new Set(["de", "en"]),
  plan: new Set([
    "starter",
    "daily",
    "growth",
    "agency",
  ]),
  option: new Set([
    "starter_paid_setup",
    "starter_no_setup_commitment",
  ]),
});
const ROUTE_QUERY_KEYS = Object.freeze({
  "/": new Set(["lang"]),
  "/login": new Set(["lang"]),
  "/register": new Set(["lang", "plan", "option"]),
  "/forgot-password": new Set(["lang"]),
  "/roadmap": new Set(["lang"]),
  "/landing-v2": new Set(["lang"]),
  "/account-deletion": new Set(["lang"]),
  "/impressum": new Set(["lang"]),
  "/datenschutz": new Set(["lang"]),
  "/agb": new Set(["lang"]),
  "/avv": new Set(["lang"]),
  "/zahlungsbedingungen": new Set(["lang"]),
  "/referral-bedingungen": new Set(["lang"]),
});
const ROUTE_HASH_VALUES = Object.freeze({
  "/impressum": new Set(["top"]),
  "/datenschutz": new Set(["top", "marketing-messung"]),
  "/agb": new Set(["top"]),
  "/avv": new Set(["top"]),
  "/zahlungsbedingungen": new Set(["top"]),
  "/referral-bedingungen": new Set(["top"]),
});

export function normalizeMarketingConsent(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "granted" || normalized === "denied") {
    return normalized;
  }
  return "unset";
}

export function normalizeMetaPixelId(value) {
  const normalized = String(value ?? "").trim();
  return PIXEL_ID_PATTERN.test(normalized) ? normalized : null;
}

export function isMetaPixelEnabled({ pixelId, consent }) {
  return (
    normalizeMarketingConsent(consent) === "granted" &&
    normalizeMetaPixelId(pixelId) !== null
  );
}

export function isSupportedMetaPixelEvent(eventName) {
  return META_PIXEL_STANDARD_EVENTS.includes(String(eventName));
}

export function isActiveMetaPixelEvent(eventName) {
  return META_PIXEL_ACTIVE_EVENTS.includes(String(eventName));
}

export function normalizeMetaPixelRoute(pathname) {
  const value = String(pathname ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value.replace(/\/{2,}/gu, "/") || "/";
}

export function isMetaPixelPublicRoute(pathname) {
  return META_PIXEL_PUBLIC_ROUTES.includes(normalizeMetaPixelRoute(pathname));
}

export function isMetaPixelPageViewAllowed({
  pathname,
  search = "",
  hash = "",
}) {
  const route = normalizeMetaPixelRoute(pathname);
  if (!isMetaPixelPublicRoute(route)) return false;

  const rawHash = String(hash ?? "").trim().replace(/^#/u, "");
  if (rawHash && !(ROUTE_HASH_VALUES[route] ?? new Set()).has(rawHash)) {
    return false;
  }

  const rawSearch = String(search ?? "").trim().replace(/^\?/u, "");
  if (!rawSearch) return true;

  const allowedKeys = ROUTE_QUERY_KEYS[route] ?? new Set();
  const parameters = new URLSearchParams(rawSearch);
  for (const [key, value] of parameters.entries()) {
    if (!allowedKeys.has(key)) return false;
    const allowedValues = SAFE_QUERY_VALUES[key];
    if (!allowedValues?.has(value)) return false;
  }
  return true;
}

export function isMetaPixelReferrerAllowed({ referrer, origin }) {
  const value = String(referrer ?? "").trim();
  if (!value) return true;

  let referrerUrl;
  let currentOrigin;
  try {
    referrerUrl = new URL(value);
    currentOrigin = new URL(String(origin ?? "")).origin;
  } catch {
    return false;
  }

  if (referrerUrl.origin !== currentOrigin) {
    return (
      referrerUrl.pathname === "/" &&
      !referrerUrl.search &&
      !referrerUrl.hash
    );
  }
  return isMetaPixelPageViewAllowed({
    pathname: referrerUrl.pathname,
    search: referrerUrl.search,
    hash: referrerUrl.hash,
  });
}

export function buildMetaPixelBootstrap(value) {
  const pixelId = normalizeMetaPixelId(value);
  if (!pixelId) return null;

  return `!function(f,b,e,v,n,t,s){if(!f.fbq){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.referrerPolicy='no-referrer';t.src=v;t.setAttribute('data-fanmind-meta-pixel','true');s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}if(f.__fanmindMetaPixelId&&f.__fanmindMetaPixelId!=='${pixelId}')return;if(f.__fanmindMetaPixelId==='${pixelId}')return;f.fbq('set','autoConfig',false,'${pixelId}');f.fbq('init','${pixelId}');f.__fanmindMetaPixelId='${pixelId}';f.dispatchEvent(new Event('${META_PIXEL_READY_EVENT}'))}(window,document,'script','${META_PIXEL_SCRIPT_URL}');`;
}
