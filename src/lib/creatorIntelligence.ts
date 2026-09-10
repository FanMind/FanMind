import "server-only";
import { cookies } from "next/headers";
import { getSupabaseHeaders, getSupabaseRestUrl, SUPABASE_ACCESS_TOKEN_COOKIE } from "@/lib/supabase/config";
import { buildCreatorReplyContext, creatorUuid, normalizeCreatorBundle, normalizeCreatorFanReview } from "@/lib/creatorIntelligencePolicy.mjs";

export type CreatorBundle = ReturnType<typeof normalizeCreatorBundle>;
export type CreatorContext = ReturnType<typeof buildCreatorReplyContext>;
type CreatorRow = {
  id: string; workspace_id: string; display_name: string; bio: string;
  public_age: number | null; location: string; languages: string[]; platforms: string[];
  status: string; internal_notes: string; revision: number;
};
type VoiceRow = { workspace_id: string; creator_id: string; fingerprint: CreatorBundle["voice"]; revision: number; approved_by: string | null; approved_at: string | null };
type PlaybookRow = { workspace_id: string; creator_id: string; rules: CreatorBundle["playbook"]; revision: number; approved_by: string | null; approved_at: string | null };

export function creatorIntelligenceEnabled() {
  return process.env.FANMIND_CREATOR_INTELLIGENCE_ENABLED === "true";
}

async function creatorRequest<T>(table: string, workspaceId: string, options: {
  filters?: Record<string, string>; select?: string; body?: unknown; accessToken?: string; limit?: number;
} = {}): Promise<T> {
  if (!creatorIntelligenceEnabled()) throw new Error("creator_rollout_pending");
  creatorUuid(workspaceId);
  const token = options.accessToken ?? (await cookies()).get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new Error("creator_auth_required");
  const url = new URL(getSupabaseRestUrl(table));
  if (options.body === undefined) {
    url.searchParams.set("workspace_id", `eq.${workspaceId}`);
    url.searchParams.set("select", options.select ?? "*");
    url.searchParams.set("limit", String(options.limit ?? 100));
    for (const [key, value] of Object.entries(options.filters ?? {})) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: options.body === undefined ? "GET" : "POST",
    headers: { ...getSupabaseHeaders(token), "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("creator_data_unavailable");
  return await response.json() as T;
}

export async function getCreatorBundles(workspaceId: string, accessToken?: string): Promise<CreatorBundle[]> {
  const [creators, voices, playbooks] = await Promise.all([
    creatorRequest<CreatorRow[]>("creators", workspaceId, { accessToken }),
    creatorRequest<VoiceRow[]>("creator_voice_profiles", workspaceId, { accessToken }),
    creatorRequest<PlaybookRow[]>("creator_sales_playbooks", workspaceId, { accessToken }),
  ]);
  return creators.map((creator) => {
    const voice = voices.find((row) => row.creator_id === creator.id);
    const playbook = playbooks.find((row) => row.creator_id === creator.id);
    if (!voice || !playbook) throw new Error("creator_incomplete");
    return normalizeCreatorBundle({
      id: creator.id, revision: creator.revision,
      persona: { displayName: creator.display_name, bio: creator.bio, publicAge: creator.public_age, location: creator.location, languages: creator.languages, platforms: creator.platforms, status: creator.status, internalNotes: creator.internal_notes },
      voice: voice.fingerprint, playbook: playbook.rules,
      approve: Boolean(voice.approved_at && playbook.approved_at && voice.revision === creator.revision && playbook.revision === creator.revision),
    });
  });
}

export async function saveCreatorBundle(workspaceId: string, value: unknown, accessToken?: string) {
  const bundle = normalizeCreatorBundle(value);
  return creatorRequest<string>("rpc/save_creator_bundle", workspaceId, {
    accessToken, body: { p_workspace_id: workspaceId, p_creator_id: bundle.id, p_expected_revision: bundle.revision,
      p_persona: bundle.persona, p_voice: bundle.voice, p_playbook: bundle.playbook, p_approve: bundle.approve },
  });
}

export async function getCreatorFanData(workspaceId: string, contactId: string, accessToken?: string) {
  creatorUuid(contactId);
  const bundles = await getCreatorBundles(workspaceId, accessToken);
  if (bundles.length === 0) return { configured: false, commercial: {}, events: [], offers: [] };
  if (bundles.length !== 1) throw new Error("creator_profile_required");
  const profiles = await creatorRequest<Array<{ commercial_profile: Record<string, unknown> }>>("contact_ai_profiles", workspaceId, { accessToken, select: "commercial_profile", filters: { contact_id: `eq.${contactId}` } });
  const events = await creatorRequest<Array<{ kind: string; occurred_at: string; amount_minor: number | null; currency: string | null; evidence_reference: string }>>("creator_commercial_events", workspaceId, {
    accessToken, limit: 10, select: "kind,occurred_at,amount_minor,currency,evidence_reference",
    filters: { creator_id: `eq.${bundles[0].id}`, contact_id: `eq.${contactId}`, order: "occurred_at.desc" },
  });
  return { configured: true, commercial: profiles[0]?.commercial_profile ?? {}, events, offers: bundles[0].playbook.offers.filter((offer) => offer.active && !offer.requiresConfirmation).map(({ id, name }) => ({ id, name })) };
}

export async function saveCreatorFanReview(workspaceId: string, contactId: string, value: unknown, accessToken?: string) {
  creatorUuid(contactId);
  const review = normalizeCreatorFanReview(value);
  return creatorRequest<null>("rpc/record_creator_fan_review", workspaceId, {
    accessToken, body: { p_workspace_id: workspaceId, p_contact_id: contactId, p_commercial: review.commercial, p_event: review.event },
  });
}

export async function loadCreatorReplyContext(workspaceId: string, contactId: string, accessToken?: string): Promise<CreatorContext | null> {
  if (!creatorIntelligenceEnabled()) return null;
  creatorUuid(contactId);
  const creators = await creatorRequest<CreatorRow[]>("creators", workspaceId, { accessToken });
  if (creators.length === 0) return null; // An account without a Creator profile retains the existing CRM.
  if (creators.length !== 1) throw new Error("creator_workspace_ambiguous");
  const creatorId = creators[0].id;
  creatorUuid(creatorId);
  const scope = { accessToken, filters: { creator_id: `eq.${creatorId}` } };
  const [voices, playbooks, profiles, events] = await Promise.all([
    creatorRequest<VoiceRow[]>("creator_voice_profiles", workspaceId, scope),
    creatorRequest<PlaybookRow[]>("creator_sales_playbooks", workspaceId, scope),
    creatorRequest<Array<{ commercial_profile: Record<string, unknown> }>>("contact_ai_profiles", workspaceId, { accessToken, select: "commercial_profile", filters: { contact_id: `eq.${contactId}` } }),
    Promise.all(["purchase", "offer", "offer_declined"].map((kind) =>
      creatorRequest<Record<string, unknown>[]>("creator_commercial_events", workspaceId, { accessToken, limit: 1,
        filters: { creator_id: `eq.${creatorId}`, contact_id: `eq.${contactId}`, kind: `eq.${kind}`, order: "occurred_at.desc" } })
    )).then((groups) => groups.flat()),
  ]);
  return buildCreatorReplyContext({ workspaceId, contactId, creatorId, creator: creators[0], voice: voices[0], playbook: playbooks[0], commercial: profiles[0]?.commercial_profile ?? {}, events });
}
