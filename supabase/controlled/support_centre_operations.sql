-- SOURCE ONLY. Part of the separately approved Support Staging rollout.
-- No new role, scheduler, Owner assignment or runtime activation is installed.
BEGIN;
CREATE TABLE public.support_retention_runs (
 run_id uuid PRIMARY KEY, retention_day date NOT NULL, source_commit text NOT NULL CHECK(source_commit ~ '^[a-f0-9]{40}$'),
 status text NOT NULL CHECK(status IN ('started','succeeded','failed')), attempts integer NOT NULL CHECK(attempts BETWEEN 1 AND 3),
 started_at timestamptz NOT NULL, completed_at timestamptz, counts jsonb NOT NULL DEFAULT '{}'::jsonb, error_code text
);
CREATE UNIQUE INDEX support_retention_one_success_daily ON public.support_retention_runs(retention_day) WHERE status='succeeded';
ALTER TABLE public.support_retention_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_retention_runs FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX support_turn_retention ON public.support_chat_turns(created_at);
CREATE INDEX support_thread_retention ON public.support_chat_threads(updated_at);
CREATE INDEX support_notice_retention ON public.support_centre_notifications(created_at);
CREATE INDEX support_case_retention ON public.support_centre_cases(completed_at,expires_at);

CREATE FUNCTION public.run_support_retention(p_run uuid,p_source text,p_retry boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior public.support_retention_runs; existing uuid; candidate_ids uuid[]; thread_ids uuid[];
 n_turns integer:=0; n_threads integer:=0; n_notices integer:=0; n_cases integer:=0; n_events integer:=0; n_more integer:=0;
 today date:=(clock_timestamp() AT TIME ZONE 'UTC')::date; result jsonb;
BEGIN
 IF p_run IS NULL OR p_source IS NULL OR (p_source !~ '^[a-f0-9]{40}$' OR p_source=repeat('0',40)) THEN RAISE EXCEPTION 'invalid_retention_request'; END IF;
 IF NOT pg_catalog.pg_try_advisory_xact_lock(1350,1416) THEN RETURN jsonb_build_object('status','busy'); END IF;
 SELECT * INTO prior FROM public.support_retention_runs WHERE run_id=p_run FOR UPDATE;
 IF FOUND THEN
  IF prior.source_commit<>p_source OR prior.retention_day<>today THEN RAISE EXCEPTION 'retention_request_conflict'; END IF;
  IF prior.status='succeeded' OR NOT p_retry OR prior.attempts>=3 THEN RETURN to_jsonb(prior); END IF;
 END IF;
 SELECT run_id INTO existing FROM public.support_retention_runs WHERE retention_day=today AND status='succeeded';
 IF FOUND THEN RETURN jsonb_build_object('status','already_completed','run_id',existing); END IF;
 INSERT INTO public.support_retention_runs(run_id,retention_day,source_commit,status,attempts,started_at)
 VALUES(p_run,today,p_source,'started',1,clock_timestamp())
 ON CONFLICT(run_id) DO UPDATE SET status='started',attempts=public.support_retention_runs.attempts+1,started_at=clock_timestamp(),completed_at=NULL,error_code=NULL;
 BEGIN
  -- Refuse an unsupported backlog rather than timing out repeatedly without evidence.
  IF (SELECT count(*) FROM (SELECT 1 FROM public.support_chat_turns WHERE created_at<clock_timestamp()-interval '30 days' LIMIT 10001)x)>10000 OR (SELECT count(*) FROM public.support_centre_cases)>10000 OR (SELECT count(*) FROM public.support_centre_notifications)>20000 THEN RAISE EXCEPTION 'retention_volume_requires_review'; END IF;
  WITH gone AS(DELETE FROM public.support_chat_turns WHERE created_at<clock_timestamp()-interval '30 days' RETURNING 1)SELECT count(*) INTO n_turns FROM gone;
  SELECT array_agg(id) INTO thread_ids FROM (SELECT t.id FROM public.support_chat_threads t WHERE t.updated_at<clock_timestamp()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM public.support_chat_turns m WHERE m.thread_id=t.id) FOR UPDATE OF t)t;
  -- Fresh statement after row locks: a sender may have committed while we waited.
  SELECT array_agg(t.id) INTO thread_ids FROM public.support_chat_threads t WHERE t.id=ANY(coalesce(thread_ids,'{}'::uuid[])) AND t.updated_at<clock_timestamp()-interval '30 days' AND NOT EXISTS(SELECT 1 FROM public.support_chat_turns m WHERE m.thread_id=t.id);
  WITH gone AS(DELETE FROM public.support_centre_notifications WHERE code='handoff_required' AND reference_id=ANY(coalesce(thread_ids,'{}'::uuid[])) RETURNING 1)SELECT count(*) INTO n_notices FROM gone;
  WITH gone AS(DELETE FROM public.support_chat_threads WHERE id=ANY(coalesce(thread_ids,'{}'::uuid[])) RETURNING 1)SELECT count(*) INTO n_threads FROM gone;
  SELECT array_agg(id) INTO candidate_ids FROM (SELECT id FROM public.support_centre_cases WHERE
   (completed_at IS NOT NULL AND completed_at<clock_timestamp()-interval '30 days') OR
   (status IN ('pending','running') AND expires_at<clock_timestamp()-interval '31 days') FOR UPDATE)c;
  SELECT array_agg(id) INTO candidate_ids FROM public.support_centre_cases WHERE id=ANY(coalesce(candidate_ids,'{}'::uuid[])) AND ((completed_at IS NOT NULL AND completed_at<clock_timestamp()-interval '30 days') OR (status IN ('pending','running') AND expires_at<clock_timestamp()-interval '31 days'));
  SELECT count(*) INTO n_events FROM public.support_centre_events WHERE case_id=ANY(coalesce(candidate_ids,'{}'::uuid[]));
  WITH gone AS(DELETE FROM public.support_centre_notifications WHERE reference_id=ANY(coalesce(candidate_ids,'{}'::uuid[])) OR created_at<clock_timestamp()-interval '30 days' RETURNING 1)SELECT count(*) INTO n_more FROM gone;
  n_notices:=n_notices+n_more;
  WITH gone AS(DELETE FROM public.support_centre_cases WHERE id=ANY(coalesce(candidate_ids,'{}'::uuid[])) RETURNING 1)SELECT count(*) INTO n_cases FROM gone;
  result:=jsonb_build_object('turns',n_turns,'threads',n_threads,'notifications',n_notices,'cases',n_cases,'case_events',n_events);
  UPDATE public.support_retention_runs SET status='succeeded',completed_at=clock_timestamp(),counts=result WHERE run_id=p_run;
  DELETE FROM public.support_retention_runs WHERE run_id<>p_run AND completed_at<clock_timestamp()-interval '90 days';
 EXCEPTION WHEN OTHERS THEN
  UPDATE public.support_retention_runs SET status='failed',completed_at=clock_timestamp(),counts='{}'::jsonb,error_code=SQLSTATE WHERE run_id=p_run;
 END;
 SELECT to_jsonb(r) INTO result FROM public.support_retention_runs r WHERE run_id=p_run;
 RETURN result;
END $$;
-- Preserve the old administrative signature, but never bypass the audit ledger.
CREATE OR REPLACE FUNCTION public.support_centre_purge()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'use_reviewed_retention_runner';
END $$;
CREATE FUNCTION public.support_retention_health(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE last_success timestamptz; latest_status text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) THEN RAISE EXCEPTION 'owner_required'; END IF;
 SELECT max(completed_at) INTO last_success FROM public.support_retention_runs WHERE status='succeeded';
 SELECT status INTO latest_status FROM public.support_retention_runs ORDER BY started_at DESC LIMIT 1;
 RETURN jsonb_build_object('last_success',last_success,'latest_status',latest_status,'healthy',last_success IS NOT NULL AND last_success>clock_timestamp()-interval '30 hours' AND latest_status='succeeded');
END $$;
CREATE FUNCTION public.support_chat_privacy_state(p_actor uuid,p_workspace uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('thread',t.id,'sequence',coalesce((SELECT max(m.turn_number) FROM public.support_chat_turns m WHERE m.thread_id=t.id),0)) FROM public.support_chat_threads t WHERE t.user_id=p_actor AND t.workspace_id=p_workspace;
$$;
CREATE FUNCTION public.support_chat_erase(p_actor uuid,p_workspace uuid,p_thread uuid,p_sequence bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE found_thread uuid;
BEGIN
 IF p_sequence IS NULL OR p_sequence<0 THEN RAISE EXCEPTION 'invalid_erase_snapshot'; END IF;
 SELECT id INTO found_thread FROM public.support_chat_threads WHERE id=p_thread AND user_id=p_actor AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.support_chat_turns WHERE thread_id=found_thread AND turn_number>p_sequence) THEN RAISE EXCEPTION 'erase_snapshot_changed'; END IF;
 DELETE FROM public.support_chat_threads WHERE id=found_thread AND user_id=p_actor AND workspace_id=p_workspace;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.run_support_retention(uuid,text,boolean),public.support_centre_purge(),public.support_retention_health(uuid),public.support_chat_privacy_state(uuid,uuid),public.support_chat_erase(uuid,uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_retention_health(uuid),public.support_chat_privacy_state(uuid,uuid),public.support_chat_erase(uuid,uuid,uuid,bigint) TO service_role;
COMMIT;
