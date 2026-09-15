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
  publicDailyTestPlanCleanupRequired?: boolean;
  publicDailyTestPlanRevision?: string;
};

// Production intentionally runs one PM2 worker. Request overlap therefore needs
// only a process-local critical section; process exit also clears it without a
// persistent lock file that could become stale or be replaced between checks.
let settingsUpdateInProgress = false;

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

async function readRuntimeSettings(): Promise<Partial<RuntimeProductSettings>> {
  return JSON.parse(
    await readFile(
      /* turbopackIgnore: true */ getSettingsPath(),
      "utf8",
    ),
  ) as Partial<RuntimeProductSettings>;
}

export async function getPublicDailyBetaStatusFromServer(): Promise<{
  enabled: boolean;
  updatedAt: string | null;
  cleanupRequired: boolean;
}> {
  try {
    const payload = await readRuntimeSettings();
    return {
      ...getPublicDailyBetaStatus(payload),
      cleanupRequired: payload.publicDailyTestPlanCleanupRequired === true,
    };
  } catch {
    return { enabled: false, updatedAt: null, cleanupRequired: true };
  }
}

export async function getPublicDailyTestPlanEnabled(): Promise<boolean> {
  return (await getPublicDailyBetaStatusFromServer()).enabled;
}

export async function setPublicDailyTestPlanEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<{ revision: string }> {
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;
  if (settingsUpdateInProgress) {
    throw new Error("daily_beta_update_in_progress");
  }
  settingsUpdateInProgress = true;

  try {
    if (enabled) {
      const current = await readRuntimeSettings().catch(() => null);
      if (!current || current.publicDailyTestPlanCleanupRequired === true) {
        throw new Error("daily_beta_cleanup_required");
      }
    }
    const revision = randomUUID();
    const payload: RuntimeProductSettings = createPublicDailyBetaSettings(
      enabled,
      updatedBy,
    );
    payload.publicDailyTestPlanCleanupRequired = !enabled;
    payload.publicDailyTestPlanRevision = revision;
    await writeFileExclusive(temporaryPath, payload);
    await rename(temporaryPath, settingsPath);
    await chmod(settingsPath, 0o600);
    return { revision };
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
    settingsUpdateInProgress = false;
  }
}

export async function markPublicDailyTestPlanCleanupComplete(
  expectedRevision: string,
  updatedBy: string,
): Promise<void> {
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;
  if (settingsUpdateInProgress) throw new Error("daily_beta_update_in_progress");
  settingsUpdateInProgress = true;
  try {
    const current = await readRuntimeSettings();
    if (
      current.publicDailyTestPlanEnabled !== false ||
      current.publicDailyTestPlanCleanupRequired !== true ||
      current.publicDailyTestPlanRevision !== expectedRevision
    ) {
      throw new Error("daily_beta_revision_changed");
    }
    const payload: RuntimeProductSettings = {
      ...createPublicDailyBetaSettings(false, updatedBy),
      publicDailyTestPlanCleanupRequired: false,
      publicDailyTestPlanRevision: randomUUID(),
    };
    await writeFileExclusive(temporaryPath, payload);
    await rename(temporaryPath, settingsPath);
    await chmod(settingsPath, 0o600);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
    settingsUpdateInProgress = false;
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
