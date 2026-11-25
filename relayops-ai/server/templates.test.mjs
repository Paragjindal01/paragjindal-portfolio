import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { evaluateRun, executeNode, templates, validateWorkflow } from '../core/index.mjs';
import { createEngine } from './engine.mjs';

function outputs(run) {
  return run.steps.map(({ id, status, output, artifacts }) => ({ id, status, output, artifacts }));
}

async function waitUntil(engine, owner, id, statuses) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = engine.detail(owner, id);
    if (statuses.includes(run.status)) return run;
    await wait(10);
  }
  assert.fail('Execution did not reach ' + statuses.join(', '));
}

test('all flagship workflows produce structured outputs and a report through the SQLite queue', async (t) => {
  const engine = createEngine({ executeNode, templates, validateWorkflow, evaluateRun, pollMs: 10 });
  t.after(() => engine.close());
  const owner = engine.ownerFor(engine.createSession().token);
  assert.equal(templates.length, 4);
  for (const template of templates) {
    const { id } = engine.startRun(owner, { templateId: template.id, input: template.inputs });
    let run = await waitUntil(engine, owner, id, ['completed', 'waiting', 'failed']);
    if (template.id === 'incident-investigator') {
      assert.equal(run.status, 'waiting');
      assert.equal(run.steps.find((step) => step.id === 'mitigation').status, 'queued');
      engine.review(owner, id, { stepId: 'approval', decision: 'approve', note: 'Verified simulated threshold.' });
      run = await waitUntil(engine, owner, id, ['completed', 'failed']);
      assert.equal(run.steps.find((step) => step.id === 'mitigation').output.event, 'simulated-load-limit-applied');
    }
    assert.equal(run.status, 'completed', template.id + ': ' + (run.error?.message ?? ''));
    assert.ok(run.steps.flatMap((step) => step.artifacts ?? []).some((artifact) => artifact.mimeType === 'text/markdown'));
    const evaluation = engine.evaluate(owner, id);
    assert.equal(evaluation.checks.find((check) => check.id === 'completion').passed, true);

    const replay = engine.replayRun(owner, id);
    assert.equal(replay.replayOf, id);
    let repeated = await waitUntil(engine, owner, replay.id, ['completed', 'waiting', 'failed']);
    if (repeated.status === 'waiting') {
      engine.review(owner, replay.id, { stepId: 'approval', decision: 'approve', note: 'Verified simulated threshold.' });
      repeated = await waitUntil(engine, owner, replay.id, ['completed', 'failed']);
    }
    assert.equal(repeated.status, 'completed');
    assert.deepEqual(outputs(repeated), outputs(run));
  }
});
