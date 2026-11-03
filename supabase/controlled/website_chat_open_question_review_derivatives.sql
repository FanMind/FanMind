-- REVIEW SOURCE ONLY. This controlled SQL is not part of automatic migrations.
-- Real records remain pending until a separately authorized human review supply path exists.
begin;

do $preflight$
begin
  if to_regclass('public.website_chat_open_questions') is null then
    raise exception 'open_question_review_parent_missing';
  end if;
  if to_regrole('service_role') is null
     or to_regrole('anon') is null
     or to_regrole('authenticated') is null then
    raise exception 'open_question_review_roles_missing';
  end if;
end
$preflight$;

do $parent_unique$
begin
  if not exists (
    select 1
      from pg_constraint constraint_row
      join pg_class parent_table on parent_table.oid = constraint_row.conrelid
      join pg_namespace parent_schema on parent_schema.oid = parent_table.relnamespace
     where parent_schema.nspname = 'public'
       and parent_table.relname = 'website_chat_open_questions'
       and constraint_row.contype in ('p', 'u')
       and (
         select array_agg(attribute.attname order by key_column.ordinality)
           from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
           join pg_attribute attribute
             on attribute.attrelid = constraint_row.conrelid
            and attribute.attnum = key_column.attnum
       ) = array['id', 'workspace_id']::name[]
  ) then
    alter table public.website_chat_open_questions
      add constraint website_chat_open_questions_id_workspace_unique
      unique (id, workspace_id);
  end if;
end
$parent_unique$;

create table public.website_chat_open_question_review_derivatives (
  id uuid primary key default gen_random_uuid(),
  open_question_id uuid not null,
  workspace_id uuid not null,
  review_version integer not null check (review_version > 0),
  review_state text not null check (review_state in ('pending', 'approved', 'rejected')),
  reviewed_question_excerpt text,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint website_chat_open_question_review_derivative_question_fk
    foreign key (open_question_id, workspace_id)
    references public.website_chat_open_questions(id, workspace_id)
    on delete cascade,
  constraint website_chat_open_question_review_derivative_version_unique
    unique (open_question_id, workspace_id, review_version),
  constraint website_chat_open_question_review_derivative_evidence_check
    check (
      (
        review_state = 'approved'
        and reviewed_question_excerpt is not null
        and reviewed_question_excerpt = btrim(reviewed_question_excerpt)
        and char_length(reviewed_question_excerpt) between 1 and 160
        and reviewed_question_excerpt !~ '[[:cntrl:]]'
        and reviewed_question_excerpt !~* '(https?://|www[.]|[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|sk-[[:alnum:]_-]{8,})'
        and reviewed_question_excerpt !~ '([+][0-9][0-9 ()/-]{6,}[0-9]|[0-9][0-9 ()/-]{8,}[0-9])'
        and reviewer_id is not null
        and reviewed_at is not null
      )
      or (
        review_state in ('pending', 'rejected')
        and reviewed_question_excerpt is null
        and reviewer_id is null
        and reviewed_at is null
      )
    )
);

create index website_chat_open_question_review_derivative_latest_idx
  on public.website_chat_open_question_review_derivatives
    (workspace_id, open_question_id, review_version desc);

alter table public.website_chat_open_question_review_derivatives enable row level security;
alter table public.website_chat_open_question_review_derivatives force row level security;

revoke all on public.website_chat_open_question_review_derivatives
  from public, anon, authenticated, service_role;
grant select on public.website_chat_open_question_review_derivatives to service_role;

create policy website_chat_open_question_review_service_read
  on public.website_chat_open_question_review_derivatives
  for select
  to service_role
  using (true);

do $postflight$
declare
  derivative regclass := to_regclass('public.website_chat_open_question_review_derivatives');
begin
  if derivative is null
     or not exists (
       select 1 from pg_class
        where oid = derivative
          and relrowsecurity
          and relforcerowsecurity
     )
     or not exists (
       select 1
         from pg_constraint
        where conrelid = derivative
          and conname = 'website_chat_open_question_review_derivative_question_fk'
          and contype = 'f'
          and confdeltype = 'c'
     )
     or has_table_privilege('anon', derivative, 'SELECT')
     or has_table_privilege('authenticated', derivative, 'SELECT')
     or not has_table_privilege('service_role', derivative, 'SELECT')
     or has_table_privilege('service_role', derivative, 'INSERT')
     or has_table_privilege('service_role', derivative, 'UPDATE')
     or has_table_privilege('service_role', derivative, 'DELETE') then
    raise exception 'open_question_review_derivative_postflight_failed';
  end if;
end
$postflight$;

comment on table public.website_chat_open_question_review_derivatives is
  'Versioned human-review derivative. Source-only until an authorized supplier exists; no application role can approve or write it. Rows share the parent question cascade, retention and legal-hold boundary.';
comment on column public.website_chat_open_question_review_derivatives.reviewed_question_excerpt is
  'At most 160 Unicode code points. Only a complete latest approved review may reach the admin consumer.';

commit;
