begin;

-- Trigger helpers are never public RPC endpoints. Pin their name resolution
-- and remove direct browser execution while preserving the existing triggers.
alter function public.set_social_connections_updated_at()
  set search_path = pg_catalog, pg_temp;
revoke all on function public.set_social_connections_updated_at()
  from public, anon, authenticated;

alter function public.set_referral_updated_at()
  set search_path = pg_catalog, pg_temp;
revoke all on function public.set_referral_updated_at()
  from public, anon, authenticated;

alter function public.set_demo_start_session_updated_at()
  set search_path = pg_catalog, pg_temp;
revoke all on function public.set_demo_start_session_updated_at()
  from public, anon, authenticated;

-- Older environments can still contain the retired SECURITY DEFINER
-- retention trigger. Newer environments drop it in the incremental-history
-- migration, so this hardening must safely support both states.
do $migration$
begin
  if to_regprocedure(
    'public.trim_conversation_messages_to_latest_50()'
  ) is not null then
    execute $sql$
      alter function public.trim_conversation_messages_to_latest_50()
        set search_path = pg_catalog, pg_temp
    $sql$;
    execute $sql$
      revoke all on function public.trim_conversation_messages_to_latest_50()
      from public, anon, authenticated
    $sql$;
  end if;
end
$migration$;

commit;
