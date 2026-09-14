import "server-only";

import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createTemporaryPublicDailyTestPlanSettings,
  getTemporaryPublicDailyTestPlanStatus,
} from "@/lib/publicDailyTestPlanPolicy.mjs";

type RuntimeProductSettings = {
  publicDailyTestPlanEnabled: boolean;
  publicDailyTestPlanEnabledUntil?: string | null;
  updatedAt?: string;
  updatedBy?: string;
};

function getSettingsPath(): string {
  const configured = process.env.FANMIND_RUNTIME_SETTINGS_FILE?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? "/var/www/fanmind/.fanmind-runtime-settings.json"
    : path.join(
        /* turbopackIgnore: true */ process.cwd(),
        ".fanmind-runtime-settings.json",
      );
}

export async function getPublicDailyTestPlanEnabled(): Promise<boolean> {
  try {
    const payload = JSON.parse(
      await readFile(
        /* turbopackIgnore: true */ getSettingsPath(),
        "utf8",
      ),
    ) as Partial<RuntimeProductSettings>;
    return getTemporaryPublicDailyTestPlanStatus(payload).enabled;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    return false;
  }
}

export async function setPublicDailyTestPlanEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;
  const payload: RuntimeProductSettings = createTemporaryPublicDailyTestPlanSettings(
    enabled,
    updatedBy,
  );

  await writeFile(temporaryPath, `${JSON.stringify(payload)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });

  try {
    await rename(temporaryPath, settingsPath);
    await chmod(settingsPath, 0o600);
  } catch (error) {
    const { unlink } = await import("node:fs/promises");
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
