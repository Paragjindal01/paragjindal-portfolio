import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createEngine } from './engine.mjs';

const node = (id, type = 'transform', config = {}) => ({ id, type, label: id, config, x: 0, y: 0 });
const edge = (source, target, when) => ({ source, target, ...(when === undefined ? {} : { when }) });
const graph = (nodes, edges) => ({ id: 'test-graph', name: 'Synthetic workflow', nodes, edges });

function setup(executeNode, options = {}) {
  return createEngine({
    executeNode, validateWorkflow: () => ({ ok: true }), evaluateRun: (run) => ({ completed: run.status === 'completed' }),
    pollMs: 10, ...options,
  });
}

function createOwner(engine) {
  return engine.ownerFor(engine.createSession().token);
}

async function until(engine, owner, id, predicate) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const run = engine.detail(owner, id);
    if (predicate(run)) return run;
    await wait(10);
  }
  assert.fail('Condition not met for run ' + id + ': ' + engine.detail(owner, id).status);
}

test('required approvals gate the selected branch, preserve decisions and isolate runs', async (t) => {
  const called = [];
  const engine = setup(async (step, { input, results }) => {
    called.push(step.id);
    if (step.id === 'trigger') return { output: input };
    if (step.id === 'decision') return { output: { passed: results.trigger.hot } };
    return { output: { applied: results.review?.decision === 'approve' } };
  });
  t.after(() => engine.close());
  const input = { hot: true };
  const workflow = graph([node('trigger', 'trigger'), node('decision', 'condition'), node('review', 'approval'), node('bypass'), node('mitigate')],
    [edge('trigger', 'decision'), edge('decision', 'review', true), edge('decision', 'bypass', false), edge('review', 'mitigate'), edge('bypass', 'mitigate')]);
  const owner = createOwner(engine);
  const stranger = createOwner(engine);
  const request = { workflow, input };
  const started = engine.startRun(owner, request, 'repeatable-request');
  assert.equal(started.status, 'queued');
  assert.equal(engine.startRun(owner, request, 'repeatable-request').id, started.id);
  assert.throws(() => engine.startRun(owner, { workflow, input: { hot: false } }, 'repeatable-request'), { code: 'idempotency_conflict' });
  const waiting = await until(engine, owner, started.id, (run) => run.status === 'waiting');
  assert.deepEqual(called, ['trigger', 'decision']);
  assert.equal(waiting.steps.find((step) => step.id === 'bypass').status, 'skipped');
  assert.equal(waiting.steps.find((step) => step.id === 'review').status, 'waiting');
  assert.throws(() => engine.detail(stranger, started.id), { status: 404 });
  assert.throws(() => engine.review(stranger, started.id, { stepId: 'review', decision: 'approve' }), { status: 404 });
  assert.throws(() => engine.review(owner, started.id, { stepId: 'mitigate', decision: 'approve' }), { code: 'approval_not_pending' });
  engine.review(owner, started.id, { stepId: 'review', decision: 'approve', note: 'Validated synthetic impact.' });
  assert.throws(() => engine.review(owner, started.id, { stepId: 'review', decision: 'approve' }), { code: 'approval_not_pending' });
  const completed = await until(engine, owner, started.id, (run) => run.status === 'completed');
  assert.deepEqual(completed.steps.at(-1).output, { applied: true });
  assert.equal(completed.trace.find((event) => event.type === 'approval.approved').data.note, 'Validated synthetic impact.');
  assert.deepEqual(engine.evaluate(owner, started.id), { completed: true });
  const replay = engine.replayRun(owner, started.id);
  assert.equal(replay.replayOf, started.id);
  await until(engine, owner, replay.id, (run) => run.status === 'waiting');
  engine.review(owner, replay.id, { stepId: 'review', decision: 'reject' });
  assert.equal(engine.detail(owner, replay.id).status, 'failed');
  assert.equal(engine.detail(owner, replay.id).steps.at(-1).status, 'cancelled');
  assert.equal(engine.detail(owner, started.id).status, 'completed');
});

test('independent nodes overlap and their join receives both outputs', async (t) => {
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const busy = new Set();
  const engine = setup(async (step, { results }) => {
    if (step.id === 'join') return { output: [results.left, results.right] };
    if (step.id === 'root') return { output: true };
    busy.add(step.id);
    await barrier;
    return { output: step.id };
  });
  t.after(() => { release(); return engine.close(); });
  const owner = createOwner(engine);
  const workflow = graph([node('root', 'trigger'), node('left'), node('right'), node('join')],
    [edge('root', 'left'), edge('root', 'right'), edge('left', 'join'), edge('right', 'join')]);
  const { id } = engine.startRun(owner, { workflow });
  await until(engine, owner, id, () => busy.size === 2);
  assert.deepEqual([...busy], ['left', 'right']);
  release();
  const ended = await until(engine, owner, id, (run) => run.status === 'completed');
  assert.deepEqual(ended.steps.at(-1).output, ['left', 'right']);
});

test('bounded retries, timeout and cancellation preserve failure and abort events', async (t) => {
  let attempts = 0;
  let cancelObserved = false;
  const engine = setup(async (step, { signal }) => {
    if (step.id === 'eventual' && ++attempts === 1) throw new Error('Synthetic temporary failure.');
    if (step.id === 'never' || step.id === 'interrupt') {
      return new Promise((resolve) => signal.addEventListener('abort', () => {
        if (step.id === 'interrupt') cancelObserved = true;
        resolve({ output: null });
      }, { once: true }));
    }
    return { output: { value: 42 } };
  });
  t.after(() => engine.close());
  const owner = createOwner(engine);
  const retried = engine.startRun(owner, { workflow: graph([node('eventual', 'trigger', { maxRetries: 2 })], []) });
  const ended = await until(engine, owner, retried.id, (run) => run.status === 'completed');
  assert.equal(ended.steps[0].attempt, 2);
  assert.ok(ended.trace.some((event) => event.type === 'step.retry_scheduled'));
  const timeout = engine.startRun(owner, { workflow: graph([node('never', 'trigger', { timeoutMs: 24, maxRetries: 0 })], []) });
  const failed = await until(engine, owner, timeout.id, (run) => run.status === 'failed');
  assert.equal(failed.steps[0].error.code, 'step_timeout');
  const cancelled = engine.startRun(owner, { workflow: graph([node('interrupt', 'trigger')], []) });
  await until(engine, owner, cancelled.id, (run) => run.steps[0].status === 'running');
  assert.equal(engine.cancelRun(owner, cancelled.id).status, 'cancelled');
  assert.equal(engine.cancelRun(owner, cancelled.id).steps[0].status, 'cancelled');
  assert.equal(cancelObserved, true);
});

test('restart recovers only interrupted work and preserves persisted versions and session isolation', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'relayops-recovery-'));
  const options = { path: join(directory, 'relayops.sqlite') };
  let engine = setup(async (step) => step.id === 'later' ? new Promise(() => {}) : { output: 'retained' }, options);
  t.after(async () => { await engine.close(); await rm(directory, { recursive: true, force: true }); });
  const { token } = engine.createSession();
  const owner = engine.ownerFor(token);
  const definition = graph([node('first', 'trigger'), node('later')], [edge('first', 'later')]);
  const v1 = engine.saveWorkflow(owner, definition);
  const v2 = engine.saveWorkflow(owner, { ...definition, name: 'Edited workflow' });
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);
  assert.equal(engine.saveWorkflow(owner, v2.workflow).version, 2);
  const { id } = engine.startRun(owner, { workflowId: definition.id, version: 1 });
  await until(engine, owner, id, (run) => run.steps[1].status === 'running');
  assert.throws(() => setup(async () => ({ output: null }), options), /Another RelayOps worker/);
  await engine.close();
  const rerunSteps = [];
  engine = setup(async (step, { results }) => {
    rerunSteps.push(step.id);
    return { output: results.first };
  }, options);
  assert.equal(engine.ownerFor(token), owner);
  const run = await until(engine, owner, id, (current) => current.status === 'completed');
  assert.deepEqual(rerunSteps, ['later']);
  assert.deepEqual(run.steps.map((step) => step.output), ['retained', 'retained']);
  assert.equal(run.version, 1);
  assert.equal(run.workflowName, definition.name);
  assert.equal(run.steps[1].attempt, 2);
  assert.ok(run.trace.some((event) => event.type === 'run.recovered'));
  assert.equal(engine.listWorkflows(owner)[0].version, 2);
});

test('connected execution requires opt-in and recorded usage above budget halts without retry', async (t) => {
  const handler = async () => ({ output: true, usage: { inputTokens: 6, outputTokens: 5, estimatedCostUsd: 0.01 } });
  const defaultEngine = setup(handler);
  t.after(() => defaultEngine.close());
  const workflow = { ...graph([node('first', 'trigger')], []), budget: { maxTokens: 10 } };
  const owner = createOwner(defaultEngine);
  assert.throws(() => defaultEngine.startRun(owner, { workflow, mode: 'connected' }), { code: 'policy_denied' });
  assert.throws(() => defaultEngine.startRun(owner, { workflow, provider: 'external' }), { code: 'policy_denied' });
  const engine = setup(handler, { allowConnected: true });
  t.after(() => engine.close());
  const local = createOwner(engine);
  const run = engine.startRun(local, { workflow, mode: 'connected' });
  const budgetFailure = await until(engine, local, run.id, (current) => current.status === 'failed');
  assert.equal(budgetFailure.error.code, 'execution_budget_exceeded');
  assert.equal(budgetFailure.steps[0].attempt, 1);
  assert.equal(budgetFailure.steps[0].usage.inputTokens, 6);
});

test('a pending human decision survives restart and remains single use', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'relayops-approval-'));
  const options = { path: join(directory, 'relayops.sqlite') };
  let engine = setup(async () => ({ output: { synthetic: true } }), options);
  t.after(async () => { await engine.close(); await rm(directory, { recursive: true, force: true }); });
  const { token } = engine.createSession();
  const owner = engine.ownerFor(token);
  const workflow = graph([node('trigger', 'trigger'), node('confirm', 'approval'), node('finish')],
    [edge('trigger', 'confirm'), edge('confirm', 'finish')]);
  const { id } = engine.startRun(owner, { workflow });
  const waiting = await until(engine, owner, id, (run) => run.status === 'waiting');
  await engine.close();
  engine = setup(async (step, { results }) => {
    assert.equal(step.id, 'finish');
    return { output: results.confirm };
  }, options);
  assert.equal(engine.ownerFor(token), owner);
  assert.deepEqual(engine.detail(owner, id).trace, waiting.trace);
  engine.review(owner, id, { stepId: 'confirm', decision: 'approve' });
  const finished = await until(engine, owner, id, (run) => run.status === 'completed');
  assert.equal(finished.steps.at(-1).output.approved, true);
  assert.equal(finished.trace.filter((event) => event.type === 'approval.requested').length, 1);
});

test('provider or connector rate-limit signals terminate without engine retries', async (t) => {
  let calls = 0;
  const engine = setup(async () => {
    calls += 1;
    throw Object.assign(new Error('Rate limited.'), { code: 'provider_rate_limited', retryable: false });
  });
  t.after(() => engine.close());
  const owner = createOwner(engine);
  const workflow = graph([node('first', 'trigger', { maxRetries: 3 })], []);
  const { id } = engine.startRun(owner, { workflow });
  const failed = await until(engine, owner, id, (run) => run.status === 'failed');
  assert.equal(calls, 1);
  assert.equal(failed.error.code, 'provider_rate_limited');
  assert.ok(failed.trace.every((event) => event.type !== 'step.retry_scheduled'));
});
