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
- No quoted price/discount/contract/limit promises; current public pricing is
  referenced at /#preise. Currency-bearing model output is replaced by the public
  pricing guidance. This is bounded protection, not a semantic model guarantee.
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
