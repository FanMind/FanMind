export type FanMindMarketingConsent = "unset" | "denied" | "granted";

export type MetaPixelActiveEventName = "PageView";
export type MetaPixelPreparedEventName =
  | "CompleteRegistration"
  | "Lead"
  | "ViewContent"
  | "Contact"
  | "Schedule"
  | "StartTrial"
  | "Purchase";
export type MetaPixelEventName =
  | MetaPixelActiveEventName
  | MetaPixelPreparedEventName;

export const FANMIND_MARKETING_CONSENT_COOKIE: string;
export const FANMIND_MARKETING_CONSENT_MAX_AGE_SECONDS: number;
export const META_PIXEL_SCRIPT_URL: string;
export const META_PIXEL_READY_EVENT: string;
export const META_PIXEL_ACTIVE_EVENTS: readonly MetaPixelActiveEventName[];
export const META_PIXEL_PREPARED_EVENTS: readonly MetaPixelPreparedEventName[];
export const META_PIXEL_STANDARD_EVENTS: readonly MetaPixelEventName[];
export const META_PIXEL_PUBLIC_ROUTES: readonly string[];

export function normalizeMarketingConsent(
  value: unknown,
): FanMindMarketingConsent;
export function normalizeMetaPixelId(value: unknown): string | null;
export function isMetaPixelEnabled(input: {
  pixelId: unknown;
  consent: unknown;
}): boolean;
export function isSupportedMetaPixelEvent(
  eventName: unknown,
): eventName is MetaPixelEventName;
export function isActiveMetaPixelEvent(
  eventName: unknown,
): eventName is MetaPixelActiveEventName;
export function normalizeMetaPixelRoute(pathname: unknown): string;
export function isMetaPixelPublicRoute(pathname: unknown): boolean;
export function isMetaPixelPageViewAllowed(input: {
  pathname: unknown;
  search?: unknown;
  hash?: unknown;
}): boolean;
export function isMetaPixelReferrerAllowed(input: {
  referrer: unknown;
  origin: unknown;
}): boolean;
export function buildMetaPixelBootstrap(value: unknown): string | null;
