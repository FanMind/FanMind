import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const reportPath = String(process.argv[2] ?? "").trim();
assert.ok(reportPath, "ANDROID_FCM_PREVIEW_METADATA_REPORT_MISSING");
assert.doesNotMatch(
  reportPath,
  /[\r\n\0]/u,
  "ANDROID_FCM_PREVIEW_METADATA_REPORT_INVALID_PATH",
);

const rawReport = await readFile(reportPath, "utf8");
const report = rawReport.replace(/\u001b\[[0-9;]*m/gu, "");
const lines = report.split(/\r?\n/u).map((line) => line.trim());

const nameIndex = lines.findIndex((line) =>
  /^Name\s+GOOGLE_SERVICES_JSON$/iu.test(line),
);
assert.ok(nameIndex >= 0, "ANDROID_FCM_PREVIEW_CONFIG_METADATA_MISSING");

const nextVariableIndex = lines.findIndex(
  (line, index) => index > nameIndex && /^Name\s+/u.test(line),
);
const block = lines.slice(
  nameIndex,
  nextVariableIndex === -1 ? undefined : nextVariableIndex,
);

assert.ok(
  block.some((line) => /^Scope\s+PROJECT$/iu.test(line)),
  "ANDROID_FCM_PREVIEW_CONFIG_SCOPE_MISMATCH",
);
assert.ok(
  block.some((line) => /^Visibility\s+SECRET$/iu.test(line)),
  "ANDROID_FCM_PREVIEW_CONFIG_VISIBILITY_MISMATCH",
);
assert.ok(
  block.some((line) => /^Environments\s+preview$/iu.test(line)),
  "ANDROID_FCM_PREVIEW_CONFIG_ENVIRONMENT_MISMATCH",
);
assert.ok(
  block.some((line) => /^type\s+file$/iu.test(line)),
  "ANDROID_FCM_PREVIEW_CONFIG_TYPE_MISMATCH",
);

console.log("ANDROID_FCM_SIGNED_BUILD_PREREQUISITE=PASS");
