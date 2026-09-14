import "server-only";

import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createPublicDailyOfferSettings, readPublicDailyOfferEnabled } from "@/lib/publicDailyOfferSettingsPolicy.mjs";

function getSettingsPath(): string {
  const configured = process.env.FANMIND_RUNTIME_SETTINGS_FILE?.trim();
  if (configured) return configured;
  // Next production mode also serves Staging; never share its settings file.
  const runtime = process.env.FANMIND_RUNTIME_ENVIRONMENT?.trim();
  const isolatedRuntime = ["staging", "test", "development"].includes(runtime ?? "");
  return process.env.NODE_ENV === "production" && !isolatedRuntime
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
    ) as Record<string, unknown>;
    return readPublicDailyOfferEnabled(payload);
  } catch (error) {
    // Preserve the already-public offer on first deployment; malformed reads fail closed.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    return false;
  }
}

export async function setPublicDailyTestPlanEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  const settingsPath = getSettingsPath();
  const temporaryPath = `${settingsPath}.${randomUUID()}.tmp`;
  let previous: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ settingsPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_settings");
    previous = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const payload = createPublicDailyOfferSettings(enabled, updatedBy, previous);

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
