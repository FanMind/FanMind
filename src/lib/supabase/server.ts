import { createHash } from "node:crypto";
import {
  getMessageKindFromAttachments,
  normalizeMessageAttachments,
  type NormalizedMessageAttachment as ConversationMessageAttachment,
} from "@/lib/messageAttachments";
import {
  buildFacebookBusinessInboxThreadUrl,
  extractBusinessInboxUrlCandidates,
  extractFacebookBusinessId,
  extractFacebookPageId,
  extractSelectedItemIdFromMetaUrl,
  extractThreadIdFromMetaUrl,
} from "@/lib/sourceContext";
export type { NormalizedMessageAttachment as ConversationMessageAttachment } from "@/lib/messageAttachments";

import { cookies } from "next/headers";
import {
  getBillingProvider,
  getInitialBillingStatus,
  getPaymentCollectionMethod,
  PAYMENT_TERMS_VERSION,
} from "@/lib/billing";
import {
  getRegistrationCommercialTerms,
  isPlanId,
  type ProductiveCommercialOption,
} from "@/lib/plans";
import type { PlanId } from "@/config/plans";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";
import { isTemporaryDemoUser, TEMPORARY_DEMO_WORKSPACE_NAME } from "@/lib/demoMode";
import {
  DEMO_CLEANUP_DELETE_STEPS,
  type DemoCleanupDeleteErrorCode,
  type DemoCleanupFilterColumn,
} from "@/lib/demoCleanupPolicy";
import {
  getSupabaseAuthUrl,
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
  SUPABASE_REFRESH_TOKEN_COOKIE,
} from "./config";
import {
  minimizeWebhookDiagnosticPayload,
  normalizeWhatsAppCloudDiagnosticPayload,
  normalizeWebhookErrorCode,
} from "@/lib/webhookSecurityPolicy.mjs";
import {
  INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_READY_RPC,
  INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_RPC,
  isMissingWorkspaceExpandColumn,
  isMissingWorkspaceProvisioningRpc,
  WORKSPACE_PROVISIONING_RPC,
  type WorkspaceProvisioningRpcRow,
} from "@/lib/workspaceProvisioning";

export type SupabaseServerUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type SupabaseServerUserResponse = {
  data: { user: SupabaseServerUser | null };
  error: Error | null;
};

type WorkspaceCommercialOption =
  | ProductiveCommercialOption
  | "starter_no_setup_commitment";

export const PUBLIC_DAILY_TEST_PLAN_UNAVAILABLE_ERROR =
  "public_daily_test_plan_unavailable";

export const PUBLIC_DAILY_TEST_PROVISIONING_UNAVAILABLE_ERROR =
  "public_daily_test_provisioning_unavailable";

export const PUBLIC_DAILY_TEST_BILLING_UNAVAILABLE_ERROR =
  "public_daily_test_billing_unavailable";

export type WorkspaceBackfillRow = {
  id: string;
  name: string;
  owner_user_id: string;
  plan_id: PlanId;
  commercial_option: WorkspaceCommercialOption;
  setup_fee_cents: number;
  monthly_fee_cents: number;
  commitment_months: 0 | 12;
  billing_status?: string | null;
  billing_provider?: string | null;
  payment_collection_method?: string | null;
  billing_suspended_at?: string | null;
  billing_suspended_reason?: string | null;
  billing_manual_override?: boolean | null;
  billing_last_payment_failed_at?: string | null;
  billing_last_payment_at?: string | null;
  billing_retry_count?: number | null;
  billing_next_retry_at?: string | null;
  billing_grace_until?: string | null;
  billing_admin_note?: string | null;
  billing_contract_started_at?: string | null;
  billing_current_period_end_at?: string | null;
  billing_next_invoice_at?: string | null;
  billing_minimum_term_ends_at?: string | null;
  subscription_cancel_requested_at?: string | null;
  subscription_cancel_requested_by_user_id?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  subscription_effective_end_at?: string | null;
  subscription_cancellation_revoked_at?: string | null;
  workspace_access_mode?: string | null;
  billing_updated_at?: string | null;
  billing_updated_by_user_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_mandate_id?: string | null;
  billing_note?: string | null;
  last_invoice_id?: string | null;
  last_invoice_status?: string | null;
  last_invoice_amount_due_cents?: number | null;
  last_invoice_amount_paid_cents?: number | null;
  last_invoice_hosted_url?: string | null;
  last_invoice_pdf_url?: string | null;
  test_access_flags?: Record<string, unknown> | null;
  organization_name?: string | null;
  street_address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  vat_id?: string | null;
  tax_number?: string | null;
  company_register_number?: string | null;
  company_register_court?: string | null;
};

type WorkspaceProcessingRow = Pick<
  WorkspaceBackfillRow,
  | "id"
  | "billing_status"
  | "billing_suspended_at"
  | "billing_manual_override"
  | "billing_grace_until"
  | "subscription_effective_end_at"
  | "workspace_access_mode"
  | "test_access_flags"
>;

export type WorkspaceDashboardRow = WorkspaceBackfillRow & {
  role: string;
  member_safe_projection?: true;
  member_processing_allowed?: boolean;
};

type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  role: string;
};

type WorkspaceMemberCompatibilityProcessingRow = Pick<
  WorkspaceBackfillRow,
  | "id"
  | "name"
  | "plan_id"
  | "billing_status"
  | "billing_suspended_at"
  | "billing_manual_override"
  | "billing_grace_until"
  | "subscription_effective_end_at"
  | "workspace_access_mode"
  | "test_access_flags"
>;

export type WorkspaceMemberSafeDashboardRow = {
  workspace_id: string;
  workspace_name: string;
  plan_id: PlanId;
  membership_role: "member";
  member_processing_allowed: boolean;
};

const WORKSPACE_MEMBER_SAFE_DASHBOARD_RPC =
  "get_current_workspace_member_safe_dashboard";

function isMissingWorkspaceMemberSafeDashboardRpc(
  error: Error | null,
): boolean {
  const message = error?.message.trim().toLowerCase() ?? "";
  return (
    message.includes(WORKSPACE_MEMBER_SAFE_DASHBOARD_RPC) &&
    message.includes("could not find the function") &&
    message.includes("schema cache")
  );
}

function memberSafeProjectionCompatibilityEnvelope(
  workspace: WorkspaceMemberSafeDashboardRow,
): WorkspaceDashboardRow {
  // The member RPC intentionally has its own minimal DTO. These placeholders
  // only satisfy the legacy dashboard carrier until it is fully split; every
  // policy/renderer must discriminate member_safe_projection before reading
  // any commercial field from this envelope.
  return {
    id: workspace.workspace_id,
    name: workspace.workspace_name,
    owner_user_id: "",
    plan_id: workspace.plan_id,
    commercial_option: "starter_no_setup_commitment",
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    commitment_months: 0,
    role: "member",
    member_safe_projection: true,
    member_processing_allowed: workspace.member_processing_allowed,
  };
}

export type ContactRow = {
  id: string;
  workspace_id: string;
  display_name: string;
  handle: string | null;
  source_platform: string | null;
  language: string | null;
  status: string | null;
  tags: string[] | null;
  summary: string | null;
  internal_notes: string | null;
  is_top_fan: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MemoryRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  type: string | null;
  content: string;
  importance: string | null;
  created_at: string | null;
};

export type ContactReplyTargetRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  source_platform: string;
  source_type: string;
  label: string | null;
  url: string;
  quality: string;
  created_at: string | null;
  updated_at: string | null;
};

export type ConversationRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  status: string;
  priority: string;
  source_platform: string | null;
  source_type: string | null;
  source_url: string | null;
  reply_target_url: string | null;
  external_thread_id: string | null;
  external_message_id: string | null;
  external_post_id: string | null;
  external_comment_id: string | null;
  original_author_label: string | null;
  original_text_excerpt: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_preview: string | null;
  assigned_owner: string | null;
  assigned_user_id: string | null;
  assignment_supported?: boolean;
  ai_status: string;
  next_step: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ConversationMessageRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string;
  direction: string;
  message_type: string;
  source_platform: string | null;
  source_type: string | null;
  source_url: string | null;
  reply_target_url: string | null;
  external_thread_id: string | null;
  external_message_id: string | null;
  external_post_id: string | null;
  external_video_id: string | null;
  external_comment_id: string | null;
  original_author_label: string | null;
  original_text_excerpt: string | null;
  author_label: string | null;
  content: string;
  attachments: ConversationMessageAttachment[] | null;
  message_kind: string | null;
  created_at: string | null;
  seen_at: string | null;
};

export type ConversationSummaryRow = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string;
  summary: string | null;
  key_points: string[] | null;
  open_questions: string[] | null;
  last_summarized_message_at: string | null;
  message_count_seen: number;
  updated_at: string | null;
  created_at: string | null;
};

export type FanAnalysisReportRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  report_json: Record<string, unknown>;
  summary: string | null;
  model: string | null;
  source_message_count: number;
  generated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ContactAiProfileRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  language: string | null;
  tone: string | null;
  sentiment: string | null;
  interests: string[] | null;
  buying_signals: string[] | null;
  no_gos: string[] | null;
  preferred_style: string | null;
  response_triggers: string[] | null;
  risk_notes: string[] | null;
  confidence_score: number | null;
  source_message_count: number | null;
  updated_at: string | null;
  created_at: string | null;
};

export type WorkspaceVoiceProfileRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  owner_label: string | null;
  language: string | null;
  tone: string | null;
  sentence_length: string | null;
  emoji_style: string | null;
  greeting_style: string | null;
  closing_style: string | null;
  common_phrases: string[] | null;
  avoided_phrases: string[] | null;
  sales_style: string | null;
  examples_count: number | null;
  confidence_score: number | null;
  updated_at: string | null;
  created_at: string | null;
};

export type SocialConnectionRow = {
  id: string;
  workspace_id: string;
  platform: string;
  provider: string;
  status: string;
  external_account_id: string | null;
  external_account_name: string | null;
  page_id: string | null;
  page_name: string | null;
  page_access_token_encrypted?: string | null;
  token_last_four: string | null;
  scopes: string[] | null;
  webhook_subscribed: boolean;
  connected_by: string | null;
  connected_at: string;
  disconnected_at: string | null;
  last_event_at: string | null;
  last_comment_fetch_at: string | null;
  last_comment_fetch_count: number | null;
  last_comment_fetch_error: string | null;
  last_messenger_sync_at: string | null;
  last_messenger_sync_checked_count: number | null;
  last_messenger_sync_imported_inbound_count: number | null;
  last_messenger_sync_imported_outbound_count: number | null;
  last_messenger_sync_imported_media_count: number | null;
  last_messenger_sync_skipped_count: number | null;
  last_messenger_sync_error: string | null;
  last_messenger_sync_outbound_at: string | null;
  oauth_login_type: string | null;
  external_account_type: string | null;
  token_expires_at: string | null;
  permissions_verified_at: string | null;
  analytics_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type MetaMessengerSyncContinuationRow = {
  messenger_sync_continuation_after: string | null;
  messenger_sync_continuation_started_at: string | null;
};

export type MetaMessengerSyncContinuationResult = {
  schemaReady: boolean;
  continuationAfter: string | null;
  continuationStartedAt: string | null;
  error: Error | null;
};

export type MetaConversationCatchupJobRow = {
  id: string;
  workspace_id: string;
  social_connection_id: string;
  platform: "facebook" | "instagram";
  fan_sender_id: string;
  contact_id: string | null;
  status:
    | "pending"
    | "claimed"
    | "retry"
    | "succeeded"
    | "dead_letter"
    | "cancelled";
  attempt_count: number;
  generation: number;
  claimed_generation: number | null;
  available_at: string;
  worker_id: string | null;
  lease_token: string | null;
  lease_until: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type MetaConversationCatchupJobResult = {
  job: MetaConversationCatchupJobRow | null;
  error: Error | null;
};

export type WorkspaceAnalysisSettingsRow = {
  workspace_id: string;
  fan_analysis_enabled: boolean;
  conversation_analysis_enabled: boolean;
  user_voice_analysis_enabled: boolean;
  content_insights_enabled: boolean;
  meta_sync_mode: "incremental_cache";
  personal_content_retention_days: 0;
  legal_basis_status: string;
  transparency_status: string;
  data_processing_agreement_status: string;
  retention_status: string;
  data_subject_rights_status: string;
  message_retention_days: number | null;
  content_cache_retention_days: number | null;
  analysis_retention_days: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceAnalysisCapability =
  | "fan_analysis"
  | "conversation_analysis"
  | "user_voice_analysis"
  | "content_insights";

export type MetaWebhookEventRow = {
  id: string;
  workspace_id: string | null;
  social_connection_id: string | null;
  platform: string;
  source: string;
  event_type: string;
  page_id: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  text: string | null;
  message_text: string | null;
  raw_payload: unknown;
  status: string;
  error_reason: string | null;
  message_id: string | null;
  received_at: string;
  created_at: string;
};

export type FollowupRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  due_date: string | null;
  priority: string | null;
  reason: string;
  status: string | null;
  created_at: string | null;
};

type CreateContactInput = {
  workspaceId: string;
  displayName: string;
  handle?: string | null;
  sourcePlatform?: string | null;
  language?: string | null;
  status?: string | null;
  tags?: string[];
  summary?: string | null;
};

type CreateContactBatchInput = {
  workspaceId: string;
  contacts: Array<Omit<CreateContactInput, "workspaceId">>;
};

type UpdateContactInput = CreateContactInput & {
  contactId: string;
};

type CreateMemoryInput = {
  workspaceId: string;
  contactId: string;
  type?: string | null;
  content: string;
  importance?: string | null;
};

type ConversationStatus = "open" | "waiting" | "done" | "archived";
type ConversationPriority = "low" | "normal" | "medium" | "high";

type CreateManualConversationMessageInput = {
  workspaceId: string;
  contactId: string;
  direction?: "inbound" | "outbound" | "note";
  messageType?: string | null;
  sourcePlatform?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  replyTargetUrl?: string | null;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  externalPostId?: string | null;
  externalCommentId?: string | null;
  originalAuthorLabel?: string | null;
  originalTextExcerpt?: string | null;
  authorLabel?: string | null;
  userId?: string | null;
  content: string;
  attachments?: ConversationMessageAttachment[] | null;
  messageKind?: string | null;
};

type UpsertMetaSocialConnectionInput = {
  workspaceId: string;
  connectedBy: string;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  pageId: string;
  pageName: string;
  pageAccessTokenEncrypted?: string | null;
  tokenLastFour?: string | null;
  scopes?: string[];
  webhookSubscribed?: boolean;
  oauthLoginType?: string | null;
  externalAccountType?: string | null;
  tokenExpiresAt?: string | null;
  permissionsVerifiedAt?: string | null;
};

type CreateFollowupInput = {
  workspaceId: string;
  contactId: string;
  dueDate?: string | null;
  priority?: string | null;
  reason: string;
  status?: string | null;
};

type ContactsResult = {
  contacts: ContactRow[];
  error: Error | null;
};

type ContactCreateResult = {
  contact: ContactRow | null;
  error: Error | null;
};

type ContactBatchCreateResult = {
  createdCount: number;
  error: Error | null;
};

export type ContactUpdateResult = {
  contact: ContactRow | null;
  error: Error | null;
};

type ContactDetailResult = {
  contact: ContactRow | null;
  error: Error | null;
};

type ContactReplyTargetResult = {
  target: ContactReplyTargetRow | null;
  error: Error | null;
};

type FanAnalysisReportResult = {
  report: FanAnalysisReportRow | null;
  error: Error | null;
};

type MemoriesResult = {
  memories: MemoryRow[];
  error: Error | null;
};

type MemoryCreateResult = {
  memory: MemoryRow | null;
  error: Error | null;
};

type ConversationsResult = {
  conversations: ConversationRow[];
  error: Error | null;
};

type ConversationMessagesResult = {
  messages: ConversationMessageRow[];
  error: Error | null;
};

type ConversationResult = {
  conversation: ConversationRow | null;
  error: Error | null;
};

type ConversationMessageCreateResult = {
  message: ConversationMessageRow | null;
  conversation: ConversationRow | null;
  error: Error | null;
};

type ConversationUpdateResult = {
  conversation: ConversationRow | null;
  error: Error | null;
};

type SocialConnectionResult = {
  connection: SocialConnectionRow | null;
  error: Error | null;
  processingBlocked?: boolean;
};

export type WhatsAppCloudConnectionLookupResult = {
  connection: SocialConnectionRow | null;
  error: Error | null;
  processingBlocked: boolean;
  schemaReady: boolean;
  lookupStatus:
    | "matched"
    | "schema_not_ready"
    | "unmapped"
    | "ambiguous"
    | "processing_blocked"
    | "lookup_failed";
};

export type WhatsAppCloudReceiptClaimResult = {
  receiptId: string | null;
  leaseToken: string | null;
  outcome:
    | "claimed"
    | "duplicate"
    | "in_progress"
    | "exhausted"
    | "cancelled"
    | "conflict"
    | "claim_failed";
  error: Error | null;
};

export type WhatsAppCloudStoreResult = {
  conversationMessageId: string | null;
  outcome:
    | "stored"
    | "duplicate"
    | "processing_blocked"
    | "connection_unavailable"
    | "stale_lease"
    | "conflict"
    | "store_failed";
  error: Error | null;
};

type WhatsAppCloudSchemaStateRow = { ready: boolean };
type WhatsAppCloudReceiptClaimRow = {
  receipt_id: string;
  lease_token: string | null;
  outcome: string;
};
type WhatsAppCloudStoreRow = {
  conversation_message_id: string | null;
  outcome: string;
};
type WhatsAppCloudDisconnectRow = { disconnected: boolean };

export type WorkspaceProcessingEntitlementResult = {
  allowed: boolean;
  reason: string;
  error: Error | null;
};

type SocialConnectionsResult = {
  connections: SocialConnectionRow[];
  error: Error | null;
};

export type MetaWebhookEventsResult = {
  events: MetaWebhookEventRow[];
  error: Error | null;
};

type MetaWebhookEventCreateResult = {
  event: MetaWebhookEventRow | null;
  error: Error | null;
};

type FollowupsResult = {
  followups: FollowupRow[];
  error: Error | null;
};

type FollowupCreateResult = {
  followup: FollowupRow | null;
  error: Error | null;
};

type FollowupCountResult = {
  count: number;
  error: Error | null;
};

export type FollowupCompletionCountsResult = {
  open: number;
  completed: number;
  error: Error | null;
};

type WorkspaceBackfillResult = {
  workspace: WorkspaceBackfillRow | null;
  error: Error | null;
  created: boolean;
};

type InternalDailyTestProvisioningReadyRow = {
  ready: boolean;
};

type WorkspaceDashboardResult = {
  workspace: WorkspaceDashboardRow | null;
  error: Error | null;
};

type PostgrestResult<T> = {
  data: T | null;
  error: Error | null;
};

type PostgrestCountResult = {
  count: number;
  error: Error | null;
};

type SupabaseFilterValue = string | number | boolean | null;

const WORKSPACE_COLUMNS =
  "id,name,owner_user_id,plan_id,commercial_option,setup_fee_cents,monthly_fee_cents,commitment_months,billing_status,billing_provider,payment_collection_method,billing_suspended_at,billing_suspended_reason,billing_manual_override,billing_last_payment_failed_at,billing_last_payment_at,billing_retry_count,billing_next_retry_at,billing_grace_until,billing_admin_note,billing_contract_started_at,billing_current_period_end_at,billing_next_invoice_at,billing_minimum_term_ends_at,subscription_cancel_requested_at,subscription_cancel_requested_by_user_id,subscription_cancel_at_period_end,subscription_effective_end_at,subscription_cancellation_revoked_at,workspace_access_mode,billing_updated_at,billing_updated_by_user_id,stripe_customer_id,stripe_subscription_id,last_invoice_id,last_invoice_status,last_invoice_amount_due_cents,last_invoice_amount_paid_cents,last_invoice_hosted_url,last_invoice_pdf_url,test_access_flags,organization_name,street_address,postal_code,city,country,vat_id,tax_number,company_register_number,company_register_court";
const WORKSPACE_PROCESSING_COLUMNS =
  "id,billing_status,billing_suspended_at,billing_manual_override,billing_grace_until,subscription_effective_end_at,workspace_access_mode,test_access_flags";
const CONTACT_COLUMNS =
  "id,workspace_id,display_name,handle,source_platform,language,status,tags,summary,internal_notes,is_top_fan,created_at,updated_at";
const MEMORY_COLUMNS =
  "id,workspace_id,contact_id,type,content,importance,created_at";
const CONTACT_REPLY_TARGET_COLUMNS =
  "id,workspace_id,contact_id,source_platform,source_type,label,url,quality,created_at,updated_at";
const CONVERSATION_COLUMNS =
  "id,workspace_id,contact_id,status,priority,source_platform,source_type,source_url,reply_target_url,external_thread_id,external_message_id,external_post_id,external_comment_id,original_author_label,original_text_excerpt,last_inbound_at,last_outbound_at,last_message_preview,assigned_owner,ai_status,next_step,created_at,updated_at";
const CONVERSATION_ASSIGNMENT_COLUMNS =
  `${CONVERSATION_COLUMNS},assigned_user_id`;
const CONVERSATION_MESSAGE_COLUMNS =
  "id,workspace_id,conversation_id,contact_id,direction,message_type,source_platform,source_type,source_url,reply_target_url,external_thread_id,external_message_id,external_post_id,external_video_id,external_comment_id,original_author_label,original_text_excerpt,author_label,content,attachments,message_kind,created_at,seen_at";
const CONVERSATION_SUMMARY_COLUMNS =
  "id,workspace_id,conversation_id,contact_id,summary,key_points,open_questions,last_summarized_message_at,message_count_seen,updated_at,created_at";
const CONTACT_AI_PROFILE_COLUMNS =
  "id,workspace_id,contact_id,language,tone,sentiment,interests,buying_signals,no_gos,preferred_style,response_triggers,risk_notes,confidence_score,source_message_count,updated_at,created_at";
const FAN_ANALYSIS_REPORT_COLUMNS =
  "id,workspace_id,contact_id,report_json,summary,model,source_message_count,generated_at,created_at,updated_at";
const WORKSPACE_VOICE_PROFILE_COLUMNS =
  "id,workspace_id,user_id,owner_label,language,tone,sentence_length,emoji_style,greeting_style,closing_style,common_phrases,avoided_phrases,sales_style,examples_count,confidence_score,updated_at,created_at";
const SOCIAL_CONNECTION_PUBLIC_COLUMNS =
  "id,workspace_id,platform,provider,status,external_account_id,external_account_name,page_id,page_name,token_last_four,scopes,webhook_subscribed,connected_by,connected_at,disconnected_at,last_event_at,last_comment_fetch_at,last_comment_fetch_count,last_comment_fetch_error,last_messenger_sync_at,last_messenger_sync_checked_count,last_messenger_sync_imported_inbound_count,last_messenger_sync_imported_outbound_count,last_messenger_sync_imported_media_count,last_messenger_sync_skipped_count,last_messenger_sync_error,last_messenger_sync_outbound_at,created_at,updated_at";
const SOCIAL_CONNECTION_SECRET_COLUMNS =
  `${SOCIAL_CONNECTION_PUBLIC_COLUMNS},page_access_token_encrypted`;
const META_MESSENGER_SYNC_CONTINUATION_COLUMNS =
  "messenger_sync_continuation_after,messenger_sync_continuation_started_at";
const META_CONVERSATION_CATCHUP_JOB_COLUMNS =
  "id,workspace_id,social_connection_id,platform,fan_sender_id,contact_id,status,attempt_count,generation,claimed_generation,available_at,worker_id,lease_token,lease_until,last_error_code,created_at,updated_at,finished_at";
const WORKSPACE_ANALYSIS_SETTINGS_COLUMNS =
  "workspace_id,fan_analysis_enabled,conversation_analysis_enabled,user_voice_analysis_enabled,content_insights_enabled,meta_sync_mode,personal_content_retention_days,legal_basis_status,transparency_status,data_processing_agreement_status,retention_status,data_subject_rights_status,message_retention_days,content_cache_retention_days,analysis_retention_days,confirmed_by,confirmed_at,created_at,updated_at";
const META_WEBHOOK_EVENT_COLUMNS =
  "id,workspace_id,social_connection_id,platform,source,event_type,page_id,sender_id,recipient_id,text,message_text,raw_payload,status,error_reason,message_id,received_at,created_at";
const FOLLOWUP_COLUMNS =
  "id,workspace_id,contact_id,due_date,priority,reason,status,created_at";
const DEFAULT_WORKSPACE_NAME = "FanMind Workspace";
const DEMO_EMAIL = "sandra.m@fanmind.ch";
const DEMO_WORKSPACE_NAME = "Sandra M. Demo Workspace";
const DEMO_CONTACT_HANDLE = "@sandra-demo";
const TEMPORARY_DEMO_ACCESS_FLAG = "temporary_demo";
const TEMPORARY_PROCESSING_ACCESS_FLAG = "temporary_processing_access";
const TEMPORARY_PROCESSING_ACCESS_EXPIRY_FLAG =
  "temporary_processing_access_expires_at";
const FIXED_DEMO_SEED_VERSION_FLAG = "fixed_demo_seed_version";
const FIXED_DEMO_SEED_VERSION = "2026-07-26-v1";
const TEMPORARY_DEMO_MAX_FUTURE_EXPIRY_MS = 65 * 60 * 1000;
const TEMPORARY_DEMO_EXPIRED_ERROR = "TEMPORARY_DEMO_EXPIRED";

type DemoStartSessionEntitlementRow = {
  id: string;
  status: string;
  expires_at: string;
  auth_user_id: string | null;
  workspace_id: string | null;
};

function isServerBoundTemporaryDemoWorkspace(
  workspace: Pick<
    WorkspaceBackfillRow,
    "billing_status" | "test_access_flags"
  >,
): boolean {
  return (
    workspace.billing_status === "demo_free" &&
    workspace.test_access_flags?.[TEMPORARY_DEMO_ACCESS_FLAG] === true
  );
}

function deterministicServerUuid(scope: string): string {
  const digest = createHash("sha256")
    .update(`fanmind:${scope}`)
    .digest("hex");
  const variant = ((Number.parseInt(digest[16] ?? "0", 16) & 0x3) | 0x8)
    .toString(16);
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `8${digest.slice(13, 16)}`,
    `${variant}${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

function deterministicFixedDemoWorkspaceId(userId: string): string {
  return deterministicServerUuid(`fixed-demo-workspace:${userId}`);
}

function deterministicDemoSeedId(
  workspaceId: string,
  resource: string,
  discriminator: string,
): string {
  return deterministicServerUuid(
    `demo-seed:${JSON.stringify([workspaceId, resource, discriminator])}`,
  );
}

function demoProtectedCanonicalValues(
  userId: string,
  testAccessFlags: Record<string, boolean | string>,
) {
  return {
    billing_status: "demo_free",
    billing_provider: "manual",
    payment_collection_method: "none",
    billing_manual_override: false,
    billing_suspended_at: null,
    billing_suspended_reason: null,
    billing_last_payment_failed_at: null,
    billing_last_payment_at: null,
    billing_retry_count: 0,
    billing_next_retry_at: null,
    billing_grace_until: null,
    billing_admin_note: null,
    billing_contract_started_at: null,
    billing_current_period_end_at: null,
    billing_next_invoice_at: null,
    billing_minimum_term_ends_at: null,
    subscription_cancel_requested_at: null,
    subscription_cancel_requested_by_user_id: null,
    subscription_cancel_at_period_end: false,
    subscription_effective_end_at: null,
    subscription_cancellation_revoked_at: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    last_invoice_id: null,
    last_invoice_status: null,
    last_invoice_amount_due_cents: null,
    last_invoice_amount_paid_cents: null,
    last_invoice_hosted_url: null,
    last_invoice_pdf_url: null,
    test_access_flags: testAccessFlags,
    workspace_access_mode: "active",
    billing_updated_at: new Date().toISOString(),
    billing_updated_by_user_id: userId,
  };
}

function temporaryDemoCanonicalValues(userId: string, expiresAt: Date) {
  const now = Date.now();
  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= now ||
    expiresAt.getTime() > now + TEMPORARY_DEMO_MAX_FUTURE_EXPIRY_MS
  ) {
    throw new Error("temporary_demo_expiry_invalid");
  }
  return {
    name: TEMPORARY_DEMO_WORKSPACE_NAME,
    plan_id: "pilot",
    commercial_option: "pilot_only",
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    commitment_months: 0,
    ...demoProtectedCanonicalValues(userId, {
      [TEMPORARY_DEMO_ACCESS_FLAG]: true,
      [TEMPORARY_PROCESSING_ACCESS_FLAG]: true,
      [TEMPORARY_PROCESSING_ACCESS_EXPIRY_FLAG]: expiresAt.toISOString(),
    }),
  };
}

function getServiceAccessToken(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}
const STARTER_COMMERCIAL_OPTIONS: WorkspaceCommercialOption[] = [
  "starter_paid_setup",
  "starter_no_setup_commitment",
];

async function getAccessToken(
  explicitAccessToken?: string,
): Promise<string | undefined> {
  const normalizedExplicitAccessToken = explicitAccessToken?.trim();
  if (normalizedExplicitAccessToken) return normalizedExplicitAccessToken;
  const cookieStore = await cookies();

  return cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;
}

export function createSupabaseServerClient() {
  return {
    auth: {
      async getUser(): Promise<SupabaseServerUserResponse> {
        return getSupabaseServerUser();
      },
      async signOut(): Promise<void> {
        await signOutSupabaseServerSession();
      },
    },
  };
}


export async function updateSupabaseServerUserMetadata(metadata: Record<string, unknown>): Promise<SupabaseServerUserResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { data: { user: null }, error: new Error("Keine gültige Supabase-Sitzung gefunden.") };
  }

  try {
    const response = await fetch(getSupabaseAuthUrl("/user"), {
      method: "PUT",
      headers: getSupabaseHeaders(accessToken),
      body: JSON.stringify({ data: metadata }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        data: { user: null },
        error: await parseSupabaseServerError(response),
      };
    }

    const payload = (await response.json()) as SupabaseServerUser;

    return { data: { user: payload }, error: null };
  } catch (error) {
    return {
      data: { user: null },
      error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}

export async function getSupabaseServerUser(
  accessTokenOverride?: string,
): Promise<SupabaseServerUserResponse> {
  const accessToken = accessTokenOverride ?? (await getAccessToken());

  if (!accessToken) {
    return { data: { user: null }, error: null };
  }

  try {
    const response = await fetch(getSupabaseAuthUrl("/user"), {
      headers: getSupabaseHeaders(accessToken),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        data: { user: null },
        error: await parseSupabaseServerError(response),
      };
    }

    const user = (await response.json()) as SupabaseServerUser;

    return { data: { user }, error: null };
  } catch (error) {
    return {
      data: { user: null },
      error:
        error instanceof Error
          ? error
          : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}

export async function signOutSupabaseServerSession(): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    try {
      await fetch(getSupabaseAuthUrl("/logout"), {
        method: "POST",
        headers: getSupabaseHeaders(accessToken),
      });
    } catch {
      // Logout darf auch dann Cookies entfernen, wenn Supabase-ENV lokal fehlt oder die Session abgelaufen ist.
    }
  }

  cookieStore.delete(SUPABASE_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(SUPABASE_REFRESH_TOKEN_COOKIE);
}


export type PersonalProfileUpdateInput = {
  displayName: string | null;
  phone: string | null;
  roleAudience: string | null;
};

export type WorkspaceMasterDataUpdateInput = {
  workspaceName: string;
  organizationName: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
};

export type TaxMasterDataUpdateInput = {
  vatId: string | null;
  taxNumber: string | null;
  companyRegisterNumber: string | null;
  companyRegisterCourt: string | null;
};

async function getAuthorizedWorkspaceSettingsAccess(
  user: SupabaseServerUser,
  workspaceId: string,
  ownerOnly = false,
): Promise<{ accessToken: string | null; error: Error | null }> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { accessToken: null, error: new Error("Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.") };
  }

  const membership = await postgrestSelect<WorkspaceMemberRow>(
    "workspace_members",
    accessToken,
    "id,workspace_id,role",
    [["workspace_id", workspaceId], ["user_id", user.id]],
    1,
    true,
  );

  if (membership.error) return { accessToken: null, error: new Error(`Workspace-Berechtigung konnte nicht geprüft werden: ${membership.error.message}`) };
  const role = membership.data?.role?.toLowerCase();
  const authorized = ownerOnly
    ? role === "owner"
    : Boolean(role && ["owner", "admin", "manager"].includes(role));
  if (!authorized) {
    return { accessToken: null, error: new Error("Du bist für das Speichern dieser Workspace-Stammdaten nicht berechtigt.") };
  }

  return { accessToken, error: null };
}

export async function updatePersonalProfileSettings(
  user: SupabaseServerUser,
  workspaceId: string,
  input: PersonalProfileUpdateInput,
): Promise<{ error: Error | null }> {
  const { accessToken, error } = await getAuthorizedWorkspaceSettingsAccess(user, workspaceId);
  if (error || !accessToken) return { error };

  const profileResult = await postgrestRequest(
    "profiles",
    "POST",
    {
      id: user.id,
      email: user.email ?? null,
      display_name: input.displayName,
      phone: input.phone,
      role_audience: input.roleAudience,
    },
    accessToken,
    { upsert: true },
  );
  if (profileResult.error) return { error: new Error(`Profil konnte nicht gespeichert werden: ${profileResult.error.message}`) };

  const metadataResult = await updateSupabaseServerUserMetadata({
    ...(user.user_metadata ?? {}),
    display_name: input.displayName,
    phone: input.phone,
    role_audience: input.roleAudience,
  });

  return { error: metadataResult.error };
}

export async function updateWorkspaceMasterDataSettings(
  user: SupabaseServerUser,
  workspaceId: string,
  input: WorkspaceMasterDataUpdateInput,
): Promise<{ error: Error | null }> {
  const { accessToken, error } = await getAuthorizedWorkspaceSettingsAccess(
    user,
    workspaceId,
    true,
  );
  if (error || !accessToken) return { error };

  const workspaceResult = await postgrestUpdate(
    "workspaces",
    {
      name: input.workspaceName,
      organization_name: input.organizationName,
      street_address: input.streetAddress,
      postal_code: input.postalCode,
      city: input.city,
      country: input.country,
    },
    accessToken,
    [["id", workspaceId]],
  );
  if (workspaceResult.error) return { error: new Error(`Workspace-Stammdaten konnten nicht gespeichert werden: ${workspaceResult.error.message}`) };

  const metadataResult = await updateSupabaseServerUserMetadata({
    ...(user.user_metadata ?? {}),
    organization: input.organizationName,
  });

  return { error: metadataResult.error };
}

export async function updateTaxMasterDataSettings(
  user: SupabaseServerUser,
  workspaceId: string,
  input: TaxMasterDataUpdateInput,
): Promise<{ error: Error | null }> {
  const { accessToken, error } = await getAuthorizedWorkspaceSettingsAccess(
    user,
    workspaceId,
    true,
  );
  if (error || !accessToken) return { error };

  const workspaceResult = await postgrestUpdate(
    "workspaces",
    {
      vat_id: input.vatId,
      tax_number: input.taxNumber,
      company_register_number: input.companyRegisterNumber,
      company_register_court: input.companyRegisterCourt,
    },
    accessToken,
    [["id", workspaceId]],
  );

  return workspaceResult.error
    ? { error: new Error(`Steuerdaten konnten nicht gespeichert werden: ${workspaceResult.error.message}`) }
    : { error: null };
}

export async function getUserWorkspaceDashboard(
  user: SupabaseServerUser,
  accessTokenOverride?: string,
): Promise<WorkspaceDashboardResult> {
  const accessToken = accessTokenOverride ?? (await getAccessToken());

  if (!accessToken) {
    return workspaceDashboardError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  if (user.email?.trim().toLowerCase() === DEMO_EMAIL) {
    const fixedDemo = await ensureFixedSandraDemoWorkspace(user);
    if (fixedDemo.error || !fixedDemo.workspace) {
      return workspaceDashboardError(
        "Der feste Demo-Workspace konnte nicht sicher geladen werden.",
      );
    }
    return {
      workspace: { ...fixedDemo.workspace, role: "owner" },
      error: null,
    };
  }

  const ownerWorkspaceResult = await postgrestSelect<WorkspaceBackfillRow>(
    "workspaces",
    accessToken,
    WORKSPACE_COLUMNS,
    [["owner_user_id", user.id]],
    1,
    true,
  );

  if (ownerWorkspaceResult.error) {
    return workspaceDashboardError(
      "Workspace konnte nicht geladen werden.",
    );
  }

  if (ownerWorkspaceResult.data) {
    let workspaceRow = ownerWorkspaceResult.data;
    if (
      isServerBoundTemporaryDemoWorkspace(workspaceRow) ||
      isTemporaryDemoUser(user)
    ) {
      const normalizedDemo = await normalizeTemporaryDemoWorkspace(
        user,
        workspaceRow,
      );
      if (
        normalizedDemo.error?.message === TEMPORARY_DEMO_EXPIRED_ERROR
      ) {
        const deleted = await deleteExpiredTemporaryDemo(
          user,
          { ...workspaceRow, role: "owner" },
          {
            authUserId: user.id,
            workspaceId: workspaceRow.id,
          },
        );
        if (deleted.error) {
          console.error("Temporary demo cleanup failed", {
            code: deleted.errorCode ?? "temporary_demo_cleanup_failed",
          });
        }
        return workspaceDashboardError("TEMPORARY_DEMO_DELETED");
      }
      if (normalizedDemo.error || !normalizedDemo.workspace) {
        return workspaceDashboardError(
          "Temporärer Demo-Workspace konnte nicht sicher geladen werden.",
        );
      }
      workspaceRow = normalizedDemo.workspace;
    }

    const workspace = { ...workspaceRow, role: "owner" };
    return { workspace, error: null };
  }

  return workspaceDashboardError(
    "Workspace konnte noch nicht geladen werden. Bitte schließe das Onboarding ab.",
  );
}

export async function getUserWorkspaceMembershipDashboard(
  user: SupabaseServerUser,
  accessTokenOverride?: string,
): Promise<WorkspaceDashboardResult> {
  const accessToken = accessTokenOverride ?? (await getAccessToken());

  if (!accessToken) {
    return workspaceDashboardError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const membershipResult = await postgrestSelect<WorkspaceMemberRow[]>(
    "workspace_members",
    accessToken,
    "id,workspace_id,role",
    [["user_id", user.id]],
    2,
    false,
    "id.asc",
  );

  if (membershipResult.error) {
    return workspaceDashboardError(
      "Workspace-Mitgliedschaft konnte nicht geprüft werden.",
    );
  }
  if (!membershipResult.data?.length) {
    return workspaceDashboardError(
      "Keine Workspace-Mitgliedschaft gefunden.",
    );
  }
  if (membershipResult.data.length !== 1) {
    return workspaceDashboardError(
      "Mehrere Workspace-Mitgliedschaften müssen zuerst eindeutig ausgewählt werden.",
    );
  }
  const [membership] = membershipResult.data;

  const workspaceResult =
    await postgrestRequest<WorkspaceMemberSafeDashboardRow>(
      `rpc/${WORKSPACE_MEMBER_SAFE_DASHBOARD_RPC}`,
      "POST",
      {},
      accessToken,
      {
        select:
          "workspace_id,workspace_name,plan_id,membership_role,member_processing_allowed",
        single: true,
      },
    );

  let safeWorkspace = workspaceResult.data;
  if (
    workspaceResult.error &&
    !isMissingWorkspaceMemberSafeDashboardRpc(workspaceResult.error)
  ) {
    return workspaceDashboardError(
      "Sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
    );
  }
  if (
    workspaceResult.error &&
    isMissingWorkspaceMemberSafeDashboardRpc(workspaceResult.error)
  ) {
    const serviceAccessToken = getServiceAccessToken();
    if (!serviceAccessToken) {
      return workspaceDashboardError(
        "Sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
      );
    }
    const compatibilityResult =
      await postgrestSelect<WorkspaceMemberCompatibilityProcessingRow>(
        "workspaces",
        serviceAccessToken,
        "id,name,plan_id,billing_status,billing_suspended_at,billing_manual_override,billing_grace_until,subscription_effective_end_at,workspace_access_mode,test_access_flags",
        [["id", membership.workspace_id]],
        1,
        true,
      );
    if (
      compatibilityResult.error ||
      !compatibilityResult.data ||
      compatibilityResult.data.id !== membership.workspace_id ||
      !isPlanId(compatibilityResult.data.plan_id)
    ) {
      return workspaceDashboardError(
        "Sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
      );
    }
    safeWorkspace = {
      workspace_id: compatibilityResult.data.id,
      workspace_name: compatibilityResult.data.name,
      plan_id: compatibilityResult.data.plan_id,
      membership_role: "member",
      member_processing_allowed:
        evaluateWorkspaceProcessingEntitlement(compatibilityResult.data)
          .allowed,
    };
  }
  if (
    !safeWorkspace ||
    safeWorkspace.workspace_id !== membership.workspace_id ||
    membership.role.trim().toLowerCase() === "owner" ||
    safeWorkspace.membership_role !== "member" ||
    !isPlanId(safeWorkspace.plan_id) ||
    typeof safeWorkspace.member_processing_allowed !== "boolean"
  ) {
    return workspaceDashboardError(
      "Sichere Workspace-Mitgliederansicht ist noch nicht verifiziert.",
    );
  }

  return {
    workspace: memberSafeProjectionCompatibilityEnvelope(safeWorkspace),
    error: null,
  };
}

export async function getWorkspaceSocialConnections(
  workspaceId: string,
): Promise<SocialConnectionsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return socialConnectionsError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const result = await postgrestSelect<SocialConnectionRow[]>(
    "social_connections",
    accessToken,
    SOCIAL_CONNECTION_PUBLIC_COLUMNS,
    [["workspace_id", workspaceId]],
    undefined,
    false,
    "updated_at.desc",
  );

  if (result.error) {
    return socialConnectionsError(
      `Social Connections konnten nicht geladen werden: ${result.error.message}`,
    );
  }

  return { connections: result.data ?? [], error: null };
}

export async function getWorkspaceSocialConnectionsServer(
  workspaceId: string,
): Promise<SocialConnectionsResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return socialConnectionsError(
      "Serverberechtigungen für externe Kanalverbindungen fehlen.",
    );
  }

  const result = await postgrestSelect<SocialConnectionRow[]>(
    "social_connections",
    serviceAccessToken,
    SOCIAL_CONNECTION_SECRET_COLUMNS,
    [["workspace_id", workspaceId]],
    undefined,
    false,
    "updated_at.desc",
  );

  if (result.error) {
    return socialConnectionsError(
      "Externe Kanalverbindungen konnten serverseitig nicht geladen werden.",
    );
  }

  return { connections: result.data ?? [], error: null };
}

export async function enqueueMetaConversationCatchup(input: {
  workspaceId: string;
  socialConnectionId: string;
  platform: "facebook" | "instagram";
  fanSenderId: string;
  contactId?: string | null;
}): Promise<MetaConversationCatchupJobResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      job: null,
      error: new Error("Serverberechtigungen für die Meta-Nachholqueue fehlen."),
    };
  }

  const result = await postgrestRequest<MetaConversationCatchupJobRow>(
    "rpc/enqueue_meta_conversation_catchup",
    "POST",
    {
      p_workspace_id: input.workspaceId,
      p_social_connection_id: input.socialConnectionId,
      p_platform: input.platform,
      p_fan_sender_id: input.fanSenderId,
      p_contact_id: input.contactId ?? null,
    },
    serviceAccessToken,
    { select: META_CONVERSATION_CATCHUP_JOB_COLUMNS, single: true },
  );

  return {
    job: result.data,
    error: result.error
      ? new Error("Meta-Nachholauftrag konnte nicht gespeichert werden.")
      : null,
  };
}

export async function getClaimedMetaConversationCatchupJob(input: {
  jobId: string;
  workerId: string;
  leaseToken: string;
}): Promise<MetaConversationCatchupJobResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      job: null,
      error: new Error("Serverberechtigungen für die Meta-Nachholqueue fehlen."),
    };
  }

  const result = await postgrestSelect<MetaConversationCatchupJobRow>(
    "meta_conversation_catchup_jobs",
    serviceAccessToken,
    META_CONVERSATION_CATCHUP_JOB_COLUMNS,
    [
      ["id", input.jobId],
      ["worker_id", input.workerId],
      ["lease_token", input.leaseToken],
      ["status", "claimed"],
    ],
    1,
    true,
  );
  if (result.error) {
    return {
      job: null,
      error: new Error("Meta-Nachholauftrag konnte nicht geladen werden."),
    };
  }

  const leaseUntil = Date.parse(result.data?.lease_until ?? "");
  if (!result.data || !Number.isFinite(leaseUntil) || leaseUntil < Date.now()) {
    return { job: null, error: null };
  }
  return { job: result.data, error: null };
}

export async function getMetaMessengerSyncContinuation(
  connectionId: string,
  platform: "facebook" | "instagram",
): Promise<MetaMessengerSyncContinuationResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      schemaReady: false,
      continuationAfter: null,
      continuationStartedAt: null,
      error: new Error(
        "Serverberechtigungen für den Nachrichten-Sync fehlen.",
      ),
    };
  }

  const result = await postgrestSelect<MetaMessengerSyncContinuationRow>(
    "social_connections",
    serviceAccessToken,
    META_MESSENGER_SYNC_CONTINUATION_COLUMNS,
    [
      ["id", connectionId],
      ["platform", platform],
      ["status", "connected"],
    ],
    1,
    true,
  );

  if (result.error) {
    if (isMissingMetaMessengerSyncContinuationSchema(result.error)) {
      return {
        schemaReady: false,
        continuationAfter: null,
        continuationStartedAt: null,
        error: null,
      };
    }
    return {
      schemaReady: false,
      continuationAfter: null,
      continuationStartedAt: null,
      error: new Error(
        "Meta-Sync-Fortsetzung konnte nicht sicher geladen werden.",
      ),
    };
  }

  if (!result.data) {
    return {
      schemaReady: true,
      continuationAfter: null,
      continuationStartedAt: null,
      error: new Error("Aktive Meta-Verbindung wurde nicht gefunden."),
    };
  }

  return {
    schemaReady: true,
    continuationAfter: result.data.messenger_sync_continuation_after,
    continuationStartedAt:
      result.data.messenger_sync_continuation_started_at,
    error: null,
  };
}

export async function getWorkspaceAnalysisCapabilityStatus(
  workspaceId: string,
  capability: WorkspaceAnalysisCapability,
): Promise<{
  enabled: boolean;
  legacySchema: boolean;
  error: Error | null;
}> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      enabled: false,
      legacySchema: false,
      error: new Error("Serverberechtigungen für Analysefreigaben fehlen."),
    };
  }

  const result = await postgrestSelect<WorkspaceAnalysisSettingsRow>(
    "workspace_analysis_settings",
    serviceAccessToken,
    WORKSPACE_ANALYSIS_SETTINGS_COLUMNS,
    [["workspace_id", workspaceId]],
    1,
    true,
  );

  if (result.error) {
    if (isMissingWorkspaceAnalysisSettingsSchema(result.error)) {
      return {
        enabled: false,
        legacySchema: true,
        error: null,
      };
    }
    return { enabled: false, legacySchema: false, error: result.error };
  }

  const settings = result.data;
  if (!settings) return { enabled: false, legacySchema: false, error: null };

  const legalGateConfirmed =
    settings.meta_sync_mode === "incremental_cache" &&
    settings.personal_content_retention_days === 0 &&
    settings.legal_basis_status === "confirmed" &&
    settings.transparency_status === "confirmed" &&
    settings.data_processing_agreement_status === "confirmed" &&
    settings.retention_status === "confirmed" &&
    settings.data_subject_rights_status === "confirmed" &&
    Boolean(settings.confirmed_by) &&
    Boolean(settings.confirmed_at);
  const enabledByCapability = {
    fan_analysis: settings.fan_analysis_enabled,
    conversation_analysis: settings.conversation_analysis_enabled,
    user_voice_analysis: settings.user_voice_analysis_enabled,
    content_insights: settings.content_insights_enabled,
  } satisfies Record<WorkspaceAnalysisCapability, boolean>;

  return {
    enabled: legalGateConfirmed && enabledByCapability[capability],
    legacySchema: false,
    error: null,
  };
}

function isMissingWorkspaceAnalysisSettingsSchema(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("workspace_analysis_settings") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find the table"))
  );
}

export async function upsertFacebookSocialConnection(
  input: UpsertMetaSocialConnectionInput,
): Promise<SocialConnectionResult> {
  return upsertMetaSocialConnection("facebook", input);
}

export async function upsertInstagramSocialConnection(
  input: UpsertMetaSocialConnectionInput,
): Promise<SocialConnectionResult> {
  return upsertMetaSocialConnection("instagram", input);
}

async function upsertMetaSocialConnection(
  platform: "facebook" | "instagram",
  input: UpsertMetaSocialConnectionInput,
): Promise<SocialConnectionResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return socialConnectionError(
      `Serverberechtigungen für die ${platform === "facebook" ? "Facebook" : "Instagram"}-Verbindung fehlen.`,
    );
  }

  const externalAccountId =
    normalizeOptionalText(input.externalAccountId) ?? input.pageId;
  const activeWorkspaceConnections = await postgrestSelect<
    SocialConnectionRow[]
  >(
    "social_connections",
    serviceAccessToken,
    SOCIAL_CONNECTION_SECRET_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["platform", platform],
      ["status", "connected"],
    ],
    2,
  );
  if (activeWorkspaceConnections.error) {
    return socialConnectionError(
      `Aktive ${platform === "facebook" ? "Facebook" : "Instagram"}-Verbindungen konnten nicht geprüft werden: ${activeWorkspaceConnections.error.message}`,
    );
  }
  if (
    (activeWorkspaceConnections.data ?? []).some(
      (connection) => connection.page_id !== input.pageId,
    )
  ) {
    return socialConnectionError(
      `Dieser Workspace besitzt bereits eine andere aktive ${platform === "facebook" ? "Facebook" : "Instagram"}-Verbindung. Trenne sie vor einer neuen Kontowahl.`,
    );
  }

  const activeExternalBindings = await postgrestSelect<SocialConnectionRow[]>(
    "social_connections",
    serviceAccessToken,
    SOCIAL_CONNECTION_SECRET_COLUMNS,
    [
      ["platform", platform],
      ["external_account_id", externalAccountId],
      ["status", "connected"],
    ],
    2,
  );
  if (activeExternalBindings.error) {
    return socialConnectionError(
      `Die ${platform === "facebook" ? "Facebook" : "Instagram"}-Kontobindung konnte nicht geprüft werden: ${activeExternalBindings.error.message}`,
    );
  }
  if (
    (activeExternalBindings.data ?? []).some(
      (connection) => connection.workspace_id !== input.workspaceId,
    )
  ) {
    return socialConnectionError(
      `Dieses ${platform === "facebook" ? "Facebook" : "Instagram"}-Konto ist bereits mit einem anderen FanMind-Workspace verbunden.`,
    );
  }

  const existingResult = await postgrestSelect<SocialConnectionRow>(
    "social_connections",
    serviceAccessToken,
    SOCIAL_CONNECTION_SECRET_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["platform", platform],
      ["page_id", input.pageId],
    ],
    1,
    true,
  );

  if (existingResult.error) {
    return socialConnectionError(
      `${platform === "facebook" ? "Facebook" : "Instagram"}-Verbindung konnte nicht geprüft werden: ${existingResult.error.message}`,
    );
  }

  const values = {
    workspace_id: input.workspaceId,
    platform,
    provider: "meta",
    status: "connected",
    external_account_id: externalAccountId,
    external_account_name:
      normalizeOptionalText(input.externalAccountName) ?? input.pageName,
    page_id: input.pageId,
    page_name: input.pageName,
    page_access_token_encrypted: normalizeOptionalText(
      input.pageAccessTokenEncrypted,
    ),
    token_last_four: normalizeOptionalText(input.tokenLastFour),
    scopes: [
      ...new Set([
        ...(existingResult.data?.scopes ?? []),
        ...(input.scopes ?? []),
      ]),
    ].sort(),
    webhook_subscribed: Boolean(
      existingResult.data?.webhook_subscribed || input.webhookSubscribed,
    ),
    oauth_login_type: normalizeOptionalText(input.oauthLoginType),
    external_account_type: normalizeOptionalText(input.externalAccountType),
    token_expires_at: normalizeIsoTimestamp(input.tokenExpiresAt),
    permissions_verified_at: normalizeIsoTimestamp(
      input.permissionsVerifiedAt,
    ),
    analytics_enabled: false,
    connected_by: input.connectedBy,
    connected_at: new Date().toISOString(),
    disconnected_at: null,
  };

  const result = existingResult.data
    ? await postgrestUpdate<SocialConnectionRow>(
        "social_connections",
        values,
        serviceAccessToken,
        [["id", existingResult.data.id]],
        { select: SOCIAL_CONNECTION_SECRET_COLUMNS, single: true },
      )
    : await postgrestRequest<SocialConnectionRow>(
        "social_connections",
        "POST",
        values,
        serviceAccessToken,
        { select: SOCIAL_CONNECTION_SECRET_COLUMNS, single: true },
      );

  if (result.error)
    return socialConnectionError(
      `${platform === "facebook" ? "Facebook" : "Instagram"}-Verbindung konnte nicht gespeichert werden: ${result.error.message}`,
    );
  return { connection: result.data, error: null };
}

export async function updateFacebookWebhookSubscribed(
  connectionId: string,
  webhookSubscribed: boolean,
): Promise<SocialConnectionResult> {
  return updateMetaWebhookSubscribed(
    "facebook",
    connectionId,
    webhookSubscribed,
  );
}

export async function updateInstagramWebhookSubscribed(
  connectionId: string,
  webhookSubscribed: boolean,
): Promise<SocialConnectionResult> {
  return updateMetaWebhookSubscribed(
    "instagram",
    connectionId,
    webhookSubscribed,
  );
}

async function updateMetaWebhookSubscribed(
  platform: "facebook" | "instagram",
  connectionId: string,
  webhookSubscribed: boolean,
): Promise<SocialConnectionResult> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return socialConnectionError("Serverberechtigungen für den Webhook-Status fehlen.");

  const result = await postgrestUpdate<SocialConnectionRow>(
    "social_connections",
    { webhook_subscribed: webhookSubscribed },
    accessToken,
    [
      ["id", connectionId],
      ["platform", platform],
    ],
    { select: SOCIAL_CONNECTION_SECRET_COLUMNS, single: true },
  );

  if (result.error)
    return socialConnectionError(
      `${platform === "facebook" ? "Facebook" : "Instagram"}-Webhook-Status konnte nicht gespeichert werden: ${result.error.message}`,
    );
  return { connection: result.data, error: null };
}
export async function updateFacebookCommentFetchStatus(
  connectionId: string,
  input: { fetchedAt: string; importedCount: number; error?: string | null },
): Promise<SocialConnectionResult> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return socialConnectionError("Serverberechtigungen für den Kommentarabruf fehlen.");

  const result = await postgrestUpdate<SocialConnectionRow>(
    "social_connections",
    {
      last_comment_fetch_at: input.fetchedAt,
      last_comment_fetch_count: input.importedCount,
      last_comment_fetch_error: normalizeOptionalText(input.error),
    },
    accessToken,
    [
      ["id", connectionId],
      ["platform", "facebook"],
    ],
    { select: SOCIAL_CONNECTION_SECRET_COLUMNS, single: true },
  );

  if (result.error)
    return socialConnectionError(
      `Facebook-Kommentarabruf konnte nicht aktualisiert werden: ${result.error.message}`,
    );
  return { connection: result.data, error: null };
}

export async function updateFacebookMessengerSyncStatus(
  connectionId: string,
  input: MetaMessengerSyncStatusInput,
): Promise<SocialConnectionResult> {
  return updateMetaMessengerSyncStatus("facebook", connectionId, input);
}

export async function updateInstagramMessengerSyncStatus(
  connectionId: string,
  input: MetaMessengerSyncStatusInput,
): Promise<SocialConnectionResult> {
  return updateMetaMessengerSyncStatus("instagram", connectionId, input);
}

type MetaMessengerSyncCursorUpdate =
  | { kind: "preserve" }
  | {
      kind: "partial";
      continuationAfter: string;
      continuationStartedAt: string;
    }
  | { kind: "complete"; completedSyncAt: string };

type MetaMessengerSyncStatusInput = {
  syncedAt: string;
  checkedConversations: number;
  importedInbound: number;
  importedOutbound: number;
  importedMedia?: number;
  skippedDuplicates: number;
  error?: string | null;
  lastOutboundAt?: string | null;
  cursorUpdate?: MetaMessengerSyncCursorUpdate;
};

async function updateMetaMessengerSyncStatus(
  platform: "facebook" | "instagram",
  connectionId: string,
  input: MetaMessengerSyncStatusInput,
): Promise<SocialConnectionResult> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return socialConnectionError(
      "Serverberechtigungen für den Nachrichten-Sync fehlen.",
    );

  const values: Record<string, unknown> = {
    last_messenger_sync_checked_count: input.checkedConversations,
    last_messenger_sync_imported_inbound_count: input.importedInbound,
    last_messenger_sync_imported_outbound_count: input.importedOutbound,
    last_messenger_sync_imported_media_count: input.importedMedia ?? 0,
    last_messenger_sync_skipped_count: input.skippedDuplicates,
    last_messenger_sync_error: normalizeOptionalText(input.error),
  };
  if (input.lastOutboundAt !== undefined) {
    values.last_messenger_sync_outbound_at = normalizeIsoTimestamp(
      input.lastOutboundAt,
    );
  }

  if (!input.cursorUpdate) {
    values.last_messenger_sync_at = input.syncedAt;
  } else if (input.cursorUpdate.kind === "partial") {
    values.messenger_sync_continuation_after =
      input.cursorUpdate.continuationAfter;
    values.messenger_sync_continuation_started_at =
      input.cursorUpdate.continuationStartedAt;
  } else if (input.cursorUpdate.kind === "complete") {
    values.last_messenger_sync_at = input.cursorUpdate.completedSyncAt;
    values.messenger_sync_continuation_after = null;
    values.messenger_sync_continuation_started_at = null;
  }

  const result = await postgrestUpdate<SocialConnectionRow>(
    "social_connections",
    values,
    accessToken,
    [
      ["id", connectionId],
      ["platform", platform],
    ],
    { select: SOCIAL_CONNECTION_SECRET_COLUMNS, single: true },
  );

  if (result.error)
    return socialConnectionError(
      `${platform === "facebook" ? "Facebook-Messenger" : "Instagram-DM"}-Sync konnte nicht aktualisiert werden: ${result.error.message}`,
    );
  return { connection: result.data, error: null };
}

export async function disconnectFacebookSocialConnection(
  workspaceId: string,
): Promise<SocialConnectionResult> {
  return disconnectMetaSocialConnection(workspaceId, "facebook");
}

export async function disconnectInstagramSocialConnection(
  workspaceId: string,
): Promise<SocialConnectionResult> {
  return disconnectMetaSocialConnection(workspaceId, "instagram");
}

async function disconnectMetaSocialConnection(
  workspaceId: string,
  platform: "facebook" | "instagram",
): Promise<SocialConnectionResult> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return socialConnectionError("Serverberechtigungen für das Trennen fehlen.");

  const result = await postgrestUpdate<SocialConnectionRow>(
    "social_connections",
    {
      status: "disconnected",
      disconnected_at: new Date().toISOString(),
      page_access_token_encrypted: null,
      token_last_four: null,
      webhook_subscribed: false,
      analytics_enabled: false,
    },
    accessToken,
    [
      ["workspace_id", workspaceId],
      ["platform", platform],
      ["status", "connected"],
    ],
    { select: SOCIAL_CONNECTION_SECRET_COLUMNS, single: true },
  );

  if (result.error)
    return socialConnectionError(
      `${platform === "facebook" ? "Facebook" : "Instagram"}-Verbindung konnte nicht getrennt werden: ${result.error.message}`,
    );
  return { connection: result.data, error: null };
}

export async function getWorkspaceProcessingEntitlement(
  workspaceId: string,
): Promise<WorkspaceProcessingEntitlementResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      allowed: false,
      reason: "processing_configuration_unavailable",
      error: new Error(
        "Serverberechtigungen für die Workspace-Verarbeitung fehlen.",
      ),
    };
  }

  const workspaceResult = await postgrestSelect<WorkspaceProcessingRow>(
    "workspaces",
    serviceAccessToken,
    WORKSPACE_PROCESSING_COLUMNS,
    [["id", workspaceId]],
    1,
    true,
  );
  if (workspaceResult.error) {
    return {
      allowed: false,
      reason: "processing_lookup_failed",
      error: new Error("Workspace-Verarbeitung konnte nicht geprüft werden."),
    };
  }

  const decision = evaluateWorkspaceProcessingEntitlement(
    workspaceResult.data,
  );
  return { ...decision, error: null };
}

export async function findMetaSocialConnectionByPageId(
  platform: "facebook" | "instagram",
  pageId: string,
): Promise<SocialConnectionResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return socialConnectionError(
      "SUPABASE_SERVICE_ROLE_KEY ist für Webhook-Zuordnung nicht konfiguriert.",
    );
  }

  const result = await postgrestSelect<SocialConnectionRow>(
    "social_connections",
    serviceAccessToken,
    SOCIAL_CONNECTION_SECRET_COLUMNS,
    [
      ["platform", platform],
      ["status", "connected"],
      ["page_id", pageId],
    ],
    1,
    true,
  );
  if (result.error) return socialConnectionError(result.error.message);
  if (!result.data) return { connection: null, error: null };

  const entitlement = await getWorkspaceProcessingEntitlement(
    result.data.workspace_id,
  );
  if (entitlement.error) {
    return socialConnectionError(
      "Workspace-Verarbeitung konnte nicht geprüft werden.",
    );
  }
  if (!entitlement.allowed) {
    return { connection: null, error: null, processingBlocked: true };
  }

  return { connection: result.data, error: null };
}

export async function findWhatsAppCloudConnectionByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsAppCloudConnectionLookupResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return whatsappCloudConnectionLookupError("lookup_failed");
  }

  const schemaState = await postgrestRequest<WhatsAppCloudSchemaStateRow>(
    "rpc/whatsapp_cloud_inbound_schema_state",
    "POST",
    {},
    serviceAccessToken,
    { select: "ready", single: true },
  );
  if (schemaState.error || schemaState.data?.ready !== true) {
    return whatsappCloudConnectionLookupError("schema_not_ready");
  }

  const result = await postgrestSelect<SocialConnectionRow[]>(
    "social_connections",
    serviceAccessToken,
    SOCIAL_CONNECTION_PUBLIC_COLUMNS,
    [
      ["platform", "whatsapp"],
      ["provider", "meta_whatsapp_cloud"],
      ["status", "connected"],
      ["webhook_subscribed", true],
      ["page_id", phoneNumberId],
    ],
    2,
  );
  if (result.error) return whatsappCloudConnectionLookupError("lookup_failed");

  const matches = result.data ?? [];
  if (matches.length === 0) {
    return {
      connection: null,
      error: null,
      processingBlocked: false,
      schemaReady: true,
      lookupStatus: "unmapped",
    };
  }
  if (matches.length !== 1) {
    return whatsappCloudConnectionLookupError("ambiguous", true);
  }

  const entitlement = await getWorkspaceProcessingEntitlement(
    matches[0].workspace_id,
  );
  if (entitlement.error) {
    return whatsappCloudConnectionLookupError("lookup_failed", true);
  }
  if (!entitlement.allowed) {
    return {
      connection: matches[0],
      error: null,
      processingBlocked: true,
      schemaReady: true,
      lookupStatus: "processing_blocked",
    };
  }

  return {
    connection: matches[0],
    error: null,
    processingBlocked: false,
    schemaReady: true,
    lookupStatus: "matched",
  };
}

export async function claimWhatsAppCloudInboundMessage(input: {
  workspaceId: string;
  socialConnectionId: string;
  phoneNumberId: string;
  externalMessageId: string;
  payloadFingerprint: string;
}): Promise<WhatsAppCloudReceiptClaimResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) return whatsappCloudReceiptClaimError();

  const result = await postgrestRequest<WhatsAppCloudReceiptClaimRow>(
    "rpc/claim_whatsapp_cloud_inbound_message",
    "POST",
    {
      p_workspace_id: input.workspaceId,
      p_social_connection_id: input.socialConnectionId,
      p_phone_number_id: input.phoneNumberId,
      p_external_message_id: input.externalMessageId,
      p_payload_fingerprint: input.payloadFingerprint,
      p_lease_seconds: 120,
    },
    serviceAccessToken,
    { select: "receipt_id,lease_token,outcome", single: true },
  );
  const allowedOutcomes = new Set([
    "claimed",
    "duplicate",
    "in_progress",
    "exhausted",
    "cancelled",
    "conflict",
  ]);
  if (
    result.error ||
    !result.data?.receipt_id ||
    !allowedOutcomes.has(result.data.outcome) ||
    (result.data.outcome === "claimed" && !result.data.lease_token) ||
    (result.data.outcome !== "claimed" && result.data.lease_token !== null)
  ) {
    return whatsappCloudReceiptClaimError();
  }

  return {
    receiptId: result.data.receipt_id,
    leaseToken: result.data.lease_token,
    outcome: result.data.outcome as Exclude<
      WhatsAppCloudReceiptClaimResult["outcome"],
      "claim_failed"
    >,
    error: null,
  };
}

export async function storeWhatsAppCloudInboundMessage(input: {
  workspaceId: string;
  socialConnectionId: string;
  receiptId: string;
  leaseToken: string;
  phoneNumberId: string;
  senderId: string;
  externalMessageId: string;
  externalThreadId: string;
  authorLabel: string;
  content: string;
  receivedAt: string;
  payloadFingerprint: string;
}): Promise<WhatsAppCloudStoreResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      conversationMessageId: null,
      outcome: "store_failed",
      error: new Error("WhatsApp Cloud atomic store unavailable."),
    };
  }
  const result = await postgrestRequest<WhatsAppCloudStoreRow>(
    "rpc/store_whatsapp_cloud_inbound_message",
    "POST",
    {
      p_workspace_id: input.workspaceId,
      p_social_connection_id: input.socialConnectionId,
      p_receipt_id: input.receiptId,
      p_lease_token: input.leaseToken,
      p_phone_number_id: input.phoneNumberId,
      p_sender_id: input.senderId,
      p_external_message_id: input.externalMessageId,
      p_external_thread_id: input.externalThreadId,
      p_author_label: input.authorLabel,
      p_content: input.content,
      p_received_at: input.receivedAt,
      p_payload_fingerprint: input.payloadFingerprint,
    },
    serviceAccessToken,
    { select: "conversation_message_id,outcome", single: true },
  );
  const allowedOutcomes = new Set([
    "stored",
    "duplicate",
    "processing_blocked",
    "connection_unavailable",
    "stale_lease",
    "conflict",
  ]);
  if (result.error || !result.data || !allowedOutcomes.has(result.data.outcome)) {
    return {
      conversationMessageId: null,
      outcome: "store_failed",
      error: new Error("WhatsApp Cloud atomic store failed."),
    };
  }
  if (
    (result.data.outcome === "stored" || result.data.outcome === "duplicate") &&
    !result.data.conversation_message_id
  ) {
    return {
      conversationMessageId: null,
      outcome: "store_failed",
      error: new Error("WhatsApp Cloud atomic store result invalid."),
    };
  }
  return {
    conversationMessageId: result.data.conversation_message_id,
    outcome: result.data.outcome as Exclude<
      WhatsAppCloudStoreResult["outcome"],
      "store_failed"
    >,
    error: null,
  };
}

export async function disconnectWhatsAppCloudInboundConnection(input: {
  workspaceId: string;
  socialConnectionId: string;
}): Promise<{ disconnected: boolean; error: Error | null }> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      disconnected: false,
      error: new Error("WhatsApp Cloud disconnect unavailable."),
    };
  }
  const result = await postgrestRequest<WhatsAppCloudDisconnectRow>(
    "rpc/disconnect_whatsapp_cloud_inbound_connection",
    "POST",
    {
      p_workspace_id: input.workspaceId,
      p_social_connection_id: input.socialConnectionId,
    },
    serviceAccessToken,
    { select: "disconnected", single: true },
  );
  if (result.error || result.data?.disconnected !== true) {
    return {
      disconnected: false,
      error: new Error("WhatsApp Cloud disconnect failed."),
    };
  }
  return { disconnected: true, error: null };
}

function whatsappCloudConnectionLookupError(
  lookupStatus: Extract<
    WhatsAppCloudConnectionLookupResult["lookupStatus"],
    "schema_not_ready" | "ambiguous" | "lookup_failed"
  >,
  schemaReady = false,
): WhatsAppCloudConnectionLookupResult {
  return {
    connection: null,
    error: new Error("WhatsApp Cloud connection lookup unavailable."),
    processingBlocked: false,
    schemaReady,
    lookupStatus,
  };
}

function whatsappCloudReceiptClaimError(): WhatsAppCloudReceiptClaimResult {
  return {
    receiptId: null,
    leaseToken: null,
    outcome: "claim_failed",
    error: new Error("WhatsApp Cloud receipt claim unavailable."),
  };
}

export async function findTelegramWebhookWorkspaceId(): Promise<{
  workspaceId: string | null;
  error: Error | null;
}> {
  const configuredWorkspaceId = normalizeOptionalText(
    process.env.FANMIND_DEFAULT_WORKSPACE_ID_FOR_TELEGRAM_TEST,
  );
  if (configuredWorkspaceId) {
    const serviceAccessToken = getServiceAccessToken();
    if (!serviceAccessToken) {
      return {
        workspaceId: null,
        error: new Error(
          "SUPABASE_SERVICE_ROLE_KEY ist für Telegram-Webhook-Ingestion nicht konfiguriert.",
        ),
      };
    }

    const workspaceResult = await postgrestSelect<WorkspaceBackfillRow>(
      "workspaces",
      serviceAccessToken,
      WORKSPACE_COLUMNS,
      [["id", configuredWorkspaceId]],
      1,
      true,
    );
    if (workspaceResult.error)
      return { workspaceId: null, error: workspaceResult.error };
    if (!workspaceResult.data) {
      return {
        workspaceId: null,
        error: new Error(
          "Der konfigurierte Telegram-Test-Workspace wurde nicht gefunden. Kein Kontakt und keine Nachricht wurde angelegt.",
        ),
      };
    }

    const processing = evaluateWorkspaceProcessingEntitlement(
      workspaceResult.data,
    );
    if (!processing.allowed) {
      return {
        workspaceId: null,
        error: new Error(
          "Der konfigurierte Telegram-Test-Workspace ist nicht für Verarbeitung freigegeben. Kein Kontakt und keine Nachricht wurde angelegt.",
        ),
      };
    }

    return { workspaceId: configuredWorkspaceId, error: null };
  }

  return {
    workspaceId: null,
    error: new Error(
      "Telegram-Webhook-Ingestion ist ohne FANMIND_DEFAULT_WORKSPACE_ID_FOR_TELEGRAM_TEST deaktiviert. Kein Kontakt und keine Nachricht wurde angelegt.",
    ),
  };
}

export async function getWorkspaceTelegramMessages(
  workspaceId: string,
  limit = 5,
): Promise<{ messages: ConversationMessageRow[]; error: Error | null }> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return {
      messages: [],
      error: new Error(
        "SUPABASE_SERVICE_ROLE_KEY ist serverseitig nicht konfiguriert.",
      ),
    };
  }

  const requestedLimit = Math.floor(limit);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 50))
    : 5;
  const result = await postgrestSelect<ConversationMessageRow[]>(
    "conversation_messages",
    serviceAccessToken,
    CONVERSATION_MESSAGE_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["source_platform", "telegram"],
    ],
    safeLimit,
    false,
    "created_at.desc",
  );

  if (result.error) return { messages: [], error: result.error };
  return { messages: result.data ?? [], error: null };
}

export async function sendManualTelegramMessage(input: {
  workspaceId: string;
  contactId: string;
  text: string;
}): Promise<{
  message: ConversationMessageRow | null;
  error: Error | null;
  errorCode:
    | "telegram_not_configured"
    | "invalid_text"
    | "conversation_lookup_failed"
    | "chat_not_found"
    | "bot_blocked"
    | "provider_unavailable"
    | "provider_rejected"
    | "message_persist_failed"
    | null;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      message: null,
      error: new Error("Telegram ist serverseitig nicht konfiguriert."),
      errorCode: "telegram_not_configured",
    };
  }

  const text = input.text.trim();
  if (!text || text.length > 4096) {
    return {
      message: null,
      error: new Error("Antworttext ist ungültig."),
      errorCode: "invalid_text",
    };
  }

  const conversationResult = await postgrestSelect<ConversationRow>(
    "conversations",
    getServiceAccessToken(),
    CONVERSATION_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
      ["source_platform", "telegram"],
    ],
    1,
    true,
    "updated_at.desc",
  );
  if (conversationResult.error) {
    return {
      message: null,
      error: new Error("Telegram-Konversation konnte nicht geladen werden."),
      errorCode: "conversation_lookup_failed",
    };
  }

  const conversation = conversationResult.data;
  const chatId = normalizeOptionalText(conversation?.external_thread_id);
  if (!conversation || !chatId) {
    return {
      message: null,
      error: new Error("Kein Telegram-Chat für diesen Kontakt gefunden."),
      errorCode: "chat_not_found",
    };
  }

  let telegramResponse: Response;
  try {
    telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(12000),
      },
    );
  } catch {
    return {
      message: null,
      error: new Error("Telegram ist derzeit nicht erreichbar."),
      errorCode: "provider_unavailable",
    };
  }
  const telegramData = (await telegramResponse.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number; date?: number };
  } | null;

  if (!telegramResponse.ok || !telegramData?.ok) {
    const description = telegramData?.description ?? "Telegram API Fehler";
    const lower = description.toLowerCase();
    const errorCode = lower.includes("bot was blocked")
      ? "bot_blocked"
      : lower.includes("chat not found")
        ? "chat_not_found"
        : "provider_rejected";
    return {
      message: null,
      error: new Error("Telegram-Versand wurde vom Anbieter abgelehnt."),
      errorCode,
    };
  }

  const saved = await createMetaTestConversationMessage({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    content: text,
    messageType: "dm",
    sourcePlatform: "telegram",
    sourceType: "telegram_messages",
    externalThreadId: chatId,
    externalMessageId: telegramData.result?.message_id
      ? String(telegramData.result.message_id)
      : undefined,
    receivedAt: telegramData.result?.date
      ? String(telegramData.result.date)
      : new Date().toISOString(),
    direction: "outbound",
    authorLabel: "FanMind Team",
  });

  return {
    message: saved.message,
    error: saved.error
      ? new Error("Telegram-Nachricht konnte nicht dokumentiert werden.")
      : null,
    errorCode: saved.error ? "message_persist_failed" : null,
  };
}

export async function createMetaWebhookDebugEvent(input: {
  workspaceId?: string | null;
  socialConnectionId?: string | null;
  platform?: "facebook" | "instagram" | "whatsapp" | "telegram";
  eventType: "feed" | "feed_comment" | "messages" | "comments" | "unknown";
  pageId?: string | null;
  senderId?: string | null;
  recipientId?: string | null;
  messageText?: string | null;
  rawPayload: unknown;
  status: string;
  errorReason?: string | null;
  messageId?: string | null;
  receivedAt?: string;
}): Promise<MetaWebhookEventCreateResult> {
  const serviceAccessToken = getServiceAccessToken();

  if (!serviceAccessToken) {
    return {
      event: null,
      error: new Error(
        "SUPABASE_SERVICE_ROLE_KEY ist für Meta-Webhook-Inserts nicht konfiguriert.",
      ),
    };
  }

  const normalizedStatus = String(input.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 64);
  const status = /^[a-z][a-z0-9_]{0,63}$/.test(normalizedStatus)
    ? normalizedStatus
    : "processing_failed";
  const errorReason = input.errorReason
    ? normalizeWebhookErrorCode(input.errorReason)
    : null;
  const boundedWhatsAppDiagnostic =
    input.platform === "whatsapp"
      ? normalizeWhatsAppCloudDiagnosticPayload(input.rawPayload)
      : null;
  const minimized =
    boundedWhatsAppDiagnostic ??
    minimizeWebhookDiagnosticPayload(input.rawPayload);
  const rawPayload =
    minimized && typeof minimized === "object" && !Array.isArray(minimized)
      ? minimized
      : { schema_version: 1, provider_shape: minimized };

  const result = await postgrestRequest<MetaWebhookEventRow>(
    "meta_webhook_events",
    "POST",
    {
      workspace_id: input.workspaceId ?? null,
      social_connection_id: input.socialConnectionId ?? null,
      platform: input.platform ?? "facebook",
      source: "meta_webhook",
      event_type: input.eventType,
      page_id: null,
      sender_id: null,
      recipient_id: null,
      text: null,
      message_text: null,
      raw_payload: rawPayload,
      status,
      error_reason: errorReason,
      message_id: null,
      received_at: input.receivedAt ?? new Date().toISOString(),
    },
    serviceAccessToken,
    { select: META_WEBHOOK_EVENT_COLUMNS, single: true },
  );

  if (result.error) {
    console.error("Meta webhook diagnostic insert failed", {
      table: "meta_webhook_events",
      eventType: input.eventType,
      status,
      errorCode: "diagnostic_persist_failed",
    });
    return { event: null, error: result.error };
  }
  return { event: result.data, error: null };
}

export async function checkMetaWebhookStorageHealth(): Promise<{
  serviceRoleConfigured: boolean;
  tableReadable: boolean;
  error: Error | null;
}> {
  const serviceAccessToken = getServiceAccessToken();

  if (!serviceAccessToken) {
    return {
      serviceRoleConfigured: false,
      tableReadable: false,
      error: new Error(
        "SUPABASE_SERVICE_ROLE_KEY ist serverseitig nicht konfiguriert.",
      ),
    };
  }

  const result = await postgrestSelect<MetaWebhookEventRow[]>(
    "meta_webhook_events",
    serviceAccessToken,
    META_WEBHOOK_EVENT_COLUMNS,
    [],
    1,
    false,
    "received_at.desc",
  );

  return {
    serviceRoleConfigured: true,
    tableReadable: !result.error,
    error: result.error,
  };
}

export async function getWorkspaceMetaWebhookEvents(
  workspaceId: string,
  limit = 20,
): Promise<MetaWebhookEventsResult> {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      events: [],
      error: new Error("Keine aktive Supabase-Session gefunden."),
    };

  const result = await postgrestSelect<MetaWebhookEventRow[]>(
    "meta_webhook_events",
    accessToken,
    META_WEBHOOK_EVENT_COLUMNS,
    [["workspace_id", workspaceId]],
    limit,
    false,
    "received_at.desc",
  );

  if (result.error) return { events: [], error: result.error };
  return { events: result.data ?? [], error: null };
}

export async function getContactReplyTarget(
  workspaceId: string,
  contactId: string,
  sourceType: string,
): Promise<ContactReplyTargetResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      target: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  }

  const result = await postgrestSelect<ContactReplyTargetRow>(
    "contact_reply_targets",
    accessToken,
    CONTACT_REPLY_TARGET_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
      ["source_type", sourceType],
    ],
    1,
    true,
  );

  if (result.error) {
    if (isReplyTargetStorageUnavailableError(result.error)) {
      return {
        target: null,
        error: new Error(
          "Der exakte Chat-Link kann derzeit nicht gespeichert werden. Das Facebook-Postfach kann weiterhin geöffnet werden.",
        ),
      };
    }
    return {
      target: null,
      error: new Error(
        "Der gespeicherte Chat-Link konnte gerade nicht geladen werden. Du kannst den Facebook-Chat weiterhin über das Postfach öffnen.",
      ),
    };
  }

  return { target: result.data, error: null };
}

export async function upsertContactReplyTarget(input: {
  workspaceId: string;
  contactId: string;
  sourcePlatform: string;
  sourceType: string;
  label?: string | null;
  url: string;
  quality?: string;
}): Promise<ContactReplyTargetResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      target: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  }

  const result = await postgrestRequest<ContactReplyTargetRow>(
    "contact_reply_targets",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      source_platform: input.sourcePlatform,
      source_type: input.sourceType,
      label: input.label ?? null,
      url: input.url,
      quality: input.quality ?? "manual_exact_thread",
      updated_at: new Date().toISOString(),
    },
    accessToken,
    {
      select: CONTACT_REPLY_TARGET_COLUMNS,
      single: true,
      upsert: true,
      onConflict: "workspace_id,contact_id,source_type",
    },
  );

  if (result.error) {
    if (isReplyTargetStorageUnavailableError(result.error)) {
      return {
        target: null,
        error: new Error(
          "Der exakte Chat-Link kann derzeit nicht gespeichert werden. Das Facebook-Postfach kann weiterhin geöffnet werden.",
        ),
      };
    }
    return {
      target: null,
      error: new Error(
        "Der Chat-Link konnte gerade nicht gespeichert werden. Bitte später erneut versuchen.",
      ),
    };
  }

  return { target: result.data, error: null };
}

export async function upsertAutoFacebookContactReplyTarget(input: {
  workspaceId: string;
  contactId: string;
  url: string;
}): Promise<ContactReplyTargetResult> {
  const serviceAccessToken = getServiceAccessToken();

  if (!serviceAccessToken) {
    return {
      target: null,
      error: new Error(
        "Serverberechtigungen für die Direktlink-Speicherung sind nicht verfügbar.",
      ),
    };
  }

  const existing = await postgrestSelect<ContactReplyTargetRow>(
    "contact_reply_targets",
    serviceAccessToken,
    CONTACT_REPLY_TARGET_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
      ["source_type", "facebook_messages"],
    ],
    1,
    true,
  );

  if (existing.error) {
    if (isReplyTargetStorageUnavailableError(existing.error)) {
      return {
        target: null,
        error: new Error(
          "Der exakte Chat-Link kann derzeit nicht gespeichert werden. Das Facebook-Postfach kann weiterhin geöffnet werden.",
        ),
      };
    }
    return {
      target: null,
      error: new Error(
        "Der automatische Direktlink konnte gerade nicht gespeichert werden.",
      ),
    };
  }

  if (existing.data?.quality === "manual_exact_thread") {
    return { target: existing.data, error: null };
  }

  if (
    existing.data?.quality === "auto_selected_item" &&
    existing.data.url === input.url
  ) {
    return { target: existing.data, error: null };
  }

  const result = await postgrestRequest<ContactReplyTargetRow>(
    "contact_reply_targets",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      source_platform: "facebook",
      source_type: "facebook_messages",
      label: "Automatisch erkannter Facebook-Direktlink",
      url: input.url,
      quality: "auto_selected_item",
      updated_at: new Date().toISOString(),
    },
    serviceAccessToken,
    {
      select: CONTACT_REPLY_TARGET_COLUMNS,
      single: true,
      upsert: true,
      onConflict: "workspace_id,contact_id,source_type",
    },
  );

  if (result.error) {
    if (isReplyTargetStorageUnavailableError(result.error)) {
      return {
        target: null,
        error: new Error(
          "Der exakte Chat-Link kann derzeit nicht gespeichert werden. Das Facebook-Postfach kann weiterhin geöffnet werden.",
        ),
      };
    }
    return {
      target: null,
      error: new Error(
        "Der automatische Direktlink konnte gerade nicht gespeichert werden.",
      ),
    };
  }

  return { target: result.data, error: null };
}

function isReplyTargetStorageUnavailableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    (message.includes("contact_reply_targets") &&
      (message.includes("does not exist") ||
        message.includes("could not find") ||
        message.includes("schema cache"))) ||
    message.includes('relation "contact_reply_targets"')
  );
}

export async function getWorkspaceContacts(
  workspaceId: string,
): Promise<ContactsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return contactsError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const contactsResult = await postgrestSelect<ContactRow[]>(
    "contacts",
    accessToken,
    CONTACT_COLUMNS,
    [["workspace_id", workspaceId]],
    undefined,
    false,
    "created_at.desc",
  );

  if (contactsResult.error) {
    return contactsError(
      `Kontakte konnten nicht geladen werden: ${contactsResult.error.message}`,
    );
  }

  return {
    contacts: (contactsResult.data ?? []).filter(
      (contact) => !isArchivedStatus(contact.status),
    ),
    error: null,
  };
}

function getContactServiceAccessToken(): string | undefined {
  return getServiceAccessToken();
}

function missingContactServiceRoleError(): Error {
  return new Error("Serverberechtigungen für Kontaktpflege fehlen.");
}

function assertContactWorkspaceInput(workspaceId: string): Error | null {
  return workspaceId
    ? null
    : new Error("Kontaktpflege ohne workspace_id ist nicht erlaubt.");
}

async function getWorkspaceContactWithToken(
  workspaceId: string,
  contactId: string,
  accessToken: string,
): Promise<ContactDetailResult> {
  const contactResult = await postgrestSelect<ContactRow>(
    "contacts",
    accessToken,
    CONTACT_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["id", contactId],
    ],
    1,
    true,
  );

  if (contactResult.error) {
    return contactDetailError(
      `Kontakt konnte nicht geladen werden: ${contactResult.error.message}`,
    );
  }

  return { contact: contactResult.data, error: null };
}

export async function getWorkspaceContact(
  workspaceId: string,
  contactId: string,
  accessTokenOverride?: string,
): Promise<ContactDetailResult> {
  const accessToken = accessTokenOverride ?? (await getAccessToken());

  if (!accessToken) {
    return contactDetailError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const contactResult = await postgrestSelect<ContactRow>(
    "contacts",
    accessToken,
    CONTACT_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["id", contactId],
    ],
    1,
    true,
  );

  if (contactResult.error) {
    return contactDetailError(
      `Kontakt konnte nicht geladen werden: ${contactResult.error.message}`,
    );
  }

  return { contact: contactResult.data, error: null };
}

export async function createWorkspaceContact(
  input: CreateContactInput,
): Promise<ContactCreateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return contactCreateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const displayName = input.displayName.trim();

  if (!displayName) {
    return contactCreateError("Name ist erforderlich.");
  }

  const contactResult = await postgrestRequest<ContactRow>(
    "contacts",
    "POST",
    {
      workspace_id: input.workspaceId,
      display_name: displayName,
      handle: normalizeOptionalText(input.handle),
      source_platform: normalizeOptionalText(input.sourcePlatform) ?? "manual",
      language: normalizeOptionalText(input.language) ?? "de",
      status: normalizeOptionalText(input.status) ?? "new",
      tags: input.tags ?? [],
      summary: normalizeOptionalText(input.summary),
    },
    accessToken,
    { select: CONTACT_COLUMNS, single: true },
  );

  if (contactResult.error) {
    return contactCreateError(
      `Kontakt konnte nicht gespeichert werden: ${contactResult.error.message}`,
    );
  }

  return { contact: contactResult.data, error: null };
}

export async function createWorkspaceContactsBatch(
  input: CreateContactBatchInput,
): Promise<ContactBatchCreateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      createdCount: 0,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  }

  if (!input.workspaceId) {
    return {
      createdCount: 0,
      error: new Error("Kontaktimport ohne workspace_id ist nicht erlaubt."),
    };
  }

  if (input.contacts.length === 0) {
    return { createdCount: 0, error: null };
  }

  if (input.contacts.length > 1_000) {
    return {
      createdCount: 0,
      error: new Error("Kontaktimport überschreitet maximal 1.000 Kontakte."),
    };
  }

  const rows = input.contacts.map((contact) => ({
    workspace_id: input.workspaceId,
    display_name: contact.displayName.trim(),
    handle: normalizeOptionalText(contact.handle),
    source_platform: normalizeOptionalText(contact.sourcePlatform) ?? "manual",
    language: normalizeOptionalText(contact.language) ?? "de",
    status: normalizeOptionalText(contact.status) ?? "new",
    tags: contact.tags ?? [],
    summary: normalizeOptionalText(contact.summary),
  }));

  if (rows.some((row) => !row.display_name)) {
    return {
      createdCount: 0,
      error: new Error("Jeder Kontakt benötigt einen Namen."),
    };
  }

  // PostgREST turns one array POST into one PostgreSQL statement/transaction.
  // A rejected row therefore rejects the entire batch instead of leaving a
  // successfully written prefix behind.
  const result = await postgrestRequest(
    "contacts",
    "POST",
    rows,
    accessToken,
  );

  if (result.error) {
    return {
      createdCount: 0,
      error: new Error(
        `Kontakte konnten nicht atomar gespeichert werden: ${result.error.message}`,
      ),
    };
  }

  return { createdCount: rows.length, error: null };
}

export async function createWorkspaceContactServer(
  input: CreateContactInput,
): Promise<ContactCreateResult> {
  const workspaceError = assertContactWorkspaceInput(input.workspaceId);
  if (workspaceError) return contactCreateError(workspaceError.message);

  const accessToken = getContactServiceAccessToken();
  if (!accessToken) {
    return contactCreateError(missingContactServiceRoleError().message);
  }

  const displayName = input.displayName.trim();

  if (!displayName) {
    return contactCreateError("Name ist erforderlich.");
  }

  const contactResult = await postgrestRequest<ContactRow>(
    "contacts",
    "POST",
    {
      workspace_id: input.workspaceId,
      display_name: displayName,
      handle: normalizeOptionalText(input.handle),
      source_platform: normalizeOptionalText(input.sourcePlatform) ?? "manual",
      language: normalizeOptionalText(input.language) ?? "de",
      status: normalizeOptionalText(input.status) ?? "new",
      tags: input.tags ?? [],
      summary: normalizeOptionalText(input.summary),
    },
    accessToken,
    { select: CONTACT_COLUMNS, single: true },
  );

  if (contactResult.error) {
    return contactCreateError(
      `Kontakt konnte nicht gespeichert werden: ${contactResult.error.message}`,
    );
  }
  if (!contactResult.data) {
    return contactCreateError(
      "Kontakt konnte nicht aktualisiert werden: keine Zeile geändert. Prüfe workspace_id/RLS.",
    );
  }

  return { contact: contactResult.data, error: null };
}

export async function updateContactTopFanMarkServer(input: {
  workspaceId: string;
  contactId: string;
  isTopFan: boolean;
}): Promise<ContactUpdateResult> {
  const workspaceError = assertContactWorkspaceInput(input.workspaceId);
  if (workspaceError) return contactUpdateError(workspaceError.message);

  const accessToken = getContactServiceAccessToken();
  if (!accessToken) {
    return contactUpdateError(missingContactServiceRoleError().message);
  }

  const contactResult = await postgrestUpdate<ContactRow>(
    "contacts",
    { is_top_fan: input.isTopFan },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );

  if (contactResult.error) {
    return contactUpdateError(
      `Top-Fan-Markierung konnte nicht aktualisiert werden: ${contactResult.error.message}`,
    );
  }

  return { contact: contactResult.data, error: null };
}

export async function updateWorkspaceContact(
  input: UpdateContactInput,
): Promise<ContactUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return contactUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const displayName = input.displayName.trim();

  if (!displayName) {
    return contactUpdateError("Name ist erforderlich.");
  }

  const contactResult = await postgrestUpdate<ContactRow>(
    "contacts",
    {
      display_name: displayName,
      handle: normalizeOptionalText(input.handle),
      source_platform: normalizeOptionalText(input.sourcePlatform) ?? "manual",
      language: normalizeOptionalText(input.language) ?? "de",
      status: normalizeOptionalText(input.status) ?? "new",
      tags: input.tags ?? [],
      summary: normalizeOptionalText(input.summary),
    },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );

  if (contactResult.error) {
    return contactUpdateError(
      `Kontakt konnte nicht aktualisiert werden: ${contactResult.error.message}`,
    );
  }

  return { contact: contactResult.data, error: null };
}

export async function updateWorkspaceContactServer(
  input: UpdateContactInput,
): Promise<ContactUpdateResult> {
  const workspaceError = assertContactWorkspaceInput(input.workspaceId);
  if (workspaceError) return contactUpdateError(workspaceError.message);

  const accessToken = getContactServiceAccessToken();
  if (!accessToken) {
    return contactUpdateError(missingContactServiceRoleError().message);
  }

  const displayName = input.displayName.trim();

  if (!displayName) {
    return contactUpdateError("Name ist erforderlich.");
  }

  const expectedPlatform =
    normalizeOptionalText(input.sourcePlatform) ?? "manual";
  const expectedStatus = normalizeOptionalText(input.status) ?? "new";

  const contactResult = await postgrestUpdate<ContactRow>(
    "contacts",
    {
      display_name: displayName,
      handle: normalizeOptionalText(input.handle),
      source_platform: expectedPlatform,
      language: normalizeOptionalText(input.language) ?? "de",
      status: expectedStatus,
      tags: input.tags ?? [],
      summary: normalizeOptionalText(input.summary),
    },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );

  if (contactResult.error) {
    return contactUpdateError(
      `Kontakt konnte nicht aktualisiert werden: ${contactResult.error.message}`,
    );
  }
  if (!contactResult.data) {
    return contactUpdateError(
      "Kontakt konnte nicht aktualisiert werden: keine Zeile geändert. Prüfe workspace_id/RLS.",
    );
  }
  if (
    contactResult.data.workspace_id !== input.workspaceId ||
    contactResult.data.id !== input.contactId ||
    contactResult.data.source_platform !== expectedPlatform ||
    contactResult.data.status !== expectedStatus
  ) {
    return contactUpdateError(
      "Kontakt konnte nicht aktualisiert werden: Verifikation nach Speicherung fehlgeschlagen.",
    );
  }

  return { contact: contactResult.data, error: null };
}

async function archiveContactActiveWorkItems(input: {
  workspaceId: string;
  contactId: string;
  accessToken: string;
}): Promise<Error | null> {
  const now = new Date().toISOString();
  const conversationStatuses: ConversationStatus[] = ["open", "waiting"];

  for (const status of conversationStatuses) {
    const result = await postgrestUpdate<ConversationRow[]>(
      "conversations",
      {
        status: "archived",
        next_step: "Kontakt archiviert",
        updated_at: now,
      },
      input.accessToken,
      [
        ["workspace_id", input.workspaceId],
        ["contact_id", input.contactId],
        ["status", status],
      ],
    );

    if (result.error) {
      return new Error(
        `Offene Conversations konnten nicht archiviert werden: ${withOptionalSchemaHint(result.error.message, "conversations")}`,
      );
    }
  }

  const followupsResult = await postgrestUpdate<FollowupRow[]>(
    "followups",
    { status: "done" },
    input.accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
      ["status", "open"],
    ],
  );

  if (followupsResult.error) {
    return new Error(
      `Offene Follow-ups konnten nicht geschlossen werden: ${withOptionalSchemaHint(followupsResult.error.message, "followups")}`,
    );
  }

  return null;
}

export async function archiveWorkspaceContact(input: {
  workspaceId: string;
  contactId: string;
  reason?: string | null;
}): Promise<ContactUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return contactUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const existing = await getWorkspaceContact(
    input.workspaceId,
    input.contactId,
  );
  if (existing.error) return existing;
  if (!existing.contact) {
    return contactUpdateError("Kontakt wurde nicht gefunden.");
  }

  const archiveNote = input.reason
    ? `[Archiviert] ${input.reason}`
    : "[Archiviert] Kontakt wurde manuell archiviert.";
  const internalNotes = mergeTextBlocks(
    existing.contact.internal_notes,
    archiveNote,
  );

  const result = await postgrestUpdate<ContactRow>(
    "contacts",
    { status: "archived", internal_notes: internalNotes },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );

  if (result.error) {
    return contactUpdateError(
      `Kontakt konnte nicht archiviert werden: ${result.error.message}`,
    );
  }

  const workItemsError = await archiveContactActiveWorkItems({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    accessToken,
  });
  if (workItemsError) return contactUpdateError(workItemsError.message);

  return { contact: result.data, error: null };
}

export async function archiveWorkspaceContactServer(input: {
  workspaceId: string;
  contactId: string;
  reason?: string | null;
}): Promise<ContactUpdateResult> {
  const workspaceError = assertContactWorkspaceInput(input.workspaceId);
  if (workspaceError) return contactUpdateError(workspaceError.message);

  const accessToken = getContactServiceAccessToken();
  if (!accessToken) {
    return contactUpdateError(missingContactServiceRoleError().message);
  }

  const existing = await getWorkspaceContactWithToken(
    input.workspaceId,
    input.contactId,
    accessToken,
  );
  if (existing.error) return existing;
  if (!existing.contact) {
    return contactUpdateError("Kontakt wurde nicht gefunden.");
  }

  const archiveNote = input.reason
    ? `[Archiviert] ${input.reason}`
    : "[Archiviert] Kontakt wurde manuell archiviert.";
  const internalNotes = mergeTextBlocks(
    existing.contact.internal_notes,
    archiveNote,
  );

  const result = await postgrestUpdate<ContactRow>(
    "contacts",
    { status: "archived", internal_notes: internalNotes },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );

  if (result.error) {
    return contactUpdateError(
      `Kontakt konnte nicht archiviert werden: ${result.error.message}`,
    );
  }
  if (!result.data) {
    return contactUpdateError(
      "Kontakt konnte nicht aktualisiert werden: keine Zeile geändert. Prüfe workspace_id/RLS.",
    );
  }
  if (
    result.data.workspace_id !== input.workspaceId ||
    result.data.id !== input.contactId ||
    result.data.status !== "archived"
  ) {
    return contactUpdateError(
      "Kontakt konnte nicht archiviert werden: Verifikation nach Speicherung fehlgeschlagen.",
    );
  }

  const workItemsError = await archiveContactActiveWorkItems({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    accessToken,
  });
  if (workItemsError) return contactUpdateError(workItemsError.message);

  return { contact: result.data, error: null };
}

export async function mergeWorkspaceContacts(input: {
  workspaceId: string;
  sourceContactId: string;
  targetContactId: string;
}): Promise<ContactUpdateResult> {
  const workspaceError = assertContactWorkspaceInput(input.workspaceId);
  if (workspaceError) return contactUpdateError(workspaceError.message);

  const accessToken = getContactServiceAccessToken();
  if (!accessToken) {
    return contactUpdateError(missingContactServiceRoleError().message);
  }
  if (input.sourceContactId === input.targetContactId) {
    return contactUpdateError(
      "Quelle und Ziel müssen unterschiedliche Kontakte sein.",
    );
  }

  const [sourceResult, targetResult] = await Promise.all([
    getWorkspaceContactWithToken(
      input.workspaceId,
      input.sourceContactId,
      accessToken,
    ),
    getWorkspaceContactWithToken(
      input.workspaceId,
      input.targetContactId,
      accessToken,
    ),
  ]);
  if (sourceResult.error) return sourceResult;
  if (targetResult.error) return targetResult;
  const source = sourceResult.contact;
  const target = targetResult.contact;
  if (!source || !target)
    return contactUpdateError("Quelle oder Ziel wurde nicht gefunden.");

  for (const table of [
    "conversations",
    "conversation_messages",
    "memories",
    "followups",
    "contact_reply_targets",
    "conversation_summaries",
    "contact_ai_profiles",
    "fan_analysis_reports",
  ]) {
    const moved = await postgrestUpdate(
      table,
      { contact_id: input.targetContactId },
      accessToken,
      [
        ["workspace_id", input.workspaceId],
        ["contact_id", input.sourceContactId],
      ],
    );
    if (moved.error) {
      return contactUpdateError(
        `Merge abgebrochen: ${table} konnte nicht umgehängt werden: ${moved.error.message}`,
      );
    }
  }

  const mergedTags = uniqueTextValues([
    ...(target.tags ?? []),
    ...(source.tags ?? []),
  ]);
  const sourceHandleNote =
    source.handle && source.handle !== target.handle
      ? `Alias aus zusammengeführtem Kontakt: ${source.handle}`
      : null;
  const sourcePlatformNote =
    source.source_platform && source.source_platform !== target.source_platform
      ? `Zusätzlicher Quellkanal aus Merge: ${source.source_platform}`
      : null;
  const mergedSummary = mergeTextBlocks(
    target.summary,
    source.summary
      ? `Aus zusammengeführtem Kontakt ${source.id}: ${source.summary}`
      : null,
  );
  const mergedNotes = mergeTextBlocks(
    target.internal_notes,
    [
      `Kontakt ${source.id} (${source.display_name}) wurde in diesen Kontakt zusammengeführt.`,
      sourceHandleNote,
      sourcePlatformNote,
      source.internal_notes
        ? `Notizen aus Quelle: ${source.internal_notes}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const updatedTarget = await postgrestUpdate<ContactRow>(
    "contacts",
    {
      tags: mergedTags,
      summary: normalizeOptionalText(mergedSummary),
      internal_notes: normalizeOptionalText(mergedNotes),
      handle: target.handle ?? source.handle,
      source_platform:
        target.source_platform ?? source.source_platform ?? "manual",
    },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.targetContactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );
  if (updatedTarget.error)
    return contactUpdateError(updatedTarget.error.message);
  if (!updatedTarget.data) {
    return contactUpdateError(
      "Kontakt konnte nicht aktualisiert werden: keine Zeile geändert. Prüfe workspace_id/RLS.",
    );
  }

  const sourcePlatform = normalizeOptionalText(source.source_platform);
  const targetPlatform = normalizeOptionalText(target.source_platform);
  if (sourcePlatform && sourcePlatform !== targetPlatform) {
    const mergedChannel = await createWorkspaceContactServer({
      workspaceId: input.workspaceId,
      displayName: target.display_name || source.display_name,
      handle: target.handle ?? source.handle,
      sourcePlatform,
      language: target.language ?? source.language ?? "de",
      status: target.status ?? source.status ?? "new",
      tags: mergedTags,
      summary: normalizeOptionalText(mergedSummary),
    });
    if (mergedChannel.error) return mergedChannel;
  }

  const archived = await archiveWorkspaceContactServer({
    workspaceId: input.workspaceId,
    contactId: input.sourceContactId,
    reason: `Zusammengeführt in Kontakt ${input.targetContactId}.`,
  });
  if (archived.error) return archived;

  return { contact: updatedTarget.data, error: null };
}

export async function updateContactInternalNotes(input: {
  workspaceId: string;
  contactId: string;
  internalNotes: string;
}): Promise<ContactUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return contactUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  return updateContactInternalNotesWithToken(input, accessToken);
}

export async function updateContactInternalNotesServer(input: {
  workspaceId: string;
  contactId: string;
  internalNotes: string;
}): Promise<ContactUpdateResult> {
  const accessToken = await getAccessToken();
  const serviceAccessToken = getServiceAccessToken();
  const context = {
    contactId: input.contactId,
    workspaceId: input.workspaceId,
    serviceRoleConfigured: Boolean(serviceAccessToken),
    contactFoundBeforeUpdate: false,
    updateChangedRow: false,
  };

  if (!accessToken) {
    console.error("[Fan notes save] Kein eingeloggter User.", context);
    return contactUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const contactBeforeUpdate = await postgrestSelect<ContactRow>(
    "contacts",
    accessToken,
    CONTACT_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    1,
    true,
  );

  const contactFoundBeforeUpdate = Boolean(contactBeforeUpdate.data);

  if (contactBeforeUpdate.error || !contactBeforeUpdate.data) {
    console.error("[Fan notes save] Kontakt vor Update nicht gefunden.", {
      ...context,
      contactFoundBeforeUpdate,
      supabaseError: contactBeforeUpdate.error?.message ?? null,
    });
    return contactUpdateError(
      "Notizen konnten nicht gespeichert werden: Kontakt wurde im Workspace nicht gefunden.",
    );
  }

  const userResult = await updateContactInternalNotesWithToken(
    input,
    accessToken,
  );

  if (!userResult.error && userResult.contact) {
    return userResult;
  }

  if (!serviceAccessToken) {
    console.error(
      "[Fan notes save] User-Update fehlgeschlagen, Service-Role fehlt.",
      {
        ...context,
        contactFoundBeforeUpdate,
        supabaseError: userResult.error?.message ?? null,
      },
    );
    return userResult.error
      ? userResult
      : contactUpdateError(
          "Notizen konnten nicht gespeichert werden: keine Zeile geändert.",
        );
  }

  const serviceResult = await updateContactInternalNotesWithToken(
    input,
    serviceAccessToken,
  );

  if (serviceResult.error || !serviceResult.contact) {
    console.error("[Fan notes save] Service-Update fehlgeschlagen.", {
      ...context,
      contactFoundBeforeUpdate,
      updateChangedRow: Boolean(serviceResult.contact),
      supabaseError: serviceResult.error?.message ?? null,
      userUpdateError: userResult.error?.message ?? null,
    });
  }

  return serviceResult;
}

async function updateContactInternalNotesWithToken(
  input: { workspaceId: string; contactId: string; internalNotes: string },
  accessToken: string,
): Promise<ContactUpdateResult> {
  const normalizedNotes = input.internalNotes.trim();
  const result = await postgrestUpdate<ContactRow>(
    "contacts",
    { internal_notes: normalizedNotes, updated_at: new Date().toISOString() },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.contactId],
    ],
    { select: CONTACT_COLUMNS, single: true },
  );

  if (result.error) {
    return contactUpdateError(
      `Notizen konnten nicht gespeichert werden: ${result.error.message}`,
    );
  }

  if (!result.data) {
    return contactUpdateError(
      "Notizen konnten nicht gespeichert werden: keine Zeile geändert.",
    );
  }

  if (
    result.data.id !== input.contactId ||
    result.data.workspace_id !== input.workspaceId ||
    result.data.internal_notes !== normalizedNotes
  ) {
    return contactUpdateError(
      "Notizen konnten nicht gespeichert werden: Verifikation fehlgeschlagen.",
    );
  }

  return { contact: result.data, error: null };
}

export async function getFanAnalysisReport(
  workspaceId: string,
  contactId: string,
  explicitAccessToken?: string,
): Promise<FanAnalysisReportResult> {
  const accessToken = await getAccessToken(explicitAccessToken);
  if (!accessToken)
    return {
      report: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  const result = await postgrestSelect<FanAnalysisReportRow>(
    "fan_analysis_reports",
    accessToken,
    FAN_ANALYSIS_REPORT_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    1,
    true,
  );
  if (result.error)
    return {
      report: null,
      error: new Error(
        `Analyse-Report konnte nicht geladen werden: ${result.error.message}`,
      ),
    };
  return { report: result.data, error: null };
}

export async function upsertFanAnalysisReport(input: {
  workspaceId: string;
  contactId: string;
  reportJson: Record<string, unknown>;
  summary: string;
  model: string;
  sourceMessageCount: number;
}): Promise<FanAnalysisReportResult> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return {
      report: null,
      error: new Error(
        "Serverberechtigungen für Analyseberichte fehlen.",
      ),
    };
  const result = await postgrestRequest<FanAnalysisReportRow>(
    "fan_analysis_reports",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      report_json: input.reportJson,
      summary: input.summary,
      model: input.model,
      source_message_count: input.sourceMessageCount,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    accessToken,
    {
      select: FAN_ANALYSIS_REPORT_COLUMNS,
      single: true,
      upsert: true,
      onConflict: "workspace_id,contact_id",
    },
  );
  if (result.error)
    return {
      report: null,
      error: new Error(
        `Analyse-Report konnte nicht gespeichert werden: ${result.error.message}`,
      ),
    };
  return { report: result.data, error: null };
}

export async function deleteContactAnalysisProfiles(input: {
  workspaceId: string;
  contactId: string;
}): Promise<{ error: Error | null }> {
  const accessToken = getServiceAccessToken();
  if (!accessToken) {
    return {
      error: new Error("Serverberechtigungen für die Profillöschung fehlen."),
    };
  }

  for (const table of [
    "communication_analysis_reports",
    "fan_analysis_reports",
    "contact_ai_profiles",
  ]) {
    const result = await postgrestDelete(table, accessToken, [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
    ]);
    if (result.error) {
      const missingOptionalTable =
        table === "communication_analysis_reports" &&
        isMissingOptionalTable(result.error, table);
      if (!missingOptionalTable) {
        return {
          error: new Error(
            `Analyseprofil konnte nicht vollständig gelöscht werden: ${result.error.message}`,
          ),
        };
      }
    }
  }

  return { error: null };
}

function isMissingOptionalTable(error: Error, table: string): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes(table.toLowerCase()) &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find"))
  );
}

export async function getContactMemories(
  workspaceId: string,
  contactId: string,
): Promise<MemoriesResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return memoriesError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const memoriesResult = await postgrestSelect<MemoryRow[]>(
    "memories",
    accessToken,
    MEMORY_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    undefined,
    false,
    "created_at.desc",
  );

  if (memoriesResult.error) {
    return memoriesError(
      `Memories konnten nicht geladen werden: ${withOptionalSchemaHint(memoriesResult.error.message, "memories")}`,
    );
  }

  return { memories: memoriesResult.data ?? [], error: null };
}

export async function getRecentContactMemories(
  workspaceId: string,
  contactId: string,
  limit: number,
  explicitAccessToken?: string,
): Promise<MemoriesResult> {
  const accessToken = await getAccessToken(explicitAccessToken);

  if (!accessToken) {
    return memoriesError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const memoriesResult = await postgrestSelect<MemoryRow[]>(
    "memories",
    accessToken,
    MEMORY_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    boundedLimit,
    false,
    "created_at.desc",
  );

  if (memoriesResult.error) {
    return memoriesError(
      `Memories konnten nicht geladen werden: ${withOptionalSchemaHint(memoriesResult.error.message, "memories")}`,
    );
  }

  return { memories: memoriesResult.data ?? [], error: null };
}

export async function createContactMemory(
  input: CreateMemoryInput,
): Promise<MemoryCreateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return memoryCreateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const content = input.content.trim();

  if (!content) {
    return memoryCreateError("Memory-Inhalt ist erforderlich.");
  }

  const memoryResult = await postgrestRequest<MemoryRow>(
    "memories",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      type: normalizeOptionalText(input.type) ?? "note",
      content,
      importance: normalizeOptionalText(input.importance) ?? "normal",
    },
    accessToken,
    { select: MEMORY_COLUMNS, single: true },
  );

  if (memoryResult.error) {
    return memoryCreateError(
      `Memory konnte nicht gespeichert werden: ${withOptionalSchemaHint(memoryResult.error.message, "memories")}`,
    );
  }

  return { memory: memoryResult.data, error: null };
}

export async function getWorkspaceConversations(
  workspaceId: string,
): Promise<ConversationsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationsError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  let assignmentSupported = true;
  let result = await postgrestSelect<ConversationRow[]>(
    "conversations",
    accessToken,
    CONVERSATION_ASSIGNMENT_COLUMNS,
    [["workspace_id", workspaceId]],
    undefined,
    false,
    "updated_at.desc",
  );

  if (isMissingAssignedUserIdentity(result.error)) {
    assignmentSupported = false;
    result = await postgrestSelect<ConversationRow[]>(
      "conversations",
      accessToken,
      CONVERSATION_COLUMNS,
      [["workspace_id", workspaceId]],
      undefined,
      false,
      "updated_at.desc",
    );
  }

  if (result.error) {
    return conversationsError(
      `Conversations konnten nicht geladen werden: ${withOptionalSchemaHint(result.error.message, "conversations")}`,
    );
  }

  return {
    conversations: (result.data ?? [])
      .filter((conversation) => conversation.status !== "archived")
      .map((conversation) => ({
        ...conversation,
        assignment_supported: assignmentSupported,
      })),
    error: null,
  };
}

export async function getContactConversationMessages(
  workspaceId: string,
  contactId: string,
): Promise<ConversationMessagesResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationMessagesError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const result = await postgrestSelect<ConversationMessageRow[]>(
    "conversation_messages",
    accessToken,
    CONVERSATION_MESSAGE_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    undefined,
    false,
    "created_at.asc",
  );

  if (result.error) {
    return conversationMessagesError(
      `Nachrichten konnten nicht geladen werden: ${withOptionalSchemaHint(result.error.message, "conversation_messages")}`,
    );
  }

  return { messages: result.data ?? [], error: null };
}

export async function getRecentContactConversationMessages(
  workspaceId: string,
  contactId: string,
  limit: number,
  explicitAccessToken?: string,
): Promise<ConversationMessagesResult> {
  const accessToken = await getAccessToken(explicitAccessToken);

  if (!accessToken) {
    return conversationMessagesError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 150));
  const result = await postgrestSelect<ConversationMessageRow[]>(
    "conversation_messages",
    accessToken,
    CONVERSATION_MESSAGE_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    boundedLimit,
    false,
    "created_at.desc",
  );

  if (result.error) {
    return conversationMessagesError(
      `Nachrichten konnten nicht geladen werden: ${withOptionalSchemaHint(result.error.message, "conversation_messages")}`,
    );
  }

  return { messages: [...(result.data ?? [])].reverse(), error: null };
}


export async function getWorkspaceConversationMessages(
  workspaceId: string,
): Promise<ConversationMessagesResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationMessagesError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const result = await postgrestSelect<ConversationMessageRow[]>(
    "conversation_messages",
    accessToken,
    CONVERSATION_MESSAGE_COLUMNS,
    [["workspace_id", workspaceId]],
    undefined,
    false,
    "created_at.desc",
  );

  if (result.error) {
    return conversationMessagesError(
      `Nachrichten konnten nicht geladen werden: ${withOptionalSchemaHint(result.error.message, "conversation_messages")}`,
    );
  }

  return { messages: result.data ?? [], error: null };
}

export async function getWorkspaceUnseenInboundMessages(
  workspaceId: string,
): Promise<ConversationMessagesResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationMessagesError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const result = await postgrestSelect<ConversationMessageRow[]>(
    "conversation_messages",
    accessToken,
    CONVERSATION_MESSAGE_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["direction", "inbound"],
      ["seen_at", null],
    ],
    undefined,
    false,
    "created_at.desc",
  );

  if (result.error) {
    return conversationMessagesError(
      `Neue Nachrichten konnten nicht geladen werden: ${withOptionalSchemaHint(result.error.message, "conversation_messages")}`,
    );
  }

  return { messages: result.data ?? [], error: null };
}

export async function markContactInboundMessagesSeen(input: {
  workspaceId: string;
  contactId: string;
}): Promise<{ error: Error | null }> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  }

  const result = await postgrestUpdate(
    "conversation_messages",
    { seen_at: new Date().toISOString() },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
      ["direction", "inbound"],
      ["seen_at", null],
    ],
  );

  if (result.error) {
    return {
      error: new Error(
        `Nachrichten konnten nicht als gesehen markiert werden: ${withOptionalSchemaHint(result.error.message, "conversation_messages")}`,
      ),
    };
  }

  return { error: null };
}

export async function ensureConversationForContact(input: {
  workspaceId: string;
  contactId: string;
  sourcePlatform?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  replyTargetUrl?: string | null;
}): Promise<ConversationResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const existing = await postgrestSelect<ConversationRow[]>(
    "conversations",
    accessToken,
    CONVERSATION_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
    ],
    undefined,
    false,
    "updated_at.desc",
  );

  if (existing.error) {
    return conversationError(
      `Conversation konnte nicht geprüft werden: ${withOptionalSchemaHint(existing.error.message, "conversations")}`,
    );
  }

  const openConversation = (existing.data ?? []).find((conversation) =>
    ["open", "waiting"].includes(conversation.status),
  );

  if (openConversation) {
    return { conversation: openConversation, error: null };
  }

  const created = await postgrestRequest<ConversationRow>(
    "conversations",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      status: "open",
      priority: "normal",
      source_platform: normalizeOptionalText(input.sourcePlatform),
      source_type: normalizeMessageType(input.sourceType),
      source_url: normalizeUrl(input.sourceUrl),
      reply_target_url:
        normalizeUrl(input.replyTargetUrl) ?? normalizeUrl(input.sourceUrl),
      ai_status: "not_ready",
      next_step: "Antwort vorbereiten",
    },
    accessToken,
    { select: CONVERSATION_COLUMNS, single: true },
  );

  if (created.error) {
    return conversationError(
      `Conversation konnte nicht erstellt werden: ${withOptionalSchemaHint(created.error.message, "conversations")}`,
    );
  }

  return { conversation: created.data, error: null };
}

export async function createManualConversationMessage(
  input: CreateManualConversationMessageInput,
): Promise<ConversationMessageCreateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationMessageCreateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const content = input.content.trim();

  if (!content) {
    return conversationMessageCreateError("Nachrichtentext ist erforderlich.");
  }

  const sourceUrl = normalizeUrl(input.sourceUrl);
  const replyTargetUrl = normalizeUrl(input.replyTargetUrl) ?? sourceUrl;
  const messageType = normalizeMessageType(input.messageType);
  const sourceType = normalizeMessageType(
    input.sourceType ?? input.messageType,
  );
  const direction = input.direction ?? "inbound";
  const conversationResult = await ensureConversationForContact({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    sourcePlatform: input.sourcePlatform,
    sourceType,
    sourceUrl,
    replyTargetUrl,
  });

  if (conversationResult.error || !conversationResult.conversation) {
    return {
      message: null,
      conversation: null,
      error:
        conversationResult.error ??
        new Error("Conversation konnte nicht erstellt werden."),
    };
  }

  const messageResult = await postgrestRequest<ConversationMessageRow>(
    "conversation_messages",
    "POST",
    {
      workspace_id: input.workspaceId,
      conversation_id: conversationResult.conversation.id,
      contact_id: input.contactId,
      direction,
      message_type: messageType,
      source_platform: normalizeOptionalText(input.sourcePlatform) ?? "manual",
      source_url: sourceUrl,
      reply_target_url: replyTargetUrl,
      source_type: sourceType,
      external_thread_id: normalizeOptionalText(input.externalThreadId),
      external_message_id: normalizeOptionalText(input.externalMessageId),
      external_post_id: normalizeOptionalText(input.externalPostId),
      external_comment_id: normalizeOptionalText(input.externalCommentId),
      original_author_label:
        normalizeOptionalText(input.originalAuthorLabel) ??
        normalizeOptionalText(input.authorLabel),
      original_text_excerpt: normalizeExcerpt(
        input.originalTextExcerpt ?? content,
      ),
      author_label:
        normalizeOptionalText(input.authorLabel) ??
        (direction === "inbound" ? "Fan" : "Team"),
      content,
      attachments: normalizeMessageAttachments(input.attachments),
      message_kind: normalizeMessageKind(
        input.messageKind,
        input.attachments,
        content,
      ),
    },
    accessToken,
    { select: CONVERSATION_MESSAGE_COLUMNS, single: true },
  );

  if (messageResult.error) {
    return conversationMessageCreateError(
      `Nachricht konnte nicht gespeichert werden: ${withOptionalSchemaHint(messageResult.error.message, "conversation_messages")}`,
    );
  }

  const updateValues: Record<string, string | null> = {
    last_message_preview: content.slice(0, 240),
    source_platform:
      normalizeOptionalText(input.sourcePlatform) ??
      conversationResult.conversation.source_platform,
    source_type: sourceType,
    source_url: sourceUrl ?? conversationResult.conversation.source_url,
    reply_target_url:
      replyTargetUrl ?? conversationResult.conversation.reply_target_url,
    ai_status: "partial",
    next_step: "Antwort vorbereiten",
    external_thread_id:
      normalizeOptionalText(input.externalThreadId) ??
      conversationResult.conversation.external_thread_id,
    external_message_id:
      normalizeOptionalText(input.externalMessageId) ??
      conversationResult.conversation.external_message_id,
    external_post_id:
      normalizeOptionalText(input.externalPostId) ??
      conversationResult.conversation.external_post_id,
    external_comment_id:
      normalizeOptionalText(input.externalCommentId) ??
      conversationResult.conversation.external_comment_id,
    original_author_label:
      normalizeOptionalText(input.originalAuthorLabel) ??
      normalizeOptionalText(input.authorLabel) ??
      conversationResult.conversation.original_author_label,
    original_text_excerpt:
      normalizeExcerpt(input.originalTextExcerpt ?? content) ??
      conversationResult.conversation.original_text_excerpt,
  };

  if (direction === "inbound")
    updateValues.last_inbound_at = new Date().toISOString();
  if (direction === "outbound")
    updateValues.last_outbound_at = new Date().toISOString();

  if (direction === "outbound" && messageType === "manual") {
    await updateWorkspaceVoiceProfileFromManualOutbound({
      workspaceId: input.workspaceId,
      userId: input.userId,
      ownerLabel: input.authorLabel,
      content,
    });
  }

  const updatedConversation = await postgrestUpdate<ConversationRow>(
    "conversations",
    updateValues,
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", conversationResult.conversation.id],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  return {
    message: messageResult.data,
    conversation: updatedConversation.data ?? conversationResult.conversation,
    error: updatedConversation.error,
  };
}

export async function getConversationSummary(input: {
  workspaceId: string;
  conversationId: string;
}): Promise<{ summary: ConversationSummaryRow | null; error: Error | null }> {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      summary: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  const result = await postgrestSelect<ConversationSummaryRow>(
    "conversation_summaries",
    accessToken,
    CONVERSATION_SUMMARY_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["conversation_id", input.conversationId],
    ],
    1,
    true,
  );
  return { summary: result.data, error: result.error };
}

export async function upsertConversationSummary(input: {
  workspaceId: string;
  conversationId: string;
  contactId: string;
  summary?: string | null;
  keyPoints?: string[];
  openQuestions?: string[];
  lastSummarizedMessageAt?: string | null;
  messageCountSeen?: number;
}): Promise<{ summary: ConversationSummaryRow | null; error: Error | null }> {
  const accessToken = await getAccessToken();
  if (!accessToken)
    return {
      summary: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  const result = await postgrestRequest<ConversationSummaryRow>(
    "conversation_summaries",
    "POST",
    {
      workspace_id: input.workspaceId,
      conversation_id: input.conversationId,
      contact_id: input.contactId,
      summary: normalizeOptionalText(input.summary),
      key_points: input.keyPoints ?? [],
      open_questions: input.openQuestions ?? [],
      last_summarized_message_at: input.lastSummarizedMessageAt ?? null,
      message_count_seen: input.messageCountSeen ?? 0,
      updated_at: new Date().toISOString(),
    },
    accessToken,
    {
      select: CONVERSATION_SUMMARY_COLUMNS,
      single: true,
      upsert: true,
      onConflict: "workspace_id,conversation_id",
    },
  );
  return { summary: result.data, error: result.error };
}

export async function getContactAiProfile(
  workspaceId: string,
  contactId: string,
  explicitAccessToken?: string,
): Promise<{ profile: ContactAiProfileRow | null; error: Error | null }> {
  const accessToken = await getAccessToken(explicitAccessToken);
  if (!accessToken)
    return {
      profile: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  const result = await postgrestSelect<ContactAiProfileRow>(
    "contact_ai_profiles",
    accessToken,
    CONTACT_AI_PROFILE_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    1,
    true,
  );
  return { profile: result.data, error: result.error };
}

export async function upsertContactAiProfile(
  input: Partial<ContactAiProfileRow> & {
    workspace_id: string;
    contact_id: string;
  },
): Promise<{ profile: ContactAiProfileRow | null; error: Error | null }> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return {
      profile: null,
      error: new Error(
        "Serverberechtigungen für Kontaktanalysen fehlen.",
      ),
    };
  const result = await postgrestRequest<ContactAiProfileRow>(
    "contact_ai_profiles",
    "POST",
    { ...input, updated_at: new Date().toISOString() },
    accessToken,
    {
      select: CONTACT_AI_PROFILE_COLUMNS,
      single: true,
      upsert: true,
      onConflict: "workspace_id,contact_id",
    },
  );
  return { profile: result.data, error: result.error };
}

export async function getWorkspaceVoiceProfile(
  workspaceId: string,
  userId?: string | null,
  explicitAccessToken?: string,
): Promise<{ profile: WorkspaceVoiceProfileRow | null; error: Error | null }> {
  const accessToken = await getAccessToken(explicitAccessToken);
  if (!accessToken)
    return {
      profile: null,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  const filters: [string, SupabaseFilterValue][] = [
    ["workspace_id", workspaceId],
  ];
  if (userId) filters.push(["user_id", userId]);
  const result = await postgrestSelect<WorkspaceVoiceProfileRow>(
    "workspace_voice_profiles",
    accessToken,
    WORKSPACE_VOICE_PROFILE_COLUMNS,
    filters,
    1,
    true,
    "updated_at.desc",
  );
  return { profile: result.data, error: result.error };
}

export async function upsertWorkspaceVoiceProfile(
  input: Partial<WorkspaceVoiceProfileRow> & {
    workspace_id: string;
    user_id?: string | null;
  },
): Promise<{ profile: WorkspaceVoiceProfileRow | null; error: Error | null }> {
  const accessToken = getServiceAccessToken();
  if (!accessToken)
    return {
      profile: null,
      error: new Error(
        "Serverberechtigungen für Schreibstilprofile fehlen.",
      ),
    };
  const result = await postgrestRequest<WorkspaceVoiceProfileRow>(
    "workspace_voice_profiles",
    "POST",
    { ...input, updated_at: new Date().toISOString() },
    accessToken,
    {
      select: WORKSPACE_VOICE_PROFILE_COLUMNS,
      single: true,
      upsert: true,
      onConflict: "workspace_id,user_id",
    },
  );
  return { profile: result.data, error: result.error };
}

export async function updateWorkspaceVoiceProfileFromManualOutbound(input: {
  workspaceId: string;
  userId?: string | null;
  ownerLabel?: string | null;
  content: string;
}): Promise<void> {
  const capability = await getWorkspaceAnalysisCapabilityStatus(
    input.workspaceId,
    "user_voice_analysis",
  );
  if (!capability.enabled) return;
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) return;
  const filters: [string, SupabaseFilterValue][] = [
    ["workspace_id", input.workspaceId],
  ];
  if (input.userId) filters.push(["user_id", input.userId]);
  const existing = await postgrestSelect<WorkspaceVoiceProfileRow>(
    "workspace_voice_profiles",
    serviceAccessToken,
    WORKSPACE_VOICE_PROFILE_COLUMNS,
    filters,
    1,
    true,
    "updated_at.desc",
  );
  const count = (existing.data?.examples_count ?? 0) + 1;
  await upsertWorkspaceVoiceProfile({
    workspace_id: input.workspaceId,
    user_id: input.userId ?? null,
    owner_label:
      normalizeOptionalText(input.ownerLabel) ??
      existing.data?.owner_label ??
      "Team",
    language: existing.data?.language ?? detectLanguage(input.content),
    tone: existing.data?.tone ?? detectTone(input.content),
    sentence_length:
      existing.data?.sentence_length ?? detectSentenceLength(input.content),
    emoji_style:
      existing.data?.emoji_style ?? detectEmojiStyle(input.content),
    common_phrases:
      existing.data?.common_phrases ?? extractCommonPhrases(input.content),
    examples_count: count,
    confidence_score: Math.min(35, count * 5),
  });
}

function normalizeExcerpt(value?: string | null): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.slice(0, 500) : null;
}

function detectLanguage(content: string): string {
  return /\b(und|oder|danke|bitte|ich|du|sie|wir)\b/i.test(content)
    ? "de"
    : "unbekannt";
}

function detectTone(content: string): string {
  if (/[!😊🙂😉]/u.test(content)) return "freundlich";
  return content.length < 180 ? "kurz und sachlich" : "ausführlich";
}

function detectSentenceLength(content: string): string {
  const sentences = content.split(/[.!?]+/).filter((part) => part.trim());
  const average = sentences.length
    ? content.split(/\s+/).length / sentences.length
    : 0;
  return average > 18 ? "eher lang" : "eher kurz";
}

function detectEmojiStyle(content: string): string {
  return /[\p{Extended_Pictographic}]/u.test(content)
    ? "nutzt Emojis"
    : "kaum Emojis";
}

function extractCommonPhrases(content: string): string[] {
  return ["Danke", "Liebe Grüße", "Viele Grüße"].filter((phrase) =>
    content.toLowerCase().includes(phrase.toLowerCase()),
  );
}

export async function createMetaWebhookConversationMessage(input: {
  workspaceId: string;
  senderId?: string | null;
  pageId?: string | null;
  recipientId?: string | null;
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
  authorLabel: string;
  content: string;
  messageType: "dm" | "comment";
  sourceType?:
    | "facebook_messages"
    | "facebook_comments"
    | "instagram_messages"
    | "instagram_comments"
    | "whatsapp_messages"
    | "tiktok_comments"
    | "tiktok_messages"
    | "telegram_messages"
    | "dm"
    | "comment"
    | null;
  sourceUrl?: string | null;
  replyTargetUrl?: string | null;
  metaUrlCandidates?: Array<string | null | undefined>;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  sourceConversationId?: string | null;
  externalPostId?: string | null;
  externalCommentId?: string | null;
  originalAuthorLabel?: string | null;
  originalTextExcerpt?: string | null;
  attachments?: ConversationMessageAttachment[] | null;
  messageKind?: string | null;
  receivedAt?: string | null;
  direction?: "inbound" | "outbound";
}): Promise<ConversationMessageCreateResult> {
  const entitlement = await getWorkspaceProcessingEntitlement(
    input.workspaceId,
  );
  if (entitlement.error || !entitlement.allowed) {
    return conversationMessageCreateError(
      "Workspace-Verarbeitung ist nicht zulässig.",
    );
  }

  const normalizedSourceType = normalizeMessageType(
    input.sourceType ??
      getDefaultWebhookSourceType(input.sourcePlatform, input.messageType),
  );
  const senderId = normalizeOptionalText(input.senderId);
  const pageId = normalizeOptionalText(input.pageId ?? input.recipientId);
  const threadIdentifiers = buildMetaThreadIdentifiers({
    sourcePlatform: input.sourcePlatform,
    sourceType: normalizedSourceType,
    externalThreadId: input.externalThreadId,
    sourceConversationId: input.sourceConversationId,
    pageId,
    senderId,
  });
  const preferredThreadId = threadIdentifiers[0] ?? null;
  let contact: ContactRow | null = null;

  if (threadIdentifiers.length) {
    const byThread = await findContactByThreadIdentifiers({
      workspaceId: input.workspaceId,
      sourcePlatform: input.sourcePlatform,
      threadIdentifiers,
    });
    if (byThread.error)
      return conversationMessageCreateError(byThread.error.message);
    contact = byThread.contact;
  }

  if (!contact && senderId) {
    const existing = await postgrestSelect<ContactRow>(
      "contacts",
      getServiceAccessToken(),
      CONTACT_COLUMNS,
      [
        ["workspace_id", input.workspaceId],
        ["handle", senderId],
      ],
      1,
      true,
    );
    if (existing.error)
      return conversationMessageCreateError(existing.error.message);
    contact = existing.data;

    if (!contact) {
      const aliasContact = await findPreferredContactBySenderAlias({
        workspaceId: input.workspaceId,
        sourcePlatform: input.sourcePlatform,
        senderId,
      });
      if (aliasContact.error)
        return conversationMessageCreateError(aliasContact.error.message);
      contact = aliasContact.contact;
    }
  }

  if (contact) {
    const nextDisplayName = normalizeOptionalText(input.authorLabel);
    const currentIsFallback = isWebhookFallbackDisplayName(
      contact.display_name,
      input.sourcePlatform,
      senderId,
    );
    if (
      nextDisplayName &&
      nextDisplayName !== contact.display_name &&
      !isWebhookFallbackDisplayName(
        nextDisplayName,
        input.sourcePlatform,
        senderId,
      ) &&
      (currentIsFallback || !contact.display_name)
    ) {
      const updated = await postgrestUpdate<ContactRow>(
        "contacts",
        {
          display_name: nextDisplayName,
          source_platform: contact.source_platform ?? input.sourcePlatform,
        },
        getServiceAccessToken(),
        [
          ["workspace_id", input.workspaceId],
          ["id", contact.id],
        ],
        { select: CONTACT_COLUMNS, single: true },
      );
      if (!updated.error && updated.data) contact = updated.data;
    }

    if (senderId && !normalizeOptionalText(contact.handle)) {
      const syncedHandle = await postgrestUpdate<ContactRow>(
        "contacts",
        { handle: senderId },
        getServiceAccessToken(),
        [
          ["workspace_id", input.workspaceId],
          ["id", contact.id],
        ],
        { select: CONTACT_COLUMNS, single: true },
      );
      if (!syncedHandle.error && syncedHandle.data) contact = syncedHandle.data;
    }
  }

  if (!contact) {
    const created = await postgrestRequest<ContactRow>(
      "contacts",
      "POST",
      {
        workspace_id: input.workspaceId,
        display_name:
          input.authorLabel ||
          getDefaultWebhookAuthorLabel(input.sourcePlatform),
        handle: senderId,
        source_platform: input.sourcePlatform,
        language: "de",
        status: "new",
        tags: [input.sourcePlatform],
        summary: `Automatisch aus einem eingehenden ${getWebhookPlatformLabel(input.sourcePlatform)}-Webhook angelegt.`,
      },
      getServiceAccessToken(),
      { select: CONTACT_COLUMNS, single: true },
    );
    if (created.error || !created.data)
      return conversationMessageCreateError(
        created.error?.message ?? "Kontakt konnte nicht angelegt werden.",
      );
    contact = created.data;
  }

  const normalizedReplyTargetUrl = normalizeUrl(input.replyTargetUrl);
  const normalizedSourceUrl = normalizeUrl(input.sourceUrl);
  const normalizedMetaUrlCandidates = Array.from(
    new Set(
      [
        normalizedReplyTargetUrl,
        normalizedSourceUrl,
        ...(input.metaUrlCandidates ?? []).map((entry) => normalizeUrl(entry)),
      ].filter((entry): entry is string => Boolean(entry)),
    ),
  );
  const preferredBusinessInboxUrl =
    extractBusinessInboxUrlCandidates(normalizedMetaUrlCandidates)[0] ?? null;
  const normalizedPageId = normalizeOptionalText(
    input.pageId ?? input.recipientId,
  );
  const normalizedBusinessId =
    process.env.META_BUSINESS_ID ?? process.env.NEXT_PUBLIC_META_BUSINESS_ID;

  const autoSelectedItemId = normalizedMetaUrlCandidates
    .map((url) => extractSelectedItemIdFromMetaUrl(url))
    .find((id): id is string => Boolean(id));
  const autoThreadId =
    normalizedMetaUrlCandidates
      .map((url) => extractThreadIdFromMetaUrl(url))
      .find((id): id is string => Boolean(id)) ??
    normalizeOptionalText(input.sourceConversationId) ??
    normalizeOptionalText(input.externalThreadId);
  const autoPageId =
    normalizedMetaUrlCandidates
      .map((url) => extractFacebookPageId(url))
      .find((id): id is string => Boolean(id)) ?? normalizedPageId;
  const autoBusinessId =
    normalizedMetaUrlCandidates
      .map((url) => extractFacebookBusinessId(url))
      .find((id): id is string => Boolean(id)) ??
    normalizeOptionalText(normalizedBusinessId);

  const autoReplyTargetUrl =
    input.sourcePlatform === "facebook" &&
    normalizedSourceType === "facebook_messages" &&
    autoSelectedItemId
      ? buildFacebookBusinessInboxThreadUrl({
          selectedItemId: autoSelectedItemId,
          pageId: autoPageId,
          businessId: autoBusinessId,
          threadId: autoThreadId,
        })
      : null;

  const result = await createMetaTestConversationMessage({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    content: input.content,
    messageType: input.messageType,
    sourcePlatform: input.sourcePlatform,
    direction: input.direction,
    sourceType:
      input.sourceType ??
      getDefaultWebhookSourceType(input.sourcePlatform, input.messageType),
    sourceUrl: preferredBusinessInboxUrl ?? normalizedSourceUrl,
    replyTargetUrl:
      autoReplyTargetUrl ??
      preferredBusinessInboxUrl ??
      normalizedReplyTargetUrl,
    externalMessageId: input.externalMessageId,
    externalThreadId: preferredThreadId,
    externalPostId: input.externalPostId,
    externalCommentId: input.externalCommentId,
    originalTextExcerpt: input.originalTextExcerpt ?? input.content,
    authorLabel: input.authorLabel,
    attachments: input.attachments,
    messageKind: input.messageKind,
    receivedAt: input.receivedAt,
  });

  if (
    autoReplyTargetUrl &&
    contact?.id &&
    input.sourcePlatform === "facebook" &&
    normalizedSourceType === "facebook_messages"
  ) {
    await upsertAutoFacebookContactReplyTarget({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      url: autoReplyTargetUrl,
    });
  }

  await postgrestUpdate(
    "social_connections",
    { last_event_at: new Date().toISOString() },
    getServiceAccessToken(),
    [
      ["workspace_id", input.workspaceId],
      ["platform", input.sourcePlatform],
      ["status", "connected"],
    ],
  );

  return result;
}

export async function createMetaTestConversationMessage(input: {
  workspaceId: string;
  sourcePlatform?:
    | "facebook"
    | "instagram"
    | "whatsapp"
    | "tiktok"
    | "telegram";
  contactId: string;
  content: string;
  messageType: "dm" | "comment";
  sourceType?:
    | "facebook_messages"
    | "facebook_comments"
    | "instagram_messages"
    | "instagram_comments"
    | "whatsapp_messages"
    | "tiktok_comments"
    | "tiktok_messages"
    | "telegram_messages"
    | "dm"
    | "comment"
    | null;
  sourceUrl?: string | null;
  replyTargetUrl?: string | null;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  externalPostId?: string | null;
  externalCommentId?: string | null;
  originalTextExcerpt?: string | null;
  authorLabel?: string | null;
  attachments?: ConversationMessageAttachment[] | null;
  messageKind?: string | null;
  receivedAt?: string | null;
  direction?: "inbound" | "outbound";
}): Promise<ConversationMessageCreateResult> {
  const content = input.content.trim();

  if (!content) {
    return conversationMessageCreateError("Nachrichtentext ist erforderlich.");
  }

  const externalMessageId = normalizeOptionalText(input.externalMessageId);
  const externalCommentId = normalizeOptionalText(input.externalCommentId);
  const existing = await findExistingMetaConversationMessage({
    workspaceId: input.workspaceId,
    sourcePlatform: input.sourcePlatform ?? "facebook",
    externalMessageId,
    externalCommentId,
  });
  if (existing.error) {
    return conversationMessageCreateError(
      `Nachricht konnte nicht auf Duplikate geprüft werden: ${withOptionalSchemaHint(existing.error.message, "conversation_messages")}`,
    );
  }
  if (existing.message) {
    return { message: existing.message, conversation: null, error: null };
  }

  const receivedAt =
    normalizeIsoTimestamp(input.receivedAt) ?? new Date().toISOString();
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const replyTargetUrl = normalizeUrl(input.replyTargetUrl) ?? sourceUrl;
  const conversationResult = await ensureMetaTestConversation({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    sourcePlatform: input.sourcePlatform ?? "facebook",
    sourceType:
      input.sourceType ??
      getDefaultWebhookSourceType(
        input.sourcePlatform ?? "facebook",
        input.messageType,
      ),
    sourceUrl,
    replyTargetUrl,
    externalMessageId: input.externalMessageId,
    externalThreadId: input.externalThreadId,
  });

  if (conversationResult.error || !conversationResult.conversation) {
    return {
      message: null,
      conversation: null,
      error:
        conversationResult.error ??
        new Error("Conversation konnte nicht erstellt werden."),
    };
  }

  const messageResult = await postgrestRequest<ConversationMessageRow>(
    "conversation_messages",
    "POST",
    {
      workspace_id: input.workspaceId,
      conversation_id: conversationResult.conversation.id,
      contact_id: input.contactId,
      direction: input.direction ?? "inbound",
      message_type: input.messageType,
      source_platform: input.sourcePlatform ?? "facebook",
      source_url: sourceUrl,
      reply_target_url: replyTargetUrl,
      source_type: normalizeMessageType(input.sourceType ?? input.messageType),
      external_thread_id: normalizeOptionalText(input.externalThreadId),
      external_message_id: normalizeOptionalText(input.externalMessageId),
      external_post_id: normalizeOptionalText(input.externalPostId),
      external_comment_id: normalizeOptionalText(input.externalCommentId),
      original_author_label:
        normalizeOptionalText(input.authorLabel) ??
        getDefaultWebhookAuthorLabel(input.sourcePlatform ?? "facebook"),
      original_text_excerpt: normalizeExcerpt(
        input.originalTextExcerpt ?? content,
      ),
      author_label:
        normalizeOptionalText(input.authorLabel) ??
        getDefaultWebhookAuthorLabel(input.sourcePlatform ?? "facebook"),
      content,
      attachments: normalizeMessageAttachments(input.attachments),
      message_kind: normalizeMessageKind(
        input.messageKind,
        input.attachments,
        content,
      ),
      created_at: receivedAt,
      seen_at:
        (input.direction ?? "inbound") === "outbound" ? receivedAt : null,
    },
    getServiceAccessToken(),
    { select: CONVERSATION_MESSAGE_COLUMNS, single: true },
  );

  if (messageResult.error) {
    const concurrentDuplicate = await findExistingMetaConversationMessage({
      workspaceId: input.workspaceId,
      sourcePlatform: input.sourcePlatform ?? "facebook",
      externalMessageId,
      externalCommentId,
    });
    if (!concurrentDuplicate.error && concurrentDuplicate.message) {
      return {
        message: concurrentDuplicate.message,
        conversation: null,
        error: null,
      };
    }
    return conversationMessageCreateError(
      `Nachricht konnte nicht gespeichert werden: ${withOptionalSchemaHint(messageResult.error.message, "conversation_messages")}`,
    );
  }

  const updatedConversation = await postgrestUpdate<ConversationRow>(
    "conversations",
    {
      last_message_preview: content.slice(0, 240),
      ...((input.direction ?? "inbound") === "inbound"
        ? { last_inbound_at: receivedAt }
        : { last_outbound_at: receivedAt }),
      source_platform: input.sourcePlatform ?? "facebook",
      source_type: normalizeMessageType(input.sourceType ?? input.messageType),
      source_url: sourceUrl ?? conversationResult.conversation.source_url,
      reply_target_url:
        replyTargetUrl ?? conversationResult.conversation.reply_target_url,
      external_thread_id:
        normalizeOptionalText(input.externalThreadId) ??
        conversationResult.conversation.external_thread_id,
      external_message_id:
        normalizeOptionalText(input.externalMessageId) ??
        conversationResult.conversation.external_message_id,
      external_post_id:
        normalizeOptionalText(input.externalPostId) ??
        conversationResult.conversation.external_post_id,
      external_comment_id:
        normalizeOptionalText(input.externalCommentId) ??
        conversationResult.conversation.external_comment_id,
      original_author_label:
        normalizeOptionalText(input.authorLabel) ??
        conversationResult.conversation.original_author_label,
      original_text_excerpt:
        normalizeExcerpt(input.originalTextExcerpt ?? content) ??
        conversationResult.conversation.original_text_excerpt,
      status: "open",
      ai_status: "partial",
      next_step: "Antwort vorbereiten",
    },
    getServiceAccessToken(),
    [
      ["workspace_id", input.workspaceId],
      ["id", conversationResult.conversation.id],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  return {
    message: messageResult.data,
    conversation: updatedConversation.data ?? conversationResult.conversation,
    error: updatedConversation.error,
  };
}

async function findExistingMetaConversationMessage(input: {
  workspaceId: string;
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
  externalMessageId: string | null;
  externalCommentId: string | null;
}): Promise<{ message: ConversationMessageRow | null; error: Error | null }> {
  for (const [column, externalId] of [
    ["external_message_id", input.externalMessageId],
    ["external_comment_id", input.externalCommentId],
  ] as const) {
    if (!externalId) continue;
    const result = await postgrestSelect<ConversationMessageRow>(
      "conversation_messages",
      getServiceAccessToken(),
      CONVERSATION_MESSAGE_COLUMNS,
      [
        ["workspace_id", input.workspaceId],
        ["source_platform", input.sourcePlatform],
        [column, externalId],
      ],
      1,
      true,
    );
    if (result.error) return { message: null, error: result.error };
    if (result.data) return { message: result.data, error: null };
  }
  return { message: null, error: null };
}

async function ensureMetaTestConversation(input: {
  workspaceId: string;
  contactId: string;
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
  sourceType: string;
  sourceUrl?: string | null;
  replyTargetUrl?: string | null;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
}): Promise<ConversationResult> {
  const externalThreadId = normalizeOptionalText(input.externalThreadId);
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const replyTargetUrl = normalizeUrl(input.replyTargetUrl) ?? sourceUrl;

  if (externalThreadId) {
    const threaded = await postgrestSelect<ConversationRow>(
      "conversations",
      getServiceAccessToken(),
      CONVERSATION_COLUMNS,
      [
        ["workspace_id", input.workspaceId],
        ["contact_id", input.contactId],
        ["source_platform", input.sourcePlatform],
        ["external_thread_id", externalThreadId],
      ],
      1,
      true,
      "updated_at.desc",
    );

    if (threaded.error) {
      return conversationError(
        `Conversation konnte nicht geprüft werden: ${withOptionalSchemaHint(threaded.error.message, "conversations")}`,
      );
    }

    if (threaded.data) return { conversation: threaded.data, error: null };
  }

  const existing = await postgrestSelect<ConversationRow[]>(
    "conversations",
    getServiceAccessToken(),
    CONVERSATION_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
      ["source_platform", input.sourcePlatform],
    ],
    undefined,
    false,
    "updated_at.desc",
  );

  if (existing.error) {
    return conversationError(
      `Conversation konnte nicht geprüft werden: ${withOptionalSchemaHint(existing.error.message, "conversations")}`,
    );
  }

  const urlConversation = (existing.data ?? []).find(
    (conversation) =>
      ["open", "waiting"].includes(conversation.status) &&
      Boolean(sourceUrl || replyTargetUrl) &&
      (conversation.source_url === sourceUrl ||
        conversation.reply_target_url === replyTargetUrl ||
        conversation.source_url === replyTargetUrl ||
        conversation.reply_target_url === sourceUrl),
  );

  if (urlConversation) return { conversation: urlConversation, error: null };

  const openConversation = (existing.data ?? []).find(
    (conversation) =>
      ["open", "waiting"].includes(conversation.status) &&
      !conversation.external_thread_id &&
      conversation.source_type === normalizeMessageType(input.sourceType),
  );

  if (openConversation) return { conversation: openConversation, error: null };

  const created = await postgrestRequest<ConversationRow>(
    "conversations",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      status: "open",
      priority: "normal",
      source_platform: input.sourcePlatform,
      source_type: normalizeMessageType(input.sourceType),
      source_url: sourceUrl,
      reply_target_url: replyTargetUrl,
      external_thread_id: externalThreadId,
      external_message_id: normalizeOptionalText(input.externalMessageId),
      original_author_label: null,
      original_text_excerpt: null,
      ai_status: "partial",
      next_step: "Antwort vorbereiten",
    },
    getServiceAccessToken(),
    { select: CONVERSATION_COLUMNS, single: true },
  );

  if (created.error) {
    return conversationError(
      `Conversation konnte nicht erstellt werden: ${withOptionalSchemaHint(created.error.message, "conversations")}`,
    );
  }

  return { conversation: created.data, error: null };
}

function buildMetaThreadIdentifiers(input: {
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
  sourceType: string;
  externalThreadId?: string | null;
  sourceConversationId?: string | null;
  pageId?: string | null;
  senderId?: string | null;
}): string[] {
  const identifiers = new Set<string>();
  const explicitExternalThreadId = normalizeOptionalText(
    input.externalThreadId,
  );
  const sourceConversationId = normalizeOptionalText(
    input.sourceConversationId,
  );
  const pageId = normalizeOptionalText(input.pageId);
  const senderId = normalizeOptionalText(input.senderId);

  if (explicitExternalThreadId) identifiers.add(explicitExternalThreadId);
  if (sourceConversationId) identifiers.add(sourceConversationId);

  if (
    input.sourcePlatform === "facebook" &&
    input.sourceType === "facebook_messages" &&
    pageId &&
    senderId
  ) {
    identifiers.add(`${pageId}:${senderId}`);
  }

  return Array.from(identifiers);
}

async function findContactByThreadIdentifiers(input: {
  workspaceId: string;
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
  threadIdentifiers: string[];
}): Promise<{ contact: ContactRow | null; error: Error | null }> {
  for (const identifier of input.threadIdentifiers) {
    const byConversation = await postgrestSelect<ConversationRow>(
      "conversations",
      getServiceAccessToken(),
      CONVERSATION_COLUMNS,
      [
        ["workspace_id", input.workspaceId],
        ["source_platform", input.sourcePlatform],
        ["external_thread_id", identifier],
      ],
      1,
      true,
      "updated_at.desc",
    );

    if (byConversation.error) {
      return {
        contact: null,
        error: new Error(
          `Conversation-Mapping konnte nicht geprüft werden: ${withOptionalSchemaHint(byConversation.error.message, "conversations")}`,
        ),
      };
    }

    if (byConversation.data?.contact_id) {
      const contact = await getContactById(
        input.workspaceId,
        byConversation.data.contact_id,
      );
      if (contact.error) return contact;
      if (contact.contact) return contact;
    }

    const byMessage = await postgrestSelect<ConversationMessageRow>(
      "conversation_messages",
      getServiceAccessToken(),
      CONVERSATION_MESSAGE_COLUMNS,
      [
        ["workspace_id", input.workspaceId],
        ["source_platform", input.sourcePlatform],
        ["external_thread_id", identifier],
      ],
      1,
      true,
      "created_at.desc",
    );

    if (byMessage.error) {
      return {
        contact: null,
        error: new Error(
          `Nachrichten-Mapping konnte nicht geprüft werden: ${withOptionalSchemaHint(byMessage.error.message, "conversation_messages")}`,
        ),
      };
    }

    if (byMessage.data?.contact_id) {
      const contact = await getContactById(
        input.workspaceId,
        byMessage.data.contact_id,
      );
      if (contact.error) return contact;
      if (contact.contact) return contact;
    }
  }

  return { contact: null, error: null };
}

async function getContactById(
  workspaceId: string,
  contactId: string,
): Promise<{ contact: ContactRow | null; error: Error | null }> {
  const result = await postgrestSelect<ContactRow>(
    "contacts",
    getServiceAccessToken(),
    CONTACT_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["id", contactId],
    ],
    1,
    true,
  );

  if (result.error) {
    return {
      contact: null,
      error: new Error(
        `Kontakt konnte nicht geladen werden: ${result.error.message}`,
      ),
    };
  }

  return { contact: result.data, error: null };
}

async function findPreferredContactBySenderAlias(input: {
  workspaceId: string;
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
  senderId: string;
}): Promise<{ contact: ContactRow | null; error: Error | null }> {
  const contactsResult = await postgrestSelect<ContactRow[]>(
    "contacts",
    getServiceAccessToken(),
    CONTACT_COLUMNS,
    [
      ["workspace_id", input.workspaceId],
      ["source_platform", input.sourcePlatform],
    ],
    undefined,
    false,
    "updated_at.desc",
  );

  if (contactsResult.error) {
    return {
      contact: null,
      error: new Error(
        `Kontakt-Alias konnte nicht geprüft werden: ${contactsResult.error.message}`,
      ),
    };
  }

  const senderAlias = normalizeSenderAlias(input.senderId);
  if (!senderAlias) return { contact: null, error: null };

  const aliasMatches = (contactsResult.data ?? []).filter(
    (contact) => normalizeSenderAlias(contact.handle) === senderAlias,
  );
  if (!aliasMatches.length) return { contact: null, error: null };

  for (const match of aliasMatches) {
    const hasMessages = await contactHasConversationMessages({
      workspaceId: input.workspaceId,
      contactId: match.id,
      sourcePlatform: input.sourcePlatform,
    });
    if (hasMessages.error) return { contact: null, error: hasMessages.error };
    if (hasMessages.exists) return { contact: match, error: null };
  }

  return { contact: aliasMatches[0], error: null };
}

async function contactHasConversationMessages(input: {
  workspaceId: string;
  contactId: string;
  sourcePlatform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram";
}): Promise<{ exists: boolean; error: Error | null }> {
  const result = await postgrestSelect<{ id: string }>(
    "conversation_messages",
    getServiceAccessToken(),
    "id",
    [
      ["workspace_id", input.workspaceId],
      ["contact_id", input.contactId],
      ["source_platform", input.sourcePlatform],
    ],
    1,
    true,
    "created_at.desc",
  );

  if (result.error) {
    return {
      exists: false,
      error: new Error(
        `Kontakt-Nachrichten konnten nicht geprüft werden: ${result.error.message}`,
      ),
    };
  }

  return { exists: Boolean(result.data), error: null };
}

function normalizeSenderAlias(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

export async function updateConversationStatus(input: {
  workspaceId: string;
  conversationId: string;
  status: ConversationStatus;
  nextStep?: string | null;
}): Promise<ConversationUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const now = new Date().toISOString();
  const values: Record<string, string | null> = {
    status: input.status,
    updated_at: now,
  };

  if (input.nextStep !== undefined) {
    values.next_step = normalizeOptionalText(input.nextStep);
  }

  const result = await postgrestUpdate<ConversationRow>(
    "conversations",
    values,
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.conversationId],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  if (result.error) {
    return conversationUpdateError(
      `Conversation-Status konnte nicht gespeichert werden: ${withOptionalSchemaHint(result.error.message, "conversations")}`,
    );
  }

  return { conversation: result.data, error: null };
}

export async function updateConversationPriority(input: {
  workspaceId: string;
  conversationId: string;
  priority: ConversationPriority;
}): Promise<ConversationUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const result = await postgrestUpdate<ConversationRow>(
    "conversations",
    { priority: input.priority, updated_at: new Date().toISOString() },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.conversationId],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  if (result.error) {
    return conversationUpdateError(
      `Conversation-Priorität konnte nicht gespeichert werden: ${withOptionalSchemaHint(result.error.message, "conversations")}`,
    );
  }

  return { conversation: result.data, error: null };
}

export async function claimConversationAssignment(input: {
  workspaceId: string;
  conversationId: string;
  assignedUserId: string;
  assignedOwner: string;
}): Promise<ConversationUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const assignedOwner = normalizeOptionalText(input.assignedOwner);
  const assignedUserId = normalizeOptionalText(input.assignedUserId);
  if (!assignedOwner || !assignedUserId) {
    return conversationUpdateError("Conversation-Zuweisung ist unvollständig.");
  }
  const result = await postgrestUpdate<ConversationRow>(
    "conversations",
    {
      assigned_owner: assignedOwner,
      assigned_user_id: assignedUserId,
      updated_at: new Date().toISOString(),
    },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.conversationId],
      ["assigned_user_id", null],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  if (result.error) {
    return conversationUpdateError(
      `Conversation-Zuweisung konnte nicht gespeichert werden: ${withOptionalSchemaHint(result.error.message, "conversations")}`,
    );
  }

  if (!result.data) {
    return conversationUpdateError(
      "Conversation wurde zwischenzeitlich bereits übernommen.",
    );
  }

  return { conversation: result.data, error: null };
}

export async function releaseConversationAssignment(input: {
  workspaceId: string;
  conversationId: string;
  assignedUserId: string;
}): Promise<ConversationUpdateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationUpdateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const assignedUserId = normalizeOptionalText(input.assignedUserId);
  if (!assignedUserId) {
    return conversationUpdateError("Conversation-Zuweisung ist unvollständig.");
  }

  const result = await postgrestUpdate<ConversationRow>(
    "conversations",
    {
      assigned_owner: null,
      assigned_user_id: null,
      updated_at: new Date().toISOString(),
    },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.conversationId],
      ["assigned_user_id", assignedUserId],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  if (result.error) {
    return conversationUpdateError(
      `Conversation-Zuweisung konnte nicht freigegeben werden: ${withOptionalSchemaHint(result.error.message, "conversations")}`,
    );
  }

  if (!result.data) {
    return conversationUpdateError(
      "Nur die aktuell zugewiesene Person darf diese Conversation freigeben.",
    );
  }

  return { conversation: result.data, error: null };
}

export async function saveReplyDraftAsNote(input: {
  workspaceId: string;
  conversationId: string;
  contactId: string;
  content: string;
}): Promise<ConversationMessageCreateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return conversationMessageCreateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const content = input.content.trim();

  if (!content) {
    return conversationMessageCreateError("Antwortentwurf ist erforderlich.");
  }

  const messageResult = await postgrestRequest<ConversationMessageRow>(
    "conversation_messages",
    "POST",
    {
      workspace_id: input.workspaceId,
      conversation_id: input.conversationId,
      contact_id: input.contactId,
      direction: "note",
      message_type: "note",
      source_platform: "manual",
      author_label: "Antwortentwurf",
      content,
    },
    accessToken,
    { select: CONVERSATION_MESSAGE_COLUMNS, single: true },
  );

  if (messageResult.error) {
    return conversationMessageCreateError(
      `Antwortentwurf konnte nicht gespeichert werden: ${withOptionalSchemaHint(messageResult.error.message, "conversation_messages")}`,
    );
  }

  const updatedConversation = await postgrestUpdate<ConversationRow>(
    "conversations",
    {
      last_message_preview: "Antwortentwurf gespeichert",
      ai_status: content.length > 20 ? "ready" : "partial",
      next_step: "Im Originalkanal manuell senden",
      updated_at: new Date().toISOString(),
    },
    accessToken,
    [
      ["workspace_id", input.workspaceId],
      ["id", input.conversationId],
      ["contact_id", input.contactId],
    ],
    { select: CONVERSATION_COLUMNS, single: true },
  );

  return {
    message: messageResult.data,
    conversation: updatedConversation.data,
    error: updatedConversation.error,
  };
}

export async function getContactFollowups(
  workspaceId: string,
  contactId: string,
): Promise<FollowupsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return followupsError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const followupsResult = await postgrestSelect<FollowupRow[]>(
    "followups",
    accessToken,
    FOLLOWUP_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contactId],
    ],
    undefined,
    false,
    "created_at.desc",
  );

  if (followupsResult.error) {
    return followupsError(
      `Follow-ups konnten nicht geladen werden: ${withOptionalSchemaHint(followupsResult.error.message, "followups")}`,
    );
  }

  return { followups: followupsResult.data ?? [], error: null };
}

export async function createContactFollowup(
  input: CreateFollowupInput,
): Promise<FollowupCreateResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return followupCreateError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const reason = input.reason.trim();

  if (!reason) {
    return followupCreateError("Follow-up-Grund ist erforderlich.");
  }

  const followupResult = await postgrestRequest<FollowupRow>(
    "followups",
    "POST",
    {
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      due_date: normalizeOptionalText(input.dueDate),
      priority: normalizeOptionalText(input.priority) ?? "normal",
      reason,
      status: normalizeOptionalText(input.status) ?? "open",
    },
    accessToken,
    { select: FOLLOWUP_COLUMNS, single: true },
  );

  if (followupResult.error) {
    return followupCreateError(
      `Follow-up konnte nicht gespeichert werden: ${withOptionalSchemaHint(followupResult.error.message, "followups")}`,
    );
  }

  return { followup: followupResult.data, error: null };
}

export async function getOpenFollowupCount(
  workspaceId: string,
): Promise<FollowupCountResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      count: 0,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  }

  const countResult = await postgrestCount("followups", accessToken, [
    ["workspace_id", workspaceId],
    ["status", "open"],
  ]);

  if (countResult.error) {
    return {
      count: 0,
      error: new Error(
        `Offene Follow-ups konnten nicht gezählt werden: ${withOptionalSchemaHint(countResult.error.message, "followups")}`,
      ),
    };
  }

  return { count: countResult.count, error: null };
}

export async function getFollowupCompletionCounts(
  workspaceId: string,
): Promise<FollowupCompletionCountsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      open: 0,
      completed: 0,
      error: new Error(
        "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
      ),
    };
  }

  const [openResult, completedResult, legacyDoneResult] = await Promise.all([
    postgrestCount("followups", accessToken, [
      ["workspace_id", workspaceId],
      ["status", "open"],
    ]),
    postgrestCount("followups", accessToken, [
      ["workspace_id", workspaceId],
      ["status", "completed"],
    ]),
    postgrestCount("followups", accessToken, [
      ["workspace_id", workspaceId],
      ["status", "done"],
    ]),
  ]);
  const error =
    openResult.error ?? completedResult.error ?? legacyDoneResult.error;

  if (error) {
    return {
      open: 0,
      completed: 0,
      error: new Error(
        `Follow-up-Abschlussquote konnte nicht geladen werden: ${withOptionalSchemaHint(error.message, "followups")}`,
      ),
    };
  }

  return {
    open: openResult.count,
    completed: completedResult.count + legacyDoneResult.count,
    error: null,
  };
}

export async function getWorkspaceOpenFollowups(
  workspaceId: string,
): Promise<FollowupsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return followupsError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const followupsResult = await postgrestSelect<FollowupRow[]>(
    "followups",
    accessToken,
    FOLLOWUP_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["status", "open"],
    ],
    undefined,
    false,
    "due_date.asc.nullslast,created_at.desc",
  );

  if (followupsResult.error) {
    return followupsError(
      `Follow-ups konnten nicht geladen werden: ${withOptionalSchemaHint(followupsResult.error.message, "followups")}`,
    );
  }

  return { followups: followupsResult.data ?? [], error: null };
}



export async function getWorkspaceFollowups(
  workspaceId: string,
  status?: string,
): Promise<FollowupsResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return followupsError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const normalizedStatus = status === "done" ? "completed" : status;
  const filters: Array<[string, string]> = [["workspace_id", workspaceId]];
  if (normalizedStatus && normalizedStatus !== "completed") {
    filters.push(["status", normalizedStatus]);
  }

  const followupsResult = await postgrestSelect<FollowupRow[]>(
    "followups",
    accessToken,
    FOLLOWUP_COLUMNS,
    filters,
    undefined,
    false,
    "due_date.asc.nullslast,created_at.desc",
  );

  if (followupsResult.error) {
    return followupsError(
      `Follow-ups konnten nicht geladen werden: ${withOptionalSchemaHint(followupsResult.error.message, "followups")}`,
    );
  }

  const followups = followupsResult.data ?? [];
  if (normalizedStatus === "completed") {
    return {
      followups: followups.filter(
        (followup) =>
          followup.status === "completed" || followup.status === "done",
      ),
      error: null,
    };
  }

  return { followups, error: null };
}

export async function createTemporaryDemoWorkspace(input: {
  userId: string;
  userEmail: string;
  expiresAt: Date;
  locale?: FanMindLanguage;
}): Promise<WorkspaceBackfillResult> {
  const locale = input.locale ?? "de";
  const accessToken = getServiceAccessToken();
  if (!accessToken) return workspaceBackfillError("SUPABASE_SERVICE_ROLE_KEY ist serverseitig nicht konfiguriert.");

  const workspaceResult = await postgrestRequest<WorkspaceBackfillRow>(
    "workspaces",
    "POST",
    {
      ...temporaryDemoCanonicalValues(input.userId, input.expiresAt),
      owner_user_id: input.userId,
    },
    accessToken,
    { select: WORKSPACE_COLUMNS, single: true },
  );
  if (workspaceResult.error || !workspaceResult.data) {
    return workspaceBackfillError(workspaceResult.error?.message ?? "Demo-Workspace konnte nicht angelegt werden.");
  }

  const profileResult = await postgrestRequest("profiles", "POST", {
    id: input.userId,
    email: input.userEmail,
    display_name: locale === "en" ? "Demo User" : "Demo Nutzer",
  }, accessToken, { upsert: true });
  if (profileResult.error) {
    return {
      workspace: workspaceResult.data,
      error: profileResult.error,
      created: true,
    };
  }

  const memberResult = await postgrestRequest("workspace_members", "POST", {
    workspace_id: workspaceResult.data.id,
    user_id: input.userId,
    role: "owner",
  }, accessToken);
  if (memberResult.error) {
    return {
      workspace: workspaceResult.data,
      error: memberResult.error,
      created: true,
    };
  }

  const seedError = await seedSandraDemoWorkspaceData(workspaceResult.data, accessToken, locale);
  if (seedError) {
    return {
      workspace: workspaceResult.data,
      error: seedError,
      created: true,
    };
  }

  return { workspace: workspaceResult.data, error: null, created: true };
}

async function normalizeTemporaryDemoWorkspace(
  user: SupabaseServerUser,
  workspace: WorkspaceBackfillRow,
): Promise<WorkspaceBackfillResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return workspaceBackfillError(
      "Der temporäre Demo-Workspace kann ohne serverseitige Service Role nicht geprüft werden.",
    );
  }

  if (
    workspace.owner_user_id !== user.id ||
    !isServerBoundTemporaryDemoWorkspace(workspace)
  ) {
    return workspaceBackfillError(
      "Temporärer Demo-Workspace konnte nicht eindeutig zugeordnet werden.",
    );
  }

  const sessionResult = await postgrestSelect<DemoStartSessionEntitlementRow[]>(
    "demo_start_sessions",
    serviceAccessToken,
    "id,status,expires_at,auth_user_id,workspace_id",
    [
      ["auth_user_id", user.id],
      ["workspace_id", workspace.id],
    ],
    2,
    false,
  );
  const session = sessionResult.data?.[0];
  const sessionExpiry = new Date(session?.expires_at ?? "");
  const now = Date.now();
  const sessionIdentityMatches =
    !sessionResult.error &&
    sessionResult.data?.length === 1 &&
    session?.status === "active" &&
    session.auth_user_id === user.id &&
    session.workspace_id === workspace.id &&
    Number.isFinite(sessionExpiry.getTime());
  if (sessionIdentityMatches && sessionExpiry.getTime() <= now) {
    return workspaceBackfillError(TEMPORARY_DEMO_EXPIRED_ERROR);
  }
  if (
    !sessionIdentityMatches ||
    sessionExpiry.getTime() > now + TEMPORARY_DEMO_MAX_FUTURE_EXPIRY_MS
  ) {
    return workspaceBackfillError(
      sessionResult.error?.message ??
        "Temporärer Demo-Workspace besitzt keine aktive serverseitige Start-Zuordnung.",
    );
  }

  const workspaceUpdate = await postgrestUpdate<WorkspaceBackfillRow>(
    "workspaces",
    temporaryDemoCanonicalValues(user.id, sessionExpiry),
    serviceAccessToken,
    [["id", workspace.id]],
    { select: WORKSPACE_COLUMNS, single: true },
  );
  if (workspaceUpdate.error || !workspaceUpdate.data) {
    return workspaceBackfillError(
      workspaceUpdate.error?.message ??
        "Temporärer Demo-Workspace konnte nicht normalisiert werden.",
    );
  }

  return {
    workspace: workspaceUpdate.data,
    error: null,
    created: false,
  };
}

async function ensureFixedSandraDemoWorkspace(
  user: SupabaseServerUser,
): Promise<WorkspaceBackfillResult> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) {
    return workspaceBackfillError(
      "Der feste Demo-Workspace kann ohne serverseitige Service Role nicht vorbereitet werden.",
    );
  }

  const existingResult = await postgrestSelect<WorkspaceBackfillRow[]>(
    "workspaces",
    serviceAccessToken,
    WORKSPACE_COLUMNS,
    [["owner_user_id", user.id]],
    2,
    false,
  );
  if (existingResult.error) {
    return workspaceBackfillError(
      `Demo-Workspace konnte nicht gesucht werden: ${existingResult.error.message}`,
    );
  }

  const existingRows = existingResult.data ?? [];
  if (existingRows.length > 1) {
    return workspaceBackfillError(
      "Demo-Workspace konnte nicht eindeutig zugeordnet werden.",
    );
  }

  const seedIsCurrent =
    existingRows[0]?.test_access_flags?.[FIXED_DEMO_SEED_VERSION_FLAG] ===
    FIXED_DEMO_SEED_VERSION;
  const fixedSeedFlags: Record<string, boolean | string> = seedIsCurrent
    ? { [FIXED_DEMO_SEED_VERSION_FLAG]: FIXED_DEMO_SEED_VERSION }
    : {};
  const canonicalValues = {
    name: DEMO_WORKSPACE_NAME,
    plan_id: "pilot",
    commercial_option: "pilot_only",
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    commitment_months: 0,
    ...demoProtectedCanonicalValues(user.id, fixedSeedFlags),
  };

  let workspace = existingRows[0] ?? null;
  let created = false;

  if (workspace) {
    const workspaceUpdate = await postgrestUpdate<WorkspaceBackfillRow>(
      "workspaces",
      canonicalValues,
      serviceAccessToken,
      [["id", workspace.id]],
      { select: WORKSPACE_COLUMNS, single: true },
    );
    if (workspaceUpdate.error || !workspaceUpdate.data) {
      return workspaceBackfillError(
        workspaceUpdate.error?.message ??
          "Demo-Workspace konnte nicht normalisiert werden.",
      );
    }
    workspace = workspaceUpdate.data;
  } else {
    const workspaceInsert = await postgrestRequest<WorkspaceBackfillRow>(
      "workspaces",
      "POST",
      {
        ...canonicalValues,
        id: deterministicFixedDemoWorkspaceId(user.id),
        owner_user_id: user.id,
      },
      serviceAccessToken,
      { select: WORKSPACE_COLUMNS, single: true },
    );
    if (workspaceInsert.error || !workspaceInsert.data) {
      const concurrentResult = await postgrestSelect<WorkspaceBackfillRow[]>(
        "workspaces",
        serviceAccessToken,
        WORKSPACE_COLUMNS,
        [["owner_user_id", user.id]],
        2,
        false,
      );
      const concurrentRows = concurrentResult.data ?? [];
      if (
        concurrentResult.error ||
        concurrentRows.length !== 1
      ) {
        return workspaceBackfillError(
          workspaceInsert.error?.message ??
            concurrentResult.error?.message ??
            "Demo-Workspace konnte nicht angelegt werden.",
        );
      }

      const concurrentUpdate = await postgrestUpdate<WorkspaceBackfillRow>(
        "workspaces",
        canonicalValues,
        serviceAccessToken,
        [["id", concurrentRows[0].id]],
        { select: WORKSPACE_COLUMNS, single: true },
      );
      if (concurrentUpdate.error || !concurrentUpdate.data) {
        return workspaceBackfillError(
          concurrentUpdate.error?.message ??
            "Parallel angelegter Demo-Workspace konnte nicht normalisiert werden.",
        );
      }
      workspace = concurrentUpdate.data;
    } else {
      workspace = workspaceInsert.data;
      created = true;
    }
  }

  const memberResult = await postgrestRequest(
    "workspace_members",
    "POST",
    {
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    },
    serviceAccessToken,
    {
      upsert: true,
      onConflict: "workspace_id,user_id",
    },
  );
  if (memberResult.error) {
    return workspaceBackfillError(
      `Demo-Workspace-Mitgliedschaft konnte nicht vorbereitet werden: ${memberResult.error.message}`,
    );
  }

  if (!seedIsCurrent) {
    const seedError = await seedSandraDemoWorkspaceData(
      workspace,
      serviceAccessToken,
      "de",
    );
    if (seedError) {
      return workspaceBackfillError(
        `Demo-Workspace konnte nicht vorbereitet werden: ${seedError.message}`,
      );
    }

    const seedMarkerUpdate = await postgrestUpdate<WorkspaceBackfillRow>(
      "workspaces",
      {
        test_access_flags: {
          [FIXED_DEMO_SEED_VERSION_FLAG]: FIXED_DEMO_SEED_VERSION,
        },
        billing_updated_at: new Date().toISOString(),
        billing_updated_by_user_id: user.id,
      },
      serviceAccessToken,
      [["id", workspace.id]],
      { select: WORKSPACE_COLUMNS, single: true },
    );
    if (seedMarkerUpdate.error || !seedMarkerUpdate.data) {
      return workspaceBackfillError(
        seedMarkerUpdate.error?.message ??
          "Demo-Seed konnte nicht als vollständig markiert werden.",
      );
    }
    workspace = seedMarkerUpdate.data;
  }

  return { workspace, error: null, created };
}

type DemoFanSeed = {
  displayName: string;
  handle: string;
  platform: string;
  tags: string[];
  summary: string;
  notes?: string;
  memory: string;
  followup?: { priority: string; reason: string; daysFromNow: number };
  conversation: { direction: "inbound" | "outbound"; text: string; platform?: string; sourceType?: string; messageType?: string }[];
  locale?: FanMindLanguage;
};

const sandraConversation: DemoFanSeed["conversation"] = [
  ["inbound", "Hallo liebes FanMind-Team, ich habe das Sommer-Event gesehen. Gibt es für Member noch Early-Bird-Plätze?"],
  ["outbound", "Hallo Sandra, ja, aktuell sind noch wenige Early-Bird-Plätze für Member verfügbar. Schön, dass du dabei sein möchtest!"],
  ["inbound", "Super, danke! Ich war letztes Jahr beim kleinen Workshop dabei und fand die Atmosphäre richtig gut."],
  ["outbound", "Das freut uns sehr. Dieses Jahr ist das Event größer, aber weiterhin persönlich gehalten – inklusive Member-Check-in und kurzer Welcome-Session."],
  ["inbound", "Was ist denn genau im Member-Vorteil enthalten? Nur der niedrigere Preis oder noch mehr?"],
  ["outbound", "Neben dem Early-Bird-Preis bekommst du bevorzugten Einlass, Zugang zur Member-Lounge und eine kleine Q&A-Runde nach dem Hauptprogramm."],
  ["inbound", "Das klingt interessant. Wie viel kostet der Early-Bird aktuell?"],
  ["outbound", "Für Member liegt der Early-Bird aktuell bei 89 €. Der reguläre Preis danach liegt voraussichtlich bei 119 €."],
  ["inbound", "Okay. Kann ich eine Begleitperson mitnehmen, die noch kein Member ist?"],
  ["outbound", "Ja, das geht. Für Begleitpersonen können wir ebenfalls einen Platz reservieren; der Member-Vorteil gilt aber nur für deinen eigenen Platz."],
  ["inbound", "Verstehe. Meine Freundin überlegt noch, sie kennt das Format nicht."],
  ["outbound", "Kein Problem. Wir können ihr gern kurz erklären, wie der Abend abläuft: Empfang, Impuls, Austausch und danach optionales Networking."],
  ["inbound", "Wie viele Plätze sind denn insgesamt noch frei? Ich möchte ungern zu lange warten."],
  ["outbound", "Stand jetzt sind noch einige Plätze frei, aber das Early-Bird-Kontingent ist begrenzt. Wir empfehlen eine Reservierung, wenn du sicher teilnehmen möchtest."],
  ["inbound", "Kann man reservieren, ohne sofort komplett zu buchen?"],
  ["outbound", "Wir können dir den Platz kurz vormerken und dir dann den Buchungslink schicken. Die Buchung wird erst final, wenn du sie bestätigst."],
  ["inbound", "Das wäre gut. Ich muss heute Abend nur noch mit meiner Freundin sprechen."],
  ["outbound", "Sehr gern. Soll ich dir die wichtigsten Infos für sie kurz zusammenfassen?"],
  ["inbound", "Ja bitte, vor allem Uhrzeit, Ablauf und ob man jemanden kennen muss."],
  ["outbound", "Start ist 18:30 Uhr, Einlass ab 18:00 Uhr. Man muss niemanden kennen – viele kommen mit Begleitung oder allein, und wir achten auf einen angenehmen Einstieg."],
  ["inbound", "Das klingt beruhigend. Gibt es einen Dresscode?"],
  ["outbound", "Nein, kein strenger Dresscode. Smart casual passt, aber komm so, wie du dich wohlfühlst."],
  ["inbound", "Perfekt. Gibt es beim Early-Bird eine Deadline?"],
  ["outbound", "Die Deadline ist entweder Ende der Woche oder sobald das Kontingent voll ist – je nachdem, was zuerst eintritt."],
  ["inbound", "Ah okay, dann sollte ich wahrscheinlich nicht zu lange warten."],
  ["outbound", "Genau. Wir machen aber keinen Druck; wichtig ist, dass es für dich und deine Freundin gut passt."],
  ["inbound", "Kann ich zwei Plätze nebeneinander buchen oder ist das freie Platzwahl?"],
  ["outbound", "Es ist freie Platzwahl, aber wenn ihr zusammen kommt, könnt ihr selbstverständlich zusammen sitzen."],
  ["inbound", "Gibt es nach der Buchung eine Bestätigung per Mail?"],
  ["outbound", "Ja, direkt nach der Buchung erhältst du eine Bestätigung mit allen Details und dem Kalendereintrag."],
  ["inbound", "Sehr gut. Kannst du mir bitte den Link schicken und vielleicht dazuschreiben, ob zwei Plätze heute noch realistisch sind?"],
  ["outbound", "Natürlich. Ich prüfe kurz den aktuellen Stand und schicke dir dann den passenden Buchungslink mit einer klaren Empfehlung."],
  ["inbound", "Danke dir! Wenn noch zwei Early-Bird-Plätze verfügbar sind, würde ich wahrscheinlich heute buchen."],
  ["outbound", "Sehr gern, Sandra. Ich halte dir die Infos kompakt und transparent, damit du heute Abend gut entscheiden kannst."],
  ["inbound", "Eine letzte Frage: Falls meine Freundin absagt, kann ich meinen Platz trotzdem behalten und allein kommen?"],
  ["outbound", "Ja, absolut. Dein Platz ist unabhängig von ihrer Entscheidung. Du kannst allein kommen oder später noch eine Begleitperson ergänzen, solange Plätze frei sind."],
  ["inbound", "Perfekt. Dann schick mir bitte den Link und sag kurz, ob ich lieber direkt einen oder zwei Plätze sichern soll."],
].map(([direction, text]) => ({ direction: direction as "inbound" | "outbound", text }));

const demoFanSeeds: DemoFanSeed[] = [
  { displayName: "Sandra M.", handle: DEMO_CONTACT_HANDLE, platform: "facebook", tags: ["Demo", "VIP", "Sommer-Event"], summary: "Demo-Kontakt mit Interesse am Sommer-Event, Early-Bird-Plätzen und Member-Angeboten.", notes: "Sandra ist kaufnah, möchte aber eine Begleitperson einbeziehen. Wichtig: klare Verfügbarkeit, Link und freundliche Empfehlung.", memory: "Sandra interessiert sich besonders für Early-Bird-Plätze, Member-Vorteile und eine unkomplizierte Teilnahme mit Begleitperson beim Sommer-Event.", followup: { priority: "high", reason: "Sandra M. Buchungslink und klare Empfehlung zu ein oder zwei Early-Bird-Plätzen senden.", daysFromNow: 1 }, conversation: sandraConversation },
  { displayName: "Markus T.", handle: "@markus_fitness", platform: "instagram", tags: ["Demo", "Preisfrage", "Instagram"], summary: "Direkter Instagram-Fan mit Preis- und VIP-Frage, entscheidet gern schnell.", memory: "Markus bevorzugt kurze, klare Antworten mit Preis, Verfügbarkeit und konkretem nächsten Schritt.", followup: { priority: "medium", reason: "Markus Preis und VIP-Verfügbarkeit knapp beantworten.", daysFromNow: 2 }, conversation: [
    { direction: "inbound", text: "Hey, was kostet der VIP-Zugang fürs Sommer-Event?" }, { direction: "outbound", text: "Hi Markus, der VIP-Zugang liegt aktuell bei 149 € inklusive bevorzugtem Einlass und Q&A." }, { direction: "inbound", text: "Noch Plätze frei oder schon voll?" }, { direction: "outbound", text: "Aktuell sind noch wenige VIP-Plätze frei. Das Kontingent ist aber kleiner als beim Standardticket." }, { direction: "inbound", text: "Brauche keine lange Erklärung, nur ob sich VIP lohnt." }, { direction: "outbound", text: "Wenn dir kurzer Zugang zum Team, bessere Planung und Q&A wichtig sind, lohnt sich VIP. Wenn du nur das Hauptprogramm willst, reicht Standard." }, { direction: "inbound", text: "Okay. Kann ich heute buchen und später Namen ändern?" }, { direction: "outbound", text: "Ja, eine Namensänderung ist bis kurz vor dem Event möglich." }, { direction: "inbound", text: "Dann schick mir bitte Preis + Link. Wenn VIP noch verfügbar ist, entscheide ich heute." },
  ] },
  { displayName: "Julia K.", handle: "+43-demo-julia", platform: "whatsapp", tags: ["Demo", "Unsicher", "Beratung", "Multi-Channel"], summary: "Vorsichtige Interessentin, möchte mit Freundin kommen und braucht Sicherheit zum Ablauf.", notes: "Julia nicht drängen. Sicherheit, Ablauf und freundliche Einladung betonen.", memory: "Julia braucht vor einer Buchung Vertrauen, einen klaren Ablauf und die Bestätigung, dass Teilnahme auch ohne Vorkenntnisse angenehm ist.", conversation: [
    { direction: "inbound", text: "Hallo, ich überlege zum Sommer-Event zu kommen, bin aber noch unsicher." }, { direction: "outbound", text: "Hallo Julia, danke für deine Nachricht. Was macht dich denn unsicher? Dann kann ich gezielt helfen." }, { direction: "inbound", text: "Ich kenne dort niemanden und würde vielleicht eine Freundin mitnehmen." }, { direction: "outbound", text: "Das passt sehr gut. Viele kommen zu zweit oder allein, und der Einstieg ist bewusst locker gestaltet." }, { direction: "inbound", text: "Ist das eher laut und voll oder kann man auch in Ruhe ankommen?" }, { direction: "outbound", text: "Es gibt einen ruhigen Check-in und genug Zeit zum Ankommen. Niemand muss sofort netzwerken." }, { direction: "inbound", text: "Okay, das beruhigt mich. Gibt es vorher genaue Infos zum Ablauf?" }, { direction: "outbound", text: "Ja, nach der Anmeldung bekommst du eine Mail mit Uhrzeit, Ablauf, Adresse und Ansprechpartner vor Ort." }, { direction: "inbound", text: "Hi, ich habe euch auf Instagram gesehen. Ist das Sommer-Event auch geeignet, wenn man noch nie bei euch war?", platform: "instagram" }, { direction: "outbound", text: "Hallo Julia, ja, absolut. Wir erklären den Ablauf vor Ort und du musst niemanden kennen, um gut reinzukommen.", platform: "instagram" }, { direction: "inbound", text: "Hallo FanMind-Team, ich überlege, mit einer Freundin teilzunehmen. Können Sie mir kurz sagen, ob man zusammen sitzen kann und wie lange die Reservierung gilt?", platform: "email", sourceType: "email", messageType: "email" }, { direction: "inbound", text: "Kannst du mir kurz sagen, ob das auch geeignet ist, wenn man noch nie bei euch war? Ich will meine Freundin nicht überreden, wenn es dann zu viel wird." },
  ] },
  { displayName: "Alex R.", handle: "alex.demo@example.com", platform: "email", tags: ["Demo", "Support", "Kritisch"], summary: "Sachlicher Support-Fall mit Umbuchungsfrage und leicht kritischem Ton.", memory: "Alex erwartet verbindliche, lösungsorientierte Antworten mit konkreter nächster Aktion und ohne Marketing-Floskeln.", conversation: [
    { direction: "inbound", text: "Guten Tag, ich habe mein Ticket gebucht, kann aber an dem Termin wahrscheinlich nicht teilnehmen." }, { direction: "outbound", text: "Guten Tag Alex, danke für die Info. Wir prüfen gern, welche Umbuchungsoptionen möglich sind." }, { direction: "inbound", text: "In der Bestätigung war das für mich nicht eindeutig. Gibt es eine klare Regel?" }, { direction: "outbound", text: "Eine Umbuchung ist je nach Verfügbarkeit möglich. Wir benötigen dafür die Buchungsnummer und den gewünschten Alternativtermin." }, { direction: "inbound", text: "Ich finde es ehrlich gesagt etwas umständlich, dass das nicht direkt im Kundenbereich geht." }, { direction: "outbound", text: "Das verstehe ich. Wir nehmen das als Feedback mit und lösen deinen Fall jetzt manuell möglichst unkompliziert." }, { direction: "inbound", text: "Meine Buchungsnummer ist DEMO-4821. Bitte sagen Sie mir konkret, ob eine Umbuchung möglich ist und ob Kosten entstehen." },
  ] },
];


const englishDemoFanSeeds: DemoFanSeed[] = [
  { displayName: "Sandra M.", handle: DEMO_CONTACT_HANDLE, platform: "facebook", locale: "en", tags: ["Demo", "VIP", "Summer Event"], summary: "Demo contact interested in the summer event, early-bird seats, and member benefits.", notes: "Sandra is close to booking but wants to involve a friend. Important: clear availability, link, and a friendly recommendation.", memory: "Sandra is especially interested in early-bird seats, member benefits, and attending the summer event with a friend.", followup: { priority: "high", reason: "Follow up with Sandra M. about the booking link and whether one or two early-bird seats are still realistic.", daysFromNow: 1 }, conversation: [
    { direction: "inbound", text: "Hi FanMind team, I saw the summer event. Are there still early-bird seats for members?" },
    { direction: "outbound", text: "Hi Sandra, yes, a few early-bird member seats are still available. Great that you are interested!" },
    { direction: "inbound", text: "Thanks! I joined the smaller workshop last year and really liked the atmosphere." },
    { direction: "outbound", text: "Lovely to hear. This year is a bit bigger but still personal, with member check-in and a short welcome session." },
    { direction: "inbound", text: "What exactly is included in the member benefit? Just the lower price or more?" },
    { direction: "outbound", text: "Besides the early-bird price, you get priority entry, access to the member lounge, and a short Q&A after the main program." },
    { direction: "inbound", text: "Sounds interesting. Can I bring a friend who is not a member yet?" },
    { direction: "outbound", text: "Yes, that works. We can reserve a seat for your friend too; the member benefit applies to your own seat." },
    { direction: "inbound", text: "Please send me the link and tell me whether booking two seats today still makes sense." },
  ] },
  { displayName: "Markus T.", handle: "@markus_fitness", platform: "instagram", locale: "en", tags: ["Demo", "Pricing question", "Instagram"], summary: "Direct Instagram fan with pricing and VIP questions who prefers quick decisions.", memory: "Markus prefers short, clear replies with price, availability, and a concrete next step.", followup: { priority: "medium", reason: "Reply briefly to Markus with price and VIP availability.", daysFromNow: 2 }, conversation: [
    { direction: "inbound", text: "Hey, how much is VIP access for the summer event?" }, { direction: "outbound", text: "Hi Markus, VIP access is currently 149 € including priority entry and Q&A." }, { direction: "inbound", text: "Any seats left or sold out?" }, { direction: "outbound", text: "There are still a few VIP seats available, but the allocation is smaller than standard tickets." }, { direction: "inbound", text: "No long explanation needed, just whether VIP is worth it." }, { direction: "outbound", text: "If direct team access, smoother planning, and Q&A matter to you, VIP is worth it. If you only want the main program, standard is enough." }, { direction: "inbound", text: "Send price + link. If VIP is still available, I will decide today." },
  ] },
  { displayName: "Julia K.", handle: "+43-demo-julia", platform: "whatsapp", locale: "en", tags: ["Demo", "Unsure", "Consultation", "Multi-channel"], summary: "Careful prospect who wants to come with a friend and needs reassurance about the format.", notes: "Do not pressure Julia. Emphasize safety, flow, and a friendly invitation.", memory: "Julia needs trust, a clear agenda, and reassurance that the event is comfortable for newcomers.", conversation: [
    { direction: "inbound", text: "Hi, I am thinking about coming to the summer event, but I am still unsure." }, { direction: "outbound", text: "Hi Julia, thanks for reaching out. What are you unsure about? Then I can help more specifically." }, { direction: "inbound", text: "I do not know anyone there and might bring a friend." }, { direction: "outbound", text: "That is completely fine. Many people come with a friend or alone, and the beginning is intentionally relaxed." }, { direction: "inbound", text: "Is it loud and crowded, or can you arrive calmly?" }, { direction: "outbound", text: "There is a calm check-in and enough time to settle in. Nobody has to network immediately." }, { direction: "inbound", text: "Hi, I saw you on Instagram. Is the summer event also suitable if I have never joined before?", platform: "instagram" }, { direction: "outbound", text: "Hi Julia, yes, absolutely. We explain the flow on site and you do not need to know anyone beforehand.", platform: "instagram" }, { direction: "inbound", text: "Hello FanMind team, I am considering joining with a friend. Could you tell me whether we can sit together and how long a reservation is valid?", platform: "email", sourceType: "email", messageType: "email" }, { direction: "inbound", text: "Could you briefly tell me if this is suitable for someone who has never joined before? I do not want to convince my friend if it feels too much for her." },
  ] },
  { displayName: "Alex R.", handle: "alex.demo@example.com", platform: "email", locale: "en", tags: ["Demo", "Support", "Critical"], summary: "Practical support case about rescheduling with a slightly critical tone.", memory: "Alex expects reliable, solution-focused replies with a concrete next action and no marketing phrases.", conversation: [
    { direction: "inbound", text: "Hello, I booked my ticket but will probably not be able to attend on that date." }, { direction: "outbound", text: "Hello Alex, thanks for letting us know. We can check which rescheduling options are available." }, { direction: "inbound", text: "The confirmation was not clear to me. Is there a clear rule?" }, { direction: "outbound", text: "Rescheduling is possible depending on availability. We need your booking number and preferred alternative date." }, { direction: "inbound", text: "Honestly, it feels a bit cumbersome that this cannot be done directly in the customer area." }, { direction: "outbound", text: "I understand. We will take that feedback and solve your case manually as smoothly as possible." }, { direction: "inbound", text: "My booking number is DEMO-4821. Please tell me specifically whether rescheduling is possible and whether there are costs." },
  ] },
];

async function seedSandraDemoWorkspaceData(workspace: Pick<WorkspaceBackfillRow, "id">, accessToken: string, locale: FanMindLanguage = "de"): Promise<Error | null> {
  const seeds = locale === "en" ? englishDemoFanSeeds : demoFanSeeds;
  for (const seed of seeds) {
    const error = await seedDemoFan(workspace.id, accessToken, seed);
    if (error) return error;
  }
  return null;
}

async function seedDemoFan(
  workspaceId: string,
  accessToken: string,
  seed: DemoFanSeed,
): Promise<Error | null> {
  const existingContact = await postgrestSelect<ContactRow>(
    "contacts",
    accessToken,
    CONTACT_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["handle", seed.handle],
    ],
    1,
    true,
  );
  if (existingContact.error) return existingContact.error;

  let contact = existingContact.data;
  if (!contact) {
    const contactId = deterministicDemoSeedId(
      workspaceId,
      "contact",
      seed.handle,
    );
    const createdContact = await postgrestRequest<ContactRow>(
      "contacts",
      "POST",
      {
        id: contactId,
        workspace_id: workspaceId,
        display_name: seed.displayName,
        handle: seed.handle,
        source_platform: seed.platform,
        language: seed.locale ?? "de",
        status: "active",
        tags: seed.tags,
        summary: seed.summary,
        internal_notes: seed.notes ?? null,
      },
      accessToken,
      {
        select: CONTACT_COLUMNS,
        single: true,
        upsert: true,
        onConflict: "id",
      },
    );
    if (createdContact.error) return createdContact.error;
    contact = createdContact.data;
  }
  if (!contact?.id) {
    return new Error("Demo-Kontakt konnte nicht erstellt werden.");
  }

  const memories = await postgrestSelect<MemoryRow[]>(
    "memories",
    accessToken,
    MEMORY_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contact.id],
    ],
    undefined,
    false,
  );
  if (memories.error) return memories.error;
  if (!(memories.data ?? []).some((memory) => memory.content === seed.memory)) {
    const memory = await postgrestRequest<MemoryRow>(
      "memories",
      "POST",
      {
        id: deterministicDemoSeedId(
          workspaceId,
          "memory",
          seed.handle,
        ),
        workspace_id: workspaceId,
        contact_id: contact.id,
        type: "preference",
        content: seed.memory,
        importance: seed.followup?.priority === "high" ? "high" : "medium",
      },
      accessToken,
      {
        select: MEMORY_COLUMNS,
        single: true,
        upsert: true,
        onConflict: "id",
      },
    );
    if (memory.error) return memory.error;
  }

  if (seed.followup) {
    const followups = await postgrestSelect<FollowupRow[]>(
      "followups",
      accessToken,
      FOLLOWUP_COLUMNS,
      [
        ["workspace_id", workspaceId],
        ["contact_id", contact.id],
      ],
      undefined,
      false,
    );
    if (followups.error) return followups.error;
    if (
      !(followups.data ?? []).some(
        (followup) => followup.status === "open",
      )
    ) {
      const followup = await postgrestRequest<FollowupRow>(
        "followups",
        "POST",
        {
          id: deterministicDemoSeedId(
            workspaceId,
            "followup",
            seed.handle,
          ),
          workspace_id: workspaceId,
          contact_id: contact.id,
          due_date: new Date(
            Date.now() +
              seed.followup.daysFromNow * 24 * 60 * 60 * 1000,
          )
            .toISOString()
            .slice(0, 10),
          priority: seed.followup.priority,
          reason: seed.followup.reason,
          status: "open",
        },
        accessToken,
        {
          select: FOLLOWUP_COLUMNS,
          single: true,
          upsert: true,
          onConflict: "id",
        },
      );
      if (followup.error) return followup.error;
    }
  }

  const conversations = await postgrestSelect<ConversationRow[]>(
    "conversations",
    accessToken,
    CONVERSATION_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["contact_id", contact.id],
    ],
    undefined,
    false,
  );
  if (conversations.error) return conversations.error;

  const lastInbound =
    [...seed.conversation]
      .reverse()
      .find((message) => message.direction === "inbound") ??
    seed.conversation.at(-1);
  const conversationId = deterministicDemoSeedId(
    workspaceId,
    "conversation",
    seed.handle,
  );
  let conversation =
    conversations.data?.find((row) => row.id === conversationId) ??
    conversations.data?.[0] ??
    null;
  if (!conversation) {
    const createdConversation = await postgrestRequest<ConversationRow>(
      "conversations",
      "POST",
      {
        id: conversationId,
        workspace_id: workspaceId,
        contact_id: contact.id,
        status: "open",
        priority: seed.followup?.priority ?? "medium",
        source_platform: seed.platform,
        source_type: seed.platform === "email" ? "email" : "dm",
        ai_status: "partial",
        next_step: "Antwort vorbereiten",
        last_message_preview: lastInbound?.text ?? seed.summary,
        last_inbound_at: new Date().toISOString(),
        original_author_label: seed.displayName,
        original_text_excerpt: lastInbound?.text ?? seed.summary,
      },
      accessToken,
      {
        select: CONVERSATION_COLUMNS,
        single: true,
        upsert: true,
        onConflict: "id",
      },
    );
    if (createdConversation.error) return createdConversation.error;
    conversation = createdConversation.data;
  }
  if (!conversation) {
    return new Error("Demo-Conversation konnte nicht erstellt werden.");
  }

  const existingMessages = await postgrestSelect<ConversationMessageRow[]>(
    "conversation_messages",
    accessToken,
    CONVERSATION_MESSAGE_COLUMNS,
    [
      ["workspace_id", workspaceId],
      ["conversation_id", conversation.id],
      ["contact_id", contact.id],
    ],
    undefined,
    false,
  );
  if (existingMessages.error) return existingMessages.error;
  const existingMessageKeys = new Set(
    (existingMessages.data ?? []).map(
      (message) => `${message.direction}\u0000${message.content}`,
    ),
  );

  const baseTime = Date.now() - seed.conversation.length * 11 * 60 * 1000;
  for (const [index, item] of seed.conversation.entries()) {
    const messageKey = `${item.direction}\u0000${item.text}`;
    if (existingMessageKeys.has(messageKey)) continue;

    const createdAt = new Date(
      baseTime + index * 11 * 60 * 1000,
    ).toISOString();
    const message = await postgrestRequest<ConversationMessageRow>(
      "conversation_messages",
      "POST",
      {
        id: deterministicDemoSeedId(
          workspaceId,
          "conversation-message",
          `${seed.handle}:${index}`,
        ),
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        contact_id: contact.id,
        direction: item.direction,
        message_type:
          item.messageType ??
          (item.platform === "email" || seed.platform === "email"
            ? "email"
            : "dm"),
        source_platform: item.platform ?? seed.platform,
        source_type:
          item.sourceType ??
          (item.platform === "email" || seed.platform === "email"
            ? "email"
            : "dm"),
        author_label:
          item.direction === "inbound" ? seed.displayName : "FanMind Team",
        original_author_label:
          item.direction === "inbound" ? seed.displayName : "FanMind Team",
        original_text_excerpt: item.text,
        content: item.text,
        message_kind: "text",
        created_at: createdAt,
      },
      accessToken,
      {
        select: CONVERSATION_MESSAGE_COLUMNS,
        single: true,
        upsert: true,
        onConflict: "id",
      },
    );
    if (message.error) return message.error;
    existingMessageKeys.add(messageKey);
  }
  return null;
}

export async function ensureUserWorkspace(
  user: SupabaseServerUser,
): Promise<WorkspaceBackfillResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return workspaceBackfillError(
      "Keine aktive Supabase-Session gefunden. Bitte melde dich erneut an.",
    );
  }

  const email =
    user.email ?? stringMetadataValue(user.user_metadata, "email") ?? "";
  const displayName =
    stringMetadataValue(user.user_metadata, "display_name") ??
    stringMetadataValue(user.user_metadata, "full_name");
  const workspaceName =
    stringMetadataValue(user.user_metadata, "organization") ??
    displayName ??
    DEFAULT_WORKSPACE_NAME;
  const workspaceTerms = resolveWorkspaceTerms(user.user_metadata);

  const profileResult = await postgrestRequest(
    "profiles",
    "POST",
    {
      id: user.id,
      email,
      display_name: displayName ?? null,
    },
    accessToken,
    { upsert: true },
  );

  if (profileResult.error) {
    return workspaceBackfillError(
      `Profil konnte nicht vorbereitet werden: ${profileResult.error.message}`,
    );
  }

  if (user.email?.trim().toLowerCase() === DEMO_EMAIL) {
    return ensureFixedSandraDemoWorkspace(user);
  }

  const ownerWorkspaceResult = await postgrestSelect<WorkspaceBackfillRow>(
    "workspaces",
    accessToken,
    WORKSPACE_COLUMNS,
    [["owner_user_id", user.id]],
    1,
    true,
  );

  if (ownerWorkspaceResult.error) {
    return workspaceBackfillError(
      `Workspace konnte nicht gesucht werden: ${ownerWorkspaceResult.error.message}`,
    );
  }

  let workspace = ownerWorkspaceResult.data;
  let created = false;

  if (
    workspace &&
    (isServerBoundTemporaryDemoWorkspace(workspace) ||
      isTemporaryDemoUser(user))
  ) {
    const normalizedDemo = await normalizeTemporaryDemoWorkspace(
      user,
      workspace,
    );
    if (normalizedDemo.error || !normalizedDemo.workspace) {
      return workspaceBackfillError(
        normalizedDemo.error?.message ??
          "Temporärer Demo-Workspace konnte nicht sicher vorbereitet werden.",
      );
    }
    workspace = normalizedDemo.workspace;
  }

  if (!workspace) {
    const paymentTermsAccepted =
      user.user_metadata?.payment_terms_accepted === true &&
      stringMetadataValue(
        user.user_metadata,
        "payment_terms_version",
      ) === PAYMENT_TERMS_VERSION;
    const isInternalDailyTest =
      workspaceTerms.commercialOption === "internal_daily_test";

    if (isInternalDailyTest) {
      if (!(await isInternalDailyTestWorkspaceProvisioningReady())) {
        return workspaceBackfillError(
          PUBLIC_DAILY_TEST_PROVISIONING_UNAVAILABLE_ERROR,
        );
      }

      if (!isInternalDailyTestStripeReady(getStripeConfigStatus())) {
        return workspaceBackfillError(
          PUBLIC_DAILY_TEST_BILLING_UNAVAILABLE_ERROR,
        );
      }

      // This direct file read is the admission decision and intentionally runs
      // last, immediately before the server-owned database mutation.
      if (!(await getPublicDailyTestPlanEnabled())) {
        return workspaceBackfillError(
          PUBLIC_DAILY_TEST_PLAN_UNAVAILABLE_ERROR,
        );
      }
    }

    const provisioningAccessToken = isInternalDailyTest
      ? getServiceAccessToken()
      : accessToken;
    const rpcResult = await postgrestRequest<WorkspaceProvisioningRpcRow>(
      `rpc/${
        isInternalDailyTest
          ? INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_RPC
          : WORKSPACE_PROVISIONING_RPC
      }`,
      "POST",
      isInternalDailyTest
        ? {
            p_user_id: user.id,
            p_workspace_name: workspaceName,
            p_payment_terms_accepted: paymentTermsAccepted,
          }
        : {
            p_workspace_name: workspaceName,
            p_commercial_option: workspaceTerms.commercialOption,
            p_payment_terms_accepted: paymentTermsAccepted,
          },
      provisioningAccessToken,
      {
        select: "workspace_id,created",
        single: true,
      },
    );

    if (
      rpcResult.error &&
      (isInternalDailyTest ||
        !isMissingWorkspaceProvisioningRpc(rpcResult.error))
    ) {
      return workspaceBackfillError(
        `Workspace konnte nicht sicher angelegt werden: ${rpcResult.error.message}`,
      );
    }

    if (!rpcResult.error) {
      if (!rpcResult.data?.workspace_id) {
        return workspaceBackfillError(
          "Die sichere Workspace-Einrichtung hat keinen Workspace zurückgegeben.",
        );
      }

      const provisionedWorkspaceResult =
        await postgrestSelect<WorkspaceBackfillRow>(
          "workspaces",
          accessToken,
          WORKSPACE_COLUMNS,
          [["id", rpcResult.data.workspace_id]],
          1,
          true,
        );
      if (
        provisionedWorkspaceResult.error ||
        !provisionedWorkspaceResult.data
      ) {
        return workspaceBackfillError(
          provisionedWorkspaceResult.error?.message ??
            "Der sicher eingerichtete Workspace konnte nicht geladen werden.",
        );
      }

      workspace = provisionedWorkspaceResult.data;
      created = rpcResult.data.created;
    }

    // Compatibility bridge for the deploy-before-migrate rollout. Only an
    // exact missing-RPC/schema-cache result reaches this legacy path.
    if (!workspace && !isInternalDailyTest) {
      const fullInsertWorkspaceResult =
        await postgrestRequest<WorkspaceBackfillRow>(
          "workspaces",
          "POST",
          {
            name: workspaceName,
            owner_user_id: user.id,
            plan_id: workspaceTerms.planId,
            commercial_option: workspaceTerms.commercialOption,
            setup_fee_cents: workspaceTerms.setupFeeCents,
            monthly_fee_cents: workspaceTerms.monthlyFeeCents,
            commitment_months: workspaceTerms.commitmentMonths,
            billing_status: getInitialBillingStatus(
              workspaceTerms.planId,
              workspaceTerms.commercialOption,
            ),
            billing_provider: getBillingProvider(),
            payment_collection_method: getPaymentCollectionMethod(
              workspaceTerms.planId,
              workspaceTerms.commercialOption,
            ),
            payment_terms_version:
              stringMetadataValue(
                user.user_metadata,
                "payment_terms_version",
              ) ?? PAYMENT_TERMS_VERSION,
            payment_terms_accepted_at:
              stringMetadataValue(
                user.user_metadata,
                "payment_terms_accepted_at",
              ) ?? new Date().toISOString(),
            payment_terms_accepted_by_user_id: user.id,
            billing_updated_at: new Date().toISOString(),
            billing_updated_by_user_id: user.id,
          },
          accessToken,
          { select: WORKSPACE_COLUMNS, single: true },
        );

      if (
        fullInsertWorkspaceResult.error &&
        !isMissingWorkspaceExpandColumn(fullInsertWorkspaceResult.error)
      ) {
        return workspaceBackfillError(
          `Workspace konnte nicht angelegt werden: ${fullInsertWorkspaceResult.error.message}`,
        );
      }

      let bridgeWorkspace = fullInsertWorkspaceResult.data;
      if (fullInsertWorkspaceResult.error) {
        const coreInsertWorkspaceResult =
          await postgrestRequest<WorkspaceBackfillRow>(
            "workspaces",
            "POST",
            {
              name: workspaceName,
              owner_user_id: user.id,
              plan_id: workspaceTerms.planId,
              commercial_option: workspaceTerms.commercialOption,
              setup_fee_cents: workspaceTerms.setupFeeCents,
              monthly_fee_cents: workspaceTerms.monthlyFeeCents,
              commitment_months: workspaceTerms.commitmentMonths,
              billing_status: getInitialBillingStatus(
                workspaceTerms.planId,
                workspaceTerms.commercialOption,
              ),
              billing_provider: getBillingProvider(),
              payment_collection_method: getPaymentCollectionMethod(
                workspaceTerms.planId,
                workspaceTerms.commercialOption,
              ),
              billing_updated_at: new Date().toISOString(),
              billing_updated_by_user_id: user.id,
            },
            accessToken,
            { select: WORKSPACE_COLUMNS, single: true },
          );

        if (coreInsertWorkspaceResult.error) {
          return workspaceBackfillError(
            `Workspace konnte nicht angelegt werden: ${coreInsertWorkspaceResult.error.message}`,
          );
        }
        bridgeWorkspace = coreInsertWorkspaceResult.data;
      }

      workspace = bridgeWorkspace;
      created = true;
    }
  }

  if (!workspace?.id) {
    return workspaceBackfillError(
      "Workspace konnte nicht erstellt oder geladen werden.",
    );
  }

  const existingMemberResult = await postgrestSelect<WorkspaceMemberRow>(
    "workspace_members",
    accessToken,
    "id,workspace_id",
    [
      ["workspace_id", workspace.id],
      ["user_id", user.id],
    ],
    1,
    true,
  );

  if (existingMemberResult.error) {
    return workspaceBackfillError(
      `Workspace-Mitgliedschaft konnte nicht geprüft werden: ${existingMemberResult.error.message}`,
    );
  }

  if (!existingMemberResult.data) {
    const insertMemberResult = await postgrestRequest(
      "workspace_members",
      "POST",
      {
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      },
      accessToken,
    );

    if (insertMemberResult.error) {
      return workspaceBackfillError(
        `Workspace-Mitgliedschaft konnte nicht angelegt werden: ${insertMemberResult.error.message}`,
      );
    }
  }

  return { workspace, error: null, created };
}

export async function isInternalDailyTestWorkspaceProvisioningReady(): Promise<boolean> {
  const serviceAccessToken = getServiceAccessToken();
  if (!serviceAccessToken) return false;

  const result =
    await postgrestRequest<InternalDailyTestProvisioningReadyRow>(
      `rpc/${INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_READY_RPC}`,
      "POST",
      {},
      serviceAccessToken,
      { select: "ready", single: true },
    );

  return !result.error && result.data?.ready === true;
}


async function deleteTemporaryDemoRows(
  table: string,
  filterColumn: DemoCleanupFilterColumn,
  workspaceId: string,
  accessToken: string,
  optional = false,
): Promise<Error | null> {
  const result = await postgrestDelete(table, accessToken, [
    [filterColumn, workspaceId],
  ]);
  if (!result.error) return null;

  const message = result.error.message.toLowerCase();
  if (
    optional &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("relation"))
  ) {
    return null;
  }

  return result.error;
}

export type TemporaryDemoDeleteResult = {
  deleted: boolean;
  error: Error | null;
  errorCode: DemoCleanupDeleteErrorCode | null;
};

function temporaryDemoDeleteFailure(
  errorCode: DemoCleanupDeleteErrorCode,
  error: Error,
): TemporaryDemoDeleteResult {
  return { deleted: false, error, errorCode };
}

type TemporaryDemoServerIdentity = {
  authUserId: string | null;
  workspaceId: string | null;
};

async function deleteServerVerifiedTemporaryDemo(
  user: SupabaseServerUser | null,
  workspace: WorkspaceDashboardRow | WorkspaceBackfillRow | null,
  serverIdentity: TemporaryDemoServerIdentity,
  signOutCurrentSession: boolean,
): Promise<TemporaryDemoDeleteResult> {
  const accessToken = getServiceAccessToken();
  if (!accessToken) {
    return temporaryDemoDeleteFailure(
      "demo_cleanup_not_configured",
      new Error(
        "SUPABASE_SERVICE_ROLE_KEY ist serverseitig nicht konfiguriert.",
      ),
    );
  }

  if ((user?.email ?? "").toLowerCase() === DEMO_EMAIL) {
    return temporaryDemoDeleteFailure(
      "demo_identity_not_temporary",
      new Error(
        "Löschung abgebrochen: User ist nicht eindeutig temporär.",
      ),
    );
  }

  if (
    (!serverIdentity.authUserId && !serverIdentity.workspaceId) ||
    (user && serverIdentity.authUserId !== user.id) ||
    (workspace &&
      (serverIdentity.workspaceId !== workspace.id ||
        (serverIdentity.authUserId !== null &&
          workspace.owner_user_id !== serverIdentity.authUserId) ||
        (user && workspace.owner_user_id !== user.id) ||
        workspace.billing_status !== "demo_free" ||
        workspace.test_access_flags?.[TEMPORARY_DEMO_ACCESS_FLAG] !== true))
  ) {
    return temporaryDemoDeleteFailure(
      "demo_workspace_identity_mismatch",
      new Error(
        "Löschung abgebrochen: Workspace gehört nicht eindeutig zum temporären Demo-User.",
      ),
    );
  }

  if (workspace) {
    for (const step of DEMO_CLEANUP_DELETE_STEPS) {
      const error = await deleteTemporaryDemoRows(
        step.table,
        step.filterColumn,
        workspace.id,
        accessToken,
        step.optional,
      );
      if (error) {
        return temporaryDemoDeleteFailure(step.errorCode, error);
      }
    }
  }

  if (user) {
    const authDelete = await fetch(
      getSupabaseAuthUrl(`/admin/users/${encodeURIComponent(user.id)}`),
      {
        method: "DELETE",
        headers: getSupabaseHeaders(accessToken),
        cache: "no-store",
      },
    );
    if (!authDelete.ok && authDelete.status !== 404) {
      return temporaryDemoDeleteFailure(
        "demo_delete_auth_user_failed",
        await parseSupabaseServerError(authDelete),
      );
    }
  }

  if (signOutCurrentSession) {
    await signOutSupabaseServerSession();
  }
  return { deleted: true, error: null, errorCode: null };
}

export async function deleteExpiredTemporaryDemo(
  user: SupabaseServerUser,
  workspace: WorkspaceDashboardRow | WorkspaceBackfillRow,
  serverIdentity: TemporaryDemoServerIdentity,
): Promise<TemporaryDemoDeleteResult> {
  return deleteServerVerifiedTemporaryDemo(
    user,
    workspace,
    serverIdentity,
    true,
  );
}

export async function finishClaimedTemporaryDemoCleanup(
  user: SupabaseServerUser | null,
  workspace: WorkspaceDashboardRow | WorkspaceBackfillRow | null,
  serverIdentity: TemporaryDemoServerIdentity,
): Promise<TemporaryDemoDeleteResult> {
  return deleteServerVerifiedTemporaryDemo(
    user,
    workspace,
    serverIdentity,
    false,
  );
}

async function parseSupabaseServerError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    msg?: string;
    message?: string;
    error_description?: string;
    error?: string;
  } | null;
  const message =
    payload?.msg ??
    payload?.message ??
    payload?.error_description ??
    payload?.error ??
    "Die Supabase-Session ist ungültig oder abgelaufen.";

  return new Error(message);
}

async function postgrestRequest<T = unknown>(
  table: string,
  method: "POST" | "PATCH",
  values: unknown,
  accessToken: string | undefined,
  options: {
    select?: string;
    single?: boolean;
    upsert?: boolean;
    onConflict?: string;
  } = {},
): Promise<PostgrestResult<T>> {
  try {
    const url = new URL(getSupabaseRestUrl(table));

    if (options.select) {
      url.searchParams.set("select", options.select);
    }

    if (options.upsert) {
      url.searchParams.set("on_conflict", options.onConflict ?? "id");
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...getSupabaseHeaders(accessToken),
        Prefer: `${options.upsert ? "resolution=merge-duplicates," : ""}${options.select ? "return=representation" : "return=minimal"}`,
      },
      body: JSON.stringify(values),
      cache: "no-store",
    });

    if (!response.ok) {
      return { data: null, error: await parseSupabaseServerError(response) };
    }

    if (!options.select) {
      return { data: null, error: null };
    }

    const payload = (await response.json()) as T[];

    return {
      data: options.single ? (payload[0] ?? null) : (payload as T),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}

async function postgrestUpdate<T = unknown>(
  table: string,
  values: unknown,
  accessToken: string | undefined,
  filters: [string, SupabaseFilterValue][],
  options: { select?: string; single?: boolean } = {},
): Promise<PostgrestResult<T>> {
  try {
    const url = new URL(getSupabaseRestUrl(table));

    if (options.select) {
      url.searchParams.set("select", options.select);
    }

    for (const [column, value] of filters) {
      url.searchParams.set(
        column,
        value === null ? "is.null" : `eq.${String(value)}`,
      );
    }

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        ...getSupabaseHeaders(accessToken),
        Prefer: options.select ? "return=representation" : "return=minimal",
      },
      body: JSON.stringify(values),
      cache: "no-store",
    });

    if (!response.ok) {
      return { data: null, error: await parseSupabaseServerError(response) };
    }

    if (!options.select) {
      return { data: null, error: null };
    }

    const payload = (await response.json()) as T[];

    return {
      data: options.single ? (payload[0] ?? null) : (payload as T),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}


async function postgrestDelete(
  table: string,
  accessToken: string | undefined,
  filters: [string, SupabaseFilterValue][],
): Promise<PostgrestResult<null>> {
  try {
    const url = new URL(getSupabaseRestUrl(table));
    for (const [column, value] of filters) {
      url.searchParams.set(column, value === null ? "is.null" : `eq.${String(value)}`);
    }
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: { ...getSupabaseHeaders(accessToken), Prefer: "return=minimal" },
      cache: "no-store",
    });
    if (!response.ok) return { data: null, error: await parseSupabaseServerError(response) };
    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Unbekannter Supabase-Fehler.") };
  }
}

async function postgrestCount(
  table: string,
  accessToken: string,
  filters: [string, SupabaseFilterValue][],
): Promise<PostgrestCountResult> {
  try {
    const url = new URL(getSupabaseRestUrl(table));
    url.searchParams.set("select", "id");

    for (const [column, value] of filters) {
      url.searchParams.set(
        column,
        value === null ? "is.null" : `eq.${String(value)}`,
      );
    }

    const response = await fetch(url.toString(), {
      method: "HEAD",
      headers: {
        ...getSupabaseHeaders(accessToken),
        Prefer: "count=exact",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { count: 0, error: await parseSupabaseServerError(response) };
    }

    const contentRange = response.headers.get("content-range");
    const count = contentRange ? Number(contentRange.split("/").at(-1)) : 0;

    return {
      count: Number.isFinite(count) ? count : 0,
      error: null,
    };
  } catch (error) {
    return {
      count: 0,
      error:
        error instanceof Error
          ? error
          : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}

async function postgrestSelect<T>(
  table: string,
  accessToken: string | undefined,
  columns: string,
  filters: [string, SupabaseFilterValue][],
  limitCount?: number,
  single?: boolean,
  order?: string,
): Promise<PostgrestResult<T>> {
  try {
    const url = new URL(getSupabaseRestUrl(table));
    url.searchParams.set("select", columns);

    for (const [column, value] of filters) {
      url.searchParams.set(
        column,
        value === null ? "is.null" : `eq.${String(value)}`,
      );
    }

    if (limitCount) {
      url.searchParams.set("limit", String(limitCount));
    }

    if (order) {
      url.searchParams.set("order", order);
    }

    const response = await fetch(url.toString(), {
      headers: getSupabaseHeaders(accessToken),
      cache: "no-store",
    });

    if (!response.ok) {
      return { data: null, error: await parseSupabaseServerError(response) };
    }

    const payload = (await response.json()) as T[];

    return {
      data: single ? (payload[0] ?? null) : (payload as T),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unbekannter Supabase-Fehler."),
    };
  }
}

function workspaceBackfillError(message: string): WorkspaceBackfillResult {
  return { workspace: null, error: new Error(message), created: false };
}

function workspaceDashboardError(message: string): WorkspaceDashboardResult {
  return { workspace: null, error: new Error(message) };
}

function isArchivedStatus(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === "archived";
}

function mergeTextBlocks(
  ...values: Array<string | null | undefined>
): string | null {
  const blocks = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return blocks.length ? blocks.join("\n\n") : null;
}

function uniqueTextValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return [];
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

function contactsError(message: string): ContactsResult {
  return { contacts: [], error: new Error(message) };
}

function contactCreateError(message: string): ContactCreateResult {
  return { contact: null, error: new Error(message) };
}

function contactUpdateError(message: string): ContactUpdateResult {
  return { contact: null, error: new Error(message) };
}

function contactDetailError(message: string): ContactDetailResult {
  return { contact: null, error: new Error(message) };
}

function memoriesError(message: string): MemoriesResult {
  return { memories: [], error: new Error(message) };
}

function memoryCreateError(message: string): MemoryCreateResult {
  return { memory: null, error: new Error(message) };
}

function conversationsError(message: string): ConversationsResult {
  return { conversations: [], error: new Error(message) };
}

function conversationMessagesError(
  message: string,
): ConversationMessagesResult {
  return { messages: [], error: new Error(message) };
}

function conversationError(message: string): ConversationResult {
  return { conversation: null, error: new Error(message) };
}

function conversationMessageCreateError(
  message: string,
): ConversationMessageCreateResult {
  return { message: null, conversation: null, error: new Error(message) };
}

function conversationUpdateError(message: string): ConversationUpdateResult {
  return { conversation: null, error: new Error(message) };
}

function socialConnectionError(message: string): SocialConnectionResult {
  return { connection: null, error: new Error(message) };
}

function socialConnectionsError(message: string): SocialConnectionsResult {
  return { connections: [], error: new Error(message) };
}

function followupsError(message: string): FollowupsResult {
  return { followups: [], error: new Error(message) };
}

function followupCreateError(message: string): FollowupCreateResult {
  return { followup: null, error: new Error(message) };
}

function withOptionalSchemaHint(
  message: string,
  tableName:
    | "memories"
    | "followups"
    | "conversations"
    | "conversation_messages",
): string {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes(tableName) ||
    lowerMessage.includes("relation") ||
    lowerMessage.includes("schema cache")
  ) {
    return `${message} Bitte spiele docs/database/fanmind_memory_followups_schema.sql in Supabase ein.`;
  }

  return message;
}

function isMissingAssignedUserIdentity(error: Error | null): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return message.includes("assigned_user_id") && (
    message.includes("column")
    || message.includes("schema cache")
    || message.includes("does not exist")
  );
}

function isMissingMetaMessengerSyncContinuationSchema(error: Error): boolean {
  const message = error.message.toLowerCase();
  const namesContinuationColumn =
    message.includes("messenger_sync_continuation_after") ||
    message.includes("messenger_sync_continuation_started_at");
  return namesContinuationColumn && (
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function normalizeMessageType(value: string | null | undefined): string {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return [
    "facebook_messages",
    "facebook_comments",
    "instagram_messages",
    "instagram_comments",
    "whatsapp_messages",
    "tiktok_comments",
    "tiktok_messages",
    "telegram_messages",
    "dm",
    "comment",
    "post",
    "email",
    "form",
    "note",
    "manual",
  ].includes(normalized ?? "")
    ? normalized!
    : "dm";
}

function normalizeUrl(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized && /^https?:\/\//i.test(normalized) ? normalized : null;
}

function normalizeMessageKind(
  requestedKind: string | null | undefined,
  attachments: ConversationMessageAttachment[] | null | undefined,
  content: string,
): string {
  if (
    requestedKind &&
    ["text", "image", "video", "audio", "file", "mixed", "unknown"].includes(
      requestedKind,
    )
  ) {
    return requestedKind;
  }
  return getMessageKindFromAttachments(content, attachments);
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function stringMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveWorkspaceTerms(metadata: Record<string, unknown> | undefined) {
  const rawPlanId =
    stringMetadataValue(metadata, "plan") ??
    stringMetadataValue(metadata, "plan_id");
  const rawCommercialOption =
    stringMetadataValue(metadata, "commercialOption") ??
    stringMetadataValue(metadata, "commercial_option");
  const planId =
    isPlanId(rawPlanId) && (rawPlanId === "pilot" || rawPlanId === "starter")
      ? rawPlanId
      : "starter";
  const commercialOption = isProductiveCommercialOption(rawCommercialOption)
    ? rawCommercialOption
    : "starter_paid_setup";

  if (planId === "pilot" && commercialOption === "pilot_only") {
    return { planId, ...getRegistrationCommercialTerms("pilot")! };
  }

  if (planId === "pilot" && commercialOption === "internal_daily_test") {
    return {
      planId,
      ...getRegistrationCommercialTerms("pilot", "internal_daily_test")!,
    };
  }

  if (
    planId === "starter" &&
    commercialOption === "starter_no_setup_commitment"
  ) {
    return {
      planId,
      commercialOption,
      setupFeeCents: 0,
      monthlyFeeCents: 31200,
      commitmentMonths: 12 as const,
    };
  }

  if (planId === "starter" && isStarterCommercialOption(commercialOption)) {
    return {
      planId,
      ...getRegistrationCommercialTerms("starter", "starter_paid_setup")!,
    };
  }

  return {
    planId: "starter" as PlanId,
    ...getRegistrationCommercialTerms("starter", "starter_paid_setup")!,
  };
}

function isStarterCommercialOption(
  value: WorkspaceCommercialOption,
): value is Extract<
  WorkspaceCommercialOption,
  "starter_paid_setup" | "starter_no_setup_commitment"
> {
  return STARTER_COMMERCIAL_OPTIONS.includes(value);
}

function isProductiveCommercialOption(
  value: unknown,
): value is WorkspaceCommercialOption {
  return (
    value === "pilot_only" ||
    value === "internal_daily_test" ||
    value === "starter_paid_setup" ||
    value === "starter_no_setup_commitment"
  );
}

function isWebhookFallbackDisplayName(
  displayName: string | null | undefined,
  platform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram",
  handle?: string | null,
): boolean {
  const normalized = normalizeOptionalText(displayName);
  const fallback = getDefaultWebhookAuthorLabel(platform);

  if (!normalized) return true;
  if (normalized === fallback) return true;
  if (handle && normalized === `${fallback} ${handle}`) return true;

  return new RegExp(`^${escapeRegExp(fallback)}\\s+\\d+$`, "i").test(
    normalized,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDefaultWebhookAuthorLabel(
  platform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram",
): string {
  if (platform === "instagram") return "Instagram Nutzer";
  if (platform === "whatsapp") return "WhatsApp Kontakt";
  if (platform === "tiktok") return "TikTok Nutzer";
  if (platform === "telegram") return "Telegram Nutzer";
  return "Facebook Nutzer";
}

function getWebhookPlatformLabel(
  platform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram",
): string {
  if (platform === "instagram") return "Instagram";
  if (platform === "whatsapp") return "WhatsApp";
  if (platform === "tiktok") return "TikTok";
  if (platform === "telegram") return "Telegram";
  return "Facebook";
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  const date = new Date(
    /^\d+$/.test(normalized) ? Number(normalized) * 1000 : normalized,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getDefaultWebhookSourceType(
  platform: "facebook" | "instagram" | "whatsapp" | "tiktok" | "telegram",
  messageType: "dm" | "comment",
):
  | "facebook_messages"
  | "facebook_comments"
  | "instagram_messages"
  | "instagram_comments"
  | "whatsapp_messages"
  | "tiktok_comments"
  | "tiktok_messages"
  | "telegram_messages" {
  if (platform === "whatsapp") return "whatsapp_messages";
  if (platform === "telegram") return "telegram_messages";
  if (platform === "tiktok")
    return messageType === "comment" ? "tiktok_comments" : "tiktok_messages";
  return messageType === "comment"
    ? `${platform}_comments`
    : `${platform}_messages`;
}
