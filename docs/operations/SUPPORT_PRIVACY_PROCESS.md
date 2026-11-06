# Support subject-access and deletion operating procedure — #1350

Source preparation, not legal certification or activation approval. Existing
FanMind account/workspace export and deletion workflows remain authoritative for
whole-account requests; this addition covers the separately stored own Support
conversation. No rights to a colleague's or foreign Workspace's conversations are
created. Do not advertise a completed whole-account erasure from this narrow button.

## Self-service boundary

The authenticated help panel offers current retained Support data as JSON and an
explicit own-history deletion. Every endpoint re-verifies login and the current
Workspace server-side. A scope token binds the selected UI identity. Export fetch
must still match that identity/generation before downloading. No browser database
role receives table/sequence access or privileged function EXECUTE.

Export includes own question, answer, context, unanswered flag, request UUID and
creation time. Pagination fails closed on invalid/repeated cursor, storage failure
or safety limit; it describes retained data read across pages, not an atomic
point-in-time snapshot. Existing rate limits remain. Identity changes invalidate
pending content and late downloads; export never accepts actor/Workspace selectors.

Erasure requires same Origin, fresh verified identity, exact scope, explicit
confirmation and the approved own thread/sequence snapshot. A row lock and a
second current-turn check prevent deleting newer turns. Replays cannot delete a
recreated thread. Thread removal physically cascades its turns and consent, and
removes its handoff notice. Pending unsent/retry text is cleared immediately.
Failure is visible and never reported as confirmed deletion. An API success is
only after a fresh empty own-history check; concurrent new data yields conflict.

## Full request intake and secure fulfillment

1. Accept existing authenticated account requests or the contact address already
   published in `/datenschutz`. Record a restricted opaque request ID, type,
   received time, verified actor/Workspace, scope, responsible operator and due
   date under the existing privacy procedure. Do not copy chat text into GitHub.
2. Verify the requester through the existing signed-in account or existing identity
   recovery process; an email assertion, Workspace Owner claim or guessed UUID is
   insufficient. Do not seek unnecessary identity documents in Support chat.
3. Distinguish own Support data from customer-as-controller Workspace records,
   account/workspace export, technical cases/audit, provider records and backups.
   Route non-self-service records through the existing authorized privacy operator.
   No global direct SQL export, new IAM role or undocumented customer-content repair.
4. Use the own-scope export only for that authenticated actor; use existing separately
   authorized account tools for other scope. Deliver via existing secure channel,
   never a public GitHub artifact. The Support endpoint is not a full Art15 report.
5. For deletion/widrawal, require explicit scope, apply only approved tools, verify
   raw own rows/consent/notice removal and foreign preservation in the authorized
   environment. Any legal hold/other scope is handled by the established operator;
   never silently say the whole account or every backup is deleted.
6. Record outcome, completion time, applicable retention/backup limit, secure
   delivery and follow-up without retaining unnecessary exported content. Failed
   requests remain open and are retried after diagnosis with identity revalidation.
   Close only when the requested scope is verified, or document the specific limit.

## Preactivation evidence still required

Confirm the responsible privacy operator and full-request register/secure-delivery
route. Update approved processing/privacy information for actual Support storage,
purposes and lawful basis, recipients/processors,30/31/90day operational rules,
consent and rights paths. Confirm account-specific processor/transfer and backup
handling through the existing evidence register; repository source is insufficient.
No new provider call or email-delivery infrastructure is introduced by this change.
Independent privacy approval must review actual Staging own-data export, isolation,
physical deletion/consent and monitored daily cleanup before runtime acceptance.
