-- FanMind operations monitor component extension.
-- Metadata only. No customer content, prompts, messages or credentials are stored.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.system_health_events drop constraint if exists system_health_events_component_check;
alter table public.system_health_events add constraint system_health_events_component_check check (
  component in (
    'application',
    'supabase_config',
    'supabase_database',
    'supabase_storage',
    'stripe_config',
    'openai_config',
    'email_config',
    'backup',
    'backup_worker',
    'backup_offsite',
    'backup_retention',
    'backup_freshness',
    'operations_monitor',
    'deployment',
    'nginx',
    'pm2',
    'host_disk',
    'host_memory',
    'ssl_certificate'
  )
);

create index if not exists system_health_events_component_created_idx
  on public.system_health_events (component, created_at desc);

create index if not exists admin_notifications_active_monitor_idx
  on public.admin_notifications (source, technical_reference, created_at desc)
  where source = 'operations_monitor'
    and status in ('open', 'read', 'acknowledged');

commit;
