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
});

export function loadPinnedCreatorProviderAuthSql() {
  const sql = readFileSync(new URL("./creator-foundation-reconciliation-artifacts/provider-auth-uid.sql", import.meta.url), "utf8");
  if (createHash("sha256").update(sql).digest("hex") !== CREATOR_FOUNDATION_PROVIDER_PINS.authUid.statementSha256) throw new Error("CREATOR_FOUNDATION_RECONCILIATION_ERROR=provider_artifact_checksum");
  return sql;
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
