# ChatAdmin CRM workspace redesign — 2026-09-30

- Scope: user-requested presentation and workflow redesign of `/chatadmin`.
- Change: compact Fan-CRM header; persistent Character navigation; searchable Fan list; selected Fan facts, notes, conversation history, inbound-message composer and reply suggestions in one workspace; Character administration moved into a contextual menu; responsive stacked layout on small screens.
- Data contract: existing Character, Fan, Conversation, Message and reply-suggestion APIs remain unchanged.
- Safety boundary: manual copy/send stays mandatory. No OnlyFans connection, automatic sending, authorization, capability, database schema/RLS, AI provider, Billing or customer-data boundary changed.
- Regression evidence: the real client component has a server-rendered CRM layout contract; existing Character/Fan isolation browser cases remain in the component suite and are intended to run in GitHub CI where Chromium is available.
- Local limitation: the local Playwright Chromium binary is absent, so local browser processes fail before test execution. This is an environment limitation, not browser acceptance evidence.
