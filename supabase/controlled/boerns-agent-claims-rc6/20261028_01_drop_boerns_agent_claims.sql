-- BOERNS-CLAIM-SUPABASE-001 / Revision 16 / RC6
-- Destructive rollback draft. Not authorized for FanMind execution.
-- Prerequisite in the rollback session:
--   SET LOCAL boerns_agent_claims.rollback_approved = 'true';
-- This rollback is intentionally limited to an empty, disabled installation.

begin;

do $rollback_preflight$
begin
  if coalesce(current_setting('boerns_agent_claims.rollback_approved', true), '') <> 'true' then
    raise exception 'rollback_approved session guard is missing' using errcode = '42501';
  end if;

  if to_regnamespace('boerns_agent_claims') is null then
    raise exception 'schema boerns_agent_claims does not exist';
  end if;

end
$rollback_preflight$;

grant boerns_claims_owner to current_user;
set local role boerns_claims_owner;

do $rollback_guard$
declare
  v_operational_rows bigint;
begin
  -- Linearization point: drain all RPCs holding the shared gate and prevent new
  -- ones from passing it. Do this before inspecting any operational table.
  perform 1
    from boerns_agent_claims.control_state
   where singleton
   for update;
  if not found then
    raise exception 'control_state singleton is missing' using errcode = '55000';
  end if;

  update boerns_agent_claims.control_state
     set service_enabled = false,
         changed_at = clock_timestamp(),
         change_reason = 'ROLLBACK_PENDING'
   where singleton;

  -- Freeze direct writers as well as runtime RPCs. The emptiness decision and
  -- every following RESTRICT drop remain in this transaction under these locks.
  lock table boerns_agent_claims.control_state,
             boerns_agent_claims.principals,
             boerns_agent_claims.claims,
             boerns_agent_claims.request_receipts,
             boerns_agent_claims.audit_events
    in access exclusive mode;

  select (select count(*) from boerns_agent_claims.principals)
       + (select count(*) from boerns_agent_claims.claims)
       + (select count(*) from boerns_agent_claims.request_receipts)
       + (select count(*) from boerns_agent_claims.audit_events)
    into v_operational_rows;

  if v_operational_rows > 0 then
    raise exception 'rollback refuses to delete % operational rows; use a separately approved forward fix or restore plan',
      v_operational_rows using errcode = '55000';
  end if;
end
$rollback_guard$;

revoke all on schema boerns_agent_claims from boerns_claims_runtime;
revoke all on all functions in schema boerns_agent_claims from boerns_claims_runtime;

-- Every drop is dependency-restricted. An unlisted or external dependency aborts
-- this transaction instead of being removed implicitly.
drop function boerns_agent_claims.offer(text,text,text,text,bigint,text,uuid) restrict;
drop function boerns_agent_claims.acquire(text,text,text,text,bigint,uuid,integer) restrict;
drop function boerns_agent_claims.renew(text,text,uuid,uuid,bigint,uuid,integer) restrict;
drop function boerns_agent_claims.complete(text,text,uuid,uuid,bigint,uuid,text,text,text) restrict;
drop function boerns_agent_claims.read(text,text,uuid) restrict;
drop function boerns_agent_claims.rotate_epoch_after_restore(text) restrict;

drop function boerns_agent_claims.request_replay(text,uuid,text,jsonb,uuid) restrict;
drop function boerns_agent_claims.record_request(text,uuid,text,uuid,jsonb,jsonb) restrict;
drop function boerns_agent_claims.claim_response(uuid) restrict;
drop function boerns_agent_claims.write_audit(uuid,text,text,text,uuid,uuid,bigint,jsonb) restrict;
drop function boerns_agent_claims.current_agent(text,text) restrict;
drop function boerns_agent_claims.lock_service_gate() restrict;

drop table boerns_agent_claims.audit_events restrict;
drop table boerns_agent_claims.request_receipts restrict;
drop table boerns_agent_claims.claims restrict;
drop table boerns_agent_claims.principals restrict;
drop table boerns_agent_claims.control_state restrict;
drop function boerns_agent_claims.forbid_mutation() restrict;
drop sequence boerns_agent_claims.fencing_token_seq restrict;

-- Remove the only non-default default-ACL entry created by the forward migration.
alter default privileges in schema boerns_agent_claims
  grant execute on functions to public;

drop schema boerns_agent_claims restrict;
reset role;
revoke boerns_claims_owner from current_user;

drop role boerns_claims_runtime;
drop role boerns_claims_owner;

commit;
