import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot } from '../simulator.mjs';
import {
  captureAnalysisContext, chooseTool, decideHandoff, EXAMPLE_QUERIES, filterActivity, listOutlets, normalizeInventory, prepareHandoff, runTool, validateToolResult,
} from './infrapilot.mjs';
import {
  answerFromSources, buildIndex, chunkDocument, compareRetrievalSettings, cosine, embed, evaluateRetrieval, SAMPLE_DOCUMENTS, SAMPLE_QUESTIONS, searchIndex,
} from './localmind.mjs';

test('the example infrastructure queries call schema-validated tools without state mutation', () => {
  const snapshot = createSnapshot({ scenario: 'critical' });
  const before = structuredClone(snapshot);
  const names = ['health', 'rackPower', 'gpu', 'outlets', 'report', 'incidents', 'compare', 'underused', 'inventory'];
  for (const [index, query] of EXAMPLE_QUERIES.entries()) {
    const tool = chooseTool(query);
    assert.equal(tool, names[index]);
    const result = runTool(tool, snapshot);
    assert.equal(result.tool, tool);
    assert.ok(result.rows.length > 0);
    assert.equal(validateToolResult(result), result);
  }
  assert.deepEqual(snapshot, before);
});

test('thermal incidents, GPU rules, and inventory reflect the simulator contract', () => {
  const normal = createSnapshot({ scenario: 'normal' });
  const critical = createSnapshot({ scenario: 'critical' });
  assert.equal(runTool('gpu', normal).rows.length, 0);
  assert.equal(runTool('gpu', critical).rows.length, 4);
  assert.equal(runTool('gpu', critical, { gpuC: 105, inletC: 30, outletPercent: 80 }).rows.length, 0);
  assert.ok(runTool('incidents', critical).rows.some((row) => row.measurement === 'Thermal'));
  assert.equal(runTool('environment', critical).severity, 'critical');
  assert.equal(runTool('report', critical).severity, 'critical');
  assert.equal(normalizeInventory(critical).length, critical.servers.length);
  assert.ok(normalizeInventory(critical)[0].gpuCount > 0);
});

test('the dispatcher rejects unregistered tools, unsupported thresholds, and direct mutating requests', () => {
  const snapshot = createSnapshot();
  assert.throws(() => chooseTool('Reboot this outlet'), /read-only/);
  assert.throws(() => chooseTool('Show me election data'), /does not match/);
  assert.throws(() => runTool('constructor', snapshot), /registered/);
  assert.throws(() => runTool('gpu', snapshot, { gpuC: NaN }), /Thresholds/);
  assert.throws(() => runTool('gpu', { ...snapshot, mode: 'live' }), /simulation/);
  assert.throws(() => validateToolResult({ tool: 'health', rows: [null] }), /schema/);
});

test('a handoff requires a mapped simulated outlet, operator decision, and fresh request', () => {
  const snapshot = createSnapshot();
  const assigned = listOutlets(snapshot).find(({ serverId }) => serverId);
  const unused = listOutlets(snapshot).find(({ serverId }) => !serverId);
  const now = 1700000000000;
  assert.throws(() => prepareHandoff(snapshot, unused.id, 'reboot', now, 'request'), /assigned/);
  assert.throws(() => prepareHandoff(snapshot, assigned.id, 'replace', now, 'request'), /supported/);
  const request = prepareHandoff(snapshot, assigned.id, 'reboot', now, 'request');
  assert.equal(request.outletId, assigned.id);
  assert.equal(request.status, 'pending');
  assert.throws(() => decideHandoff(request, 'viewer', true, now), /operator/);
  assert.throws(() => decideHandoff(request, 'operator', true, request.expiresAt), /expired/);
  assert.throws(() => decideHandoff(request, 'operator', 'true', now), /explicit/);
  const approved = decideHandoff(request, 'operator', true, now + 2000);
  assert.equal(approved.status, 'approved');
  assert.throws(() => decideHandoff(approved, 'operator', true, now + 3000), /no longer/);
  assert.equal(assigned.state, 'on');
});

test('chunking is stable, bounded, and overlaps the expected word ranges', () => {
  const document = { id: 'source', title: 'Example', text: Array.from({ length: 83 }, (_, index) => 'word' + (index + 1)).join(' ') };
  const chunks = chunkDocument(document, 30, 10);
  assert.deepEqual(chunks.map(({ startWord, endWord }) => [startWord, endWord]), [[1, 30], [21, 50], [41, 70], [61, 83]]);
  assert.equal(chunks.at(-1).id, 'source:4');
  assert.throws(() => chunkDocument(document, 30, 30), /overlap/);
  assert.throws(() => buildIndex([document, document]), /unique/);
  assert.throws(() => buildIndex([{ ...document, text: 'word '.repeat(4050) }], 30, 29), /4,000 chunks/);
});

test('offline embeddings use alias expansion and deterministic normalized sparse vectors', () => {
  const gpu = embed('graphics accelerator heat');
  const alias = embed('gpu gpu temperature');
  assert.deepEqual(gpu, alias);
  assert.ok(Math.abs(cosine(gpu, gpu) - 1) < 1e-10);
  assert.ok(cosine(gpu, embed('tropical fruit pie')) < 0.2);
});

test('sample retrieval ranks source documents and supports abstention', () => {
  const index = buildIndex(SAMPLE_DOCUMENTS);
  const evaluation = evaluateRetrieval(index, SAMPLE_QUESTIONS);
  assert.equal(evaluation.recall, 1);
  assert.equal(evaluation.meanReciprocalRank, 0.875);
  const question = SAMPLE_QUESTIONS[0].query;
  const results = searchIndex(index, question);
  assert.equal(results[0].documentId, 'thermal');
  const answer = answerFromSources(question, results);
  assert.match(answer[0].text, /85 °C/);
  assert.ok(answer.every(({ sourceId }) => results.some(({ id }) => sourceId === id)));
  assert.deepEqual(searchIndex(index, 'unrelated nonexistent vocabulary'), []);
  assert.deepEqual(answerFromSources(question, []), []);
});

test('new private text can be retrieved and leaves the index when removed', () => {
  const source = { id: 'synthetic', title: 'Fictional field notes', text: 'The zephyr index tracks synthetic canary markers across the field. Run the zephyr check before taking a backup.' };
  assert.equal(searchIndex(buildIndex([source]), 'zephyr backup')[0].documentId, 'synthetic');
  assert.deepEqual(searchIndex(buildIndex([]), 'zephyr backup'), []);
});

test('extractive answers preserve decimal measurements in complete sentences', () => {
  const query = 'What does a 1.5 kW load consume?';
  const result = answerFromSources(query, searchIndex(buildIndex(SAMPLE_DOCUMENTS), query));
  assert.ok(result.some(({ text }) => text.includes('A 1.5 kW load over four hours uses 6 kWh.')));
});

test('activity evidence captures the original synthetic frame and filters report-bearing events', () => {
  const snapshot = createSnapshot({ scenario: 'critical', step: 3 });
  const thresholds = { gpuC: 90, inletC: 30, outletPercent: 80 };
  const context = captureAnalysisContext(snapshot, thresholds);
  thresholds.gpuC = 100;
  assert.deepEqual(context, {
    simulatorSchemaVersion: snapshot.schemaVersion, scenario: 'critical', step: 3,
    capturedTelemetryAt: snapshot.timestamp, thresholds: { gpuC: 90, inletC: 30, outletPercent: 80 },
  });
  const history = [
    { id: 'query', context, result: runTool('gpu', snapshot) },
    { id: 'approval', context, result: null },
    { id: 'report', context: captureAnalysisContext(createSnapshot()), result: runTool('report', createSnapshot()) },
  ];
  assert.deepEqual(filterActivity(history, { scenario: 'critical', resultsOnly: true }).map(({ id }) => id), ['query']);
  assert.deepEqual(filterActivity(history, { resultsOnly: true }).map(({ id }) => id), ['query', 'report']);
  assert.throws(() => captureAnalysisContext({ ...snapshot, mode: 'live' }), /simulation frame/);
});

test('candidate index comparison evaluates the same queries and reports rank direction without modifying the active index', () => {
  const active = { size: 70, overlap: 12 };
  const candidate = { size: 120, overlap: 20 };
  const index = buildIndex(SAMPLE_DOCUMENTS, active.size, active.overlap);
  const report = compareRetrievalSettings(SAMPLE_DOCUMENTS, SAMPLE_QUESTIONS, index, active, candidate);
  assert.equal(report.baseline.chunkCount, 9);
  assert.equal(report.candidate.chunkCount, 5);
  assert.equal(report.baseline.recall, 1);
  assert.equal(report.candidate.meanReciprocalRank, 0.875);
  assert.equal(index.chunks.length, 9);
  assert.ok(report.cases.every(({ outcome }) => outcome === 'unchanged'));
  assert.throws(() => compareRetrievalSettings(SAMPLE_DOCUMENTS, [null], index, active, candidate), /expected document/);
  assert.throws(() => compareRetrievalSettings(SAMPLE_DOCUMENTS, SAMPLE_QUESTIONS, index, active, { size: 30, overlap: 30 }), /overlap/);
  const distinct = compareRetrievalSettings(SAMPLE_DOCUMENTS, SAMPLE_QUESTIONS, index, active, { size: 30, overlap: 20 });
  assert.deepEqual(distinct.cases.map(({ outcome }) => outcome), ['unchanged', 'unchanged', 'unchanged', 'improved']);
});
