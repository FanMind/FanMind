-- FanMind Admin-Billing Erweiterung: Status, Sperrlogik, Rechnungs-MVP.
-- Additiv; bewusst keine IBAN- und keine Bankdaten-Spalten.
alter table public.workspaces add column if not exists billing_status text;
alter table public.workspaces add column if not exists billing_provider text;
alter table public.workspaces add column if not exists payment_collection_method text;
alter table public.workspaces add column if not exists billing_suspended_at timestamptz;
alter table public.workspaces add column if not exists billing_suspended_reason text;
alter table public.workspaces add column if not exists billing_manual_override boolean default false;
alter table public.workspaces add column if not exists billing_last_payment_failed_at timestamptz;
alter table public.workspaces add column if not exists billing_last_payment_at timestamptz;
alter table public.workspaces add column if not exists billing_retry_count integer default 0;
alter table public.workspaces add column if not exists billing_next_retry_at timestamptz;
alter table public.workspaces add column if not exists billing_grace_until timestamptz;
alter table public.workspaces add column if not exists billing_admin_note text;
alter table public.workspaces add column if not exists billing_updated_at timestamptz;
alter table public.workspaces add column if not exists billing_updated_by_user_id uuid;
alter table public.workspaces add column if not exists stripe_customer_id text;
alter table public.workspaces add column if not exists stripe_subscription_id text;
alter table public.workspaces add column if not exists last_invoice_id text;
alter table public.workspaces add column if not exists last_invoice_status text;
alter table public.workspaces add column if not exists last_invoice_amount_due_cents integer;
alter table public.workspaces add column if not exists last_invoice_amount_paid_cents integer;
alter table public.workspaces add column if not exists last_invoice_hosted_url text;
alter table public.workspaces add column if not exists last_invoice_pdf_url text;

alter table public.workspaces drop constraint if exists workspaces_billing_status_check;
alter table public.workspaces add constraint workspaces_billing_status_check
  check (billing_status is null or billing_status in ('demo_free','pending_payment_setup','pending_sepa_mandate','active','past_due','payment_failed','suspended','manual_suspended','cancelled','expired'));

create index if not exists workspaces_billing_status_idx on public.workspaces (billing_status);
create index if not exists workspaces_stripe_customer_id_idx on public.workspaces (stripe_customer_id);
