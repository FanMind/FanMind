/**
 * Combines conversation and follow-up candidates without hiding uncovered work.
 * Conversations are authoritative for a fan; otherwise the strongest open
 * follow-up wins. The final order is deterministic.
 *
 * @template T
 * @param {{ conversations: T[], followups: T[] }} input
 * @param {(item: T) => { dedupeKey: string, priorityScore: number, waitingMinutes: number, stableKey: string }} describe
 * @returns {T[]}
 */
export function buildUnifiedInboxQueue(input, describe) {
  const conversations = dedupeCandidates(input.conversations, describe);
  const coveredFans = new Set(
    conversations.map((item) => describe(item).dedupeKey),
  );
  const uncoveredFollowups = dedupeCandidates(
    input.followups.filter(
      (item) => !coveredFans.has(describe(item).dedupeKey),
    ),
    describe,
  );

  return [...conversations, ...uncoveredFollowups].sort((left, right) =>
    compareCandidates(describe(left), describe(right)),
  );
}

function dedupeCandidates(items, describe) {
  const selected = new Map();

  for (const item of items) {
    const candidate = describe(item);
    const existing = selected.get(candidate.dedupeKey);

    if (!existing || compareCandidates(candidate, describe(existing)) < 0) {
      selected.set(candidate.dedupeKey, item);
    }
  }

  return Array.from(selected.values());
}

function compareCandidates(left, right) {
  return (
    right.priorityScore - left.priorityScore ||
    right.waitingMinutes - left.waitingMinutes ||
    left.stableKey.localeCompare(right.stableKey, "en")
  );
}
