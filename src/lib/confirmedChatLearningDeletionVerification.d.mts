export type ConfirmedChatLearningDeletionSchemaState = "preinstall" | "installed";

export declare const CONFIRMED_CHAT_LEARNING_SCHEMA_STATE: ConfirmedChatLearningDeletionSchemaState;

export type ConfirmedChatLearningDeletionVerificationResult =
  | { ok: true; evidence: "verified" | "preinstall_absent" }
  | { ok: false; evidence: "failed" };

export declare function verifyConfirmedChatLearningContactDeletion(input: {
  fetchImpl: (
    input: string | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  tableUrl: string;
  headers: HeadersInit;
  workspaceId: string;
  contactId: string;
  schemaState: ConfirmedChatLearningDeletionSchemaState;
}): Promise<ConfirmedChatLearningDeletionVerificationResult>;

export declare function verifyConfirmedChatLearningAccountDeletion(input: {
  fetchImpl: (
    input: string | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  tableUrl: string;
  headers: HeadersInit;
  workspaceIds: string[];
  userId: string;
  schemaState: ConfirmedChatLearningDeletionSchemaState;
}): Promise<ConfirmedChatLearningDeletionVerificationResult>;
