export type DemoCleanupFilterColumn = "workspace_id" | "id";

export type DemoCleanupDeleteStep = {
  table: string;
  filterColumn: DemoCleanupFilterColumn;
  optional: boolean;
  errorCode: DemoCleanupDeleteStepErrorCode;
};

export type DemoCleanupDeleteStepErrorCode =
  | "demo_delete_conversation_messages_failed"
  | "demo_delete_conversations_failed"
  | "demo_delete_memories_failed"
  | "demo_delete_followups_failed"
  | "demo_delete_contact_reply_targets_failed"
  | "demo_delete_conversation_summaries_failed"
  | "demo_delete_contact_ai_profiles_failed"
  | "demo_delete_fan_analysis_reports_failed"
  | "demo_delete_contacts_failed"
  | "demo_delete_workspace_members_failed"
  | "demo_delete_workspace_failed";

export type DemoCleanupDeleteErrorCode =
  | "demo_cleanup_not_configured"
  | "demo_identity_not_temporary"
  | "demo_workspace_identity_mismatch"
  | DemoCleanupDeleteStepErrorCode
  | "demo_delete_auth_user_failed";

export const DEMO_CLEANUP_DELETE_STEPS: readonly DemoCleanupDeleteStep[] =
  Object.freeze([
    {
      table: "conversation_messages",
      filterColumn: "workspace_id",
      optional: false,
      errorCode: "demo_delete_conversation_messages_failed",
    },
    {
      table: "conversations",
      filterColumn: "workspace_id",
      optional: false,
      errorCode: "demo_delete_conversations_failed",
    },
    {
      table: "memories",
      filterColumn: "workspace_id",
      optional: false,
      errorCode: "demo_delete_memories_failed",
    },
    {
      table: "followups",
      filterColumn: "workspace_id",
      optional: false,
      errorCode: "demo_delete_followups_failed",
    },
    {
      table: "contact_reply_targets",
      filterColumn: "workspace_id",
      optional: true,
      errorCode: "demo_delete_contact_reply_targets_failed",
    },
    {
      table: "conversation_summaries",
      filterColumn: "workspace_id",
      optional: true,
      errorCode: "demo_delete_conversation_summaries_failed",
    },
    {
      table: "contact_ai_profiles",
      filterColumn: "workspace_id",
      optional: true,
      errorCode: "demo_delete_contact_ai_profiles_failed",
    },
    {
      table: "fan_analysis_reports",
      filterColumn: "workspace_id",
      optional: true,
      errorCode: "demo_delete_fan_analysis_reports_failed",
    },
    {
      table: "contacts",
      filterColumn: "workspace_id",
      optional: false,
      errorCode: "demo_delete_contacts_failed",
    },
    {
      table: "workspace_members",
      filterColumn: "workspace_id",
      optional: false,
      errorCode: "demo_delete_workspace_members_failed",
    },
    {
      table: "workspaces",
      filterColumn: "id",
      optional: false,
      errorCode: "demo_delete_workspace_failed",
    },
  ] satisfies DemoCleanupDeleteStep[]);
