import {
  META_CONTENT_STAGING_MIGRATION_CONFIRMATION,
  META_CONTENT_STAGING_VERIFY_CONFIRMATION,
  evaluateMetaContentStagingMigrationEnvironment,
} from "./metaContentStagingMigrationPolicy.mjs";

export const META_CONVERSATION_CONTINUATION_APPLY_CONFIRMATION =
  "apply-meta-conversation-continuation";
export const META_CONVERSATION_CONTINUATION_VERIFY_CONFIRMATION =
  "verify-meta-conversation-continuation";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function evaluateMetaConversationContinuationStagingEnvironment(
  environment = {},
  { mode = "verify" } = {},
) {
  if (mode !== "verify" && mode !== "apply") {
    return Object.freeze({
      ok: false,
      mode,
      writeEnabled: false,
      errors: Object.freeze(["mode"]),
    });
  }

  const apply = mode === "apply";
  const base = evaluateMetaContentStagingMigrationEnvironment(
    {
      ...environment,
      FANMIND_META_CONTENT_REVIEWED_COMMIT:
        environment.FANMIND_META_CONVERSATION_CONTINUATION_REVIEWED_COMMIT,
      FANMIND_META_CONTENT_STAGING_MIGRATION_CONFIRM:
        META_CONTENT_STAGING_MIGRATION_CONFIRMATION,
      FANMIND_META_CONTENT_STAGING_VERIFY_CONFIRM:
        META_CONTENT_STAGING_VERIFY_CONFIRMATION,
    },
    { mode },
  );
  const errors = [...base.errors];
  const expectedConfirmation = apply
    ? META_CONVERSATION_CONTINUATION_APPLY_CONFIRMATION
    : META_CONVERSATION_CONTINUATION_VERIFY_CONFIRMATION;
  const actualConfirmation = apply
    ? clean(environment.FANMIND_META_CONVERSATION_CONTINUATION_APPLY_CONFIRM)
    : clean(environment.FANMIND_META_CONVERSATION_CONTINUATION_VERIFY_CONFIRM);
  if (actualConfirmation !== expectedConfirmation) {
    errors.push("continuation_confirmation");
  }

  return Object.freeze({
    ok: errors.length === 0,
    mode,
    writeEnabled: apply,
    errors: Object.freeze([...new Set(errors)]),
  });
}
