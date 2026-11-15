export function normalizeInboxView(value) {
  return value === "chats" || value === "comments" ? value : "all";
}

export function matchesInboxView(item, view) {
  if (view === "all") return true;
  if (!item.conversationId) return false;
  return view === "comments"
    ? item.sourceType === "comment" || item.sourceType === "post"
    : item.sourceType === "dm";
}
