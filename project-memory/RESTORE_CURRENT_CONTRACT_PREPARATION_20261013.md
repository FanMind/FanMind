# Current restore contract preparation

Owner authorizes controlled Production go-live work subject to existing guards.
PR1316 merged as aae427668ecba0a5ef51bcc58be99291e29032f9 after all12 required
checks and independent R4 countercheck PASS. The production runner is reachable
(protected verify38464119023/1), but its fixed Root controller is absent.
No bootstrap, Worker install, fresh backup, SQL apply or app deployment happened.
The browser credential protection now blocks GitHub Environment administration;
no connector capability exists for Environment-variable writes or dispatch.

Independent backup Guardian found three current-restore consumer gaps: Full
Receipt, aggregate receipt/evidence validators and the shell postcheck still
required12 while the canonical current source produces13. The proposed fix
retains strict fingerprint/role/extension/ownership/ACL binding and supports both
reviewed count shapes. Native PG17 must prove an actual new13 dump/restore into
a fresh CI database before merge; synthetic receipt tests alone are insufficient.

Follow docs/operations/RESTORE_CURRENT_AUTHORIZATION_CONTRACT.md. Historical
33178878764/job98874745740 is consumed. Do not rewrite any legacy receipt,
migration or source catalog to make the count12. Fresh isolated resources and
real restore/cleanup evidence remain required before Production schema/release.

Additional necessary Worker guard correction: claimed jobs were omitted from
both old installation and bootstrap empty-queue probes. The claim RPC actually
uses that status. One shared immutable query now includes queued/claimed/running;
bootstrap must bind the corrected source commit and all affected SHA pins.
The existing unprivileged FanMind session redirects /admin/operations back to
the dashboard, so it is not a demonstrated Platform Admin execution path.
Do not expand its role or infer permission from a successful ordinary login.
