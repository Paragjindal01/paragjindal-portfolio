import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';
import { parseJsonBody } from './json-input.mjs';
import { WEBHOOK_MAX_BYTES } from './webhooks.mjs';

const MAX_BODY = 256 * 1024;
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i;
const CSP = "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8',
};

function failure(status, code, message) {
  throw new ApiError(status, code, message);
}

function respond(response, status, value) {
  const text = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

function readBytes(request, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let bytes = 0;
    const detach = () => {
      request.off('data', consume);
      request.off('end', end);
      request.off('error', error);
    };
    function consume(chunk) {
      bytes += chunk.length;
      if (bytes > limit) {
        detach();
        request.resume();
        reject(new ApiError(413, 'content_limit', 'This request exceeds the JSON size limit.'));
      } else chunks.push(chunk);
    }
    function end() {
      detach();
      resolveBody(Buffer.concat(chunks));
    }
    function error(issue) {
      detach();
      reject(issue);
    }
    request.on('data', consume);
    request.on('end', end);
    request.on('error', error);
  });
}

function readJsonBytes(request, limit = MAX_BODY) {
  const contentType = request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') failure(415, 'unsupported_media_type', 'Send an application/json request.');
  const encoding = request.headers['content-encoding'];
  if (encoding && encoding.toLowerCase() !== 'identity') failure(415, 'unsupported_media_type', 'Send uncompressed JSON.');
  if (Number(request.headers['content-length']) > limit) {
    request.resume();
    failure(413, 'content_limit', 'This request exceeds the JSON size limit.');
  }
  return readBytes(request, limit);
}

async function readBody(request) {
  return parseJsonBody(await readJsonBytes(request));
}

function integer(value, defaultValue, min, max) {
  if (value == null) return defaultValue;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
    failure(400, 'invalid_input', 'A numeric query parameter is outside its allowed range.');
  }
  return number;
}

function rateLimiter(clock) {
  const counters = new Map();
  let nextSweep = 0;
  return (key, limit) => {
    const time = clock();
    if (time >= nextSweep) {
      for (const [id, bucket] of counters) if (bucket.expires <= time) counters.delete(id);
      nextSweep = time + 15_000;
    }
    const bucket = counters.get(key);
    if (!bucket || bucket.expires <= time) {
      if (counters.size >= 2048) failure(429, 'rate_limit', 'The request rate limit was reached. Try again soon.');
      counters.set(key, { count: 1, expires: time + 60_000 });
    } else if (++bucket.count > limit) {
      failure(429, 'rate_limit', 'The request rate limit was reached. Try again soon.');
    }
  };
}

async function serveStatic(request, response, pathname, directory) {
  if (!directory || !['GET', 'HEAD'].includes(request.method)) return false;
  if (pathname === '/relayops') {
    response.writeHead(308, { Location: '/relayops/' });
    response.end();
    return true;
  }
  const localPath = pathname.startsWith('/relayops/') ? pathname.slice('/relayops'.length) : pathname;
  const asset = localPath === '/' || localPath === '/index.html' ? 'index.html' : localPath.slice(1);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]*$/.test(asset) || asset.split('/').some((part) => part.startsWith('.'))) return false;
  const extension = extname(asset);
  if (!Object.hasOwn(MIME, extension)) return false;
  if (extension === '.json' && !asset.startsWith('assets/')) return false;
  let base, file, metadata;
  try {
    base = await realpath(directory);
    file = await realpath(resolve(base, asset));
    if (!file.startsWith(base + sep)) return false;
    metadata = await stat(file);
  } catch (error) {
    if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) return false;
    throw error;
  }
  if (!metadata.isFile() || metadata.size > 8 * 1024 * 1024) return false;
  const headers = {
    'Content-Type': MIME[extension],
    'Content-Length': metadata.size,
    'Cache-Control': asset.startsWith('assets/') ? 'public, max-age=300' : 'no-cache',
  };
  if (extension === '.html') headers['Content-Security-Policy'] = CSP;
  const content = request.method === 'HEAD' ? undefined : await readFile(file);
  response.writeHead(200, headers);
  response.end(content);
  return true;
}

export function createHttpServer({
  engine, templates, providerHealth = () => [], connected = false, directory,
  originAllowlist = [], clock = Date.now, logger = console,
}) {
  const checkRate = rateLimiter(clock);
  const streams = new Set();
  const trustedHosts = new Set(originAllowlist.map((origin) => new URL(origin).host));

  function authenticate(request) {
    const value = request.headers.authorization;
    const token = typeof value === 'string' ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(value)?.[1] : null;
    const owner = engine.ownerFor(token);
    if (!owner) failure(401, 'unauthorized', 'Start or restore a session before using this endpoint.');
    checkRate('owner:' + owner, 360);
    return owner;
  }

  function stream(response, owner, id, cursor) {
    engine.status(owner, id);
    if (streams.size >= 20 || [...streams].filter((entry) => entry.owner === owner).length >= 2) {
      failure(429, 'stream_limit', 'Close another event stream before opening this one.');
    }
    const entry = { owner, response };
    streams.add(entry);
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    });
    response.write(': RelayOps event stream\n\n');
    const started = clock();
    let lastHeartbeat = started;
    const refresh = () => {
      try {
        const items = engine.events(owner, id, cursor, 100);
        for (const item of items) {
          cursor = item.sequence;
          if (!response.write('id: ' + cursor + '\ndata: ' + JSON.stringify(item) + '\n\n')) {
            response.end();
            return;
          }
        }
        if ((items.length < 100 && ['completed', 'failed', 'cancelled'].includes(engine.status(owner, id))) || clock() - started >= 45_000) {
          response.end();
        } else if (clock() - lastHeartbeat >= 10_000) {
          lastHeartbeat = clock();
          response.write(': heartbeat\n\n');
        }
      } catch {
        response.end();
      }
    };
    const timer = setInterval(refresh, 500);
    response.on('close', () => { clearInterval(timer); streams.delete(entry); });
    refresh();
  }

  async function dispatch(request, response) {
    const host = request.headers.host;
    if (!host || (!LOOPBACK_HOST.test(host) && !trustedHosts.has(host))) {
      failure(403, 'host_denied', 'This host is not authorized for RelayOps.');
    }
    const url = new URL(request.url, 'http://relayops.local');
    if (!url.pathname.startsWith('/api/')) {
      if (!(await serveStatic(request, response, url.pathname, directory))) failure(404, 'not_found', 'This route was not found.');
      return;
    }
    const address = request.socket.remoteAddress ?? 'unknown';
    checkRate('peer:' + address, 600);
    const origin = request.headers.origin;
    const sameOrigin = typeof origin === 'string' && typeof host === 'string' && ['http://' + host, 'https://' + host].includes(origin);
    if (origin && !sameOrigin && !originAllowlist.includes(origin)
        && !['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) {
      failure(403, 'origin_denied', 'This origin is not authorized for the RelayOps API.');
    }
    const method = request.method;
    const route = url.pathname.split('/').slice(2);
    const [resource, id, action, extra] = route;
    if (method === 'GET' && resource === 'health' && route.length === 1) {
      const providers = await providerHealth();
      respond(response, 200, { ok: true, persistence: 'sqlite', connected, providers });
      return;
    }
    if (method === 'GET' && resource === 'templates' && route.length === 1) {
      respond(response, 200, { templates });
      return;
    }
    if (method === 'POST' && resource === 'session' && route.length === 1) {
      checkRate('session:' + address, 20);
      await readBody(request);
      respond(response, 201, engine.createSession());
      return;
    }
    if (method === 'POST' && resource === 'webhooks' && route.length === 3 && action === 'deliver') {
      checkRate('webhook-peer:' + address, 60);
      const rawBody = await readJsonBytes(request, WEBHOOK_MAX_BYTES);
      const runId = engine.deliverWebhook(id, {
        timestamp: request.headers['x-relayops-timestamp'],
        signature: request.headers['x-relayops-signature'],
        idempotencyKey: request.headers['idempotency-key'],
        rawBody,
      }, () => checkRate('webhook-registration:' + id, 30));
      respond(response, 202, { runId });
      return;
    }
    const owner = authenticate(request);
    if (resource === 'webhooks') {
      if (route.length === 1 && method === 'GET') {
        respond(response, 200, { webhooks: engine.listWebhooks(owner) });
        return;
      }
      if (route.length === 1 && method === 'POST') {
        respond(response, 201, engine.registerWebhook(owner, await readBody(request)));
        return;
      }
      if (route.length === 2 && method === 'DELETE') {
        engine.revokeWebhook(owner, id);
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
    }
    if (resource === 'workflows') {
      if (route.length === 1) {
        if (method === 'GET') {
          respond(response, 200, { workflows: engine.listWorkflows(owner) });
          return;
        }
        if (method === 'POST') {
          const { workflow } = await readBody(request);
          respond(response, 201, engine.saveWorkflow(owner, workflow));
          return;
        }
      }
      if (route.length === 2 && method === 'GET' && ID.test(id)) {
        respond(response, 200, { versions: engine.versions(owner, id) });
        return;
      }
    }
    if (resource === 'runs') {
      if (route.length === 1) {
        if (method === 'GET') {
          respond(response, 200, { runs: engine.listRuns(owner, integer(url.searchParams.get('limit'), 40, 1, 100)) });
          return;
        }
        if (method === 'POST') {
          const body = await readBody(request);
          respond(response, 202, { run: engine.startRun(owner, body, request.headers['idempotency-key'] ?? null) });
          return;
        }
      }
      if (!ID.test(id)) failure(404, 'not_found', 'Run was not found.');
      if (route.length === 2 && method === 'GET') {
        respond(response, 200, { run: engine.detail(owner, id) });
        return;
      }
      if (method === 'GET' && route.length === 3) {
        if (action === 'events') {
          const after = integer(url.searchParams.get('after'), 0, 0, Number.MAX_SAFE_INTEGER);
          const limit = integer(url.searchParams.get('limit'), 100, 1, 250);
          respond(response, 200, { events: engine.events(owner, id, after, limit) });
          return;
        }
        if (action === 'replay') {
          const run = engine.detail(owner, id);
          respond(response, 200, { run, events: run.trace, schemaVersion: 1 });
          return;
        }
        if (action === 'evaluation') {
          respond(response, 200, { evaluation: engine.evaluate(owner, id) });
          return;
        }
      }
      if (method === 'GET' && route.length === 4 && action === 'events' && extra === 'stream') {
        const after = integer(url.searchParams.get('after') ?? request.headers['last-event-id'], 0, 0, Number.MAX_SAFE_INTEGER);
        stream(response, owner, id, after);
        return;
      }
      if (method === 'POST' && route.length === 3 && ['approve', 'approvals', 'cancel', 'replay'].includes(action)) {
        const body = await readBody(request);
        if (action === 'replay') {
          respond(response, 202, { run: engine.replayRun(owner, id) });
        } else {
          const run = action === 'cancel' ? engine.cancelRun(owner, id) : engine.review(owner, id, body);
          respond(response, 200, { run });
        }
        return;
      }
    }
    failure(404, 'not_found', 'This route was not found.');
  }

  const server = createServer({ requestTimeout: 12_000, headersTimeout: 8000, maxHeaderSize: 8192 }, (request, response) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    dispatch(request, response).catch((error) => {
      if (response.headersSent || response.destroyed) {
        response.end();
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 429) response.setHeader('Retry-After', 60);
        respond(response, error.status, {
          error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
        });
      } else {
        logger.error(JSON.stringify({ event: 'relayops.request_error', requestId, errorType: error.name }));
        respond(response, 500, { error: { code: 'internal_error', message: 'The request could not be processed.' } });
      }
    });
  });
  return Object.assign(server, {
    disconnectStreams() {
      for (const { response } of streams) response.end();
    },
  });
}
