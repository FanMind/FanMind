import {
  isMetaPixelPageViewAllowed,
  isMetaPixelReferrerAllowed,
  isActiveMetaPixelEvent,
  normalizeMarketingConsent,
  normalizeMetaPixelId,
  normalizeMetaPixelRoute,
  type FanMindMarketingConsent,
  type MetaPixelActiveEventName,
} from "@/lib/metaPixelPolicy.mjs";

type MetaPixelQueueFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: MetaPixelQueueFunction;
    _fbq?: MetaPixelQueueFunction;
    __fanmindMarketingConsent?: FanMindMarketingConsent;
    __fanmindMetaPixelId?: string;
    __fanmindMetaPixelLastRoute?: string | null;
  }
}

function inBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function currentPageIsEligible(): boolean {
  return (
    inBrowser() &&
    isMetaPixelPageViewAllowed({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    }) &&
    isMetaPixelReferrerAllowed({
      referrer: document.referrer,
      origin: window.location.origin,
    })
  );
}

function pageViewKey(pathname: unknown, search: unknown): string {
  const route = normalizeMetaPixelRoute(pathname);
  const parameters = new URLSearchParams(
    String(search ?? "").trim().replace(/^\?/u, ""),
  );
  parameters.sort();
  const query = parameters.toString();
  return query ? `${route}?${query}` : route;
}

export function setFanMindMarketingConsent(
  consent: FanMindMarketingConsent,
): void {
  if (!inBrowser()) return;
  const normalized = normalizeMarketingConsent(consent);
  window.__fanmindMarketingConsent = normalized;
  window.dispatchEvent(
    new CustomEvent("fanmind:marketing-consent", {
      detail: normalized,
    }),
  );
}

export function markMetaPixelInitialized(value: unknown): boolean {
  if (!inBrowser() || typeof window.fbq !== "function") return false;
  const pixelId = normalizeMetaPixelId(value);
  if (!pixelId) return false;
  if (
    window.__fanmindMetaPixelId &&
    window.__fanmindMetaPixelId !== pixelId
  ) {
    return false;
  }
  window.__fanmindMetaPixelId = pixelId;
  return true;
}

export function grantMetaPixelConsent(): void {
  if (!inBrowser() || typeof window.fbq !== "function") return;
  window.fbq("consent", "grant");
}

function expireFirstPartyMetaCookie(name: "_fbp" | "_fbc"): void {
  if (!inBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

export function revokeMetaPixelConsent(): void {
  if (!inBrowser()) return;
  if (typeof window.fbq === "function") {
    window.fbq("consent", "revoke");
  }
  window.__fanmindMetaPixelLastRoute = null;
  expireFirstPartyMetaCookie("_fbp");
  expireFirstPartyMetaCookie("_fbc");
}

export function trackMetaPixelEvent(eventName: MetaPixelActiveEventName): boolean {
  if (
    !inBrowser() ||
    window.__fanmindMarketingConsent !== "granted" ||
    typeof window.fbq !== "function" ||
    !currentPageIsEligible() ||
    !isActiveMetaPixelEvent(eventName)
  ) {
    return false;
  }

  // Intentionally no event-parameter object: this helper cannot forward email,
  // names, CRM records, messages, contact IDs or advanced-matching data.
  window.fbq("track", eventName);
  return true;
}

export function trackMetaPixelPageView(input: {
  pathname: unknown;
  search?: unknown;
  hash?: unknown;
}): boolean {
  if (!inBrowser() || !isMetaPixelPageViewAllowed(input)) return false;
  const routeKey = pageViewKey(input.pathname, input.search);
  if (window.__fanmindMetaPixelLastRoute === routeKey) return false;
  if (!trackMetaPixelEvent("PageView")) return false;
  window.__fanmindMetaPixelLastRoute = routeKey;
  return true;
}
