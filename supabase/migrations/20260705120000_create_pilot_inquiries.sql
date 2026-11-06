-- Store public footer pilot inquiries for the protected FanMind admin area.
create table if not exists public.pilot_inquiries (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  message text,
  source text not null default 'landing_footer',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  handled_at timestamptz,
  handled_by uuid
);

alter table public.pilot_inquiries drop constraint if exists pilot_inquiries_status_check;
alter table public.pilot_inquiries add constraint pilot_inquiries_status_check
  check (status in ('new', 'contacted', 'archived'));

alter table public.pilot_inquiries drop constraint if exists pilot_inquiries_email_not_blank;
alter table public.pilot_inquiries add constraint pilot_inquiries_email_not_blank
  check (length(trim(email)) > 0 and position('@' in email) > 1);

create index if not exists pilot_inquiries_created_at_idx on public.pilot_inquiries (created_at desc);
create index if not exists pilot_inquiries_status_idx on public.pilot_inquiries (status);

alter table public.pilot_inquiries enable row level security;

drop policy if exists "pilot_inquiries_no_public_read" on public.pilot_inquiries;
drop policy if exists "pilot_inquiries_no_public_insert" on public.pilot_inquiries;

create policy "pilot_inquiries_no_public_read"
  on public.pilot_inquiries
  for select
  to anon, authenticated
  using (false);

create policy "pilot_inquiries_no_public_insert"
  on public.pilot_inquiries
  for insert
  to anon, authenticated
  with check (false);
