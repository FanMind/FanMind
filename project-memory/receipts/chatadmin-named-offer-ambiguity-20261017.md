# Named offer ambiguity — source receipt, 2026-10-17

Existing tasks: FM-CREATOR-001 / FM-CHATADMIN-003. Base main:
`1dac77aeb382117397e97b54bdb26dfc38b440b1` (merged #1335).
Separate branch: `fix/chatadmin-ambiguous-offer-request`; independent of #1334.

## Proven defect and bounded correction

With active `Foto` and `Privates Foto`, a request such as
`Was kostet Foto oder Privates Foto?` incorrectly selected the private offer.
The resolver had already matched both names, but its private/category filtering
removed a candidate before deciding ambiguity. Count distinct specific named
active offer IDs before these filters. Multiple IDs retain the existing null
request, empty permitted-offer context and fail-closed price behavior. Contained
generic names and repeated mentions of the same ID remain supported.

No new price policy, API, error code, persistence, migration or provider path.
The shared #1335 monetary guard is unchanged. Workspace/Character scope,
manual sending, selected Character style, sales holds and aftercare are retained.
This is literal named-offer ambiguity handling, not general intent/NLP completion.

## Verification

- Local focused suites: 114/114 passed, zero failures/skips (structured offers,
  actual ChatAdmin route, policy, knowledge and Creator policy/actual route).
- Targeted ESLint, production build/TypeScript and product-truth check passed.
- Memory quality, drift preflight, Memory V8, God Mode preflight, existing
  next-best-action snapshot check and diff whitespace check passed.
- Separate reviewer: source PASS; independently 55/55 directly affected tests
  passed. One in-memory mutation removing the new guard was detected by all
  five new ambiguous-request negative cases. No reviewer checkout mutation.
- Fresh exact-head Required CI and final independent CI confirmation belong in
  the Draft PR metadata; local results do not claim pending CI success.

Recovery is a reviewed source revert, with no target cleanup required. Runtime
quality and protected Staging acceptance remain unproven. No dispatch, target
query, provider call, SQL apply, deployment, activation or merge was performed.
FM-DEC-031 company-dependent work stays open and deferred.

## C — next selected scope, not started

Immediate explicit negation remains separate: with one active Foto offer,
`Ich möchte kein Foto, nur reden.` still resolves that offer. Independently
reproduced on current source. The next bounded conversation-control increment
should handle that scoped current denial without changing persistent confirmed
holds. No C implementation or second task queue is created here.
