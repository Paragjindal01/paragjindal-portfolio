import { createBrowserEngine } from './browser-engine.mjs';

function createServiceClient() {
  let token;
  try { token = localStorage.getItem('relayops-api-token-v1'); } catch { /* Current tab only. */ }
  let opening;

  async function session() {
    if (token) return token;
    if (!opening) {
      opening = fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(12_000) }).then(async (response) => {
        if (!response.ok) throw Error('Could not start an isolated RelayOps session.');
        const data = await response.json();
        token = data.token;
        try { localStorage.setItem('relayops-api-token-v1', token); } catch { /* Current tab only. */ }
        return token;
      }).finally(() => { opening = null; });
    }
    return opening;
  }

  async function request(path, { body, credentials = true, retry = true, method = body === undefined ? 'GET' : 'POST' } = {}) {
    const headers = { Accept: 'application/json' };
    if (credentials) headers.Authorization = `Bearer ${await session()}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (path === '/runs' && body) headers['Idempotency-Key'] = crypto.randomUUID();
    const response = await fetch(`/api${path}`, { headers, method, signal: AbortSignal.timeout(12_000), body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status === 401 && credentials && retry) {
      token = null;
      return request(path, { body, credentials, method, retry: false });
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      const error = new Error(typeof data?.error === 'string' ? data.error : data?.error?.message || `RelayOps service returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  const pathFor = (id) => `/runs/${encodeURIComponent(id)}`;
  return {
    mode: 'service',
    warning: () => '',
    health: () => request('/health', { credentials: false }),
    workflows: async () => (await request('/workflows')).workflows,
    async versions(id) {
      try { return (await request(`/workflows/${encodeURIComponent(id)}`)).versions; }
      catch (error) { if (error.status === 404) return []; throw error; }
    },
    save: (workflow) => request('/workflows', { body: { workflow } }),
    runs: async () => (await request('/runs')).runs,
    run: async (id) => (await request(pathFor(id))).run,
    launch: async (body) => (await request('/runs', { body })).run,
    approve: async (id, body) => (await request(`${pathFor(id)}/approve`, { body })).run,
    cancel: async (id) => (await request(`${pathFor(id)}/cancel`, { body: {} })).run,
    replay: async (id) => (await request(`${pathFor(id)}/replay`, { body: {} })).run,
    trace: (id) => request(`${pathFor(id)}/replay`),
    evaluate: async (id) => (await request(`${pathFor(id)}/evaluation`)).evaluation,
    webhooks: async () => (await request('/webhooks')).webhooks,
    registerWebhook: (body) => request('/webhooks', { body }),
    revokeWebhook: (id) => request(`/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export const client = import.meta.env.VITE_RELAYOPS_API === '1' ? createServiceClient() : createBrowserEngine();

export function downloadFile(filename, contents, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadJson = (filename, contents) => downloadFile(filename, JSON.stringify(contents, null, 2));
