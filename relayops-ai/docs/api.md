# RelayOps local API

Default origin `http://127.0.0.1:4174`. Success responses and request bodies are JSON. The optional event stream uses SSE, and a successful webhook revocation has an empty response. The server returns structured `error.code`, `error.message`, and, when present, `error.details`. Each HTTP response includes a request ID.

| Method and path | Function |
| --- | --- |
| `GET /api/health` | SQLite health, connected-mode flag, and provider health |
| `GET /api/templates` | Built-in workflow definitions and sample inputs |
| `POST /api/session` | Create a scoped session with body `{}` and receive a bearer token |
| `GET /api/workflows` | List latest versions of saved workflows |
| `POST /api/workflows` | Save a new immutable version with `{ "workflow": {…} }` |
| `GET /api/workflows/:id` | List versions |
| `POST /api/runs` | Queue an execution with exactly one workflow selector and optional `input`, `mode`, and `provider` |
| `GET /api/runs` | List the calling session’s execution summaries |
| `GET /api/runs/:id` | Get a run with step outputs, artifacts, and trace |
| `GET /api/runs/:id/events?after=0&limit=100` | Retrieve ordered cursor-based trace events |
| `GET /api/runs/:id/events/stream` | Read authenticated server-sent events with a cursor |
| `POST /api/runs/:id/approve` | Record `{ "stepId": "approval", "decision": "approve", "note": "…" }` or `reject` |
| `POST /api/runs/:id/cancel` | Cancel with body `{}` |
| `GET /api/runs/:id/replay` | Retrieve a read-only versioned trace |
| `POST /api/runs/:id/replay` | Queue a new run from a terminal run’s definition and input |
| `GET /api/runs/:id/evaluation` | Score a recorded execution |
| `GET /api/webhooks` | List active registrations for the calling session |
| `POST /api/webhooks` | Register one immutable saved workflow version |
| `DELETE /api/webhooks/:id` | Revoke a registration owned by the calling session |
| `POST /api/webhooks/:id/deliver` | Verify a signed JSON delivery and queue an offline run |

Health, templates, and session creation are open endpoints. Webhook delivery uses its own signature. All other routes require `Authorization: Bearer <token>`. Session tokens expire after seven days. Keep the token out of logs and committed scripts. Creating a run supports an `Idempotency-Key` header. Repeating the same request with the same key returns the original run. Reusing a key with a different request is rejected.

Example command body for starting a template after fetching its sample input:

```json
{
  "templateId": "research-pipeline",
  "input": { "question": "How do traces and idempotency help durable workflows?" },
  "mode": "offline"
}
```

Use `workflow` for an inline graph or `workflowId` with an optional `version` for a saved graph. A graph specifies nodes, edges, output node IDs, and an optional model usage budget. The submission validates the graph and enforces bounded inputs. Conditional edges consume a previous node’s validated boolean. A waiting approval is always decided via the authorization layer. Re-running a terminal record creates a distinct run with fresh approval requirements.

## Events and limits

Runs include a stable ID, the definition, immutable version where applicable, timestamps, status, steps, and an ordered trace. `waiting` denotes an unreviewed human approval. An event includes a sequence cursor, timestamp, type, optional step ID, and structured event data. Use the JSON event endpoint if your streaming client cannot supply `Authorization` headers.

The HTTP service validates JSON structure, limits a request body to 256 KiB, restricts individual workflow inputs to 80,000 bytes, rate-limits session creation and requests, and bounds execution capacity. Graphs allow up to 32 nodes and 100 edges. The engine enforces a finite lifespan for active runs. Keep the SQLite database and volume local to the service instance.

## Signed inbound webhooks

The local SQLite service accepts signed deliveries for a saved workflow version that uses a trigger node with `config.operation` set to `webhook`. Each registration is bound to one explicit version and one session. Saving another version leaves the registration pinned. The hosted offline demo has no inbound webhook endpoint.

With a session bearer token, send `POST /api/webhooks` with a body such as `{"workflowId":"synthetic-intake","version":1}`. The service returns HTTP 201 and `{ "webhook": { "id", "workflowId", "version", "createdAt", "expiresAt", "path" }, "secret": "…" }`. Store the returned Base64url secret in the sender's secret store. The service returns it only during registration. `GET /api/webhooks` lists metadata for active registrations owned by the calling session. `DELETE /api/webhooks/:id` revokes an owned registration with HTTP 204. Revocation stops new deliveries. Existing runs remain in session history.

### Sign and deliver

Send an uncompressed UTF-8 JSON object to the registration's `path` using `Content-Type: application/json`. The headers must include:

| Header | Format |
| --- | --- |
| `X-RelayOps-Timestamp` | Unix seconds within 300 seconds of the server clock |
| `Idempotency-Key` | 1–80 ASCII letters, digits, hyphens, or underscores, starting with a letter or digit |
| `X-RelayOps-Signature` | `sha256=` followed by the lowercase hexadecimal HMAC-SHA256 digest |

Decode the secret from Base64url and sign the UTF-8 prefix `relayops-webhook-v1\n<id>\n<timestamp>\n<key>\n` followed by the exact bytes transmitted as the body. Each `\n` denotes a single line feed. This local Node example expects registration values supplied to the sender through its environment.

```js
import { createHmac, randomUUID } from 'node:crypto';

const id = process.env.RELAYOPS_WEBHOOK_ID;
const secret = Buffer.from(process.env.RELAYOPS_WEBHOOK_SECRET, 'base64url');
const timestamp = String(Math.floor(Date.now() / 1000));
const key = process.env.RELAYOPS_DELIVERY_KEY ?? randomUUID();
const body = Buffer.from(JSON.stringify({ ticket: 'SYNTH-104', status: 'warning' }), 'utf8');
const signature = createHmac('sha256', secret)
  .update(`relayops-webhook-v1\n${id}\n${timestamp}\n${key}\n`)
  .update(body)
  .digest('hex');

const response = await fetch(`http://127.0.0.1:4174/api/webhooks/${id}/deliver`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-RelayOps-Timestamp': timestamp,
    'Idempotency-Key': key,
    'X-RelayOps-Signature': `sha256=${signature}`,
  },
  body,
});
if (!response.ok) throw new Error(`Webhook delivery failed with HTTP ${response.status}`);
console.log(await response.json());
```

HTTP 202 returns `{"runId":"…"}`. The delivery body becomes workflow input, and execution always uses the pinned version and offline mode. The sender's signing credential authorizes delivery only. The owner uses their session bearer token to inspect the run, trace, or approval. The queued event identifies webhook provenance without storing the signing secret or signature in the run trace.

Retry a delivery using the same key and exact body bytes, and refresh the timestamp and signature when needed. A valid retry for a retained run returns the same run ID. Reusing the same key with different bytes returns HTTP 409. Invalid signatures, stale timestamps, expired sessions, absent registrations, and revoked registrations receive HTTP 401. Deliveries are limited to 64 KiB, 30 signed requests per minute per registration, and 60 delivery attempts per minute per peer. Queue and session quotas also apply. A registration expires with its owner session.

HMAC verification requires access to the signing key, which the local service stores in its private SQLite database. Restrict the database volume and backups to the service owner. This endpoint inherits the service's host and origin rules. Use synthetic or authorized data and use a trusted transport when deploying the local service behind an authorized private proxy.
