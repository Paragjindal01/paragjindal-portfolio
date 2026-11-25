import { evaluateRun, executeNode, templates, validateWorkflow } from '../../core/index.mjs';

const STORAGE_KEY = 'relayops-local-v1';
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'skipped']);
const MAX_RUNS = 30;
const MAX_PARALLEL = 3;
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const clock = () => new Date().toISOString();

function startingState(storage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    return { runs: Array.isArray(value.runs) ? value.runs : [], versions: Array.isArray(value.versions) ? value.versions : [] };
  } catch {
    return { runs: [], versions: [] };
  }
}

function record(run, type, stepId, data = {}) {
  const event = { sequence: run.trace.length + 1, at: clock(), type, stepId, data };
  run.trace.push(event);
}

function activeEdge(edge, predecessor) {
  if (predecessor.status !== 'completed') return false;
  return edge.when == null || predecessor.output?.passed === (String(edge.when) === 'true');
}

function dependencyOutputs(run, id) {
  const byId = new Map(run.steps.map((step) => [step.id, step]));
  const collected = new Set();
  const pending = [id];
  while (pending.length) {
    const target = pending.pop();
    for (const edge of run.workflow.edges) {
      if (edge.target !== target || collected.has(edge.source) || !activeEdge(edge, byId.get(edge.source))) continue;
      collected.add(edge.source);
      pending.push(edge.source);
    }
  }
  return Object.fromEntries(run.steps.filter((step) => collected.has(step.id)).map((step) => [step.id, step.output]));
}

function friendlyError(error) {
  return String(error?.message || 'Step failed.').slice(0, 320);
}

export function createBrowserEngine(suppliedStorage) {
  let storage;
  try { storage = suppliedStorage ?? globalThis.localStorage; } catch { /* Current tab only. */ }
  const state = startingState(storage);
  const working = new Map();
  let storageWarning = storage ? '' : 'Browser storage is unavailable. Changes will last only while this tab is open.';

  function persist() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      storageWarning = 'Browser storage is unavailable or full. Changes will last only while this tab is open.';
    }
  }

  function byId(id) {
    const run = state.runs.find((item) => item.id === id);
    if (!run) throw new Error('Execution unavailable in this browser.');
    return run;
  }

  function finish(run, status) {
    run.status = status;
    run.finishedAt = clock();
    for (const step of run.steps) {
      if (!TERMINAL.has(step.status)) {
        step.status = status === 'cancelled' ? 'cancelled' : 'skipped';
        step.finishedAt = clock();
        record(run, `step.${step.status}`, step.id);
      }
    }
    record(run, `run.${status}`, null);
    persist();
  }

  async function runStep(run, step, node, signal) {
    if (node.type === 'approval') {
      step.status = 'waiting';
      step.startedAt = clock();
      step.attempt = 1;
      record(run, 'approval.requested', step.id, { label: step.label });
      persist();
      return;
    }
    const retries = Number.isInteger(node.config?.maxRetries) ? Math.max(0, Math.min(3, node.config.maxRetries)) : 0;
    const timeoutMs = Number.isInteger(node.config?.timeoutMs) ? Math.min(10_000, Math.max(100, node.config.timeoutMs)) : 8000;
    const results = dependencyOutputs(run, step.id);
    const previousAttempts = step.attempt;
    for (let attempt = previousAttempts + 1; attempt <= previousAttempts + retries + 1; attempt += 1) {
      if (signal.aborted) return;
      step.status = 'running';
      step.attempt = attempt;
      step.startedAt = clock();
      record(run, 'step.started', step.id, { attempt });
      persist();
      await sleep(140);
      if (signal.aborted) return;
      const stepSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
      let onAbort;
      try {
        const abort = new Promise((_, reject) => {
          onAbort = () => reject(stepSignal.reason);
          stepSignal.addEventListener('abort', onAbort, { once: true });
        });
        const value = await Promise.race([executeNode(node, { input: run.input, results, signal: stepSignal, mode: 'offline' }), abort]);
        if (signal.aborted) return;
        step.status = 'completed';
        step.finishedAt = clock();
        step.output = value.output;
        step.usage = value.usage;
        step.artifacts = value.artifacts;
        step.error = null;
        record(run, 'step.completed', step.id, { attempt, ...(step.usage ? { usage: step.usage } : {}) });
        persist();
        return;
      } catch (error) {
        if (signal.aborted) return;
        step.error = friendlyError(error);
        step.finishedAt = clock();
        const retry = attempt < previousAttempts + retries + 1;
        step.status = retry ? 'queued' : 'failed';
        record(run, retry ? 'step.retry' : 'step.failed', step.id, { attempt, error: step.error });
        persist();
        if (!retry) return;
        await sleep(240 * (attempt - previousAttempts));
      } finally {
        if (onAbort) stepSignal.removeEventListener('abort', onAbort);
      }
    }
  }

  function start(run) {
    if (working.has(run.id) || TERMINAL.has(run.status)) return;
    const controller = new AbortController();
    working.set(run.id, controller);
    void (async () => {
      run.status = 'running';
      run.startedAt ||= clock();
      record(run, 'run.running', null);
      persist();
      const incoming = (id) => run.workflow.edges.filter((edge) => edge.target === id);
      const steps = new Map(run.steps.map((step) => [step.id, step]));
      const nodes = new Map(run.workflow.nodes.map((node) => [node.id, node]));
      while (!controller.signal.aborted) {
        if (run.steps.some((step) => step.status === 'failed')) return finish(run, 'failed');
        const ready = [];
        let skipped = false;
        for (const step of run.steps.filter((value) => value.status === 'queued')) {
          const edges = incoming(step.id);
          if (!edges.every((edge) => TERMINAL.has(steps.get(edge.source).status))) continue;
          if (edges.length && !edges.some((edge) => activeEdge(edge, steps.get(edge.source)))) {
            step.status = 'skipped';
            step.finishedAt = clock();
            record(run, 'step.skipped', step.id);
            skipped = true;
          } else {
            ready.push(step);
          }
        }
        if (ready.length) {
          await Promise.all(ready.slice(0, MAX_PARALLEL).map((step) => runStep(run, step, nodes.get(step.id), controller.signal)));
          continue;
        }
        if (skipped) continue;
        if (run.steps.some((step) => step.status === 'waiting')) {
          run.status = 'waiting';
          record(run, 'run.waiting', null);
          persist();
          return;
        }
        return finish(run, run.steps.every((step) => TERMINAL.has(step.status)) ? 'completed' : 'failed');
      }
    })().catch((error) => {
      record(run, 'run.error', null, { error: friendlyError(error) });
      finish(run, 'failed');
    }).finally(() => working.delete(run.id));
  }

  function createRun({ workflow, input, version, replayOf = null }) {
    const validation = validateWorkflow(workflow);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    const active = state.runs.filter((run) => !TERMINAL.has(run.status));
    if (active.length >= 4) throw new Error('Finish or cancel an active run before starting another.');
    const run = {
      id: crypto.randomUUID(), workflow: structuredClone(workflow), workflowId: workflow.id,
      workflowName: workflow.name, input: structuredClone(input), version: version || null,
      replayOf, mode: 'offline', provider: 'offline', status: 'queued',
      createdAt: clock(), startedAt: null, finishedAt: null, trace: [],
      steps: workflow.nodes.map((node) => ({ id: node.id, type: node.type, label: node.label, status: 'queued', attempt: 0 })),
    };
    record(run, 'run.queued', null);
    state.runs = [run, ...active, ...state.runs.filter((item) => TERMINAL.has(item.status))].slice(0, MAX_RUNS);
    persist();
    setTimeout(() => start(run), 25);
    return structuredClone(run);
  }

  for (const run of state.runs) {
    if (run.status === 'queued' || run.status === 'running') {
      for (const step of run.steps) {
        if (step.status === 'running') step.status = 'queued';
      }
      record(run, 'run.recovered', null, { reason: 'Browser session resumed' });
      setTimeout(() => start(run), 100);
    }
  }

  return {
    mode: 'offline',
    warning: () => storageWarning,
    async health() { return { ok: true, persistence: 'browser', providers: ['offline'] }; },
    async workflows() {
      return structuredClone(state.versions.filter((item, index, list) => list.findIndex((row) => row.workflow.id === item.workflow.id) === index));
    },
    async versions(id) { return structuredClone(state.versions.filter((item) => item.workflow.id === id)); },
    async save(workflow) {
      const validation = validateWorkflow(workflow);
      if (!validation.ok) throw new Error(validation.errors.join(' '));
      const last = state.versions.find((item) => item.workflow.id === workflow.id);
      const saved = { workflow: structuredClone(workflow), version: (last?.version || 0) + 1, createdAt: clock() };
      state.versions = [saved, ...state.versions].slice(0, 120);
      persist();
      return structuredClone(saved);
    },
    async runs() { return structuredClone(state.runs.map(({ id, workflowId, workflowName, status, version, mode, createdAt, startedAt, finishedAt, replayOf }) => ({ id, workflowId, workflowName, status, version, mode, createdAt, startedAt, finishedAt, replayOf }))); },
    async run(id) { return structuredClone(byId(id)); },
    async launch({ workflow, workflowId, templateId, version, input }) {
      const saved = state.versions.find((item) => item.workflow.id === workflowId && (!version || version === item.version));
      const value = workflow || saved?.workflow || templates.find((item) => item.id === templateId);
      return createRun({ workflow: value, input, version: saved?.version });
    },
    async approve(id, { stepId, decision, note = '' }) {
      const run = byId(id);
      const step = run.steps.find((item) => item.id === stepId);
      if (run.status !== 'waiting' || step?.status !== 'waiting' || !['approve', 'reject'].includes(decision)) throw new Error('Approval no longer pending.');
      record(run, `approval.${decision === 'approve' ? 'approved' : 'rejected'}`, stepId, { note: String(note).slice(0, 400) });
      step.status = decision === 'approve' ? 'completed' : 'failed';
      step.finishedAt = clock();
      step.output = { decision, approved: decision === 'approve' };
      if (decision === 'reject') {
        step.error = 'Operator rejected the simulated action.';
        finish(run, 'failed');
      } else if (run.steps.some((item) => item.status === 'waiting')) {
        persist();
      } else {
        setTimeout(() => start(run), 25);
      }
      return structuredClone(run);
    },
    async cancel(id) {
      const run = byId(id);
      if (TERMINAL.has(run.status)) return structuredClone(run);
      working.get(id)?.abort();
      finish(run, 'cancelled');
      return structuredClone(run);
    },
    async replay(id) {
      const run = byId(id);
      return createRun({ workflow: run.workflow, input: run.input, version: run.version, replayOf: run.id });
    },
    async trace(id) {
      const run = structuredClone(byId(id));
      return { schemaVersion: 1, run, events: run.trace };
    },
    async evaluate(id) { return evaluateRun(byId(id)); },
  };
}
