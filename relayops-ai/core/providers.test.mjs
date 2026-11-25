import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProviderRouter, providerConfig } from './providers.mjs';
import { evaluateRun, executeNode } from './index.mjs';

const input = { role: 'planning', task: 'Summarize the supplied evidence.', data: { status: 'fictional' } };
const summary = '{"summary":"Grounded sample output."}';
const sampleResponses = {
  openai: { choices: [{ message: { content: summary } }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } },
  anthropic: { content: [{ type: 'text', text: summary }], usage: { input_tokens: 5, output_tokens: 3 } },
  gemini: { candidates: [{ content: { parts: [{ text: 'private reasoning', thought: true }, { text: summary }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 } },
  ollama: { message: { content: summary }, prompt_eval_count: 5, eval_count: 3 },
  compatible: { choices: [{ message: { content: summary } }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } },
};
const env = {
  OPENAI_API_KEY: 'fixture-openai', ANTHROPIC_API_KEY: 'fixture-anthropic', GEMINI_API_KEY: 'fixture-gemini',
  RELAYOPS_OPENAI_MODEL: 'sample-openai', RELAYOPS_ANTHROPIC_MODEL: 'sample-anthropic', RELAYOPS_GEMINI_MODEL: 'sample-gemini',
  RELAYOPS_OLLAMA_MODEL: 'sample-ollama:latest', RELAYOPS_COMPATIBLE_MODEL: 'sample-compatible',
  RELAYOPS_OPENAI_INPUT_USD_PER_M: '2', RELAYOPS_OPENAI_OUTPUT_USD_PER_M: '4',
};

test('provider configuration only accepts known cloud and literal loopback destinations', () => {
  const config = providerConfig(env);
  assert.equal(config.settings.openai.endpoint, 'https://api.openai.com/v1/chat/completions');
  assert.equal(config.settings.gemini.endpoint, 'https://generativelanguage.googleapis.com/v1beta/models/sample-gemini:generateContent');
  assert.equal(config.settings.ollama.endpoint, 'http://127.0.0.1:11434/api/chat');
  assert.equal(providerConfig({ ...env, RELAYOPS_OLLAMA_URL: 'http://[::1]:11434' }).settings.ollama.endpoint, 'http://[::1]:11434/api/chat');
  for (const url of ['http://localhost:11434', 'http://127.0.0.1/metadata', 'http://127.0.0.1@bad.example', 'file:///tmp/model', 'https://example.com']) {
    assert.throws(() => providerConfig({ ...env, RELAYOPS_OLLAMA_URL: url }), /literal loopback/);
  }
  assert.throws(() => providerConfig({ ...env, RELAYOPS_PROVIDER_ORDER: 'openai,openai' }), /duplicate/);
  assert.equal(providerConfig({ RELAYOPS_OPENAI_MODEL: 'sample-openai' }).settings.openai, undefined);
});

test('all optional adapters serialize provider-specific requests and normalize usage', async () => {
  const config = providerConfig(env);
  for (const [name, payload] of Object.entries(sampleResponses)) {
    let time = 100;
    let headerSeen = false;
    const router = createProviderRouter(config, {
      clock: () => time,
      fetcher: async (url, request) => {
        time += 45;
        assert.equal(url, config.settings[name].endpoint);
        assert.equal(request.method, 'POST');
        assert.equal(request.redirect, 'error');
        assert.equal(request.credentials, 'omit');
        const sent = JSON.parse(request.body);
        assert.match(request.body, /untrusted data/);
        assert.match(request.body, /fictional/);
        assert.doesNotMatch(request.body, /fixture-(openai|anthropic|gemini)/);
        assert.equal(sent.tools, undefined);
        if (name === 'openai') headerSeen = request.headers.Authorization === 'Bearer fixture-openai' && sent.max_completion_tokens === 350;
        if (name === 'anthropic') headerSeen = request.headers['x-api-key'] === 'fixture-anthropic' && sent.max_tokens === 350;
        if (name === 'gemini') headerSeen = request.headers['x-goog-api-key'] === 'fixture-gemini' && sent.generationConfig.maxOutputTokens === 350;
        if (name === 'ollama') headerSeen = request.headers.Authorization === undefined && sent.stream === false && sent.options.num_predict === 350;
        if (name === 'compatible') headerSeen = request.headers.Authorization === undefined && sent.max_tokens === 350;
        return Response.json(payload);
      },
    });
    const output = await router({ ...input, provider: name });
    assert.equal(headerSeen, true);
    assert.equal(output.summary, 'Grounded sample output.');
    assert.equal(output.provider, name);
    assert.equal(output.usage.totalTokens, 8);
    assert.equal(output.usage.latencyMs, 45);
    assert.equal(output.usage.estimatedCostUsd, name === 'openai' ? 0.000022 : config.settings[name].local ? 0 : undefined);
    assert.equal(router.health().find((item) => item.name === name).status, 'healthy');
    assert.doesNotMatch(JSON.stringify(router.health()), /fixture-(openai|anthropic|gemini)/);
  }
});

test('bounded fallback recovers from invalid structured output and tracks attempts and usage', async () => {
  const calls = [];
  const config = providerConfig({ ...env, RELAYOPS_PROVIDER_ORDER: 'ollama,compatible' });
  const router = createProviderRouter(config, {
    fetcher: async (endpoint) => {
      calls.push(endpoint);
      return Response.json(calls.length === 1 ? {
        message: { content: '{"summary":"Sample","tool":"denied"}' }, prompt_eval_count: 10, eval_count: 5,
      } : sampleResponses.compatible);
    },
  });
  const output = await router(input);
  assert.equal(output.provider, 'compatible');
  assert.equal(output.usage.totalTokens, 23);
  assert.deepEqual(calls, [config.settings.ollama.endpoint, config.settings.compatible.endpoint]);
  assert.equal(router.health().find(({ name }) => name === 'ollama').status, 'degraded');
  assert.equal(router.health().find(({ name }) => name === 'ollama').failures, 1);
});

test('rate limits stop the model route without fallback or automatic retry', async () => {
  let calls = 0;
  const router = createProviderRouter(providerConfig(env), { fetcher: async () => {
    calls++;
    return new Response('', { status: 429, headers: { 'retry-after': '30' } });
  } });
  await assert.rejects(router(input), { code: 'provider_rate_limited', retryable: false });
  assert.equal(calls, 1);
});

test('known execution budgets cap generation before provider calls and unpriced cloud calls fail closed', async () => {
  const calls = [];
  const config = providerConfig({ ...env, RELAYOPS_PROVIDER_FALLBACK: '0' });
  const router = createProviderRouter(config, {
    fetcher: async (_endpoint, request) => {
      calls.push(JSON.parse(request.body).max_completion_tokens);
      return Response.json(sampleResponses.openai);
    },
  });
  await assert.rejects(router({ ...input, provider: 'openai' }, { budget: { maxTokens: 16 } }), { code: 'execution_budget_exceeded', retryable: false });
  await assert.rejects(router({ ...input, provider: 'gemini' }, { budget: { maxCostUsd: 0.1 } }), /Configure server-side pricing/);
  assert.deepEqual(calls, []);
  await router({ ...input, provider: 'openai' }, { budget: { maxCostUsd: 0.0012, maxTokens: 530 } });
  assert.ok(calls[0] >= 32 && calls[0] < 350);
});

test('agent model calls are explicit, distinguish offline mode and validate output', async () => {
  const node = { id: 'agent', type: 'agent', label: 'Model agent', config: { role: 'coordinator', operation: 'model' } };
  const offline = await executeNode(node, { input: { sample: 1 }, provider: () => assert.fail('offline model must not execute') });
  assert.equal(offline.output.mode, 'offline');
  assert.equal(offline.usage.totalTokens, 0);
  const connected = await executeNode(node, {
    input: { sample: 1 }, mode: 'connected',
    provider: async (request) => {
      assert.deepEqual(request.data, { sample: 1 });
      return { summary: 'Synthetic model fixture.', model: 'sample', provider: 'ollama', usage: { inputTokens: 5, outputTokens: 3 } };
    },
  });
  assert.equal(connected.output.mode, 'connected');
  assert.equal(connected.usage.outputTokens, 3);
  await assert.rejects(executeNode(node, { mode: 'connected', provider: async () => ({ summary: '' }) }), /summary failed validation/);
});

test('evaluation leaves unreported model tokens and unknown cloud pricing unavailable', () => {
  const report = evaluateRun({
    status: 'completed', steps: [{ id: 'model', type: 'agent', status: 'completed',
      output: { mode: 'connected', provider: 'openai' }, usage: {} }],
  });
  assert.equal(report.metrics.tokens, null);
  assert.equal(report.metrics.estimatedCostUsd, null);
});
