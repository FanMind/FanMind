"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Synchronous helper for PM2's CommonJS configuration.
const { readFileSync } = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Synchronous helper for PM2's CommonJS configuration.
const { join } = require("node:path");

function parseSupportSetting(source) {
  if (Buffer.byteLength(source) > 1048576) throw new Error("support_environment_too_large");
  const matches = [...source.matchAll(/^[ \t]*FANMIND_SUPPORT_CENTRE_ENABLED[ \t]*=(.*)$/gm)];
  if (matches.length > 1) throw new Error("support_environment_ambiguous");
  if (!matches.length) return "false";
  const value = matches[0][1].trim();
  if (value !== "true" && value !== "false") throw new Error("support_environment_invalid");
  return value;
}
function readSupportSetting(currentReleaseLink) {
  return parseSupportSetting(readFileSync(join(currentReleaseLink, ".env.production"), "utf8"));
}
module.exports = { parseSupportSetting, readSupportSetting };
