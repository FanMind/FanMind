// Reviewed parent authorization sources. Never construct these expectations
// from a target catalog. SQL returned here is for isolated reference CI only.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

export const CREATOR_FOUNDATION_PARENT_PINS = Object.freeze({
  incrementalHistory: {path: "../../supabase/migrations/20260803210000_preserve_incremental_conversation_history.sql", sha256: "79c81cdd204fc2fc45f4fa16ab381ce2278e16f13950914e125e22cfdca924f1"},
  billingBaseline: {path: "../../docs/database/billing_prep_migration.sql", sha256: "8e0381421b9893e83ffc05d6dbad244929635fd72537dbe45f646c25b160b94e"},
  billing: {path: "../../supabase/migrations/20260628120000_expand_admin_billing.sql", sha256: "042c7050e660ece252d595cf94f3a68cc24f6bc21756bd4fd21e82c2fbedef46"},
  flags: {path: "../../supabase/migrations/20260707120000_internal_test_ai_maintenance_flags.sql", sha256: "6559555a1cf9a216fc4ea3a9c870270925f8f961deae2bf25603c76974fb6187"},
  masterData: {path: "../../supabase/migrations/20260710120000_profile_workspace_master_data.sql", sha256: "781f10ec30168fbe7f6c4ee94926ec8bacd3306f6cf762ac1f67a3511a99fcc5"},
  cancellation: {path: "../../supabase/migrations/20260720120000_self_service_subscription_cancellation.sql", sha256: "8c6a51c2df902330e7e52e82eb791ec4a1d3cd8f246e6293c4a64cad46745a07"},
  provisioning: {path: "../../supabase/migrations/20260726120000_workspace_provisioning_rpc.sql", sha256: "721e29136fc573ebb7be1eb7e6dca7f794031568892402cb95afa9751be98e44"},
  memoryProfiles: {path: "../../supabase/migrations/20260614143000_create_memory_profile_tables.sql", sha256: "a420e76e223298ab0ca4fe0d4ddcc70eec40dbf21f442878d71a26a388877482"},
  messageRetention: {path: "../../supabase/migrations/20260614120000_conversation_message_retention.sql", sha256: "0f67be76741475105816d713e7245d015fe6a5dcc49a7470dc48772508aa6eac"},
  sourceMetadata: {path: "../../supabase/migrations/20260617120000_add_conversation_source_metadata.sql", sha256: "7af675698a9835065089b3ccba6fd403804b3a9e8d6f5c679a3d1029cb22f7b9"},
  contactNotes: {path: "../../supabase/migrations/20260617213000_contact_notes_analysis_reports.sql", sha256: "aec047d2399a9516fd27bf8d01909e0baeccde93f5946ba250e1ada35d3f8825"},
  contactTopFan: {path: "../../supabase/migrations/20260719120000_add_contact_top_fan_marker.sql", sha256: "4e9e2df5f7e63cf9226432739f7b547b460b586377cf704bd232b92f64ad7798"},
  assignment: {path: "../../supabase/migrations/20260808140000_add_conversation_assignment_identity.sql", sha256: "1ede0b50597e26761b8cdbba50d6a1faca70bce210cc753ac68d1b2ac6c28d34"},
  providerDefaults: {path: "../../scripts/operations/creator-foundation-reconciliation-artifacts/provider-initial-schema.sql", sha256: "84588fff60ff3cadcd361c820fe502052f4c5fd5aa273740e0690c5ee59ec813"},
  workspace: {path: "../../docs/database/fanmind_mvp_schema.sql", sha256: "e84ac6101e8f3e8c09276f71e159c6bc057d8e246b1a6212430421a0ed42166a"},
  contacts: {path: "../../supabase/migrations/20260609120000_create_contacts.sql", sha256: "802211ddf2ec857af3ea9d3f637255d3e6e11182363ec117aaa45fa84a9310b6"},
  conversations: {path: "../../supabase/migrations/20260613120000_create_conversations_messages.sql", sha256: "fb97836e47da84ba4964cc5cd4e1671155abd4b9f298b18c212172bbd1acb191"},
  profiles: {path: "../../supabase/migrations/20260803120000_meta_content_intelligence_foundation.sql", sha256: "3936aeddf0c6b2ed2e3628c169eb52ed64264a3cf97c53c9c91a2063da7c55af"},
  workspaceColumns: {path: "../../supabase/controlled/20260726121000_workspace_server_owned_columns.sql", sha256: "a015aabfa4f7ac778f3159fbd5e2a3126cd56c86571c8def946c5f4998ad8591"},
  boundary: {path: "../../supabase/controlled/20260816120000_workspace_member_data_boundary.sql", sha256: "ca9adfea6db85a48d75998e060f6b345a882a8b1889d20c7d04c438316985c93"},
});
export const CREATOR_FOUNDATION_PARENT_TABLES = ["workspaces", "workspace_members", "contacts", "conversations", "contact_ai_profiles", "workspace_analysis_settings"];
const policies = [
  ["workspace", "workspaces", "workspaces_select_owner_or_member"],
  ["workspace", "workspace_members", "workspace_members_select_own"],
  ["workspace", "workspace_members", "workspace_members_insert_workspace_owner"],
  ...["select", "insert", "update"].map(command => ["contacts", "contacts", `contacts_${command}_workspace_member`]),
  ["conversations", "conversations", "conversations_workspace_member_all"],
  ["profiles", "contact_ai_profiles", "contact_ai_profiles_select_workspace_member"],
  ["profiles", "workspace_analysis_settings", "workspace_analysis_settings_select_workspace_member"],
  ["workspaceColumns", "workspaces", "workspaces_update_owner"],
  ["workspaceColumns", "workspaces", "workspaces_update_owner_boundary"],
  ["boundary", "workspaces", "workspaces_select_requires_owner"],
  ["boundary", "workspace_analysis_settings", "workspace_analysis_settings_select_requires_workspace_owner"],
];
export const CREATOR_FOUNDATION_PARENT_HELPERS = [
  ["workspace_processing_allowed_contract", "workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)", "boundary"],
  ["workspace_owner_active_mutation_allowed", "workspace_owner_active_mutation_allowed(uuid)", "boundary"],
  ["set_contacts_updated_at", "set_contacts_updated_at()", "contacts"],
  ["set_conversations_updated_at", "set_conversations_updated_at()", "conversations"],
  ["set_memory_profiles_updated_at", "set_memory_profiles_updated_at()", "memoryProfiles"],
  ["create_default_workspace_analysis_settings", "create_default_workspace_analysis_settings()", "profiles"],
  ["set_meta_content_intelligence_updated_at", "set_meta_content_intelligence_updated_at()", "profiles"],
];
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = () => {throw new Error("CREATOR_FOUNDATION_RECONCILIATION_ERROR=parent_source_contract");};

export function loadPinnedCreatorParentSources() {
  return Object.fromEntries(Object.entries(CREATOR_FOUNDATION_PARENT_PINS).map(([name, pin]) => {
    const sql = readFileSync(new URL(pin.path, import.meta.url), "utf8");
    if (hash(sql) !== pin.sha256) fail();
    return [name, sql];
  }));
}

export function creatorFoundationParentPolicyInventory() {
  return [...policies.map(([, table, name]) => ({schema: "public", table, name})),
    ...["contacts", "conversations", "contact_ai_profiles"].flatMap(table => ["insert", "update", "delete"].map(command => ({schema: "public", table, name: `${table}_${command}_requires_workspace_owner`})))]
    .sort((a, b) => a.name.localeCompare(b.name));
}

function helperStatement(source, name) {
  const statement = source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as (\\$(?:function)?\\$)[\\s\\S]*?\\1;`, "u"))?.[0];
  if (!statement) fail();
  return statement;
}

// Explicit supported replay profile: this is not an installed-target assertion.
// All selected DDL is copied byte-for-byte from independently pinned sources.
// Unrelated feature FK action triggers are excluded by the catalog projection;
// every user trigger and every outgoing scoped constraint remains compared.
export const CREATOR_FOUNDATION_PARENT_PROFILE = "canonical_billing_baseline_aug16_v1";
const structureLayers = ["workspace", "billingBaseline", "contacts", "conversations", "messageRetention", "memoryProfiles", "sourceMetadata", "contactNotes", "billing", "flags", "masterData", "contactTopFan", "cancellation", "provisioning", "profiles", "incrementalHistory", "assignment"];
function structuralStatements(source) {
  // These exact, pinned sources use ordinary static statements for these DDL
  // forms. Strip standalone comments so historical commented examples cannot
  // accidentally become part of the replay. Function bodies are handled below.
  const sql = source.replace(/^\s*--[^\n]*$/gmu, "");
  const tables = CREATOR_FOUNDATION_PARENT_TABLES.join("|");
  const patterns = [
    new RegExp(`create table if not exists public\\.(?:${tables})\\s*\\([\\s\\S]*?\\n\\);`, "gu"),
    new RegExp(`alter table public\\.(?:${tables})\\s[\\s\\S]*?;`, "gu"),
    new RegExp(`create (?:unique )?index (?:if not exists )?[a-z_]+\\s+on public\\.(?:${tables})\\s[\\s\\S]*?;`, "gu"),
  ];
  return patterns.flatMap(pattern => [...sql.matchAll(pattern)].map(match => ({index: match.index, sql: match[0]}))).sort((a, b) => a.index - b.index).map(row => row.sql);
}

export function creatorFoundationParentHelperBodies() {
  const sources = loadPinnedCreatorParentSources();
  return CREATOR_FOUNDATION_PARENT_HELPERS.map(([name, identity, source]) => {
    const body = helperStatement(sources[source], name).match(/as (\$(?:function)?\$)([\s\S]*?)\1;/u)?.[2];
    if (body === undefined) fail();
    return {schema: "public", name, identity, bodySha256: hash(body)};
  });
}

export function buildCreatorFoundationParentReferenceSql() {
  const sources = loadPinnedCreatorParentSources();
  const defaults = [...sources.providerDefaults.matchAll(/alter default privileges in schema public grant all on (?:tables|functions) to postgres, anon, authenticated, service_role;/gu)].map(match => match[0]);
  if (defaults.length !== 2) fail();
  const statements = [...defaults, ...structureLayers.flatMap(layer => structuralStatements(sources[layer]))];
  for (const [name, , source] of CREATOR_FOUNDATION_PARENT_HELPERS) {
    statements.push(helperStatement(sources[source], name));
    if (source !== "boundary") continue;
    const acl = sources.boundary.match(new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?to authenticated;`, "u"))?.[0];
    if (!acl) fail();
    statements.push(acl);
  }
  for (const [source, name] of [["contacts", "contacts_set_updated_at"], ["conversations", "conversations_set_updated_at"], ["memoryProfiles", "contact_ai_profiles_set_updated_at"], ["profiles", "workspaces_create_analysis_settings"], ["profiles", "workspace_analysis_settings_set_updated_at"]]) {
    const trigger = sources[source].match(new RegExp(`create trigger ${name}\\s[\\s\\S]*?;`, "u"))?.[0];
    if (!trigger) fail();
    statements.push(trigger);
  }
  const settingsAcl = sources.profiles.match(/revoke all on function public\.create_default_workspace_analysis_settings\(\)[\s\S]*?;/u)?.[0];
  const settingsUpdateAcl = sources.profiles.match(/revoke all on function public\.set_meta_content_intelligence_updated_at\(\)[\s\S]*?;/u)?.[0];
  const workspaceRevoke = sources.workspaceColumns.match(/revoke insert, update on table public\.workspaces[\s\S]*?;/u)?.[0];
  const columnRevoke = sources.workspaceColumns.match(/do \$\$\ndeclare\n  v_all_columns text;[\s\S]*?\n\$\$;/u)?.[0];
  const workspaceGrant = sources.workspaceColumns.match(/grant update \([\s\S]*?to authenticated;/u)?.[0];
  const serviceGrant = sources.workspaceColumns.match(/grant insert, update on table public\.workspaces[\s\S]*?to service_role;/u)?.[0];
  if ([settingsAcl, settingsUpdateAcl, workspaceRevoke, columnRevoke, workspaceGrant, serviceGrant].some(value => !value)) fail();
  statements.push(settingsAcl, settingsUpdateAcl, workspaceRevoke, columnRevoke, workspaceGrant, serviceGrant);
  for (const table of ["contact_ai_profiles", "workspace_analysis_settings"]) {
    const acl = sources.profiles.match(new RegExp(`revoke all on table public\\.${table} from anon, authenticated;\\s*grant select on table public\\.${table} to authenticated;`, "u"))?.[0];
    if (!acl) fail();
    statements.push(acl);
  }
  for (const [source, table, name] of policies) {
    const statement = sources[source].match(new RegExp(`create policy "?${name}"?\\s+on public\\.${table}\\s[\\s\\S]*?;`, "u"))?.[0];
    if (!statement) fail();
    statements.push(statement);
  }
  // The canonical block covers twelve product tables. Reproduce its unchanged
  // CREATE POLICY templates only for the three tables within this preflight.
  for (const table of ["contacts", "conversations", "contact_ai_profiles"]) {
    for (const command of ["insert", "update", "delete"]) {
      const template = sources.boundary.match(new RegExp(`'create policy %I on public\\.%I as restrictive for ${command} to authenticated[^']+'`, "u"))?.[0];
      if (!template) fail();
      statements.push(`${template.slice(1, -1).replace("%I", `${table}_${command}_requires_workspace_owner`).replace("%I", table)};`);
    }
  }
  return `${statements.join("\n")}\n`;
}
