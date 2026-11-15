-- CONTROLLED / UNAPPLIED: repository contract only. Never run from normal deploy.
-- Reuses the canonical #1099 CreatorPlaybook JSON shape per ChatAdmin Character.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.chat_characters
  add column sales_playbook jsonb not null default '{
    "positioning":"",
    "offers":[],
    "minimumHoursBetweenOffers":48,
    "aftercareHours":48,
    "contentBoundaries":[],
    "confirmationRequired":[],
    "noGos":[]
  }'::jsonb;

alter table public.chat_characters
  add constraint chat_characters_sales_playbook_object
  check (jsonb_typeof(sales_playbook) = 'object' and octet_length(sales_playbook::text) <= 18000);

comment on column public.chat_characters.sales_playbook is
  'Character-bound CreatorPlaybook shape from creator_sales_playbooks.rules; sales_rules remains supplemental free text.';

commit;
