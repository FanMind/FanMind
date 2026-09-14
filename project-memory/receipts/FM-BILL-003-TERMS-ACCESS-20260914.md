# FM-BILL-003 — Owner-requested payment-terms switch, 2026-09-14

Status: IMPLEMENTED; current-head CI/review and normal rollout pending. Risk: R4 for the requested production release. Existing branch/PR #1123 is reused.
Scope lock: LOCK-FM-BILL-003-TERMS-ACCESS-20260914; holder ChatGPT. The earlier read-only document-access proposal is SUPERSEDED and removed from the final diff.

## Exact current owner instruction
The owner explicitly requested "Zahlungsbedingungen einschalten jetzt", then clarified "du sollst nur den schalter umlegen" and reported Stripe already configured. This resumes the specific switch action and supersedes the older owner deferral for that bounded scope. It does not authorize unrelated Stripe, price, schema, account or contract-text changes. Do not substitute a new read-only link, create another branch, repeat Stripe setup, or ask for the same switch authorization again.

## Preflight and reconciliation
Current main was freshly verified as 4d6d0c4f0ba675f8b7d503ffa831264c54e4b61b, the same immutable revision to which the already-read mandatory Project Memory and canonical readers are bound (project-memory tree 5c4245d5a94eb225ce7ca46a4767c5cc78c087bd). Existing PR #1123 was read at dab3bcd before edits; no merge/deployment had occurred. The actual policy and relevant HTTP/consent/browser tests were read. Prior read-only Production and Stripe observations are retained as dated evidence, not used to invent missing credentials or redo configured providers. A zero Tax-registration list alone is not proof that Stripe as a whole is unconfigured.

## Bounded implementation
The only runtime behavior change is PAYMENT_TERMS_ACTIVATION_ENABLED from false to true, with its comment identifying the explicit owner instruction. Preserve CURRENT_PAYMENT_TERMS_VERSION, the displayed legal document, every recorded consent, all prices and Stripe settings, the existing account/login/setup implementation, Workspace RPC readiness, browser direct-insert denial and server-owned Checkout checks. Remove the earlier extra setup section/test and restore the original setup page and consent-test entry point byte-for-byte. No email callback repair or complete payment acceptance is claimed.

The owner requested the existing configured step, not a new contract revision. This change records an operational owner decision, NOT an external legal/tax review. Historical contract-version concerns and remaining Workspace/Billing rollout evidence are not silently marked accepted or rewritten by this switch. No SQL or provider mutation is performed.

## Verification
Locally executed the exact new policy blob 48106eeb7f92278b132ccb79a064797a2ea80fd2: enabled default, unchanged revision, explicit acceptance, stale-revision rejection, explicit disabled fallback, non-boolean denial, current and pre-window timestamp checks all passed without network or data writes. Existing tests now assert the requested enabled default and retain the disabled negative path, authentication, origin, version and service-owned evidence checks. The public browser expectation changes only the now-absent disabled-step notice; synthetic signup/email/payment guards remain unchanged.

Require green final-head CI, current-head review and normal deployed-release evidence before stating that the switch is live. Do not claim that turning on this step proves the later Workspace or real payment flow.

## Recovery and next step
Revert only this boolean/comment change to disable new activation again; do not delete users or rewrite contracts or Stripe objects. Normal isolated-release rollback remains available. Finish this exact PR/release; preserve the separately reported email-callback defect and the full customer walkthrough as open work. No fresh permission is required for the already requested switch and normal reviewed publication.
