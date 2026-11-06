# FM-REG-003 Admin-CRM Production Apply — 2026-09-19

- Task/change: FM-REG-003 / FM-CR-041
- Risk: R4
- Status: PRODUCTION_CONFIRMED for the exact database rollout; whole FM-REG-003 remains IN_PROGRESS because FM-CR-043 and synthetic lifecycle acceptance are open.
- Owner authorization: explicit chat instruction on 2026-09-19: “Production-DB-Rollout für Admin-CRM freigegeben”.
- Bound Web release: `630aef3ccb53fed9b46284cb1d4bf1825a57687e`; normal Production deploy run `35431328695` PASS with `/api/version` and `/api/health` smoke and exact release switch.
- Exact Production target: Supabase project `FanMind`, ref `drqkpdvtbbrrdwmtrodz`, ACTIVE_HEALTHY, PostgreSQL 17, eu-west-3.
- Exact migration: `supabase/migrations/20260915221500_admin_crm_access.sql`.
- Pinned SHA-256: `7d1201fc5b45b571d2944b301eb1f5f197ea4f25ad643c8e8010d9d0ba3c1efd`.
- Preflight: `admin_crm_read_allowed(uuid)`, `current_admin_crm_access_state()` and `admin_set_registered_user_crm_access(uuid,uuid,text,text,timestamptz)` were all absent; no partial prior state.
- Apply: exact migration applied once through the authenticated Supabase migration action as `20260919081945 admin_crm_access`; no generic `supabase db push`.
- Independent postflight: all three functions present; mutation RPC denied to `anon` and `authenticated`, allowed to `service_role`; 19 restrictive `admin_crm_entitlement_boundary` policies present including `workspaces`. Production Creator Foundation functions were absent, so the optional Creator runtime cross-order regression was not applicable on this target.
- Security advisor follow-up: known service-only RLS INFO findings plus two intentional authenticated SECURITY DEFINER read/state RPC warnings; no browser exposure of the Admin mutation RPC.
- Mutation boundary: no Stripe, Tax, Checkout, payment, Social-provider, Mobile or unrelated user mutation was included in the database apply.
- Recovery: this schema boundary is forward-managed. Do not blindly roll back or drop functions/policies on a live Workspace. Any correction requires a separately reviewed, target-bound migration and fresh authorization; existing Workspace/customer data is preserved.
- Sequencing deviation: the runbook required a synthetic confirmed noncustomer lifecycle before the first real grant. The first real permanent grant occurred before that acceptance was recorded. Preserve the real Workspace, do not regrant/delete it, and do not perform any further real Admin-CRM grants until the synthetic permanent -> future temporary -> blocked -> login/direct authenticated-read lifecycle is accepted.
- Evidence anchors: PR #1134 final merge, deploy `35431328695`, Supabase migration list, read-only postflight/advisor reads, and PR #1134 rollout receipt comment `5740447035`.
