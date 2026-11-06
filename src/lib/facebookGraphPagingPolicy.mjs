import { META_GRAPH_API_VERSION } from "./metaIntegrationPolicy.mjs";
import { normalizeMetaPagingCursor } from "./metaConversationPaginationPolicy.mjs";

export function validateFacebookGraphPagingUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.host !== "graph.facebook.com" ||
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

export function resolveFacebookGraphPagingCursor(value) {
  if (value == null) return null;
  const validatedUrl = validateFacebookGraphPagingUrl(value);
  if (!validatedUrl) {
    throw new Error("Ungültige Facebook-Paging-Weiterleitung blockiert.");
  }
  const cursor = normalizeMetaPagingCursor(
    new URL(validatedUrl).searchParams.get("after"),
  );
  if (!cursor) {
    throw new Error("Ungültiger Facebook-Paging-Cursor blockiert.");
  }
  return cursor;
}
