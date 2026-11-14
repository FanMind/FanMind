-- CONTROLLED / UNAPPLIED. Separate reviewed Staging apply, never a Web deploy.
-- Append-only evidence, not a second price source. Prices remain sales_playbook.
begin;
create schema fanmind_media_price_evidence;
revoke all on schema fanmind_media_price_evidence from public,anon,authenticated,service_role;
create table fanmind_media_price_evidence.revisions (
 id bigint generated always as identity primary key,
 workspace_id uuid not null,
 character_id uuid not null,
 actor_id uuid,
 recorded_at timestamptz not null default clock_timestamp(),
 previous_revision integer not null,
 next_revision integer not null,
 previous_playbook jsonb not null,
 next_playbook jsonb not null,
 foreign key(workspace_id,character_id) references public.chat_characters(workspace_id,id) on delete cascade
);
create index media_price_revision_character on fanmind_media_price_evidence.revisions(workspace_id,character_id,next_revision);
alter table fanmind_media_price_evidence.revisions enable row level security;
revoke all on fanmind_media_price_evidence.revisions from public,anon,authenticated,service_role;
-- Trigger-only definer: immutable evidence cannot be written or changed by API users.
create function fanmind_media_price_evidence.audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.sales_playbook is distinct from new.sales_playbook then
  if new.revision<=old.revision then raise exception 'stale_media_context';end if;
  insert into fanmind_media_price_evidence.revisions(workspace_id,character_id,actor_id,previous_revision,next_revision,previous_playbook,next_playbook)
  values(new.workspace_id,new.id,auth.uid(),old.revision,new.revision,old.sales_playbook,new.sales_playbook);
 end if;
 return new;
end $$;
revoke all on function fanmind_media_price_evidence.audit() from public,anon,authenticated,service_role;
create trigger chat_media_price_audit after update of sales_playbook on public.chat_characters for each row execute function fanmind_media_price_evidence.audit();

create function public.chat_admin_media_prices_write(p_workspace uuid,p_character uuid,p_character_revision integer,p_playbook jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if not public.chat_admin_media_writes_allowed(p_workspace) then raise exception 'owner_required';end if;
 if jsonb_typeof(p_playbook)<>'object' or octet_length(p_playbook::text)>18000 then raise exception 'invalid_media_price';end if;
 update public.chat_characters set sales_playbook=p_playbook,revision=revision+1,updated_at=clock_timestamp()
 where workspace_id=p_workspace and id=p_character and revision=p_character_revision and status='active';
 if not found then raise exception 'stale_media_context';end if;
 return true;
end $$;
revoke all on function public.chat_admin_media_prices_write(uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.chat_admin_media_prices_write(uuid,uuid,integer,jsonb) to authenticated;

create table fanmind_media_price_evidence.offers (
 workspace_id uuid not null,
 character_id uuid not null,
 generation_id uuid not null,
 inbound_id uuid not null references public.chat_character_messages(id) on delete cascade,
 fan_id uuid not null,
 conversation_id uuid not null,
 character_revision integer not null,
 actor_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 binding jsonb not null,
 playbook_offer jsonb not null,
 primary key(workspace_id,character_id,generation_id),
 foreign key(workspace_id,character_id) references public.chat_characters(workspace_id,id) on delete cascade
);
create index media_price_offer_inbound on fanmind_media_price_evidence.offers(inbound_id);
alter table fanmind_media_price_evidence.offers enable row level security;
revoke all on fanmind_media_price_evidence.offers from public,anon,authenticated,service_role;

-- Evidence writer validates current authority/revision, generation, stock and bounds.
-- No Checkout, payment, fulfillment or message send is created here.
create function public.chat_admin_media_offer_record(p_workspace uuid,p_character uuid,p_fan uuid,p_conversation uuid,p_generation uuid,p_revision integer,p_binding jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.chat_characters; o jsonb; a jsonb; row_media public.chat_character_media;
 selected_offer jsonb; ids uuid[]:='{}'; selected_id uuid; inbound uuid;
 qty integer; amount bigint; base bigint; minimum bigint; maximum bigint; units integer:=1;
 folder uuid; inherited boolean; found_source boolean; source_id text; expected_source text; rules jsonb; tax jsonb; vat bigint; rate integer;
begin
 if auth.uid() is null or not public.chat_admin_media_writes_allowed(p_workspace) then raise exception 'owner_required';end if;
 select * into c from public.chat_characters where workspace_id=p_workspace and id=p_character and revision=p_revision and status='active' for update;
 if not found then raise exception 'stale_media_context';end if;
 if p_binding->>'workspace_id' is distinct from p_workspace::text or p_binding->>'character_id' is distinct from p_character::text or (p_binding->>'price_revision')::integer is distinct from p_revision then raise exception 'invalid_media_offer';end if;
 qty:=(p_binding->>'quantity')::integer;
 if qty not between 1 and 100 or jsonb_typeof(p_binding->'assets')<>'array' or jsonb_array_length(p_binding->'assets')<>qty then raise exception 'invalid_media_offer';end if;
 select value into o from jsonb_array_elements(c.sales_playbook->'offers') value where value->>'id'=p_binding->>'offer_id';
 if o is null or (o->>'active')::boolean is distinct from true or (o->>'requiresConfirmation')::boolean is distinct from false or o->'mediaTerms'->>'tax_mode'='unconfirmed' then raise exception 'invalid_media_offer';end if;
 for a in select value from jsonb_array_elements(p_binding->'assets') value loop
  selected_id:=(a->>'id')::uuid;
  if selected_id=any(ids) then raise exception 'invalid_media_offer';end if;
  ids:=array_append(ids,selected_id);
  select * into row_media from public.chat_character_media where workspace_id=p_workspace and character_id=p_character and id=selected_id and revision=(a->>'revision')::integer and available and reviewed and not deleted;
  if not found then raise exception 'stale_media_context';end if;
  if o ? 'mediaTerms' and o->'mediaTerms'->>'kind'<>row_media.media_type then raise exception 'invalid_media_offer';end if;
  selected_offer:=null;found_source:=false;folder:=row_media.folder_id;inherited:=false;rules:='{}';
  if qty=1 and row_media.offer_id<>'' then
   found_source:=true;
   select value into selected_offer from jsonb_array_elements(c.sales_playbook->'offers') value where value->>'id'=row_media.offer_id;
   source_id:=row_media.id::text;expected_source:='file';rules:=row_media.price_rules;
  else
   while folder is not null loop
    if qty>1 then
     select value into selected_offer from jsonb_array_elements(c.sales_playbook->'offers') value
      where value->'mediaTerms'->>'scope'='folder' and value->'mediaTerms'->>'target_id'=folder::text and value->'mediaTerms'->>'kind'=row_media.media_type and (value->'mediaTerms'->>'quantity')::integer=qty and (not inherited or (value->'mediaTerms'->>'inherit')::boolean);
    else
     select value into selected_offer from public.chat_character_media_folders f cross join lateral jsonb_array_elements(c.sales_playbook->'offers') value where f.workspace_id=p_workspace and f.character_id=p_character and f.id=folder and f.offer_id=value->>'id' and (not inherited or coalesce((value->'mediaTerms'->>'inherit')::boolean,true));
    end if;
    if selected_offer is not null then found_source:=true;source_id:=folder::text;expected_source:=case when qty>1 then 'package' else 'category' end;select price_rules into rules from public.chat_character_media_folders where workspace_id=p_workspace and character_id=p_character and id=folder;exit;end if;
    select parent_id into folder from public.chat_character_media_folders where workspace_id=p_workspace and character_id=p_character and id=folder;
    inherited:=true;
   end loop;
   if not found_source and qty=1 then
    select value into selected_offer from jsonb_array_elements(c.sales_playbook->'offers') value where value->'mediaTerms'->>'scope'='model' and value->'mediaTerms'->>'kind'=row_media.media_type and (value->'mediaTerms'->>'quantity')::integer=1;
    source_id:=p_character::text;expected_source:='model';
   end if;
  end if;
  if selected_offer is distinct from o or source_id is distinct from p_binding->>'source_id' or expected_source is distinct from p_binding->>'source' then raise exception 'invalid_media_offer';end if;
  if o->'mediaTerms'->>'unit_seconds' is not null then
   if qty<>1 or row_media.duration_ms is null then raise exception 'invalid_media_offer';end if;
   units:=ceil(row_media.duration_ms::numeric/((o->'mediaTerms'->>'unit_seconds')::integer*1000))::integer;
  end if;
 end loop;
 base:=(o->>'recommendedPriceMinor')::bigint*units;
 minimum:=greatest((o->>'minimumPriceMinor')::bigint*units,ceil(base::numeric*(100-(o->>'maximumDiscountPercent')::integer)/100)::bigint);
 amount:=(p_binding->>'offered_price_minor')::bigint;
 maximum:=case when coalesce((o->'mediaTerms'->>'upper_unlimited')::boolean,false) then 9007199254740991 when o ? 'mediaTerms' then (o->>'maximumPriceMinor')::bigint*units else base end;
 if amount is null or amount<minimum or amount>maximum or (p_binding->>'base_price_minor')::bigint is distinct from base or (p_binding->>'minimum_price_minor')::bigint is distinct from minimum then raise exception 'invalid_media_offer';end if;
 if coalesce((coalesce(o->'mediaTerms',rules)->>'negotiation_allowed')::boolean,false) is distinct from true and amount<>base then raise exception 'invalid_media_offer';end if;
 tax:='null'::jsonb;
 if o ? 'mediaTerms' then
  rate:=(o->'mediaTerms'->>'vat_basis_points')::integer;
  vat:=case when o->'mediaTerms'->>'tax_mode'='vat_included' then round(amount::numeric*rate/(10000+rate))::bigint else 0 end;
  tax:=jsonb_build_object('currency',o->>'currency','gross_minor',amount,'net_minor',amount-vat,'vat_minor',vat,'mode',o->'mediaTerms'->>'tax_mode','vat_basis_points',rate);
 end if;
 if p_binding->'tax' is distinct from tax then raise exception 'invalid_media_offer';end if;
 select id into inbound from public.chat_character_messages where workspace_id=p_workspace and character_id=p_character and fan_id=p_fan and conversation_id=p_conversation and generation_id=p_generation and character_revision=p_revision and direction='fan_inbound';
 if inbound is null or (select count(*) from public.chat_character_messages where workspace_id=p_workspace and character_id=p_character and fan_id=p_fan and conversation_id=p_conversation and generation_id=p_generation and character_revision=p_revision)<>4 then raise exception 'invalid_media_offer';end if;
 insert into fanmind_media_price_evidence.offers(workspace_id,character_id,generation_id,inbound_id,fan_id,conversation_id,character_revision,actor_id,binding,playbook_offer)
 values(p_workspace,p_character,p_generation,inbound,p_fan,p_conversation,p_revision,auth.uid(),p_binding,o) on conflict do nothing;
 if not exists(select 1 from fanmind_media_price_evidence.offers where workspace_id=p_workspace and character_id=p_character and generation_id=p_generation and fan_id=p_fan and conversation_id=p_conversation and character_revision=p_revision and binding=p_binding and playbook_offer=o) then raise exception 'media_offer_conflict';end if;
 return true;
end $$;
revoke all on function public.chat_admin_media_offer_record(uuid,uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.chat_admin_media_offer_record(uuid,uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
-- Generation text and its exact immutable price/file binding commit together.
create function public.persist_chat_admin_media_generation(
 target_workspace_id uuid,target_character_id uuid,target_fan_id uuid,target_conversation_id uuid,
 target_character_revision integer,target_fan_revision integer,target_generation_id uuid,
 expected_history_ids uuid[],inbound_content text,suggested_contents text[],media_binding jsonb
) returns text[] language plpgsql security invoker set search_path='' as $$
declare result text[];
begin
 result:=public.persist_chat_admin_generation(target_workspace_id,target_character_id,target_fan_id,target_conversation_id,target_character_revision,target_fan_revision,target_generation_id,expected_history_ids,inbound_content,suggested_contents);
 if media_binding is not null and media_binding->>'offered_price_minor' is not null then
  perform public.chat_admin_media_offer_record(target_workspace_id,target_character_id,target_fan_id,target_conversation_id,target_generation_id,target_character_revision,media_binding);
 end if;
 return result;
end $$;
revoke all on function public.persist_chat_admin_media_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[],jsonb) from public,anon,service_role;
grant execute on function public.persist_chat_admin_media_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[],jsonb) to authenticated;
commit;
