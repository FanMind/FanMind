import {
  META_CONTENT_STAGING_RESOURCE_CONFIRMATION,
  evaluateMetaContentStagingMigrationEnvironment,
} from "./metaContentStagingMigrationPolicy.mjs";

export const STAGING_DATABASE_ROLLOUT_STATE_CONFIRMATION =
  "verify-staging-database-rollout-state";

const OBJECT_STATES = new Set(["absent", "current", "invalid"]);
const META_OBJECT_STATES = new Set([
  "absent",
  "foundation",
  "current",
  "invalid",
]);
const TRIGGER_STATES = new Set(["unavailable", "pending", "current", "invalid"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function evaluateStagingDatabaseRolloutStateEnvironment(
  environment = {},
) {
  const errors = [];
  const strongestExistingBoundary =
    evaluateMetaContentStagingMigrationEnvironment(
      {
        ...environment,
        FANMIND_META_CONTENT_REVIEWED_COMMIT:
          environment.FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT,
        FANMIND_META_CONTENT_STAGING_RESOURCE_CONFIRM:
          META_CONTENT_STAGING_RESOURCE_CONFIRMATION,
      },
      { mode: "readiness" },
    );

  if (!strongestExistingBoundary.ok) {
    errors.push(...strongestExistingBoundary.errors);
  }
  if (
    clean(environment.FANMIND_STAGING_DATABASE_ROLLOUT_STATE_CONFIRM) !==
    STAGING_DATABASE_ROLLOUT_STATE_CONFIRMATION
  ) {
    errors.push("confirmation");
  }
  if (clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "false") {
    errors.push("write_gate");
  }
  if (clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK)) {
    errors.push("write_acknowledgement");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
  });
}

function deriveMigrationBlockAction({ ledgerApplied, objectState }) {
  if (typeof ledgerApplied !== "boolean" || !OBJECT_STATES.has(objectState)) {
    return "block";
  }
  if (objectState === "invalid") return "block";
  if (ledgerApplied && objectState === "current") return "verify";
  if (!ledgerApplied && objectState === "current") return "skip";
  if (!ledgerApplied && objectState === "absent") return "apply";
  return "block";
}

function deriveMetaAction({ foundationApplied, historyApplied, objectState }) {
  if (
    typeof foundationApplied !== "boolean" ||
    typeof historyApplied !== "boolean" ||
    !META_OBJECT_STATES.has(objectState)
  ) {
    return "block";
  }
  if (foundationApplied !== historyApplied || objectState === "invalid") {
    return "block";
  }
  if (objectState === "foundation") {
    return foundationApplied && historyApplied ? "apply" : "block";
  }
  return deriveMigrationBlockAction({
    ledgerApplied: foundationApplied && historyApplied,
    objectState,
  });
}

function deriveTriggerAction(triggerState) {
  if (!TRIGGER_STATES.has(triggerState)) return "block";
  if (triggerState === "unavailable") return "skip";
  if (triggerState === "current") return "verify";
  if (triggerState === "pending") return "apply";
  return "block";
}

function deriveControlledObjectAction(objectState) {
  if (!OBJECT_STATES.has(objectState) || objectState === "invalid") {
    return "block";
  }
  return objectState === "absent" ? "apply" : "verify";
}

function deriveWorkspaceMemberBoundaryAction({
  prerequisiteApplied,
  inGenericLedger,
  objectState,
}) {
  if (prerequisiteApplied !== true || inGenericLedger !== false) {
    return "block";
  }
  return deriveControlledObjectAction(objectState);
}

function deriveWhatsAppCloudInboundAction({
  workspaceMemberBoundaryState,
  inGenericLedger,
  objectState,
}) {
  if (inGenericLedger !== false || !OBJECT_STATES.has(objectState)) {
    return "block";
  }
  if (workspaceMemberBoundaryState === "absent") {
    return objectState === "absent" ? "skip" : "block";
  }
  if (workspaceMemberBoundaryState !== "current") return "block";
  return deriveControlledObjectAction(objectState);
}

export function deriveStagingDatabaseRolloutActions({
  ledger = {},
  objects = {},
} = {}) {
  const aiTierStripeLedgerState = objects.aiTierStripeLedger ?? "absent";
  const stripeBillingLedgerState = objects.stripeBillingLedger ?? "absent";
  const actions = Object.freeze({
    workspaceMemberBoundary: deriveWorkspaceMemberBoundaryAction({
      prerequisiteApplied: ledger.workspaceMemberPrerequisite,
      inGenericLedger: ledger.workspaceMemberInGenericLedger,
      objectState: objects.workspaceMemberBoundary,
    }),
    whatsappCloudInbound: deriveWhatsAppCloudInboundAction({
      workspaceMemberBoundaryState: objects.workspaceMemberBoundary,
      inGenericLedger: ledger.whatsappCloudInboundInGenericLedger,
      objectState: objects.whatsappCloudInbound,
    }),
    aiTier: deriveMigrationBlockAction({
      ledgerApplied: ledger.aiTier,
      objectState: objects.aiTier,
    }),
    aiTierStripeLedger:
      objects.aiTier === "current"
        ? deriveControlledObjectAction(aiTierStripeLedgerState)
        : "block",
    stripeBillingLedger: deriveControlledObjectAction(
      stripeBillingLedgerState,
    ),
    mobilePush: deriveMigrationBlockAction({
      ledgerApplied: ledger.mobilePush,
      objectState: objects.mobilePush,
    }),
    metaContent: deriveMetaAction({
      foundationApplied: ledger.metaFoundation,
      historyApplied: ledger.metaHistory,
      objectState: objects.metaContent,
    }),
    metaCatchup: deriveControlledObjectAction(objects.metaCatchup),
    metaContinuation: deriveMigrationBlockAction({
      ledgerApplied: ledger.metaContinuation,
      objectState: objects.metaContinuation,
    }),
    triggerHardening: deriveTriggerAction(objects.triggerHardening),
  });

  return Object.freeze({
    actions,
    blocked: Object.values(actions).includes("block"),
  });
}
