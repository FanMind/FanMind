export type CreatorState = "CONNECT" | "ENGAGE" | "BUILD_INTEREST" | "QUALIFY" | "TEASE" | "OFFER" | "NEGOTIATE" | "CLOSE" | "AFTERCARE" | "REACTIVATE";
export type CreatorVoice = {
  warmth: number; playfulness: number; flirtLevel: number; directness: number; mystery: number; questionFrequency: number; salesDirectness: number;
  tone: string; messageLength: string; emojiFrequency: string; writingStyle: string; humorStyle: string; complimentStyle: string;
  preferredEmojis: string[]; greetings: string[]; closings: string[]; commonPhrases: string[]; avoidedPhrases: string[]; goodExamples: string[]; badExamples: string[];
};
export type CreatorOffer = { id: string; name: string; category: string; description: string; currency: string; minimumPriceMinor: number; recommendedPriceMinor: number; maximumPriceMinor: number; maximumDiscountPercent: number; delivery: string; exclusivity: string; requiresConfirmation: boolean; active: boolean };
export type CreatorPlaybook = { positioning: string; offers: CreatorOffer[]; minimumHoursBetweenOffers: number; aftercareHours: number; contentBoundaries: string[]; confirmationRequired: string[]; noGos: string[] };
export type CreatorPersona = { displayName: string; bio: string; publicAge: number | null; location: string; languages: string[]; platforms: string[]; internalNotes?: string; status: "draft" | "active" | "paused" | "archived" };
export type CreatorBundle = { id: string | null; revision: number; persona: CreatorPersona; voice: CreatorVoice; playbook: CreatorPlaybook; approve: boolean };
export type CreatorStrategy = { state: CreatorState; reason: string; temperature: number | null; purchaseIntent: number | null; offerFatigue: number | null; sellNow: boolean; offer: { id: string; name: string; priceMinor: number; currency: string } | null };
export type CreatorContext = { creatorId: string; revision: number; persona: CreatorPersona; voice: CreatorVoice; playbook: CreatorPlaybook; strategy: CreatorStrategy };
export const CREATOR_STATES: readonly CreatorState[];
export const CREATOR_CONTEXT_LIMIT: number;
export const CREATOR_SYSTEM_INSTRUCTIONS: string;
export class CreatorPolicyError extends Error { code: string; constructor(code: string); }
export function creatorUuid(value: unknown): string;
export function normalizeCreatorBundle(value: unknown): CreatorBundle;
export function defaultCreatorBundle(): CreatorBundle;
export type CreatorFanReview = {
  commercial: { fanStage: "unknown" | "new" | "engaged" | "buyer" | "vip" | "inactive"; engagementScore: number | null; purchaseIntentScore: number | null; offerFatigue: number | null; salesHold: boolean; offerRequested: boolean; requestedOfferId: string | null; sourceReference: string; preferredContent: string[]; preferredStyle: string };
  event: { kind: "purchase" | "offer" | "offer_declined"; occurredAt: string; amountMinor: number | null; currency: string | null; category: string; evidenceReference: string } | null;
  confirmed: boolean;
};
export function normalizeCreatorFanReview(value: unknown, now?: number): CreatorFanReview;
export function deriveCreatorStrategy(input: { playbook: CreatorPlaybook; commercial?: Record<string, unknown>; events?: Record<string, unknown>[]; now?: number }): CreatorStrategy;
export function buildCreatorReplyContext(input: { workspaceId: string; contactId: string; creatorId: string; creator: unknown; voice: unknown; playbook: unknown; commercial?: Record<string, unknown>; events?: Record<string, unknown>[]; now?: number }): CreatorContext;
export function validateCreatorReplyOptions(options: unknown, context: CreatorContext): Array<{ tone: string; label: string; text: string }>;
