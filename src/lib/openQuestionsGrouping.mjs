// Pure workspace-local grouping; never aggregate questions across tenants.
// Input should contain privacy-reviewed excerpts, not raw visitor contact data.
export function normalizeQuestion(text) {
  return String(text ?? "").normalize("NFKC").toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function groupOpenQuestions(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row || !row.workspace_id || !row.id) continue;
    const normalized = normalizeQuestion(row.question);
    if (!normalized) continue;
    const key = JSON.stringify([row.workspace_id, normalized]);
    const previous = grouped.get(key);
    if (previous) {
      previous.count += 1;
      previous.ids.push(row.id);
      if (String(row.created_at) > String(previous.latest_at)) previous.latest_at = row.created_at;
    } else {
      grouped.set(key, {
        workspace_id: row.workspace_id,
        normalized_question: normalized,
        excerpt: row.question,
        count: 1,
        ids: [row.id],
        latest_at: row.created_at,
      });
    }
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || String(b.latest_at).localeCompare(String(a.latest_at)));
}

// Dashboard ranking excludes completed questions while retaining them in the full list.
export function groupUnresolvedOpenQuestions(rows) {
  return groupOpenQuestions(rows.filter(row => row?.status === "open" || row?.status === "in_review"));
}
