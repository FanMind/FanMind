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

const BOOT_ID_PATH = "/proc/sys/kernel/random/boot_id";

async function readProcessStartId(pid: number): Promise<string | null> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/u);
    return fields[19] && /^\d+$/u.test(fields[19]) ? fields[19] : null;
  } catch {
    return null;
  }
}

async function currentLockOwner(token = randomUUID()) {
  const bootId = (await readFile(BOOT_ID_PATH, "utf8")).trim();
  if (!/^[0-9a-f-]{36}$/u.test(bootId)) throw new Error("daily_beta_update_in_progress");
  const processStartId = await readProcessStartId(process.pid);
  if (!processStartId) throw new Error("daily_beta_update_in_progress");
  return { token, pid: process.pid, bootId, processStartId };
}

async function lockOwnerAlive(
  owner: { pid: number; bootId: string; processStartId: string },
  bootId: string,
) {
  if (owner.bootId !== bootId || !Number.isSafeInteger(owner.pid) || owner.pid < 1) return false;
  return owner.processStartId === await readProcessStartId(owner.pid);
}

async function acquireSettingsLock(lockPath: string) {
  const owner = await currentLockOwner();
  const serializedOwner = `${JSON.stringify(owner)}\n`;
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(serializedOwner, "utf8");
    await handle.sync();
    return { handle, serializedOwner };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  try {
    const existingPayload = await readFile(lockPath, "utf8");
    const existingOwner = JSON.parse(existingPayload) as {
      pid: number;
      bootId: string;
      processStartId: string;
    };
    if (await lockOwnerAlive(existingOwner, owner.bootId)) {
      throw new Error("daily_beta_update_in_progress");
    }
    const staleClaimPath = `${lockPath}.${randomUUID()}.stale`;
    await rename(lockPath, staleClaimPath);
    if (await readFile(staleClaimPath, "utf8") !== existingPayload) {
      throw new Error("daily_beta_update_in_progress");
    }
    await unlink(staleClaimPath).catch(() => undefined);
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(serializedOwner, "utf8");
    await handle.sync();
    return { handle, serializedOwner };
  } catch (error) {
    if ((error as Error).message === "daily_beta_update_in_progress") throw error;
    throw new Error("daily_beta_update_in_progress");
  }
}

async function releaseSettingsLock(
  lockPath: string,
  lock: { handle: Awaited<ReturnType<typeof open>>; serializedOwner: string },
) {
  await lock.handle.close().catch(() => undefined);
  const currentToken = await readFile(lockPath, "utf8").catch(() => "");
  if (currentToken === lock.serializedOwner) {
    await unlink(lockPath).catch(() => undefined);
  }
}

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
  let lock;
  try {
    lock = await acquireSettingsLock(lockPath);
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
    await releaseSettingsLock(lockPath, lock);
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
