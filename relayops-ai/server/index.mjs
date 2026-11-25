import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEngine } from './engine.mjs';
import { createHttpServer } from './http.mjs';

function portFrom(env) {
  const raw = env.RELAYOPS_PORT ?? '4174';
  const port = Number(raw);
  if (!/^\d{1,5}$/.test(raw) || port < 1024 || port > 65535) throw new Error('RELAYOPS_PORT must be in 1024–65535.');
  return port;
}

export async function startRelayOps(env = process.env) {
  const [{ executeNode, validateWorkflow, templates, evaluateRun }, { createProviderRouter, providerConfig }] = await Promise.all([
    import('../core/index.mjs'),
    import('../core/providers.mjs'),
  ]);
  const host = env.RELAYOPS_HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '::1', '0.0.0.0'].includes(host)) throw new Error('Choose a supported RelayOps bind address.');
  const port = portFrom(env);
  const allowConnected = env.RELAYOPS_CONNECTED === '1';
  if (allowConnected && host === '0.0.0.0') throw new Error('Connected execution requires a loopback bind.');
  const originAllowlist = (env.RELAYOPS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (originAllowlist.some((origin) => {
    const url = new URL(origin);
    return url.origin !== origin || !['http:', 'https:'].includes(url.protocol);
  })) throw new Error('RELAYOPS_ORIGINS must contain exact HTTP(S) origins.');
  const provider = allowConnected ? createProviderRouter(providerConfig(env)) : undefined;
  const engine = createEngine({
    path: env.RELAYOPS_DB ?? 'data/relayops.sqlite',
    validateWorkflow, executeNode, templates, evaluateRun, allowConnected, provider,
  });
  const server = createHttpServer({
    engine, templates, providerHealth: () => provider?.health?.() ?? [{ provider: 'offline', status: 'available' }],
    connected: allowConnected, directory: resolve(env.RELAYOPS_DIST ?? 'dist'),
    originAllowlist,
  });
  try {
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); done(); });
    });
  } catch (error) {
    await engine.close();
    throw error;
  }
  console.log(JSON.stringify({ event: 'relayops.listening', host, port, mode: allowConnected ? 'local-connected' : 'offline', persistence: 'sqlite' }));
  return {
    server, engine,
    async close() {
      server.disconnectStreams();
      await new Promise((done) => server.close(done));
      await engine.close();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const app = await startRelayOps();
    let closing = false;
    const shutDown = async () => {
      if (closing) return;
      closing = true;
      await app.close();
      console.log(JSON.stringify({ event: 'relayops.stopped' }));
    };
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, shutDown);
  } catch (error) {
    console.error(JSON.stringify({ event: 'relayops.start_error', message: error.message }));
    process.exitCode = 1;
  }
}
