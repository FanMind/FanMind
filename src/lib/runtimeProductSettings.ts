import "server-only";
import path from "node:path";
import { readDailyPlanSettings, writeDailyPlanSettings } from "@/lib/dailyPlanSettings.mjs";

function getSettingsPath(): string {
  const configured = process.env.FANMIND_RUNTIME_SETTINGS_FILE?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? "/var/www/fanmind/.fanmind-runtime-settings.json"
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".fanmind-runtime-settings.json");
}

// No process cache: every worker and every new request observes the same
// atomic, deployment-persistent admin setting. Only the boolean is public.
export async function getPublicDailyPlanState() {
  return readDailyPlanSettings(/* turbopackIgnore: true */ getSettingsPath());
}

// Compatibility names retained for existing call sites; no 24-hour expiry.
export async function getPublicDailyTestPlanEnabled(): Promise<boolean> {
  return (await getPublicDailyPlanState()).enabled;
}

export async function setPublicDailyTestPlanEnabled(enabled: boolean, updatedBy: string): Promise<void> {
  await writeDailyPlanSettings(/* turbopackIgnore: true */ getSettingsPath(), enabled, updatedBy);
}
