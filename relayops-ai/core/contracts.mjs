export const roles = Object.freeze([
  'research', 'planning', 'data-analysis', 'engineering-review', 'document', 'verification', 'coordinator',
]);

const operationLists = {
  trigger: ['manual', 'webhook'],
  agent: ['annotate', 'plan-research', 'extract-evidence', 'verify-research', 'review-repo', 'analyze-data', 'correlate-incident', 'model'],
  api: ['github-repository', 'research-sources', 'public-earthquakes'],
  transform: ['project', 'parse-dataset', 'parse-document', 'normalize-telemetry', 'simulate-mitigation'],
  condition: ['severity', 'equals'],
  validate: ['required-fields', 'research-evidence', 'dataset', 'telemetry'],
  approval: ['simulated-mitigation', 'review'],
  document: ['report', 'engineering-report', 'research-report', 'analysis-report', 'incident-report'],
  notification: ['simulated-notification'],
};
const fallbackLabels = {
  trigger: 'Trigger', agent: 'Agent', api: 'API request', transform: 'Transform data', condition: 'Condition',
  validate: 'Validate output', approval: 'Human approval', document: 'Generate document', notification: 'Record notification',
};
export const nodeKinds = Object.freeze(Object.keys(operationLists));
export const operations = Object.freeze(Object.fromEntries(nodeKinds.map((type) => [type, Object.freeze(operationLists[type])])));
export const KEY = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
export const isKey = (value) => typeof value === 'string' && KEY.test(value) && !blockedKeys.has(value);
export const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const own = (object, key) => isRecord(object) && Object.hasOwn(object, key) ? object[key] : undefined;
const validText = (value, max = 100) => typeof value === 'string' && value.trim() !== '' && value.length <= max;
const integers = (value, from, to) => Number.isInteger(value) && value >= from && value <= to;
const scalar = (value) => value === null || typeof value === 'boolean' || Number.isFinite(value) || (typeof value === 'string' && value.length <= 500);

export function nodeDefaults(type) {
  if (!nodeKinds.includes(type)) throw new RangeError('Unknown node type.');
  const config = { operation: operations[type][0] };
  if (type === 'agent') config.role = 'coordinator';
  if (type === 'validate') config.required = ['summary'];
  if (type === 'transform') config.fields = ['summary'];
  return { label: fallbackLabels[type], config };
}

export function nodeIssues(node) {
  if (!isRecord(node) || !isKey(node?.id) || !nodeKinds.includes(node?.type) || !validText(node?.label)) return ['Each node needs a valid ID, label and supported type.'];
  const errors = [];
  const config = node.config;
  if (!isRecord(config)) return [`Node "${node.id}" needs a configuration object.`];
  if (!operations[node.type].includes(config.operation)) errors.push('Choose a supported operation.');
  if (node.type === 'agent' && !roles.includes(config.role)) errors.push('Choose a supported agent role.');
  if (config.source !== undefined && !isKey(config.source)) errors.push('Source must be a node ID.');
  if (config.maxRetries !== undefined && !integers(config.maxRetries, 0, 3)) errors.push('Retries must be an integer from 0 to 3.');
  if (config.timeoutMs !== undefined && !integers(config.timeoutMs, 10, 30000)) errors.push('Timeout must be between 10 and 30000 ms.');
  if (config.title !== undefined && !validText(config.title)) errors.push('A title must have at most 100 characters.');
  if (config.operation === 'equals' && (!isKey(config.field) || !scalar(config.value))) errors.push('Equality checks need a field name and a scalar value.');
  if (config.operation === 'required-fields' && (!Array.isArray(config.required) || !config.required.length || config.required.length > 20 || !config.required.every(isKey))) errors.push('Provide 1–20 required field names.');
  if (config.operation === 'project' && (!Array.isArray(config.fields) || !config.fields.length || config.fields.length > 20 || !config.fields.every(isKey))) errors.push('Provide 1–20 projected field names.');
  for (const coord of ['x', 'y']) {
    if (node[coord] !== undefined && (!Number.isFinite(node[coord]) || Math.abs(node[coord]) > 25_000)) errors.push('Canvas positions must be finite and within bounds.');
  }
  return errors.map((error) => `Node "${node.id}". ${error}`);
}

export function validateWorkflow(workflow) {
  if (!isRecord(workflow) || !isKey(workflow.id) || !validText(workflow.name)) return { ok: false, errors: ['A workflow needs a valid ID and name.'] };
  if (!Array.isArray(workflow.nodes) || !workflow.nodes.length || workflow.nodes.length > 32 || !Array.isArray(workflow.edges) || workflow.edges.length > 100) {
    return { ok: false, errors: ['A workflow needs 1–32 nodes and at most 100 edges.'] };
  }
  const errors = workflow.nodes.flatMap(nodeIssues);
  if (workflow.inputs !== undefined && !isRecord(workflow.inputs)) errors.push('Workflow inputs must be an object.');
  if (workflow.description !== undefined && (typeof workflow.description !== 'string' || workflow.description.length > 500)) errors.push('Workflow descriptions can have up to 500 characters.');
  if (workflow.budget !== undefined && (!isRecord(workflow.budget) ||
      (workflow.budget.maxTokens !== undefined && !integers(workflow.budget.maxTokens, 0, 100_000)) ||
      (workflow.budget.maxCostUsd !== undefined && (!Number.isFinite(workflow.budget.maxCostUsd) || workflow.budget.maxCostUsd < 0 || workflow.budget.maxCostUsd > 20)))) {
    errors.push('Budgets must limit tokens to 100,000 and cost to 20 USD.');
  }
  if (errors.length) return { ok: false, errors };
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  if (nodes.size !== workflow.nodes.length) errors.push('Node IDs must be unique.');
  const triggers = workflow.nodes.filter((node) => node.type === 'trigger');
  if (triggers.length !== 1) errors.push('Each workflow needs one trigger.');
  if (workflow.outputs !== undefined && (!Array.isArray(workflow.outputs) || workflow.outputs.length > 20 ||
    workflow.outputs.some((output) => !isKey(output) || !nodes.has(output)))) errors.push('Workflow outputs must contain up to 20 known node IDs.');

  const children = new Map([...nodes.keys()].map((id) => [id, new Set()]));
  const parents = new Map([...nodes.keys()].map((id) => [id, new Set()]));
  const compiledEdges = new Set();
  for (const edge of workflow.edges) {
    if (!isRecord(edge) || !nodes.has(edge.source) || !nodes.has(edge.target) || edge.source === edge.target) {
      errors.push('Each connection must link two different existing nodes.');
      continue;
    }
    const origin = nodes.get(edge.source);
    const key = `${edge.source}:${edge.target}`;
    if (compiledEdges.has(key)) errors.push(`Duplicate connection from "${edge.source}" to "${edge.target}".`);
    compiledEdges.add(key);
    if (origin.type === 'condition' && ![true, false, 'true', 'false'].includes(edge.when)) errors.push(`A connection from "${edge.source}" needs the true or false branch.`);
    if (origin.type !== 'condition' && edge.when !== undefined) errors.push('Only condition nodes have branch conditions.');
    if (nodes.get(edge.target).type === 'trigger') errors.push('A trigger cannot have an incoming connection.');
    if (nodes.get(edge.target).config.operation === 'simulate-mitigation' &&
        (origin.type !== 'approval' || nodes.get(edge.target).config.source !== origin.id)) {
      errors.push('Simulated mitigation must directly follow its configured human approval.');
    }
    children.get(edge.source).add(edge.target);
    parents.get(edge.target).add(edge.source);
  }
  const available = [...parents].filter(([, dependencies]) => dependencies.size === 0).map(([id]) => id);
  const order = [];
  const remaining = new Map([...parents].map(([id, dependencies]) => [id, dependencies.size]));
  while (available.length) {
    const id = available.shift();
    order.push(id);
    for (const child of children.get(id)) {
      remaining.set(child, remaining.get(child) - 1);
      if (remaining.get(child) === 0) available.push(child);
    }
  }
  if (order.length !== nodes.size) errors.push('Workflow connections must be acyclic.');
  const connected = new Set();
  const dependenciesOf = (id) => {
    const visited = new Set();
    const pending = [...parents.get(id)];
    while (pending.length) {
      const pendingId = pending.pop();
      if (!visited.has(pendingId)) {
        visited.add(pendingId);
        pending.push(...parents.get(pendingId));
      }
    }
    return visited;
  };
  if (triggers.length === 1) {
    const queue = [triggers[0].id];
    while (queue.length) {
      const id = queue.shift();
      if (!connected.has(id)) {
        connected.add(id);
        queue.push(...children.get(id));
      }
    }
    for (const node of nodes.values()) {
      if (!connected.has(node.id)) errors.push(`Node "${node.id}" cannot be reached from the trigger.`);
      if (node.config.operation === 'simulate-mitigation' && (parents.get(node.id).size !== 1 ||
          nodes.get(node.config.source)?.type !== 'approval')) errors.push('Simulated mitigation needs exactly one approval dependency.');
      if (node.config.source && (node.config.source === node.id || !dependenciesOf(node.id).has(node.config.source))) {
        errors.push(`Node "${node.id}" must select a source that is upstream.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
