export type ConfirmedChatLearningDeletionSchemaState = "preinstall" | "installed";

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
