-- CONTROLLED / UNAPPLIED extension of #1425. Never run from a Web deploy.
-- Requires the existing reviewed private-media schema, not a second library.
begin;
-- Storage finalizes an authorized upload under service_role while retaining caller claims.
-- Keep the exact Owner/Workspace/deletion checks; this grants only their boolean predicate.
grant execute on function public.chat_admin_media_writes_allowed(uuid) to service_role;
create function public.chat_admin_media_price_rules_valid(value jsonb) returns boolean
 language sql immutable security invoker set search_path='' as $$
 select jsonb_typeof(value)='object'
 and value ?& array['negotiation_allowed','special_discounts_allowed']
 and (value-array['negotiation_allowed','special_discounts_allowed'])='{}'::jsonb
 and jsonb_typeof(value->'negotiation_allowed')='boolean'
 and jsonb_typeof(value->'special_discounts_allowed')='boolean'
$$;
revoke all on function public.chat_admin_media_price_rules_valid(jsonb) from public,anon;
grant execute on function public.chat_admin_media_price_rules_valid(jsonb) to authenticated,service_role;

create table public.chat_character_media_folders (
 id uuid primary key,
 workspace_id uuid not null,
 character_id uuid not null,
 parent_id uuid,
 kind text not null check(kind in ('image','video')),
 name text not null check(length(btrim(name)) between 1 and 80 and name !~ '[[:cntrl:]/\\]'),
 offer_id text not null default '' check(length(offer_id)<=80),
 price_rules jsonb not null default '{"negotiation_allowed":false,"special_discounts_allowed":false}'::jsonb check(public.chat_admin_media_price_rules_valid(price_rules)),
 revision integer not null default 1 check(revision>0),
 unique(workspace_id,character_id,id),
 foreign key(workspace_id,character_id) references public.chat_characters(workspace_id,id) on delete cascade,
 foreign key(workspace_id,character_id,parent_id) references public.chat_character_media_folders(workspace_id,character_id,id) on delete restrict
);
create unique index chat_media_folder_sibling_name on public.chat_character_media_folders(workspace_id,character_id,kind,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(normalize(btrim(name),NFKC)));
create index chat_media_folder_parent on public.chat_character_media_folders(workspace_id,character_id,parent_id);
alter table public.chat_character_media_folders enable row level security;
revoke all on public.chat_character_media_folders from public,anon,authenticated,service_role;
grant select,insert,delete on public.chat_character_media_folders to authenticated;
grant update(name,parent_id,offer_id,price_rules) on public.chat_character_media_folders to authenticated;
grant select,delete on public.chat_character_media_folders to service_role;
create policy chat_media_folder_read on public.chat_character_media_folders for select to authenticated using(public.is_current_chat_admin_workspace(workspace_id));
create policy chat_media_folder_insert on public.chat_character_media_folders for insert to authenticated with check(public.chat_admin_media_writes_allowed(workspace_id));
create policy chat_media_folder_update on public.chat_character_media_folders for update to authenticated using(public.is_current_chat_admin_workspace(workspace_id)) with check(public.chat_admin_media_writes_allowed(workspace_id));
create policy chat_media_folder_delete on public.chat_character_media_folders for delete to authenticated using(public.is_current_chat_admin_workspace(workspace_id));

alter table public.chat_character_media
 add column media_type text not null default 'image' check(media_type in ('image','video')),
 add column folder_id uuid,
 add column byte_size integer not null default 0 check(byte_size between 0 and 26214400),
 add column duration_ms integer check(duration_ms between 1 and 300000),
 add column price_rules jsonb not null default '{"negotiation_allowed":false,"special_discounts_allowed":false}'::jsonb check(public.chat_admin_media_price_rules_valid(price_rules)),
 add constraint chat_media_image_size check(media_type<>'image' or byte_size<=5242880),
 add constraint chat_media_video_duration check(media_type<>'video' or duration_ms is not null),
 add constraint chat_media_folder_scope foreign key(workspace_id,character_id,folder_id) references public.chat_character_media_folders(workspace_id,character_id,id) on delete restrict;
create index chat_media_folder_assets on public.chat_character_media(workspace_id,character_id,folder_id);
grant update(folder_id,price_rules) on public.chat_character_media to authenticated;

-- All tree mutations use the same Character lock as generation, media writes
-- and confirmation. Scope/kind are immutable, paths cannot create authorization.
create function public.chat_admin_media_catalogue_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare row_count integer; depth integer:=0; current_id uuid; parent_kind text; seen uuid[]:='{}';
begin
 perform 1 from public.chat_characters where workspace_id=new.workspace_id and id=new.character_id for update;
 if not found then raise exception 'media_context_mismatch'; end if;
 if TG_OP='UPDATE' and (old.workspace_id<>new.workspace_id or old.character_id<>new.character_id or old.id<>new.id) then raise exception 'media_context_mismatch'; end if;
 if TG_TABLE_NAME='chat_character_media_folders' then
  if TG_OP='UPDATE' and old.kind<>new.kind then raise exception 'invalid_media_kind'; end if;
  if TG_OP='INSERT' then select count(*) into row_count from public.chat_character_media_folders where workspace_id=new.workspace_id and character_id=new.character_id; if row_count>=100 then raise exception 'media_folder_limit'; end if; end if;
  current_id:=new.parent_id; seen:=array[new.id];depth:=1;
  while current_id is not null loop
   if current_id=any(seen) then raise exception 'media_folder_cycle'; end if;
   seen:=array_append(seen,current_id);depth:=depth+1;
   if depth>8 then raise exception 'media_folder_depth'; end if;
   select kind,parent_id into parent_kind,current_id from public.chat_character_media_folders where workspace_id=new.workspace_id and character_id=new.character_id and id=current_id;
   if not found or parent_kind<>new.kind then raise exception 'media_folder_binding_invalid'; end if;
  end loop;
  -- Moving a subtree must not push existing descendants past the depth cap.
  with recursive descendants(id,levels) as (
   select id,1 from public.chat_character_media_folders where workspace_id=new.workspace_id and character_id=new.character_id and parent_id=new.id
   union all select f.id,d.levels+1 from public.chat_character_media_folders f join descendants d on f.parent_id=d.id where f.workspace_id=new.workspace_id and f.character_id=new.character_id and d.levels<=8
  ) select coalesce(max(levels),0) into row_count from descendants;
  if depth+row_count>8 then raise exception 'media_folder_depth'; end if;
 else
  if TG_OP='UPDATE' and (old.media_type<>new.media_type or old.byte_size<>new.byte_size or old.duration_ms is distinct from new.duration_ms) then raise exception 'media_file_immutable'; end if;
  if new.folder_id is not null and not exists(select 1 from public.chat_character_media_folders f where f.workspace_id=new.workspace_id and f.character_id=new.character_id and f.id=new.folder_id and f.kind=new.media_type) then raise exception 'media_folder_binding_invalid'; end if;
 end if;
 return new;
end;$$;
revoke all on function public.chat_admin_media_catalogue_guard() from public,anon,authenticated,service_role;
create trigger chat_media_catalogue_folder_guard before insert or update on public.chat_character_media_folders for each row execute function public.chat_admin_media_catalogue_guard();
create trigger chat_media_catalogue_asset_guard before insert or update on public.chat_character_media for each row execute function public.chat_admin_media_catalogue_guard();
create trigger chat_media_folder_revision before insert or update or delete on public.chat_character_media_folders for each row execute function public.chat_admin_media_revision();

create function public.chat_admin_media_object_path(p_workspace uuid,p_character uuid,p_asset uuid,p_kind text) returns text
 language sql immutable security invoker set search_path='' as $$
 select p_workspace::text||'/'||p_character::text||'/'||p_asset::text||case p_kind when 'image' then '.webp' when 'video' then '.mp4' else null end
$$;
revoke all on function public.chat_admin_media_object_path(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.chat_admin_media_object_path(uuid,uuid,uuid,text) to authenticated,service_role;
update storage.buckets set file_size_limit=26214400,allowed_mime_types=array['image/webp','video/mp4'] where id='chat-character-media' and not public;
do $$ begin if not exists(select 1 from storage.buckets where id='chat-character-media' and not public and file_size_limit=26214400 and allowed_mime_types=array['image/webp','video/mp4']) then raise exception 'media_bucket_binding_invalid'; end if;end $$;

drop policy chat_media_delete on public.chat_character_media;
create policy chat_media_delete on public.chat_character_media for delete to authenticated using(public.is_current_chat_admin_workspace(workspace_id) and deleted and not exists(select 1 from storage.objects o where o.bucket_id='chat-character-media' and o.name=public.chat_admin_media_object_path(chat_character_media.workspace_id,chat_character_media.character_id,chat_character_media.id,chat_character_media.media_type)));
drop policy chat_media_object_select on storage.objects;
drop policy chat_media_object_insert on storage.objects;
drop policy chat_media_object_delete on storage.objects;
create policy chat_media_object_select on storage.objects for select to authenticated using(bucket_id='chat-character-media' and exists(select 1 from public.chat_character_media m join public.chat_characters c on c.workspace_id=m.workspace_id and c.id=m.character_id where (c.status='active' or m.deleted) and name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type) and public.is_current_chat_admin_workspace(m.workspace_id)));
create policy chat_media_object_insert on storage.objects for insert to authenticated with check(bucket_id='chat-character-media' and exists(select 1 from public.chat_character_media m join public.chat_characters c on c.workspace_id=m.workspace_id and c.id=m.character_id where not m.deleted and c.status='active' and name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type) and public.chat_admin_media_writes_allowed(m.workspace_id)));
create policy chat_media_object_delete on storage.objects for delete to authenticated using(bucket_id='chat-character-media' and exists(select 1 from public.chat_character_media m where m.deleted and name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type) and public.is_current_chat_admin_workspace(m.workspace_id)));

create or replace function public.chat_admin_media_object_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare target_workspace uuid;target_character uuid;
begin
 if new.bucket_id<>'chat-character-media' then return new;end if;
 select c.workspace_id,c.id into target_workspace,target_character from public.chat_characters c join public.chat_character_media m on m.workspace_id=c.workspace_id and m.character_id=c.id where new.name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type) for update of c;
 if not found or not public.chat_admin_media_writes_allowed(target_workspace) or not exists(select 1 from public.chat_character_media m join public.chat_characters c on c.workspace_id=m.workspace_id and c.id=m.character_id where m.workspace_id=target_workspace and m.character_id=target_character and not m.deleted and c.status='active' and new.name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type)) then raise exception 'media_object_binding_invalid';end if;
 return new;
end;$$;

-- Atomic folder/file pricing + existing playbook. Invoker privileges and RLS
-- remain authoritative; no service-role write or new authority is introduced.
create function public.chat_admin_media_catalogue_write(p_workspace uuid,p_character uuid,p_character_revision integer,p_action text,p_payload jsonb,p_playbook jsonb) returns boolean
 language plpgsql security invoker set search_path='' as $$
declare target uuid;expected integer;
begin
 if not public.chat_admin_media_writes_allowed(p_workspace) then raise exception 'owner_required';end if;
 perform 1 from public.chat_characters where workspace_id=p_workspace and id=p_character and revision=p_character_revision and status='active' for update;
 if not found then raise exception 'stale_media_context';end if;
 if jsonb_typeof(p_playbook)<>'object' or octet_length(p_playbook::text)>18000 then raise exception 'invalid_media_price';end if;
 target:=(p_payload->>'id')::uuid;expected:=(p_payload->>'revision')::integer;
 if p_action='save_folder' then
  if expected=0 then
   insert into public.chat_character_media_folders(id,workspace_id,character_id,parent_id,kind,name,offer_id,price_rules) values(target,p_workspace,p_character,(p_payload->>'parent_id')::uuid,p_payload->>'kind',p_payload->>'name',p_payload->>'offer_id',p_payload->'price_rules');
  else
   update public.chat_character_media_folders set parent_id=(p_payload->>'parent_id')::uuid,name=p_payload->>'name',offer_id=p_payload->>'offer_id',price_rules=p_payload->'price_rules' where workspace_id=p_workspace and character_id=p_character and id=target and revision=expected and kind=p_payload->>'kind';
   if not found then raise exception 'stale_media_context';end if;
  end if;
 elsif p_action='delete_folder' then
  if exists(select 1 from public.chat_character_media_folders where workspace_id=p_workspace and character_id=p_character and parent_id=target) or exists(select 1 from public.chat_character_media where workspace_id=p_workspace and character_id=p_character and folder_id=target) then raise exception 'media_folder_not_empty';end if;
  delete from public.chat_character_media_folders where workspace_id=p_workspace and character_id=p_character and id=target and revision=expected;
  if not found then raise exception 'stale_media_context';end if;
 elsif p_action='move_asset' then
  update public.chat_character_media set folder_id=(p_payload->>'folder_id')::uuid where workspace_id=p_workspace and character_id=p_character and id=target and revision=expected and not deleted;
  if not found then raise exception 'stale_media_context';end if;
 elsif p_action='save_asset_price' then
  update public.chat_character_media set offer_id=p_payload->>'offer_id',price_rules=p_payload->'price_rules' where workspace_id=p_workspace and character_id=p_character and id=target and revision=expected and not deleted;
  if not found then raise exception 'stale_media_context';end if;
 else raise exception 'invalid_media_action';end if;
 update public.chat_characters set sales_playbook=p_playbook,revision=revision+1,updated_at=clock_timestamp() where workspace_id=p_workspace and id=p_character;
 return true;
end;$$;
revoke all on function public.chat_admin_media_catalogue_write(uuid,uuid,integer,text,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.chat_admin_media_catalogue_write(uuid,uuid,integer,text,jsonb,jsonb) to authenticated;
alter table public.chat_character_media add column original_filename text not null default '' constraint chat_media_filename_length check (char_length(original_filename)<=255 and original_filename !~ '[[:cntrl:]]');
alter table public.chat_character_media add column uploaded_at timestamptz;
alter table public.chat_character_media alter column uploaded_at set default now();
commit;
