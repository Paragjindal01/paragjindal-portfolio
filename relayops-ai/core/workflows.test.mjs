import assert from 'node:assert/strict';
import { test } from 'node:test';
import { correlateIncident, normalizeTelemetry, planResearch, verifyResearch } from './analysis.mjs';
import { boundedJson, parsePublicRepository, publicRepositoryEvidence } from './connectors.mjs';
import { describeDataset, parseDataset } from './datasets.mjs';
import { datasetInput, incidentInput, repositoryInput, researchQuestion } from './fixtures.mjs';
import { evaluateRun, executeNode, templates, validateWorkflow } from './index.mjs';

const template = (id) => structuredClone(templates.find((entry) => entry.id === id));

async function executeTemplate(workflow, input = workflow.inputs, decision = 'approve') {
  const validation = validateWorkflow(workflow);
  assert.deepEqual(validation, { ok: true, errors: [] });
  const results = {};
  const steps = [];
  for (const node of workflow.nodes) {
    const connections = workflow.edges.filter((edge) => edge.target === node.id);
    const active = connections.length === 0 || connections.some((edge) => {
      const source = steps.find((step) => step.id === edge.source);
      return source?.status === 'completed' && (edge.when === undefined || source.output?.passed === Boolean(edge.when));
    });
    if (!active) {
      steps.push({ id: node.id, type: node.type, status: 'skipped' });
      continue;
    }
    if (node.type === 'approval' && decision !== 'approve') {
      steps.push({ id: node.id, type: node.type, status: 'failed', output: { decision } });
      break;
    }
    const result = node.type === 'approval' ? { output: { decision } } : await executeNode(node, { input, results, mode: 'offline' });
    results[node.id] = result.output;
    steps.push({ id: node.id, type: node.type, status: 'completed', ...result });
  }
  return { results, steps, status: steps.some((step) => step.status === 'failed') ? 'failed' : 'completed', workflow };
}

test('graph validation rejects cycles, disconnected actions, unknown operations and wrong branch kinds', () => {
  const cyc = template('github-review');
  cyc.edges.push({ source: 'report', target: 'review' });
  assert.match(validateWorkflow(cyc).errors.join(' '), /acyclic/);
  const graph = template('incident-investigator');
  graph.edges.find((edge) => edge.target === 'mitigation').source = 'report';
  graph.edges.find((edge) => edge.target === 'summary').when = 'yes';
  graph.nodes.find((node) => node.id === 'approval').config.operation = 'review';
  const validation = validateWorkflow(graph);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /directly follow.*true or false branch|true or false branch.*directly follow/);
  const invalid = template('research-pipeline');
  invalid.nodes[1].config.operation = 'unrestricted-shell';
  assert.match(validateWorkflow(invalid).errors.join(' '), /supported operation/);
  const unreachable = template('data-analyst');
  unreachable.edges.shift();
  assert.match(validateWorkflow(unreachable).errors.join(' '), /cannot be reached/);
});

test('graph validates upstream source dependencies and bounded retries and budgets', () => {
  const graph = template('data-analyst');
  graph.nodes.find((node) => node.id === 'analysis').config.source = 'report';
  assert.match(validateWorkflow(graph).errors.join(' '), /source that is upstream/);
  graph.nodes[0].config.maxRetries = 4;
  graph.nodes[0].config.timeoutMs = 0;
  graph.budget = { maxTokens: 100001, maxCostUsd: 21 };
  assert.match(validateWorkflow(graph).errors.join(' '), /Retries.*Timeout.*Budgets/);
});

test('standard offline GitHub review cites its fictional evidence without fetching', async () => {
  const report = await executeTemplate(template('github-review'));
  assert.equal(report.results.collect.mode, 'fixture');
  assert.ok(report.results.review.findings.some((value) => /does not describe how to run tests/.test(value.message)));
  assert.ok(report.results.review.findings.some((value) => value.line === 2));
  assert.ok(report.steps.find(({ id }) => id === 'report').artifacts[0].content.includes('bundled fixture'));
  await assert.rejects(publicRepositoryEvidence('https://github.com/example/another', { mode: 'offline', fetcher: () => assert.fail('offline must make no requests') }), /bundled sample/);
  assert.equal(evaluateRun(report).score, 100);
});

test('public GitHub connector constructs only fixed GET URLs and immutable citations', async () => {
  const sha = 'aa'.repeat(20);
  const urls = [];
  const manifestName = 'package.json';
  const content = '{"scripts":{"test":"node --test"}}';
  const target = 'https://api.github.com/repos/example/public-repo';
  const responses = new Map([
    [target, { private: false, default_branch: 'main', language: 'JavaScript' }],
    [target + '/commits/main', { sha }],
    [target + '/contents?ref=' + sha, [{ name: manifestName, path: manifestName, type: 'file', size: content.length, download_url: 'http://localhost/honeypot' }]],
    [target + '/contents/package.json?ref=' + sha, { type: 'file', size: content.length, encoding: 'base64', content: btoa(content) }],
  ]);
  const output = await publicRepositoryEvidence('https://github.com/example/public-repo', {
    mode: 'connected',
    fetcher: async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Authorization, undefined);
      urls.push(url);
      assert.ok(responses.has(url), url);
      return Response.json(responses.get(url));
    },
  });
  assert.equal(urls.length, 4);
  assert.equal(output.evidence[0].url, 'https://github.com/example/public-repo/blob/' + sha + '/package.json');
});

test('connector policy rejects other hosts, credentials, arbitrary paths and oversized bodies', async () => {
  for (const value of ['http://github.com/user/repo', 'https://github.com.evil.test/user/repo', 'https://example@github.com/user/repo', 'https://github.com/user/repo/tree/main', 'https://github.com/user/repo?k=v']) {
    assert.throws(() => parsePublicRepository(value), /public GitHub/);
  }
  assert.deepEqual(parsePublicRepository(repositoryInput.repositoryUrl + '.git'), {
    owner: 'relayops-example', repo: 'example-service', fullName: 'relayops-example/example-service',
  });
  const payload = new Response('x'.repeat(64));
  await assert.rejects(boundedJson(async () => payload, 'https://example.test', {}, 32), /exceeds/);
  await assert.rejects(publicRepositoryEvidence('https://github.com/example/closed', {
    mode: 'connected', fetcher: async () => Response.json({ private: true, default_branch: 'main' }),
  }), /unavailable for public review/);
});

test('sample-source research verifies citations and abstains on unrelated questions', async () => {
  const report = await executeTemplate(template('research-pipeline'));
  assert.equal(report.results.verify.mode, 'sample-sources');
  assert.equal(report.results.verify.question, researchQuestion);
  assert.equal(report.results.verify.verified, true);
  assert.equal(report.results.report.sourceCount, 3);
  assert.equal(evaluateRun(report).score, 100);
  const unrelated = await executeTemplate(template('research-pipeline'), { question: 'How tall is Mount Everest?' });
  assert.equal(unrelated.results.verify.verified, false);
  assert.equal(unrelated.results.verify.sources.length, 0);
  assert.match(unrelated.results.verify.summary, /do not provide enough evidence/);
  assert.equal(evaluateRun(unrelated).checks.find(({ id }) => id === 'grounding').passed, false);
  assert.throws(() => planResearch({ question: {} }), /Enter a research question/);
  assert.equal(verifyResearch({ question: 'Test', mode: 'sample-sources', claims: [{
    sourceId: 'sre-postmortems', statement: 'An unsupported paraphrase.',
  }] }).claims.length, 0);
});

test('dataset accepts quoted CSV and JSON scalars, and rejects unsafe shapes', () => {
  const csv = parseDataset({ format: 'csv', dataset: 'name,count\r\n"item,""quoted""",22\r\n"multi\nline",3' });
  assert.deepEqual(csv.rows, [['item,"quoted"', 22], ['multi\nline', 3]]);
  assert.deepEqual(parseDataset({ format: 'json', dataset: '[{"value":true},{"value":null},{"value":"3.5"}]' }).rows, [[true], [null], [3.5]]);
  assert.throws(() => parseDataset({ format: 'csv', dataset: 'a,a\n1,2' }), /unique/);
  assert.throws(() => parseDataset({ format: 'csv', dataset: 'a,b\n"1,2' }), /unclosed/);
  assert.throws(() => parseDataset({ format: 'json', dataset: '[{"__proto__":0}]' }), /unique/);
  assert.throws(() => parseDataset({ format: 'json', dataset: [{ a: 1 }, { b: 3 }] }), /same columns/);
});

test('dataset computes deterministic quartiles, outliers, chart data and export', async () => {
  const stats = describeDataset(parseDataset({ format: 'json', dataset: [1, 1, 2, 3, 20].map((value) => ({ value })) }));
  assert.equal(stats.metrics[0].mean, 5.4);
  assert.equal(stats.metrics[0].q1, 1);
  assert.equal(stats.metrics[0].median, 2);
  assert.equal(stats.metrics[0].q3, 3);
  assert.deepEqual(stats.anomalies, [{ column: 'value', row: 5, value: 20 }]);
  const report = await executeTemplate(template('data-analyst'), datasetInput);
  assert.ok(report.results.analysis.charts.every(({ points }) => points.length === 8));
  assert.ok(report.results.analysis.anomalies.some(({ column, row }) => column === 'latencyMs' && row === 6));
  assert.equal(evaluateRun(report).score, 100);
});

test('incident analysis labels correlation and routes only a critical approved mitigation', async () => {
  const graph = template('incident-investigator');
  const report = await executeTemplate(graph);
  assert.equal(report.results.correlate.severity, 'critical');
  assert.ok(report.results.correlate.hypotheses.some((entry) => entry.evidence.length > 1));
  assert.equal(report.results.mitigation.event, 'simulated-load-limit-applied');
  assert.equal(report.results.mitigation.projectedLoadLimitPct, 70);
  assert.equal(report.steps.find(({ id }) => id === 'summary').status, 'skipped');
  assert.equal(evaluateRun(report).score, 100);
  const rejected = await executeTemplate(graph, graph.inputs, 'reject');
  assert.equal(rejected.status, 'failed');
  assert.equal(rejected.results.mitigation, undefined);
  const baseline = await executeTemplate(graph, { ...graph.inputs, telemetry: graph.inputs.telemetry.slice(0, 1) });
  assert.equal(baseline.steps.find(({ id }) => id === 'approval').status, 'skipped');
  assert.equal(baseline.results.summary.delivery, 'simulated');
  assert.equal(correlateIncident(normalizeTelemetry(incidentInput)).eventCount, 10);
  await assert.rejects(executeNode(graph.nodes.find((node) => node.id === 'mitigation'), {
    input: graph.inputs, results: { correlate: report.results.correlate, approval: { decision: 'reject' } },
  }), /completed human approval/);
  assert.throws(() => normalizeTelemetry({ ...incidentInput, synthetic: false }), /explicitly synthetic/);
});

test('evaluation derives cost, duration, retries and policy checks from observed records', () => {
  const result = evaluateRun({
    status: 'completed', startedAt: 100, finishedAt: 150,
    steps: [{ id: 'mitigation', type: 'transform', attempt: 2, status: 'completed',
      output: { event: 'simulated-load-limit-applied' }, usage: { inputTokens: 10, outputTokens: 2, estimatedCostUsd: 0.1 } }],
  }, template('incident-investigator'));
  assert.deepEqual(result.metrics, { durationMs: 50, tokens: 12, estimatedCostUsd: 0.1 });
  assert.equal(result.checks.find(({ id }) => id === 'approval').passed, false);
  assert.equal(result.checks.find(({ id }) => id === 'recovery').passed, true);
});


test('local document processing extracts headings and excerpts without opening paths', async () => {
  const node = { id: 'text', type: 'transform', label: 'Inspect notes', config: { operation: 'parse-document' } };
  const result = await executeNode(node, { input: { documentTitle: 'Fictional handbook', document: '# Cooling\n\nTeam checks temperatures.\n\n## Schedule' } });
  assert.deepEqual(result.output.headings, [{ line: 1, depth: 1, text: 'Cooling' }, { line: 5, depth: 2, text: 'Schedule' }]);
  assert.equal(result.output.wordCount, 5);
  await assert.rejects(executeNode(node, { input: { documentPath: '/etc/hostname' } }), /Provide TXT or Markdown/);
});


test('late critical telemetry remains available to approved mitigation after alert truncation', async () => {
  const graph = template('incident-investigator');
  const telemetry = Array.from({ length: 120 }, (_, minute) => ({
    asset: 'LAB-SAMPLE', minute, serverCpuPct: 85, gpuC: minute === 119 ? 95 : 79, powerPct: 55, networkPct: 51,
  }));
  const run = await executeTemplate(graph, { ...graph.inputs, telemetry });
  assert.equal(run.results.correlate.events.length, 100);
  assert.equal(run.results.correlate.driver.minute, 119);
  assert.equal(run.results.mitigation.asset, 'LAB-SAMPLE');
  assert.match(run.steps.find(({ id }) => id === 'report').artifacts[0].content, /Minute 119/);
});
