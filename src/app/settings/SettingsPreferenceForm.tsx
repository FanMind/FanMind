"use client";

import { useMemo, useState } from "react";
import dashboardStyles from "../dashboard/dashboard.module.css";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import {
  FANMIND_BRIGHTNESS_MAX,
  FANMIND_BRIGHTNESS_MIN,
  normalizeFanMindBrightness,
  type FanMindBrightness,
} from "@/lib/userPreferences";
import { getThemeClass } from "@/lib/userPreferences";
import { wt } from "@/lib/workspaceCopy";

type SettingsPreferenceFormProps = {
  action: (formData: FormData) => void;
  locale: FanMindLanguage;
  brightness: FanMindBrightness;
  returnTo?: string;
  formClassName?: string;
  buttonClassName?: string;
};

function getBrightnessLabel(locale: FanMindLanguage, value: number) {
  if (value >= 115) return locale === "en" ? "Bright" : "Hell";
  if (value >= 95) return locale === "en" ? "Brighter" : "Heller";
  if (value <= 65) return locale === "en" ? "Dimmed" : "Gedimmt";
  return locale === "en" ? "Standard" : "Standard";
}

function applyBrightness(value: number) {
  const normalized = normalizeFanMindBrightness(value);
  document.documentElement.classList.remove("fanmind-theme-standard", "fanmind-theme-brighter", "fanmind-theme-light");
  document.documentElement.classList.add(getThemeClass(normalized));
  document.documentElement.style.setProperty("--fanmind-dimmer", String(normalized));
  document.documentElement.style.setProperty("--fanmind-brightness-filter", String(normalized / 80));
  document.documentElement.style.setProperty("--fanmind-dimmer-bg-lift", String(Math.max(0, (normalized - 80) / 40)));
  localStorage.setItem("fanmind_brightness", String(normalized));
}

export function SettingsPreferenceForm({ action, locale, brightness, returnTo = "/settings", formClassName, buttonClassName }: SettingsPreferenceFormProps) {
  const [brightnessValue, setBrightnessValue] = useState(normalizeFanMindBrightness(brightness));
  const brightnessLabel = useMemo(
    () => `${getBrightnessLabel(locale, brightnessValue)} · ${brightnessValue}%`,
    [brightnessValue, locale],
  );

  return (
    <form action={action} className={[dashboardStyles.preferenceToolbar, formClassName].filter(Boolean).join(" ")}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <fieldset className={dashboardStyles.compactPreferenceGroup}>
        <legend>{wt(locale, "Sprache")}</legend>
        <div className={dashboardStyles.segmentedLanguageControl}>
          {[
            { value: "de", label: "Deutsch", flag: "🇩🇪" },
            { value: "en", label: "English", flag: "🇬🇧" },
          ].map((option) => (
            <label key={option.value} className={dashboardStyles.languageSegment}>
              <input type="radio" name="locale" value={option.value} defaultChecked={locale === option.value} />
              <span aria-hidden="true">{option.flag}</span>
              <strong>{option.label}</strong>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${dashboardStyles.compactPreferenceGroup} ${dashboardStyles.brightnessSliderGroup}`}>
        <legend>{wt(locale, "Helligkeit")}</legend>
        <input type="hidden" name="brightness" value={brightnessValue} />
        <div className={dashboardStyles.sliderHeader}>
          <span>{wt(locale, "Dark-Look")}</span>
          <strong>{brightnessLabel}</strong>
        </div>
        <input
          className={dashboardStyles.brightnessSlider}
          type="range"
          min={FANMIND_BRIGHTNESS_MIN}
          max={FANMIND_BRIGHTNESS_MAX}
          step="1"
          value={brightnessValue}
          aria-valuetext={brightnessLabel}
          onChange={(event) => {
            const next = normalizeFanMindBrightness(event.currentTarget.value);
            setBrightnessValue(next);
            applyBrightness(next);
          }}
        />
        <div className={dashboardStyles.sliderScale} aria-hidden="true">
          <span>{locale === "en" ? "50 dim" : "50 gedimmt"}</span>
          <span>{locale === "en" ? "80 standard" : "80 Standard"}</span>
          <span>{locale === "en" ? "120 bright" : "120 hell"}</span>
        </div>
      </fieldset>

      <button type="submit" className={[dashboardStyles.primaryButton, buttonClassName].filter(Boolean).join(" ")}>{wt(locale, "Einstellungen speichern")}</button>
    </form>
  );
}
