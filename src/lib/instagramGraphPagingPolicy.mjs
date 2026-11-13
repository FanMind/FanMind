import {
  META_GRAPH_API_VERSION,
} from "./metaIntegrationPolicy.mjs";
import {
  normalizeMetaPagingCursor,
} from "./metaConversationPaginationPolicy.mjs";

/** @param {unknown} value @param {string} host @param {string} version */
export function validateInstagramGraphPagingUrl(value, host = 'graph.instagram.com', version = META_GRAPH_API_VERSION) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      (host !== "graph.instagram.com" && host !== "graph.facebook.com") ||
      (host === "graph.instagram.com" && url.host !== "graph.instagram.com") ||
      (host === "graph.facebook.com" && url.host !== "graph.facebook.com") ||
      url.username ||
      url.password ||
      ![META_GRAPH_API_VERSION, "v27.0"].includes(version) || !url.pathname.startsWith(`/${version}/`)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** @param {unknown} value @param {string} host @param {string} version */
export function resolveInstagramGraphPagingCursor(value, host = 'graph.instagram.com', version = META_GRAPH_API_VERSION) {
  if (value == null) return null;
  const validatedUrl = validateInstagramGraphPagingUrl(value, host, version);
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
