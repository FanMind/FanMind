// Pure offline verifier. No connections, SQL execution, apply or environment flags.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
export const CURRENT_FACTS_SQL_SHA256="a980ccc6268e4515f71d2be2ce486d6fd3f7a38745d819b8cd83245505701947";
const root=new URL("../../",import.meta.url);
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
export const PROFILE_PINS=Object.freeze({
 "tests/fixtures/chat-admin-current-facts.sql":"136ee144d4befd0bafffdff3223234c0f3500d25dc0fea762ecc78495d804b01",
 "supabase/controlled/chat_admin_current_facts.sql":CURRENT_FACTS_SQL_SHA256,
 "supabase/controlled/20260920230000_chat_admin_multi_character.sql":"9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b",
 "supabase/controlled/20260927200000_chat_admin_character_fans.sql":"36990f58521e3986542f5b9b206af93f9fa4a6e6439352b4b11ead7685e4275a",
 "supabase/controlled/20261007102000_chat_admin_customer_tier.sql":"64919d2f74e5042d7d00014afae60f03fcd72e254ebcade5a7fcda9f2acd8797",
 "supabase/controlled/20261007190000_chat_admin_structured_offers.sql":"01104f6e1e2a4edfda8ec2c50af784fad89f234ed3f0a9bfaf827eacb9803421",
 "scripts/operations/chat-admin-staging-runner.mjs":"3405cf075ff2003b9273834a82855a08f733e800cd7444a99c40560b98239964",
 "scripts/operations/chat-admin-fan-staging-runner.mjs":"78bcdb0752cb15c59188a0bd16c0ee4260bda53369149446c81278093a051038",
 "scripts/operations/chat-admin-structured-offers-staging-runner.mjs":"f1eb9c30e7c77da69c696ede51894b9de032ad06a54a9bac65f0db952f3b1029",
 "scripts/operations/chat-admin-customer-tier-staging-runner.mjs":"a72b5e5b5429cf144886585be0876a615cb9a1fd8ec969557fe572bc8c57cf42",
 "scripts/operations/chat-admin-manual-flow-staging.mjs":"574ff27e1bd218284b6f81c636fcf12b9cc22b93b38e6019687c0a68232aef5d",
 "scripts/operations/database-authorization-contract.mjs":"b80490c17270a830dc409fc4d3755224e23facdc23a6f4ee34fb28189f7544de",
});
// Fixed reviewed reference; never learn/approve a catalog from a checked target.
const REFERENCE_SHA256="85cb0ddba33b69e8990e5c64ebddd2a3b5c300117be836dab9488529fa075e72";
const CATALOG_SHA256="93591f3662f389f6984206cccb94be8d6d9cf04641fbaeab2a8ef2d834344644";
export function loadCurrentFactsProfile(read=path=>readFileSync(new URL(path,root))){
 for(const [path,sha] of Object.entries(PROFILE_PINS))if(hash(read(path))!==sha)throw new Error("current_facts_profile_source_checksum");
 const query=read("scripts/operations/chat-admin-current-facts-catalog.sql");
 const bytes=read("docs/operations/chat-admin-current-facts-profile-reference.json");
 if(hash(query)!==CATALOG_SHA256||hash(bytes)!==REFERENCE_SHA256)throw new Error("current_facts_profile_reference_checksum");
 const reference=JSON.parse(bytes.toString());
 if(reference.version!==1||reference.sqlSha256!==CURRENT_FACTS_SQL_SHA256||reference.owner!=="postgres")throw new Error("current_facts_profile_reference_invalid");
 return {query:query.toString(),reference};
}
// PG17 dump/reparse flattens the AND introduced by BETWEEN in this one CHECK.
// Admit these two exact renderings only; no general expression rewriting.
const quoteCheckSource="CHECK ((((char_length(quote) >= 1) AND (char_length(quote) <= 240)) AND (quote = btrim(quote))))";
const quoteCheckRestored="CHECK (((char_length(quote) >= 1) AND (char_length(quote) <= 240) AND (quote = btrim(quote))))";
function canonicalCatalog(actual){
 if(!actual || !Array.isArray(actual.records))return actual;
 const result=structuredClone(actual);
 for(const r of result.records)if(r.kind==="constraint"&&r.relation==="public.chat_character_current_facts"&&r.name==="chat_character_current_facts_quote_check"&&r.definition===quoteCheckRestored)r.definition=quoteCheckSource;
 return result;
}
export function verifyCurrentFactsCatalog(actual,phase="current"){
 const loaded=loadCurrentFactsProfile();
 if(!["baseline","current"].includes(phase)||!isDeepStrictEqual(canonicalCatalog(actual),loaded.reference[phase]))throw new Error("current_facts_profile_catalog_mismatch");
 return `CURRENT_FACTS_OFFLINE_PROFILE=${phase.toUpperCase()}_VERIFIED`;
}
