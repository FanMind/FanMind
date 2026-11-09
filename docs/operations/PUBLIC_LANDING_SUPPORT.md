# FanMind landing-page information chat — #1350

Owner direction, 5 November 2026: open the support button inline on the landing
page, without navigation or login, with conversational AI like the supplied
Binance reference. The Owner explicitly approved reuse of the existing OpenAI
credential. No key is created, copied, revealed or changed.

## Public boundary

PublicSupportAssistant is now a first-party React panel, independent of customer
embed installation configuration. The existing customer Website Chat widget,
installation/session/CRM/handoff contracts stay unchanged and separately gated.
There are no anonymous CRM contacts, conversations, Support threads, handoffs,
Auth users or new tables created by the landing information chat.

The public POST /api/public-support requires same-origin mutation trust,
application/json, an explicitly true processing consent, bounded question/history
and the existing server Support enabled switch. It does not require or read a
visitor account. The browser explicitly omits cookies/credentials. Server source
provides only public product guidance; no company prompt, customer context,
diagnostic, private conversation or repair capability is loaded. Missing/ambiguous
operational identity fails closed before calling the provider.

## Conversation and presentation

The right-bottom panel supports minimizing/reopening without losing the visible
conversation, expanded size, keyboard Escape with focus return, Enter to send and
Shift+Enter for a newline. It fits small screens and uses its own scroll area.
New conversation aborts pending work, invalidates late responses and clears the
visible chat, draft and consent. A reload also clears in-memory state.
No localStorage, sessionStorage, database chat persistence or background retry.
The UI displays at most 40 recent messages, sending at most four prior messages.

The first processing consent is unselected. Opening alone performs no AI request.
The disclosure names OpenAI and links to privacy. Provider/storage/network/rate
errors remain explicit and preserve the draft; no fictitious answer or completed
handoff is shown. Account actions remain protected; this chat supplies information.

## Cost, context and output boundaries

- Question at most1000 characters; at most4 history entries, each at most2000,
  total history at most6000; body byte limit32768.
- Existing shared HMAC rate limiter:12/IP per10minutes,200 total/hour and1000
  total/day. Missing rate-limit configuration or RPC failure closes the route.
- Existing configurable FanMind model and OPENAI_API_KEY; Responses API with
  store:false, maximum800 output tokens,20second deadline and request cancellation.
- Canonical bounded reply-context helper is reused; explicit public-only system
  instructions never derive product truth from visitor history. No tools.
- Price/setup/package questions return a deterministic DE/EN answer from the same
  public package and one-time data-package configuration as the landing page.
  Consent, Origin, feature, shared rate limits and operational Owner/workspace
  checks still run first. No provider call or artificial AI usage event is made
  for catalogue answers. Currency-bearing model output is replaced by that same
  canonical answer; visitor prices, discounts and contract claims are never accepted.
  Free registration, pending paid activation, net pricing and unchanged existing
  contracts are stated explicitly. Other unknown facts still fail transparently.
- Existing ai_usage_events logs technical usage/cost without message text under
  the exactly-one bound Support Owner's exactly-one owned workspace. The server
  resolves only user_id and workspace id; clients cannot select either. Existing
  usage metadata retention and monitoring apply, not Support conversation storage.
- Client receives only reply or a fixed error, no credentials/model/Owner identifiers.
  Plain text React rendering; no generated HTML or automatic external send.

## Validation and release

Local policy checks cover consent, oversized input, client-scope rejection and
price output. Existing Website Chat CI owns actual route execution with mocked
provider/operational metadata and negative origin/consent/rate/Owner/provider paths.
Public Browser E2E owns actual built-page anonymous inline interaction, two-turn
context, no navigation, no cookies sent, resize/minimize/Escape, error preservation,
new-conversation clearing, English and mobile. No real API provider in CI.

Production read-only precheck found1 bound Owner and1 owned workspace; no real
IDs or customer contents recorded here. Required exact-head CI, protected merge,
reviewed Production deploy and a final public browser interaction remain separate
from source completion. Actual model answer quality and final Owner acceptance
are not inferred from mocks. No legal certification or general customer-embed
activation is implied.

## Staging continuation — 8 November 2026

The Owner reproduced HTTP 503 on Staging release 204a9835. Anonymous conversation
GET additionally returned 404, which the exact route emits before authentication
only while Support is disabled. Owner binding and exactly one owned workspace
were read-only confirmed; no public-support usage or rate buckets were present.
Health confirms key/rate-limit configuration presence, not a successful provider call.

The existing Staging runtime controller adds verify-support, activate-support and
deactivate-support actions. They retain exact reviewed-main/live-source and target
binding. Activation retains full schema/Owner/retention preflight and byte-exact
rollback. Support-only actions preserve both media flags rather than activating
Admin Chat. verify-support emits only fixed configuration/identity booleans.
No key is created, copied or changed. Production is excluded.

After opt-in the long consent checkbox is hidden. The footer keeps an accessible
Withdraw consent action: it aborts pending work, invalidates late replies, clears
visible history, and disables sending until renewed opt-in. It cannot retract an
already processed provider request. No consent is stored across reloads.
The composer is bounded and scrollable on short screens; the footer wraps.
Actual host-control, deployed release and two real Staging replies remain separate
acceptance evidence; source tests alone do not establish a live repair.

Host readback on d51bc747 confirmed Support=false, Owner/workspace/key/limiter
configuration present. Activation run42497173076 passed the full preflight but
reported rollback_failed within0.44seconds. Independent readback42497360607
confirmed Support=false and the same live release after the failed attempt.
The Type=simple service controller checked HTTPS immediately after restart,
before application readiness; it now waits at most45seconds plus a bounded5second
probe for reachability, including rollback. A wrong release fails immediately;
configuration/flag/source checks are unchanged. Fixed failure-stage codes contain
no stderr, credentials, prompt or user identifiers. Existing restart authority is
checked read-only before any configuration write; no sudo grant is installed.

The subsequent retention dispatch42498764018 returned already_completed, referring
to the existing daily success from d51bc747. It did not execute another purge or
replace that immutable receipt. Activation now binds that exact receipt source
only after proving it is an ancestor of reviewed main and that controlled SQL,
shared retention policy code, retention runner/schema/reference, workflow, certificate
and dependency locks are byte-identical. The full live schema equality,30hour
freshness and latest-success checks remain. Drift, absent source history/files or
an unrelated commit rejects reuse. No second daily success is fabricated.
The workflow invokes node directly. All package manifest fields except unrelated
npm scripts must match structurally; the complete dependency lock stays byte-exact.


## Answer-link explanation — Owner feedback, 9 November 2026

Public explanations of Copy & Open must include the direct reply/original link
between copying and sending: open the saved chat/post/comment destination, paste
and send there manually. The instructions name the link explicitly; the bounded
output guard adds the same approved DE/EN workflow when a model mentions copying
or the original channel but omits the link. It never promises an exact deep link
without a stored valid destination, automatic pasting or automatic sending. The
authenticated Support FAQ reuses that same explanation. Public embedding/customer
company prompts and parallel Facebook integration code remain unchanged.
