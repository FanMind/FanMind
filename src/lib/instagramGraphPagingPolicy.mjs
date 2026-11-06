import {
  META_GRAPH_API_VERSION,
} from "./metaIntegrationPolicy.mjs";
import {
  normalizeMetaPagingCursor,
} from "./metaConversationPaginationPolicy.mjs";

export function validateInstagramGraphPagingUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.host !== "graph.instagram.com" ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(`/${META_GRAPH_API_VERSION}/`)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveInstagramGraphPagingCursor(value) {
  if (value == null) return null;
  const validatedUrl = validateInstagramGraphPagingUrl(value);
  if (!validatedUrl) {
    throw new Error("Ungültige Instagram-Paging-Weiterleitung blockiert.");
  }
  const cursor = normalizeMetaPagingCursor(
    new URL(validatedUrl).searchParams.get("after"),
  );
  if (!cursor) {
    throw new Error("Ungültiger Instagram-Paging-Cursor blockiert.");
  }
  return cursor;
}
