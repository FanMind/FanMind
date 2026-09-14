export type DailyPlanSettingsState = { enabled: boolean; available: boolean; source: "default" | "saved" | "unavailable" };
export function readDailyPlanSettings(file: string): Promise<DailyPlanSettingsState>;
export function writeDailyPlanSettings(file: string, enabled: boolean, updatedBy: string): Promise<void>;
