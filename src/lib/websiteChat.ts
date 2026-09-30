import "server-only";

import {
  createWebsiteChatSessionToken,
  hashWebsiteChatSessionToken,
  normalizeWebsiteChatMessage,
  normalizeWebsiteChatEmail,
  normalizeSessionTtlMinutes,
  requireAllowedWebsiteChatOrigin,
  requireConsent,
  requirePublicInstallationId,
  requireWebsiteChatClientMessageId,
  requireWebsiteChatHandoffConsent,
} from "@/lib/websiteChatPolicy.mjs";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";

type InstallationRow = {
  id: string;
  workspace_id: string;
  enabled: boolean;
  consent_version: string;
  session_ttl_minutes: number;
};

type OriginRow = { origin: string; verified_at: string | null };

type WorkspaceProcessingRow = {
  id: string;
  billing_status: string | null;
  billing_suspended_at: string | null;
  billing_manual_override: boolean | null;
  billing_grace_until: string | null;
  subscription_effective_end_at: string | null;
  workspace_access_mode: string | null;
  test_access_flags: Record<string, unknown> | null;
};

export class WebsiteChatServiceError extends Error {
  readonly code:
    | "configuration"
    | "installation_unavailable"
    | "origin_forbidden"
    | "consent_required"
    | "session_unavailable"
    | "message_invalid"
    | "handoff_invalid"
    | "assistant_unavailable"
    | "persistence_unavailable";

  constructor(code: WebsiteChatServiceError["code"]) {
    super("Website Chat is unavailable.");
    this.name = "WebsiteChatServiceError";
    this.code = code;
  }
}

type IngestedMessageRow = {
  accepted: boolean;
  duplicate: boolean;
  conversation_id: string | null;
  message_id: string | null;
};

type WebsiteChatHandoffRow = {
  accepted: boolean;
  duplicate: boolean;
  conversation_id: string | null;
  handoff_id: string | null;
};

export async function ingestWebsiteChatMessage(input: {
  publicInstallationId: unknown;
  origin: unknown;
  sessionToken: unknown;
  clientMessageId: unknown;
  message: unknown;
}) {
  const { serviceKey, sessionSecret } = serviceConfiguration();
  const { origin, publicInstallationId } = await resolveWebsiteChatInstallation(input);

  let visitorSubjectHash: string;
  let clientMessageId: string;
  let content: string;
  try {
    visitorSubjectHash = hashWebsiteChatSessionToken({
      token: input.sessionToken,
      secret: sessionSecret,
    });
    clientMessageId = requireWebsiteChatClientMessageId(input.clientMessageId);
    content = normalizeWebsiteChatMessage(input.message);
  } catch {
    throw new WebsiteChatServiceError("message_invalid");
  }

  const result = await fetch(getSupabaseRestUrl("rpc/ingest_website_chat_message_v2"), {
    method: "POST",
    headers: { ...getSupabaseHeaders(serviceKey), Prefer: "return=representation" },
    body: JSON.stringify({
      p_public_installation_id: publicInstallationId,
      p_origin: origin,
      p_visitor_subject_hash: visitorSubjectHash,
      p_client_message_id: clientMessageId,
      p_content: content,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!result?.ok) {
    throw new WebsiteChatServiceError("persistence_unavailable");
  }
  const rows = await result.json() as IngestedMessageRow[];
  const row = rows[0];
  if (row && !row.accepted) {
    throw new WebsiteChatServiceError("session_unavailable");
  }
  if (!row?.accepted || !row.conversation_id || !row.message_id) {
    throw new WebsiteChatServiceError("persistence_unavailable");
  }
  return {
    accepted: true as const,
    duplicate: row.duplicate === true,
    conversationId: row.conversation_id,
    messageId: row.message_id,
  };
}

export async function requestWebsiteChatHandoff(input: {
  publicInstallationId: unknown;
  origin: unknown;
  sessionToken: unknown;
  clientHandoffId: unknown;
  email: unknown;
  consent: unknown;
}) {
  const { serviceKey, sessionSecret } = serviceConfiguration();
  const { installation, origin, publicInstallationId } = await resolveWebsiteChatInstallation(input);

  let visitorSubjectHash: string;
  let clientHandoffId: string;
  let email: string;
  let consentVersion: string;
  try {
    visitorSubjectHash = hashWebsiteChatSessionToken({
      token: input.sessionToken,
      secret: sessionSecret,
    });
    clientHandoffId = requireWebsiteChatClientMessageId(input.clientHandoffId);
    email = normalizeWebsiteChatEmail(input.email);
    consentVersion = requireWebsiteChatHandoffConsent(
      input.consent,
      installation.consent_version,
    );
  } catch {
    throw new WebsiteChatServiceError("handoff_invalid");
  }

  const result = await fetch(getSupabaseRestUrl("rpc/request_website_chat_handoff"), {
    method: "POST",
    headers: { ...getSupabaseHeaders(serviceKey), Prefer: "return=representation" },
    body: JSON.stringify({
      p_public_installation_id: publicInstallationId,
      p_origin: origin,
      p_visitor_subject_hash: visitorSubjectHash,
      p_client_handoff_id: clientHandoffId,
      p_email: email,
      p_consent_version: consentVersion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!result?.ok) {
    throw new WebsiteChatServiceError("persistence_unavailable");
  }
  const rows = await result.json() as WebsiteChatHandoffRow[];
  const row = rows[0];
  if (row && !row.accepted) {
    throw new WebsiteChatServiceError("session_unavailable");
  }
  if (!row?.accepted || !row.conversation_id || !row.handoff_id) {
    throw new WebsiteChatServiceError("persistence_unavailable");
  }
  return {
    accepted: true as const,
    duplicate: row.duplicate === true,
  };
}

function serviceConfiguration() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const sessionSecret = process.env.FANMIND_WEBSITE_CHAT_SESSION_SECRET?.trim() ?? "";
  if (!serviceKey || sessionSecret.length < 32) {
    throw new WebsiteChatServiceError("configuration");
  }
  return { serviceKey, sessionSecret };
}

async function fetchRows<T>(path: string, serviceKey: string): Promise<T[]> {
  const response = await fetch(`${getSupabaseRestUrl(path)}`, {
    headers: getSupabaseHeaders(serviceKey),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) throw new WebsiteChatServiceError("persistence_unavailable");
  return response.json() as Promise<T[]>;
}

export async function resolveWebsiteChatInstallation(input: {
  publicInstallationId: unknown;
  origin: unknown;
}) {
  const { serviceKey } = serviceConfiguration();
  const publicId = requirePublicInstallationId(input.publicInstallationId);
  const installations = await fetchRows<InstallationRow>(
    `website_chat_installations?select=id,workspace_id,enabled,consent_version,session_ttl_minutes&public_installation_id=eq.${encodeURIComponent(publicId)}&limit=1`,
    serviceKey,
  );
  const installation = installations[0];
  if (!installation?.enabled) {
    throw new WebsiteChatServiceError("installation_unavailable");
  }

  const workspaces = await fetchRows<WorkspaceProcessingRow>(
    `workspaces?select=id,billing_status,billing_suspended_at,billing_manual_override,billing_grace_until,subscription_effective_end_at,workspace_access_mode,test_access_flags&id=eq.${encodeURIComponent(installation.workspace_id)}&limit=1`,
    serviceKey,
  );
  const processing = evaluateWorkspaceProcessingEntitlement(workspaces[0]);
  if (!processing.allowed) {
    throw new WebsiteChatServiceError("installation_unavailable");
  }

  const origins = await fetchRows<OriginRow>(
    `website_chat_allowed_origins?select=origin,verified_at&installation_id=eq.${encodeURIComponent(installation.id)}`,
    serviceKey,
  );
  const verifiedOrigins = origins.filter((row) => row.verified_at).map((row) => row.origin);
  let origin: string;
  try {
    origin = requireAllowedWebsiteChatOrigin(input.origin, verifiedOrigins);
  } catch {
    throw new WebsiteChatServiceError("origin_forbidden");
  }
  return { installation, origin, publicInstallationId: publicId };
}

export async function createWebsiteChatVisitorSession(input: {
  publicInstallationId: unknown;
  origin: unknown;
  consent: unknown;
}) {
  const { serviceKey, sessionSecret } = serviceConfiguration();
  const { installation, origin } = await resolveWebsiteChatInstallation(input);
  try {
    requireConsent(input.consent, installation.consent_version);
  } catch {
    throw new WebsiteChatServiceError("consent_required");
  }

  const token = createWebsiteChatSessionToken();
  const subjectHash = hashWebsiteChatSessionToken({ token, secret: sessionSecret });
  const consentGrantedAt = new Date();
  const ttlMinutes = normalizeSessionTtlMinutes(installation.session_ttl_minutes);
  const expiresAt = new Date(consentGrantedAt.getTime() + ttlMinutes * 60_000);
  const response = await fetch(getSupabaseRestUrl("website_chat_visitor_sessions"), {
    method: "POST",
    headers: { ...getSupabaseHeaders(serviceKey), Prefer: "return=minimal" },
    body: JSON.stringify({
      installation_id: installation.id,
      workspace_id: installation.workspace_id,
      origin,
      visitor_subject_hash: subjectHash,
      consent_version: installation.consent_version,
      consent_granted_at: consentGrantedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_seen_at: consentGrantedAt.toISOString(),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) throw new WebsiteChatServiceError("persistence_unavailable");

  return { token, expiresAt: expiresAt.toISOString(), consentVersion: installation.consent_version };
}


type WebsiteChatSessionRow = {
  id: string;
  installation_id: string;
  workspace_id: string;
  origin: string;
  expires_at: string;
  revoked_at: string | null;
};

type WebsiteChatReceiptRow = {
  contact_id: string;
  conversation_id: string;
  message_id: string;
};

type WebsiteChatConversationMessage = {
  id: string;
  direction: "inbound" | "outbound" | "note";
  content: string;
  created_at: string;
  external_message_id: string | null;
};

export type WebsiteChatAssistantContext = {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  incomingMessageId: string;
  clientMessageId: string;
  origin: string;
  messages: Array<{ direction: "inbound" | "outbound"; content: string }>;
};

export async function resolveWebsiteChatAssistantContext(input: {
  publicInstallationId: unknown;
  origin: unknown;
  sessionToken: unknown;
  clientMessageId: unknown;
}): Promise<WebsiteChatAssistantContext> {
  const { serviceKey, sessionSecret } = serviceConfiguration();
  const resolved = await resolveWebsiteChatInstallation(input);
  let visitorSubjectHash: string;
  let clientMessageId: string;
  try {
    visitorSubjectHash = hashWebsiteChatSessionToken({
      token: input.sessionToken,
      secret: sessionSecret,
    });
    clientMessageId = requireWebsiteChatClientMessageId(input.clientMessageId);
  } catch {
    throw new WebsiteChatServiceError("session_unavailable");
  }

  const sessions = await fetchRows<WebsiteChatSessionRow>(
    `website_chat_visitor_sessions?select=id,installation_id,workspace_id,origin,expires_at,revoked_at&installation_id=eq.${encodeURIComponent(resolved.installation.id)}&workspace_id=eq.${encodeURIComponent(resolved.installation.workspace_id)}&origin=eq.${encodeURIComponent(resolved.origin)}&visitor_subject_hash=eq.${encodeURIComponent(visitorSubjectHash)}&order=created_at.desc&limit=1`,
    serviceKey,
  );
  const session = sessions[0];
  if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) {
    throw new WebsiteChatServiceError("session_unavailable");
  }

  const receipts = await fetchRows<WebsiteChatReceiptRow>(
    `website_chat_message_receipts?select=contact_id,conversation_id,message_id&session_id=eq.${encodeURIComponent(session.id)}&client_message_id=eq.${encodeURIComponent(clientMessageId)}&limit=1`,
    serviceKey,
  );
  const receipt = receipts[0];
  if (!receipt) throw new WebsiteChatServiceError("message_invalid");

  const history = await fetchRows<WebsiteChatConversationMessage>(
    `conversation_messages?select=id,direction,content,created_at,external_message_id&workspace_id=eq.${encodeURIComponent(session.workspace_id)}&conversation_id=eq.${encodeURIComponent(receipt.conversation_id)}&order=created_at.desc&limit=16`,
    serviceKey,
  );
  const messages = history
    .reverse()
    .filter((message) => message.direction === "inbound" || message.direction === "outbound")
    .map((message) => ({ direction: message.direction as "inbound" | "outbound", content: message.content.slice(0, 4000) }));

  return {
    workspaceId: session.workspace_id,
    contactId: receipt.contact_id,
    conversationId: receipt.conversation_id,
    incomingMessageId: receipt.message_id,
    clientMessageId,
    origin: resolved.origin,
    messages,
  };
}

export async function persistWebsiteChatAssistantReply(input: {
  context: WebsiteChatAssistantContext;
  reply: unknown;
}) {
  const { serviceKey } = serviceConfiguration();
  let content: string;
  try {
    content = normalizeWebsiteChatMessage(input.reply);
  } catch {
    throw new WebsiteChatServiceError("assistant_unavailable");
  }
  const externalMessageId = `website-ai:${input.context.clientMessageId}`;
  const existing = await fetchRows<WebsiteChatConversationMessage>(
    `conversation_messages?select=id,direction,content,created_at,external_message_id&workspace_id=eq.${encodeURIComponent(input.context.workspaceId)}&conversation_id=eq.${encodeURIComponent(input.context.conversationId)}&external_message_id=eq.${encodeURIComponent(externalMessageId)}&limit=1`,
    serviceKey,
  );
  if (existing[0]?.content) {
    return { reply: existing[0].content, duplicate: true as const };
  }

  const response = await fetch(getSupabaseRestUrl("conversation_messages"), {
    method: "POST",
    headers: { ...getSupabaseHeaders(serviceKey), Prefer: "return=representation" },
    body: JSON.stringify({
      workspace_id: input.context.workspaceId,
      conversation_id: input.context.conversationId,
      contact_id: input.context.contactId,
      direction: "outbound",
      message_type: "form",
      source_platform: "website-chat",
      source_url: input.context.origin,
      reply_target_url: input.context.origin,
      external_message_id: externalMessageId,
      author_label: "FanMind KI",
      content,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) throw new WebsiteChatServiceError("persistence_unavailable");

  await fetch(
    `${getSupabaseRestUrl("conversations")}?id=eq.${encodeURIComponent(input.context.conversationId)}&workspace_id=eq.${encodeURIComponent(input.context.workspaceId)}`,
    {
      method: "PATCH",
      headers: { ...getSupabaseHeaders(serviceKey), Prefer: "return=minimal" },
      body: JSON.stringify({
        last_outbound_at: new Date().toISOString(),
        last_message_preview: content.slice(0, 240),
        ai_status: "ready",
        next_step: "Website-Gespräch beobachten",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  ).catch(() => null);

  return { reply: content, duplicate: false as const };
}
