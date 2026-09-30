export type FanMindAiQualityMode = "fast" | "balanced" | "premium";
export type OpenAiContextClass = "short" | "long";
export type OpenAiPriceEntry = Readonly<{
  provider: "openai";
  currency: "USD";
  catalogVersion: string;
  model: string;
  serviceTier: "standard";
  regionalProcessing: false;
  contextClass: OpenAiContextClass;
  effectiveFrom: string;
  effectiveUntil: string | null;
  inputPerMillionMicros: number;
  cachedInputPerMillionMicros: number;
  cacheWritePerMillionMicros: number;
  outputPerMillionMicros: number;
  sourceUrl: string;
  sourceObservedAt: string;
}>;
export type FanMindAiQualityProfile = Readonly<{
  id: FanMindAiQualityMode;
  label: "Schnell" | "Ausgewogen" | "Premium";
  model: "gpt-6-luna" | "gpt-6.1-sol" | "gpt-6-astra";
  serviceTier: "standard";
  reasoningEffort: "low" | "medium" | "max";
  intent: "fastest_cost_efficient" | "balanced_quality_cost_speed" | "highest_quality";
}>;

export const OPENAI_PRICE_CATALOG_VERSION: string;
export const OPENAI_PRICE_CATALOG_OBSERVED_AT: string;
export const OPENAI_LONG_CONTEXT_INPUT_TOKEN_THRESHOLD: 272000;
export const FANMIND_AI_QUALITY_MODES: readonly FanMindAiQualityMode[];
export const FANMIND_AI_QUALITY_PROFILES: Readonly<Record<FanMindAiQualityMode, FanMindAiQualityProfile>>;
export const OPENAI_PRICE_CATALOG: readonly OpenAiPriceEntry[];

export function resolveFanMindAiQualityProfile(mode: unknown): FanMindAiQualityProfile | null;
export function resolveOpenAiContextClass(inputTokens: number): OpenAiContextClass;
export function resolveOpenAiCatalogPrice(input: {
  model: string;
  serviceTier?: string;
  occurredAt: string;
  inputTokens: number;
  regionalProcessing?: boolean;
}): OpenAiPriceEntry | null;
