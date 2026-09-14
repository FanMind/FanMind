import { randomUUID } from "node:crypto";
import { lstat, open, rename, unlink } from "node:fs/promises";

const MAX_BYTES = 8192;

async function readPayload(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw new Error("daily_settings_invalid");
    const handle = await open(file, "r");
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > MAX_BYTES) throw new Error("daily_settings_invalid");
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > MAX_BYTES) throw new Error("daily_settings_invalid");
      const value = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("daily_settings_invalid");
      if (Object.hasOwn(value, "publicDailyPlanEnabled") && typeof value.publicDailyPlanEnabled !== "boolean") throw new Error("daily_settings_invalid");
      return { value, missing: false };
    } finally { await handle.close(); }
  } catch (error) {
    if (error?.code === "ENOENT") return { value: {}, missing: true };
    throw new Error("daily_settings_unavailable");
  }
}

export async function readDailyPlanSettings(file) {
  try {
    const { value } = await readPayload(file);
    // Preserve the already published catalog until the owner explicitly sets
    // this new switch. The historical 24-hour beta window is not this switch.
    if (!Object.hasOwn(value, "publicDailyPlanEnabled")) return { enabled: true, available: true, source: "default" };
    return { enabled: value.publicDailyPlanEnabled, available: true, source: "saved" };
  } catch {
    return { enabled: false, available: false, source: "unavailable" };
  }
}

export async function writeDailyPlanSettings(file, enabled, updatedBy) {
  if (typeof enabled !== "boolean" || typeof updatedBy !== "string" || !updatedBy.trim() || updatedBy.length > 254) throw new Error("daily_settings_invalid");
  const { value } = await readPayload(file);
  const payload = { ...value, publicDailyPlanEnabled: enabled, updatedAt: new Date().toISOString(), updatedBy };
  const text = JSON.stringify(payload) + "\n";
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error("daily_settings_invalid");
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch {
    throw new Error("daily_settings_write_failed");
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
  }
}
