import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const SUPPORT_SQL_PATHS=['supabase/controlled/support_centre.sql','supabase/controlled/support_centre_operations.sql'];
export const REFERENCE_PATH='docs/operations/support-centre-reference.json';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function canonical(value){return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);}
export function sourceManifest(){
 const sources=SUPPORT_SQL_PATHS.map(path=>({path,sql:readFileSync(path,'utf8')}));
 const tables=sources.flatMap(s=>[...s.sql.matchAll(/CREATE TABLE public\.([a-z_]+)/g)].map(m=>m[1]));
 const functions=[...new Set(sources.flatMap(s=>[...s.sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION public\.([a-z_]+)/g)].map(m=>m[1])))];
 const triggers=sources.flatMap(s=>[...s.sql.matchAll(/CREATE TRIGGER ([a-z_]+)[\s\S]*? ON public\.([a-z_]+)/g)].map(m=>({name:m[1],table:m[2]})));
 return {version:1,sources:sources.map(s=>({path:s.path,sha256:digest(s.sql)})),tables,functions,triggers};
}
const literal=s=>`'${s.replaceAll("'","''")}'`;
export function catalogueSql(manifest=sourceManifest()){
 const tables=manifest.tables.map(literal).join(','),functions=manifest.functions.map(literal).join(',');
 return `SELECT jsonb_build_object(
 'extra_relations',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind NOT IN ('r','p','S','i','I') AND (c.relname LIKE 'support_centre_%' OR c.relname LIKE 'support_chat_%' OR c.relname LIKE 'support_retention_%')),'[]'::jsonb),
 'tables',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'persistence',c.relpersistence,'options',c.reloptions,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'policies',(SELECT jsonb_agg(jsonb_build_object('name',pol.polname,'permissive',pol.polpermissive,'command',pol.polcmd,'roles',(SELECT jsonb_agg(coalesce(r.rolname,'PUBLIC') ORDER BY coalesce(r.rolname,'PUBLIC')) FROM unnest(pol.polroles) x(oid) LEFT JOIN pg_roles r ON r.oid=x.oid),'using',pg_get_expr(pol.polqual,pol.polrelid),'check',pg_get_expr(pol.polwithcheck,pol.polrelid)) ORDER BY pol.polname) FROM pg_policy pol WHERE pol.polrelid=c.oid),
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'collation',(SELECT collname FROM pg_collation WHERE oid=a.attcollation),'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl::text) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'def',pg_get_constraintdef(x.oid,true)) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=c.oid),
 'acl',(SELECT jsonb_agg(jsonb_build_object('role',coalesce(r.rolname,'PUBLIC'),'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a LEFT JOIN pg_roles r ON r.oid=a.grantee)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (c.relname IN(${tables}) OR c.relname LIKE 'support_centre_%' OR c.relname LIKE 'support_chat_%' OR c.relname LIKE 'support_retention_%')),'[]'::jsonb),
 'functions',coalesce((SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'defaults',pg_get_expr(p.proargdefaults,0),'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'kind',p.prokind,'volatility',p.provolatile,'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof,'cost',p.procost,'rows',p.prorows,'body',p.prosrc,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,
 'acl',(SELECT jsonb_agg(jsonb_build_object('role',coalesce(r.rolname,'PUBLIC'),'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a LEFT JOIN pg_roles r ON r.oid=a.grantee)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname IN(${functions}) OR p.proname LIKE 'support_centre_%' OR p.proname LIKE 'support_chat_%' OR p.proname LIKE 'support_retention_%')),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN(${tables}) AND NOT t.tgisinternal),'[]'::jsonb),
 'sequences',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.relname,'parameters',(SELECT jsonb_build_object('type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'max',s.seqmax::text,'min',s.seqmin::text,'cache',s.seqcache::text,'cycle',s.seqcycle) FROM pg_sequence s WHERE s.seqrelid=c.oid),'owner',pg_get_userbyid(c.relowner),'acl',(SELECT jsonb_agg(jsonb_build_object('role',coalesce(r.rolname,'PUBLIC'),'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM aclexplode(coalesce(c.relacl,acldefault('s',c.relowner)))a LEFT JOIN pg_roles r ON r.oid=a.grantee)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' AND (c.relname LIKE 'support_chat_%' OR c.relname LIKE 'support_centre_%' OR c.relname LIKE 'support_retention_%')),'[]'::jsonb));`;
}
export function classify(catalogue,reference){
 if(!catalogue||!['tables','functions','triggers','sequences','extra_relations'].every(k=>Array.isArray(catalogue[k])))return 'INCOMPLETE';
 if(['tables','functions','triggers','sequences','extra_relations'].every(k=>catalogue[k].length===0))return 'ABSENT';
 if(!reference||reference.provenance?.kind!=='synthetic_ci_pg17'||!/^17\./.test(reference.provenance?.server_version??'')||canonical(reference.manifest)!==canonical(sourceManifest()))return 'REFERENCE_REQUIRED';
 return canonical(catalogue)===canonical(reference.catalogue)?'EXACT':'DRIFT';
}
export function assertReference(reference){
 if(!reference||reference.provenance?.kind!=='synthetic_ci_pg17'||!/^17\./.test(reference.provenance?.server_version??'')||canonical(reference.manifest)!==canonical(sourceManifest())||reference.catalogue_sha256!==digest(canonical(reference.catalogue)))throw new Error('reference_invalid');
 const c=reference.catalogue,m=sourceManifest();
 if(c.extra_relations?.length!==0||c.tables.some(t=>t.policies!==null)||c.tables.length!==m.tables.length||c.functions.length!==m.functions.length||c.triggers.length!==m.triggers.length||c.sequences.length!==1)throw new Error('reference_manifest_incomplete');
 for(const obj of [...c.tables,...c.functions,...c.sequences]){
  if(obj.owner!=='postgres'||(obj.rls!==undefined&&!obj.rls)||obj.acl?.some(a=>!['postgres','service_role'].includes(a.role)||a.grantable))throw new Error('reference_authority_invalid');
  if(c.tables.includes(obj)&&obj.acl?.some(a=>a.role==='service_role'&&a.privilege!=='SELECT'))throw new Error('reference_table_write_grant');
  if(c.sequences.includes(obj)&&obj.acl?.some(a=>a.role!=='postgres'))throw new Error('reference_sequence_grant');
  if(['support_centre_purge','run_support_retention'].includes(obj.name)&&obj.acl?.some(a=>a.role!=='postgres'))throw new Error('reference_operator_grant');
  if(obj.columns?.some(a=>a.acl!==null))throw new Error('reference_column_acl_invalid');
 }
}
// Effective role inheritance is checked separately from object ACLs; no role is changed.
export function roleBoundarySql(){return `SELECT (SELECT count(*) FROM pg_roles WHERE rolname IN('anon','authenticated','service_role'))=3 AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND (r.rolsuper OR pg_has_role(r.rolname,'postgres','MEMBER') OR (r.rolname IN('anon','authenticated') AND (r.rolbypassrls OR pg_has_role(r.rolname,'service_role','MEMBER'))))) AS safe;`;}
export function installSql(reference){
 assertReference(reference);
 const sql=SUPPORT_SQL_PATHS.map(p=>readFileSync(p,'utf8').replace(/^BEGIN;\s*$/mg,'').replace(/^COMMIT;\s*$/mg,'')).join('\n');
 const expected=literal(JSON.stringify(reference.catalogue));
 return `\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='60s';\nSET LOCAL standard_conforming_strings=on;\nSELECT pg_advisory_xact_lock(1350,1417);\nCREATE TEMP TABLE support_role_guard ON COMMIT DROP AS ${roleBoundarySql()}\nSELECT 1/(CASE WHEN (SELECT safe FROM support_role_guard) THEN 1 ELSE 0 END);\nDO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (c.relname LIKE 'support_centre_%' OR c.relname LIKE 'support_chat_%' OR c.relname LIKE 'support_retention_%')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'support_centre_%' OR p.proname LIKE 'support_chat_%' OR p.proname LIKE 'support_retention_%' OR p.proname='run_support_retention')) THEN RAISE EXCEPTION 'support_not_absent'; END IF; END $$;\n${sql}\nCREATE TEMP TABLE support_postflight ON COMMIT DROP AS ${catalogueSql()}\nSELECT 1/(CASE WHEN (SELECT jsonb_build_object FROM support_postflight)=${expected}::jsonb THEN 1 ELSE 0 END);\nCOMMIT;\nSELECT 'SUPPORT_APPLY=PASS';`;

}
export function rollbackSql(reference){
 assertReference(reference);const m=sourceManifest();
 const empty=m.tables.map(t=>`IF EXISTS(SELECT 1 FROM public.${t}) THEN RAISE EXCEPTION 'support_rollback_requires_empty'; END IF;`).join('\n');
 const funcs=reference.catalogue.functions.map(f=>`DROP FUNCTION public.${f.name}(${f.arguments});`).reverse().join('\n');
 const order=['support_retention_runs','support_chat_turns','support_centre_events','support_centre_cases','support_chat_threads','support_centre_notifications','support_centre_owners'];
 return `BEGIN;\nSELECT pg_advisory_xact_lock(1350,1417);\n${m.tables.map(t=>`LOCK TABLE public.${t} IN ACCESS EXCLUSIVE MODE;`).join('\n')}\nCREATE TEMP TABLE support_rollback_postflight ON COMMIT DROP AS ${catalogueSql()}\nSELECT 1/(CASE WHEN (SELECT jsonb_build_object FROM support_rollback_postflight)=${literal(JSON.stringify(reference.catalogue))}::jsonb THEN 1 ELSE 0 END);\nDO $$ BEGIN ${empty} END $$;\n${m.triggers.map(t=>`DROP TRIGGER ${t.name} ON public.${t.table};`).join('\n')}\n${funcs}\n${order.map(t=>`DROP TABLE public.${t};`).join('\n')}\nCOMMIT;`;
}
