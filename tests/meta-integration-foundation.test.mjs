import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  META_CONNECTION_CAPABILITIES,
  META_GRAPH_API_VERSION,
  PROHIBITED_SENSITIVE_INFERENCES,
  canManageMetaConnections,
  evaluateAnalysisActivation,
  evaluateExternalAccountBinding,
} from "../src/lib/metaIntegrationPolicy.mjs";
import {
  FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS,
  normalizeFacebookPageSelectionId,
  normalizeFacebookPageSelectionPayload,
} from "../src/lib/facebookPageSelectionPolicy.mjs";
import {
  META_INCREMENTAL_CHAT_FETCH_LIMIT,
  META_INITIAL_CHAT_BACKFILL_LIMIT,
  META_PERSONAL_CONTENT_RETENTION_DAYS,
  META_SYNC_MODE,
  buildMinimalFanProfile,
  evaluateMetaDataUse,
} from "../src/lib/metaDataHandlingPolicy.mjs";
import { sanitizeMetaProviderError } from "../src/lib/metaProviderErrorPolicy.mjs";

async function source(path) {
  return readFile(path, "utf8");
}

test("Meta connections use the supported stable Graph API and owner/admin control", () => {
  assert.equal(META_GRAPH_API_VERSION, "v25.0");
  assert.equal(canManageMetaConnections("owner"), true);
  assert.equal(canManageMetaConnections("admin"), true);
  assert.equal(canManageMetaConnections("member"), false);
  assert.equal(canManageMetaConnections(null), false);
});

test("Facebook and Instagram capabilities request only bounded scopes", () => {
  assert.deepEqual([...META_CONNECTION_CAPABILITIES.facebook.comments], [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_read_user_content",
  ]);
  assert.deepEqual([...META_CONNECTION_CAPABILITIES.facebook.insights], [
    "pages_show_list",
    "pages_read_engagement",
    "read_insights",
  ]);
  assert.deepEqual([...META_CONNECTION_CAPABILITIES.instagram.messages], [
    "instagram_business_basic",
    "instagram_business_manage_messages",
  ]);
  assert.deepEqual([...META_CONNECTION_CAPABILITIES.instagram.insights], [
    "instagram_business_basic",
    "instagram_business_manage_insights",
  ]);
});

test("one external account cannot silently bind to another workspace", () => {
  assert.deepEqual(
    evaluateExternalAccountBinding({
      platform: "facebook",
      externalAccountId: "page-123",
      workspaceId: "workspace-a",
      userId: "user-a",
      role: "owner",
      existingActiveWorkspaceId: "workspace-b",
    }),
    {
      allowed: false,
      reason: "resource_already_bound",
      resourceKey: "facebook:page-123",
    },
  );
  assert.equal(
    evaluateExternalAccountBinding({
      platform: "instagram",
      externalAccountId: "ig-123",
      workspaceId: "workspace-a",
      userId: "user-a",
      role: "admin",
      existingActiveWorkspaceId: "workspace-a",
    }).allowed,
    true,
  );
});

test("analysis activation fails closed until all legal controls are confirmed", () => {
  assert.deepEqual(
    evaluateAnalysisActivation({
      role: "owner",
      legalBasisStatus: "confirmed",
      transparencyStatus: "unconfirmed",
      dataProcessingAgreementStatus: "confirmed",
      retentionStatus: "confirmed",
      dataSubjectRightsStatus: "confirmed",
    }),
    { allowed: false, blockers: ["transparency_unconfirmed"] },
  );
  assert.equal(
    evaluateAnalysisActivation({
      role: "admin",
      legalBasisStatus: "confirmed",
      transparencyStatus: "confirmed",
      dataProcessingAgreementStatus: "confirmed",
      retentionStatus: "confirmed",
      dataSubjectRightsStatus: "confirmed",
    }).allowed,
    true,
  );
});

test("sensitive fan traits remain prohibited analysis targets", () => {
  assert.ok(PROHIBITED_SENSITIVE_INFERENCES.includes("health_data"));
  assert.ok(PROHIBITED_SENSITIVE_INFERENCES.includes("political_opinions"));
  assert.ok(PROHIBITED_SENSITIVE_INFERENCES.includes("sexual_orientation"));
  assert.ok(PROHIBITED_SENSITIVE_INFERENCES.includes("psychological_diagnosis"));
});

test("Meta provider failures retain bounded diagnostics without message content", async () => {
  assert.deepEqual(
    sanitizeMetaProviderError({
      code: 190,
      type: "OAuthException",
      message: "token and account details must never cross the boundary",
    }),
    { code: 190, type: "OAuthException" },
  );
  assert.deepEqual(
    sanitizeMetaProviderError({
      code: -1,
      type: "invalid type with spaces",
      message: "private provider response",
    }),
    { code: null, type: null },
  );

  const [facebook, instagram, facebookActions, instagramActions] =
    await Promise.all([
      source("src/lib/facebookIntegration.ts"),
      source("src/lib/instagramIntegration.ts"),
      source("src/app/channels/facebookWebhookActions.ts"),
      source("src/app/channels/instagramWebhookActions.ts"),
    ]);
  assert.doesNotMatch(facebook, /errorMessage:/u);
  assert.doesNotMatch(
    facebook,
    /metaError\?:\s*\{[^}]*message|message:\s*error\?\.message/u,
  );
  assert.doesNotMatch(
    instagram,
    /message:\s*payload\?\.(?:error\?\.message|error_message)/u,
  );
  assert.doesNotMatch(
    facebookActions,
    /(?:fetchError|syncErrorValue) instanceof Error[\s\S]{0,80}\.message/u,
  );
  assert.doesNotMatch(
    instagramActions,
    /error instanceof Error[\s\S]{0,80}error\.message/u,
  );
});

test("OAuth flow requires an explicit server-validated Facebook page selection", async () => {
  const [callback, flow, selectionRoute, selectionPage] = await Promise.all([
    source("src/app/api/integrations/facebook/callback/route.ts"),
    source("src/lib/facebookConnectionFlow.ts"),
    source("src/app/api/integrations/facebook/select/route.ts"),
    source("src/app/channels/facebook/select/page.tsx"),
  ]);

  assert.match(callback, /createPendingFacebookPageSelection/u);
  assert.match(callback, /httpOnly:\s*true/u);
  assert.match(callback, /sameSite:\s*"lax"/u);
  assert.match(callback, /FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS/u);
  assert.match(callback, /areDemoConnectionsDisabled/u);
  assert.match(
    flow,
    /pages\.length > 1 && !input\.selectedPageId[\s\S]*page_selection_required/u,
  );
  assert.match(
    flow,
    /pages\.find\(\(candidate\) => candidate\.id === input\.selectedPageId\)/u,
  );
  assert.match(selectionRoute, /isTrustedFanMindMutationRequest/u);
  assert.match(
    selectionRoute,
    /pending\.userId !== data\.user\.id[\s\S]*pending\.workspaceId !== workspace\.id/u,
  );
  assert.match(selectionRoute, /selectedPageId/u);
  assert.match(selectionPage, /name="page_id"/u);
  assert.match(selectionPage, /requireActiveAuthorizedWorkspace\(\)/u);
  assert.ok(
    selectionPage.indexOf("requireActiveAuthorizedWorkspace()") <
      selectionPage.indexOf("fetchFacebookPages(pending.userAccessToken)"),
  );
  assert.doesNotMatch(
    selectionPage,
    /name="userAccessToken"|value=\{pending\.userAccessToken\}/u,
  );
});

test("pending Facebook page selection expires and accepts only bounded identifiers", () => {
  const now = 2_000_000_000;
  const valid = {
    version: 1,
    workspaceId: "workspace_123",
    userId: "user_123456",
    userAccessToken: "token_12345678901234567890",
    connectionType: "facebook_messages",
    issuedAt: now - 30,
  };
  assert.deepEqual(normalizeFacebookPageSelectionPayload(valid, now), valid);
  assert.equal(
    normalizeFacebookPageSelectionPayload(
      {
        ...valid,
        issuedAt: now - FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS - 1,
      },
      now,
    ),
    null,
  );
  assert.equal(
    normalizeFacebookPageSelectionPayload(
      { ...valid, connectionType: "facebook_everything" },
      now,
    ),
    null,
  );
  assert.equal(normalizeFacebookPageSelectionId(" page:123 "), "page:123");
  assert.equal(normalizeFacebookPageSelectionId("../page"), null);
});

test("Instagram Business Login is workspace-bound and subscribes only authorized incremental channels", async () => {
  const [integration, pagingPolicy, start, callback, disconnect, channels, webhook] =
    await Promise.all([
      source("src/lib/instagramIntegration.ts"),
      source("src/lib/instagramGraphPagingPolicy.mjs"),
      source("src/app/api/integrations/instagram/start/route.ts"),
      source("src/app/api/integrations/instagram/callback/route.ts"),
      source("src/app/api/integrations/instagram/disconnect/route.ts"),
      source("src/app/channels/ChannelsGrid.tsx"),
      source("src/app/api/webhooks/meta/route.ts"),
    ]);

  assert.match(integration, /https:\/\/www\.instagram\.com\/oauth\/authorize/u);
  assert.match(integration, /enable_fb_login", "0"/u);
  assert.match(integration, /force_authentication", "1"/u);
  assert.match(integration, /https:\/\/api\.instagram\.com\/oauth\/access_token/u);
  assert.match(integration, /grant_type", "ig_exchange_token"/u);
  assert.match(integration, /graph\.instagram\.com\/\$\{META_GRAPH_API_VERSION\}\/me/u);
  assert.match(
    integration,
    /\$\{META_GRAPH_API_VERSION\}\/\$\{encodeURIComponent\(profileId\)\}\/conversations/u,
  );
  assert.match(integration, /platform", "instagram"/u);
  assert.match(
    integration,
    /messages\.limit\(\$\{pageLimit\}\)\{id,created_time,from,to,message\}/u,
  );
  assert.match(integration, /Authorization: `Bearer \$\{accessToken\}`/u);
  assert.match(pagingPolicy, /url\.host !== "graph\.instagram\.com"/u);
  assert.match(start, /requireActiveAuthorizedWorkspace\(\)/u);
  assert.match(start, /workspaceId: workspace\.id/u);
  assert.match(start, /userId: data\.user\.id/u);
  assert.match(start, /canManageMetaConnections/u);
  assert.match(callback, /state\.userId !== data\.user\.id/u);
  assert.match(callback, /requireActiveAuthorizedWorkspace\(\)/u);
  assert.match(callback, /workspace\.id !== state\.workspaceId/u);
  assert.match(callback, /areDemoConnectionsDisabled/u);
  assert.match(callback, /encryptToken\(token\.accessToken\)/u);
  assert.match(callback, /webhookSubscribed:\s*false/u);
  assert.match(callback, /subscribeInstagramAccount/u);
  assert.match(callback, /updateInstagramWebhookSubscribed/u);
  assert.match(disconnect, /isTrustedFanMindMutationRequest/u);
  assert.match(channels, /Inkrementeller Webhook/u);
  assert.match(channels, /Instagram-DMs jetzt synchronisieren/u);
  assert.match(channels, /KI-Kontext je Stufe 50\/100\/150/u);
  assert.match(channels, /Persönliche fremde Posts/u);
  assert.match(webhook, /process\.env\.INSTAGRAM_APP_SECRET/u);
});

test("tokens are server-only and active account bindings are globally unique", async () => {
  const [server, migration] = await Promise.all([
    source("src/lib/supabase/server.ts"),
    source(
      "supabase/migrations/20260803120000_meta_content_intelligence_foundation.sql",
    ),
  ]);
  const publicColumns = server.match(
    /const SOCIAL_CONNECTION_PUBLIC_COLUMNS =\n\s*"([^"]+)";/u,
  );
  assert.ok(publicColumns);
  assert.doesNotMatch(publicColumns[1], /page_access_token_encrypted/u);
  assert.match(
    server,
    /SOCIAL_CONNECTION_SECRET_COLUMNS[\s\S]*page_access_token_encrypted/u,
  );
  assert.match(
    server,
    /upsertFacebookSocialConnection[\s\S]*getServiceAccessToken\(\)/u,
  );
  assert.match(
    server,
    /upsertFacebookSocialConnection[\s\S]*activeWorkspaceConnections[\s\S]*connection\.page_id !== input\.pageId/u,
  );
  assert.match(
    server,
    /activeExternalBindings[\s\S]*connection\.workspace_id !== input\.workspaceId/u,
  );
  assert.match(
    migration,
    /social_connections_active_external_account_unique_idx[\s\S]*platform, external_account_id[\s\S]*status = 'connected'/u,
  );
  assert.match(
    migration,
    /drop policy if exists social_connections_insert_workspace_member/u,
  );
  assert.match(
    migration,
    /revoke all on table public\.social_connections from anon, authenticated/u,
  );
  const socialGrant = migration.match(
    /grant select \(([\s\S]*?)\) on public\.social_connections to authenticated;/u,
  );
  assert.ok(socialGrant);
  assert.doesNotMatch(socialGrant[1], /page_access_token_encrypted/u);
});

test("database settings cache owned content while AI context is capped separately", async () => {
  const [migration, incrementalMigration] = await Promise.all([
    source(
      "supabase/migrations/20260803120000_meta_content_intelligence_foundation.sql",
    ),
    source(
      "supabase/migrations/20260803210000_preserve_incremental_conversation_history.sql",
    ),
  ]);
  assert.match(
    migration,
    /fan_analysis_enabled boolean not null default false/u,
  );
  assert.match(
    migration,
    /content_insights_enabled boolean not null default false/u,
  );
  assert.match(
    incrementalMigration,
    /meta_sync_mode text not null default 'incremental_cache'[\s\S]*meta_sync_mode = 'incremental_cache'/u,
  );
  assert.doesNotMatch(migration, /message_history_limit_per_thread/u);
  assert.match(
    migration,
    /legal_basis_status = 'confirmed'[\s\S]*transparency_status = 'confirmed'[\s\S]*data_processing_agreement_status = 'confirmed'[\s\S]*retention_status = 'confirmed'[\s\S]*data_subject_rights_status = 'confirmed'/u,
  );
  assert.match(
    incrementalMigration,
    /personal_content_retention_days integer not null default 0[\s\S]*personal_content_retention_days = 0/u,
  );
  assert.match(migration, /create table if not exists public\.content_metric_snapshots/u);
  assert.match(migration, /create table if not exists public\.communication_analysis_reports/u);
  assert.match(
    incrementalMigration,
    /communication_analysis_reports_source_message_count_check[\s\S]*source_message_count between 0 and 150/u,
  );
  assert.match(
    migration,
    /source_scope text not null default 'confirmed_manual_outbound'/u,
  );
  assert.match(
    migration,
    /workspace_voice_profiles_confirmed_manual_source_check/u,
  );
  assert.match(
    migration,
    /insert into public\.workspace_analysis_settings \(workspace_id\)[\s\S]*select id from public\.workspaces/u,
  );
  assert.match(migration, /workspaces_create_analysis_settings/u);
  assert.match(
    migration,
    /revoke all on table public\.fan_analysis_reports from anon, authenticated/u,
  );
  assert.match(
    migration,
    /revoke all on table public\.contact_ai_profiles from anon, authenticated/u,
  );
  assert.match(
    migration,
    /revoke all on table public\.workspace_voice_profiles from anon, authenticated/u,
  );
});

test("owned content and authorized chats are cached while personal profiles remain transient", () => {
  assert.equal(META_SYNC_MODE, "incremental_cache");
  assert.equal(META_INITIAL_CHAT_BACKFILL_LIMIT, 150);
  assert.equal(META_INCREMENTAL_CHAT_FETCH_LIMIT, 50);
  assert.equal(META_PERSONAL_CONTENT_RETENTION_DAYS, 0);
  assert.deepEqual(
    evaluateMetaDataUse({
      dataClass: "authorized_chat_message",
      persist: true,
      workspaceBound: false,
      authorizedConnection: true,
    }),
    { allowed: false, reason: "authorized_workspace_connection_required" },
  );
  assert.deepEqual(
    evaluateMetaDataUse({
      dataClass: "owned_account_post_metrics",
      persist: true,
      workspaceBound: true,
      authorizedConnection: true,
    }),
    { allowed: true, reason: "incremental_cache_allowed" },
  );
  assert.deepEqual(
    evaluateMetaDataUse({
      dataClass: "third_party_personal_post",
      userRequested: true,
      persist: false,
    }),
    { allowed: true, reason: "transient_use_only" },
  );
  assert.deepEqual(
    evaluateMetaDataUse({
      dataClass: "third_party_profile_data",
      userRequested: true,
      persist: true,
    }),
    { allowed: false, reason: "personal_meta_persistence_forbidden" },
  );
  assert.equal(
    evaluateMetaDataUse({
      dataClass: "minimal_fan_profile",
      persist: true,
    }).allowed,
    true,
  );
});

test("minimal fan profiles retain no raw source content", () => {
  const profile = buildMinimalFanProfile({
    language: "de",
    communicationTone: "freundlich",
    explicitTopics: ["Training", "Training"],
    sourceMessageCount: 9,
    confidenceScore: 68,
    rawMessages: ["should never survive"],
    sourceFromAt: "2026-08-01T00:00:00.000Z",
    sourceToAt: "2026-08-03T00:00:00.000Z",
  });
  assert.equal(profile.language, "de");
  assert.deepEqual(profile.explicit_topics, ["Training"]);
  assert.equal(profile.source_message_count, 9);
  assert.equal(profile.raw_source_retained, false);
  assert.equal("rawMessages" in profile, false);
});

test("profiles are server-owned while authorized webhooks preserve chats without auto-analysis", async () => {
  const [server, analysisAction, webhook, syncAction, instagramSyncAction, oldRetention, newRetention] = await Promise.all([
    source("src/lib/supabase/server.ts"),
    source("src/app/fans/[id]/analysisActions.ts"),
    source("src/lib/metaWebhook.ts"),
    source("src/app/channels/facebookWebhookActions.ts"),
    source("src/app/channels/instagramWebhookActions.ts"),
    source("supabase/migrations/20260614120000_conversation_message_retention.sql"),
    source("supabase/migrations/20260803210000_preserve_incremental_conversation_history.sql"),
  ]);
  assert.doesNotMatch(server, /updateContactProfileFromInboundMessage/u);
  assert.match(webhook, /"authorized_chat_message"/u);
  assert.match(
    webhook,
    /evaluateMetaDataUse\(\{[\s\S]*persist:\s*true[\s\S]*workspaceBound:\s*true[\s\S]*authorizedConnection:\s*true/u,
  );
  assert.match(webhook, /createMetaWebhookConversationMessage/u);
  assert.doesNotMatch(webhook, /ignored_on_demand_mode/u);
  assert.match(syncAction, /connection\.last_messenger_sync_at/u);
  assert.match(syncAction, /META_INITIAL_CHAT_BACKFILL_LIMIT/u);
  assert.match(syncAction, /META_INCREMENTAL_CHAT_FETCH_LIMIT/u);
  assert.match(instagramSyncAction, /fetchInstagramConversationPage/u);
  assert.match(instagramSyncAction, /fetchInstagramConversationMessages/u);
  assert.match(instagramSyncAction, /META_INITIAL_CHAT_BACKFILL_LIMIT/u);
  assert.match(instagramSyncAction, /META_INCREMENTAL_CHAT_FETCH_LIMIT/u);
  assert.match(instagramSyncAction, /sourcePlatform:\s*"instagram"/u);
  assert.match(instagramSyncAction, /sourceType:\s*"instagram_messages"/u);
  assert.match(instagramSyncAction, /updateInstagramMessengerSyncStatus/u);
  assert.match(webhook, /enqueueMetaConversationCatchup/u);
  assert.doesNotMatch(webhook, /syncInstagramMessengerConversationForContact/u);
  assert.doesNotMatch(webhook, /syncFacebookMessengerConversationForContact/u);
  assert.match(oldRetention, /ranked\.rn > 50/u);
  assert.match(newRetention, /drop trigger if exists conversation_messages_trim_to_latest_50/u);
  assert.match(newRetention, /drop function if exists public\.trim_conversation_messages_to_latest_50/u);
  assert.match(
    server,
    /updateWorkspaceVoiceProfileFromManualOutbound[\s\S]*getWorkspaceAnalysisCapabilityStatus[\s\S]*"user_voice_analysis"/u,
  );
  assert.match(
    analysisAction,
    /getWorkspaceAnalysisCapabilityStatus\([\s\S]*"fan_analysis"[\s\S]*if \(!analysisCapability\.enabled\)/u,
  );
  assert.match(
    analysisAction,
    /channel:\s*message\.source_platform\s*\?\?\s*"manual"/u,
  );
  assert.doesNotMatch(
    analysisAction,
    /message\.source_platform\s*===\s*"facebook"/u,
  );
  assert.match(
    server,
    /upsertFanAnalysisReport[\s\S]*getServiceAccessToken\(\)/u,
  );
  assert.match(
    server,
    /upsertContactAiProfile[\s\S]*getServiceAccessToken\(\)/u,
  );
  assert.match(
    server,
    /upsertWorkspaceVoiceProfile[\s\S]*getServiceAccessToken\(\)/u,
  );
});


test("Meta reader docs distinguish base migration state from observed continuation and queue objects", async () => {
  const [readme, sourceOfTruth, currentSchema, metaContent, socialIntake] = await Promise.all([
    source("README.md"),
    source("docs/SOURCE_OF_TRUTH.md"),
    source("docs/database/fanmind_current_schema.md"),
    source("docs/integrations/META_CONTENT_INTELLIGENCE.md"),
    source("docs/social-intake-standard.md"),
  ]);

  assert.match(
    sourceOfTruth,
    /Meta-Content-Staging:[\s\S]{0,600}auf dem getrennten Supabase-Staging\s+angewendet/u,
  );
  assert.match(
    metaContent,
    /beide Meta-Content-Migrationen im getrennten Supabase-Staging angewendet und read-only nachgeprüft/u,
  );
  assert.doesNotMatch(
    metaContent,
    /Migration noch nicht angewendet|noch nicht ausgeführt/u,
  );
  assert.match(readme, /Ledger-Zeitstempel der ledger-geführten Fortsetzung/u);
  assert.match(readme, /kontrollierte Queue absichtlich ledgerfrei/u);
  assert.match(sourceOfTruth, /Migration-Ledger-Zeitstempel[\s\S]{0,100}nicht separat nachgewiesen/u);
  assert.match(sourceOfTruth, /Queue[\s\S]{0,500}absichtlich[\s\S]{0,80}nicht im Supabase-Migrationsledger/u);
  assert.match(currentSchema, /kontrollierter Schritt[\s\S]{0,100}absichtlich keinen Eintrag im[\s\S]{0,40}Supabase-Migrationsledger/u);
  assert.match(metaContent, /Fortsetzungsobjekte[\s\S]{0,180}Migration-Ledger-Zeitstempel nicht separat bewiesen/u);
  assert.match(metaContent, /Catch-up-Queue[\s\S]{0,220}absichtlich ohne Supabase-Migrationsledger-Eintrag/u);
  assert.doesNotMatch(
    metaContent,
    /Fortsetzungsschema im isolierten Staging angewendet|Queue-Schema\/Indizes\/server-only Funktionen im isolierten Staging angewendet/u,
  );
  assert.match(
    socialIntake,
    /`facebook_messages`: implementiert\/Beta/u,
  );
  assert.match(
    socialIntake,
    /Kein Social-Kanal ist allgemein live/u,
  );
  assert.doesNotMatch(
    socialIntake,
    /`facebook_messages`: live/u,
  );
});
