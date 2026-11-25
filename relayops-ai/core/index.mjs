import { isRecord, nodeIssues, own } from './contracts.mjs';
import { connectors } from './connectors.mjs';
import { describeDataset, parseDataset } from './datasets.mjs';
import {
  applySimulatedMitigation, correlateIncident, engineeringReview, inspectDocument, normalizeTelemetry, planResearch, selectEvidence, verifyResearch,
} from './analysis.mjs';

export { nodeDefaults, nodeKinds, operations, roles, validateWorkflow } from './contracts.mjs';
export { templates } from './templates.mjs';

const offlineUsage = () => ({ provider: 'offline', model: 'deterministic-rules', inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 });
const markdown = (text) => String(text).replace(/[<>]/g, (character) => character === '<' ? '&lt;' : '&gt;').replace(/[\\\x60*_[\]#]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const jsonSize = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const predecessor = (results, source, input) => {
  if (source && !Object.hasOwn(results, source)) throw new Error('The configured upstream output is unavailable.');
  return source ? results[source] : Object.values(results).at(-1) ?? input;
};

function createDocument(options, source) {
  const title = options.title ?? 'Workflow report';
  const lines = ['# ' + markdown(title)];
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow-report';
  if (source?.summary) lines.push('', markdown(source.summary));
  if (source?.mode) lines.push('', 'Mode: ' + markdown(source.mode));
  if (source?.revision) lines.push('', 'Revision: ' + markdown(source.revision));
  if (source?.question) lines.push('', 'Question: ' + markdown(source.question));
  if (source?.repository) lines.push('', 'Repository: ' + markdown(source.repository));
  if (source?.incidentId) lines.push('', 'Incident: ' + markdown(source.incidentId));
  if (source?.severity) lines.push('', 'Severity: ' + markdown(source.severity));
  if (Array.isArray(source?.findings)) {
    lines.push('', '## Prioritized findings');
    for (const { priority, message, sourceIds, line } of source.findings) lines.push('- **' + markdown(priority) + '** ' +
      markdown(message) + ' (' + markdown(sourceIds.join(', ')) + (line ? ', line ' + line : '') + ')');
  }
  if (Array.isArray(source?.claims)) {
    lines.push('', '## Evidence');
    for (const claim of source.claims) lines.push('- ' + markdown(claim.statement) + ' (' + markdown(claim.sourceId) + ')');
  }
  if (Array.isArray(source?.metrics)) {
    lines.push('', '## Descriptive statistics', '', '| Column | Count | Min | Max | Mean | Median | Std. dev. |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const row of source.metrics) lines.push(
      '| ' + markdown(row.column).replaceAll('|', '\\|') + ' | ' + [row.count, row.min, row.max, row.mean, row.median, row.standardDeviation].join(' | ') + ' |',
    );
    lines.push('', markdown(source.method));
    for (const item of source.anomalies.slice(0, 10)) lines.push('- ' + markdown(item.column) + ' — row ' + item.row + ' value ' + item.value);
  }
  if (Array.isArray(source?.events)) {
    lines.push('', '## Threshold crossings');
    const shown = source.events.slice(0, 24);
    if (source.driver && !shown.some((event) => event.asset === source.driver.asset && event.minute === source.driver.minute && event.metric === source.driver.metric)) {
      shown.push(source.driver);
    }
    for (const event of shown) lines.push('- Minute ' + event.minute + ' · ' + markdown(event.asset) + ' · ' +
      markdown(event.name) + ' ' + event.value + markdown(event.unit) + ' (' + markdown(event.severity) + ')');
    lines.push('', '## Possible explanations');
    for (const hypothesis of source.hypotheses) lines.push('- ' + markdown(hypothesis.statement));
    lines.push('', '**Recommended review** ' + markdown(source.recommendation));
  }
  if (Array.isArray(source?.sources)) {
    lines.push('', '## Sources');
    for (const citation of source.sources) {
      const link = /^https:\/\/(github\.com|opentelemetry\.io|sre\.google)\//.test(citation.url || '') ? ' — <' + citation.url + '>' : ' (bundled fixture)';
      lines.push('- ' + markdown(citation.id) + ' — ' + markdown(citation.title) + link);
    }
  }
  if (source?.limitations) lines.push('', markdown(source.limitations));
  if (lines.length === 1) lines.push('', 'Workflow inputs and upstream results are available in the execution trace.');
  return {
    output: {
      summary: source?.summary || 'Generated a structured workflow report.',
      format: 'markdown', name: name + '.md',
      chartCount: source?.charts?.length || 0, sourceCount: source?.sources?.length || 0,
    },
    artifacts: [{ name: name + '.md', mimeType: 'text/markdown', content: lines.join('\n') + '\n' }],
  };
}

function runValidation(operation, config, source) {
  switch (operation) {
    case 'dataset':
      if (!Array.isArray(source?.rows) || !Array.isArray(source?.columns) || source.rows.length !== source.rowCount ||
        source.rows.some((row) => !Array.isArray(row) || row.length !== source.columns.length)) throw new Error('Dataset validation failed.');
      return { ...source, validated: true };
    case 'telemetry':
      if (source?.mode !== 'synthetic' || !Array.isArray(source.telemetry)) throw new Error('Synthetic telemetry validation failed.');
      return { ...source, validated: true };
    case 'research-evidence':
      if (!source?.verified || !source.claims?.length) throw new Error('Grounded evidence is required.');
      return { ...source, validated: true };
    case 'required-fields':
      if (!config.required.every((name) => own(source, name) !== undefined)) throw new Error('Required output fields are missing.');
      return { ...source, validated: true };
    default:
      throw new Error('Unknown validation operation.');
  }
}

async function runAgent(config, source, context) {
  const { input, results, signal, mode, provider } = context;
  switch (config.operation) {
    case 'plan-research': return { output: planResearch(input), usage: offlineUsage() };
    case 'extract-evidence': return {
      output: selectEvidence(Object.values(results).find((value) => Array.isArray(value?.terms)),
        Object.values(results).find((value) => Array.isArray(value?.sources) && value?.mode === 'sample-sources')),
      usage: offlineUsage(),
    };
    case 'verify-research': return { output: verifyResearch(source), usage: offlineUsage() };
    case 'review-repo': return { output: engineeringReview(source), usage: offlineUsage() };
    case 'analyze-data': return { output: describeDataset(source), usage: offlineUsage() };
    case 'correlate-incident': return { output: correlateIncident(source), usage: offlineUsage() };
    case 'model': {
      if (mode === 'connected' && typeof provider === 'function') {
        const task = typeof config.title === 'string' ? config.title : 'Summarize the supplied workflow evidence.';
        const value = await provider({ role: config.role, task, data: source }, { signal });
        if (!value || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 4000) throw new Error('Model summary failed validation.');
        return { output: { mode: 'connected', summary: value.summary, provider: value.provider, model: value.model }, usage: value.usage };
      }
      return {
        output: { mode: 'offline', summary: `Offline ${config.role} step processed the supplied workflow data.`, fields: isRecord(source) ? Object.keys(source).slice(0, 12) : [] },
        usage: offlineUsage(),
      };
    }
    case 'annotate':
      return {
        output: { mode: 'offline', summary: `The ${config.role} checked the workflow input structure.`, fields: isRecord(source) ? Object.keys(source).slice(0, 12) : [] },
        usage: offlineUsage(),
      };
    default: throw new Error('Unknown agent operation.');
  }
}

export async function executeNode(node, context = {}) {
  const errors = nodeIssues(node);
  if (errors.length) throw new Error(errors.join(' '));
  const { input = {}, results = {}, signal, mode = 'offline', provider, fetcher } = context;
  if (!isRecord(input) || !isRecord(results) || jsonSize(input) > 80_000) throw new Error('Workflow input must be an object of at most 80 KB.');
  signal?.throwIfAborted();
  const { config } = node;
  const operation = config.operation;
  const source = predecessor(results, config.source, input);
  switch (node.type) {
    case 'trigger': return { output: structuredClone(input) };
    case 'api': return { output: await connectors[operation](input, { mode, signal, fetcher }) };
    case 'agent': return runAgent(config, source, { input, results, signal, mode, provider });
    case 'transform': {
      if (operation === 'parse-dataset') return { output: parseDataset(input) };
      if (operation === 'parse-document') return { output: inspectDocument(input) };
      if (operation === 'normalize-telemetry') return { output: normalizeTelemetry(input) };
      if (operation === 'simulate-mitigation') return { output: applySimulatedMitigation(source, results) };
      return { output: Object.fromEntries(config.fields.filter((field) => own(source, field) !== undefined).map((field) => [field, own(source, field)])) };
    }
    case 'condition': {
      const passed = operation === 'severity' ? source?.severity === 'critical' : own(source, config.field) === config.value;
      return { output: { passed, field: operation === 'severity' ? 'severity' : config.field, observed: operation === 'severity' ? source?.severity ?? null : own(source, config.field) ?? null } };
    }
    case 'validate': return { output: runValidation(operation, config, source) };
    case 'approval': throw new Error('Human approval must be decided by the execution service.');
    case 'document': return createDocument(config, source);
    case 'notification': return { output: { mode: 'simulated', channel: 'execution trace', summary: config.title ?? 'Workflow notification recorded', delivery: 'simulated' } };
    default: throw new Error('Unsupported node type.');
  }
}

function elapsed(start, end) {
  const time = (value) => typeof value === 'number' ? value : Date.parse(value);
  const duration = time(end) - time(start);
  return Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : null;
}

export function evaluateRun(run, workflow = run?.workflow) {
  if (!isRecord(run)) throw new Error('A recorded execution is required.');
  const steps = Array.isArray(run.steps) ? run.steps : Object.values(run.steps ?? {});
  const completed = steps.filter((step) => step.status === 'completed');
  const reports = completed.flatMap((step) => Array.isArray(step.artifacts) ? step.artifacts : []);
  const observed = new Map(steps.map((step) => [step.id ?? step.nodeId, step]));
  const available = new Map((workflow?.nodes ?? []).map((node) => [node.id, node]));
  const evaluations = [];
  const add = (id, label, passed, detail) => evaluations.push({ id, label, passed, detail });
  add('completion', 'Task completion', run.status === 'completed', `Execution status: ${run.status ?? 'unknown'}.`);
  add('output', 'Structured outputs', completed.length > 0 && completed.every((step) => isRecord(step.output)),
    `${completed.filter((step) => isRecord(step.output)).length}/${completed.length} completed steps returned structured objects.`);
  add('tool-selection', 'Configured tool selection', !available.size || steps.every((step) => {
    const specification = available.get(step.id ?? step.nodeId);
    return specification && (!step.type || specification.type === step.type);
  }), available.size ? 'Matched recorded step types to the submitted graph.' : 'Workflow definition was not available for comparison.');
  if (available.size === 0) evaluations.at(-1).passed = null;
  const reviewed = completed.map(({ output }) => output).filter((output) => Array.isArray(output?.findings) || Array.isArray(output?.claims));
  const verifiable = reviewed.filter((output) => Array.isArray(output.sources));
  add('grounding', 'Source references', verifiable.length ? verifiable.every((output) => {
    const sources = new Set(output.sources.map(({ id }) => id));
    return output.claims ? output.verified === true && output.claims.length > 0 &&
      output.claims.every(({ sourceId }) => sources.has(sourceId)) :
      output.findings.length > 0 && output.findings.every(({ sourceIds }) => sourceIds.length > 0 && sourceIds.every((id) => sources.has(id)));
  }) : null, verifiable.length ? 'Checked citation IDs against the recorded source set.' : 'No citation-bearing result was recorded.');
  if (reviewed.length && !verifiable.length) evaluations.at(-1).detail = 'Source collection or validation did not complete.';
  const applied = completed.filter(({ output }) => output?.event === 'simulated-load-limit-applied');
  add('approval', 'Approval and policy', applied.every((step) => {
    const node = available.get(step.id ?? step.nodeId);
    const approval = node ? observed.get(node.config.source) : steps.find((candidate) => candidate.type === 'approval');
    return approval?.type === 'approval' && approval.output?.decision === 'approve';
  }), applied.length ? `${applied.length} simulated mitigation step(s) checked against recorded approval.` : 'No simulated mitigation ran.');
  const attempted = steps.filter((step) => (step.attempt ?? step.attempts ?? 0) > 1);
  add('recovery', 'Retry recovery', attempted.length ? attempted.every((step) => step.status === 'completed') : null,
    attempted.length ? `${attempted.filter((step) => step.status === 'completed').length}/${attempted.length} retried steps recovered.` : 'No retry occurred in this execution.');
  if ((workflow?.outputs ?? []).some((id) => available.get(id)?.type === 'document')) add('artifact', 'Report artifact', reports.length > 0, `${reports.length} downloadable report artifact(s).`);
  const modelSteps = completed.filter((step) => step.type === 'agent' && step.output?.mode === 'connected' && typeof step.output?.provider === 'string');
  const unknownTokens = modelSteps.some(({ usage }) => !Number.isFinite(usage?.totalTokens) &&
    (!Number.isFinite(usage?.inputTokens) || !Number.isFinite(usage?.outputTokens)));
  const unknownCost = modelSteps.some(({ usage }) => !Number.isFinite(usage?.estimatedCostUsd));
  const metrics = {
    durationMs: elapsed(run.startedAt, run.finishedAt ?? run.completedAt),
    tokens: unknownTokens ? null : steps.reduce((sum, step) => sum + (step.usage?.totalTokens ?? ((step.usage?.inputTokens ?? 0) + (step.usage?.outputTokens ?? 0))), 0),
    estimatedCostUsd: unknownCost ? null : Number(steps.reduce((sum, step) => sum + (step.usage?.estimatedCostUsd ?? 0), 0).toFixed(8)),
  };
  const scored = evaluations.filter(({ passed }) => typeof passed === 'boolean');
  return { score: scored.length ? Math.round(100 * scored.filter(({ passed }) => passed).length / scored.length) : 0, checks: evaluations, metrics };
}
