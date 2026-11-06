import { CHAT_ADMIN_MODEL_TIMEOUT_MS } from "../src/lib/chatAdminModelPolicy.mjs";

// Allow the existing provider deadline plus bounded database/response overhead.
export const CHAT_ADMIN_RESPONSE_TIMEOUT_MS = CHAT_ADMIN_MODEL_TIMEOUT_MS + 30_000;
export const CHAT_ADMIN_FLOW_TIMEOUT_MS = 10 * CHAT_ADMIN_RESPONSE_TIMEOUT_MS + 120_000;
export const CHAT_ADMIN_RUNNER_TIMEOUT_MS = CHAT_ADMIN_FLOW_TIMEOUT_MS + 60_000;

export function waitForChatAdminReplyResponse(page, appOrigin) {
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === appOrigin && url.pathname === "/api/chatadmin/reply-suggestions" && response.request().method() === "POST";
  }, { timeout: CHAT_ADMIN_RESPONSE_TIMEOUT_MS });
}
