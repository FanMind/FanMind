// One reproducible upstream-source profile, not a claim about Hosted defaults.
// Native PG17 must compile and compare this entire contract before reference export.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

export const CREATOR_FOUNDATION_PROVIDER_PINS = Object.freeze({
  authUid: {source: "https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/migrations/20220224000811_update_auth_functions.up.sql", sourceSha256: "5b72022d73e64a8e474d2122ac42f299bb7ce4d59755cdcc78e72abfe5d47dc0", statementSha256: "6c4bdc71688870c8e180e66b0121a105e5c3f45b3160bf077d771d39a5e12984", bodySha256: "9ab5ea099e74ec09e83b1505c51a3647791195aed7c742dcc3f257dfc7d2f300"},
  namespaces: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/nix/tests/expected/roles.out", sourceSha256: "2c47ca3f6c3132b546506328de71913b1c4b033a84fa31d4564e338593f77cc6"},
  authPermissions: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20211115181400_update-auth-permissions.sql", sourceSha256: "bbaa44bc707538e6c67ae8c71a386c41e136cd30fcde563db39c9d0fbde9bdcb"},
  authOwner: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20211124212715_update-auth-owner.sql", sourceSha256: "9698f481ad9cb159df6cefd5cc4b94f4b9db0eda475317aaa057b1e9a54409e0"},
  authInitialization: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/init-scripts/00000000000001-auth-schema.sql", sourceSha256: "65a4a55ba3248716eb4946a8677be41c94bc90eafaa22c0eb95b09908f96fa4f"},
  publicInitialization: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/init-scripts/00000000000000-initial-schema.sql", sourceSha256: "84588fff60ff3cadcd361c820fe502052f4c5fd5aa273740e0690c5ee59ec813"},
  dashboardGrants: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/init-scripts/00000000000003-post-setup.sql", sourceSha256: "f38552008ac577b3e65fbcab784a612b72d079f6695871c84b045a1a921f7096"},
  postgresAuthCreateRevocation: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20250421084701_revoke_admin_roles_from_postgres.sql", sourceSha256: "77679a5c54d2baccc445d79d3b66429181d37937c1c05627742d205e580441f6"},
  rolesExpected: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/nix/tests/expected/roles.out", sourceSha256: "2c47ca3f6c3132b546506328de71913b1c4b033a84fa31d4564e338593f77cc6"},
  membershipsExpected: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/nix/tests/expected/z_17_roles.out", sourceSha256: "a8c1f649f1d82eec73d572169fb7d0b21ce034571a3bb7703d84a666a8aefb31"},
  membershipInitialization: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/init-scripts/00000000000000-initial-schema.sql", sourceSha256: "84588fff60ff3cadcd361c820fe502052f4c5fd5aa273740e0690c5ee59ec813"},
  membershipApiInherit: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20230529180330_alter_api_roles_for_inherit.sql", sourceSha256: "e78a67f8e6ae847765a80898824d404ab370daa3d6f6dbf61ea6d9e0a69144f3"},
  membershipPostgresAdmin: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20250605172253_grant_with_admin_to_postgres_16_and_above.sql", sourceSha256: "1daa645828b02f85325a563c6a0b3d81e15e729fa3de442c8cdf9e43c174acf8"},
  membershipStorageAuthenticator: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20231013070755_grant_authenticator_to_supabase_storage_admin.sql", gitBlob: "7597f2915169dbefbd7ed5fcfed8faff896e602d"},
  membershipPredefinedRoles: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20251001204436_predefined_role_grants.sql", gitBlob: "4ad8153e1d7524e9303acc724d7c16fa19bc5fd8"},
  membershipPrivilegedRole: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20260211120934_supabase_privileged_role.sql", gitBlob: "264b8ca0ee2f318125064c6b91fdc957b9453ccc"},
  membershipPgtleAdmin: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/ansible/files/postgresql_extension_custom_scripts/pg_tle/after-create.sql", gitBlob: "eb8aeff7effd01b573fff6b0ff32db68c7e4e652"},
  authenticatorAdminRevocation: {source: "https://github.com/supabase/postgres/blob/ff04e1233f2b545a8223652786d459de46aba816/migrations/db/migrations/20221103090837_revoke_admin.sql", sourceSha256: "8fff945cd6f11ab68b2f300c64d43a38ef69d61987aaf596a1d00bfa225234e8"},
});

export function loadPinnedCreatorProviderAuthSql() {
  const sql = readFileSync(new URL("./creator-foundation-reconciliation-artifacts/provider-auth-uid.sql", import.meta.url), "utf8");
  if (createHash("sha256").update(sql).digest("hex") !== CREATOR_FOUNDATION_PROVIDER_PINS.authUid.statementSha256) throw new Error("CREATOR_FOUNDATION_RECONCILIATION_ERROR=provider_artifact_checksum");
  return sql;
}

export function buildCreatorFoundationProviderReferenceSql() {
  return `SET ROLE postgres;\n${loadPinnedCreatorProviderAuthSql()}GRANT ALL ON FUNCTION auth.uid() TO postgres,dashboard_user;\nDO $provider$ BEGIN
  IF pg_catalog.pg_get_userbyid((SELECT proowner FROM pg_catalog.pg_proc WHERE oid = 'auth.uid()'::pg_catalog.regprocedure)) <> 'postgres' THEN
    RAISE EXCEPTION 'creator_provider_auth_uid_original_owner_invalid';
  END IF;
END $provider$;\nRESET ROLE;\nALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;\n`;
}

const browsers = ["anon", "authenticated", "service_role"];
function acl(owner, entries) {
  return entries.flatMap(([grantee, privileges]) => privileges.map(privilege => ({grantor: owner, grantee, privilege, grantable: false})))
    .sort((a, b) => Number(b.grantee === "PUBLIC") - Number(a.grantee === "PUBLIC") || a.grantee.localeCompare(b.grantee) || a.privilege.localeCompare(b.privilege));
}

// PUBLIC USAGE on public and PUBLIC EXECUTE on functions are native PG17
// creation defaults; the required native test checks them, not roles.out's
// pg_roles join (which excludes PUBLIC). All explicit grants retain grantors.
export function creatorFoundationUpstreamProviderContract() {
  return {
    profile: "supabase_upstream_source_pg17_v1", sourcePins: structuredClone(CREATOR_FOUNDATION_PROVIDER_PINS),
    namespaces: [
      {schema: "auth", owner: "supabase_admin", directAcl: acl("supabase_admin", [["supabase_admin", ["CREATE", "USAGE"]], ["supabase_auth_admin", ["CREATE", "USAGE"]], ["dashboard_user", ["CREATE", "USAGE"]], ...["postgres", ...browsers].map(role => [role, ["USAGE"]])]), effectiveAcl: browsers.flatMap(role => [{role, privilege: "CREATE", allowed: false, grantable: false}, {role, privilege: "USAGE", allowed: true, grantable: false}])},
      {schema: "public", owner: "pg_database_owner", directAcl: acl("pg_database_owner", [["PUBLIC", ["USAGE"]], ["pg_database_owner", ["CREATE", "USAGE"]], ...["postgres", ...browsers].map(role => [role, ["USAGE"]])]), effectiveAcl: browsers.flatMap(role => [{role, privilege: "CREATE", allowed: false, grantable: false}, {role, privilege: "USAGE", allowed: true, grantable: false}])},
    ],
    authUidFunctions: [{schema: "auth", name: "uid", identity: "uid()", owner: "supabase_auth_admin", language: "sql", bodySha256: CREATOR_FOUNDATION_PROVIDER_PINS.authUid.bodySha256,
      binary: null, sqlBodyPresent: false, kind: "f", securityDefiner: false, leakproof: false, strict: false, returnsSet: false, volatility: "s", parallel: "u", cost: 100, rows: 0,
      inputCount: 0, defaultCount: 0, returnType: "uuid", argTypes: [], allArgTypes: null, argModes: null, argNames: null, defaults: null, variadicType: null, support: null, transformTypes: null, config: null,
      directAcl: acl("supabase_auth_admin", [["PUBLIC", ["EXECUTE"]], ["supabase_auth_admin", ["EXECUTE"]], ["postgres", ["EXECUTE"]], ["dashboard_user", ["EXECUTE"]]]),
      effectiveAcl: browsers.map(role => ({role, privilege: "EXECUTE", allowed: true, grantable: false})),
    }],
  };
}

const hostedRoles = [
  ["anon", false, true, false, false, false, false, false, ["statement_timeout=3s"]],
  ["authenticated", false, true, false, false, false, false, false, ["statement_timeout=8s"]],
  ["authenticator", false, false, false, false, true, false, false, ["session_preload_libraries=supautils, safeupdate", "statement_timeout=8s", "lock_timeout=8s"]],
  ["dashboard_user", false, true, true, true, false, true, false, null],
  ["pg_create_subscription", false, true, false, false, false, false, false, null],
  ["pg_database_owner", false, true, false, false, false, false, false, null],
  ["pg_monitor", false, true, false, false, false, false, false, null],
  ["pg_read_all_data", false, true, false, false, false, false, false, null],
  ["pg_read_all_settings", false, true, false, false, false, false, false, null],
  ["pg_read_all_stats", false, true, false, false, false, false, false, null],
  ["pg_signal_backend", false, true, false, false, false, false, false, null],
  ["pg_stat_scan_tables", false, true, false, false, false, false, false, null],
  ["pgtle_admin", false, true, false, false, false, false, false, null],
  ["postgres", false, true, true, true, true, true, true, ['search_path="$user", public, extensions']],
  ["service_role", false, true, false, false, false, false, true, null],
  ["supabase_admin", true, true, true, true, true, true, true, ['search_path="$user", public, auth, extensions', "log_statement=none"]],
  ["supabase_auth_admin", false, false, true, false, true, false, false, ["search_path=auth", "idle_in_transaction_session_timeout=60000", "log_statement=none"]],
  ["supabase_etl_admin", false, true, false, false, true, true, true, null],
  ["supabase_privileged_role", false, true, false, false, false, false, false, null],
  ["supabase_read_only_user", false, true, false, false, true, false, true, ["default_transaction_read_only=on"]],
  ["supabase_storage_admin", false, false, true, false, true, false, false, ["search_path=storage", "log_statement=none"]],
].map(([name, superuser, inherit, createRole, createDb, canLogin, replication, bypassRls, config]) => ({name, superuser, inherit, createRole, createDb, canLogin, replication, bypassRls, connectionLimit: -1, validUntil: null, config}));

const hostedMemberships = [
  ["anon", "authenticator", false, false, true],
  ["authenticated", "authenticator", false, false, true],
  ["service_role", "authenticator", false, false, true],
  ["pg_read_all_settings", "pg_monitor", false, true, true],
  ["pg_read_all_stats", "pg_monitor", false, true, true],
  ["pg_stat_scan_tables", "pg_monitor", false, true, true],
  ["anon", "postgres", true, true, true],
  ["authenticated", "postgres", true, true, true],
  ["authenticator", "postgres", true, true, true],
  ["pg_create_subscription", "postgres", true, true, true],
  ["pg_monitor", "postgres", true, true, true],
  ["pg_read_all_data", "postgres", true, true, true],
  ["pg_signal_backend", "postgres", true, true, true],
  ["pgtle_admin", "postgres", false, true, true],
  ["service_role", "postgres", true, true, true],
  ["supabase_privileged_role", "postgres", false, true, true],
  ["pg_monitor", "supabase_etl_admin", false, true, true],
  ["pg_read_all_data", "supabase_etl_admin", false, true, true],
  ["supabase_privileged_role", "supabase_etl_admin", false, true, true],
  ["pg_monitor", "supabase_read_only_user", false, true, true],
  ["pg_read_all_data", "supabase_read_only_user", false, true, true],
  ["authenticator", "supabase_storage_admin", false, false, true],
].map(([role, member, adminOption, inheritOption, setOption]) => ({role, member, grantor: "supabase_admin", adminOption, inheritOption, setOption}));

function membershipSource(membership) {
  if (membership.member === "authenticator") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipInitialization.source;
  if (membership.member === "pg_monitor") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipsExpected.source;
  if (membership.member === "supabase_storage_admin") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipStorageAuthenticator.source;
  if (membership.role === "pgtle_admin") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipPgtleAdmin.source;
  if (membership.role === "supabase_privileged_role") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipPrivilegedRole.source;
  if (membership.role === "pg_create_subscription" || membership.role === "pg_monitor") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipPredefinedRoles.source;
  if (["pg_read_all_data", "pg_signal_backend", "anon", "authenticated", "service_role", "authenticator"].includes(membership.role) && membership.member === "postgres") return CREATOR_FOUNDATION_PROVIDER_PINS.membershipPostgresAdmin.source;
  return CREATOR_FOUNDATION_PROVIDER_PINS.membershipInitialization.source;
}

export function creatorFoundationHostedPg17RoleProfile() {
  return {
    profile: "supabase_hosted_pg17_roles_ff04e123_v1",
    targetApproved: false,
    roles: structuredClone(hostedRoles),
    memberships: structuredClone(hostedMemberships),
    provenance: hostedMemberships.map(membership => ({membership: structuredClone(membership), source: membershipSource(membership)})),
    supportingSources: [CREATOR_FOUNDATION_PROVIDER_PINS.rolesExpected.source, CREATOR_FOUNDATION_PROVIDER_PINS.membershipsExpected.source, CREATOR_FOUNDATION_PROVIDER_PINS.membershipApiInherit.source],
    sourcePins: structuredClone(CREATOR_FOUNDATION_PROVIDER_PINS),
    providerContract: creatorFoundationUpstreamProviderContract(),
  };
}
