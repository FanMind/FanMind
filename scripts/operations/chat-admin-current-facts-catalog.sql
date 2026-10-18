-- Offline profile observation only. No helper, fixture, DDL, data or privilege write.
begin transaction isolation level repeatable read read only;
set local search_path=pg_catalog;
set local statement_timeout='15s';
with recursive
seeds(classid,objid) as (
 select 'pg_class'::regclass,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fanmind_chat_knowledge' or (n.nspname='public' and c.relname ~ '^(chat_characters$|chat_character_|workspace_chat_admin_capabilities$|chat_admin_current_)')
 union select 'pg_proc'::regclass,p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fanmind_chat_knowledge' or (n.nspname='public' and (p.proname ~ '(chat_admin|chat_character|current_fact)' or p.prosrc ~ '(fanmind_chat_knowledge|chat_character_|workspace_chat_admin_capabilities)'))
 union select 'pg_namespace'::regclass,oid from pg_namespace where nspname='fanmind_chat_knowledge'
),
edges(sourceclass,sourceid,destclass,destid) as (
 select refclassid,refobjid,classid,objid from pg_depend
 where not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where classid='pg_class'::regclass and c.oid=objid and n.nspname='pg_toast')
 union all select 'pg_rewrite'::regclass,oid,'pg_class'::regclass,ev_class from pg_rewrite
 union all select 'pg_constraint'::regclass,oid,'pg_class'::regclass,conrelid from pg_constraint where conrelid<>0
 union all select 'pg_trigger'::regclass,oid,'pg_class'::regclass,tgrelid from pg_trigger where not tgisinternal
),
object_scope(classid,objid) as (
 select classid,objid from seeds
 union select e.destclass,e.destid from object_scope s join edges e on e.sourceclass=s.classid and e.sourceid=s.objid
),
relations as (
 select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.oid in(select objid from object_scope where classid='pg_class'::regclass)
),
routines as (
 select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.oid in(select objid from object_scope where classid='pg_proc'::regclass)
),
reachable(roleid) as (
 select oid from pg_roles where rolname in ('anon','authenticated','service_role')
 union select case when m.member=r.roleid then m.roleid else m.member end from reachable r join pg_auth_members m on m.member=r.roleid or m.roleid=r.roleid
),
records(record) as (
 select jsonb_build_object('kind','database','owner',pg_get_userbyid(d.datdba),'encoding',pg_encoding_to_char(d.encoding),'localeProvider',d.datlocprovider,'collate',d.datcollate,'ctype',d.datctype) from pg_database d where d.datname=current_database()
 union all
 select jsonb_build_object('kind','schemaPrivilege','schema',n.nspname,'role',r.rolname,'usage',has_schema_privilege(r.oid,n.oid,'USAGE'),'create',has_schema_privilege(r.oid,n.oid,'CREATE')) from pg_namespace n cross join pg_roles r where n.nspname in ('public','fanmind_chat_knowledge') and r.rolname in ('anon','authenticated','service_role')
 union all
 select jsonb_build_object('kind','schema','name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',
  coalesce((select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type,a.is_grantable) from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a),'[]'::jsonb))
 from pg_namespace n where n.nspname in ('public','fanmind_chat_knowledge')
 union all
 select jsonb_build_object('kind','relation','name',r.nspname||'.'||r.relname,'type',r.relkind,'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'forceRls',r.relforcerowsecurity,'persistence',r.relpersistence,'options',r.reloptions,'tablespace',case when r.reltablespace=0 then 'DEFAULT' else (select spcname from pg_tablespace where oid=r.reltablespace) end,'replicaIdentity',r.relreplident,'partition',r.relispartition,'partitionBound',pg_get_expr(r.relpartbound,r.oid),'comment',obj_description(r.oid,'pg_class'),'acl',
  coalesce((select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type,a.is_grantable) from aclexplode(coalesce(r.relacl,acldefault(case when r.relkind='S' then 's'::"char" else 'r'::"char" end,r.relowner))) a),'[]'::jsonb),
  'view',case when r.relkind in ('v','m') then pg_get_viewdef(r.oid,false) else null end)
 from relations r
 union all
 select jsonb_build_object('kind','column','relation',r.nspname||'.'||r.relname,'position',row_number() over(partition by r.oid order by a.attnum),'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'dimensions',a.attndims,'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'storage',a.attstorage,'compression',a.attcompression,'collation',case when a.attcollation=0 then null else a.attcollation::regcollation::text end,'default',pg_get_expr(d.adbin,d.adrelid),'comment',col_description(r.oid,a.attnum),'acl',
 coalesce((select jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantor),case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,x.privilege_type,x.is_grantable) order by x.grantor::regrole::text,x.grantee::regrole::text,x.privilege_type,x.is_grantable) from aclexplode(a.attacl) x),'[]'::jsonb))
 from relations r join pg_attribute a on a.attrelid=r.oid left join pg_attrdef d on d.adrelid=r.oid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped
 union all
 select jsonb_build_object('kind','constraint','relation',c.conrelid::regclass::text,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid,false),'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'noInherit',c.connoinherit,'local',c.conislocal,'inheritCount',c.coninhcount)
 from pg_constraint c where c.conrelid in(select oid from relations) or c.connamespace=to_regnamespace('fanmind_chat_knowledge')
 union all
 select jsonb_build_object('kind','index','name',i.indexrelid::regclass::text,'relation',i.indrelid::regclass::text,'definition',pg_get_indexdef(i.indexrelid),'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive,'replicaIdentity',i.indisreplident,'clustered',i.indisclustered,'nullsNotDistinct',i.indnullsnotdistinct)
 from pg_index i where i.indrelid in(select oid from relations)
 union all
 select jsonb_build_object('kind','trigger','relation',t.tgrelid::regclass::text,'name',case when t.tgisinternal then null else t.tgname end,'internal',t.tgisinternal,'enabled',t.tgenabled,'type',t.tgtype,'columns',t.tgattr::text,'function',t.tgfoid::regprocedure::text,'when',pg_get_expr(t.tgqual,t.tgrelid),'args',encode(t.tgargs,'hex'),'oldTable',t.tgoldtable,'newTable',t.tgnewtable,'deferrable',t.tgdeferrable,'deferred',t.tginitdeferred,'constraint',c.conname,'constraintRelation',case when t.tgconstrrelid=0 then null else t.tgconstrrelid::regclass::text end)
 from pg_trigger t left join pg_constraint c on c.oid=t.tgconstraint where t.tgrelid in(select oid from relations)
 union all
 select jsonb_build_object('kind','policy','relation',p.polrelid::regclass::text,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(case when id=0 then 'PUBLIC' else pg_get_userbyid(id) end order by case when id=0 then 'PUBLIC' else pg_get_userbyid(id) end) from unnest(p.polroles) id),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))
 from pg_policy p where p.polrelid in(select oid from relations)
 union all
 select jsonb_build_object('kind','routine','schema',p.nspname,'name',p.proname,'identity',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'type',p.prokind,'language',(select lanname from pg_language where oid=p.prolang),'result',pg_get_function_result(p.oid),'definitionSha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',
 coalesce((select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type,a.is_grantable) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb)) from routines p
 union all
 select jsonb_build_object('kind','sequence','name',s.seqrelid::regclass::text,'type',format_type(s.seqtypid,null),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) from pg_sequence s where s.seqrelid in(select oid from relations)
 union all
 select jsonb_build_object('kind','role','name',r.rolname,'super',r.rolsuper,'bypassRls',r.rolbypassrls,'createRole',r.rolcreaterole,'createDb',r.rolcreatedb,'inherit',r.rolinherit,'login',r.rolcanlogin,'replication',r.rolreplication,'connectionLimit',r.rolconnlimit,'config',r.rolconfig) from pg_roles r where r.oid in(select roleid from reachable)
 union all
 select jsonb_build_object('kind','membership','member',pg_get_userbyid(m.member),'role',pg_get_userbyid(m.roleid),'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) from pg_auth_members m where m.member in(select roleid from reachable)
 union all
 select jsonb_build_object('kind','roleSetting','role',case when s.setrole=0 then 'ALL' else pg_get_userbyid(s.setrole) end,'database',case when s.setdatabase=0 then 'ALL' else 'CURRENT' end,'config',s.setconfig) from pg_db_role_setting s where (s.setrole=0 or s.setrole in(select roleid from reachable)) and (s.setdatabase=0 or s.setdatabase=(select oid from pg_database where datname=current_database()))
 union all
 select jsonb_build_object('kind','defaultAcl','role',pg_get_userbyid(d.defaclrole),'schema',case when d.defaclnamespace=0 then 'GLOBAL' else d.defaclnamespace::regnamespace::text end,'type',d.defaclobjtype,'acl',
 (select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type,a.is_grantable) from aclexplode(d.defaclacl) a)) from pg_default_acl d where d.defaclnamespace=to_regnamespace('fanmind_chat_knowledge') or (d.defaclrole=(select oid from pg_roles where rolname='postgres') and d.defaclnamespace in (0,(select oid from pg_namespace where nspname='public')))
 union all
 select distinct jsonb_build_object('kind','dependentObject','type',o.type,'schema',o.schema,'name',o.name,'identity',o.identity) from object_scope s cross join lateral pg_identify_object(s.classid,s.objid,0) o where s.classid<>'pg_trigger'::regclass
 union all
 select jsonb_build_object('kind','rule','relation',r.ev_class::regclass::text,'name',r.rulename,'enabled',r.ev_enabled,'definitionSha256',encode(sha256(convert_to(pg_get_ruledef(r.oid,false),'UTF8')),'hex')) from pg_rewrite r where r.oid in(select objid from object_scope where classid='pg_rewrite'::regclass)
 union all
 select jsonb_build_object('kind','extension','name',e.extname,'version',e.extversion,'owner',pg_get_userbyid(e.extowner)) from pg_extension e where e.extnamespace=to_regnamespace('fanmind_chat_knowledge')
)
select jsonb_build_object('version',1,'postgresMajor',current_setting('server_version_num')::integer/10000,'records',coalesce(jsonb_agg(record order by record::text collate "C"),'[]'::jsonb)) from records;
rollback;
