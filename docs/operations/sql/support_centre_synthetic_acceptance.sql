-- Only generated or dedicated marked synthetic identities; no provider calls.
-- The caller must wrap this entire file in BEGIN/ROLLBACK.
DO $fixtures$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id='58a18c7e-4af0-459d-b44d-7d924ee7ffe9'
  AND test_access_flags->>'staging_synthetic_fixture'='true'
  AND test_access_flags->>'workspace_processing_acceptance'='true')
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='3abca6a2-c4f7-4ff7-b72d-915d19181ffc'
  AND email ~* '(staging|synthetic|test)' AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'support_synthetic_identity_rejected'; END IF;
 IF EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id='3abca6a2-c4f7-4ff7-b72d-915d19181ffc')
 OR EXISTS(SELECT 1 FROM public.support_chat_threads WHERE user_id='3abca6a2-c4f7-4ff7-b72d-915d19181ffc')
 OR EXISTS(SELECT 1 FROM public.social_connections WHERE id='de135100-2026-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'support_fixture_not_clean'; END IF;
END $fixtures$;
INSERT INTO public.support_centre_owners(user_id) VALUES('3abca6a2-c4f7-4ff7-b72d-915d19181ffc');
INSERT INTO public.social_connections(id,workspace_id,platform,status)
 VALUES('de135100-2026-4000-8000-000000000001','58a18c7e-4af0-459d-b44d-7d924ee7ffe9','facebook','expired');
SET LOCAL ROLE service_role;
DO $flow$
DECLARE
 actor uuid:='3abca6a2-c4f7-4ff7-b72d-915d19181ffc';
 ws uuid:='58a18c7e-4af0-459d-b44d-7d924ee7ffe9';
 connection uuid:='de135100-2026-4000-8000-000000000001';
 foreign_id uuid:='de135100-2026-4000-8000-000000000099';
 request_a uuid:='de135101-2026-4000-8000-000000000001';
 request_b uuid:='de135101-2026-4000-8000-000000000002';
 target_case uuid; thread_id uuid; snapshot jsonb; rejected integer:=0;
BEGIN
 BEGIN PERFORM public.support_centre_report(foreign_id,connection,'facebook','connection_attention');
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_support_target' THEN RAISE;END IF;rejected:=rejected+1;END;
 target_case:=public.support_centre_report(ws,connection,'facebook','connection_attention');
 IF public.support_centre_report(ws,connection,'facebook','connection_attention')<>target_case THEN RAISE EXCEPTION 'support_report_not_idempotent';END IF;
 BEGIN PERFORM public.support_centre_decide(foreign_id,ws,target_case,'approve');
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'owner_required' THEN RAISE;END IF;rejected:=rejected+1;END;
 BEGIN PERFORM public.support_centre_decide(actor,foreign_id,target_case,'approve');
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'claim_unavailable' THEN RAISE;END IF;rejected:=rejected+1;END;
 BEGIN PERFORM public.support_centre_inbox(foreign_id);
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'owner_required' THEN RAISE;END IF;rejected:=rejected+1;END;
 PERFORM public.support_centre_notify(ws,'security_boundary',connection);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.support_centre_inbox(actor)) entry WHERE entry->>'reference_id'=connection::text) THEN RAISE EXCEPTION 'owner_inbox_missing';END IF;
 IF public.support_centre_decide(actor,ws,target_case,'approve')->>'status'<>'running' THEN RAISE EXCEPTION 'support_claim_failed';END IF;
 IF public.support_centre_check(actor,ws,target_case) THEN RAISE EXCEPTION 'unverified_connection_accepted';END IF;
 IF NOT public.support_centre_finish(actor,ws,target_case,false) OR NOT public.support_centre_finish(actor,ws,target_case,false) THEN RAISE EXCEPTION 'support_completion_not_idempotent';END IF;
 BEGIN PERFORM public.support_centre_finish(actor,ws,target_case,true);
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'transition_unavailable' THEN RAISE;END IF;rejected:=rejected+1;END;
 IF (SELECT count(*) FROM public.support_centre_events WHERE public.support_centre_events.case_id=target_case AND event='failed')<>1 THEN RAISE EXCEPTION 'support_history_invalid';END IF;
 PERFORM public.support_chat_send(actor,ws,request_a,'Synthetic support question A','Synthetic answer A','support',false);
 PERFORM public.support_chat_send(actor,ws,request_a,'Synthetic support question A','Synthetic answer A','support',false);
 IF jsonb_array_length(public.support_chat_read(actor,ws))<>1 OR jsonb_array_length(public.support_chat_read(foreign_id,ws))<>0 OR jsonb_array_length(public.support_chat_read(actor,foreign_id))<>0 THEN RAISE EXCEPTION 'support_chat_isolation_failed';END IF;
 snapshot:=public.support_chat_privacy_state(actor,ws);thread_id:=(snapshot->>'thread')::uuid;
 BEGIN PERFORM public.support_chat_review(ws,thread_id);
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'handoff_consent_required' THEN RAISE;END IF;rejected:=rejected+1;END;
 PERFORM public.support_chat_handoff(actor,ws);
 PERFORM public.support_chat_send(actor,ws,request_b,'Synthetic question after consent','Synthetic unshared answer','support',false);
 IF jsonb_array_length(public.support_chat_review(ws,thread_id))<>1 OR jsonb_array_length(public.support_chat_page(actor,ws,request_b))<>1 THEN RAISE EXCEPTION 'support_handoff_snapshot_failed';END IF;
 snapshot:=public.support_chat_privacy_state(actor,ws);
 IF public.support_chat_erase(foreign_id,ws,thread_id,(snapshot->>'sequence')::bigint) THEN RAISE EXCEPTION 'foreign_erase_allowed';END IF;
 BEGIN PERFORM public.support_chat_erase(actor,ws,thread_id,0);
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'erase_snapshot_changed' THEN RAISE;END IF;rejected:=rejected+1;END;
 IF NOT public.support_chat_erase(actor,ws,thread_id,(snapshot->>'sequence')::bigint) OR jsonb_array_length(public.support_chat_read(actor,ws))<>0 THEN RAISE EXCEPTION 'support_own_erasure_failed';END IF;
 IF rejected<>7 THEN RAISE EXCEPTION 'support_negative_probe_missing';END IF;
 IF (public.support_retention_health(actor)->>'healthy')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'support_retention_unhealthy';END IF;
END $flow$;
RESET ROLE;
SELECT 'SUPPORT_SYNTHETIC_FUNCTIONS=PASS';
