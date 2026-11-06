export const FACEBOOK_PAGE_SELECTION_COOKIE: string;
export const FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS: number;

export type FacebookPageSelectionConnectionType =
  | "facebook_messages"
  | "facebook_comments"
  | "facebook_insights";

export type FacebookPageSelectionPayload = {
  version: 1;
  workspaceId: string;
  userId: string;
  userAccessToken: string;
  connectionType: FacebookPageSelectionConnectionType;
  issuedAt: number;
};

export function normalizeFacebookPageSelectionPayload(
  payload: unknown,
  nowSeconds?: number,
): FacebookPageSelectionPayload | null;

export function normalizeFacebookPageSelectionId(
  value: unknown,
): string | null;
