#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

const checkedFiles = [
  ".gitignore",
  ".env.example",
  ".env.staging.example",
  ".github/workflows/deploy-fanmind.yml",
  ".github/workflows/ai-tier-staging-migration.yml",
  ".github/workflows/ai-tier-staging-acceptance.yml",
  ".github/workflows/ai-tier-stripe-event-ledger-staging.yml",
  ".github/workflows/stripe-billing-event-ledger-staging.yml",
  ".github/workflows/meta-content-staging-migration.yml",
  ".github/workflows/mobile-release-resource-readiness.yml",
  ".github/workflows/mobile-signed-internal-build.yml",
  ".github/workflows/ci-mobile.yml",
  ".github/workflows/browser-e2e.yml",
  ".github/workflows/browser-e2e-staging-write.yml",
  ".github/workflows/workspace-member-data-boundary-staging-apply.yml",
  ".github/workflows/workspace-member-data-boundary-staging-verify.yml",
  ".github/workflows/whatsapp-cloud-inbound-staging-apply.yml",
  ".github/workflows/whatsapp-cloud-inbound-staging-verify.yml",
  ".github/workflows/staging-synthetic-fixture-provisioning.yml",
  ".github/workflows/staging-email-provider-acceptance.yml",
  ".github/workflows/provision-staging-host.yml",
  "ops/nginx/fanmind-staging.http.conf",
  "scripts/operations/verify-staging-nginx-whatsapp-boundary.awk",
  ".github/workflows/restore-drill-host-readiness.yml",
  ".github/workflows/restore-drill-resource-readiness.yml",
  ".github/workflows/restore-drill-database.yml",
  "package.json",
  "playwright.core-flow.config.mts",
  "playwright.staging-write.config.mts",
  "e2e-core-flow/regular-user-core-flow.spec.ts",
  "e2e-staging-write/core-csv.spec.ts",
  "scripts/testing/regular-user-core-flow-fixture.mjs",
  "tests/regular-user-core-flow-fixture.test.mjs",
  "tests/staging-core-csv-acceptance.test.mjs",
  "tests/staging-ephemeral-member-credential.test.mjs",
  "tests/staging-email-provider-acceptance.test.mjs",
  "tests/workspace-member-core-flow.test.mjs",
  "tests/workspace-member-data-boundary.test.mjs",
  "tests/workspace-member-data-boundary-staging.test.mjs",
  "scripts/operations/workspace-member-data-boundary-runner.mjs",
  "src/lib/workspaceMemberDataBoundaryStagingPolicy.mjs",
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql",
  "docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md",
  "docs/operations/WEBSITE_CHAT_FOUNDATION.md",
  "src/lib/supabase/server.ts",
  "src/lib/workspaceAuthorization.ts",
  "src/lib/workspaceProcessingPolicy.mjs",
  "src/app/fans/actions.ts",
  "src/app/fans/[id]/contextActions.ts",
  "src/app/inbox/actions.ts",
  "src/app/api/ai/reply-suggestions/route.ts",
  "src/app/channels/facebookWebhookActions.ts",
  "src/app/channels/instagramWebhookActions.ts",
  "src/app/channels/metaSyncActions.ts",
  "src/app/channels/facebook/select/page.tsx",
  "src/app/api/integrations/facebook/start/route.ts",
  "src/app/api/integrations/facebook/callback/route.ts",
  "src/app/api/integrations/facebook/select/route.ts",
  "src/app/api/integrations/instagram/start/route.ts",
  "src/app/api/integrations/instagram/callback/route.ts",
  "src/app/api/webhooks/meta/self-test/route.ts",
  "apps/mobile/src/lib/data.ts",
  "tests/csv-import-parser.test.mjs",
  "tests/csv-import-atomicity.test.mjs",
  "tests/test-suite-coverage.test.mjs",
  "src/app/api/webhooks/whatsapp/route.ts",
  "src/lib/webhookSecurityPolicy.mjs",
  "src/lib/whatsappCloudInboundPolicy.mjs",
  "src/lib/whatsappCloudInboundStagingPolicy.mjs",
  "src/lib/whatsappWebhook.ts",
  "src/lib/channelSources.ts",
  "src/lib/supabase/server.ts",
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs",
  "tests/whatsapp-cloud-inbound.test.mjs",
  "tests/whatsapp-cloud-inbound-staging.test.mjs",
  "tests/staging-deploy-policy.test.mjs",
  "tests/webhook-security-policy.test.mjs",
  "docs/integrations/WHATSAPP_CLOUD_INBOUND.md",
  "docs/operations/STAGING_PROVISIONING.md",
  "docs/security/WEBHOOK_LOG_RETENTION.md",
  "docs/testing/BROWSER_E2E.md",
  "docs/operations/ROADMAP_1_7_COMPLETION.md",
  "docs/operations/STAGING_DATABASE_ROLLOUT_STATE.md",
  "docs/operations/STAGING_SYNTHETIC_FIXTURES.md",
  "docs/operations/STAGING_EPHEMERAL_MEMBER_CREDENTIAL.md",
  "docs/operations/STAGING_EMAIL_PROVIDER_ACCEPTANCE.md",
  "scripts/operations/staging-core-csv-acceptance.mjs",
  "scripts/operations/staging-ephemeral-member-credential.mjs",
  "scripts/operations/staging-email-provider-acceptance.mjs",
  "scripts/operations/canonicalize-staging-rollout-evidence.mjs",
  "scripts/operations/staging-synthetic-fixtures.mjs",
  "src/lib/stagingCoreCsvAcceptancePolicy.mjs",
  "src/lib/stagingEphemeralMemberCredentialPolicy.mjs",
  "src/lib/stagingEmailProviderAcceptancePolicy.mjs",
  "src/lib/stagingSyntheticFixturePolicy.mjs",
  "src/app/fans/import/csv.ts",
  "src/app/workspace/access-paused/page.tsx",
  "apps/mobile/package.json",
  "src/config/aiTiers.mjs",
  "src/config/commercialModel.mjs",
  "src/config/aiTierRecommendation.mjs",
  "scripts/operations/verify-ai-tier-readiness.mjs",
  "scripts/operations/verify-ai-tier-recommendation.mjs",
  "scripts/operations/ai-reply-quality-eval.mjs",
  "tests/ai-reply-quality-eval.test.mjs",
  "scripts/operations/run-database-restore-drill.sh",
  "scripts/operations/restore-host-readiness.mjs",
  "scripts/operations/restore-database-postcheck-receipt.mjs",
  "scripts/operations/verify-restore-drill-evidence.mjs",
  "tests/restore-drill-evidence.test.mjs",
  "tests/restore-host-readiness.test.mjs",
  "docs/operations/RESTORE_DRILL.md",
  "scripts/operations/ai-tier-entitlement-migration-runner.mjs",
  "scripts/operations/ai-tier-stripe-event-ledger-runner.mjs",
  "scripts/operations/stripe-billing-event-ledger-runner.mjs",
  "scripts/operations/ai-tier-staging-acceptance.mjs",
  "scripts/operations/meta-content-migration-runner.mjs",
  "src/lib/metaContentStagingMigrationPolicy.mjs",
  "scripts/operations/mobile-release-resource-readiness.mjs",
  "scripts/operations/mobile-signed-build-completion.mjs",
  "scripts/operations/prepare-mobile-device-acceptance.mjs",
  "apps/mobile/scripts/check-store-readiness.mjs",
  "docs/mobile/DEVICE_ACCEPTANCE.md",
  "docs/mobile/GOOGLE_PLAY_HANDOFF.md",
  "tests/mobile-device-acceptance-evidence.test.mjs",
  "tests/mobile-native-release-policy.test.mjs",
  "tests/mobile-store-privacy-policy.test.mjs",
  "scripts/final-go-live-preflight.mjs",
  "scripts/smoke-public-routes.mjs",
  "src/lib/workspaceAiTierStorage.mjs",
  "src/lib/workspaceAiTierEntitlements.ts",
  "src/lib/aiTierStripeLifecycle.mjs",
  "src/lib/aiTierStripeEventLedger.mjs",
  "src/lib/aiTierStripeEntitlementSync.mjs",
  "src/lib/stripeBillingEventLedger.mjs",
  "src/lib/stripeBillingEventSync.mjs",
  "src/lib/aiTierStagingAcceptancePolicy.mjs",
  "supabase/migrations/20260727090000_workspace_ai_tier_entitlements.sql",
  "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql",
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "src/lib/aiPromptPolicy.mjs",
  "src/lib/workspaceAiPrompts.ts",
  "src/app/api/ai/prompt-settings/route.ts",
  "src/app/api/ai/reply-suggestions/route.ts",
  "src/app/settings/ai-usage/AiPromptSettings.tsx",
  "tests/ai-tier-policy.test.mjs",
  "tests/ai-tier-recommendation.test.mjs",
  "tests/ai-tier-entitlement-storage.test.mjs",
  "tests/ai-tier-entitlement-migration-policy.test.mjs",
  "tests/ai-tier-stripe-lifecycle.test.mjs",
  "tests/ai-tier-stripe-entitlement-sync.test.mjs",
  "tests/ai-tier-stripe-event-ledger.test.mjs",
  "tests/ai-tier-stripe-event-ledger-control.test.mjs",
  "tests/stripe-billing-event-ledger.test.mjs",
  "tests/stripe-billing-event-sync.test.mjs",
  "tests/stripe-billing-event-ledger-control.test.mjs",
  "tests/ai-tier-staging-acceptance.test.mjs",
  "tests/meta-content-staging-migration.test.mjs",
  "tests/ai-prompt-policy.test.mjs",
  "tests/ai-prompt-integration-policy.test.mjs",
  "README.md",
  "AGENTS.md",
  "docs/operations/AI_TIER_STRIPE_EVENT_LEDGER.md",
  "docs/operations/STRIPE_BILLING_EVENT_LEDGER.md",
  "apps/mobile/README.md",
  "docs/mobile/ARCHITECTURE.md",
  "docs/mobile/BETA_RELEASE.md",
  "docs/mobile/PUSH_DELIVERY.md",
  "docs/mobile/STORE_LISTING.md",
  "src/lib/mobilePushDelivery.mjs",
  "src/lib/mobilePushDeliveryPolicy.mjs",
  "src/lib/mobilePushDeliveryTarget.ts",
  "tests/mobile-push-delivery.test.mjs",
  "docs/operations/P0_COMPLETION_TRACKER.md",
  "src/config/plans.ts",
  "src/lib/plans.ts",
  "src/lib/billing.ts",
  "src/lib/stripeBilling.ts",
  "src/lib/stripeWorkspacePolicy.mjs",
  "src/app/api/stripe/webhook/route.ts",
  "src/lib/referrals.ts",
  "src/lib/referralPolicy.mjs",
  "src/lib/aiUsagePolicy.mjs",
  "src/lib/aiUsage.ts",
  "src/lib/aiUsageProviderMetrics.mjs",
  "src/lib/aiUsageCostMetrics.mjs",
  "src/lib/aiUsageDashboardMetrics.mjs",
  "src/lib/adminAiUsage.ts",
  "src/app/admin/ai-usage/page.tsx",
  "src/app/admin/billing/adminBilling.module.css",
  "src/lib/demoTurnstilePolicy.mjs",
  "src/lib/demoProtection.ts",
  "src/lib/workspaceAiUsage.ts",
  "src/lib/workspaceNavigation.ts",
  "src/lib/fanmindCopy.ts",
  "src/app/register/page.tsx",
  "src/app/fans/[id]/analysisActions.ts",
  "src/lib/runtimeProductSettings.ts",
  "src/lib/publicDailyTestPlanPolicy.mjs",
  "src/app/admin/settings/page.tsx",
  "src/app/api/admin/settings/daily-test-plan/route.ts",
  "src/app/register/RegisterClient.tsx",
  "src/components/landing/FooterInquiryForm.tsx",
  "src/components/marketing/MarketingConsentManager.tsx",
  "src/lib/metaPixel.ts",
  "src/lib/metaPixelPolicy.mjs",
  "src/app/login/page.tsx",
  "src/app/landing-v2/page.tsx",
  "src/app/landing-v2/FaqAccordion.tsx",
  "src/app/brandMetadata.ts",
  "src/app/opengraph-image.tsx",
  "src/app/billing/start/page.tsx",
  "src/components/PlatformLogo.module.css",
  "src/components/FanMindFunctionIcon.tsx",
  "src/components/DemoTurnstile.tsx",
  "src/components/WorkspaceShell.tsx",
  "src/components/LegalTopHeader.tsx",
  "src/app/settings/AccountSections.tsx",
  "src/app/settings/AccountTabs.tsx",
  "src/app/settings/ai-usage/page.tsx",
  "src/app/fans/[id]/page.tsx",
  "src/app/agb/page.tsx",
  "src/app/zahlungsbedingungen/page.tsx",
  "src/app/datenschutz/page.tsx",
  "src/app/impressum/page.tsx",
  "src/app/avv/page.tsx",
  "src/app/referral-bedingungen/page.tsx",
  "src/app/settings/referral/page.tsx",
  "tests/referral-policy.test.mjs",
  "tests/commercial-model.test.mjs",
  "tests/ai-usage-policy.test.mjs",
  "tests/ai-usage-cost-metrics.test.mjs",
  "tests/ai-usage-dashboard-metrics.test.mjs",
  "tests/demo-turnstile-policy.test.mjs",
  "docs/SOURCE_OF_TRUTH.md",
  "docs/LEGAL_COMPLETION_STATUS.md",
  "docs/analytics/META_PIXEL.md",
  "docs/legal/AVV_WORKING_DRAFT.md",
  "docs/legal/RETENTION_REGISTER.md",
  "docs/legal/EXTERNAL_APPROVAL_REGISTER.md",
  "docs/legal/external-approval-evidence.json",
  "scripts/verify-legal-external-evidence.mjs",
  "scripts/legal/external-evidence-handoff.mjs",
  "tests/legal-external-evidence-handoff.test.mjs",
  "docs/database/fanmind_current_schema.md",
  "docs/SECURITY_RLS_SECRETS_CHECK.md",
  "docs/operations/AI_TIER_READINESS.md",
  "docs/operations/AI_TIER_DECISION_PROPOSAL.md",
  "docs/operations/AI_TIER_COST_AND_QUOTA_RECOMMENDATION.md",
  "docs/operations/AI_REPLY_QUALITY_EVAL.md",
  "docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md",
  "docs/operations/META_CONTENT_STAGING_MIGRATION.md",
];

const documentationFiles = new Set([
  "README.md",
  "docs/SOURCE_OF_TRUTH.md",
]);
const contents = new Map();
const errors = [];

for (const file of checkedFiles) {
  try {
    contents.set(file, await readFile(resolve(root, file), "utf8"));
  } catch (error) {
    errors.push(
      `${file}: Datei konnte nicht gelesen werden (${error instanceof Error ? error.message : "unbekannter Fehler"}).`,
    );
  }
}

function content(file) {
  return contents.get(file) ?? "";
}

function requireText(file, value, explanation) {
  if (!content(file).includes(value)) {
    errors.push(
      `${file}: ${explanation} Erwarteter Wert fehlt: ${JSON.stringify(value)}.`,
    );
  }
}

function forbidRuntime(pattern, explanation) {
  for (const [file, text] of contents) {
    if (documentationFiles.has(file)) continue;
    if (pattern.test(text)) errors.push(`${file}: ${explanation}`);
  }
}

function forbidIn(file, pattern, explanation) {
  if (pattern.test(content(file))) errors.push(`${file}: ${explanation}`);
}

// Der lokale reguläre Benutzerfluss ist ein Code-Nachweis, kein externer Ersatzbeleg.
for (const file of [
  "README.md",
  "docs/SOURCE_OF_TRUTH.md",
  "docs/testing/BROWSER_E2E.md",
]) {
  requireText(
    file,
    "npm run test:e2e:core-flow",
    "Der deterministische lokale Gerhard-Core-Flow muss dokumentiert sein.",
  );
}
requireText(
  "src/app/api/ai/prompt-settings/route.ts",
  "assertActivePromptManagement(context);",
  "KI-Prompt-Mutationen müssen auch für Owner und Admin bei pausierter Verarbeitung fail-closed bleiben.",
);
requireText(
  "src/lib/supabase/server.ts",
  "isServerBoundTemporaryDemoWorkspace(workspaceRow)",
  "Temporäre Demo-Abläufe müssen auch nach Manipulation client-editierbarer Auth-Metadaten serverseitig erkannt werden.",
);
requireText(
  ".github/workflows/browser-e2e.yml",
  "npm run test:e2e:core-flow",
  "Browser E2E muss den lokalen regulären Core-Flow in CI ausführen.",
);
requireText(
  "e2e-core-flow/regular-user-core-flow.spec.ts",
  'page.goto("/inbox")',
  "Der lokale Core-Flow muss die echte Inbox-Route abnehmen.",
);
requireText(
  "docs/operations/ROADMAP_1_7_COMPLETION.md",
  "Die isolierte Staging-, echte Provider- und",
  "Die Roadmap muss lokalen Code-Nachweis und externe Abnahme trennen.",
);
requireText(
  ".github/workflows/browser-e2e-staging-write.yml",
  "run-staging-core-csv-acceptance",
  "Die reale Staging-Kernabnahme muss explizit und commitgebunden bestätigt werden.",
);
for (const field of [
  "STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY",
  "STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND",
  "STAGING_DATABASE_ROLLOUT_AI_TIER",
  "STAGING_DATABASE_ROLLOUT_MOBILE_PUSH",
  "STAGING_DATABASE_ROLLOUT_META_CONTENT",
  "STAGING_DATABASE_ROLLOUT_META_CATCHUP",
  "STAGING_DATABASE_ROLLOUT_META_CONTINUATION",
  "STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING",
  "STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION",
  "STAGING_DATABASE_ROLLOUT_STATE",
]) {
  requireText(
    "scripts/operations/canonicalize-staging-rollout-evidence.mjs",
    `"${field}"`,
    `Der Staging-Rollout-Beleg muss das kanonische Feld ${field} vollständig binden.`,
  );
}
requireText(
  "scripts/operations/canonicalize-staging-rollout-evidence.mjs",
  'values.get("STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION") !== "disabled"',
  "Der kanonische Staging-Rollout-Beleg muss generische Migrationen fail-closed deaktiviert verlangen.",
);
requireText(
  "scripts/operations/canonicalize-staging-rollout-evidence.mjs",
  'values.get("STAGING_DATABASE_ROLLOUT_STATE") !== "PASS"',
  "Der kanonische Staging-Rollout-Beleg darf ausschließlich einen vollständigen PASS-Zustand akzeptieren.",
);
requireText(
  ".github/workflows/browser-e2e-staging-write.yml",
  "STAGING_CORE_CSV_FINAL_RELEASE=PASS",
  "Die reale Staging-Kernabnahme muss Release und Runtime nach Cleanup erneut binden.",
);
requireText(
  ".github/workflows/browser-e2e-staging-write.yml",
  "STAGING_CORE_CSV_MEMBER_BOUNDARY_POSTFLIGHT=PASS",
  "Die reale Staging-Kernabnahme muss die Member-Datengrenze nach Cleanup erneut nachweisen.",
);
requireText(
  "e2e-staging-write/core-csv.spec.ts",
  'page.goto("/fans/import")',
  "Die reale Staging-Kernabnahme muss den CSV-Import über die echte Route prüfen.",
);
requireText(
  "docs/testing/BROWSER_E2E.md",
  "Ein grüner Repositorytest oder Merge ersetzt den tatsächlichen",
  "Die Dokumentation darf die vorbereitete Staging-Abnahme nicht als ausgeführt darstellen.",
);
forbidIn(
  ".github/workflows/browser-e2e-staging-write.yml",
  /(?<!FANMIND_PRODUCTION_API_ORIGIN: )https:\/\/(?:www\.)?fanmind\.ch|FANMIND_RUNTIME_ENVIRONMENT:\s*production/iu,
  "Die schreibende Browser-Abnahme darf kein Production-Ziel enthalten.",
);

// The Staging member credential exists only inside the protected hosted job.
for (const command of [
  '"staging:member-credential:check": "node scripts/operations/staging-ephemeral-member-credential.mjs --check"',
  '"staging:member-credential:generate": "node scripts/operations/staging-ephemeral-member-credential.mjs --generate"',
  '"staging:member-credential:activate": "node scripts/operations/staging-ephemeral-member-credential.mjs --activate"',
  '"staging:member-credential:revoke": "node scripts/operations/staging-ephemeral-member-credential.mjs --revoke"',
]) {
  requireText(
    "package.json",
    command,
    "Der kurzlebige Member-Zugang muss getrennte Offline-, Generate-, Activate- und Revoke-Befehle besitzen.",
  );
}
for (const fragment of [
  "id: member_credential_generation",
  "staging:member-credential:generate",
  "id: member_credential_activation",
  "staging:member-credential:activate",
  "id: member_credential_cleanup",
  "always() && steps.member_credential_generation.outcome == 'success'",
  "staging:member-credential:revoke",
  "steps.member_credential_cleanup.outcome == 'success'",
  "unset http_proxy https_proxy all_proxy",
  "trap clear_member_environment EXIT",
  "FANMIND_STAGING_E2E_MEMBER_PASSWORD=",
  "FANMIND_E2E_STAGING_MEMBER_PASSWORD=",
]) {
  requireText(
    ".github/workflows/browser-e2e-staging-write.yml",
    fragment,
    "Die Kern-/CSV-Abnahme muss den kurzlebigen Member-Zugang fail-closed aktivieren und immer widerrufen.",
  );
}
forbidIn(
  ".github/workflows/browser-e2e-staging-write.yml",
  /secrets\.FANMIND_STAGING_E2E_MEMBER_PASSWORD/u,
  "Die Kern-/CSV-Abnahme darf kein persistentes Member-Passwort lesen.",
);
forbidIn(
  ".github/workflows/browser-e2e-staging-write.yml",
  /^\s*<<\s*:/mu,
  "GitHub Actions unterstützt keine YAML-Merge-Keys; Step-Umgebungen müssen explizit oder als vollständiger Alias vorliegen.",
);
forbidIn(
  ".github/workflows/browser-e2e-staging-write.yml",
  /^\s+(?:http_proxy|https_proxy|all_proxy):/mu,
  "Case-insensitive Proxy-Doppelkeys dürfen nicht im Workflow-Environment stehen; lowercase Werte werden im Step-Prozess geleert.",
);
for (const fragment of [
  "::add-mask::${password}",
  "environment.GITHUB_ENV",
  "constants.O_NOFOLLOW",
  "const initialStat = fstatSync(descriptor)",
  "initialStat.nlink !== 1",
  "fchmodSync(descriptor, 0o600)",
  "stat.nlink !== 1",
  "(stat.mode & 0o777) !== 0o600",
  "FANMIND_STAGING_E2E_MEMBER_PASSWORD=${password}",
  "FANMIND_E2E_STAGING_MEMBER_PASSWORD=${password}",
  "STAGING_EPHEMERAL_MEMBER_KNOWN_PASSWORD_REJECTED=PASS",
]) {
  requireText(
    "scripts/operations/staging-ephemeral-member-credential.mjs",
    fragment,
    "Das Member-Passwort muss ausschließlich maskiert und über die kurzlebige Runner-Umgebung gebunden werden.",
  );
}
for (const fragment of [
  'STAGING_EPHEMERAL_MEMBER_MARKER = "ai_member"',
  '"/rest/v1/profiles"',
  '"/rest/v1/workspace_members"',
  '"/rest/v1/workspaces"',
  "JSON.stringify({ password })",
  "resolveFixedMemberProfile",
  "verifyMarkedMemberAfterUpdate",
  "compensateBoundMemberPassword",
  '"admin_update_indeterminate_compensated"',
  '"post_update_contract_drift_compensated"',
  'code !== "invalid_credentials"',
  '"/auth/v1/logout?scope=global"',
]) {
  requireText(
    "src/lib/stagingEphemeralMemberCredentialPolicy.mjs",
    fragment,
    "Der Service-Role-Helper muss Zielidentität, Marker, Membership und bekannte Passwortablehnung eng prüfen.",
  );
}
for (const fragment of [
  "GITHUB_ENV hardlink is rejected before any credential append",
  "profile binding drift after PUT stays red",
  "membership drift after PUT stays red",
  "workspace drift after PUT stays red",
  "accepted-then-timeout Admin PUT stays red",
  "compensation failure remains red",
  "never reads owner or secondary credentials",
]) {
  requireText(
    "tests/staging-ephemeral-member-credential.test.mjs",
    fragment,
    "Die kurzlebige Member-Rotation muss Dateiangriffe, Ziel-Drift und unbestimmte Providerwrites fail-closed regressionsprüfen.",
  );
}
requireText(
  "docs/operations/STAGING_EPHEMERAL_MEMBER_CREDENTIAL.md",
  "Kompensationsrotation",
  "Das Runbook muss den fehlenden persistenten Member-Secret-Vertrag ausdrücklich festhalten.",
);
requireText(
  "docs/operations/STAGING_EPHEMERAL_MEMBER_CREDENTIAL.md",
  "kein persistentes Member-Passwort",
  "Das Runbook muss den fehlenden persistenten Member-Secret-Vertrag ausdrücklich festhalten.",
);

// Staging email is a provider-only synthetic proof, never a global app switch.
for (const command of [
  '"staging:email:check": "node scripts/operations/staging-email-provider-acceptance.mjs --check"',
  '"staging:email:preflight": "node scripts/operations/staging-email-provider-acceptance.mjs --preflight"',
  '"staging:email:send": "node scripts/operations/staging-email-provider-acceptance.mjs --send"',
]) {
  requireText(
    "package.json",
    command,
    "Die isolierte Staging-E-Mail-Abnahme muss explizite Check-, Preflight- und Send-Befehle besitzen.",
  );
}
for (const fragment of [
  "validate-dispatch:",
  "needs: validate-dispatch",
  "environment: staging-email-acceptance",
  "send-one-staging-email-provider-acceptance",
  "FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY: ''",
  "GITHUB_TOKEN: ${{ github.token }}",
  "unset GITHUB_TOKEN",
  "--preflight",
  "--send",
]) {
  requireText(
    ".github/workflows/staging-email-provider-acceptance.yml",
    fragment,
    "Der E-Mail-Providerlauf muss Dispatch, geschütztes Environment und getrennte GitHub-/Resend-Token fail-closed binden.",
  );
}
forbidIn(
  ".github/workflows/staging-email-provider-acceptance.yml",
  /^\s{2}(?:push|schedule|workflow_call):/mu,
  "Die E-Mail-Providerabnahme darf ausschließlich manuell gestartet werden.",
);
for (const fragment of [
  '"delivered+fanmind-staging@resend.dev"',
  '"FanMind Staging <acceptance@mail.staging.fanmind.ch>"',
  '`${STAGING_EMAIL_ACCEPTANCE_APP_ORIGIN}/api/health`',
  'emailChecks[0]?.status !== "unknown"',
  '"send_indeterminate"',
  "response.body.getReader()",
  'Object.keys(payload).sort().join(",") !== "from,subject,text,to"',
]) {
  requireText(
    "src/lib/stagingEmailProviderAcceptancePolicy.mjs",
    fragment,
    "Der Providerpfad muss feste Testdaten, mailfreie App-Runtime, harte Response-Grenzen und unklaren Sendestatus binden.",
  );
}
forbidIn(
  ".github/workflows/provision-staging-host.yml",
  /RESEND_API_KEY|FANMIND_NOTIFICATION_FROM|STAGING_RESEND/u,
  "Die normale Staging-Provisionierung darf keinen globalen E-Mail-Provider in die öffentliche App tragen.",
);
requireText(
  ".env.staging.example",
  "RESEND_API_KEY=\nFANMIND_NOTIFICATION_FROM=",
  "Die Staging-App-Vorlage muss beide globalen Mailwerte leer lassen.",
);
forbidIn(
  "src/lib/stagingEmailProviderAcceptancePolicy.mjs",
  /(?:Fanmind|kontakt)@fanmind\.ch/iu,
  "Die synthetische Providerabnahme darf kein echtes FanMind-Postfach adressieren.",
);
requireText(
  "docs/operations/STAGING_EMAIL_PROVIDER_ACCEPTANCE.md",
  "keine Resend-Fernattestierung",
  "Die Doku muss den operatorseitigen Domain-Scope-Beleg ehrlich von technischer Fernattestierung trennen.",
);
requireText(
  "docs/operations/STAGING_EMAIL_PROVIDER_ACCEPTANCE.md",
  "nicht ausgeführt",
  "Die vorbereitete E-Mail-Abnahme darf ohne echten Providerlauf nicht als erledigt gelten.",
);

// Member data boundary stays externally unapplied until the controlled Staging evidence exists.
requireText(
  "package.json",
  '"db:workspace-member-data-boundary:check": "node scripts/operations/workspace-member-data-boundary-runner.mjs --check"',
  "Die Member-Datengrenze muss einen checksum-gebundenen Offline-Check besitzen.",
);
requireText(
  "package.json",
  '"db:workspace-member-data-boundary:verify": "node scripts/operations/workspace-member-data-boundary-runner.mjs --verify"',
  "Die Member-Datengrenze muss einen getrennten read-only Verify besitzen.",
);
requireText(
  "package.json",
  '"db:workspace-member-data-boundary:apply": "node scripts/operations/workspace-member-data-boundary-runner.mjs --apply"',
  "Die Member-Datengrenze muss einen getrennten kontrollierten Apply besitzen.",
);
requireText(
  "docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md",
  "Status: `CHECKED_NOT_APPLIED`.",
  "Der Member-Control darf ohne externen Apply-/Postflight-Beleg nicht als angewendet gelten.",
);
for (const file of ["README.md", "docs/SOURCE_OF_TRUTH.md"]) {
  requireText(
    file,
    "Go-live- und Member-Aktivierungsblocker",
    `Die direkte Member-JWT-/RLS-Grenze muss in ${file} bis zum Apply ausdrücklich offen bleiben.`,
  );
}
requireText(
  "scripts/operations/workspace-member-data-boundary-runner.mjs",
  "WORKSPACE_MEMBER_DATA_BOUNDARY_DATABASE_WRITE=not_performed",
  "Der Offline-Modus muss ausdrücklich bestätigen, dass er keine Datenbank schreibt.",
);
for (const file of [
  "scripts/operations/workspace-member-data-boundary-runner.mjs",
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql",
]) {
  requireText(
    file,
    "20260809141141",
    `${file} muss den realen kontrollierten server-owned-Ledgerbeleg exakt binden.`,
  );
}
for (const [file, confirmation] of [
  [
    ".github/workflows/workspace-member-data-boundary-staging-apply.yml",
    "apply-workspace-member-data-boundary",
  ],
  [
    ".github/workflows/workspace-member-data-boundary-staging-verify.yml",
    "verify-workspace-member-data-boundary",
  ],
]) {
  requireText(file, "environment: staging", `${file} muss Staging-geschützt sein.`);
  requireText(file, confirmation, `${file} muss eine eigene exakte Bestätigung verlangen.`);
  requireText(file, "/api/version", `${file} muss den deployten App-Commit zuerst binden.`);
  requireText(file, "/api/health", `${file} muss den deployten App-Zustand vor DB-Zugriff prüfen.`);
}
for (const table of [
  "contacts",
  "memories",
  "followups",
  "conversations",
  "conversation_messages",
  "conversation_summaries",
  "contact_reply_targets",
  "ai_usage_events",
  "content_sources",
  "fan_analysis_reports",
  "contact_ai_profiles",
  "workspace_voice_profiles",
]) {
  requireText(
    "scripts/operations/workspace-member-data-boundary-runner.mjs",
    `"${table}"`,
    `Der Member-Control muss die direkte Schreibgrenze für ${table} festschreiben.`,
  );
}
requireText(
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql",
  "get_current_workspace_member_safe_dashboard()",
  "Member müssen eine minimale parameterlose Workspace-Projektion verwenden.",
);
requireText(
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql",
  "workspace_analysis_settings_select_requires_workspace_owner",
  "Member dürfen keine administrativen Legal-, DPA-, Retention- oder Bestätigerfelder lesen.",
);
for (const file of [
  "src/app/fans/actions.ts",
  "src/app/fans/[id]/contextActions.ts",
  "src/app/inbox/actions.ts",
  "src/app/api/ai/reply-suggestions/route.ts",
]) {
  forbidIn(
    file,
    /requireActiveAuthorizedWorkspaceMember|requireContactInActiveAuthorizedWorkspaceMember/u,
    `Member-Schreib- und KI-Pfade müssen in ${file} explizit Owner-only bleiben.`,
  );
}
for (const file of [
  "src/app/channels/facebookWebhookActions.ts",
  "src/app/channels/instagramWebhookActions.ts",
]) {
  requireText(
    file,
    'import "server-only";',
    `Low-Level-Meta-Sync in ${file} darf keine browseraufrufbare Server Action sein.`,
  );
}
requireText(
  "src/app/channels/metaSyncActions.ts",
  "requireActiveAuthorizedWorkspace();",
  "Die einzige clientimportierte Meta-Sync-Action muss Owner und aktive Verarbeitung erneut prüfen.",
);
for (const file of [
  "src/app/channels/facebook/select/page.tsx",
  "src/app/api/integrations/facebook/start/route.ts",
  "src/app/api/integrations/facebook/callback/route.ts",
  "src/app/api/integrations/facebook/select/route.ts",
  "src/app/api/integrations/instagram/start/route.ts",
  "src/app/api/integrations/instagram/callback/route.ts",
  "src/app/api/webhooks/meta/self-test/route.ts",
]) {
  requireText(
    file,
    "requireActiveAuthorizedWorkspace();",
    `Meta-OAuth, Auswahl und Synthetic Writes müssen in ${file} Owner und aktive Verarbeitung erneut prüfen.`,
  );
}
requireText(
  "e2e-staging-write/core-csv.spec.ts",
  "memberIdempotentContactMutationRows",
  "Die reale Staging-Abnahme muss eine direkte Member-JWT-Mutation fail-closed prüfen.",
);
requireText(
  "e2e-staging-write/core-csv.spec.ts",
  "Teamzugang im Nur-Lese-Modus.",
  "Die reale Staging-Abnahme muss den sichtbaren Member-Nur-Lese-Vertrag prüfen.",
);
forbidIn(
  "e2e-staging-write/core-csv.spec.ts",
  /getByRole\("button", \{ name: "Als erledigt markieren" \}\)\s*\.click\(\)/u,
  "Die echte Staging-Abnahme darf keine Member-Follow-up-Mutation mehr ausführen.",
);
requireText(
  "docs/operations/WEBSITE_CHAT_FOUNDATION.md",
  "noch keinen atomaren\n  Processing-Entitlement-Check",
  "Website Chat muss bis zum atomaren DB-Processing-Gate ausdrücklich deaktiviert bleiben.",
);

// WhatsApp Cloud bleibt ein explizit deaktivierter Non-Production-Inbound-Pfad.
requireText(
  "package.json",
  '"db:whatsapp-cloud-inbound:check": "node scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs --check"',
  "Die WhatsApp-Controlled-Migration muss checksum-gepinnt offline prüfbar registriert sein.",
);
requireText(
  "package.json",
  '"db:whatsapp-cloud-inbound:verify": "node scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs --verify"',
  "WhatsApp muss einen getrennten read-only Staging-Verify besitzen.",
);
requireText(
  "package.json",
  '"db:whatsapp-cloud-inbound:apply": "node scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs --apply"',
  "WhatsApp muss einen getrennten geschützten Staging-Apply besitzen.",
);
requireText(
  "src/lib/whatsappCloudInboundPolicy.mjs",
  'reason: runtime === "production" ? "production_forbidden" : "runtime_unknown"',
  "Die WhatsApp-Inbound-Policy muss Production auch bei gesetztem Flag sperren.",
);
requireText(
  "src/lib/whatsappCloudInboundPolicy.mjs",
  'return invalidPayload("duplicate_message_conflict")',
  "Widersprüchliche providerinterne Message-ID-Duplikate müssen fail-closed bleiben.",
);
requireText(
  "src/lib/whatsappCloudInboundPolicy.mjs",
  `event?.sourcePlatform,
    event?.sourceType,
    event?.messageType,
    event?.messageKind,
    event?.direction,
    event?.content,
    event?.externalMessageId,
    event?.externalThreadId,
    event?.authorLabel,
    event?.phoneNumberId,
    event?.senderId,
    event?.receivedAt,`,
  "Der WhatsApp-Fingerprint muss die zwölf normalisierten Eventfelder in exakter Reihenfolge binden.",
);
requireText(
  "src/lib/whatsappCloudInboundPolicy.mjs",
  '.map((value) => `${Buffer.byteLength(value, "utf8")}:${value}`)',
  "Der WhatsApp-Fingerprint muss jedes normalisierte Feld mit seiner UTF-8-Bytelänge rahmen.",
);
requireText(
  "src/app/api/webhooks/whatsapp/route.ts",
  "WHATSAPP_CLOUD_APP_SECRET",
  "Der WhatsApp-Webhook muss ein getrenntes App Secret verwenden.",
);
requireText(
  "src/lib/whatsappWebhook.ts",
  "storeWhatsAppCloudInboundMessage",
  "WhatsApp-Inbound darf nur den atomaren Store-RPC verwenden.",
);
requireText(
  "src/lib/channelSources.ts",
  'statusText: "Vorbereitet · Inbound-Text standardmäßig aus"',
  "Die Kanalwahrheit darf den deaktivierten WhatsApp-Textpfad nicht als live oder medienfähig darstellen.",
);
forbidIn(
  "src/lib/channelSources.ts",
  /whatsapp_messages:\s*\{[\s\S]{0,800}?mediaSupported:\s*true/iu,
  "Der vorbereitete WhatsApp-Textpfad darf keine Medienunterstützung behaupten.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "force row level security",
  "WhatsApp-Receipts müssen FORCE RLS verwenden.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "and receipt.lease_token = p_lease_token",
  "Der atomare WhatsApp-Store muss exakt an das aktuelle Lease-Token gebunden sein.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "workspace_allowed := public.workspace_processing_allowed_contract(",
  "Der atomare WhatsApp-Store muss den kanonischen Processing-Vertrag verwenden.",
);
for (const fragment of [
  "add column whatsapp_social_connection_id uuid",
  "add column whatsapp_phone_number_id text",
  "add column whatsapp_payload_fingerprint text",
]) {
  requireText(
    "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
    fragment,
    "WhatsApp muss Message und Receipt an Connection, Phone-ID, WAMID und Payload-Fingerprint binden.",
  );
}
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  `create unique index conversation_messages_whatsapp_identity_unique_idx
  on public.conversation_messages (
    whatsapp_social_connection_id,
    whatsapp_phone_number_id,
    external_message_id
  )`,
  "Die gespeicherte WhatsApp-Nachrichtenidentity muss exakt Connection, Phone-ID und WAMID umfassen.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  `constraint whatsapp_cloud_receipt_identity_unique unique (
    social_connection_id,
    phone_number_id,
    external_message_id
  )`,
  "Die WhatsApp-Receipt-Identity muss exakt Connection, Phone-ID und WAMID umfassen.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "expected_payload_fingerprint := pg_catalog.encode(",
  "Der atomare Store muss den normalisierten SHA-256-Payload-Fingerprint unabhängig nachrechnen.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  `connection_bound_thread_id :=
    p_social_connection_id::text || ':' || normalized_thread_id;`,
  "WhatsApp-Threads müssen an die konkrete Social Connection gebunden bleiben.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  `connection_bound_contact_handle :=
    p_social_connection_id::text || ':' || normalized_sender_id;`,
  "WhatsApp-Kontakte müssen an die konkrete Social Connection gebunden bleiben.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "claimed_receipt.payload_fingerprint is distinct from",
  "Der atomare Store muss Payload-Drift am geclaimten Receipt fail-closed erkennen.",
);
requireText(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  "on delete set null (conversation_message_id)",
  "Eine CRM-Nachrichtenlöschung muss den WhatsApp-Receipt als Anti-Resurrection-Tombstone erhalten.",
);
forbidIn(
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql",
  /create unique index conversation_messages_whatsapp_external_message_unique_idx/iu,
  "Die veraltete workspaceweite WhatsApp-WAMID-Identity darf nicht neu angelegt werden.",
);
requireText(
  "src/app/api/webhooks/whatsapp/route.ts",
  'result.errorCode === "idempotency_conflict"',
  "Ein WhatsApp-Payload-Drift muss als eigener Idempotenzkonflikt behandelt werden.",
);
requireText(
  "src/app/api/webhooks/whatsapp/route.ts",
  "? 409",
  "Ein WhatsApp-Payload-Drift muss öffentlich HTTP 409 liefern.",
);
requireText(
  "scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs",
  "WHATSAPP_CLOUD_INBOUND_DATABASE_WRITE=not_performed",
  "Der WhatsApp-Offline-Check muss jeden Datenbankschreibvorgang ausdrücklich ausschließen.",
);
requireText(
  "docs/integrations/WHATSAPP_CLOUD_INBOUND.md",
  "Die Controlled Migration wurde nicht",
  "Das WhatsApp-Runbook muss den nicht angewendeten Schema-Stand ehrlich ausweisen.",
);
requireText(
  "docs/integrations/WHATSAPP_CLOUD_INBOUND.md",
  "wurde weder mit einem realen Meta-Konto\nnoch in Staging extern abgenommen",
  "Das WhatsApp-Runbook darf keinen realen Meta- oder Staging-Lauf vortäuschen.",
);
requireText(
  "docs/integrations/WHATSAPP_CLOUD_INBOUND.md",
  "Receipt-Tombstone-Aufbewahrung einschließlich Löschlauf extern",
  "Das WhatsApp-Runbook muss die noch offene externe Tombstone-Retention ausdrücklich ausweisen.",
);
requireText(
  "ops/nginx/fanmind-staging.http.conf",
  `location = /api/webhooks/whatsapp {
        access_log off;
        error_log /dev/null crit;
        proxy_pass http://127.0.0.1:3001;`,
  "Der versionierte Staging-vHost muss die exakte WhatsApp-Route aus Access- und route-lokalen Error-Logs ausschließen.",
);
for (const fragment of [
  "WHATSAPP_TLS_BOUNDARY",
  "scripts/operations/verify-staging-nginx-whatsapp-boundary.awk",
  'expected_certificate="$STAGING_CERTIFICATE"',
  'expected_certificate_key="$STAGING_CERTIFICATE_KEY"',
  'if [ "$WHATSAPP_TLS_BOUNDARY" != "valid" ]; then',
  "Existing staging TLS virtual host lacks the exact WhatsApp query-redaction boundary.",
]) {
  requireText(
    ".github/workflows/provision-staging-host.yml",
    fragment,
    "Die Host-Provisionierung muss bei einer fehlenden oder abweichenden WhatsApp-Loggrenze fail-closed stoppen.",
  );
}
for (const fragment of [
  "function without_comment(",
  "function brace_count(",
  "function normalized_decimal_port(",
  "server_insecure_443_listens == 0",
  "server_ipv6_443_listens <= 1",
  'normalized == "listen 443 ssl;"',
  'normalized == "server_name staging.fanmind.ch;"',
  'normalized == "location = /api/webhooks/whatsapp {"',
  'normalized == "access_log off;"',
  'normalized == "proxy_set_header Connection \\"upgrade\\";"',
  "location_unknown_directives == 0",
  "server_request_flow_directives == 0",
  "port_443_servers != 1",
  "global_whatsapp_path_locations != 1",
]) {
  requireText(
    "scripts/operations/verify-staging-nginx-whatsapp-boundary.awk",
    fragment,
    "Der nginx-Verifier muss TLS-Host und WhatsApp-Loggrenze strukturell im selben eindeutigen Serverblock binden.",
  );
}
for (const fragment of [
  "protectedHttpButLoggedTls",
  "quotedBraceDepthBypass",
  "duplicateHttpLocation",
  "splitServerDeclarationBypass",
  "splitListenDirectiveBypass",
  "splitAccessLogDirectiveBypass",
  "rewriteRedirectBypass",
  "serverRewriteBypass",
  "closeThenServerRewriteBypass",
  "quotedListen443Bypass",
  "leadingZeroListen443Bypass",
  "addressLeadingZeroListen443Bypass",
  "ipv6ListenWithoutSsl",
]) {
  requireText(
    "tests/staging-deploy-policy.test.mjs",
    fragment,
    "Die nginx-Policy muss verteilte und parserverfälschende Loggrenzen regressionsprüfen.",
  );
}
requireText(
  "src/lib/webhookSecurityPolicy.mjs",
  '"idempotency_conflict",',
  "Der geprüfte WhatsApp-Idempotenzkonflikt muss als sichere Diagnoseklasse erhalten bleiben.",
);
requireText(
  "tests/webhook-security-policy.test.mjs",
  "idempotency conflict remains a reviewed diagnostic error code",
  "Die sichere WhatsApp-Konfliktdiagnose muss regressionsgeprüft sein.",
);
requireText(
  "docs/operations/STAGING_PROVISIONING.md",
  "jedes später vorgeschaltete CDN, WAF oder Load-Balancer eine gleichwertige",
  "Das Staging-Runbook muss die Query-Redaktionsgrenze auf künftige Edge-Systeme ausdehnen.",
);
requireText(
  "docs/security/WEBHOOK_LOG_RETENTION.md",
  "Social-Connection-ID,\n`phone_number_id`, WAMID und der SHA-256-Fingerprint",
  "Der Retention-Vertrag muss die erhaltene WhatsApp-Tombstone-Identity benennen.",
);
requireText(
  "tests/whatsapp-cloud-inbound.test.mjs",
  "route authenticates bounded raw bytes before JSON and has no secret fallbacks",
  "Signaturreihenfolge, Secret-Trennung und Outbound-Sperre müssen regressionsgeprüft sein.",
);
forbidIn(
  "src/app/api/webhooks/whatsapp/route.ts",
  /fetch\s*\(|send(?:Message|_message)|graph\.facebook/iu,
  "Der WhatsApp-Inbound-Endpoint darf keine Provider- oder Sendelogik enthalten.",
);
for (const [file, confirmation] of [
  [
    ".github/workflows/whatsapp-cloud-inbound-staging-apply.yml",
    "apply-whatsapp-cloud-inbound",
  ],
  [
    ".github/workflows/whatsapp-cloud-inbound-staging-verify.yml",
    "verify-whatsapp-cloud-inbound",
  ],
]) {
  requireText(file, "workflow_dispatch:", `${file} darf nur manuell starten.`);
  requireText(file, "environment: staging", `${file} muss Staging-geschützt sein.`);
  requireText(file, confirmation, `${file} muss eine eigene exakte Bestätigung verlangen.`);
  requireText(file, "/api/version", `${file} muss den deployten App-Commit zuerst binden.`);
  requireText(file, "/api/health", `${file} muss die Staging-Gesundheit vor DB-Zugriff prüfen.`);
  requireText(
    file,
    "STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify",
    `${file} muss die vollständige Member-Boundary hart voraussetzen.`,
  );
  forbidIn(
    file,
    /WHATSAPP_CLOUD_(?:APP_SECRET|WEBHOOK_VERIFY_TOKEN)/u,
    `${file} darf keine Provider-Secrets laden.`,
  );
}

// Alte oder widersprüchliche öffentliche Wahrheit.
forbidRuntime(
  /299\s*€\s*\/\s*Monat/iu,
  "Veralteter Starter-Preis 299 €/Monat gefunden.",
);
forbidRuntime(
  /499\s*€\s*\/\s*Monat/iu,
  "Veralteter Growth-Preis 499 €/Monat gefunden.",
);
forbidRuntime(
  /Agency\s+ab\s+990\s*€\s*\/\s*Monat/iu,
  "Veralteter Agency-Preis gefunden.",
);
forbidRuntime(
  /kontakt@fanmind\.de/iu,
  "Veraltete .de-Kontaktadresse gefunden.",
);
forbidRuntime(
  /(?:Fanmind|hello)@fanmind\.ch/iu,
  "Uneinheitliche Kontaktadresse gefunden; nutze kontakt@fanmind.ch.",
);
forbidRuntime(
  /Ehrliche Roadmap/iu,
  "Öffentliche Roadmap darf nicht als Ehrliche Roadmap bezeichnet werden.",
);
forbidRuntime(
  /Unified Inbox Timeline/iu,
  "Nicht aktive Inbox-Synchronisierung darf nicht als Unified Inbox bezeichnet werden.",
);
forbidRuntime(
  /FanMind e\.U\./u,
  "Der Zusatz e.U. darf ohne bestätigte Firmenbucheintragung nicht veröffentlicht werden.",
);

// Restore evidence must bind schema and RLS success to the machine postcheck.
requireText(
  "package.json",
  '"restore:database:postcheck": "node scripts/operations/restore-database-postcheck-receipt.mjs"',
  "Der Restore-Postcheck muss als fester Operations-Befehl registriert sein.",
);
for (const table of [
  "contacts",
  "followups",
  "memories",
  "workspace_members",
  "workspaces",
]) {
  requireText(
    "scripts/operations/restore-database-postcheck-receipt.mjs",
    `"${table}"`,
    `Der Datenbank-Postcheck muss die Kerntabelle ${table} fest prüfen.`,
  );
}
requireText(
  "scripts/operations/run-database-restore-drill.sh",
  "fanmind_required_restore_tables",
  "Der Restore-Runner muss den festen Post-Restore-Katalogcheck ausführen.",
);
requireText(
  "scripts/operations/run-database-restore-drill.sh",
  "FANMIND_RESTORE_DATABASE_POSTCHECK_RECEIPT_PATH",
  "Der Restore-Runner muss einen getrennten privaten Postcheck-Beleg verlangen.",
);
requireText(
  "scripts/operations/verify-restore-drill-evidence.mjs",
  "evidence.schemaVersion !== 6",
  "Der Restore-Evidence-Validator muss ausschließlich Schema 6 akzeptieren.",
);
requireText(
  "scripts/operations/verify-restore-drill-evidence.mjs",
  "databasePostcheckReceiptSha256",
  "Der Restore-Evidence-Validator muss den Postcheck-Beleg per SHA-256 binden.",
);
requireText(
  "tests/restore-drill-evidence.test.mjs",
  "database postcheck hash, identity, counts and timestamps are bound",
  "Die Postcheck-Bindung muss automatisiert regressionsgeprüft sein.",
);
requireText(
  "docs/operations/RESTORE_DRILL.md",
  "`coreSchemaChecks: \"passed\"` or manual",
  "Das Runbook muss manuelle Kernschema-Freigaben ausdrücklich ablehnen.",
);
requireText(
  "docs/operations/RESTORE_DRILL.md",
  "manual `rlsVerification: \"passed\"`",
  "Das Runbook muss manuelle RLS-Freigaben ausdrücklich ablehnen.",
);

// Starter-Preise und zentrale Billing-Werte.
requireText(
  "src/config/plans.ts",
  "312 €/Monat",
  "Die zentrale Paketkonfiguration muss die Starter-Grundgebühr enthalten.",
);
requireText(
  "src/lib/plans.ts",
  "monthlyFeeCents: 31200",
  "Die Commercial-Terms-Logik muss 31.200 Cent Monatsgebühr verwenden.",
);
requireText(
  "src/lib/stripeBilling.ts",
  "monthlyFeeCents: 31200",
  "Stripe-Billing muss mit 31.200 Cent Monatsgebühr arbeiten.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  'name: "Starter Flex"',
  "Die Landingpage muss Starter Flex aktiv zeigen.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  'name: "Starter 12 Monate"',
  "Die Landingpage muss Starter 12 Monate aktiv zeigen.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  "990 € Setup + 312 €/Monat",
  "Starter Flex muss die freigegebene Preislogik verwenden.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  "12 Monate Mindestlaufzeit · danach monatliche Verlängerung",
  "Starter 12 Monate muss die Verlängerungslogik offenlegen.",
);
requireText(
  "src/app/agb/page.tsx",
  "Starter Flex:",
  "Die AGB müssen Starter Flex nennen.",
);
requireText(
  "src/app/agb/page.tsx",
  "Starter 12 Monate:",
  "Die AGB müssen Starter 12 Monate nennen.",
);
requireText(
  "src/app/zahlungsbedingungen/page.tsx",
  'getCommercialTerms("starter_paid_setup")',
  "Die Zahlungsbedingungen müssen zentrale Starter-Werte laden.",
);
requireText(
  "src/app/zahlungsbedingungen/page.tsx",
  "starterFlexTerms.monthlyFeeCents",
  "Die Zahlungsbedingungen müssen die zentrale Monatsgebühr rendern.",
);

// Entgeltliches Pilot-Paket ist öffentlich eingestellt.
forbidIn(
  "src/app/landing-v2/page.tsx",
  /name:\s*["']Pilot \/ Setup["']|990 € einmalig\s*·\s*zzgl\. USt\./iu,
  "Die Landingpage darf das eingestellte Pilot-/Setup-Paket nicht mehr anbieten.",
);
forbidIn(
  "src/app/settings/AccountSections.tsx",
  /name:\s*["']Pilot \/ Setup["']|key:\s*["']pilot_only["']/iu,
  "Die Paketansicht darf das eingestellte Pilot-Paket nicht mehr anbieten.",
);
forbidIn(
  "src/app/register/RegisterClient.tsx",
  /title:\s*["']Pilot \/ Setup starten["']|price:\s*["']990 € einmalig · 1 Testmonat["']/iu,
  "Die öffentliche Registrierung darf keine Pilot-Paketkarte mehr enthalten.",
);
forbidIn(
  "src/app/zahlungsbedingungen/page.tsx",
  /title:\s*["']Pilot \/ Setup["']|Pilot \/ Setup kostet/iu,
  "Die Zahlungsbedingungen dürfen das eingestellte Pilot-Paket nicht mehr anbieten.",
);
forbidIn(
  "src/app/agb/page.tsx",
  /<strong>Pilot \/ Setup:<\/strong>/iu,
  "Die AGB dürfen das eingestellte Pilot-Paket nicht mehr als Preisoption führen.",
);
requireText(
  "src/app/register/page.tsx",
  "getPublicDailyTestPlanEnabled",
  "Die Registrierung muss den serverseitigen, admin-gesteuerten 1-€/Tag-Schalter auswerten.",
);
requireText(
  "src/lib/runtimeProductSettings.ts",
  "publicDailyTestPlanEnabled",
  "Die Laufzeitkonfiguration muss den 1-€/Tag-Schalter persistent speichern.",
);
requireText(
  "src/app/api/admin/settings/daily-test-plan/route.ts",
  "requirePlatformAdmin",
  "Nur Plattform-Admins dürfen den 1-€/Tag-Schalter ändern.",
);
requireText(
  "src/app/admin/settings/page.tsx",
  "1-€/Tag-Beta-Abo",
  "Der Adminbereich muss den 1-€/Tag-Schalter sichtbar anbieten.",
);
requireText(
  "src/lib/publicDailyTestPlanPolicy.mjs",
  "PUBLIC_DAILY_TEST_PLAN_WINDOW_MS = 24 * 60 * 60 * 1000",
  "Die öffentliche 1-€/Tag-Beta-Ausnahme muss auf höchstens 24 Stunden begrenzt sein.",
);
requireText(
  ".github/workflows/deploy-fanmind.yml",
  "publicDailyTestPlanEnabled",
  "Der Production-Deploy muss den Beta-Zustand initial fail-closed anlegen, ohne spätere Admin-Entscheidungen zu überschreiben.",
);
requireText(
  "README.md",
  "kein drittes dauerhaftes öffentliches Paket",
  "README muss das 1-€/Tag-Beta-Testabo vom dauerhaften öffentlichen Katalog trennen.",
);
requireText(
  "src/lib/stripeBilling.ts",
  'if (planId === "pilot" && commercialOption === "pilot_only") return null;',
  "Der Stripe-Adapter muss Legacy-Pilot-Checkout blockieren.",
);
requireText(
  "src/lib/billing.ts",
  'if (option === "pilot_only") return false;',
  "Die UI muss Legacy-Pilot-Checkout blockieren.",
);

// KI-Stufen und Referral-Grenzen.
requireText(
  "src/config/commercialModel.mjs",
  "CORE_MONTHLY_FEE_CENTS = 31_200",
  "Das Umsatzmodell muss die Core-Grundgebühr zentral führen.",
);
requireText(
  "src/config/commercialModel.mjs",
  "CORE_INCLUDED_CONNECTIONS = 10",
  "Das Umsatzmodell muss zehn Connections im Core enthalten.",
);
requireText(
  "src/config/commercialModel.mjs",
  "CONNECTION_PACK_MONTHLY_FEE_CENTS = 4_900",
  "Das Umsatzmodell muss weitere fünf Connections mit 49 Euro bepreisen.",
);
requireText(
  "src/config/commercialModel.mjs",
  "Referral discount and agency volume discount cannot be combined",
  "Referral und Agency-Mengenrabatt müssen technisch ausgeschlossen sein.",
);
requireText(
  "src/config/aiTiers.mjs",
  'monthlyAddOnCents: 10000',
  "Die zentrale KI-Tier-Policy muss KI Plus mit 100 €/Monat führen.",
);
requireText(
  "src/config/aiTiers.mjs",
  'monthlyAddOnCents: 20000',
  "Die zentrale KI-Tier-Policy muss KI Ultra mit 200 €/Monat führen.",
);
requireText(
  "src/config/aiTiers.mjs",
  'includedInBase: true',
  "KI Standard muss in der zentralen Policy im Basispaket enthalten bleiben.",
);
requireText(
  "src/config/aiTiers.mjs",
  'addOnReferralDiscountEligible: false',
  "KI-Add-ons dürfen nicht referral-rabattfähig werden.",
);
requireText(
  "src/config/aiTiers.mjs",
  'automaticSendingEnabled: false',
  "Keine KI-Stufe darf automatische Sendung aktivieren.",
);
requireText(
  "src/app/settings/AccountSections.tsx",
  'from "@/config/aiTiers.mjs"',
  "Die Paketansicht muss die zentrale KI-Tier-Policy verwenden.",
);
requireText(
  "tests/ai-tier-policy.test.mjs",
  "Plus and Ultra cannot be automatically booked before models, limits and billing are approved",
  "Die nicht freigegebene Auto-Buchung von Plus/Ultra muss automatisiert getestet werden.",
);
requireText(
  "scripts/operations/verify-ai-tier-readiness.mjs",
  "AI_TIER_READINESS=PASS",
  "Die KI-Stufen müssen eine redigierte gemeinsame Readiness-Prüfung besitzen.",
);
requireText(
  "src/lib/adminAiUsage.ts",
  'Prefer: "count=exact"',
  "Die Admin-KI-Auswertung muss Kontakte/Fans paginationsunabhängig exakt zählen.",
);
requireText(
  "src/app/admin/ai-usage/page.tsx",
  "Kosten/Fan",
  "Die Admin-KI-Auswertung muss geschätzte Kosten relativ zur Fan-Basis anzeigen.",
);
requireText(
  "tests/ai-usage-cost-metrics.test.mjs",
  "without inventing zero-contact values",
  "Fehlende oder leere Fan-Basen dürfen keine scheinpräzisen Kostenverhältnisse erzeugen.",
);
requireText(
  "src/lib/aiUsageDashboardMetrics.mjs",
  "ADMIN_AI_USAGE_DAY_RANGES",
  "Die Admin-KI-Auswertung muss feste, validierte Schnellzeiträume verwenden.",
);
requireText(
  "src/lib/adminAiUsage.ts",
  "aggregateAiUsageByModel",
  "Die Admin-KI-Auswertung muss Usage je Modell serverseitig aggregieren.",
);
requireText(
  "src/app/admin/ai-usage/page.tsx",
  "Verbrauch pro Modell",
  "Die Admin-KI-Auswertung muss die Modellverteilung sichtbar machen.",
);
requireText(
  "tests/ai-usage-dashboard-metrics.test.mjs",
  "accepts only the documented quick ranges",
  "Schnellzeiträume und Modellverteilung müssen automatisiert geprüft werden.",
);
requireText(
  ".env.example",
  "FANMIND_AI_ADMIN_MONTHLY_BUDGET_CENTS=",
  "Das optionale interne KI-Monatsbudget muss serverseitig dokumentiert sein.",
);
requireText(
  ".env.example",
  "FANMIND_AI_ADMIN_SPIKE_RATIO=2",
  "Der beobachtende KI-Spike-Vergleich muss nachvollziehbar konfigurierbar sein.",
);
requireText(
  "src/lib/adminAiUsage.ts",
  "MAX_ADMIN_USAGE_EVENTS = 10_000",
  "Admin-KI-Zeiträume müssen paginiert und mit sichtbarer Obergrenze geladen werden.",
);
requireText(
  "src/app/admin/ai-usage/page.tsx",
  "Beobachtung ohne Sperre",
  "Budget- und Spike-Hinweise dürfen keine automatische Sperre behaupten.",
);
requireText(
  "tests/ai-usage-dashboard-metrics.test.mjs",
  "remain observational and fail honest when unconfigured",
  "Nicht konfigurierte oder begrenzte Budgetdaten müssen ehrlich getestet werden.",
);
requireText(
  "src/lib/aiUsageDashboardMetrics.mjs",
  "aggregateAiUsageTokenDistributionByFeature",
  "Die Admin-KI-Auswertung muss Tokenverteilungen je Feature reproduzierbar aggregieren.",
);
requireText(
  "src/app/admin/ai-usage/page.tsx",
  "Token-Verteilung pro Feature",
  "Die Admin-KI-Auswertung muss P50, P90 und P95 als Entscheidungsgrundlage sichtbar machen.",
);
requireText(
  "src/app/admin/billing/adminBilling.module.css",
  ".tokenDistributionTable",
  "Die Tokenverteilung muss auf breiten und mobilen Ansichten lesbar bleiben.",
);
requireText(
  "tests/ai-usage-dashboard-metrics.test.mjs",
  "feature token distributions expose deterministic nearest-rank P50, P90 and P95",
  "Tokenperzentile und ihre Stichprobengrenzen müssen automatisiert geprüft werden.",
);
requireText(
  "docs/operations/AI_TIER_DECISION_PROPOSAL.md",
  "füllt keinen `UNENTSCHIEDEN`-Wert automatisch aus",
  "Die Tokenverteilung darf keine fachliche KI-Stufen-Freigabe vortäuschen.",
);
requireText(
  "src/lib/aiUsageProviderMetrics.mjs",
  "totalTokens !== inputTokens + outputTokens",
  "Provider-Tokenwerte müssen vollständig und in sich konsistent validiert werden.",
);
requireText(
  "src/lib/aiUsage.ts",
  "normalizeOpenAiResponseUsage(input.providerUsage)",
  "Das Usage-Log muss vollständige Provider-Tokenwerte vor der Schätzung bevorzugen.",
);
requireText(
  "src/app/api/ai/reply-suggestions/route.ts",
  "providerUsage: responseBody?.usage",
  "Antwortvorschläge müssen die OpenAI-Responses-Usage an das Usage-Log weiterreichen.",
);
requireText(
  "src/app/fans/[id]/analysisActions.ts",
  "providerUsage: responseBody?.usage",
  "Die Kommunikationsanalyse muss die OpenAI-Responses-Usage an das Usage-Log weiterreichen.",
);
requireText(
  "tests/ai-usage-policy.test.mjs",
  "productive Responses paths forward provider usage and retain the estimate fallback",
  "Provider-Tokenübernahme und Schätz-Fallback müssen automatisiert geprüft werden.",
);
requireText(
  "src/config/aiTierRecommendation.mjs",
  'AI_TIER_RECOMMENDATION_STATUS = "advisory"',
  "Die KI-Stufen-Arbeitsempfehlung muss ausdrücklich ohne Aktivierungswirkung bleiben.",
);
requireText(
  "scripts/operations/verify-ai-tier-recommendation.mjs",
  "AI_TIER_RECOMMENDATION=PASS activation=none",
  "Die KI-Stufen-Arbeitsempfehlung muss einen reproduzierbaren Offline-Check besitzen.",
);
requireText(
  "tests/ai-tier-recommendation.test.mjs",
  "AI tier recommendation is advisory and cannot activate paid tiers",
  "Die Trennung zwischen Arbeitsempfehlung und aktiver Paid-Tier-Policy muss automatisiert geprüft werden.",
);
requireText(
  "scripts/operations/ai-reply-quality-eval.mjs",
  "AI_REPLY_QUALITY_EVAL_ACTIVATION=none",
  "Der Antwortqualitäts-Eval darf keine KI-Stufe aktivieren.",
);
requireText(
  ".gitignore",
  "/docs/operations/private-ai-evals/",
  "Private KI-Eval-Ergebnisse müssen vollständig aus Git ausgeschlossen bleiben.",
);
requireText(
  "package.json",
  "ai:reply-quality:eval",
  "Der private Antwortqualitäts-Eval muss als fester Offline-Befehl verfügbar sein.",
);
requireText(
  "tests/ai-reply-quality-eval.test.mjs",
  "quality evaluation rejects raw content and incomplete coverage",
  "Der Antwortqualitäts-Eval muss Rohtext und unvollständige Abdeckung fail-closed ablehnen.",
);
requireText(
  "docs/operations/AI_REPLY_QUALITY_EVAL.md",
  "Prompts und Antworten bleiben außerhalb von Git",
  "Das Qualitäts-Eval-Runbook muss die private Rohdaten-Grenze festhalten.",
);
requireText(
  ".github/workflows/mobile-release-resource-readiness.yml",
  "eas-cli@21.2.0 env:exec",
  "Der Mobile-Release-Ressourcencheck muss die gepinnte EAS-Umgebung ausschließlich read-only laden.",
);
requireText(
  "scripts/operations/mobile-release-resource-readiness.mjs",
  "MOBILE_RELEASE_RESOURCE_READINESS=PASS",
  "Der Mobile-Release-Ressourcencheck muss einen redigierten gemeinsamen PASS-Vertrag besitzen.",
);
requireText(
  ".github/workflows/mobile-signed-internal-build.yml",
  "eas-cli@21.2.0 build:view",
  "Der signierte Mobile-Build muss seinen EAS-Endstatus read-only prüfen.",
);
requireText(
  "scripts/operations/mobile-signed-build-completion.mjs",
  "MOBILE_SIGNED_BUILD_COMPLETION_VERIFICATION=PASS",
  "Die Mobile-Build-Abschlussprüfung muss einen redigierten PASS-Vertrag besitzen.",
);
requireText(
  "package.json",
  '"mobile:device:acceptance:prepare": "node scripts/operations/prepare-mobile-device-acceptance.mjs"',
  "Die private Mobile-Geräteabnahme muss einen festen fail-closed Vorbereitungsbefehl besitzen.",
);
requireText(
  "scripts/operations/prepare-mobile-device-acceptance.mjs",
  'template[field] = "pending"',
  "Die Geräteabnahme-Vorbereitung darf keinen realen Prüfpunkt vorab freigeben.",
);
requireText(
  "docs/mobile/GOOGLE_PLAY_HANDOFF.md",
  "Genau das bereits verifizierte Android-`1.0.0`-AAB",
  "Der Google-Play-Handoff muss das bestehende Android-AAB als einzige Fortsetzungsbasis festschreiben.",
);
requireText(
  "docs/mobile/GOOGLE_PLAY_HANDOFF.md",
  "Keinen neuen Build starten",
  "Der Google-Play-Handoff muss einen unnötigen zweiten Android-Build ausdrücklich sperren.",
);
requireText(
  "tests/mobile-native-release-policy.test.mjs",
  "signed Mobile completion fails closed on identity drift",
  "Die Mobile-Build-Abschlussprüfung muss Ziel-, Status- und Artefaktdrift automatisiert sperren.",
);
requireText(
  "apps/mobile/package.json",
  '"store:check": "node scripts/check-store-readiness.mjs"',
  "Der Mobile Store-Preflight muss als fester lokaler Befehl verfügbar sein.",
);
requireText(
  ".github/workflows/ci-mobile.yml",
  "npm run store:check",
  "Die Mobile-CI muss Store-Texte, Branding und EAS-Profile fail-closed prüfen.",
);
requireText(
  "apps/mobile/scripts/check-store-readiness.mjs",
  "MOBILE_STORE_READINESS=PASS",
  "Der Mobile Store-Preflight muss einen redigierten PASS-Vertrag besitzen.",
);
requireText(
  "docs/mobile/STORE_LISTING.md",
  "KI-CRM: Kontakte & Follow-ups",
  "Der deutsche Apple-Untertitel muss innerhalb des aktuellen Zeichenlimits bleiben.",
);
requireText(
  "docs/mobile/BETA_RELEASE.md",
  "geschützten Läufe `33298699290` und `33316105624`",
  "Das Mobile-Runbook muss die getrennt verifizierten Preview-/Production-Ressourcenchecks exakt dokumentieren.",
);
requireText(
  "docs/mobile/BETA_RELEASE.md",
  "Store-Build `33316172583` bestanden",
  "Das Mobile-Runbook muss den verifizierten Production-AAB-Lauf exakt dokumentieren.",
);
requireText(
  "docs/mobile/BETA_RELEASE.md",
  "Store-Build ist deshalb noch keine Veröffentlichung.",
  "Das Mobile-Runbook muss Buildnachweis und Store-Veröffentlichung weiterhin strikt trennen.",
);
forbidIn(
  "docs/mobile/BETA_RELEASE.md",
  /Dieser Vorabcheck ist vorbereitet, aber noch nicht extern ausgeführt\./,
  "Das Mobile-Runbook darf die bereits verifizierten EAS-Ressourcenchecks nicht wieder als unausgeführt darstellen.",
);
requireText(
  "docs/mobile/PUSH_DELIVERY.md",
  "Das bestehende Schema besitzt keine robuste, atomare Zustellhistorie.",
  "Die Push-Delivery-Dokumentation muss den ungeklärten persistenten Ledger als Aktivierungsblocker benennen.",
);
requireText(
  "docs/mobile/PUSH_DELIVERY.md",
  "Der Service ist allein nicht aktivierbar",
  "Die Push-Delivery-Dokumentation muss die unabhängigen Zielbindungen zusätzlich zum Ledger als Aktivierungsgrenze benennen.",
);
requireText(
  "src/lib/mobilePushDeliveryPolicy.mjs",
  "export const MOBILE_PUSH_PRODUCTION_DELIVERY_SUPPORTED = false",
  "Mobile Push Delivery muss Production strukturell sperren.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  '"https://exp.host/--/api/v2/push/send"',
  "Der Mobile-Push-Sender muss den festen offiziellen Expo-HTTPS-Endpunkt verwenden.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  'throw new MobilePushDeliveryError("provider_fetch_override_forbidden")',
  "Ein austauschbarer Push-Provider darf ausschließlich synthetischen Tests dienen.",
);
requireText(
  "src/lib/mobilePushDeliveryPolicy.mjs",
  'export const MOBILE_PUSH_STAGING_APP_HOSTNAME = "staging.fanmind.ch"',
  "Der Mobile-Push-Sender muss an den geprüften Staging-App-Host gebunden bleiben.",
);
requireText(
  "src/lib/mobilePushDeliveryPolicy.mjs",
  "export const MOBILE_PUSH_REMINDER_TTL_SECONDS = 60 * 60",
  "Mobile Push Delivery muss die generische Erinnerung kurz und fest auf eine Stunde begrenzen.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  "revalidationContract: MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT",
  "Jede neue Mobile-Push-Reservation muss die atomare Datenbank-Revalidierung verpflichtend anfordern.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  "expectedRegistrationTokenFingerprint",
  "Die atomare Mobile-Push-Reservation muss den aktuellen Registrierungs-/Token-Fingerprint binden.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  "config.targetBinding,",
  "Loader und Ledger-Reservation müssen denselben strukturell validierten Supabase-Zielkontext erhalten.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  "dependencies.ledger.markDeviceNotRegistered({",
  "Ein ungültiges Push-Gerät muss Attempt und Registrierung über genau eine atomare Ledger-Operation abschließen.",
);
requireText(
  "src/lib/mobilePushDeliveryTarget.ts",
  'import "server-only"',
  "Der service-role Mobile-Push-Target-Loader muss gegen Client-Bundling gesperrt sein.",
);
requireText(
  "src/lib/mobilePushDeliveryTarget.ts",
  "input.targetBinding",
  "Der Target-Loader muss den bereits geprüften gemeinsamen Supabase-Zielkontext verwenden.",
);
requireText(
  "src/lib/mobilePushDeliveryTarget.ts",
  "hashMobilePushToken(token) !== tokenFingerprint",
  "Der entschlüsselte Mobile-Push-Token muss vor der Reservation dem gespeicherten Fingerprint entsprechen.",
);
requireText(
  "src/lib/mobilePushDelivery.mjs",
  "reviewedProductionSupabaseProjectRef",
  "Mobile Push Delivery muss Staging- und Production-Supabase-Ziele gegen unabhängige geprüfte Bindings abgleichen.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "an indeterminate provider result plus ledger failure is never success",
  "Unklare Provider-/Ledger-Zustände müssen automatisiert als Nicht-Erfolg geprüft werden.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "missing or incomplete ledger fails closed before target or provider access",
  "Ein fehlender oder unvollständiger Mobile-Push-Ledger muss vor jedem Target- oder Providerzugriff sperren.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "tamperedTag[0] ^= 0x01",
  "Der Token-Ciphertext-Tamper-Test muss deterministisch ein dekodiertes Byte verändern.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "reviewed app and Supabase bindings reject environment drift before target loading",
  "Manipulierte Mobile-Push-Zielwerte müssen vor Target- oder Providerzugriff abgelehnt werden.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "receipt polling uses an atomic lease and is provider-bounded",
  "Mobile-Push-Receipts müssen atomar reserviert und auf eine feste Provideraufrufzahl begrenzt bleiben.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "registration expiry is calendar-strict, canonical and future-bounded",
  "Mobile-Push-Registrierungen müssen normalisierte Kalenderdaten und ungebundene Ablaufzeiten ablehnen.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "a send reservation requires fresh atomic database revalidation",
  "Der Sender muss fehlende, driftende oder veraltete Target-Revalidierungen vor dem Provideraufruf ablehnen.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "receipt ticket timestamps are canonical and bounded by the 24-hour window",
  "Receipt-Zeitpunkte müssen kanonisch und auf das Providerfenster begrenzt bleiben.",
);
requireText(
  "tests/mobile-push-delivery.test.mjs",
  "dormancy invariant rejects routes workers timers migrations and production wiring",
  "CI muss eine vorzeitige Mobile-Push-Route, einen Worker/Timer oder eine Migration ablehnen.",
);
requireText(
  "docs/operations/AI_TIER_READINESS.md",
  "AI_TIER_STANDARD=READY blockers=none",
  "Das Runbook muss den aktuellen Standard-/Plus-/Ultra-Vertrag dokumentieren.",
);
requireText(
  "docs/operations/AI_TIER_READINESS.md",
  "auf dem getrennten Supabase-Staging angewendet und",
  "Das Runbook muss den nachgewiesenen Staging-Speicherstand nennen.",
);
requireText(
  "docs/operations/AI_TIER_READINESS.md",
  "Stripe-Webhook enthält eine standardmäßig inaktive Persistenzbrücke",
  "Das Runbook muss die vorhandene, aber weiterhin gesperrte Webhook-Brücke nennen.",
);
forbidIn(
  "docs/operations/AI_TIER_READINESS.md",
  /noch nicht auf Staging oder Production angewendet|noch nicht mit\s+Stripe-Webhooks/iu,
  "Das Runbook darf den belegten Staging-/Webhook-Stand nicht als fehlend bezeichnen.",
);
forbidIn(
  "README.md",
  /noch ohne produktive Webhook- oder Datenbank-Verdrahtung/iu,
  "Der Reader darf die vorhandene gesperrte Webhook-Brücke nicht verneinen.",
);
requireText(
  "src/config/aiTiers.mjs",
  "resolveWorkspaceAiTierEntitlement",
  "Die zentrale KI-Tier-Policy muss den fail-closed Workspace-Entitlement-Vertrag besitzen.",
);
requireText(
  "src/config/aiTiers.mjs",
  'blockers.push("production_activation")',
  "Eine bezahlte KI-Stufe darf ohne stufenspezifische Production-Aktivierung niemals bereit werden.",
);
requireText(
  "tests/ai-tier-policy.test.mjs",
  "workspace entitlement rejects unknown and client-controlled paid tiers",
  "Client-kontrollierte oder unbekannte KI-Entitlements müssen automatisiert auf Standard zurückfallen.",
);
requireText(
  "tests/ai-tier-policy.test.mjs",
  "paid tier activation evidence is tier-specific and redacted",
  "KI-Stufen-Nachweise müssen stufenspezifisch bleiben und dürfen keine Runtime-Werte ausgeben.",
);
requireText(
  "supabase/migrations/20260727090000_workspace_ai_tier_entitlements.sql",
  "force row level security",
  "Der persistente KI-Stufenspeicher muss RLS auch für den Tabellenowner erzwingen.",
);
requireText(
  "supabase/migrations/20260727090000_workspace_ai_tier_entitlements.sql",
  "workspace_ai_tier_entitlement_policy_boundary_failed",
  "Die Migration muss bei einer Browser-exponierenden RLS-Policy transaktional abbrechen.",
);
requireText(
  "src/lib/workspaceAiTierStorage.mjs",
  "stripeSubscriptionItemLinked: true",
  "Der Storage-Mapper darf nur eine validierte, redigierte Item-Verknüpfung an den Resolver geben.",
);
requireText(
  "src/lib/workspaceAiTierEntitlements.ts",
  'url.searchParams.set("limit", "2")',
  "Der serverseitige KI-Stufenloader muss mehrdeutige Workspace-Zeilen erkennen können.",
);
requireText(
  "tests/ai-tier-entitlement-storage.test.mjs",
  "storage row is reduced to the redacted resolver contract",
  "Die Redaction persistenter KI-Stufen muss automatisiert getestet werden.",
);
requireText(
  "docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md",
  "Plus und Ultra bleiben",
  "Das Runbook muss den weiterhin blockierten Plus-/Ultra-Status offenlegen.",
);
requireText(
  "scripts/operations/ai-tier-entitlement-migration-runner.mjs",
  "4cd8dce37b9c96cdaf218c3426bdc477c7db6bd2d7df0385ac7e415c509cc7e2",
  "Die KI-Stufen-Speichermigration muss an den geprüften SHA-256 gebunden sein.",
);
requireText(
  "scripts/operations/ai-tier-entitlement-migration-runner.mjs",
  "AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS",
  "Der KI-Stufen-Speicher benötigt einen getrennten Metadaten-Postflight.",
);
requireText(
  "package.json",
  "db:ai-tier-entitlements:check",
  "Die Offline-Prüfung der KI-Stufen-Speichermigration muss als fester Befehl verfügbar sein.",
);
requireText(
  "tests/ai-tier-entitlement-migration-policy.test.mjs",
  "verify binds the target and runs only the read-only metadata postflight",
  "Zielbindung und read-only Postflight müssen automatisiert getestet werden.",
);
requireText(
  "src/lib/aiTierStripeLifecycle.mjs",
  "event_order_conflict",
  "Der KI-Add-on-Lifecycle muss gleichzeitige Stripe-Events fail-closed behandeln.",
);
requireText(
  "src/lib/aiTierStripeLifecycle.mjs",
  "ambiguous_price_items",
  "Der KI-Add-on-Lifecycle darf nie mehrere passende Add-on-Items akzeptieren.",
);
requireText(
  "tests/ai-tier-stripe-lifecycle.test.mjs",
  "duplicate and stale events cannot overwrite newer entitlement state",
  "Doppelte und verspätete KI-Add-on-Events müssen automatisiert geprüft werden.",
);
requireText(
  "tests/ai-tier-stripe-lifecycle.test.mjs",
  "removing the paid item cancels the stored entitlement",
  "Ein entferntes KI-Add-on-Item darf kein stale aktives Entitlement hinterlassen.",
);
requireText(
  "src/lib/aiTierStripeEntitlementSync.mjs",
  "FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED",
  "Die KI-Add-on-Persistenz muss bis zum kontrollierten Ledger-Rollout separat gesperrt bleiben.",
);
requireText(
  "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql",
  "v_conflict_reason := 'event_order_conflict'",
  "Gleichsekündige KI-Add-on-Events müssen dauerhaft reconciliation-needed werden.",
);
requireText(
  "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql",
  "stripe_sync_revision = v_expected_revision",
  "Die atomare KI-Add-on-RPC muss ihre Projektion per Revision-CAS schützen.",
);
requireText(
  "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql",
  "p_expected_previous_subscription_id",
  "Ein kanonischer KI-Subscription-Wechsel muss die exakt erwartete alte Bindung belegen.",
);
requireText(
  "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql",
  "snapshot_event_created_cutoff",
  "Die KI-Reconciliation muss ihre kanonische Snapshot-Zeitgrenze dauerhaft speichern.",
);
requireText(
  "scripts/operations/ai-tier-stripe-event-ledger-runner.mjs",
  "c07636db6f246364066b2fba426d4bcc955bee13d372982a88d2569c34b8c0d7",
  "Das kontrollierte KI-Event-Ledger muss checksum-gebunden bleiben.",
);
requireText(
  "scripts/operations/ai-tier-stripe-event-ledger-runner.mjs",
  "host === productionHost",
  "Der KI-Ledger-Runner muss den Production-DB-Host tatsächlich gegen das Ziel prüfen.",
);
requireText(
  "package.json",
  "db:ai-tier-stripe-ledger:check",
  "Der Offline-Vertragscheck des KI-Event-Ledgers muss fest aufrufbar sein.",
);
requireText(
  ".github/workflows/ai-tier-stripe-event-ledger-staging.yml",
  "apply-ai-tier-stripe-event-ledger",
  "Der Staging-Apply des KI-Event-Ledgers muss eine exakte manuelle Bestätigung verlangen.",
);
requireText(
  ".github/workflows/ai-tier-stripe-event-ledger-staging.yml",
  "inputs.reviewed_commit == github.sha",
  "Der Staging-Apply des KI-Event-Ledgers muss an den exakt geprüften main-Commit gebunden sein.",
);
requireText(
  ".github/workflows/ai-tier-stripe-event-ledger-staging.yml",
  "config/certificates/supabase-root-2021-ca.crt",
  "Der KI-Event-Ledger-Transport muss die festgeschriebene Supabase-CA mit verify-full verwenden.",
);
requireText(
  ".github/workflows/ai-tier-stripe-event-ledger-staging.yml",
  "STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=apply",
  "Der KI-Event-Ledger-Apply muss das gemeinsame read-only Rollout-Ergebnis binden.",
);
requireText(
  "docs/operations/AI_TIER_STRIPE_EVENT_LEDGER.md",
  "Separater Basis-Billing-Blocker",
  "Das KI-Ledger darf die weiterhin offene Basis-Billing-Reihenfolge nicht verschweigen.",
);
requireText(
  "src/app/api/stripe/webhook/route.ts",
  "syncWorkspaceAiTierStripeEntitlement",
  "Der echte Stripe-Webhook muss die fail-closed KI-Add-on-Brücke aufrufen.",
);
requireText(
  "src/lib/stripeWorkspacePolicy.mjs",
  "stripeWebhookReferenceContractDecision",
  "Mutierende Stripe-Events müssen ihre vollständige typisierte Referenzmenge fail-closed nachweisen.",
);
requireText(
  "src/lib/stripeBilling.ts",
  "missingReferenceCount",
  "Ein Stripe-Workspace-Teiltreffer darf nicht als vollständige Tenant-Bindung gelten.",
);
requireText(
  "src/app/api/stripe/webhook/route.ts",
  "stripeWebhookReferenceLookupValues",
  "Stripe-Workspace-Lookups müssen je Eventtyp ausschließlich die erforderliche vollständige Referenzmenge verwenden.",
);
requireText(
  "src/app/api/stripe/webhook/route.ts",
  "findWorkspaceIdByStripeReferences(lookupReferences)",
  "Die typisierte Stripe-Referenzmenge muss vor jeder Workspace-Auflösung vollständig geprüft werden.",
);
requireText(
  "src/app/api/stripe/webhook/route.ts",
  "syncStripeBillingEvent",
  "Der Stripe-Webhook muss die dormante Basis-Billing-Ledger-Brücke enthalten.",
);
requireText(
  "src/lib/stripeBillingEventLedger.mjs",
  "FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED",
  "Das Basis-Billing-Ledger muss bis zum kanonischen Cutover mehrfach gesperrt bleiben.",
);
requireText(
  "src/lib/stripeBillingEventSync.mjs",
  "projectionEnabled: isStripeBillingEventLedgerEnabled(environment)",
  "Capture-only und projektionsfähiges Basis-Billing müssen getrennte Gates behalten.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "p_event_created_at = v_stream.last_event_created_at",
  "Gleichsekündige Basis-Billing-Events dürfen nicht nach Event-ID sortiert werden.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "processing_state = 'unresolved'",
  "Nicht bindbare signierte Billing-Events müssen dauerhaft unresolved bleiben.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "v_stream_bootstrap_allowed",
  "Ein fehlender Bestandsstream darf trotz Projektionsgate nicht ohne pristine Checkout kanonisch werden.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "verify_workspace_stripe_billing_ledger_schema",
  "Das Basis-Billing-Ledger muss sein exaktes Schema bereits in der Apply-Transaktion prüfen.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_BEGIN",
  "Constraint- und Index-Sollwerte des Basis-Billing-Ledgers müssen aus dem checksum-gepinnten Control materialisiert werden.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "if v_definition.constraint_type = 'f' then",
  "Nur Foreign-Key-Referenznamen dürfen zwischen temporärem Oracle und öffentlichem Schema abgebildet werden; CHECK-Literale bleiben unverändert.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "and not acl.is_grantable",
  "Die service-role darf das Execute-Recht der Billing-Security-Definer nicht delegieren.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "rolname = session_user",
  "Alle Billing-Funktionen müssen an den projektgebundenen Session-Owner statt an eine veränderbare Runtime-Rolle gebunden bleiben.",
);
requireText(
  "supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  "stripe_billing_ledger_function_body_drift",
  "Der exakte Billing-Verifier muss auch metadata-identische Änderungen aller Funktionskörper ablehnen.",
);
requireText(
  "scripts/operations/stripe-billing-event-ledger-runner.mjs",
  "6591b1f865ac7163786dec7556cd93ef58d7c03e5bfeaf1736978484cf8a9271",
  "Das kontrollierte Basis-Billing-Ledger muss checksum-gebunden bleiben.",
);
requireText(
  "scripts/operations/stripe-billing-event-ledger-runner.mjs",
  "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED",
  "Der Basis-Billing-Postflight muss ungeprüfte Apply-Capture-Gap-Workspaces zählen.",
);
requireText(
  "scripts/operations/stripe-billing-event-ledger-runner.mjs",
  "host === productionHost",
  "Der Basis-Billing-Runner muss den Production-DB-Host tatsächlich gegen das Ziel prüfen.",
);
requireText(
  "scripts/operations/stripe-billing-event-ledger-runner.mjs",
  "schema_verifier_drift",
  "Der unabhängige Basis-Billing-Postflight muss den committed Schema-Verifier bytegenau binden.",
);
requireText(
  "docs/operations/STRIPE_BILLING_EVENT_LEDGER.md",
  "Billing-Write-Freeze",
  "Der Apply-Capture-Cutover muss den verpflichtenden Billing-Write-Freeze dokumentieren.",
);
requireText(
  "package.json",
  "db:stripe-billing-ledger:check",
  "Der Offline-Vertragscheck des Basis-Billing-Ledgers muss fest aufrufbar sein.",
);
requireText(
  ".github/workflows/stripe-billing-event-ledger-staging.yml",
  "apply-stripe-billing-event-ledger",
  "Der Staging-Apply des Basis-Billing-Ledgers muss eine exakte manuelle Bestätigung verlangen.",
);
requireText(
  ".github/workflows/stripe-billing-event-ledger-staging.yml",
  "inputs.reviewed_commit == github.sha",
  "Der Staging-Apply des Basis-Billing-Ledgers muss an den exakt geprüften main-Commit gebunden sein.",
);
requireText(
  ".github/workflows/stripe-billing-event-ledger-staging.yml",
  "config/certificates/supabase-root-2021-ca.crt",
  "Der Basis-Billing-Ledger-Transport muss die festgeschriebene Supabase-CA mit verify-full verwenden.",
);
requireText(
  ".github/workflows/stripe-billing-event-ledger-staging.yml",
  "STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=apply",
  "Der Basis-Billing-Apply muss das gemeinsame read-only Rollout-Ergebnis binden.",
);
forbidIn(
  ".github/workflows/stripe-billing-event-ledger-staging.yml",
  /FANMIND_RUNTIME_ENVIRONMENT:\s*production|FANMIND_PRODUCTION_CHANGE_TICKET|FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED|NEXT_PUBLIC_APP_URL:\s*https:\/\/(?:www\.)?fanmind\.ch/iu,
  "Der Basis-Billing-Ledger-Workflow darf weder Production noch die Runtime-Aktivierung enthalten.",
);
requireText(
  "package.json",
  '"ai:tiers:staging:run": "node scripts/operations/ai-tier-staging-acceptance.mjs --run"',
  "Die kontrollierte KI-Stufen-Staging-Abnahme muss explizit aufrufbar sein.",
);
requireText(
  ".github/workflows/ai-tier-staging-migration.yml",
  "github.ref == 'refs/heads/main'",
  "Der KI-Stufen-Migrationsworkflow muss auf den geprüften main-Branch begrenzt sein.",
);
requireText(
  ".github/workflows/ai-tier-staging-migration.yml",
  "FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY",
  "Der KI-Stufen-Migrationsworkflow muss die unabhängige Nicht-Production-Schreibbestätigung verlangen.",
);
requireText(
  ".github/workflows/ai-tier-staging-migration.yml",
  "npm run db:ai-tier-entitlements:apply",
  "Der KI-Stufen-Migrationsworkflow muss den checksum-gebundenen Runner verwenden.",
);
forbidIn(
  ".github/workflows/ai-tier-staging-migration.yml",
  /FANMIND_RUNTIME_ENVIRONMENT: production|FANMIND_PRODUCTION_CHANGE_TICKET|sk_live_|https:\/\/fanmind\.ch|ai:tiers:staging:run/iu,
  "Der KI-Stufen-Migrationsworkflow darf weder Production-Ziele noch die Abnahme automatisch starten.",
);
requireText(
  ".github/workflows/ai-tier-staging-acceptance.yml",
  "FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY",
  "Der KI-Stufen-Abnahmeworkflow muss die unabhängige Nicht-Production-Schreibbestätigung verlangen.",
);
requireText(
  ".github/workflows/ai-tier-staging-acceptance.yml",
  "npm run db:ai-tier-entitlements:verify",
  "Der KI-Stufen-Abnahmeworkflow muss die angewendete Migration read-only verifizieren.",
);
forbidIn(
  ".github/workflows/ai-tier-staging-acceptance.yml",
  /db:ai-tier-entitlements:apply|sk_live_|https:\/\/fanmind\.ch/iu,
  "Der KI-Stufen-Abnahmeworkflow darf weder Migrationen anwenden noch Production-Ziele enthalten.",
);
requireText(
  "scripts/operations/ai-tier-staging-acceptance.mjs",
  "AI_TIER_STAGING_TRANSACTION=ROLLED_BACK",
  "Der KI-Stufen-Abnahmerunner muss den rollback-only Datenbanknachweis melden.",
);
requireText(
  "docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md",
  "keine automatische Production-Migration",
  "Das Runbook muss automatische Production-Migrationen ausdrücklich ausschließen.",
);
requireText(
  "package.json",
  '"db:meta-content:check": "node scripts/operations/meta-content-migration-runner.mjs --check"',
  "Die Offline-Prüfung der Meta-Content-Migrationen muss fest verfügbar sein.",
);
requireText(
  ".github/workflows/meta-content-staging-migration.yml",
  "inputs.reviewed_commit == github.sha",
  "Der Meta-Migrationsworkflow muss den exakten geprüften main-Commit binden.",
);
requireText(
  ".github/workflows/meta-content-staging-migration.yml",
  "PGSSLMODE: verify-full",
  "Der Meta-Migrationsworkflow muss den Staging-Datenbankhost vollständig per TLS prüfen.",
);
requireText(
  ".github/workflows/meta-content-staging-migration.yml",
  "npm run db:meta-content:apply",
  "Der Meta-Migrationsworkflow muss ausschließlich den checksum-gebundenen Runner verwenden.",
);
forbidIn(
  ".github/workflows/meta-content-staging-migration.yml",
  /FANMIND_RUNTIME_ENVIRONMENT: production|db:meta-content:verify|Meta App Review|analysis.*enabled/iu,
  "Der Meta-Migrationsworkflow darf Production, Review oder Analyse nicht aktivieren.",
);
requireText(
  "scripts/operations/meta-content-migration-runner.mjs",
  "META_CONTENT_MIGRATION_APPLY=already_current",
  "Der Meta-Runner muss sichere, postflight-gebundene Wiederholungsläufe unterstützen.",
);
requireText(
  "scripts/operations/meta-content-migration-runner.mjs",
  "META_CONTENT_ANALYSIS_ACTIVATION=disabled",
  "Der Meta-Runner muss die unveränderte Analysesperre ausweisen.",
);
requireText(
  "docs/operations/META_CONTENT_STAGING_MIGRATION.md",
  "teilweise vorhandenes",
  "Das Meta-Runbook muss Drift und Teilzustände fail-closed behandeln.",
);
requireText(
  "docs/SOURCE_OF_TRUTH.md",
  "KI Plus** kostet zusätzlich 100 €/Monat",
  "Die Source of Truth muss den KI-Plus-Preis dokumentieren.",
);
requireText(
  "docs/SOURCE_OF_TRUTH.md",
  "KI Ultra** kostet zusätzlich 200 €/Monat",
  "Die Source of Truth muss den KI-Ultra-Preis dokumentieren.",
);
requireText(
  "src/lib/referralPolicy.mjs",
  "REFERRAL_DISCOUNT_STEP_PERCENT = 5",
  "Referral muss 5 Prozent je aktivem Workspace verwenden.",
);
requireText(
  "src/lib/referralPolicy.mjs",
  "REFERRAL_MAX_ACTIVE_COUNT = 20",
  "Referral muss maximal 20 aktive Empfehlungen berücksichtigen.",
);
requireText(
  "src/lib/referralPolicy.mjs",
  "REFERRAL_GROWTH_WINDOW_CAP = 2000",
  "Referral muss beim 2.000er-Cap schließen.",
);
requireText(
  "src/lib/referralPolicy.mjs",
  'billingStatus !== "active"',
  "Nur aktiv zahlende Workspaces dürfen Referral nutzen.",
);
requireText(
  "src/lib/referralPolicy.mjs",
  "monthlyFeeCentsAfterDiscount",
  "Referral muss einen nicht negativen Monatsbetrag liefern.",
);
requireText(
  "tests/referral-policy.test.mjs",
  "growth window closes at 2000 active paid workspaces",
  "Der 2.000er-Cap muss automatisiert getestet werden.",
);

requireText(
  "src/app/referral-bedingungen/page.tsx",
  "Rabatt ausschließlich auf die Starter-Grundgebühr von 312 €/Monat",
  "Die Referral-Bedingungen müssen die rabattfähige Starter-Grundgebühr eindeutig nennen.",
);
requireText(
  "src/app/referral-bedingungen/page.tsx",
  "kein Rabatt auf Einrichtung, KI Plus, KI Ultra, Connections oder Agency-Erweiterungen",
  "Die Referral-Bedingungen müssen alle nicht rabattfähigen Add-ons ausschließen.",
);
requireText(
  "src/app/referral-bedingungen/page.tsx",
  "produktive automatische Rabattverrechnung bleibt",
  "Die Referral-Bedingungen müssen den noch deaktivierten Billing-Status offenlegen.",
);
requireText(
  "src/app/settings/referral/page.tsx",
  'href="/referral-bedingungen"',
  "Die geschützte Referral-Seite muss auf die vollständigen Teilnahmebedingungen verlinken.",
);
requireText(
  "src/components/LegalTopHeader.tsx",
  'href: "/referral-bedingungen"',
  "Die Rechtsnavigation muss die Referral-Teilnahmebedingungen enthalten.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  '{ label: "Referral-Bedingungen", href: "/referral-bedingungen" }',
  "Der öffentliche Footer muss die Referral-Teilnahmebedingungen verlinken.",
);

// Betreiber, B2B und Steuerdarstellung.
requireText(
  "src/app/impressum/page.tsx",
  "Bernd Guggenberger, Einzelunternehmen – Geschäftsbezeichnung FanMind",
  "Das Impressum muss den bestätigten Einzelunternehmer nennen.",
);
requireText(
  "src/app/datenschutz/page.tsx",
  "Bernd Guggenberger, Einzelunternehmen – Geschäftsbezeichnung FanMind",
  "Die Datenschutzerklärung muss denselben bestätigten Betreiber wie das Impressum nennen.",
);
requireText(
  "docs/LEGAL_COMPLETION_STATUS.md",
  "Betreiber und Vertragspartner: Bernd Guggenberger, Einzelunternehmen unter der Geschäftsbezeichnung FanMind",
  "Der rechtliche Abschlussstatus muss den kanonischen Betreiber nennen.",
);
requireText(
  "src/app/impressum/page.tsx",
  "Bezirkshauptmannschaft Mödling",
  "Das Impressum muss die zuständige Gewerbebehörde nennen.",
);
requireText(
  "src/app/impressum/page.tsx",
  "+43 676 5367236",
  "Das Impressum muss die bestätigte Telefonnummer nennen.",
);
requireText(
  "src/app/impressum/page.tsx",
  "kontakt@fanmind.ch",
  "Das Impressum muss die einheitliche Kontaktadresse verwenden.",
);
requireText(
  "src/app/agb/page.tsx",
  "Ein Vertragsabschluss durch Verbraucher ist nicht vorgesehen",
  "Die AGB müssen den B2B-Geltungsbereich klarstellen.",
);
requireText(
  "src/app/agb/page.tsx",
  "FanMind garantiert keine fehlerfreien KI-Antworten",
  "Die AGB müssen die KI-Haftungsgrenze klar nennen.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  "Nettopreise. Stripe Tax ermittelt die anwendbare Umsatzsteuer oder Reverse-Charge-Behandlung.",
  "Die Landingpage muss Nettopreise und die Stripe-Tax-/Reverse-Charge-Behandlung offenlegen.",
);
requireText(
  "src/app/billing/start/page.tsx",
  "Nettopreis · Stripe Tax berechnet den anwendbaren Steuersatz oder Reverse Charge.",
  "Der Checkout muss Nettopreis und die dynamische Steuerbehandlung offenlegen.",
);
requireText(
  "src/app/agb/page.tsx",
  "Umsätzen in Österreich werden 20 % Umsatzsteuer berechnet",
  "Die AGB müssen die österreichische 20-Prozent-Vorgabe nennen.",
);
requireText(
  "src/app/zahlungsbedingungen/page.tsx",
  "Bei internationalen Verkäufen wird der anwendbare Steuersatz oder eine Reverse-Charge-Behandlung",
  "Die Zahlungsbedingungen müssen die internationale Steuerbehandlung nennen.",
);

// README und Source of Truth müssen synchron sein.
requireText(
  "README.md",
  "Starter Flex: `990 € einmalige Einrichtung + 312 €/Monat`",
  "README muss Starter Flex korrekt dokumentieren.",
);
requireText(
  "README.md",
  "KI Plus: zusätzlich `100 €/Monat`",
  "README muss den KI-Plus-Preis dokumentieren.",
);
requireText(
  "README.md",
  "KI Ultra: zusätzlich `200 €/Monat`",
  "README muss den KI-Ultra-Preis dokumentieren.",
);
requireText(
  "README.md",
  "Legacy-Pilot-Checkout gesperrt",
  "README muss die Einstellung des entgeltlichen Pilot-Checkouts dokumentieren.",
);
requireText(
  "README.md",
  "scripts/operations/deploy-isolated-release.sh",
  "README muss den aktiven isolierten Production-Release-Pfad dokumentieren.",
);
requireText(
  "README.md",
  "/var/www/fanmind-current",
  "README muss den stabilen atomaren Production-Release-Symlink dokumentieren.",
);
requireText(
  "README.md",
  "FanMind Production Read-only Audit",
  "README muss den dauerhaften read-only Production-Audit dokumentieren.",
);
forbidIn(
  "README.md",
  /git reset --hard origin\/main|pm2 (?:restart|delete) fanmind/iu,
  "README darf den alten In-Place-Deploy nicht als aktuellen Production-Ablauf anleiten.",
);
requireText(
  "docs/SOURCE_OF_TRUTH.md",
  "Öffentliche Demo | aktiv | kostenloser temporärer Demo-Zugang; kein entgeltliches Paket",
  "Die Source of Truth muss die kostenlose Demo statt eines Pilot-Pakets dokumentieren.",
);
requireText(
  "docs/SOURCE_OF_TRUTH.md",
  "Production-Audit: Ein dauerhaft installierter, commitgebundener und",
  "Die Source of Truth muss den automatisierten Production-Audit dokumentieren.",
);

// KI-Nutzungsanzeige.
requireText(
  ".env.example",
  "FANMIND_AI_STANDARD_SOFT_REQUEST_WARNING=",
  "Die optionale KI-Aktions-Hinweisgrenze muss dokumentiert sein.",
);
requireText(
  ".env.example",
  "FANMIND_AI_STANDARD_SOFT_TOKEN_WARNING=",
  "Die optionale KI-Token-Hinweisgrenze muss dokumentiert sein.",
);
requireText(
  "src/lib/aiUsagePolicy.mjs",
  'level: "unconfigured"',
  "Nicht konfigurierte KI-Hinweisgrenzen dürfen kein Kontingent vortäuschen.",
);
requireText(
  "tests/ai-usage-policy.test.mjs",
  "unconfigured thresholds never imply a quota or automatic block",
  "Die KI-Policy muss den Zustand ohne Sperre testen.",
);
requireText(
  "src/app/settings/ai-usage/page.tsx",
  "weder ein vertragliches Kontingent noch eine automatische Sperre aktiviert",
  "Die Nutzeransicht muss den Zustand ohne Vertragsgrenze offenlegen.",
);
requireText(
  "src/app/settings/AccountTabs.tsx",
  'href: "/settings/ai-usage"',
  "KI-Nutzung muss im geschützten Kontobereich erreichbar sein.",
);

// Workspace-Unternehmens-Prompt und Antwortprofile.
requireText(
  "src/lib/aiPromptPolicy.mjs",
  "AI_PROMPT_PROFILE_MAX_COUNT = 8",
  "Ein Workspace darf höchstens acht Antwortprofile speichern.",
);
requireText(
  "src/app/settings/ai-usage/AiPromptSettings.tsx",
  "Unternehmens-Prompt & Antwortprofile",
  "Die KI-Nutzungsseite muss die Promptverwaltung sichtbar anbieten.",
);
requireText(
  "src/app/api/ai/prompt-settings/route.ts",
  "workspace.owner_user_id === context.user.id",
  "Nur Owner oder Plattform-Admin dürfen Workspace-Prompts ändern.",
);
requireText(
  "src/app/api/ai/reply-suggestions/route.ts",
  "getWorkspaceAiPromptContext",
  "Antwortvorschläge müssen Workspace-Prompts serverseitig laden.",
);
requireText(
  "docs/SOURCE_OF_TRUTH.md",
  "Workspace-Unternehmens-Prompt",
  "Die Source of Truth muss die aktive Promptverwaltung dokumentieren.",
);

// Gemeinsame Funktionssymbole und Kanal-Logos.
requireText(
  "src/components/FanMindFunctionIcon.tsx",
  "export type FanMindFunctionIconKey",
  "Funktionssymbole müssen über eine typisierte Registry definiert sein.",
);
requireText(
  "src/components/WorkspaceShell.tsx",
  "icon?: FanMindFunctionIconKey",
  "Die Workspace-Navigation muss die gemeinsame Symbol-Registry verwenden.",
);
requireText(
  "src/app/landing-v2/page.tsx",
  "resolveFanMindFunctionIcon(feature.icon, feature.title)",
  "Die Landingpage muss die gemeinsame Symbol-Registry verwenden.",
);
requireText(
  "src/components/PlatformLogo.module.css",
  "object-fit: contain",
  "Kanal-Logos müssen einheitlich und unbeschnitten dargestellt werden.",
);

// Turnstile und Demo-Schutz.
requireText(
  ".env.example",
  "FANMIND_REQUIRE_TURNSTILE_FOR_PUBLIC_DEMO=false",
  "Turnstile muss ausdrücklich konfigurierbar bleiben.",
);
requireText(
  "src/lib/demoTurnstilePolicy.mjs",
  'mode: "misconfigured"',
  "Unvollständige Turnstile-Konfiguration muss fail-closed sein.",
);
requireText(
  "src/lib/demoProtection.ts",
  'FANMIND_REQUIRE_TURNSTILE_FOR_PUBLIC_DEMO === "true"',
  "Der Demo-Endpunkt muss den verpflichtenden Turnstile-Modus auswerten.",
);
requireText(
  "src/components/DemoTurnstile.tsx",
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  "Das Browser-Widget muss die offizielle Turnstile-API laden.",
);
requireText(
  "src/components/DemoTurnstile.tsx",
  'action: "fanmind_demo_start"',
  "Widget und Server müssen dieselbe Turnstile-Action verwenden.",
);
requireText(
  "src/app/login/page.tsx",
  "turnstileToken: turnstileToken ?? undefined",
  "Die Loginseite muss den Turnstile-Token übergeben.",
);
requireText(
  "tests/demo-turnstile-policy.test.mjs",
  "Turnstile required mode fails closed before both keys are configured",
  "Der Pflichtmodus muss automatisiert getestet werden.",
);

// Öffentliche Terminologie und Legal-Seiten.
forbidIn(
  "src/app/landing-v2/page.tsx",
  /(?:Fan-Analyse-Report|Memory|\bMVP\b|DSGVO-konform)/iu,
  "Die Landingpage enthält veraltete oder missverständliche Produktbegriffe.",
);
forbidIn(
  "src/lib/fanmindCopy.ts",
  /(?:Fan-Analyse-Report|Fan analysis report|Memory|DSGVO-konform)/iu,
  "Öffentliche Übersetzungen enthalten veraltete oder missverständliche Produktbegriffe.",
);
forbidIn(
  "src/app/landing-v2/FaqAccordion.tsx",
  /DSGVO-konform/iu,
  "Die FAQ darf keine pauschale Datenschutzgarantie formulieren.",
);
forbidIn(
  "src/app/brandMetadata.ts",
  /(?:Memory|MVP)/iu,
  "Öffentliche Metadaten müssen aktuelle Begriffe verwenden.",
);
forbidIn(
  "src/app/opengraph-image.tsx",
  /["']Memory["']/iu,
  "Das Social-Preview darf Memory nicht als sichtbaren Produktbegriff verwenden.",
);
forbidIn(
  "src/app/impressum/page.tsx",
  /Ein Projekt von Gerhard Novy|Beteiligungsverhältnisse|50&nbsp;%|\[BITTE FINAL EINTRAGEN|TODO:/iu,
  "Das Impressum enthält alte Betreiberangaben oder interne Platzhalter.",
);
forbidIn(
  "src/app/datenschutz/page.tsx",
  /Ein Projekt von Gerhard Novy|Vertreten durch Gerhard Novy|Beteiligungsverhältnisse|50&nbsp;%|TODO:|\[BITTE FINAL EINTRAGEN/iu,
  "Die Datenschutzerklärung enthält alte Betreiberangaben oder interne Platzhalter.",
);
requireText(
  "src/lib/metaPixelPolicy.mjs",
  'export const META_PIXEL_ACTIVE_EVENTS = Object.freeze(["PageView"]);',
  "Nur PageView darf in der aktiven Meta-Event-Allowlist stehen.",
);
forbidIn(
  "src/app/register/RegisterClient.tsx",
  /trackMetaPixelEvent\s*\(/u,
  "Die Registrierung darf ohne separate Freigabe kein Meta-Conversion-Event auslösen.",
);
forbidIn(
  "src/components/landing/FooterInquiryForm.tsx",
  /trackMetaPixelEvent\s*\(/u,
  "Die Beratungsanfrage darf ohne separate Freigabe kein Meta-Conversion-Event auslösen.",
);
forbidIn(
  "src/app/datenschutz/page.tsx",
  /\b(?:Memory|Memories|Fan-Analyse)\b/iu,
  "Die Datenschutzerklärung muss die aktuelle Kontaktwissen-Terminologie verwenden.",
);
requireText(
  "src/app/datenschutz/page.tsx",
  "Im aktuell freigegebenen Stand wird ausschließlich das Standardevent",
  "Die Datenschutzerklärung muss den PageView-only-Scope nennen.",
);
forbidIn(
  "src/app/datenschutz/page.tsx",
  /<code>(?:CompleteRegistration|Lead)<\/code>/u,
  "Die Datenschutzerklärung darf vorbereitete Conversion-Events nicht als aktiv darstellen.",
);
requireText(
  "src/app/datenschutz/page.tsx",
  "Minimierte Webhook- und Serverfehler-Diagnosen werden standardmäßig nach 30 Tagen gelöscht.",
  "Die Datenschutzerklärung muss die implementierte Diagnose-Retention nennen.",
);
requireText(
  "src/app/datenschutz/page.tsx",
  "Bestätigte Account-Löschanfragen haben ein reguläres Bearbeitungsziel von höchstens 30 Tagen",
  "Die Datenschutzerklärung muss das transparente Account-Löschziel nennen.",
);
requireText(
  "src/app/datenschutz/page.tsx",
  "Eine EU-Senderegion ist daher kein Nachweis für EU-Datenspeicherung",
  "Die Datenschutzerklärung muss Resend-Senderegion und US-Datenspeicherung auseinanderhalten.",
);
forbidIn(
  "docs/LEGAL_COMPLETION_STATUS.md",
  /Gerhard Novy|Beteiligungsverhältnis: 50 % \/ 50 %/iu,
  "Der rechtliche Abschlussstatus enthält alte Betreiber- oder Beteiligungsangaben.",
);
forbidIn(
  "src/app/avv/page.tsx",
  /redirect\s*\(/u,
  "Die AVV-Seite darf nicht zur Datenschutzerklärung umleiten.",
);
requireText(
  "src/app/avv/page.tsx",
  "Diese Seite ersetzt keine unterschriebene AVV",
  "Die AVV-Seite muss ihre rechtliche Grenze nennen.",
);
requireText(
  "src/app/avv/page.tsx",
  "Aktuelle AVV per E-Mail anfordern",
  "Die AVV-Seite muss einen Anforderungsweg enthalten.",
);
requireText(
  "src/components/LegalTopHeader.tsx",
  '{ href: "/avv", label: "AVV", key: "avv" }',
  "Die Rechtsnavigation muss die AVV direkt verlinken.",
);
requireText(
  "docs/legal/AVV_WORKING_DRAFT.md",
  "Diese Arbeitsfassung bereitet die technischen und fachlichen Anlagen einer",
  "Die AVV-Arbeitsfassung muss ihren nicht unterschriftsreifen Status klar begrenzen.",
);
requireText(
  "docs/legal/AVV_WORKING_DRAFT.md",
  "## 12. Noch erforderliche Abschlussentscheidungen",
  "Die AVV-Arbeitsfassung muss verbleibende externe Abschlussentscheidungen ausweisen.",
);
requireText(
  "docs/legal/RETENTION_REGISTER.md",
  "## Fachliche Daten mit Kriterien statt erfundener Endfrist",
  "Das Retention-Register muss implementierte Grenzen von offenen Entscheidungen trennen.",
);
requireText(
  "docs/LEGAL_COMPLETION_STATUS.md",
  "- [x] Production-Smoke-Test prüft `/impressum`, `/datenschutz`, `/avv`,",
  "Der Legal-Abschlussstatus muss den vorhandenen Production-Smoke-Nachweis korrekt führen.",
);
requireText(
  "scripts/legal/external-evidence-handoff.mjs",
  "LEGAL_EXTERNAL_EVIDENCE_PRIVATE_CONTENT_OUTPUT=false",
  "Der externe Legal-Handoff muss Fehler ohne private Inhalte ausgeben.",
);
requireText(
  "tests/legal-external-evidence-handoff.test.mjs",
  "formatted handoff omits values, evidence references and completed controls",
  "Der Legal-Handoff muss seine Datensparsamkeit automatisiert prüfen.",
);
requireText(
  "tests/legal-external-evidence-handoff.test.mjs",
  "invalid completion evidence keeps controls in the external handoff",
  "Der Legal-Handoff darf unvollständig belegte Abschlussstatus nicht ausblenden.",
);

for (const file of [
  "scripts/final-go-live-preflight.mjs",
  "scripts/smoke-public-routes.mjs",
]) {
  for (const route of [
    '"/impressum"',
    '"/datenschutz"',
    '"/avv"',
    '"/agb"',
    '"/zahlungsbedingungen"',
  ]) {
    requireText(
      file,
      route,
      `Der öffentliche Release-Check muss die Rechtsroute ${route} prüfen.`,
    );
  }
}

if (errors.length) {
  for (const error of errors) console.error(`TRUTH_ERROR: ${error}`);
  console.error(
    `Product truth verification failed with ${errors.length} error(s).`,
  );
  process.exit(1);
}

console.log(
  `Product truth verified across ${checkedFiles.length} checked files (0 warning(s)).`,
);
