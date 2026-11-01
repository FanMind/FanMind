const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isWebsiteChatAssistantBindingValid({
  session,
  receipt,
  installationId,
  workspaceId,
  origin,
  clientMessageId,
  nowMs = Date.now(),
}) {
  if (
    !session ||
    !receipt ||
    !validId(installationId) ||
    !validId(workspaceId) ||
    !validId(clientMessageId) ||
    typeof origin !== "string" ||
    !origin
  ) {
    return false;
  }
  if (
    !validId(session.id) ||
    session.installation_id !== installationId ||
    session.workspace_id !== workspaceId ||
    session.origin !== origin ||
    session.revoked_at !== null ||
    !Number.isFinite(Date.parse(session.expires_at)) ||
    Date.parse(session.expires_at) <= nowMs
  ) {
    return false;
  }
  return (
    receipt.session_id === session.id &&
    receipt.installation_id === installationId &&
    receipt.workspace_id === workspaceId &&
    receipt.client_message_id === clientMessageId &&
    validId(receipt.contact_id) &&
    validId(receipt.conversation_id) &&
    validId(receipt.message_id)
  );
}

export function buildWebsiteChatAiIdentity({ workspaceId, conversationId, incomingMessageId }) {
  if (!validId(workspaceId) || !validId(conversationId) || !validId(incomingMessageId)) {
    throw new TypeError("invalid Website AI identity");
  }
  return {
    externalMessageId: `website-ai:${incomingMessageId}`,
    claimSubject: `${workspaceId}:${conversationId}:${incomingMessageId}`,
  };
}

export function selectWebsiteChatAiAction({ existingReply, claimAllowed }) {
  if (typeof existingReply === "string" && existingReply.trim()) {
    return { action: "reuse", reply: existingReply };
  }
  if (claimAllowed === null) return { action: "claim" };
  if (claimAllowed === true) return { action: "provider" };
  if (claimAllowed === false) return { action: "in_progress" };
  throw new TypeError("claimAllowed must be null or boolean");
}
