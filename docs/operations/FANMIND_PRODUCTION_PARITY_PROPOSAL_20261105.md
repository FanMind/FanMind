# Production parity — decision template only

No Production write or deployment is authorized or performed.

## Required Support correction

Production lacks support_repair_audit. Staging has a legacy eleven-column variant
that also lacks required connection binding, partial status, completion guard and
connection history index. The current application sends/filters connection_id;
this is an active repair-audit dependency, not optional schema decoration.

The separate SQL proposal uses the existing twelve-column reviewed application
contract (draft SHA25630e60b111727fb0d806bcc2bdb15fb7292693255c3816ae09a678dbd2d98989b),
an ABSENT-only guard, RLS without browser policies, explicit PUBLIC/anon/
authenticated denial, and only service SELECT/INSERT/UPDATE. It ends in ROLLBACK.
Before any actual install: bind Production identity and approved source; verify
current backup/recovery; hold exclusive operation lease; embed the complete
classifier plus effective-role/grant checks before commit; run rollback-only
repair lifecycle/idempotency/consent/tenant assertions; obtain separate Owner
approval for that exact concrete production payload. No customer/provider call.

Risk: R4 Production schema mutation, short DDL locks and sensitive audit metadata.
No existing rows are imported or changed. New table growth, retention and privacy
operation must be reviewed before actual usage. Before usage, recovery can leave
the empty table and disable runtime. After usage, preserve all rows and forward-fix;
never drop the table as automated rollback. This proposal does not activate repair.

## Workspace differences — retain both protections pending combined design

Production has admin_crm_entitlement_boundary policies and admin-CRM state RPCs.
Staging has member-safe dashboard RPC, owner-only mutation guards, server-owned
Workspace fields and processing boundaries. These protect different consumers and
must not be copied/replaced wholesale. A separate combined rollout must prove
normal Owner writes, Member safe read-only projection, blocked admin-CRM access,
expired/paused Workspace denial and cross-tenant negatives for Web/Mobile.
No Workspace privilege or default-price change is proposed by this task.

## Allowed development differences

The32Staging-only relation families (Capacity-v2 ledgers, Creator/Meta, Mobile,
Website Chat and related gated contracts) remain independent rollout work. Their
presence alone neither proves an active functional gap nor authorizes promotion.
Production-only legacy fields and commercial defaults require individual consumer
review; no copy or deletion is proposed. Identical bucket metadata and Media/Support
core contracts do not establish runtime acceptance.

The deployment delta a798d793..5414f53d contains only operational/test/documentation
changes. Exact deployment-SHA equality alone does not require a Production deploy
for application equivalence. A deploy cannot install missing database objects.
