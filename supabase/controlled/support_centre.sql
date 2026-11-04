-- SOURCE ONLY / UNAPPLIED. Separate reviewed target-bound rollout required.
-- No generic migration entry, runtime flag activation or Owner provisioning here.
BEGIN;
CREATE TABLE public.support_centre_owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.support_centre_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','whatsapp')),
  problem text NOT NULL CHECK (problem IN ('connection_attention','sync_attention')),
  action text NOT NULL DEFAULT 'refresh_readonly_status' CHECK (action = 'refresh_readonly_status'),
  permission text NOT NULL DEFAULT 'read_connection_status' CHECK (permission = 'read_connection_status'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','rejected','succeeded','failed','expired')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 minutes',
  decided_by uuid, decided_at timestamptz, completed_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 hour'),
  UNIQUE (workspace_id,id)
);
CREATE UNIQUE INDEX support_centre_one_active ON public.support_centre_cases(workspace_id,connection_id,problem) WHERE status IN ('pending','running');
CREATE TABLE public.support_centre_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL, case_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('requested','approved','rejected','succeeded','failed','expired')),
  actor_user_id uuid, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (workspace_id,case_id) REFERENCES public.support_centre_cases(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX support_centre_cases_recent ON public.support_centre_cases(workspace_id,created_at DESC);
CREATE INDEX support_centre_events_recent ON public.support_centre_events(workspace_id,created_at DESC);
ALTER TABLE public.support_centre_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_centre_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_centre_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_centre_owners, public.support_centre_cases, public.support_centre_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.support_centre_owners, public.support_centre_cases, public.support_centre_events TO service_role;

-- Only the trusted server can call. Never expose p_workspace/connection as a customer API.
CREATE FUNCTION public.support_centre_report(p_workspace uuid,p_connection uuid,p_platform text,p_problem text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.support_centre_cases; result_id uuid;
BEGIN
  IF p_platform NOT IN ('facebook','instagram','whatsapp') OR p_problem NOT IN ('connection_attention','sync_attention') OR
    NOT EXISTS (SELECT 1 FROM public.social_connections c WHERE c.id=p_connection AND c.workspace_id=p_workspace AND c.platform=p_platform) THEN
    RAISE EXCEPTION 'invalid_support_target';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text || ':' || p_connection::text || ':' || p_problem,0));
  SELECT * INTO existing FROM public.support_centre_cases WHERE workspace_id=p_workspace AND connection_id=p_connection AND problem=p_problem AND status IN ('pending','running') FOR UPDATE;
  IF FOUND THEN
    IF existing.status='running' OR existing.expires_at > clock_timestamp() THEN RETURN existing.id; END IF;
    UPDATE public.support_centre_cases SET status='expired',completed_at=clock_timestamp() WHERE id=existing.id;
    INSERT INTO public.support_centre_events(workspace_id,case_id,event) VALUES(p_workspace,existing.id,'expired');
  END IF;
  INSERT INTO public.support_centre_cases(workspace_id,connection_id,platform,problem) VALUES(p_workspace,p_connection,p_platform,p_problem) RETURNING id INTO result_id;
  INSERT INTO public.support_centre_events(workspace_id,case_id,event) VALUES(p_workspace,result_id,'requested');
  RETURN result_id;
END $$;

CREATE FUNCTION public.support_centre_decide(p_actor uuid,p_workspace uuid,p_case uuid,p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.support_centre_cases;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) OR p_decision NOT IN ('approve','reject') OR p_decision IS NULL THEN RAISE EXCEPTION 'owner_required'; END IF;
  SELECT * INTO target FROM public.support_centre_cases WHERE id=p_case AND workspace_id=p_workspace FOR UPDATE;
  IF NOT FOUND OR target.status <> 'pending' OR target.expires_at <= clock_timestamp() OR target.action <> 'refresh_readonly_status' OR target.permission <> 'read_connection_status' THEN RAISE EXCEPTION 'claim_unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.social_connections c WHERE c.id=target.connection_id AND c.workspace_id=target.workspace_id AND c.platform=target.platform) THEN RAISE EXCEPTION 'target_unavailable'; END IF;
  UPDATE public.support_centre_cases SET status=CASE WHEN p_decision='approve' THEN 'running' ELSE 'rejected' END,
    decided_by=p_actor,decided_at=clock_timestamp(),completed_at=CASE WHEN p_decision='reject' THEN clock_timestamp() ELSE NULL END
    WHERE id=p_case RETURNING * INTO target;
  INSERT INTO public.support_centre_events(workspace_id,case_id,event,actor_user_id) VALUES(p_workspace,p_case,CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END,p_actor);
  RETURN to_jsonb(target);
END $$;

-- Coarse result only, exact claimed connection; no token or raw-error projection.
CREATE FUNCTION public.support_centre_check(p_actor uuid,p_workspace uuid,p_case uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.support_centre_cases;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) THEN RAISE EXCEPTION 'owner_required'; END IF;
  SELECT * INTO target FROM public.support_centre_cases WHERE id=p_case AND workspace_id=p_workspace;
  IF NOT FOUND OR target.status <> 'running' OR target.decided_by IS DISTINCT FROM p_actor OR target.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'claim_unavailable'; END IF;
  RETURN EXISTS (SELECT 1 FROM public.social_connections c WHERE c.id=target.connection_id AND c.workspace_id=p_workspace AND c.platform=target.platform AND c.status='connected' AND nullif(pg_catalog.btrim(c.last_messenger_sync_error),'') IS NULL);
END $$;

CREATE FUNCTION public.support_centre_finish(p_actor uuid,p_workspace uuid,p_case uuid,p_success boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target public.support_centre_cases; terminal text;
BEGIN
  IF p_success IS NULL OR NOT EXISTS (SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) THEN RAISE EXCEPTION 'owner_required'; END IF;
  terminal := CASE WHEN p_success THEN 'succeeded' ELSE 'failed' END;
  SELECT * INTO target FROM public.support_centre_cases WHERE id=p_case AND workspace_id=p_workspace FOR UPDATE;
  IF NOT FOUND OR target.decided_by IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'claim_unavailable'; END IF;
  IF target.status=terminal THEN RETURN true; END IF;
  IF target.status <> 'running' THEN RAISE EXCEPTION 'transition_unavailable'; END IF;
  UPDATE public.support_centre_cases SET status=terminal,completed_at=clock_timestamp() WHERE id=p_case;
  INSERT INTO public.support_centre_events(workspace_id,case_id,event,actor_user_id) VALUES(p_workspace,p_case,terminal,p_actor);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.support_centre_report(uuid,uuid,text,text), public.support_centre_decide(uuid,uuid,uuid,text), public.support_centre_finish(uuid,uuid,uuid,boolean), public.support_centre_check(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_centre_report(uuid,uuid,text,text), public.support_centre_decide(uuid,uuid,uuid,text), public.support_centre_finish(uuid,uuid,uuid,boolean), public.support_centre_check(uuid,uuid,uuid) TO service_role;
-- Terminal cases/events: 30 days. Pending cases: 31 days after expiry.
-- Running cases: keep 31 days after expiry for reconciliation, then purge metadata.
-- No legal hold is stored here: sensitive/customer evidence stays in its existing system.
CREATE FUNCTION public.support_centre_purge()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.support_chat_threads WHERE updated_at<clock_timestamp()-interval '30 days';
  DELETE FROM public.support_chat_turns WHERE created_at<clock_timestamp()-interval '30 days';
  DELETE FROM public.support_centre_notifications WHERE created_at<clock_timestamp()-interval '30 days';
  DELETE FROM public.support_centre_cases WHERE
    (completed_at IS NOT NULL AND completed_at < clock_timestamp() - interval '30 days') OR
    (status IN ('pending','running') AND expires_at < clock_timestamp() - interval '31 days');
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.support_centre_purge() FROM PUBLIC, anon, authenticated, service_role;
-- No scheduler or EXECUTE grant is installed. Activation requires an approved
-- maintenance operator, run evidence and monitoring of the retention SLA.
-- Dedicated coarse Owner inbox; no customer messages, IPs or raw provider errors.
CREATE TABLE public.support_centre_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
 code text NOT NULL CHECK(code IN ('approval_required','repair_failed','audit_incomplete','security_boundary','diagnostics_unavailable','handoff_required')),
 reference_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 acknowledged_at timestamptz, acknowledged_by uuid, occurrences integer NOT NULL DEFAULT 1,
 UNIQUE NULLS NOT DISTINCT(workspace_id,code,reference_id)
);
ALTER TABLE public.support_centre_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_centre_notifications FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.support_centre_notify(p_workspace uuid,p_code text,p_reference uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.support_centre_notifications(workspace_id,code,reference_id) VALUES(p_workspace,p_code,p_reference)
 ON CONFLICT(workspace_id,code,reference_id) DO UPDATE SET acknowledged_at=NULL,acknowledged_by=NULL,created_at=clock_timestamp(),occurrences=least(public.support_centre_notifications.occurrences+1,100000);
 RETURN true;
END $$;
CREATE FUNCTION public.support_centre_inbox(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) THEN RAISE EXCEPTION 'owner_required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM (SELECT id,workspace_id,code,reference_id,created_at,acknowledged_at,occurrences FROM public.support_centre_notifications WHERE acknowledged_at IS NULL ORDER BY (code IN ('repair_failed','audit_incomplete','security_boundary','diagnostics_unavailable')) DESC,created_at DESC LIMIT 100) n),'[]'::jsonb);
END $$;
CREATE FUNCTION public.support_centre_ack(p_actor uuid,p_notification uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) THEN RAISE EXCEPTION 'owner_required'; END IF;
 UPDATE public.support_centre_notifications SET acknowledged_at=coalesce(acknowledged_at,clock_timestamp()),acknowledged_by=p_actor WHERE id=p_notification;
 RETURN FOUND;
END $$;
-- Automatic repairs only internal support state; never replay a provider operation.
CREATE FUNCTION public.support_centre_recover(p_actor uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate public.support_centre_cases; repaired integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id=p_actor) THEN RAISE EXCEPTION 'owner_required'; END IF;
 FOR candidate IN SELECT * FROM public.support_centre_cases WHERE
  (status='pending' AND expires_at<=clock_timestamp()) OR
  (status='running' AND decided_at<clock_timestamp()-interval '2 minutes') ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  UPDATE public.support_centre_cases SET status=CASE WHEN candidate.status='pending' THEN 'expired' ELSE 'failed' END,completed_at=clock_timestamp() WHERE id=candidate.id;
  INSERT INTO public.support_centre_events(workspace_id,case_id,event,actor_user_id) VALUES(candidate.workspace_id,candidate.id,CASE WHEN candidate.status='pending' THEN 'expired' ELSE 'failed' END,p_actor);
  IF candidate.status='running' THEN PERFORM public.support_centre_notify(candidate.workspace_id,'audit_incomplete',candidate.id); END IF;
  UPDATE public.support_centre_notifications SET acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) WHERE reference_id=candidate.id AND code='approval_required';
  repaired:=repaired+1;
 END LOOP;
 RETURN repaired;
END $$;
CREATE FUNCTION public.support_centre_case_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN PERFORM public.support_centre_notify(NEW.workspace_id,'approval_required',NEW.id);
 ELSIF NEW.status='failed' AND OLD.status IS DISTINCT FROM NEW.status THEN PERFORM public.support_centre_notify(NEW.workspace_id,'repair_failed',NEW.id); END IF;
 IF NEW.status<>'pending' THEN UPDATE public.support_centre_notifications SET acknowledged_at=coalesce(acknowledged_at,clock_timestamp()) WHERE reference_id=NEW.id AND code='approval_required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_centre_case_notification AFTER INSERT OR UPDATE OF status ON public.support_centre_cases FOR EACH ROW EXECUTE FUNCTION public.support_centre_case_notification();

-- Private authenticated support conversation, isolated by verified user + Workspace.
CREATE TABLE public.support_chat_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, handoff_consent boolean NOT NULL DEFAULT false, handoff_until timestamptz, shared_sequence bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(workspace_id,user_id), UNIQUE(id,workspace_id,user_id)
);
CREATE TABLE public.support_chat_turns (
 turn_number bigint GENERATED ALWAYS AS IDENTITY, thread_id uuid NOT NULL, workspace_id uuid NOT NULL,user_id uuid NOT NULL,request_id uuid NOT NULL,
 question text NOT NULL CHECK(char_length(question) BETWEEN 1 AND 1000),answer text NOT NULL CHECK(char_length(answer) BETWEEN 1 AND 2000),
 context text NOT NULL CHECK(context IN ('dashboard','channels','billing','support')),unanswered boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(thread_id,request_id),
 FOREIGN KEY(thread_id,workspace_id,user_id) REFERENCES public.support_chat_threads(id,workspace_id,user_id) ON DELETE CASCADE
);
ALTER TABLE public.support_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_chat_threads,public.support_chat_turns FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.support_chat_turns_turn_number_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.support_chat_read(p_actor uuid,p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT request_id,question,answer,context,unanswered,created_at FROM public.support_chat_turns WHERE user_id=p_actor AND workspace_id=p_workspace AND created_at>clock_timestamp()-interval '30 days' ORDER BY turn_number DESC LIMIT 100)t),'[]'::jsonb);
END $$;
CREATE FUNCTION public.support_chat_send(p_actor uuid,p_workspace uuid,p_request uuid,p_question text,p_answer text,p_context text,p_unanswered boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE thread public.support_chat_threads; turn public.support_chat_turns;
BEGIN
 INSERT INTO public.support_chat_threads(workspace_id,user_id) VALUES(p_workspace,p_actor) ON CONFLICT(workspace_id,user_id) DO NOTHING;
 SELECT * INTO thread FROM public.support_chat_threads WHERE workspace_id=p_workspace AND user_id=p_actor FOR UPDATE;
 SELECT * INTO turn FROM public.support_chat_turns WHERE thread_id=thread.id AND request_id=p_request;
 IF FOUND THEN
  IF turn.question IS DISTINCT FROM p_question OR turn.context IS DISTINCT FROM p_context THEN RAISE EXCEPTION 'request_conflict'; END IF;
  RETURN to_jsonb(turn)-'workspace_id'-'user_id'-'thread_id';
 END IF;
 IF (SELECT count(*) FROM public.support_chat_turns WHERE thread_id=thread.id AND created_at>clock_timestamp()-interval '1 day')>=100 THEN RAISE EXCEPTION 'chat_limit'; END IF;
 INSERT INTO public.support_chat_turns(thread_id,workspace_id,user_id,request_id,question,answer,context,unanswered) VALUES(thread.id,p_workspace,p_actor,p_request,p_question,p_answer,p_context,p_unanswered) RETURNING * INTO turn;
 UPDATE public.support_chat_threads SET updated_at=clock_timestamp() WHERE id=thread.id;
 RETURN to_jsonb(turn)-'workspace_id'-'user_id'-'thread_id';
END $$;
CREATE FUNCTION public.support_chat_handoff(p_actor uuid,p_workspace uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE thread uuid;
BEGIN
 UPDATE public.support_chat_threads SET handoff_consent=true,handoff_until=clock_timestamp(),shared_sequence=(SELECT coalesce(max(turn_number),0) FROM public.support_chat_turns WHERE user_id=p_actor AND workspace_id=p_workspace) WHERE user_id=p_actor AND workspace_id=p_workspace RETURNING id INTO thread;
 IF NOT FOUND THEN RAISE EXCEPTION 'thread_unavailable'; END IF;
 PERFORM public.support_centre_notify(p_workspace,'handoff_required',thread);
 RETURN true;
END $$;
CREATE FUNCTION public.support_chat_review(p_workspace uuid,p_thread uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; boundary bigint:=9223372036854775807;
BEGIN
 SELECT user_id INTO actor FROM public.support_chat_threads WHERE id=p_thread AND workspace_id=p_workspace AND handoff_consent;
 IF NOT FOUND THEN RAISE EXCEPTION 'handoff_consent_required'; END IF;
 IF p_before IS NOT NULL THEN SELECT turn_number INTO boundary FROM public.support_chat_turns WHERE workspace_id=p_workspace AND thread_id=p_thread AND request_id=p_before AND turn_number<=(SELECT shared_sequence FROM public.support_chat_threads WHERE id=p_thread); IF NOT FOUND THEN RAISE EXCEPTION 'cursor_unavailable'; END IF; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT request_id,question,answer,context,unanswered,created_at FROM public.support_chat_turns WHERE user_id=actor AND workspace_id=p_workspace AND thread_id=p_thread AND turn_number<boundary AND turn_number<=(SELECT shared_sequence FROM public.support_chat_threads WHERE id=p_thread) AND created_at>clock_timestamp()-interval '30 days' ORDER BY turn_number DESC LIMIT 100)t),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.support_centre_notify(uuid,text,uuid),public.support_centre_inbox(uuid),public.support_centre_ack(uuid,uuid),public.support_centre_recover(uuid),public.support_centre_case_notification(),public.support_chat_read(uuid,uuid),public.support_chat_send(uuid,uuid,uuid,text,text,text,boolean),public.support_chat_handoff(uuid,uuid),public.support_chat_review(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_centre_notify(uuid,text,uuid),public.support_centre_inbox(uuid),public.support_centre_ack(uuid,uuid),public.support_centre_recover(uuid),public.support_chat_read(uuid,uuid),public.support_chat_send(uuid,uuid,uuid,text,text,text,boolean),public.support_chat_handoff(uuid,uuid),public.support_chat_review(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.support_chat_page(p_actor uuid,p_workspace uuid,p_before uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE boundary bigint;
BEGIN
 SELECT turn_number INTO boundary FROM public.support_chat_turns WHERE user_id=p_actor AND workspace_id=p_workspace AND request_id=p_before;
 IF NOT FOUND THEN RAISE EXCEPTION 'cursor_unavailable'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT request_id,question,answer,context,unanswered,created_at FROM public.support_chat_turns WHERE user_id=p_actor AND workspace_id=p_workspace AND turn_number<boundary AND created_at>clock_timestamp()-interval '30 days' ORDER BY turn_number DESC LIMIT 100)t),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.support_chat_page(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_chat_page(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.support_chat_delete_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.support_centre_notifications WHERE workspace_id=OLD.workspace_id AND reference_id=OLD.id AND code='handoff_required';
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.support_chat_delete_notification() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER support_chat_delete_notification AFTER DELETE ON public.support_chat_threads FOR EACH ROW EXECUTE FUNCTION public.support_chat_delete_notification();
COMMIT;
