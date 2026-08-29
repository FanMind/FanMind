const FOLLOWUP_PRIORITIES = new Set(["low", "normal", "high"]);

function localDateString(from = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeManualFollowupDraft(input, today = localDateString()) {
  const reason = String(input?.reason ?? "").trim();
  const dueDate = String(input?.dueDate ?? input?.due_date ?? "").trim();
  const priority = String(input?.priority ?? "normal").trim().toLowerCase();
  const errors = [];

  if (!reason || reason.length > 500) errors.push("reason");
  if (!isCalendarDate(dueDate)) errors.push("due_date");
  else if (dueDate < today) errors.push("due_date_past");
  if (!FOLLOWUP_PRIORITIES.has(priority)) errors.push("priority");

  if (errors.length) return { ok: false, value: null, errors };
  return { ok: true, value: { reason, due_date: dueDate, priority }, errors: [] };
}
