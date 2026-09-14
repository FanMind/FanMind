export function getPublicDailyBetaStatus(
  settings: unknown,
  now?: Date,
): { enabled: boolean; updatedAt: string | null };
export function createPublicDailyBetaSettings(
  enabled: boolean,
  updatedBy: string,
  now?: Date,
): {
  publicDailyTestPlanEnabled: boolean;
  publicDailyTestPlanEnabledUntil: null;
  updatedAt: string;
  updatedBy: string;
};
