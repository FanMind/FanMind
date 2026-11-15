-- CONTROLLED / UNAPPLIED. Never execute as part of a normal application deploy.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-character-media','chat-character-media',false,5242880,array['image/webp']);

create table public.chat_character_media (
 id uuid primary key,
 workspace_id uuid not null,
 character_id uuid not null,
 description text not null default '' check(length(description)<=1200),
 tags text[] not null default '{}' check(cardinality(tags)<=20 and length(array_to_string(tags,''))<=1600),
 folder text not null default '' check(length(folder)<=80),
 offer_id text not null default '' check(length(offer_id)<=80),
 reviewed boolean not null default false,
 available boolean not null default false,
 deleted boolean not null default false,
 revision integer not null default 1 check(revision>0),
 check(not reviewed or (length(description)>0 and cardinality(tags)>0)),
 check(not deleted or (not reviewed and not available)),
 foreign key(workspace_id,character_id) references public.chat_characters(workspace_id,id) on delete restrict
);
create index chat_character_media_character on public.chat_character_media(workspace_id,character_id);
create table public.chat_character_media_policies (
 workspace_id uuid not null,
 character_id uuid not null,
 enabled boolean not null default false,
 offer_id text not null default '' check(length(offer_id)<=80),
 delivery_hours integer check(delivery_hours between 1 and 720),
 motifs text[] not null default '{}' check(cardinality(motifs)<=20 and length(array_to_string(motifs,''))<=1600),
 requires_confirmation boolean not null default true,
 revision integer not null default 1 check(revision>0),
 primary key(workspace_id,character_id),
 check(not enabled or (length(offer_id)>0 and delivery_hours is not null and cardinality(motifs)>0)),
 foreign key(workspace_id,character_id) references public.chat_characters(workspace_id,id) on delete cascade
);
alter table public.chat_character_media enable row level security;
alter table public.chat_character_media_policies enable row level security;
revoke all on public.chat_character_media,public.chat_character_media_policies from public,anon,authenticated;
grant select,insert,delete on public.chat_character_media,public.chat_character_media_policies to authenticated;
grant select,update,delete on public.chat_character_media,public.chat_character_media_policies to service_role;
grant update(description,tags,folder,offer_id,reviewed,available,deleted) on public.chat_character_media to authenticated;
grant update(enabled,offer_id,delivery_hours,motifs,requires_confirmation) on public.chat_character_media_policies to authenticated;

-- The deletion queue is service-role-only. Expose only an own-Workspace boolean;
-- no request IDs, other users or lifecycle metadata become client-readable.
create function public.chat_admin_media_writes_allowed(target_workspace uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.is_current_chat_admin_workspace(target_workspace)
 and not exists(select 1 from public.account_deletion_requests r where r.user_id=auth.uid() and r.status='processing')
$$;
revoke all on function public.chat_admin_media_writes_allowed(uuid) from public,anon,service_role;
grant execute on function public.chat_admin_media_writes_allowed(uuid) to authenticated;

create policy chat_media_read on public.chat_character_media for select to authenticated
 using(public.is_current_chat_admin_workspace(workspace_id));
create policy chat_media_insert on public.chat_character_media for insert to authenticated
 with check(public.chat_admin_media_writes_allowed(workspace_id) and exists(select 1 from public.chat_characters c where c.workspace_id=chat_character_media.workspace_id and c.id=chat_character_media.character_id and c.status='active'));
create policy chat_media_update on public.chat_character_media for update to authenticated
 using(public.is_current_chat_admin_workspace(workspace_id))
 with check(public.is_current_chat_admin_workspace(workspace_id) and (chat_character_media.deleted or public.chat_admin_media_writes_allowed(workspace_id)) and exists(select 1 from public.chat_characters c where c.workspace_id=chat_character_media.workspace_id and c.id=chat_character_media.character_id and (c.status='active' or chat_character_media.deleted)));
create policy chat_media_delete on public.chat_character_media for delete to authenticated
 using(public.is_current_chat_admin_workspace(workspace_id) and deleted and not exists(
 select 1 from storage.objects o where o.bucket_id='chat-character-media' and o.name=chat_character_media.workspace_id::text||'/'||chat_character_media.character_id::text||'/'||chat_character_media.id::text||'.webp'));
create policy chat_media_policy_owner on public.chat_character_media_policies for all to authenticated
 using(public.is_current_chat_admin_workspace(workspace_id))
 with check(public.chat_admin_media_writes_allowed(workspace_id) and exists(select 1 from public.chat_characters c where c.workspace_id=chat_character_media_policies.workspace_id and c.id=chat_character_media_policies.character_id and c.status='active'));

-- Every change takes the existing Character row lock. The revision-bound
-- generation/confirmation RPCs therefore reject drafts based on stale media.
create function public.chat_admin_media_revision() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then new.revision:=old.revision+1; end if;
 update public.chat_characters set revision=revision+1,updated_at=now()
 where workspace_id=case when TG_OP='DELETE' then old.workspace_id else new.workspace_id end
 and id=case when TG_OP='DELETE' then old.character_id else new.character_id end;
 if TG_OP='INSERT' and TG_TABLE_NAME='chat_character_media' and
 (select count(*) from public.chat_character_media m where m.workspace_id=new.workspace_id and m.character_id=new.character_id)>=100
 then raise exception 'media_library_limit'; end if;
 if TG_OP='DELETE' then return old; end if; return new;
end;$$;
revoke all on function public.chat_admin_media_revision() from public,anon,authenticated;
create trigger chat_media_revision before insert or update or delete on public.chat_character_media for each row execute function public.chat_admin_media_revision();
create trigger chat_media_policy_revision before insert or update or delete on public.chat_character_media_policies for each row execute function public.chat_admin_media_revision();

-- Serialize a late Storage insert with metadata tombstoning/account erasure.
-- Re-read metadata AFTER obtaining the same Character lock as its revoke path.
create function public.chat_admin_media_object_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare target_workspace uuid; target_character uuid;
begin
 if new.bucket_id<>'chat-character-media' then return new; end if;
 select c.workspace_id,c.id into target_workspace,target_character
 from public.chat_characters c join public.chat_character_media m
 on m.workspace_id=c.workspace_id and m.character_id=c.id
 where new.name=m.workspace_id::text||'/'||m.character_id::text||'/'||m.id::text||'.webp'
 for update of c;
 if not found then raise exception 'media_object_binding_invalid'; end if;
 if not public.chat_admin_media_writes_allowed(target_workspace) or not exists(
 select 1 from public.chat_character_media m join public.chat_characters c
 on c.workspace_id=m.workspace_id and c.id=m.character_id
 where m.workspace_id=target_workspace and m.character_id=target_character
 and not m.deleted and c.status='active'
 and new.name=m.workspace_id::text||'/'||m.character_id::text||'/'||m.id::text||'.webp')
 then raise exception 'media_object_binding_invalid'; end if;
 return new;
end;$$;
revoke all on function public.chat_admin_media_object_guard() from public,anon,authenticated,service_role;
create trigger chat_media_object_guard before insert on storage.objects for each row execute function public.chat_admin_media_object_guard();

-- Equality to the complete metadata-derived key avoids unsafe path casts.
create policy chat_media_object_select on storage.objects for select to authenticated using(
 bucket_id='chat-character-media' and exists(select 1 from public.chat_character_media m
 join public.chat_characters c on c.workspace_id=m.workspace_id and c.id=m.character_id
 where (c.status='active' or m.deleted) and name=m.workspace_id::text||'/'||m.character_id::text||'/'||m.id::text||'.webp'
 and public.is_current_chat_admin_workspace(m.workspace_id)));
create policy chat_media_object_insert on storage.objects for insert to authenticated with check(
 bucket_id='chat-character-media' and exists(select 1 from public.chat_character_media m
 join public.chat_characters c on c.workspace_id=m.workspace_id and c.id=m.character_id
 where not m.deleted and c.status='active' and name=m.workspace_id::text||'/'||m.character_id::text||'/'||m.id::text||'.webp'
 and public.chat_admin_media_writes_allowed(m.workspace_id)));
-- No UPDATE/upsert: an image cannot change behind a reviewed description.
create policy chat_media_object_delete on storage.objects for delete to authenticated using(
 bucket_id='chat-character-media' and exists(select 1 from public.chat_character_media m
 where m.deleted and name=m.workspace_id::text||'/'||m.character_id::text||'/'||m.id::text||'.webp'
 and public.is_current_chat_admin_workspace(m.workspace_id)));
commit;
