-- Only inside the dedicated rollback-only Staging rehearsal transaction.
SET LOCAL ROLE service_role;
DO $accept$
BEGIN
 BEGIN
  INSERT INTO public.support_repair_audit(workspace_id,actor_user_id,connection_id,platform,action,consent_required,consent_given,status,request_id)
  VALUES('58a18c7e-4af0-459d-b44d-7d924ee7ffe9','3abca6a2-c4f7-4ff7-b72d-915d19181ffc','de135000-2026-4000-8000-000000000001','facebook','refresh_readonly_status',true,true,'started','de135001-2026-4000-8000-000000000001');
  BEGIN
   INSERT INTO public.support_repair_audit(workspace_id,actor_user_id,platform,action,consent_required,consent_given,status,request_id)
   VALUES('58a18c7e-4af0-459d-b44d-7d924ee7ffe9','3abca6a2-c4f7-4ff7-b72d-915d19181ffc','facebook','refresh_readonly_status',true,true,'started',gen_random_uuid());
   RAISE EXCEPTION 'missing_connection_accepted';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
  BEGIN
   INSERT INTO public.support_repair_audit SELECT gen_random_uuid(),workspace_id,actor_user_id,platform,action,consent_required,consent_given,status,request_id,created_at,completed_at,connection_id FROM public.support_repair_audit;
   RAISE EXCEPTION 'duplicate_request_accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
   UPDATE public.support_repair_audit SET status='partial',completed_at=NULL;
   RAISE EXCEPTION 'missing_completion_accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
   UPDATE public.support_repair_audit SET consent_given=false;
   RAISE EXCEPTION 'missing_consent_accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.support_repair_audit SET status='partial',completed_at=clock_timestamp();
  IF NOT EXISTS(SELECT 1 FROM public.support_repair_audit WHERE connection_id='de135000-2026-4000-8000-000000000001' AND status='partial' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'partial_not_persisted'; END IF;
  UPDATE public.support_repair_audit SET status='succeeded';
  UPDATE public.support_repair_audit SET status='failed';
  BEGIN
   UPDATE public.support_repair_audit SET status='started';
   RAISE EXCEPTION 'started_with_completion_accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE EXCEPTION 'rollback_synthetic_audit';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'rollback_synthetic_audit' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.support_repair_audit) THEN RAISE EXCEPTION 'synthetic_audit_residue'; END IF;
END $accept$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $denied$ BEGIN
 BEGIN PERFORM 1 FROM public.support_repair_audit;RAISE EXCEPTION 'browser_audit_read_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $denied$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $denied$ BEGIN
 BEGIN PERFORM 1 FROM public.support_repair_audit;RAISE EXCEPTION 'anonymous_audit_read_allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $denied$;
RESET ROLE;
SELECT 'SUPPORT_REPAIR_AUDIT_NATIVE_ACCEPTANCE=PASS' AS result;
