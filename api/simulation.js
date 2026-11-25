import { analyze, createSnapshot } from '../src/lab/simulator.mjs';

export function simulationResponse(url, method) {
  if (method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'GET' } });
  const { searchParams } = new URL(url);
  const scenario = searchParams.get('scenario') ?? 'normal';
  const rawStep = searchParams.get('step') ?? '0';
  try {
    if (!/^\d{1,7}$/.test(rawStep)) throw new RangeError('Step must be a non-negative integer.');
    const snapshot = createSnapshot({ scenario, step: Number(rawStep) });
    return Response.json({ snapshot, health: analyze(snapshot) }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export default {
  fetch(request) {
    return simulationResponse(request.url, request.method);
  },
};
