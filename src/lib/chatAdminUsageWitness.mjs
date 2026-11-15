export const CHAT_ADMIN_USAGE_HEADER = "x-fanmind-chatadmin-usage";
export const CHAT_ADMIN_MANUAL_GENERATIONS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fail = () => { throw Error("CHAT_ADMIN_MANUAL_FLOW_ERROR=usage_witness"); };

// This is a server-attempt witness, created before the independent usage write.
// It contains only random event IDs and fixed statuses, never model or fan data.
export function parseChatAdminUsageHeader(header) {
  if (typeof header !== "string" || header.length > 85) fail();
  const attempts = header.split(",").map(value => {
    const [status, id, extra] = value.split(":");
    if (extra !== undefined || !["ok", "error"].includes(status) || !UUID.test(id ?? "")) fail();
    return {id, status};
  });
  if (![1, 2].includes(attempts.length) || attempts.at(-1).status !== "ok" ||
      (attempts.length === 2 && attempts[0].status !== "error") ||
      new Set(attempts.map(value => value.id)).size !== attempts.length) fail();
  return attempts;
}

export function validateChatAdminUsageWitness(witness, complete = false) {
  if (!Array.isArray(witness) || witness.length > CHAT_ADMIN_MANUAL_GENERATIONS ||
      (complete && witness.length !== CHAT_ADMIN_MANUAL_GENERATIONS)) fail();
  const generations = new Set(), eventIds = new Set(), attempts = [];
  for (const row of witness) {
    if (!row || Object.keys(row).length !== 2 || !UUID.test(row.generationId ?? "") ||
        generations.has(row.generationId) || !Array.isArray(row.attempts)) fail();
    generations.add(row.generationId);
    const parsed = parseChatAdminUsageHeader(row.attempts.map(value => {
      if (!value || Object.keys(value).length !== 2 || !Object.hasOwn(value, "id") || !Object.hasOwn(value, "status")) fail();
      return `${value.status}:${value.id}`;
    }).join(","));
    for (const attempt of parsed) {
      if (eventIds.has(attempt.id)) fail();
      eventIds.add(attempt.id); attempts.push(attempt);
    }
  }
  return attempts;
}
