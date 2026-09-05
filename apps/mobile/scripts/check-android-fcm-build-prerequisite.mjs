import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const expectedPackage = "ch.fanmind.app";
const configPath = String(process.env.GOOGLE_SERVICES_JSON ?? "").trim();

assert.ok(configPath, "ANDROID_FCM_PREVIEW_CONFIG_MISSING");
assert.doesNotMatch(configPath, /[\r\n\0]/u, "ANDROID_FCM_PREVIEW_CONFIG_INVALID_PATH");

const fileStat = await stat(configPath);
assert.ok(fileStat.isFile(), "ANDROID_FCM_PREVIEW_CONFIG_NOT_FILE");

const parsed = JSON.parse(await readFile(configPath, "utf8"));
const clients = Array.isArray(parsed?.client) ? parsed.client : [];
const packageMatches = clients.some(
  (client) => client?.client_info?.android_client_info?.package_name === expectedPackage,
);

assert.equal(packageMatches, true, "ANDROID_FCM_PREVIEW_PACKAGE_MISMATCH");
assert.ok(
  typeof parsed?.project_info?.project_id === "string" &&
    parsed.project_info.project_id.trim().length > 0,
  "ANDROID_FCM_PREVIEW_PROJECT_ID_MISSING",
);

console.log("ANDROID_FCM_SIGNED_BUILD_PREREQUISITE=PASS");
