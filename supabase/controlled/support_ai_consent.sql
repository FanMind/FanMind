-- Additive, separately approved installation; never run by a normal Web deploy.
BEGIN;
CREATE TABLE public.support_ai_consents (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 granted boolean NOT NULL,
 text_version text NOT NULL CHECK(length(text_version) BETWEEN 1 AND 80),
 granted_at timestamptz,
 revoked_at timestamptz,
 revision bigint NOT NULL CHECK(revision>0),
 request_id uuid NOT NULL UNIQUE,
 CHECK((granted AND granted_at IS NOT NULL AND revoked_at IS NULL) OR (NOT granted AND revoked_at IS NOT NULL))
);
ALTER TABLE public.support_ai_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_ai_consents FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.support_ai_consent_state(p_actor uuid,p_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.support_ai_consents%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'actor_required'; END IF;
 SELECT * INTO r FROM public.support_ai_consents WHERE user_id=p_actor;
 RETURN jsonb_build_object('granted',coalesce(r.granted AND r.text_version=p_version,false),'revision',coalesce(r.revision,0),'version',r.text_version,'grantedAt',r.granted_at,'revokedAt',r.revoked_at);
END;
$$;
CREATE FUNCTION public.support_ai_consent_decide(p_actor uuid,p_version text,p_granted boolean,p_revision bigint,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.support_ai_consents%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR p_granted IS NULL OR p_revision IS NULL OR p_revision<0 OR p_version IS NULL OR length(p_version) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'invalid_decision'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'actor_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('support-ai-consent:'||p_actor::text,1350));
 SELECT * INTO r FROM public.support_ai_consents WHERE user_id=p_actor FOR UPDATE;
 IF r.request_id=p_request THEN
  IF r.granted IS DISTINCT FROM p_granted OR r.text_version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'request_conflict'; END IF;
  RETURN public.support_ai_consent_state(p_actor,p_version);
 END IF;
 IF coalesce(r.revision,0)<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 INSERT INTO public.support_ai_consents(user_id,granted,text_version,granted_at,revoked_at,revision,request_id)
 VALUES(p_actor,p_granted,p_version,CASE WHEN p_granted THEN clock_timestamp() ELSE r.granted_at END,CASE WHEN NOT p_granted THEN clock_timestamp() END,p_revision+1,p_request)
 ON CONFLICT(user_id) DO UPDATE SET granted=EXCLUDED.granted,text_version=EXCLUDED.text_version,granted_at=EXCLUDED.granted_at,revoked_at=EXCLUDED.revoked_at,revision=EXCLUDED.revision,request_id=EXCLUDED.request_id;
 RETURN public.support_ai_consent_state(p_actor,p_version);
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_consent_state(uuid,text),public.support_ai_consent_decide(uuid,text,boolean,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_consent_state(uuid,text),public.support_ai_consent_decide(uuid,text,boolean,bigint,uuid) TO service_role;
COMMIT;
