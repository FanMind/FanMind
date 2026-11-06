export const FACEBOOK_PAGES_MESSAGING_SCOPE = "pages_messaging";
export const FACEBOOK_PAGES_READ_USER_CONTENT_SCOPE = "pages_read_user_content";
export const FACEBOOK_READ_INSIGHTS_SCOPE = "read_insights";

export const FACEBOOK_MESSAGES_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  FACEBOOK_PAGES_MESSAGING_SCOPE,
] as const;

export const FACEBOOK_COMMENT_FEED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  FACEBOOK_PAGES_READ_USER_CONTENT_SCOPE,
] as const;

export const FACEBOOK_INSIGHTS_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  FACEBOOK_READ_INSIGHTS_SCOPE,
] as const;

export const FACEBOOK_OAUTH_SCOPES = FACEBOOK_MESSAGES_OAUTH_SCOPES;
