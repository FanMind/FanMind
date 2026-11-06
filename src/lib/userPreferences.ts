import type { SupabaseServerUser } from "@/lib/supabase/server";
import type { FanMindLanguage } from "@/lib/fanmindCopy";

export type FanMindBrightness = number;

export const FANMIND_BRIGHTNESS_COOKIE = "fanmind_brightness";

export const FANMIND_BRIGHTNESS_MIN = 50;
export const FANMIND_BRIGHTNESS_MAX = 120;
export const FANMIND_BRIGHTNESS_DEFAULT = 80;

export function normalizeFanMindBrightness(value: unknown): FanMindBrightness {
  if (value === "standard") return 80;
  if (value === "brighter") return 100;
  if (value === "light") return 120;

  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(numeric)) return FANMIND_BRIGHTNESS_DEFAULT;
  return Math.min(FANMIND_BRIGHTNESS_MAX, Math.max(FANMIND_BRIGHTNESS_MIN, Math.round(numeric)));
}

export function getUserMetadataBrightness(
  user?: Pick<SupabaseServerUser, "user_metadata"> | null,
): FanMindBrightness | null {
  const value = user?.user_metadata?.fanmind_brightness;
  if (value == null) return null;
  return normalizeFanMindBrightness(value);
}

export function getThemeClass(brightness: FanMindBrightness): string {
  const value = normalizeFanMindBrightness(brightness);
  if (value >= 115) return "fanmind-theme-light";
  if (value >= 95) return "fanmind-theme-brighter";
  return "fanmind-theme-standard";
}

export function getBrightnessStyle(brightness: FanMindBrightness): string {
  const value = normalizeFanMindBrightness(brightness);
  const boost = (value - FANMIND_BRIGHTNESS_DEFAULT) / 40;
  const bgLift = Math.max(0, boost);
  return [
    `--fanmind-dimmer:${value}`,
    `--fanmind-brightness-filter:${(value / FANMIND_BRIGHTNESS_DEFAULT).toFixed(3)}`,
    `--fanmind-dimmer-bg-lift:${bgLift.toFixed(3)}`,
  ].join(";");
}

export function preferenceCookieOptions(maxAge = 60 * 60 * 24 * 365) {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function getPreferenceMetadata(input: {
  currentMetadata?: Record<string, unknown>;
  locale: FanMindLanguage;
  brightness: FanMindBrightness;
}) {
  return {
    ...(input.currentMetadata ?? {}),
    fanmind_locale: input.locale === "en" ? "en" : "de",
    locale: input.locale === "en" ? "en" : "de",
    fanmind_brightness: normalizeFanMindBrightness(input.brightness),
  };
}
