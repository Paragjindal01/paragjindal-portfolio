import assert from 'node:assert/strict';
import test from 'node:test';
import { readAiConfiguration, prepareModelRequest, runModel } from './lab-ai.mjs';
import { createSnapshot } from '../src/lab/simulator.mjs';
import { runTool } from '../src/lab/apps/infrapilot.mjs';

const request = {
  provider: 'ollama',
  question: 'Which GPU threshold applies?',
  sources: [{ id: 'runbook:1', title: 'Test runbook', text: 'Investigate all synthetic GPU temperatures above 85 °C.' }],
};

test('provider configuration holds local boundaries and disables external sending by default', () => {
  assert.throws(() => readAiConfiguration({ LAB_AI_ORIGIN: 'https://malicious.example' }), /loopback/);
  assert.throws(() => readAiConfiguration({ OLLAMA_URL: 'http://localhost.example:11434' }), /loopback/);
  assert.throws(() => readAiConfiguration({ LAB_AI_EXTERNAL_KEY: 'fictional' }), /requires/);
  assert.equal(readAiConfiguration({}).external, null);
  assert.throws(() => readAiConfiguration({ LAB_AI_EXTERNAL_URL: 'http://example.test/api', LAB_AI_EXTERNAL_MODEL: 'test', LAB_AI_EXTERNAL_KEY: 'fictional' }), /HTTPS/);
});

test('providers receive bounded read-only data and local model citations are checked', async () => {
  const config = readAiConfiguration({});
  const response = await runModel('localmind', request, config, async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    const payload = JSON.parse(options.body);
    assert.equal(payload.format, 'json');
    assert.match(payload.messages[0].content, /quoted data/);
    assert.deepEqual(JSON.parse(payload.messages[1].content).sources, request.sources);
    return Response.json({ message: { content: JSON.stringify({ text: 'The threshold is 85 °C.', citations: ['runbook:1'] }) } });
  });
  assert.deepEqual(response, { provider: 'ollama', text: 'The threshold is 85 °C.', citations: ['runbook:1'] });
  await assert.rejects(() => runModel('localmind', request, config, async () => Response.json({ message: { content: '{"text":"unsupported","citations":["invented"]}' } })), /validation/);
  await assert.rejects(() => runModel('localmind', { ...request, provider: 'external' }, config), /disabled/);
  assert.throws(() => prepareModelRequest('localmind', { ...request, sources: [request.sources[0], request.sources[0]] }), /distinct/);
});

test('the external adapter sends its key only in the upstream authorization header', async () => {
  const config = readAiConfiguration({
    LAB_AI_EXTERNAL_URL: 'https://example.test/v1/chat/completions',
    LAB_AI_EXTERNAL_KEY: 'fictional-key',
    LAB_AI_EXTERNAL_MODEL: 'fictional-model',
  });
  const result = runTool('report', createSnapshot());
  const generated = await runModel('infrapilot', { provider: 'external', question: 'Daily report', result }, config, async (url, options) => {
    assert.equal(url, config.external.url);
    assert.equal(options.headers.Authorization, 'Bearer fictional-key');
    assert.ok(!options.body.includes('fictional-key'));
    return Response.json({ choices: [{ message: { content: '{"text":"Synthetic report summary"}' } }] });
  });
  assert.deepEqual(generated, { provider: 'external', text: 'Synthetic report summary' });
});
