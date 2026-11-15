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

const REVIEWED_BRANCH_REF_PATTERN = /^refs\/heads\/[A-Za-z0-9](?:[A-Za-z0-9._\/-]*[A-Za-z0-9])?$/u;

export function evaluateWebsiteChatRetentionStagingEnvironment(
  environment = {},
  { mode = "schema", allowReviewedBranch = false } = {},
) {
  const confirmation = RETENTION_CONFIRMATIONS[mode];
  if (!confirmation) {
    return Object.freeze({ ok: false, mode, errors: Object.freeze(["mode"]) });
  }
  const reviewedCommit = String(
    environment.FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT ?? "",
  ).trim().toLowerCase();
  const githubSha = String(environment.GITHUB_SHA ?? "").trim().toLowerCase();
  const githubRef = String(environment.GITHUB_REF ?? "").trim();
  const reviewedRef = String(
    environment.FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_REF ?? "",
  ).trim();
  const reviewedBranchAllowed =
    allowReviewedBranch &&
    mode === "acceptance" &&
    reviewedRef !== "refs/heads/main" &&
    REVIEWED_BRANCH_REF_PATTERN.test(reviewedRef) &&
    githubRef === reviewedRef &&
    /^[0-9a-f]{40}$/u.test(githubSha) &&
    githubSha === reviewedCommit;
  const retentionConfirmation = environment[confirmation[0]];
  const mapped = {
    ...environment,
    GITHUB_REF: reviewedBranchAllowed ? "refs/heads/main" : githubRef,
    FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT: reviewedCommit,
    [confirmation[1]]:
      retentionConfirmation === confirmation[2]
        ? confirmation[3]
        : retentionConfirmation,
  };
  const result = evaluateWebsiteChatStagingControlEnvironment(mapped, { mode });
  const errors = [...result.errors];
  if (allowReviewedBranch && !reviewedBranchAllowed) {
    errors.push("retention_reviewed_ref");
  }
  return Object.freeze({
    ...result,
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
  });
}
