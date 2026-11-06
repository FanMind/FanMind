alter table public.profiles
  add column if not exists phone text,
  add column if not exists role_audience text;

alter table public.workspaces
  add column if not exists organization_name text,
  add column if not exists street_address text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists vat_id text,
  add column if not exists tax_number text,
  add column if not exists company_register_number text,
  add column if not exists company_register_court text;
