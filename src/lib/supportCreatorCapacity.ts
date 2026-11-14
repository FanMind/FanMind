import "server-only";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { supportCentreDatabase } from "@/lib/supportCentreServer";
import { buildBoundedReplySuggestionContext } from "@/lib/aiExecutionPolicy.mjs";
import { PUBLIC_SUPPORT_INSTRUCTIONS, guardPublicSupportReply } from "@/lib/publicSupportPolicy.mjs";
import { recordAiUsageEvent } from "@/lib/aiUsage";
import { prepareAiCapacityReservation, settlePreparedAiCapacityReservation,
  releasePreparedAiCapacityReservation, markPreparedAiCapacityIndeterminate } from "@/lib/aiCapacityRuntime";
import type { AiCapacityPackageId, AiCapacityQualityMode } from "@/lib/aiCapacityLedger";
import { requestSupportReply, SupportProviderFailure } from "@/lib/supportReplyProvider";

type Identity = { actor: string; workspace: string; scope: string };
const MAX_OUTPUT_TOKENS = 800;

async function revalidate(identity: Identity) {
  const current = await requireActiveAuthorizedWorkspace();
  if (current.user.id !== identity.actor || current.workspace.id !== identity.workspace ||
      current.workspace.owner_user_id !== identity.actor) throw Error("support_capacity_identity_changed");
}

async function capacityContext(identity: Identity) {
  await revalidate(identity);
  const query = new URLSearchParams({ select: "workspace_id,billing_contract_version,package_id,billing_period_key,period_start,period_end,revision,active,source_fingerprint",
    workspace_id: `eq.${identity.workspace}`, limit: "2" });
  const rows = await supportCentreDatabase(`ai_capacity_workspace_entitlements?${query}`);
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  const now = Date.now();
  if (!row || row.workspace_id !== identity.workspace || row.billing_contract_version !== "capacity_v2" ||
      row.active !== true || !["capacity_99", "capacity_199", "capacity_312"].includes(row.package_id) ||
      typeof row.billing_period_key !== "string" || !row.billing_period_key.trim() ||
      !Number.isSafeInteger(row.revision) || row.revision < 1 ||
      typeof row.source_fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(row.source_fingerprint) ||
      typeof row.period_start !== "string" || typeof row.period_end !== "string" ||
      !Number.isFinite(Date.parse(row.period_start)) || !Number.isFinite(Date.parse(row.period_end)) ||
      Date.parse(row.period_start) > now || Date.parse(row.period_end) <= now) throw Error("support_capacity_entitlement_unavailable");
  // Configuration is server-owned and explicitly reviewed; never invent FX, a package or a mode.
  const mode = process.env.FANMIND_SUPPORT_AI_QUALITY_MODE;
  if (mode !== "fast" && mode !== "balanced" && mode !== "premium") throw Error("support_capacity_mode_unavailable");
  const fx = JSON.parse(process.env.FANMIND_AI_CAPACITY_FX_SNAPSHOT ?? "null");
  if (!fx || !Number.isSafeInteger(fx.eurPerUsdNanos) || fx.eurPerUsdNanos < 1 ||
      typeof fx.version !== "string" || !fx.version.trim() || fx.version.length > 160 ||
      typeof fx.validFrom !== "string" || typeof fx.validUntil !== "string" ||
      !Number.isFinite(Date.parse(fx.validFrom)) || !Number.isFinite(Date.parse(fx.validUntil)) ||
      Date.parse(fx.validFrom) > now || Date.parse(fx.validUntil) <= now) throw Error("support_capacity_fx_unavailable");
  return { packageId: row.package_id as AiCapacityPackageId, billingPeriodKey: row.billing_period_key as string,
    entitlementRevision: row.revision as number, qualityMode: mode as AiCapacityQualityMode,
    fx: { eurPerUsdNanos: fx.eurPerUsdNanos as number, version: fx.version as string } };
}

/** Called only after the conversation route has authorized actor/scope, consent and rate. */
export async function answerCreatorSupport(input: {
  identity: Identity; requestId: string; question: string;
  history: Array<{ role: string; text: string }>; signal: AbortSignal; beforeProvider: () => Promise<void>;
}) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw Error("support_provider_unavailable");
  const context = await capacityContext(input.identity);
  const bounded = buildBoundedReplySuggestionContext({ contactId: "support", displayName: "Creator",
    incomingMessage: input.question, conversationContext: JSON.stringify(input.history), messageLimit: 50 });
  const system = PUBLIC_SUPPORT_INSTRUCTIONS;
  const content = JSON.stringify({ language: "de", recentConversation: bounded.context.conversationContext, question: bounded.context.incomingMessage });
  // UTF-8 byte bound plus framing allowance, not a character/4 billing estimate.
  const estimatedInputTokens = Buffer.byteLength(JSON.stringify([{ role: "system", content: system }, { role: "user", content }]), "utf8") + 2048;
  const prepared = await prepareAiCapacityReservation({ workspaceId: input.identity.workspace,
    generationKey: `support:${input.identity.actor}:${input.requestId}`, ...context,
    estimatedInputTokens, maxOutputTokens: MAX_OUTPUT_TOKENS, occurredAt: new Date().toISOString() });
  try {
    await revalidate(input.identity);
    await input.beforeProvider();
    if (input.signal.aborted) throw Error("support_cancelled_before_provider");
  } catch (error) {
    await releasePreparedAiCapacityReservation(prepared, "support_cancelled_before_provider");
    throw error;
  }
  const started = Date.now();
  let result;
  try {
    result = await requestSupportReply({ key, model: prepared.model, system, content, signal: input.signal,
      maxOutputTokens: MAX_OUTPUT_TOKENS, serviceTier: prepared.serviceTier, reasoningEffort: prepared.reasoningEffort });
  } catch (error) {
    if (error instanceof SupportProviderFailure && error.definitelyRejected) {
      await releasePreparedAiCapacityReservation(prepared, "support_provider_rejected");
    } else {
      await markPreparedAiCapacityIndeterminate(prepared, "support_provider_outcome_unknown");
    }
    throw Error("support_provider_unavailable");
  }
  // Settle actual billable work even if consent/auth changes during provider execution.
  // Delivery/persistence remains separately revalidated by the conversation route.
  // On missing usage or an unknown settlement response, never release or retry the hold.
  await settlePreparedAiCapacityReservation({ prepared, providerUsage: result.usage,
    occurredAt: new Date().toISOString(), metadata: { sourceRoute: "/api/support/conversation" } });
  await recordAiUsageEvent({ eventId: input.requestId, workspaceId: input.identity.workspace, userId: input.identity.actor,
    feature: "website_chat_reply", model: prepared.model, inputChars: system.length + content.length,
    outputChars: result.text.length, status: "ok", latencyMs: Date.now() - started,
    sourceRoute: "/api/support/conversation", providerUsage: result.usage });
  return guardPublicSupportReply(result.text, "de");
}
