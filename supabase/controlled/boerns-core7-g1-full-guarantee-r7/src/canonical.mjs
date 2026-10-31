import { createHash } from "node:crypto";

const PART = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function claimKey({ taskId, stepId, revision }) {
  for (const [name, value] of Object.entries({ taskId, stepId, revision })) {
    if (value === null || value === undefined || !PART.test(String(value))) {
      throw new TypeError(`invalid ${name}`);
    }
  }
  return `${taskId}:${stepId}:${revision}`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

export function payloadDigest(payload) {
  const canonical = JSON.stringify(sortValue(payload));
  return createHash("sha256").update(canonical).digest("hex");
}
