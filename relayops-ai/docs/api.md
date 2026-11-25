# RelayOps local API

Default origin `http://127.0.0.1:4174`. Success responses and request bodies are JSON except the optional event stream. The server returns structured `error.code`, `error.message`, and, when present, `error.details`. Each HTTP response includes a request ID.

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

Every route except health, templates, and session creation requires `Authorization: Bearer <token>`. Session tokens expire after seven days. Keep the token out of logs and committed scripts. Creating a run supports an `Idempotency-Key` header. Repeating the same request with the same key returns the original run. Reusing a key with a different request is rejected.

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
