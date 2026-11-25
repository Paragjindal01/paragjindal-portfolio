import { randomUUID } from 'node:crypto';
import { ApiError, boundedJson, object } from './errors.mjs';
import { issueSession, json, openStore, parse, sha256 } from './store.mjs';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const RESOLVED = new Set(['completed', 'skipped']);
const MODES = new Set(['offline', 'connected']);
const KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const MAX_STEP_BYTES = 96 * 1024;
const MAX_RUN_BYTES = 512 * 1024;
const MAX_PENDING = 120;
const MAX_RETAINED_RUNS = 1200;
const NAMED_FAILURES = new Set(['provider_rate_limited', 'connector_rate_limited', 'execution_budget_exceeded']);

function readRun(row) {
  return {
    id: row.id, workflowId: row.workflow_id, workflowName: row.workflow_name, version: row.version,
    mode: row.mode, provider: row.provider, status: row.status, replayOf: row.replay_of,
    createdAt: row.created_at, startedAt: row.started_at, finishedAt: row.finished_at, error: parse(row.error),
  };
}

function readStep(row) {
  return {
    id: row.id, type: row.type, label: row.label, status: row.status, attempt: row.attempt,
    startedAt: row.started_at, finishedAt: row.finished_at, output: parse(row.output), error: parse(row.error),
    usage: parse(row.usage), artifacts: parse(row.artifacts),
  };
}

function readEvent(row) {
  return { sequence: row.sequence, at: row.at, type: row.type, stepId: row.step_id, data: parse(row.data) };
}

function versionRecord(row) {
  return { workflow: parse(row.definition), version: row.version, createdAt: row.created_at };
}

function policyFor(node) {
  return {
    maxRetries: node.config?.maxRetries ?? 1,
    timeoutMs: node.config?.timeoutMs ?? 8000,
  };
}

function requestError(error) {
  return {
    code: error instanceof ApiError || NAMED_FAILURES.has(error?.code) ? error.code : 'step_error',
    message: error instanceof Error ? error.message.slice(0, 650) : 'Step processing failed.',
  };
}

function edgeEnabled(edge, source) {
  if (source.status !== 'completed') return false;
  if (edge.when == null) return true;
  return parse(source.output)?.passed === (edge.when === true || edge.when === 'true');
}

function cleanUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const metrics = {};
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'estimatedCostUsd', 'latencyMs']) {
    if (Number.isFinite(usage[key]) && usage[key] >= 0) metrics[key] = usage[key];
  }
  for (const key of ['provider', 'model']) {
    if (typeof usage[key] === 'string' && /^[a-z0-9][a-z0-9._:/@-]{0,120}$/i.test(usage[key])) metrics[key] = usage[key];
  }
  return metrics;
}

function totalUsage(metrics) {
  let tokens = 0;
  let cost = 0;
  for (const item of metrics) {
    if (!item) continue;
    tokens += item.totalTokens ?? ((item.inputTokens ?? 0) + (item.outputTokens ?? 0));
    cost += item.estimatedCostUsd ?? 0;
  }
  return { tokens, cost };
}

export function createEngine({
  path = ':memory:', validateWorkflow, executeNode, evaluateRun, templates = [],
  provider, allowConnected = false, clock = Date.now, maxWorkers = 8, pollMs = 100,
  logger = console,
}) {
  if (!Number.isSafeInteger(maxWorkers) || maxWorkers < 1 || maxWorkers > 24) throw new TypeError('Invalid worker concurrency.');
  const store = openStore(path);
  const { db } = store;
  const templateList = Array.isArray(templates) ? templates : Object.values(templates);
  const jobs = new Map();
  let stopped = false;
  let scheduled = false;
  let lastSweep = 0;
  const now = () => new Date(clock()).toISOString();
  const timeAfter = (ms) => new Date(clock() + ms).toISOString();

  function audit(id, type, stepId = null, data = {}) {
    db.prepare('INSERT INTO events (run_id,at,type,step_id,data) VALUES (?,?,?,?,?)').run(id, now(), type, stepId, json(data));
  }

  function expectWorkflow(definition) {
    object(definition, 'workflow');
    if (typeof definition.id !== 'string' || !KEY.test(definition.id)) throw new ApiError(400, 'invalid_input', 'Workflow ID is invalid.');
    if (typeof definition.name !== 'string' || !definition.name.trim() || definition.name.length > 100) throw new ApiError(400, 'invalid_input', 'Workflow name is invalid.');
    boundedJson(definition, 144 * 1024, 'Workflow definition');
    const validation = validateWorkflow(definition);
    if (!validation.ok) throw new ApiError(422, 'invalid_workflow', 'The workflow could not be validated.', validation.errors.slice(0, 24));
    if (!definition.nodes.length || definition.nodes.length > 32) throw new ApiError(422, 'invalid_workflow', 'Use between 1 and 32 workflow steps.');
    return definition;
  }

  function ownerFor(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return db.prepare('SELECT id FROM sessions WHERE token_hash=? AND expires_at>?').get(sha256(token), now())?.id ?? null;
  }

  function createSession() {
    const count = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE expires_at>?').get(now()).count;
    if (count >= 640) throw new ApiError(429, 'session_limit', 'This instance has reached its active session limit.');
    return issueSession(db, clock());
  }

  function listWorkflows(owner) {
    return db.prepare(`
      SELECT v.* FROM workflow_versions v
      JOIN (
        SELECT id, MAX(version) AS version FROM workflow_versions WHERE owner=? GROUP BY id
      ) latest ON latest.id=v.id AND latest.version=v.version
      WHERE v.owner=? ORDER BY v.created_at DESC LIMIT 100
    `).all(owner, owner).map(versionRecord);
  }

  function versions(owner, workflowId) {
    if (!KEY.test(workflowId)) throw new ApiError(404, 'not_found', 'Workflow was not found.');
    const rows = db.prepare('SELECT * FROM workflow_versions WHERE owner=? AND id=? ORDER BY version DESC').all(owner, workflowId);
    if (!rows.length) throw new ApiError(404, 'not_found', 'Workflow was not found.');
    return rows.map(versionRecord);
  }

  function saveWorkflow(owner, definition) {
    expectWorkflow(definition);
    return store.transaction(() => {
      const existing = db.prepare('SELECT * FROM workflow_versions WHERE owner=? AND id=? ORDER BY version DESC LIMIT 1').get(owner, definition.id);
      if (existing?.definition === json(definition)) return versionRecord(existing);
      const count = db.prepare('SELECT COUNT(*) AS count FROM workflow_versions WHERE owner=?').get(owner).count;
      if (count >= 100) throw new ApiError(429, 'workflow_limit', 'This session has reached its workflow version limit.');
      const version = (existing?.version ?? 0) + 1;
      const createdAt = now();
      db.prepare('INSERT INTO workflow_versions (owner,id,version,definition,created_at) VALUES (?,?,?,?,?)')
        .run(owner, definition.id, version, json(definition), createdAt);
      return { workflow: definition, version, createdAt };
    });
  }

  function ownedRun(owner, id) {
    const row = db.prepare('SELECT * FROM runs WHERE id=? AND owner=?').get(id, owner);
    if (!row) throw new ApiError(404, 'not_found', 'Run was not found.');
    return row;
  }

  function rawSteps(runId) {
    return db.prepare('SELECT * FROM steps WHERE run_id=? ORDER BY row_order').all(runId);
  }

  function events(owner, id, after = 0, limit = 1000) {
    ownedRun(owner, id);
    return db.prepare('SELECT * FROM events WHERE run_id=? AND sequence>? ORDER BY sequence LIMIT ?')
      .all(id, after, limit).map(readEvent);
  }

  function detail(owner, id) {
    const row = ownedRun(owner, id);
    return {
      ...readRun(row), workflow: parse(row.definition), input: parse(row.input),
      steps: rawSteps(id).map(readStep), trace: events(owner, id),
    };
  }

  function listRuns(owner, limit) {
    return db.prepare('SELECT * FROM runs WHERE owner=? ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(owner, limit).map(readRun);
  }

  function queueRun(owner, { definition, version, input, mode, providerName, replayOf }, idempotencyKey, requestHash) {
    const id = randomUUID();
    const createdAt = now();
    const resultingId = store.transaction(() => {
      if (idempotencyKey) {
        const earlier = db.prepare('SELECT id,request_hash FROM runs WHERE owner=? AND idempotency_key=?').get(owner, idempotencyKey);
        if (earlier) {
          if (earlier.request_hash !== requestHash) throw new ApiError(409, 'idempotency_conflict', 'This idempotency key was already used with a different request.');
          return earlier.id;
        }
      }
      const pending = db.prepare("SELECT COUNT(*) AS count FROM runs WHERE status IN ('queued','running','waiting')").get().count;
      const retained = db.prepare('SELECT COUNT(*) AS count FROM runs').get().count;
      const ownPending = db.prepare("SELECT COUNT(*) AS count FROM runs WHERE owner=? AND status IN ('queued','running','waiting')").get(owner).count;
      const ownRetained = db.prepare('SELECT COUNT(*) AS count FROM runs WHERE owner=?').get(owner).count;
      if (pending >= MAX_PENDING || retained >= MAX_RETAINED_RUNS || ownPending >= 10 || ownRetained >= 150) {
        throw new ApiError(429, 'queue_limit', 'The run queue or retained history is at capacity.');
      }
      db.prepare(`
        INSERT INTO runs (id,owner,workflow_id,workflow_name,version,definition,input,mode,provider,status,replay_of,created_at,idempotency_key,request_hash)
        VALUES (?,?,?,?,?,?,?,?,?,'queued',?,?,?,?)
      `).run(id, owner, definition.id, definition.name, version, json(definition), json(input), mode, providerName, replayOf, createdAt, idempotencyKey, requestHash);
      const insert = db.prepare("INSERT INTO steps (run_id,id,type,label,row_order,status) VALUES (?,?,?,?,?,'queued')");
      for (const [index, node] of definition.nodes.entries()) insert.run(id, node.id, node.type, node.label, index);
      audit(id, 'run.queued', null, { mode, version, replayOf, workflowId: definition.id });
      return id;
    });
    schedule();
    return detail(owner, resultingId);
  }

  function startRun(owner, command, idempotencyKey = null) {
    object(command, 'Run request');
    const selectors = ['workflow', 'workflowId', 'templateId'].filter((key) => command[key] != null);
    if (selectors.length !== 1) throw new ApiError(400, 'invalid_input', 'Select one workflow, workflow ID, or template ID.');
    const input = object(command.input ?? {}, 'Workflow input');
    boundedJson(input, 80_000, 'Workflow input');
    let definition = command.workflow;
    let version = null;
    if (command.workflowId != null) {
      if (typeof command.workflowId !== 'string') throw new ApiError(400, 'invalid_input', 'Workflow ID is invalid.');
      if (command.version != null && (!Number.isSafeInteger(command.version) || command.version < 1)) throw new ApiError(400, 'invalid_input', 'Workflow version is invalid.');
      const revisions = versions(owner, command.workflowId);
      const selected = command.version == null ? revisions[0] : revisions.find((revision) => revision.version === command.version);
      if (!selected) throw new ApiError(404, 'not_found', 'Workflow version was not found.');
      definition = selected.workflow;
      version = selected.version;
    } else if (command.templateId != null) {
      definition = templateList.find((template) => template.id === command.templateId);
      if (!definition) throw new ApiError(404, 'not_found', 'Workflow template was not found.');
    }
    expectWorkflow(definition);
    const mode = command.mode ?? 'offline';
    if (!MODES.has(mode)) throw new ApiError(400, 'invalid_input', 'Requested execution mode is invalid.');
    if (mode === 'connected' && !allowConnected) throw new ApiError(403, 'policy_denied', 'Connected execution is disabled on this server.');
    const providerName = command.provider ?? (mode === 'offline' ? 'offline' : 'auto');
    if (providerName != null && (typeof providerName !== 'string' || !KEY.test(providerName))) throw new ApiError(400, 'invalid_input', 'Model provider name is invalid.');
    if (mode === 'offline' && providerName !== 'offline') throw new ApiError(403, 'policy_denied', 'Offline runs use the offline provider.');
    if (idempotencyKey != null && (typeof idempotencyKey !== 'string' || !KEY.test(idempotencyKey))) throw new ApiError(400, 'invalid_input', 'Idempotency key is invalid.');

    return queueRun(owner, { definition, version, input, mode, providerName, replayOf: null }, idempotencyKey, sha256(json(command)));
  }

  function replayRun(owner, id) {
    const row = ownedRun(owner, id);
    if (!TERMINAL.has(row.status)) throw new ApiError(409, 'run_active', 'Finish the original run before starting a replay.');
    if (row.mode === 'connected' && !allowConnected) throw new ApiError(403, 'policy_denied', 'Connected execution is disabled on this server.');
    return queueRun(owner, {
      definition: parse(row.definition), input: parse(row.input), version: row.version,
      mode: row.mode, providerName: row.provider, replayOf: id,
    }, null, null);
  }

  function endRun(id, status, issue = null) {
    const ended = now();
    db.prepare('UPDATE runs SET status=?,finished_at=?,error=? WHERE id=?').run(status, ended, issue ? json(issue) : null, id);
    if (status !== 'completed') {
      const remaining = db.prepare("SELECT id,status FROM steps WHERE run_id=? AND status IN ('queued','running','waiting')").all(id);
      db.prepare("UPDATE steps SET status='cancelled',finished_at=? WHERE run_id=? AND status IN ('queued','running','waiting')").run(ended, id);
      for (const step of remaining) audit(id, 'step.cancelled', step.id, { previousStatus: step.status, reason: status });
    }
    audit(id, 'run.' + status, null, issue ? { error: issue } : {});
  }

  function abortJobs(id) {
    for (const job of jobs.values()) if (job.runId === id) job.controller.abort(new Error('Run stopped.'));
  }

  function cancelRun(owner, id) {
    const row = ownedRun(owner, id);
    if (row.status === 'cancelled') return detail(owner, id);
    if (TERMINAL.has(row.status)) throw new ApiError(409, 'run_complete', 'This run has already ended.');
    store.transaction(() => endRun(id, 'cancelled', { code: 'cancelled', message: 'Cancelled by the session owner.' }));
    abortJobs(id);
    return detail(owner, id);
  }

  function review(owner, id, value) {
    const row = ownedRun(owner, id);
    const { decision, stepId, note = '' } = object(value, 'Approval');
    if (!['approve', 'reject'].includes(decision) || typeof stepId !== 'string' || !KEY.test(stepId)
        || typeof note !== 'string' || note.length > 500) {
      throw new ApiError(400, 'invalid_input', 'Specify a step, an approve or reject decision, and an optional short note.');
    }
    if (TERMINAL.has(row.status)) throw new ApiError(409, 'approval_not_pending', 'This run cannot accept approvals.');
    store.transaction(() => {
      const step = db.prepare('SELECT status,type FROM steps WHERE run_id=? AND id=?').get(id, stepId);
      if (step?.status !== 'waiting' || step.type !== 'approval') throw new ApiError(409, 'approval_not_pending', 'No pending approval exists for this step.');
      const output = { approved: decision === 'approve', decision, note };
      audit(id, 'approval.' + (output.approved ? 'approved' : 'rejected'), stepId, { ...output, actor: 'session-owner' });
      db.prepare('UPDATE steps SET status=?,finished_at=?,output=? WHERE run_id=? AND id=?')
        .run(output.approved ? 'completed' : 'failed', now(), json(output), id, stepId);
      if (output.approved) audit(id, 'step.completed', stepId, { output });
      else endRun(id, 'failed', { code: 'approval_rejected', message: 'The operator rejected the approval request.' });
    });
    if (decision === 'reject') abortJobs(id);
    else schedule();
    return detail(owner, id);
  }

  function runState(row, status) {
    if (row.status === status) return;
    db.prepare('UPDATE runs SET status=?,started_at=COALESCE(started_at,?) WHERE id=?').run(status, now(), row.id);
    const event = status === 'waiting' ? 'run.waiting' : row.status === 'waiting' ? 'run.resumed' : 'run.running';
    audit(row.id, event);
    row.status = status;
  }

  function stepDone(run, node, attempt, result, failure) {
    const current = db.prepare('SELECT status FROM runs WHERE id=?').get(run.id);
    if (!current || TERMINAL.has(current.status) || stopped) return;
    const stillRunning = db.prepare('SELECT status,attempt FROM steps WHERE run_id=? AND id=?').get(run.id, node.id);
    if (stillRunning?.status !== 'running' || stillRunning.attempt !== attempt) return;
    store.transaction(() => {
      let issue = failure ? requestError(failure) : null;
      if (!issue) {
        try {
          const payload = object(result, 'Step result');
          if (!Object.hasOwn(payload, 'output')) throw new ApiError(422, 'invalid_result', 'The step did not return output.');
          const output = boundedJson(payload.output, MAX_STEP_BYTES, 'Step output');
          const usage = cleanUsage(payload.usage);
          const serializedUsage = usage ? json(usage) : null;
          const artifacts = payload.artifacts == null ? null : boundedJson(payload.artifacts, 96 * 1024, 'Step artifacts');
          const previous = rawSteps(run.id);
          const previousBytes = previous.reduce((sum, step) => sum + Buffer.byteLength(step.output ?? '') + Buffer.byteLength(step.artifacts ?? ''), 0);
          if (previousBytes + Buffer.byteLength(output) + Buffer.byteLength(artifacts ?? '') > MAX_RUN_BYTES) {
            throw new ApiError(422, 'run_data_limit', 'The run exceeded its combined output and artifact limit.');
          }
          const budget = parse(run.definition).budget;
          if (usage && budget) {
            const metrics = [...previous.map((step) => parse(step.usage)).filter(Boolean), usage];
            const { tokens, cost } = totalUsage(metrics);
            if (tokens > (budget.maxTokens ?? Infinity) || cost > (budget.maxCostUsd ?? Infinity)) {
              db.prepare('UPDATE steps SET usage=? WHERE run_id=? AND id=?').run(serializedUsage, run.id, node.id);
              throw new ApiError(422, 'execution_budget_exceeded', 'Reported model usage exceeded the configured execution budget.');
            }
          }
          db.prepare("UPDATE steps SET status='completed',finished_at=?,output=?,usage=?,artifacts=?,error=NULL WHERE run_id=? AND id=?")
            .run(now(), output, serializedUsage, artifacts, run.id, node.id);
          audit(run.id, 'step.completed', node.id, { attempt });
          return;
        } catch (error) { issue = requestError(error); }
      }
      const retryable = failure?.retryable !== false && !NAMED_FAILURES.has(issue.code)
        && !['run_data_limit', 'content_limit', 'invalid_result', 'policy_denied'].includes(issue.code);
      if (retryable && attempt <= policyFor(node).maxRetries) {
        const delayMs = Math.min(2400, 150 * 2 ** (attempt - 1));
        db.prepare("UPDATE steps SET status='queued',ready_at=?,error=? WHERE run_id=? AND id=?")
          .run(timeAfter(delayMs), json(issue), run.id, node.id);
        audit(run.id, 'step.retry_scheduled', node.id, { attempt, delayMs, error: issue });
        return;
      }
      db.prepare("UPDATE steps SET status='failed',finished_at=?,error=? WHERE run_id=? AND id=?").run(now(), json(issue), run.id, node.id);
      audit(run.id, 'step.failed', node.id, { attempt, error: issue });
      endRun(run.id, 'failed', issue);
    });
    const finalStatus = db.prepare('SELECT status FROM runs WHERE id=?').get(run.id)?.status;
    if (finalStatus === 'failed') abortJobs(run.id);
  }

  function launch(run, node, attempt, results) {
    const key = run.id + '/' + node.id;
    const controller = new AbortController();
    const { timeoutMs } = policyFor(node);
    const timer = setTimeout(() => controller.abort(new ApiError(408, 'step_timeout', 'The step exceeded its execution timeout.')), timeoutMs);
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason); });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    function sendToProvider(request, options) {
      const limits = parse(run.definition).budget;
      const usage = limits ? totalUsage(rawSteps(run.id).map((step) => parse(step.usage))) : null;
      const budget = usage ? {
        maxTokens: limits.maxTokens === undefined ? undefined : Math.max(0, limits.maxTokens - usage.tokens),
        maxCostUsd: limits.maxCostUsd === undefined ? undefined : Math.max(0, limits.maxCostUsd - usage.cost),
      } : undefined;
      if (budget?.maxTokens === 0) throw new ApiError(422, 'execution_budget_exceeded', 'The run spent its configured token budget.');
      return provider({ ...request, provider: run.provider ?? 'auto' }, { ...options, budget });
    }
    const execution = Promise.resolve().then(() => executeNode(node, {
      input: parse(run.input), results, signal: controller.signal, mode: run.mode,
      provider: run.mode === 'connected' && provider ? sendToProvider : undefined,
    }));
    const settled = Promise.race([execution, aborted]).then(
      (result) => stepDone(run, node, attempt, result, null),
      (error) => stepDone(run, node, attempt, null, error),
    ).catch((error) => logger.error(JSON.stringify({ event: 'relayops.worker_error', runId: run.id, errorType: error.name }))).finally(() => {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', rejectAbort);
      jobs.delete(key);
      schedule();
    });
    jobs.set(key, { runId: run.id, controller, settled });
  }

  function advance(row) {
    const definition = parse(row.definition);
    const steps = new Map(rawSteps(row.id).map((step) => [step.id, step]));
    const incoming = new Map(definition.nodes.map((node) => [node.id, []]));
    for (const edge of definition.edges) incoming.get(edge.target).push(edge);
    const toLaunch = [];
    let activeCount = [...steps.values()].filter((step) => step.status === 'running').length;
    store.transaction(() => {
      if (row.status === 'queued') runState(row, 'running');
      let skipped = true;
      while (skipped) {
        skipped = false;
        for (const node of definition.nodes) {
          const step = steps.get(node.id);
          const dependencies = incoming.get(node.id);
          if (step.status !== 'queued' || (step.ready_at && step.ready_at > now())
              || !dependencies.every((edge) => RESOLVED.has(steps.get(edge.source).status))) continue;
          if (dependencies.length && !dependencies.some((edge) => edgeEnabled(edge, steps.get(edge.source)))) {
            db.prepare("UPDATE steps SET status='skipped',finished_at=? WHERE run_id=? AND id=?").run(now(), row.id, node.id);
            step.status = 'skipped';
            audit(row.id, 'step.skipped', node.id, { reason: 'No active upstream branch.' });
            skipped = true;
          } else if (node.type === 'approval') {
            db.prepare("UPDATE steps SET status='waiting',attempt=attempt+1,started_at=? WHERE run_id=? AND id=?").run(now(), row.id, node.id);
            step.status = 'waiting';
            audit(row.id, 'approval.requested', node.id, { label: node.label, prompt: node.config?.prompt ?? '' });
          } else if (jobs.size + toLaunch.length < maxWorkers && activeCount < (row.mode === 'connected' ? 1 : 4)) {
            const attempt = step.attempt + 1;
            db.prepare("UPDATE steps SET status='running',attempt=?,started_at=?,ready_at=NULL WHERE run_id=? AND id=?")
              .run(attempt, now(), row.id, node.id);
            step.status = 'running';
            activeCount += 1;
            audit(row.id, 'step.running', node.id, { type: node.type, attempt });
            toLaunch.push({ node, attempt });
          }
        }
      }
      if ([...steps.values()].every((step) => RESOLVED.has(step.status))) {
        endRun(row.id, 'completed');
      } else if (!activeCount && [...steps.values()].some((step) => step.status === 'waiting')) {
        runState(row, 'waiting');
      } else if (activeCount) {
        runState(row, 'running');
      }
    });
    const parents = (id) => incoming.get(id).filter((edge) => edgeEnabled(edge, steps.get(edge.source))).map((edge) => edge.source);
    for (const { node, attempt } of toLaunch) {
      const direct = [...new Set(parents(node.id))];
      const upstream = new Set();
      const pending = [...direct];
      while (pending.length) {
        const id = pending.pop();
        if (upstream.has(id)) continue;
        upstream.add(id);
        pending.push(...parents(id));
      }
      // Leave direct parents last for operations using the implicit predecessor.
      const ordered = [...steps.keys()].filter((id) => upstream.has(id) && !direct.includes(id)).concat(direct);
      const results = Object.fromEntries(ordered.map((id) => [id, parse(steps.get(id).output)]));
      launch(row, node, attempt, results);
    }
  }

  function tick() {
    if (stopped) return;
    try {
      if (clock() - lastSweep >= 60_000) {
        db.prepare("DELETE FROM sessions WHERE expires_at<=? AND id NOT IN (SELECT owner FROM runs WHERE status IN ('queued','running','waiting'))").run(now());
        lastSweep = clock();
      }
      const rows = db.prepare("SELECT * FROM runs WHERE status IN ('queued','running','waiting') ORDER BY created_at LIMIT ?").all(MAX_PENDING);
      for (const row of rows) {
        if (row.created_at < timeAfter(-24 * 60 * 60 * 1000)) {
          store.transaction(() => endRun(row.id, 'failed', { code: 'run_expired', message: 'The 24-hour execution limit expired.' }));
          abortJobs(row.id);
        } else {
          advance(row);
        }
      }
    } catch (error) { logger.error(JSON.stringify({ event: 'relayops.queue_error', errorType: error.name })); }
  }

  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; tick(); });
  }

  store.transaction(() => {
    const recovering = db.prepare("SELECT * FROM runs WHERE status IN ('queued','running','waiting')").all();
    for (const row of recovering) {
      const nodes = new Map(parse(row.definition).nodes.map((node) => [node.id, node]));
      const interrupted = db.prepare("SELECT id,attempt FROM steps WHERE run_id=? AND status='running'").all(row.id);
      if (interrupted.length) audit(row.id, 'run.recovered', null, { interrupted: interrupted.map((step) => step.id) });
      for (const step of interrupted) {
        if (step.attempt <= policyFor(nodes.get(step.id)).maxRetries) {
          db.prepare("UPDATE steps SET status='queued',ready_at=NULL WHERE run_id=? AND id=?").run(row.id, step.id);
          audit(row.id, 'step.interrupted', step.id, { attempt: step.attempt, retry: true });
        } else {
          const issue = { code: 'interrupted', message: 'Execution interrupted after its last allowed attempt.' };
          db.prepare("UPDATE steps SET status='failed',error=?,finished_at=? WHERE run_id=? AND id=?").run(json(issue), now(), row.id, step.id);
          audit(row.id, 'step.failed', step.id, { attempt: step.attempt, error: issue });
          endRun(row.id, 'failed', issue);
          break;
        }
      }
    }
  });
  const interval = setInterval(tick, pollMs);
  interval.unref();
  schedule();

  return {
    createSession, ownerFor, listWorkflows, versions, saveWorkflow,
    startRun, replayRun, detail, listRuns, cancelRun, review, events,
    status: (owner, id) => ownedRun(owner, id).status,
    evaluate(owner, id) {
      const run = detail(owner, id);
      if (!TERMINAL.has(run.status)) throw new ApiError(409, 'run_active', 'Evaluation becomes available when the run ends.');
      return evaluateRun(run, run.workflow);
    },
    async close() {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      for (const job of jobs.values()) job.controller.abort(new Error('Worker shutting down.'));
      await Promise.all([...jobs.values()].map((job) => job.settled));
      store.close();
    },
  };
}
