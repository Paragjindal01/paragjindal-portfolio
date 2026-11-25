import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError, boundedJson, object } from './errors.mjs';
import { parseJsonBody } from './json-input.mjs';
import { parse, sha256 } from './store.mjs';

export const WEBHOOK_MAX_BYTES = 64 * 1024;
const WEBHOOK_ID = /^[A-Za-z0-9_-]{24}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const SIGNATURE = /^sha256=([a-f0-9]{64})$/;
const CLOCK_SKEW_SECONDS = 300;
const DUMMY_KEY = Buffer.alloc(32);

function rejectDelivery() {
  throw new ApiError(401, 'webhook_unauthorized', 'Webhook authentication failed.');
}

function webhookRecord(row) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.workflow_version,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    path: '/api/webhooks/' + row.id + '/deliver',
  };
}

export function createWebhookService({ store, clock, queueRun }) {
  const { db } = store;
  const now = () => new Date(clock()).toISOString();

  return {
    registerWebhook(owner, definition) {
      const { workflowId, version } = object(definition, 'Webhook registration');
      if (Object.keys(definition).length !== 2 || typeof workflowId !== 'string' || !KEY.test(workflowId)
          || !Number.isSafeInteger(version) || version < 1) {
        throw new ApiError(400, 'invalid_input', 'Specify a saved workflow ID and its explicit positive version.');
      }
      return store.transaction(() => {
        const createdAt = now();
        const session = db.prepare('SELECT expires_at FROM sessions WHERE id=? AND expires_at>?').get(owner, createdAt);
        if (!session) throw new ApiError(401, 'unauthorized', 'An active session is required to register a webhook.');
        const saved = db.prepare('SELECT definition FROM workflow_versions WHERE owner=? AND id=? AND version=?').get(owner, workflowId, version);
        if (!saved) throw new ApiError(404, 'not_found', 'Workflow version was not found.');
        const workflow = parse(saved.definition);
        if (!workflow.nodes.some((node) => node.type === 'trigger' && node.config?.operation === 'webhook')) {
          throw new ApiError(422, 'invalid_webhook_workflow', 'The saved version must use the webhook trigger.');
        }
        const owned = db.prepare('SELECT COUNT(*) AS count FROM webhooks WHERE owner=?').get(owner).count;
        const registered = db.prepare('SELECT COUNT(*) AS count FROM webhooks').get().count;
        if (owned >= 10 || registered >= 640) {
          throw new ApiError(429, 'webhook_limit', 'This instance or session has reached its webhook registration limit.');
        }
        const id = randomBytes(18).toString('base64url');
        const secret = randomBytes(32);
        db.prepare('INSERT INTO webhooks (id,owner,workflow_id,workflow_version,secret,created_at) VALUES (?,?,?,?,?,?)')
          .run(id, owner, workflowId, version, secret, createdAt);
        return {
          webhook: webhookRecord({ id, workflow_id: workflowId, workflow_version: version, created_at: createdAt, expires_at: session.expires_at }),
          secret: secret.toString('base64url'),
        };
      });
    },
    listWebhooks(owner) {
      return db.prepare(`
        SELECT w.id,w.workflow_id,w.workflow_version,w.created_at,s.expires_at FROM webhooks w
        JOIN sessions s ON s.id=w.owner WHERE w.owner=? AND s.expires_at>? ORDER BY w.created_at,w.id
      `).all(owner, now()).map(webhookRecord);
    },
    revokeWebhook(owner, id) {
      if (!WEBHOOK_ID.test(id) || !db.prepare('DELETE FROM webhooks WHERE id=? AND owner=?').run(id, owner).changes) {
        throw new ApiError(404, 'not_found', 'Webhook was not found.');
      }
    },
    deliverWebhook(id, { timestamp, signature, idempotencyKey, rawBody }, chargeRegistration) {
      const digest = typeof signature === 'string' ? SIGNATURE.exec(signature)?.[1] : null;
      const currentSeconds = Math.floor(clock() / 1000);
      if (!WEBHOOK_ID.test(id) || !digest || typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp)
          || Math.abs(Number(timestamp) - currentSeconds) > CLOCK_SKEW_SECONDS
          || typeof idempotencyKey !== 'string' || !KEY.test(idempotencyKey)) rejectDelivery();
      if (!Buffer.isBuffer(rawBody) || rawBody.length > WEBHOOK_MAX_BYTES) {
        throw new ApiError(413, 'content_limit', 'This delivery exceeds the JSON size limit.');
      }
      const registration = db.prepare(`
        SELECT w.owner,w.workflow_version,w.secret,v.definition FROM webhooks w
        JOIN sessions s ON s.id=w.owner
        JOIN workflow_versions v ON v.owner=w.owner AND v.id=w.workflow_id AND v.version=w.workflow_version
        WHERE w.id=? AND s.expires_at>?
      `).get(id, now());
      const expected = createHmac('sha256', registration?.secret ?? DUMMY_KEY)
        .update('relayops-webhook-v1\n' + id + '\n' + timestamp + '\n' + idempotencyKey + '\n')
        .update(rawBody).digest();
      if (!timingSafeEqual(expected, Buffer.from(digest, 'hex')) || !registration) rejectDelivery();
      chargeRegistration();
      const input = parseJsonBody(rawBody);
      boundedJson(input, 80_000, 'Workflow input');
      // A colon is reserved here because caller-supplied run keys cannot contain it.
      const key = 'webhook:' + sha256(id + '\n' + idempotencyKey);
      return queueRun(registration.owner, {
        definition: parse(registration.definition), version: registration.workflow_version,
        input, mode: 'offline', providerName: 'offline', replayOf: null, webhookId: id,
      }, key, sha256(rawBody));
    },
  };
}
