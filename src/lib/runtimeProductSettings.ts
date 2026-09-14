import "server-only";

import { randomUUID } from "node:crypto";
import { chmod, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import {
  createPublicDailyBetaSettings,
  getPublicDailyBetaStatus,
} from "@/lib/publicDailyTestPlanPolicy.mjs";

type RuntimeProductSettings = {
  publicDailyTestPlanEnabled: boolean;
  publicDailyTestPlanEnabledUntil?: null;
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

export async function getPublicDailyBetaStatusFromServer(): Promise<{ enabled: boolean; updatedAt: string | null }> {
  try {
    const payload = JSON.parse(
      await readFile(
        /* turbopackIgnore: true */ getSettingsPath(),
        "utf8",
      ),
    ) as Partial<RuntimeProductSettings>;
    return getPublicDailyBetaStatus(payload);
  } catch {
    return { enabled: false, updatedAt: null };
  }
}

export async function getPublicDailyTestPlanEnabled(): Promise<boolean> {
  return (await getPublicDailyBetaStatusFromServer()).enabled;
}

export async function setPublicDailyTestPlanEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;
  const lockPath = `${settingsPath}.lock`;
  let lockHandle;
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
  } catch {
    throw new Error("daily_beta_update_in_progress");
  }

  try {
    const payload: RuntimeProductSettings = createPublicDailyBetaSettings(
      enabled,
      updatedBy,
    );
    await writeFileExclusive(temporaryPath, payload);
    await rename(temporaryPath, settingsPath);
    await chmod(settingsPath, 0o600);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
    await lockHandle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
}

async function writeFileExclusive(pathname: string, payload: RuntimeProductSettings) {
  const handle = await open(pathname, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(payload)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
