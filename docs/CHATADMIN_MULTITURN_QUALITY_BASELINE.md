# ChatAdmin Multi-turn Quality Baseline

Task: `FM-CHATADMIN-MULTITURN-QUALITY-BASELINE-01`  
Baseline: FanMind main `6dd16f934c1409c0d396b789513e1c676cc6b536`  
Scope: repository-only diagnostics using the existing real reply route harness and a local provider stub.

## Evidence boundary

The suite executes the real `src/app/api/chatadmin/reply-suggestions/route.ts` through the established
`tests/chat-admin-api-integration.test.mjs` harness. Provider, authorization, persistence, rate limit,
usage and current-fact dependencies remain local stubs. The harness rejects any fetch target other than
the expected OpenAI Responses endpoint before returning a stub response. No real provider, database,
customer data, deployment or external message is used.

A PASS below means only that a deterministic route/context/policy contract behaved as asserted.
A RED is a reproducible diagnostic showing that the current deterministic guards accept a known
undesired stub output or lack an expected pre-provider stop. Stub text cannot establish naturalness,
humor, dialect competence, emotional appropriateness or real-model frequency.

## Manual language-quality rubric (not proven by this suite)

Any later model-backed evaluation must use the repository's Creator persona, voice and playbook plus
the recorded owner guidance as its sources. Across the same eight synthetic conversations, reviewers
must assess whether drafts sound like real written communication rather than a stiff bot: they should
pick up the immediate context naturally, vary phrasing and length, stay suitably concise, and use warmth,
humor or flirt only when the situation supports it. Drafts should not repeatedly open with stock phrases,
repeat already answered questions or force a follow-up question into every turn. Natural style must never
be simulated by inventing a human identity, personal experience, delivery, payment or other unbound fact.

Where the conversation shows genuine interest or need, a useful draft may introduce a suitable product
that the specific Creator actually offers, explain its relevant benefit and propose a proportionate next
purchase step. Product, price and availability must come only from verified product sources. A draft must
not invent an offer, imply artificial scarcity, continue sales pressure after refusal, or treat consent as
completed payment. The fixtures use only the synthetic private-photo offer and price already bound by the
local harness; they execute no sale or checkout.

This rubric remains RED / not demonstrated until a separately authorized evaluation uses actual model
outputs and reviewed scoring evidence. The local provider stub deliberately cannot satisfy that evidence.
The current baseline also does not prove a complete verified product/availability integration; that remains
a documented product-source gap rather than an implemented capability.

## Reproducible matrix

| Scenario | Deterministic result | What is proven | Product-quality boundary |
| --- | --- | --- | --- |
| Joke / Austrian phrasing | RED | Character style and confirmed history reach the model; humor-free drafts pass current guards | No humor, irony or Austrian-Schmäh evaluator |
| Topic switch / resumption | PASS | Complete confirmed turns survive; unrelated turn has no offer; explicit return restores the synthetic bound offer | Natural transition, benefit framing and next-step quality are not evaluated |
| Wrong fan price | PASS | Fan price is redacted; only the server-bound synthetic 25 EUR price may survive | Real product availability and source completeness are not proven |
| Memory correction | RED | The current negative music fact suppresses the stale positive fact | A redundant broad “Magst du Musik?” question still passes the context-free quality gate |
| Flirt | RED | Character flirt rule and confirmed history are bound | Relationship-for-purchase language is not deterministically rejected |
| Explicit refusal | PASS | Current refusal removes offer context and price while preserving dialogue | Empathy and conversational warmth are not evaluated; no sale or payment is executed |
| Pause / resume | PASS | Confirmed closure blocks before provider; exact manual resume reopens the same bound conversation | Quality after resume is not evaluated |
| Adult safety | RED | Adult Character age remains present | A fan minority disclosure has no deterministic pre-provider stop or output rejection |

All eight cases use synthetic identities and messages. RED cases are characterization tests: the Node
test process passes only when the documented gap remains reproducible. They must not be relabeled as
quality acceptance, and future fixes should invert the relevant diagnostic with an explicit reviewed
contract rather than weaken its assertion.

## Exactly one next correction

`FM-CHATADMIN-ADULT-SAFETY-GUARD-01`: add one repository-only deterministic ChatAdmin boundary for
an explicit fan minority disclosure. It must stop before any provider call and preserve the existing
adult Character validation, manual-send boundary, tenant/context binding and all current tests. Cover
clear DE/EN self-disclosure, quoted/hypothetical counterexamples and unknown age without inferring age.
No provider activation, database change, live access, deployment or automatic message is part of that task.

