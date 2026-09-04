import {
  WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION,
  WEBSITE_CHAT_MIGRATION_CONFIRMATION,
  WEBSITE_CHAT_SCHEMA_CONFIRMATION,
  evaluateWebsiteChatStagingControlEnvironment,
} from "./websiteChatStagingControlPolicy.mjs";

export const WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRMATION =
  "verify-website-chat-retention-schema";
export const WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRMATION =
  "apply-website-chat-retention-migration";
export const WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRMATION =
  "run-website-chat-retention-acceptance";

const RETENTION_CONFIRMATIONS = Object.freeze({
  schema: Object.freeze([
    "FANMIND_WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRM",
    "FANMIND_WEBSITE_CHAT_SCHEMA_CONFIRM",
    WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRMATION,
    WEBSITE_CHAT_SCHEMA_CONFIRMATION,
  ]),
  migration: Object.freeze([
    "FANMIND_WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRM",
    "FANMIND_WEBSITE_CHAT_MIGRATION_CONFIRM",
    WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRMATION,
    WEBSITE_CHAT_MIGRATION_CONFIRMATION,
  ]),
  acceptance: Object.freeze([
    "FANMIND_WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRM",
    "FANMIND_WEBSITE_CHAT_ACCEPTANCE_CONFIRM",
    WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRMATION,
    WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION,
  ]),
});

export function evaluateWebsiteChatRetentionStagingEnvironment(
  environment = {},
  { mode = "schema" } = {},
) {
  const confirmation = RETENTION_CONFIRMATIONS[mode];
  if (!confirmation) {
    return Object.freeze({ ok: false, mode, errors: Object.freeze(["mode"]) });
  }
  const reviewedCommit = environment.FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT;
  const retentionConfirmation = environment[confirmation[0]];
  const mapped = {
    ...environment,
    FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT: reviewedCommit,
    [confirmation[1]]:
      retentionConfirmation === confirmation[2]
        ? confirmation[3]
        : retentionConfirmation,
  };
  const result = evaluateWebsiteChatStagingControlEnvironment(mapped, { mode });
  return Object.freeze({
    ...result,
    errors: Object.freeze([...result.errors]),
  });
}
