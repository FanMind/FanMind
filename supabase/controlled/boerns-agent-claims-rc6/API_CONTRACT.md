# Börns Agent Claims API Contract

Status: `REVIEW_CANDIDATE / PRODUCTION_NOT_AUTHORIZED`  
Task: `BOERNS-CLAIM-SUPABASE-001`  
Revision: 16 / RC6  
Target project reference: `drqkpdvtbbrrdwmtrodz`

## Trust boundary

Agents call a protected server-side API. They never receive a Supabase `service_role`
key, database password, migration credential, or direct table access.

The API validates a short-lived workload token before opening a database transaction:

1. Accept only the configured issuer and algorithm.
2. Validate signature, `iss`, `aud=boerns-claim-api`, `sub`, `exp`, `nbf`, and token
   activation/revocation state.
3. Bind the verified `(iss, sub)` pair to one enabled principal in
   `boerns_agent_claims.principals`.
4. Ignore any agent, holder, role, issuer, or subject supplied in URL or body.
5. Call the private SQL RPC with the server-verified issuer and subject.

The base migration creates a `NOLOGIN` group role named
`boerns_claims_runtime`. It has schema usage and signature-specific `EXECUTE`
only. It has no table DML. A later production gate must create and secure the
actual API login identity, credential, membership, rotation, and revocation
process. The private schema is not added to Supabase's exposed PostgREST schemas.

## Agent endpoints

### Acquire or recover

`POST /claim-api/v1/claims/{task_id}/{step_id}/{revision}:acquire`

Required header: `Idempotency-Key: <uuid>`

Body:

```json
{"lease_seconds":120}
```

The database serializes on the unique task key. An offered task becomes
`CLAIMED`. An expired claim assigned to the same principal is recovered with a
new fencing token. An active claim returns the existing state without minting a
new token. A completed claim remains completed.

### Renew

`POST /claim-api/v1/claims/{claim_id}:renew`

Required header: `Idempotency-Key: <uuid>`

Required header: `If-Match: "<fence_epoch>:<fence_token>"`

Body:

```json
{
  "lease_seconds": 120
}
```

Renewal is accepted only for the current holder, current epoch and token, and an
unexpired lease. Lease duration is constrained to 15 through 900 seconds.

### Finalize

`POST /claim-api/v1/claims/{claim_id}:complete`

The `Idempotency-Key` is also the immutable `completion_id`.

Required header: `If-Match: "<fence_epoch>:<fence_token>"`

```json
{
  "terminal_status": "SUCCEEDED",
  "evidence_ref": "github-comment:6426314827",
  "evidence_sha256": "64-lowercase-hex-characters"
}
```

Allowed terminal states are `SUCCEEDED`, `FAILED`, and `BLOCKED`. Evidence is
optional, but reference and digest must be supplied together. No task payload,
prompt, chat content, secret, token, or unrestricted metadata is accepted.

### Read-back

`GET /claim-api/v1/claims/{claim_id}`

Read-back is available only to the intended/holding principal or a principal
with the coordinator capability. It has no mutation and no idempotency key.
Agent read-back is deliberately closed when `service_enabled=false`, including
during restore quarantine. In that state the API returns
`503 CLAIM_STATUS_UNKNOWN`; only a separately authorized operator may inspect
the private tables. A restored or quarantined row must never be presented to an
agent as authoritative before epoch rotation and postchecks.

## Control-plane operation

`offer` is not an agent endpoint. A separately protected coordinator path may
invoke `boerns_agent_claims.offer` only after the verified principal has
`can_offer=true`. A missing, invalid, expired, disabled, or revoked identity is
an authentication failure (`401`/`BC002`). An authenticated principal without
`can_offer` is a distinct authorization failure (`403`/`BC008`). The base
migration inserts no principals and leaves the whole service disabled.

## Response model

```json
{
  "request_id": "uuid",
  "claim_id": "uuid",
  "claim_key": "task_id:step_id:revision",
  "operation_status": "ACQUIRED",
  "state": "CLAIMED",
  "holder_agent_id": "BT-006",
  "lease_expires_at": "database timestamp",
  "fence_epoch": "uuid",
  "fence_token": 42,
  "replayed": false
}
```

The private SQL response itself carries `replayed=false` on first commit and
`replayed=true` when returning a stored receipt. The adapter must not infer this
flag, expose internal error text, or disclose whether a foreign claim exists.
The adapter echoes the validated `Idempotency-Key` as `request_id`; the SQL
response does not derive identity or idempotency values from an untrusted body.

## Error mapping

| HTTP | API code | DB SQLSTATE | Meaning |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | `BC001` | Schema, length, enum, or lease validation failed. |
| 401 | `INVALID_IDENTITY` | `BC002` | Token or principal is absent, invalid, expired, disabled, or revoked. |
| 403 | `FORBIDDEN` | `BC008` | Identity is authenticated but lacks the required capability. |
| 404 | `CLAIM_NOT_FOUND` | `BC003` | Claim is unknown or not visible to this principal. |
| 409 | `IDEMPOTENCY_KEY_REUSE` | `BC004` | Same key was used with different semantics. |
| 412 | `STALE_FENCE` | `BC005` | Lease, epoch, receipt epoch, or fencing token is stale. |
| 503 | `CLAIM_STATUS_UNKNOWN` | `BC006` | Service, database, or commit state is unclear. |
| 409 | `CLAIM_CONFLICT` | `BC007` | Task key conflicts with an existing offer. |
| 429 | `RATE_LIMITED` | adapter | Per-principal and per-operation quota exceeded. |

On timeout or ambiguous commit, the client must retry the identical request with
the identical idempotency key or perform read-back while the service is healthy.
If the service is quarantined or unavailable, it must stop with
`CLAIM_STATUS_UNKNOWN` and never assume success.

The mapping is closed, not extensible by accident. Every SQLSTATE not listed in
the table, including PostgreSQL ACL errors such as `42501`, and every driver
error, connection loss, transport interruption, timeout, malformed database
response, or missing SQLSTATE MUST map to HTTP `503` with
`CLAIM_STATUS_UNKNOWN`. The adapter MUST NOT expose SQLSTATE, driver text,
stack traces, object names, or whether a mutation committed. It MUST NOT map an
unknown condition to success, `404`, or a retryable authorization result.

## Idempotency and side effects

The receipt key is globally `(verified agent_id, request_id)` across all mutating
operations; a request UUID cannot be reused for another route or operation.
Operation, canonical structured JSONB fingerprint, current system epoch,
mutation, audit event, and response commit atomically. A semantically equivalent
JSON replay returns the stored response with `replayed=true`. Reusing the UUID
with different semantics is rejected. A receipt from an older epoch is rejected
as `STALE_FENCE` after restore rotation.

The claim transaction cannot make Slack or GitHub side effects atomic. Any later
side-effect adapter must either use a transactional outbox or independently
enforce both the idempotency key and the current `(fence_epoch, fence_token)`.

## Production-only prerequisites

- Chosen token issuer, JWKS trust and rotation, audience, lifetimes, revocation,
  and offboarding.
- A dedicated API login credential with controlled membership in the `NOLOGIN`
  runtime role; no inheritance of project-wide roles.
- Principal mappings for the approved pilot agent only, followed by separate
  mappings for the remaining agents.
- Enumeration-resistant error translation, request limits, rate limits, and
  security telemetry without tokens or payloads.
- Independent negative tests for spoofed identities, replay, stale fences,
  disabled principals, missing capabilities, foreign and unknown claim IDs with
  indistinguishable responses, unknown SQLSTATEs, driver/transport failures,
  API/DB outage, and ambiguous commits.

