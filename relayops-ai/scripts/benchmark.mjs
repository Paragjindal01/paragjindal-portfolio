import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { templates } from '../core/index.mjs';

const port = process.env.RELAYOPS_PORT ?? '4174';
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535) throw new Error('Expected a local RelayOps port.');
const url = `http://127.0.0.1:${port}/api`;
const terminal = new Set(['completed', 'failed', 'cancelled']);
let token;
async function request(path, body, headers = {}) {
  const response = await fetch(url + path, {
    method: body ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(9000),
  });
  const value = await response.json();
  assert.ok(response.ok, `${path} returned ${response.status}: ${value.error?.message || ''}`);
  return value;
}
async function settle(runId) {
  const limit = performance.now() + 20_000;
  while (performance.now() < limit) {
    const { run } = await request(`/runs/${runId}`);
    if (terminal.has(run.status) || run.status === 'waiting') return run;
    await pause(55);
  }
  throw new Error('The run did not reach a terminal or approval state within 20 seconds.');
}
const health = await request('/health');
assert.equal(health.persistence, 'sqlite');
({ token } = await request('/session', {}));
const benchmark = [];
for (const [templateId, expected, decision] of [
  ['github-review', 'completed'], ['research-pipeline', 'completed'], ['data-analyst', 'completed'],
  ['incident-investigator', 'completed', 'approve'], ['incident-investigator', 'failed', 'reject'],
]) {
  const template = templates.find(({ id }) => id === templateId);
  const key = randomUUID();
  const body = { templateId, input: template.inputs, mode: 'offline' };
  const started = performance.now();
  const { run: initial } = await request('/runs', body, { 'Idempotency-Key': key });
  const { run: duplicate } = await request('/runs', body, { 'Idempotency-Key': key });
  assert.equal(initial.id, duplicate.id);
  let final = await settle(initial.id);
  if (decision) {
    assert.equal(final.status, 'waiting');
    const pending = final.steps.find(({ status }) => status === 'waiting');
    await request(`/runs/${final.id}/approve`, { stepId: pending.id, decision, note: 'Synthetic benchmark' });
    final = await settle(initial.id);
  }
  assert.equal(final.status, expected);
  const elapsedMs = Math.round(performance.now() - started);
  const { evaluation } = await request(`/runs/${final.id}/evaluation`);
  const trace = await request(`/runs/${final.id}/replay`);
  assert.equal(trace.run.id, final.id);
  assert.ok(trace.events.every((entry, index, list) => index === 0 || entry.sequence > list[index - 1].sequence));
  assert.equal(evaluation.metrics.tokens, 0);
  assert.equal(evaluation.metrics.estimatedCostUsd, 0);
  benchmark.push({ templateId, decision: decision ?? 'none', status: final.status, steps: final.steps.filter(({ status }) => status === 'completed').length,
    events: trace.events.length, evaluation: evaluation.score, elapsedMs });
}
console.log(JSON.stringify({ environment: process.version, persistence: 'sqlite', benchmark }, null, 2));
