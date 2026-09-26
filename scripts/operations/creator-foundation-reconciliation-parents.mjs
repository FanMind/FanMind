// Reviewed parent authorization sources. Never construct these expectations
// from a target catalog. SQL returned here is for isolated reference CI only.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

export const CREATOR_FOUNDATION_PARENT_PINS = Object.freeze({
  workspace: {path: "../../docs/database/fanmind_mvp_schema.sql", sha256: "e84ac6101e8f3e8c09276f71e159c6bc057d8e246b1a6212430421a0ed42166a"},
  contacts: {path: "../../supabase/migrations/20260609120000_create_contacts.sql", sha256: "802211ddf2ec857af3ea9d3f637255d3e6e11182363ec117aaa45fa84a9310b6"},
  conversations: {path: "../../supabase/migrations/20260613120000_create_conversations_messages.sql", sha256: "fb97836e47da84ba4964cc5cd4e1671155abd4b9f298b18c212172bbd1acb191"},
  profiles: {path: "../../supabase/migrations/20260803120000_meta_content_intelligence_foundation.sql", sha256: "3936aeddf0c6b2ed2e3628c169eb52ed64264a3cf97c53c9c91a2063da7c55af"},
  workspaceColumns: {path: "../../supabase/controlled/20260726121000_workspace_server_owned_columns.sql", sha256: "a015aabfa4f7ac778f3159fbd5e2a3126cd56c86571c8def946c5f4998ad8591"},
  boundary: {path: "../../supabase/controlled/20260816120000_workspace_member_data_boundary.sql", sha256: "ca9adfea6db85a48d75998e060f6b345a882a8b1889d20c7d04c438316985c93"},
});
export const CREATOR_FOUNDATION_PARENT_TABLES = ["workspaces", "workspace_members", "contacts", "conversations", "contact_ai_profiles"];
const policies = [
  ["workspace", "workspaces", "workspaces_select_owner_or_member"],
  ["workspace", "workspace_members", "workspace_members_select_own"],
  ["workspace", "workspace_members", "workspace_members_insert_workspace_owner"],
  ...["select", "insert", "update"].map(command => ["contacts", "contacts", `contacts_${command}_workspace_member`]),
  ["conversations", "conversations", "conversations_workspace_member_all"],
  ["profiles", "contact_ai_profiles", "contact_ai_profiles_select_workspace_member"],
  ["workspaceColumns", "workspaces", "workspaces_update_owner"],
  ["workspaceColumns", "workspaces", "workspaces_update_owner_boundary"],
  ["boundary", "workspaces", "workspaces_select_requires_owner"],
];
export const CREATOR_FOUNDATION_PARENT_HELPERS = [
  ["workspace_processing_allowed_contract", "workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)"],
  ["workspace_owner_active_mutation_allowed", "workspace_owner_active_mutation_allowed(uuid)"],
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
  const statement = source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$function\\$;`, "u"))?.[0];
  if (!statement) fail();
  return statement;
}

export function creatorFoundationParentHelperBodies() {
  const sources = loadPinnedCreatorParentSources();
  return CREATOR_FOUNDATION_PARENT_HELPERS.map(([name, identity]) => {
    const body = helperStatement(sources.boundary, name).match(/as \$function\$([\s\S]*?)\$function\$;/u)?.[1];
    if (body === undefined) fail();
    return {schema: "public", name, identity, bodySha256: hash(body)};
  });
}

export function buildCreatorFoundationParentReferenceSql() {
  const sources = loadPinnedCreatorParentSources();
  const statements = [];
  for (const [name] of CREATOR_FOUNDATION_PARENT_HELPERS) {
    statements.push(helperStatement(sources.boundary, name));
    const acl = sources.boundary.match(new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?to authenticated;`, "u"))?.[0];
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
