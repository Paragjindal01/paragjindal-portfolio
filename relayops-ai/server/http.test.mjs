import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { request as rawHttpRequest } from 'node:http';
import { setTimeout as wait } from 'node:timers/promises';
import { createEngine } from './engine.mjs';
import { createHttpServer } from './http.mjs';

const quick = {
  id: 'verified-graph', name: 'Synthetic fixture', nodes: [{ id: 'start', type: 'trigger', label: 'Start', config: {} }],
  edges: [],
};

async function launch(t, options = {}) {
  const engine = createEngine({
    validateWorkflow: (workflow) => ({ ok: workflow.nodes.length === 1, errors: ['Only one test step is accepted.'] }),
    executeNode: async (step, { input }) => ({ output: input }),
    evaluateRun: (run) => ({ completion: run.status === 'completed' ? 1 : 0 }),
    templates: [quick], pollMs: 10,
  });
  const server = createHttpServer({ engine, templates: [quick], ...options });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  t.after(async () => {
    server.disconnectStreams();
    await new Promise((done) => server.close(done));
    await engine.close();
  });
  const url = 'http://127.0.0.1:' + server.address().port;

  async function request(path, { token, body, headers: extra, ...opts } = {}) {
    const headers = { ...extra };
    if (token) headers.authorization = 'Bearer ' + token;
    if (body !== undefined) {
      headers['Content-Type'] ||= 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      opts.method ||= 'POST';
    }
    const response = await fetch(url + path, { ...opts, headers });
    const contentType = response.headers.get('content-type');
    const data = contentType.startsWith('application/json') ? await response.json() : await response.text();
    return { status: response.status, headers: response.headers, data };
  }
  return { request, url };
}

test('JSON API provides versioned execution with session capabilities, audit resume and evaluation', async (t) => {
  const { request } = await launch(t);
  const health = await request('/api/health');
  assert.equal(health.data.persistence, 'sqlite');
  assert.equal(health.data.connected, false);
  assert.equal((await request('/api/templates')).data.templates[0].id, quick.id);
  assert.equal((await request('/api/runs')).status, 401);
  const { data: session } = await request('/api/session', { body: {} });
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  const token = session.token;
  const { data: stranger } = await request('/api/session', { body: {} });
  const invalid = await request('/api/workflows', { token, body: { workflow: { ...quick, nodes: [] } } });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.data.error.code, 'invalid_workflow');
  const create = await request('/api/workflows', { token, body: { workflow: quick } });
  assert.equal(create.status, 201);
  assert.equal(create.data.version, 1);
  assert.equal((await request('/api/workflows/' + quick.id, { token })).data.versions.length, 1);
  const start = await request('/api/runs', { token, body: { workflowId: quick.id, version: 1, input: { objective: 'Preview' } }, headers: { 'Idempotency-Key': 'launch-one' } });
  assert.equal(start.status, 202);
  const runUrl = '/api/runs/' + start.data.run.id;
  let run;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    run = (await request(runUrl, { token })).data.run;
    if (run.status === 'completed') break;
    await wait(10);
  }
  assert.equal(run.status, 'completed');
  assert.deepEqual(run.steps[0].output, { objective: 'Preview' });
  assert.equal((await request(runUrl, { token: stranger.token })).status, 404);
  assert.equal((await request(runUrl + '/replay', { token: stranger.token, body: {} })).status, 404);
  const replay = await request(runUrl + '/replay', { token });
  assert.deepEqual(replay.data.events, run.trace);
  assert.equal(replay.data.schemaVersion, 1);
  const cursor = run.trace.at(-2).sequence;
  assert.deepEqual((await request(runUrl + '/events?after=' + cursor, { token })).data.events, run.trace.slice(-1));
  assert.deepEqual((await request(runUrl + '/evaluation', { token })).data.evaluation, { completion: 1 });
  const stream = await request(runUrl + '/events/stream?after=' + cursor, { token });
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  assert.match(stream.data, /run\.completed/);
  assert.doesNotMatch(stream.data, /step\.completed/);
  const rerun = await request(runUrl + '/replay', { token, body: {} });
  assert.equal(rerun.status, 202);
  assert.equal(rerun.data.run.replayOf, start.data.run.id);
});

test('HTTP rejects cross-origin, rebinding, oversized, polluted and unauthorized payloads', async (t) => {
  const { request, url } = await launch(t);
  assert.equal((await request('/api/session', { body: {}, headers: { origin: 'https://other.example' } })).status, 403);
  const rebinding = await new Promise((resolve, reject) => {
    rawHttpRequest(url + '/api/health', { headers: { Host: 'other.example' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject).end();
  });
  assert.equal(rebinding, 403);
  assert.equal((await request('/api/session', { body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/session', { body: '{"__proto__":{"route":"unsafe"}}' })).status, 400);
  assert.equal((await request('/api/session', { body: { huge: 'x'.repeat(270 * 1024) } })).status, 413);
  assert.equal((await request('/api/session', { body: '[' + '['.repeat(38) + '0' + ']'.repeat(39) })).status, 400);
  const { data: { token } } = await request('/api/session', { body: {} });
  const disabled = await request('/api/runs', { token, body: { templateId: quick.id, mode: 'connected' } });
  assert.equal(disabled.status, 403);
  assert.equal(disabled.data.error.code, 'policy_denied');
  assert.equal((await request('/api/runs?limit=1001', { token })).status, 400);
  assert.equal((await request('/api/runs', { token: '0'.repeat(43) })).status, 401);
});

test('static serving stays within dist and uses non-executable responses outside allowed routes', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'relayops-http-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const directory = join(temporary, 'dist');
  await mkdir(directory);
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>RelayOps</title>');
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets', 'app.js'), 'export const name = "RelayOps";');
  await writeFile(join(temporary, 'outside.js'), 'throw new Error("outside");');
  await symlink(join(temporary, 'outside.js'), join(directory, 'linked.js'));
  const { request } = await launch(t, { directory });
  const root = await request('/');
  assert.equal(root.status, 200);
  assert.match(root.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(root.data, /RelayOps/);
  assert.equal((await request('/relayops/')).data, root.data);
  assert.equal((await request('/relayops')).data, root.data);
  assert.match((await request('/relayops/assets/app.js')).data, /RelayOps/);
  assert.equal((await request('/linked.js')).status, 404);
  assert.equal((await request('/.env')).status, 404);
});
