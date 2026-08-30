export type Workspace = {
  id: string;
  name: string;
  role: "owner" | "member";
  owner_user_id?: string;
  billing_status?: string | null;
  plan_id?: string;
  member_safe_projection?: true;
  member_processing_allowed?: boolean;
};

export type Contact = {
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
  created_at: string | null;
  updated_at: string | null;
};

export type ContactListItem = Pick<
  Contact,
  | "id"
  | "workspace_id"
  | "display_name"
  | "handle"
  | "source_platform"
  | "status"
  | "summary"
  | "updated_at"
>;

export type ContactMemory = {
  id: string;
  workspace_id: string;
  contact_id: string;
  type: string | null;
  content: string;
  importance: string | null;
  created_at: string | null;
};

export type ConversationMessage = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string;
  direction: "inbound" | "outbound" | "note";
  message_type: string;
  source_platform: string | null;
  author_label: string | null;
  content: string;
  created_at: string | null;
  seen_at: string | null;
};

export type DashboardUnreadFan = ContactListItem & {
  unread_count: number;
  latest_message_at: string | null;
  latest_source_platform: string | null;
};

export type Followup = {
  id: string;
  workspace_id: string;
  contact_id: string;
  due_date: string | null;
  priority: string | null;
  reason: string;
  status: string | null;
  created_at: string | null;
  contact?: Pick<Contact, "id" | "display_name" | "handle"> | null;
};

export type FanAnalysisReport = {
  id: string;
  workspace_id: string;
  contact_id: string;
  report_json: Record<string, unknown> | null;
  summary: string | null;
  source_message_count: number | null;
  source_from_at: string | null;
  source_to_at: string | null;
  confidence_score: number | null;
  review_status: "unreviewed" | "confirmed" | "corrected" | "rejected" | null;
  generated_at: string | null;
  updated_at: string | null;
};

export type FanAnalysisResponse = {
  ok: boolean;
  message: string;
  report?: Pick<
    FanAnalysisReport,
    | "report_json"
    | "summary"
    | "source_message_count"
    | "source_from_at"
    | "source_to_at"
    | "confidence_score"
    | "review_status"
    | "generated_at"
    | "updated_at"
  > | null;
};

export type ReplyOption = {
  tone: string;
  label: string;
  text: string;
};

export type ReplySuggestions = {
  reply_options: ReplyOption[];
  suggested_memory: {
    content: string;
    importance: "low" | "normal" | "high";
  };
  suggested_followup: {
    recommended: boolean;
    in_days: number | null;
    reason: string;
  };
  safety_note: string;
};
