# CORE7/G1 Full-Guarantee Baseline

Status: `NONPRODUCTION_BASELINE / LOCAL_SYNTHETIC_TESTS_ONLY`

This candidate implements the integration boundary requested by CORE7/G1:

- canonical task key and payload digest before work starts;
- atomic acquire/replay/conflict semantics through a claim-store port;
- binding to agent, published version, principal, run, payload, epoch and fence;
- no direct write adapters in the work context;
- live lease/fence validation and per-effect idempotency at the gateway;
- complete execution-identity checks on acquire, replay, effect and completion;
- structured effect receipts bound to the canonical request digest;
- fenced adapter context carrying claim identity, epoch, token and effect digest;
- lease recovery with a higher fence and stale-fence rejection;
- fail-closed behavior on unknown claim state.

Failures before work starts report `workPerformed: 0`; failures after the work
callback begins report `workPerformed: "UNKNOWN"` so an ambiguous outcome is
never rewritten as a no-op.

Only the explicit claim operations `ACQUIRED` and `RECOVERED` can start work.
All other unknown operations fail closed. Dispatcher dependencies are private,
so the work API exposes no direct store or adapter route. The in-memory adapter
holds its serialization lock through asynchronous effect completion; production
adapters must provide the same atomic receipt/fence guarantee at their target.

`classifyRc6AcquireResponse` is a local, unconnected RC6 response boundary.
It validates the acquire response shape and preserves operation status, replay
flag, claim state and fencing data separately. Fresh `ACQUIRED` and `RECOVERED`
responses are classified as structurally valid but do not authorize G1 work;
the required principal, version, run and payload bindings are absent. Receipt
replays of either operation fail closed; `ALREADY_COMPLETED` is not a G1 result
replay because RC6 supplies no work-result binding. Malformed, inconsistent and
unknown responses also fail closed. This classifier is not wired to the
dispatcher or runtime and does not invent any missing binding.

`InMemoryClaimStore` is a deterministic test adapter, not a persistence or
production implementation. The intended durable adapter is the immutable RC6
candidate in FanMind PR #1379 at commit
`f1568c42f3ae08c9014ac659a7030d115b76654e`. No RC6 file is copied or modified
here. The adapter mapping, pre-start trigger, real GitHub/Slack gateways,
published-agent identity source and platform action disabling remain integration
work and require their separate gates.

Run the local checks with:

```bash
npm test
```

These checks do not start PostgreSQL, contact external services, change an agent,
or prove operational exactly-once behavior.
