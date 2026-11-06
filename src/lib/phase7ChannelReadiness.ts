/**
 * Provider-neutral guardrail for Roadmap Phase 7 channel preparation.
 *
 * This module deliberately does not contain provider endpoints, credentials,
 * event handlers, scraping logic or outbound messaging capabilities. It is
 * a fail-closed contract for future, separately reviewed integrations.
 */

export const PHASE_7_CHANNEL_KEYS = [
  "tiktok",
  "x_twitter",
  "discord",
  "onlyfans_evaluation",
] as const;

export type Phase7ChannelKey = (typeof PHASE_7_CHANNEL_KEYS)[number];

export type Phase7ChannelPolicy = {
  roadmapPhase: 7;
  mode: "provider_preparation" | "evaluation_only";
  inboundEnabled: false;
  outboundEnabled: false;
  automaticSendingEnabled: false;
  scrapingEnabled: false;
  productionEnabled: false;
};

export const PHASE_7_CHANNEL_POLICIES: Readonly<
  Record<Phase7ChannelKey, Readonly<Phase7ChannelPolicy>>
> = Object.freeze({
  tiktok: phase7Policy("provider_preparation"),
  x_twitter: phase7Policy("provider_preparation"),
  discord: phase7Policy("provider_preparation"),
  onlyfans_evaluation: phase7Policy("evaluation_only"),
});

export type Phase7ActivationEvidence = {
  implementationComplete?: boolean;
  stagingAccepted?: boolean;
  externalApprovalConfirmed?: boolean;
  productionActivationConfirmed?: boolean;
};

export type Phase7ReadinessBlocker =
  | "implementation_incomplete"
  | "staging_acceptance_missing"
  | "external_approval_missing"
  | "production_activation_missing"
  | "evaluation_only";

export type Phase7Readiness = {
  ready: false;
  blockers: readonly Phase7ReadinessBlocker[];
};

/**
 * Returns redacted, fixed blocker codes only. Phase 7 is not activated by
 * this resolver; even complete evidence requires a separate implementation
 * to replace this preparation contract after review.
 */
export function resolvePhase7ChannelReadiness(
  channel: Phase7ChannelKey,
  evidence: Phase7ActivationEvidence = {},
): Phase7Readiness {
  if (channel === "onlyfans_evaluation") {
    return { ready: false, blockers: ["evaluation_only"] };
  }

  const blockers: Phase7ReadinessBlocker[] = [];
  if (evidence.implementationComplete !== true) {
    blockers.push("implementation_incomplete");
  }
  if (evidence.stagingAccepted !== true) {
    blockers.push("staging_acceptance_missing");
  }
  if (evidence.externalApprovalConfirmed !== true) {
    blockers.push("external_approval_missing");
  }
  if (evidence.productionActivationConfirmed !== true) {
    blockers.push("production_activation_missing");
  }

  // This preparation module never declares a provider integration ready.
  return { ready: false, blockers };
}

function phase7Policy(
  mode: Phase7ChannelPolicy["mode"],
): Readonly<Phase7ChannelPolicy> {
  return Object.freeze({
    roadmapPhase: 7,
    mode,
    inboundEnabled: false,
    outboundEnabled: false,
    automaticSendingEnabled: false,
    scrapingEnabled: false,
    productionEnabled: false,
  });
}
