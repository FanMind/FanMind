-- FanMind Billing-Vorbereitung (MVP) – Stripe Checkout/Billing, keine IBAN, keine Stripe Keys.
-- Diese SQL-Datei bereitet optionale Workspace-Felder für spätere Billing-Prozesse vor.
-- Registrierung darf ohne diese Migration weiter funktionieren; aktuell werden Billing-Daten nur als Auth-Metadaten gesetzt.
-- Aktuelle Preislogik: pilot_only = 99000 Setup-Cents, 0 Monats-Cents; starter_paid_setup = 99000 Setup-Cents, 31200 Monats-Cents; starter_no_setup_commitment = 0 Setup-Cents, 31200 Monats-Cents.

alter table public.workspaces add column if not exists billing_status text;
alter table public.workspaces add column if not exists billing_provider text;
alter table public.workspaces add column if not exists payment_collection_method text;
alter table public.workspaces add column if not exists payment_terms_version text;
alter table public.workspaces add column if not exists payment_terms_accepted_at timestamptz;
alter table public.workspaces add column if not exists payment_terms_accepted_by_user_id uuid;
alter table public.workspaces add column if not exists stripe_customer_id text;
alter table public.workspaces add column if not exists stripe_subscription_id text;
alter table public.workspaces add column if not exists stripe_checkout_session_id text;
alter table public.workspaces add column if not exists stripe_payment_intent_id text;
alter table public.workspaces add column if not exists stripe_mandate_id text;
alter table public.workspaces add column if not exists billing_note text;
alter table public.workspaces add column if not exists billing_updated_at timestamptz;

alter table public.workspaces drop constraint if exists workspaces_billing_status_check;
alter table public.workspaces add constraint workspaces_billing_status_check
  check (billing_status is null or billing_status in ('demo_free', 'pending_payment_setup', 'pending_sepa_mandate', 'active', 'past_due', 'payment_failed', 'cancelled', 'expired'));

alter table public.workspaces drop constraint if exists workspaces_billing_provider_check;
alter table public.workspaces add constraint workspaces_billing_provider_check
  check (billing_provider is null or billing_provider in ('manual', 'stripe'));

alter table public.workspaces drop constraint if exists workspaces_payment_collection_method_check;
alter table public.workspaces add constraint workspaces_payment_collection_method_check
  check (payment_collection_method is null or payment_collection_method in ('none', 'manual_invoice', 'sepa_direct_debit'));


-- Stripe-Billing bleibt additiv: keine IBAN-/Bankdaten-Spalten anlegen.
-- Admin-Zugriff wird primär über FANMIND_ADMIN_EMAILS bzw. Code-Fallback gesteuert; keine Pflichtmigration nötig.
