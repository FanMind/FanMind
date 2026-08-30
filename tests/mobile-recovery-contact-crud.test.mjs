import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MOBILE_PASSWORD_RECOVERY_REDIRECT,
  MobileAuthRecoveryPolicyError,
  normalizeRecoveryEmail,
  parseMobileAuthRecoveryUrl,
  validateNewPassword,
} from "../apps/mobile/src/lib/authRecoveryPolicy.mjs";
import {
  contactToDraft,
  emptyContactDraft,
  normalizeContactDraft,
} from "../apps/mobile/src/lib/contactDraftPolicy.mjs";
import {
  ALL_MESSAGE_CHANNELS,
  buildMessageChannelOptions,
  filterMessagesByChannel,
  messagePlatformLabel,
} from "../apps/mobile/src/lib/contactMessageChannelPolicy.mjs";
import { normalizeManualFollowupDraft } from "../apps/mobile/src/lib/manualFollowupPolicy.mjs";
import {
  addSecureStorageRegistryKey,
  normalizeSecureStorageRegistry,
  removeSecureStorageRegistryKey,
} from "../apps/mobile/src/lib/secureStorageRegistry.mjs";

async function read(path) {
  return readFile(path, "utf8");
}

test("Mobile recovery accepts only the FanMind reset route and bounded credentials", () => {
  assert.equal(MOBILE_PASSWORD_RECOVERY_REDIRECT, "fanmind://reset-password");

  assert.deepEqual(
    parseMobileAuthRecoveryUrl("fanmind://reset-password?code=pkce-code-123"),
    {
      mode: "pkce",
      recovery: true,
      code: "pkce-code-123",
      accessToken: null,
      refreshToken: null,
    },
  );

  assert.deepEqual(
    parseMobileAuthRecoveryUrl(
      "fanmind://reset-password#access_token=access123&refresh_token=refresh123&type=recovery",
    ),
    {
      mode: "tokens",
      recovery: true,
      code: null,
      accessToken: "access123",
      refreshToken: "refresh123",
    },
  );

  assert.throws(
    () => parseMobileAuthRecoveryUrl("https://fanmind.ch/reset-password?code=value"),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_scheme",
  );
  assert.throws(
    () => parseMobileAuthRecoveryUrl("fanmind://settings?code=value"),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_route",
  );
  assert.throws(
    () =>
      parseMobileAuthRecoveryUrl(
        "fanmind://reset-password?code=value&access_token=a&refresh_token=r",
      ),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "ambiguous_credentials",
  );
  assert.throws(
    () => parseMobileAuthRecoveryUrl("fanmind://reset-password#access_token=a"),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "partial_tokens",
  );
  assert.throws(
    () =>
      parseMobileAuthRecoveryUrl(
        "fanmind://reset-password#access_token=a&refresh_token=r",
      ),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_type",
  );
  assert.throws(
    () =>
      parseMobileAuthRecoveryUrl(
        "fanmind://reset-password#access_token=a&refresh_token=r&type=signup",
      ),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_type",
  );
});

test("Mobile recovery email and password rules are normalized without enumeration", () => {
  assert.equal(normalizeRecoveryEmail("  USER@Example.COM "), "user@example.com");
  assert.throws(() => normalizeRecoveryEmail("invalid"), MobileAuthRecoveryPolicyError);

  assert.deepEqual(validateNewPassword("FanMindSecure2026", "FanMindSecure2026"), {
    ok: true,
    password: "FanMindSecure2026",
    errors: [],
  });
  assert.equal(validateNewPassword("short1", "short1").ok, false);
  assert.match(
    validateNewPassword("abcdefghijkl", "abcdefghijkl").errors.join("\n"),
    /password_complexity/u,
  );
  assert.match(
    validateNewPassword("FanMindSecure2026", "Different2026").errors.join("\n"),
    /password_mismatch/u,
  );
});

test("Mobile contact drafts normalize fields and reject unsafe values", () => {
  const result = normalizeContactDraft({
    displayName: "  Sandra M.  ",
    handle: " @Sandra_Fit ",
    sourcePlatform: " Instagram ",
    language: " DE-CH ",
    status: "VIP",
    tags: "Fitness; VIP,fitness",
    summary: " Interessiert ",
    internalNotes: " Nur intern ",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    display_name: "Sandra M.",
    handle: "@Sandra_Fit",
    source_platform: "instagram",
    language: "de-ch",
    status: "vip",
    tags: ["fitness", "vip"],
    summary: "Interessiert",
    internal_notes: "Nur intern",
  });

  assert.equal(normalizeContactDraft({ displayName: "" }).ok, false);
  assert.equal(
    normalizeContactDraft({ ...emptyContactDraft(), displayName: "A", status: "archived" }).ok,
    false,
  );
  assert.equal(
    normalizeContactDraft({ ...emptyContactDraft(), displayName: "A", language: "german" }).ok,
    false,
  );

  assert.deepEqual(
    contactToDraft({
      display_name: "Alex",
      handle: null,
      source_platform: null,
      language: null,
      status: null,
      tags: ["warm", "event"],
      summary: null,
      internal_notes: null,
    }),
    {
      displayName: "Alex",
      handle: "",
      sourcePlatform: "manual",
      language: "de",
      status: "new",
      tags: "warm; event",
      summary: "",
      internalNotes: "",
    },
  );
});

test("Mobile message channels are derived per fan and preserve message order", () => {
  const messages = [
    { id: "1", source_platform: "Facebook" },
    { id: "2", source_platform: "instagram" },
    { id: "3", source_platform: "facebook" },
    { id: "4", source_platform: "community_forum" },
    { id: "5", source_platform: null },
  ];

  assert.deepEqual(buildMessageChannelOptions(messages), [
    { key: ALL_MESSAGE_CHANNELS, label: "Alle", count: 5 },
    { key: "facebook", label: "Facebook", count: 2 },
    { key: "instagram", label: "Instagram", count: 1 },
    { key: "community_forum", label: "Community forum", count: 1 },
    { key: "other", label: "Sonstige", count: 1 },
  ]);
  assert.deepEqual(
    filterMessagesByChannel(messages, "facebook").map((message) => message.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterMessagesByChannel(messages, ALL_MESSAGE_CHANNELS).map((message) => message.id),
    ["1", "2", "3", "4", "5"],
  );
  assert.equal(messagePlatformLabel("whatsapp"), "WhatsApp");
  assert.equal(messagePlatformLabel("future-channel"), "Future channel");
});

test("Manual Mobile Follow-ups require a current date, reason and valid priority", () => {
  assert.deepEqual(
    normalizeManualFollowupDraft(
      { reason: " Event-Details senden ", dueDate: "2026-09-01", priority: "HIGH" },
      "2026-08-29",
    ),
    {
      ok: true,
      value: {
        reason: "Event-Details senden",
        due_date: "2026-09-01",
        priority: "high",
      },
      errors: [],
    },
  );
  assert.equal(
    normalizeManualFollowupDraft(
      { reason: "", dueDate: "2026-08-28", priority: "urgent" },
      "2026-08-29",
    ).ok,
    false,
  );
  assert.equal(
    normalizeManualFollowupDraft(
      { reason: "Anrufen", dueDate: "2026-02-30", priority: "normal" },
      "2026-08-29",
    ).ok,
    false,
  );
});

test("SecureStore registry is bounded, deduplicated and corruption-safe", () => {
  assert.deepEqual(normalizeSecureStorageRegistry("not-json"), []);
  assert.deepEqual(
    normalizeSecureStorageRegistry(JSON.stringify(["auth", "auth", "other", 3, ""])),
    ["auth", "other"],
  );
  assert.deepEqual(addSecureStorageRegistryKey(["auth"], "other"), ["auth", "other"]);
  assert.deepEqual(addSecureStorageRegistryKey(["auth"], "auth"), ["auth"]);
  assert.deepEqual(removeSecureStorageRegistryKey(["auth", "other"], "auth"), ["other"]);
  assert.deepEqual(addSecureStorageRegistryKey(["auth"], "invalid:key"), ["auth"]);
});

test("SecureStore purge enrolls valid keys and retains failed keys for retry", async () => {
  const source = await read("apps/mobile/src/lib/secureStorage.ts");

  assert.match(
    source,
    /Existing valid keys that predate registry enrollment[\s\S]*await registerKey\(key\)/u,
  );
  assert.match(source, /const MAX_SESSION_CHUNKS = 64/u);
  assert.match(source, /parsed <= MAX_SESSION_CHUNKS/u);
  assert.match(source, /const failedKeys: string\[\] = \[\]/u);
  assert.match(source, /failedKeys\.push\(key\)/u);
  assert.match(source, /await writeRegistry\(failedKeys\)/u);
  assert.match(source, /throw new Error\("Nicht alle sicheren FanMind-Schlüssel/u);
  assert.match(
    source,
    /await registerKey\(key\);[\s\S]*setItemAsync\([\s\S]*secureStoreCountKey\(key\)[\s\S]*for \(const \[index, chunk\] of chunks\.entries\(\)\)/u,
  );
  assert.match(source, /Keep the key registered so a later logout can retry the purge/u);
  assert.match(source, /A stale registry entry is safer than unregistered local data/u);
});

test("AuthProvider requires recovery confirmation without retaining or logging credentials", async () => {
  const source = await read("apps/mobile/src/providers/AuthProvider.tsx");

  assert.match(source, /resetPasswordForEmail/u);
  assert.match(source, /MOBILE_PASSWORD_RECOVERY_REDIRECT/u);
  assert.match(source, /exchangeCodeForSession/u);
  assert.match(source, /supabase\.auth\.setSession/u);
  assert.match(source, /waitForPasswordRecoveryEvent/u);
  assert.match(source, /event === "PASSWORD_RECOVERY"/u);
  assert.match(source, /recoveryEventResolver\.current\?\.\(\)/u);
  assert.match(source, /password_recovery_event_missing/u);
  assert.match(source, /recoveryStatus !== "ready"/u);
  assert.match(source, /supabase\.auth\.updateUser/u);
  assert.match(source, /clearSecureLocalStorage/u);
  assert.match(source, /recoveryAttemptActive/u);
  assert.match(source, /recoveryLinkHandled/u);
  assert.doesNotMatch(source, /handledRecoveryUrls|activeRecoveryUrl/u);
  assert.doesNotMatch(source, /new Set<string>|\.add\(url\)/u);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/u);
});

test("Mobile contact mutations stay workspace-bound and fail on duplicates", async () => {
  const source = await read("apps/mobile/src/lib/data.ts");

  assert.match(source, /export async function createContact/u);
  assert.match(source, /export async function updateContact/u);
  assert.match(source, /normalizeContactDraft/u);
  assert.match(source, /duplicateContactExists/u);
  assert.match(source, /\.eq\("workspace_id", input\.workspaceId\)/u);
  assert.match(source, /\.eq\("id", input\.contactId\)/u);
  assert.match(source, /\.ilike\("handle", input\.draft\.handle\)/u);
  assert.match(source, /Handle und dieser Quelle existiert bereits/u);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role/u);
});

test("Mobile contact detail loads a bounded RLS-protected message history", async () => {
  const [data, detail, dashboard, followups] = await Promise.all([
    read("apps/mobile/src/lib/data.ts"),
    read("apps/mobile/app/(app)/contacts/[id].tsx"),
    read("apps/mobile/app/(app)/index.tsx"),
    read("apps/mobile/app/(app)/followups.tsx"),
  ]);

  assert.match(data, /export async function listContactMessages/u);
  assert.match(
    data,
    /\.from\("conversation_messages"\)[\s\S]*\.eq\("workspace_id", workspaceId\)[\s\S]*\.eq\("contact_id", contactId\)[\s\S]*\.limit\(100\)/u,
  );
  assert.doesNotMatch(data, /recentMessages\.reverse\(\)/u);
  assert.match(detail, /listContactMessages\(workspace\.id, contactId\)/u);
  assert.match(detail, /setMessageError\(messagesResult\.error\)/u);
  assert.match(detail, /messageError[\s\S]*mobileStyles\.error/u);
  assert.match(detail, /refreshMessages/u);
  assert.match(detail, /Aktualisieren/u);
  assert.match(detail, /Gesprächsverlauf/u);
  assert.match(detail, /buildMessageChannelOptions\(messages\)/u);
  assert.match(detail, /filterMessagesByChannel\(messages, activeMessageChannel\)/u);
  assert.match(detail, /visibleMessages\.map/u);
  assert.match(detail, /option\.label\} · \{option\.count/u);
  assert.match(detail, /FanMind sendet keine Nachricht automatisch/u);
  assert.match(data, /export async function listUnseenInboundFans/u);
  assert.match(
    data,
    /\.eq\("workspace_id", workspaceId\)[\s\S]*\.eq\("direction", "inbound"\)[\s\S]*\.is\("seen_at", null\)[\s\S]*\.limit\(500\)/u,
  );
  assert.match(data, /export async function markContactInboundMessagesSeen/u);
  assert.match(
    data,
    /workspaceRole[\s\S]*\.update\(\{ seen_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]*\.eq\("workspace_id", input\.workspaceId\)[\s\S]*\.eq\("contact_id", input\.contactId\)[\s\S]*\.eq\("direction", "inbound"\)[\s\S]*\.is\("seen_at", null\)/u,
  );
  assert.match(dashboard, /listUnseenInboundFans\(workspace\.id\)/u);
  assert.match(dashboard, /Fans mit ungelesenen Nachrichten/u);
  assert.match(dashboard, /fans\.map/u);
  assert.doesNotMatch(dashboard, /<BrandMark/u);
  assert.doesNotMatch(dashboard, /Kontakte öffnen/u);
  assert.match(detail, /Direkt beim Fan anlegen/u);
  assert.match(detail, /normalizeManualFollowupDraft/u);
  assert.match(detail, /Follow-up speichern/u);
  assert.match(detail, /Nachrichten[\s\S]*Follow-ups[\s\S]*Kontaktwissen/u);
  assert.match(detail, /numberOfLines=\{1\}[\s\S]*contactIdentifier/u);
  assert.match(data, /export async function listContactFollowups/u);
  assert.match(
    data,
    /listContactFollowups[\s\S]*\.select\(FOLLOWUP_COLUMNS, \{ count: "exact" \}\)[\s\S]*\.eq\("workspace_id", workspaceId\)[\s\S]*\.eq\("contact_id", contactId\)[\s\S]*\.or\(OPEN_FOLLOWUP_FILTER\)[\s\S]*\.limit\(100\)[\s\S]*truncated: followups\.length < totalCount/u,
  );
  assert.match(
    data,
    /listFollowups[\s\S]*pageSize = 200[\s\S]*while \(true\)[\s\S]*\.or\(OPEN_FOLLOWUP_FILTER\)[\s\S]*\.order\("due_date"[\s\S]*\.order\("created_at"[\s\S]*\.order\("id"[\s\S]*\.range\(offset, offset \+ pageSize - 1\)[\s\S]*pageRows\.length < pageSize/u,
  );
  assert.match(data, /export async function listTodaysFollowups/u);
  assert.match(
    data,
    /listTodaysFollowups[\s\S]*\.select\("id", \{ count: "exact", head: true \}\)[\s\S]*\.eq\("workspace_id", workspaceId\)[\s\S]*\.eq\("due_date", dueDate\)[\s\S]*\.or\(OPEN_FOLLOWUP_FILTER\)/u,
  );
  assert.match(data, /maximumLoadedRows = 1_000/u);
  assert.match(
    data,
    /rankedPriorityGroups[\s\S]*priorities: \["urgent"\][\s\S]*priorities: \["high"\][\s\S]*priorities: \["normal", "medium"\][\s\S]*priorities: \["low"\][\s\S]*fallback: true/u,
  );
  assert.match(
    data,
    /for \(const group of rankedPriorityGroups\)[\s\S]*\.order\("created_at", \{ ascending: true, nullsFirst: false \}\)[\s\S]*\.order\("id", \{ ascending: true \}\)[\s\S]*priority\.is\.null,priority\.not\.in\.[\s\S]*\.range\(/u,
  );
  assert.match(data, /priorityRank[\s\S]*urgent: 4[\s\S]*high: 3[\s\S]*normal: 2[\s\S]*medium: 2[\s\S]*low: 1/u);
  assert.match(data, /totalCount[\s\S]*truncated: rows\.length < totalCount/u);
  assert.match(detail, /setContactFollowupError\(followupsResult\.error\)/u);
  assert.match(detail, /contactFollowupError[\s\S]*mobileStyles\.error/u);
  assert.equal(
    (detail.match(/setContactFollowupError\(followupsResult\.error\)/gu) ?? []).length,
    3,
  );
  assert.equal(
    (detail.match(/setContactFollowupCount\(followupsResult\.totalCount\)/gu) ?? []).length,
    3,
  );
  assert.match(detail, /contactFollowupsTruncated[\s\S]*von \{contactFollowupCount\} offenen Follow-ups/u);
  assert.match(dashboard, /Fällige Follow-ups/u);
  assert.match(dashboard, /section=followups/u);
  assert.match(dashboard, /todayResult\.totalCount/u);
  assert.match(dashboard, /setTodayFollowupError\(todayResult\.error\)/u);
  assert.match(
    dashboard,
    /todayFollowupError[\s\S]*mobileStyles\.error[\s\S]*todayFollowups\.length[\s\S]*Heute nichts fällig/u,
  );
  assert.match(dashboard, /wichtigsten 20 von \{todayFollowupCount\}/u);
  assert.match(
    followups,
    /ListEmptyComponent=\{error \? null : \([\s\S]*Keine offenen Follow-ups/u,
  );
});

test("Mobile fan analysis reuses the authorized server action and remains RLS-bound", async () => {
  const [data, detail, api, route, action, report, server] = await Promise.all([
    read("apps/mobile/src/lib/data.ts"),
    read("apps/mobile/app/(app)/contacts/[id].tsx"),
    read("apps/mobile/src/lib/api.ts"),
    read("src/app/api/ai/fan-analysis/route.ts"),
    read("src/app/fans/[id]/analysisActions.ts"),
    read("src/app/fans/[id]/FanAnalysisReport.tsx"),
    read("src/lib/supabase/server.ts"),
  ]);

  assert.match(
    data,
    /fan_analysis_reports[\s\S]*\.eq\("workspace_id", workspaceId\)[\s\S]*\.eq\("contact_id", contactId\)[\s\S]*\.limit\(1\)/u,
  );
  assert.match(data, /source_from_at,source_to_at,confidence_score,review_status/u);
  assert.doesNotMatch(detail, /Fan analysieren/u);
  assert.match(detail, /In Vorbereitung/u);
  assert.match(detail, /Bis dahin bleibt diese Aktion verborgen/u);
  assert.match(detail, /Keine Diagnose und keine sensiblen Ableitungen/u);
  assert.match(detail, /hasCompleteAnalysisProvenance/u);
  assert.match(detail, /wird ohne vollständigen Herkunftszeitraum[\s\S]*nicht angezeigt/u);
  assert.match(detail, /Zeitraum:[\s\S]*Konfidenz:[\s\S]*Prüfstatus:/u);
  assert.match(api, /Authorization: `Bearer \$\{input\.accessToken\}`[\s\S]*\/api\/ai\/fan-analysis/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /analyzeFanCommunication[\s\S]*accessToken/u);
  assert.match(route, /rate_limited[\s\S]*return 429/u);
  assert.match(route, /service_unavailable[\s\S]*return 503/u);
  assert.match(route, /capability_disabled[\s\S]*return 403/u);
  assert.match(route, /workspace_inactive/u);
  assert.match(
    action,
    /requireContactInActiveAuthorizedWorkspace\([\s\S]*contactId,[\s\S]*explicitAccessToken/u,
  );
  assert.doesNotMatch(action, /requireContactInActiveAuthorizedWorkspaceMember/u);
  assert.match(action, /sourceFromAt[\s\S]*sourceToAt[\s\S]*confidenceScore/u);
  assert.match(
    action,
    /if \(analysisCapability\.error\)[\s\S]*failure_reason: "service_unavailable"[\s\S]*if \(!analysisCapability\.enabled\)[\s\S]*failure_reason: "capability_disabled"/u,
  );
  assert.match(
    action,
    /if \(!sourceMessages\.length \|\| !sourceFromAt \|\| !sourceToAt\)[\s\S]*failure_reason: "unprocessable_context"[\s\S]*gültigen Herkunftszeitraum/u,
  );
  assert.match(
    action,
    /messagesResult\.messages[\s\S]*\.filter\(\(message\) =>[\s\S]*Date\.parse\(String\(message\.created_at[\s\S]*\.map\(\(message\) =>/u,
  );
  assert.match(
    action,
    /const sourceMessages = boundedPayload\.messages\.filter[\s\S]*const payload = \{ \.\.\.boundedPayload, messages: sourceMessages \}[\s\S]*const inputChars = JSON\.stringify\(payload\)\.length/u,
  );
  assert.match(
    action,
    /const confidenceScore =[\s\S]*apiKey[\s\S]*Math\.min\(80, sourceMessages\.length \* 10\)[\s\S]*Math\.min\(20, sourceMessages\.length \* 2\)/u,
  );
  assert.doesNotMatch(action, /fallback-no-messages/u);
  assert.match(action, /review_status: result\.report\.review_status/u);
  assert.match(report, /hasCompleteReportProvenance/u);
  assert.match(report, /hasRejectedReportProvenance/u);
  assert.match(report, /menschlich abgelehnt[\s\S]*Schlussfolgerungen werden nicht angezeigt/u);
  assert.match(detail, /hasRejectedAnalysisProvenance/u);
  assert.match(detail, /menschlich verworfen[\s\S]*Schlussfolgerungen werden nicht angezeigt/u);
  assert.match(report, /Herkunftszeitraum, Konfidenz und Prüfstatus nicht angezeigt/u);
  assert.match(
    report,
    /rejectedReport \|\| report \|\| loadError \? null[\s\S]*No communication overview yet/u,
  );
  assert.match(report, /Zeitraum[\s\S]*Konfidenz[\s\S]*Prüfstatus/u);
  assert.match(server, /getRecentContactMemories[\s\S]*getAccessToken\(explicitAccessToken\)/u);
  assert.match(server, /source_from_at,source_to_at,confidence_score,review_status/u);
  assert.match(server, /FAN_ANALYSIS_REPORT_LEGACY_COLUMNS/u);
  assert.match(server, /isMissingFanAnalysisProvenanceColumn/u);
  assert.match(
    server,
    /areAllFanAnalysisProvenanceColumnsMissing[\s\S]*for \(const column of FAN_ANALYSIS_PROVENANCE_COLUMNS\)[\s\S]*if \(!probe\.error \|\| !isMissingFanAnalysisProvenanceColumn\(probe\.error\)\)[\s\S]*return false/u,
  );
  assert.match(server, /source_from_at: null[\s\S]*review_status: null/u);
  assert.match(detail, /memoryError[\s\S]*mobileStyles\.error[\s\S]*memories\.length/u);
  assert.match(
    detail,
    /!analysisReport && !analysisError[\s\S]*Noch keine Fan-Analyse gespeichert/u,
  );
});

test("Mobile routes expose reset, create and edit flows with no automatic sending", async () => {
  const [login, forgot, reset, list, detail, create, edit, settings, ui] = await Promise.all([
    read("apps/mobile/app/(auth)/login.tsx"),
    read("apps/mobile/app/(auth)/forgot-password.tsx"),
    read("apps/mobile/app/(auth)/reset-password.tsx"),
    read("apps/mobile/app/(app)/contacts/index.tsx"),
    read("apps/mobile/app/(app)/contacts/[id].tsx"),
    read("apps/mobile/app/(app)/contacts/new.tsx"),
    read("apps/mobile/app/(app)/contacts/[id]/edit.tsx"),
    read("apps/mobile/app/(app)/settings.tsx"),
    read("apps/mobile/src/components/ui.tsx"),
  ]);

  assert.match(login, /Passwort vergessen/u);
  assert.match(forgot, /Wiederherstellungslink anfordern/u);
  assert.match(forgot, /nicht offengelegt, ob ein Konto existiert/u);
  assert.match(reset, /Recovery-Codes und Sitzungstokens werden weder angezeigt noch protokolliert/u);
  assert.match(list, /contacts\/new/u);
  assert.match(detail, /contacts\/\$\{contact\.id\}\/edit/u);
  assert.match(create, /createContact/u);
  assert.match(edit, /updateContact/u);
  assert.match(settings, /entfernt alle registrierten[\s\S]*FanMind-Schlüssel aus SecureStore/u);
  assert.match(detail, /Keine automatische Sendefunktion/u);
  assert.doesNotMatch(ui, /brandIcon|brandNode|brandLine/u);
});
