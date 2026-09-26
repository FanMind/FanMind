// A fixed PostgreSQL 17 catalog snapshot. This module has no connection, file,
// environment, reference-generation or mutation capability. The caller must
// validate its own target before executing and keep the snapshot private.
const CATALOG_SQL = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
SET LOCAL TimeZone = 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
WITH RECURSIVE
creator_relations AS (
 SELECT c.*, n.nspname
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN
  ('creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events')
),
managed_relations AS (
 SELECT c.*, n.nspname
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN
  ('creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events',
   'contacts','conversations','contact_ai_profiles')
),
browser_roles(name) AS (VALUES ('anon'),('authenticated'),('service_role')),
table_privileges(name) AS (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')),
column_privileges(name) AS (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')),
role_component(oid) AS (
 SELECT r.oid FROM pg_catalog.pg_roles r
 WHERE r.rolname IN ('anon','authenticated','service_role','authenticator','postgres')
 UNION
 SELECT CASE WHEN m.roleid = rc.oid THEN m.member ELSE m.roleid END
 FROM role_component rc JOIN pg_catalog.pg_auth_members m ON m.roleid = rc.oid OR m.member = rc.oid
),
relevant_memberships AS (
 SELECT m.* FROM pg_catalog.pg_auth_members m
 WHERE m.roleid IN (SELECT oid FROM role_component) OR m.member IN (SELECT oid FROM role_component)
),
relevant_roles AS (
 SELECT r.* FROM pg_catalog.pg_roles r WHERE r.oid IN
  (SELECT oid FROM role_component UNION SELECT grantor FROM relevant_memberships)
),
table_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',c.nspname,'table',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
  'kind',c.relkind,'persistence',c.relpersistence,'rowSecurity',c.relrowsecurity,
  'forceRowSecurity',c.relforcerowsecurity,'isPartition',c.relispartition,
  'replicaIdentity',c.relreplident,'accessMethod',am.amname,'options',c.reloptions,
  'directAcl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'grantor',pg_catalog.pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
    'privilege',a.privilege_type,'grantable',a.is_grantable)
    ORDER BY a.grantee = 0 DESC,pg_catalog.pg_get_userbyid(a.grantee),a.privilege_type,pg_catalog.pg_get_userbyid(a.grantor),a.is_grantable)
   FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a),'[]'::jsonb),
  'effectiveAcl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'role',b.name,'privilege',v.name,'allowed',pg_catalog.has_table_privilege(r.oid,c.oid,v.name),
    'grantable',pg_catalog.has_table_privilege(r.oid,c.oid,v.name || ' WITH GRANT OPTION')) ORDER BY b.name,v.name)
   FROM browser_roles b CROSS JOIN table_privileges v LEFT JOIN pg_catalog.pg_roles r ON r.rolname = b.name),'[]'::jsonb),
  'parents',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',pn.nspname,'table',pc.relname,'sequence',i.inhseqno,'detachPending',i.inhdetachpending) ORDER BY pn.nspname,pc.relname)
   FROM pg_catalog.pg_inherits i JOIN pg_catalog.pg_class pc ON pc.oid = i.inhparent JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace WHERE i.inhrelid = c.oid),'[]'::jsonb),
  'children',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',cn.nspname,'table',cc.relname,'sequence',i.inhseqno,'detachPending',i.inhdetachpending) ORDER BY cn.nspname,cc.relname)
   FROM pg_catalog.pg_inherits i JOIN pg_catalog.pg_class cc ON cc.oid = i.inhrelid JOIN pg_catalog.pg_namespace cn ON cn.oid = cc.relnamespace WHERE i.inhparent = c.oid),'[]'::jsonb),
  'rewriteRules',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name',rw.rulename,'enabled',rw.ev_enabled,'definition',pg_catalog.pg_get_ruledef(rw.oid,false)) ORDER BY rw.rulename)
   FROM pg_catalog.pg_rewrite rw WHERE rw.ev_class = c.oid),'[]'::jsonb)
 ) AS row FROM creator_relations c LEFT JOIN pg_catalog.pg_am am ON am.oid = c.relam
),
column_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',c.nspname,'table',c.relname,'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
  'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
  'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid,false),
  'collation',CASE WHEN co.oid IS NULL THEN NULL ELSE pg_catalog.format('%I.%I',cn.nspname,co.collname) END,
  'dimensions',a.attndims,'storage',a.attstorage,'compression',a.attcompression,'isLocal',a.attislocal,'inheritanceCount',a.attinhcount,
  'directAcl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'grantor',pg_catalog.pg_get_userbyid(x.grantor),'grantee',CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(x.grantee) END,
    'privilege',x.privilege_type,'grantable',x.is_grantable)
    ORDER BY x.grantee = 0 DESC,pg_catalog.pg_get_userbyid(x.grantee),x.privilege_type,pg_catalog.pg_get_userbyid(x.grantor),x.is_grantable)
   FROM pg_catalog.aclexplode(a.attacl) x),'[]'::jsonb),
  'effectiveAcl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'role',b.name,'privilege',v.name,'allowed',pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum,v.name),
    'grantable',pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum,v.name || ' WITH GRANT OPTION')) ORDER BY b.name,v.name)
   FROM browser_roles b CROSS JOIN column_privileges v LEFT JOIN pg_catalog.pg_roles r ON r.rolname = b.name),'[]'::jsonb)
 ) AS row
 FROM managed_relations c JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 LEFT JOIN pg_catalog.pg_collation co ON co.oid = a.attcollation LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace
 WHERE a.attnum > 0 AND NOT a.attisdropped AND
  (c.oid IN (SELECT oid FROM creator_relations)
   OR (c.relname = 'conversations' AND a.attname IN ('sales_state','sales_state_updated_at','sales_state_source'))
   OR (c.relname = 'contact_ai_profiles' AND a.attname = 'commercial_profile'))
),
constraint_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',c.nspname,'table',c.relname,'name',k.conname,'type',k.contype,
  'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred,
  'isLocal',k.conislocal,'inheritanceCount',k.coninhcount,'noInherit',k.connoinherit,
  'definition',pg_catalog.pg_get_constraintdef(k.oid,false),
  'columns',COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY v.ord) FROM pg_catalog.unnest(k.conkey) WITH ORDINALITY v(num,ord) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = v.num),'[]'::jsonb),
  'foreignSchema',fn.nspname,'foreignTable',fc.relname,
  'foreignColumns',COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY v.ord) FROM pg_catalog.unnest(k.confkey) WITH ORDINALITY v(num,ord) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = v.num),'[]'::jsonb),
  'updateAction',k.confupdtype,'deleteAction',k.confdeltype,'matchType',k.confmatchtype,
  'deleteSetColumns',COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY v.ord) FROM pg_catalog.unnest(k.confdelsetcols) WITH ORDINALITY v(num,ord) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = v.num),'[]'::jsonb),
  'parentConstraint',CASE WHEN pk.oid IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('schema',pn.nspname,'table',pc.relname,'name',pk.conname) END,
  'index',CASE WHEN ic.oid IS NULL THEN NULL ELSE pg_catalog.format('%I.%I',inn.nspname,ic.relname) END,
  'foreignEqualityOperators',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.format('%I.%I(%s,%s)',onsp.nspname,o.oprname,pg_catalog.format_type(o.oprleft,NULL),pg_catalog.format_type(o.oprright,NULL)) ORDER BY v.ord)
   FROM pg_catalog.unnest(k.conpfeqop) WITH ORDINALITY v(id,ord) JOIN pg_catalog.pg_operator o ON o.oid = v.id JOIN pg_catalog.pg_namespace onsp ON onsp.oid = o.oprnamespace),'[]'::jsonb),
  'parentEqualityOperators',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.format('%I.%I(%s,%s)',onsp.nspname,o.oprname,pg_catalog.format_type(o.oprleft,NULL),pg_catalog.format_type(o.oprright,NULL)) ORDER BY v.ord)
   FROM pg_catalog.unnest(k.conppeqop) WITH ORDINALITY v(id,ord) JOIN pg_catalog.pg_operator o ON o.oid = v.id JOIN pg_catalog.pg_namespace onsp ON onsp.oid = o.oprnamespace),'[]'::jsonb),
  'childEqualityOperators',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.format('%I.%I(%s,%s)',onsp.nspname,o.oprname,pg_catalog.format_type(o.oprleft,NULL),pg_catalog.format_type(o.oprright,NULL)) ORDER BY v.ord)
   FROM pg_catalog.unnest(k.conffeqop) WITH ORDINALITY v(id,ord) JOIN pg_catalog.pg_operator o ON o.oid = v.id JOIN pg_catalog.pg_namespace onsp ON onsp.oid = o.oprnamespace),'[]'::jsonb),
  'exclusionOperators',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.format('%I.%I(%s,%s)',onsp.nspname,o.oprname,pg_catalog.format_type(o.oprleft,NULL),pg_catalog.format_type(o.oprright,NULL)) ORDER BY v.ord)
   FROM pg_catalog.unnest(k.conexclop) WITH ORDINALITY v(id,ord) JOIN pg_catalog.pg_operator o ON o.oid = v.id JOIN pg_catalog.pg_namespace onsp ON onsp.oid = o.oprnamespace),'[]'::jsonb)
 ) AS row
 FROM managed_relations c JOIN pg_catalog.pg_constraint k ON k.conrelid = c.oid
 LEFT JOIN pg_catalog.pg_class fc ON fc.oid = k.confrelid LEFT JOIN pg_catalog.pg_namespace fn ON fn.oid = fc.relnamespace
 LEFT JOIN pg_catalog.pg_constraint pk ON pk.oid = k.conparentid LEFT JOIN pg_catalog.pg_class pc ON pc.oid = pk.conrelid LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace
 LEFT JOIN pg_catalog.pg_class ic ON ic.oid = k.conindid LEFT JOIN pg_catalog.pg_namespace inn ON inn.oid = ic.relnamespace
 WHERE c.oid IN (SELECT oid FROM creator_relations) OR k.conname IN
  ('contacts_workspace_identity_unique','conversations_parent_identity_unique','conversations_sales_state_check',
   'conversations_sales_state_source_check','contact_ai_profiles_commercial_profile_check')
),
index_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',c.nspname,'table',c.relname,'name',ic.relname,'owner',pg_catalog.pg_get_userbyid(ic.relowner),
  'kind',ic.relkind,'persistence',ic.relpersistence,'accessMethod',am.amname,'options',ic.reloptions,
  'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive,'unique',i.indisunique,'primary',i.indisprimary,
  'exclusion',i.indisexclusion,'immediate',i.indimmediate,'clustered',i.indisclustered,
  'replicaIdentity',i.indisreplident,'checkXmin',i.indcheckxmin,'nullsNotDistinct',i.indnullsnotdistinct,
  'attributeCount',i.indnatts,'keyAttributeCount',i.indnkeyatts,
  'definition',pg_catalog.pg_get_indexdef(i.indexrelid,0,false),'expressions',pg_catalog.pg_get_expr(i.indexprs,i.indrelid,false),
  'predicate',pg_catalog.pg_get_expr(i.indpred,i.indrelid,false),
  'columns',COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY v.ord) FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY v(num,ord) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = v.num),'[]'::jsonb),
  'collations',COALESCE((SELECT pg_catalog.jsonb_agg(CASE WHEN co.oid IS NULL THEN NULL ELSE pg_catalog.format('%I.%I',cn.nspname,co.collname) END ORDER BY v.ord) FROM pg_catalog.unnest(i.indcollation) WITH ORDINALITY v(id,ord) LEFT JOIN pg_catalog.pg_collation co ON co.oid = v.id LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid = co.collnamespace),'[]'::jsonb),
  'operatorClasses',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.format('%I.%I',onsp.nspname,o.opcname) ORDER BY v.ord) FROM pg_catalog.unnest(i.indclass) WITH ORDINALITY v(id,ord) JOIN pg_catalog.pg_opclass o ON o.oid = v.id JOIN pg_catalog.pg_namespace onsp ON onsp.oid = o.opcnamespace),'[]'::jsonb),
  'columnOptions',i.indoption::smallint[]
 ) AS row FROM creator_relations c JOIN pg_catalog.pg_index i ON i.indrelid = c.oid
 JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid LEFT JOIN pg_catalog.pg_am am ON am.oid = ic.relam
),
policy_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',c.nspname,'table',c.relname,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
  'roles',COALESCE((SELECT pg_catalog.jsonb_agg(CASE WHEN v.id = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(v.id) END ORDER BY CASE WHEN v.id = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(v.id) END) FROM pg_catalog.unnest(p.polroles) v(id)),'[]'::jsonb),
  'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)
 ) AS row FROM creator_relations c JOIN pg_catalog.pg_policy p ON p.polrelid = c.oid
),
trigger_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',c.nspname,'table',c.relname,'name',CASE WHEN t.tgisinternal THEN NULL ELSE t.tgname END,
  'internal',t.tgisinternal,'type',t.tgtype,'enabled',t.tgenabled,'deferrable',t.tgdeferrable,'deferred',t.tginitdeferred,
  'function',pg_catalog.format('%I.%I(%s)',pn.nspname,p.proname,pg_catalog.replace(pg_catalog.oidvectortypes(p.proargtypes),', ',',')),
  'argumentCount',t.tgnargs,'argumentsHex',pg_catalog.encode(t.tgargs,'hex'),'when',pg_catalog.pg_get_expr(t.tgqual,t.tgrelid,false),
  'columns',COALESCE((SELECT pg_catalog.jsonb_agg(a.attname ORDER BY v.ord) FROM pg_catalog.unnest(t.tgattr) WITH ORDINALITY v(num,ord) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = v.num),'[]'::jsonb),
  'constraint',CASE WHEN k.oid IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('schema',kn.nspname,'table',kc.relname,'name',k.conname) END,
  'constraintRelation',CASE WHEN cr.oid IS NULL THEN NULL ELSE pg_catalog.format('%I.%I',crn.nspname,cr.relname) END,
  'constraintIndex',CASE WHEN ix.oid IS NULL THEN NULL ELSE pg_catalog.format('%I.%I',ixn.nspname,ix.relname) END,
  'parent',CASE WHEN pt.oid IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('schema',ptn.nspname,'table',ptc.relname,'name',CASE WHEN pt.tgisinternal THEN NULL ELSE pt.tgname END) END,
  'oldTransitionTable',t.tgoldtable,'newTransitionTable',t.tgnewtable
 ) AS row FROM creator_relations c JOIN pg_catalog.pg_trigger t ON t.tgrelid = c.oid
 JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
 LEFT JOIN pg_catalog.pg_constraint k ON k.oid = t.tgconstraint LEFT JOIN pg_catalog.pg_class kc ON kc.oid = k.conrelid LEFT JOIN pg_catalog.pg_namespace kn ON kn.oid = kc.relnamespace
 LEFT JOIN pg_catalog.pg_class cr ON cr.oid = t.tgconstrrelid LEFT JOIN pg_catalog.pg_namespace crn ON crn.oid = cr.relnamespace
 LEFT JOIN pg_catalog.pg_class ix ON ix.oid = t.tgconstrindid LEFT JOIN pg_catalog.pg_namespace ixn ON ixn.oid = ix.relnamespace
 LEFT JOIN pg_catalog.pg_trigger pt ON pt.oid = t.tgparentid LEFT JOIN pg_catalog.pg_class ptc ON ptc.oid = pt.tgrelid LEFT JOIN pg_catalog.pg_namespace ptn ON ptn.oid = ptc.relnamespace
),
function_rows AS (
 SELECT pg_catalog.jsonb_build_object(
  'schema',n.nspname,'name',p.proname,'identity',p.proname || '(' || pg_catalog.replace(pg_catalog.oidvectortypes(p.proargtypes),', ',',' ) || ')',
  'owner',pg_catalog.pg_get_userbyid(p.proowner),'language',l.lanname,'bodyMd5',pg_catalog.md5(p.prosrc),
  'binary',p.probin,'sqlBodyPresent',p.prosqlbody IS NOT NULL,
  'kind',p.prokind,'securityDefiner',p.prosecdef,'leakproof',p.proleakproof,'strict',p.proisstrict,
  'returnsSet',p.proretset,'volatility',p.provolatile,'parallel',p.proparallel,'cost',p.procost,'rows',p.prorows,
  'inputCount',p.pronargs,'defaultCount',p.pronargdefaults,'returnType',pg_catalog.format_type(p.prorettype,NULL),
  'argTypes',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.format_type(v.id,NULL) ORDER BY v.ord) FROM pg_catalog.unnest(p.proargtypes) WITH ORDINALITY v(id,ord)),'[]'::jsonb),
  'allArgTypes',CASE WHEN p.proallargtypes IS NULL THEN NULL ELSE (SELECT pg_catalog.jsonb_agg(pg_catalog.format_type(v.id,NULL) ORDER BY v.ord) FROM pg_catalog.unnest(p.proallargtypes) WITH ORDINALITY v(id,ord)) END,
  'argModes',p.proargmodes,'argNames',p.proargnames,'defaults',pg_catalog.pg_get_expr(p.proargdefaults,0,false),
  'variadicType',CASE WHEN p.provariadic = 0 THEN NULL ELSE pg_catalog.format_type(p.provariadic,NULL) END,
  'support',CASE WHEN sp.oid IS NULL THEN NULL ELSE pg_catalog.format('%I.%I(%s)',sn.nspname,sp.proname,pg_catalog.replace(pg_catalog.oidvectortypes(sp.proargtypes),', ',',')) END,
  'transformTypes',CASE WHEN p.protrftypes IS NULL THEN NULL ELSE (SELECT pg_catalog.jsonb_agg(pg_catalog.format_type(v.id,NULL) ORDER BY v.ord) FROM pg_catalog.unnest(p.protrftypes) WITH ORDINALITY v(id,ord)) END,
  'config',p.proconfig,
  'directAcl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'grantor',pg_catalog.pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
    'privilege',a.privilege_type,'grantable',a.is_grantable)
    ORDER BY a.grantee = 0 DESC,pg_catalog.pg_get_userbyid(a.grantee),a.privilege_type,pg_catalog.pg_get_userbyid(a.grantor),a.is_grantable)
   FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a),'[]'::jsonb),
  'effectiveAcl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',b.name,'privilege','EXECUTE',
    'allowed',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),'grantable',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION')) ORDER BY b.name)
   FROM browser_roles b LEFT JOIN pg_catalog.pg_roles r ON r.rolname = b.name),'[]'::jsonb)
 ) AS row FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 JOIN pg_catalog.pg_language l ON l.oid = p.prolang
 LEFT JOIN pg_catalog.pg_proc sp ON sp.oid = p.prosupport LEFT JOIN pg_catalog.pg_namespace sn ON sn.oid = sp.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN
  ('guard_creator_identity','save_creator_bundle','record_creator_fan_review','creator_workspace_access_allowed')
),
parent_checks AS (
 SELECT pg_catalog.jsonb_build_object(
  'pg17',pg_catalog.current_setting('server_version_num')::integer / 10000 = 17,
  'adminCrmContractAbsent',pg_catalog.to_regprocedure('public.admin_crm_read_allowed(uuid)') IS NULL,
  'parentTablesRls',NOT EXISTS (
   SELECT 1 FROM (VALUES ('workspaces'),('workspace_members'),('contacts'),('conversations'),('contact_ai_profiles')) e(name)
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = e.name AND c.relkind = 'r' AND c.relrowsecurity)),
  'parentUuidColumnsReadable',NOT EXISTS (
   SELECT 1 FROM (VALUES ('workspaces','id'),('workspaces','owner_user_id'),('workspace_members','workspace_id'),('workspace_members','user_id'),('contacts','id'),('contacts','workspace_id'),('conversations','id'),('conversations','workspace_id'),('conversations','contact_id'),('contact_ai_profiles','workspace_id'),('contact_ai_profiles','contact_id')) e(tab,col)
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid JOIN pg_catalog.pg_roles r ON r.rolname = 'authenticated'
    WHERE n.nspname = 'public' AND c.relname = e.tab AND a.attname = e.col AND a.atttypid = 'pg_catalog.uuid'::pg_catalog.regtype AND NOT a.attisdropped AND pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum,'SELECT'))),
  'authUsersPresent',pg_catalog.to_regclass('auth.users') IS NOT NULL,'authUidPresent',pg_catalog.to_regprocedure('auth.uid()') IS NOT NULL,
  'anonProfileDenied',COALESCE((SELECT NOT pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AND NOT pg_catalog.has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE r.rolname = 'anon' AND n.nspname = 'public' AND c.relname = 'contact_ai_profiles'),false),
  'authenticatedProfileWriteDenied',COALESCE((SELECT NOT pg_catalog.has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES') AND NOT pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE,TRUNCATE,TRIGGER') FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE r.rolname = 'authenticated' AND n.nspname = 'public' AND c.relname = 'contact_ai_profiles'),false),
  'profileWorkspaceContactUnique',EXISTS (
   SELECT 1 FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid = k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'contact_ai_profiles' AND k.contype = 'u' AND k.convalidated
    AND (SELECT pg_catalog.array_agg(a.attname::text ORDER BY v.ord) FROM pg_catalog.unnest(k.conkey) WITH ORDINALITY v(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = v.num) = ARRAY['workspace_id','contact_id']::text[])
 ) AS document
),
role_rows AS (
 SELECT pg_catalog.jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,
  'createRole',r.rolcreaterole,'createDb',r.rolcreatedb,'canLogin',r.rolcanlogin,'replication',r.rolreplication,
  'bypassRls',r.rolbypassrls,'connectionLimit',r.rolconnlimit,'validUntil',r.rolvaliduntil,'config',r.rolconfig) AS row
 FROM relevant_roles r
),
membership_rows AS (
 SELECT pg_catalog.jsonb_build_object('role',pg_catalog.pg_get_userbyid(m.roleid),'member',pg_catalog.pg_get_userbyid(m.member),
  'grantor',pg_catalog.pg_get_userbyid(m.grantor),'adminOption',m.admin_option,'inheritOption',m.inherit_option,'setOption',m.set_option) AS row
 FROM relevant_memberships m
)
SELECT pg_catalog.jsonb_build_object(
 'schemaVersion',1,'observedAt',pg_catalog.transaction_timestamp(),'pgMajor',pg_catalog.current_setting('server_version_num')::integer / 10000,
 'catalog',pg_catalog.jsonb_build_object(
  'tables',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM table_rows),'[]'::jsonb),
  'columns',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM column_rows),'[]'::jsonb),
  'constraints',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM constraint_rows),'[]'::jsonb),
  'indexes',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM index_rows),'[]'::jsonb),
  'policies',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM policy_rows),'[]'::jsonb),
  'triggers',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM trigger_rows),'[]'::jsonb),
  'functions',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM function_rows),'[]'::jsonb),
  'parentChecks',(SELECT document || pg_catalog.jsonb_build_object('allSatisfied',(SELECT pg_catalog.bool_and(value::text::boolean) FROM pg_catalog.jsonb_each(document))) FROM parent_checks),
  'roles',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM role_rows),'[]'::jsonb),
  'memberships',COALESCE((SELECT pg_catalog.jsonb_agg(row ORDER BY row::text COLLATE "C") FROM membership_rows),'[]'::jsonb)
 )
);
ROLLBACK;
`;

export function buildCreatorFoundationCatalogSql() {
  if (arguments.length !== 0) throw new Error("CREATOR_FOUNDATION_CATALOG_ERROR=unexpected_input");
  return CATALOG_SQL;
}
