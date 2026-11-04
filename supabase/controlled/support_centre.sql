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
  DELETE FROM public.support_centre_cases WHERE
    (completed_at IS NOT NULL AND completed_at < clock_timestamp() - interval '30 days') OR
    (status IN ('pending','running') AND expires_at < clock_timestamp() - interval '31 days');
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.support_centre_purge() FROM PUBLIC, anon, authenticated, service_role;
-- No scheduler or EXECUTE grant is installed. Activation requires an approved
-- maintenance operator, run evidence and monitoring of the retention SLA.
COMMIT;
