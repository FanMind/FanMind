"use client";

import { useEffect } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import type { FanMindBrightness } from "@/lib/userPreferences";
import { getThemeClass, normalizeFanMindBrightness } from "@/lib/userPreferences";

const LOCALE_STORAGE_KEY = "fanmind_locale";
const BRIGHTNESS_STORAGE_KEY = "fanmind_brightness";

export function UserPreferenceFallback({
  locale,
  brightness,
}: {
  locale: FanMindLanguage;
  brightness: FanMindBrightness;
}) {
  useEffect(() => {
    const normalized = normalizeFanMindBrightness(brightness);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    localStorage.setItem(BRIGHTNESS_STORAGE_KEY, String(normalized));
    document.documentElement.lang = locale;
    document.documentElement.classList.remove(
      "fanmind-theme-standard",
      "fanmind-theme-brighter",
      "fanmind-theme-light",
    );
    document.documentElement.classList.add(getThemeClass(normalized));
    document.documentElement.style.setProperty("--fanmind-dimmer", String(normalized));
    document.documentElement.style.setProperty("--fanmind-brightness-filter", String(normalized / 80));
    document.documentElement.style.setProperty("--fanmind-dimmer-bg-lift", String(Math.max(0, (normalized - 80) / 40)));
  }, [brightness, locale]);

  return null;
}
