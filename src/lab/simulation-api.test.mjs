import { test } from 'node:test';
import assert from 'node:assert/strict';
import api from '../../api/simulation.js';

const request = (query = '', method = 'GET') => api.fetch(new Request(`http://localhost/api/simulation${query}`, { method }));

test('API serves deterministic snapshots and health report for valid requests', async () => {
  const response = request('?scenario=critical&step=9');
  assert.equal(response.status, 200);
  const { snapshot, health } = await response.json();
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.step, 9);
  assert.equal(snapshot.scenario, 'critical');
  assert.deepEqual(snapshot.alerts, health.alerts);
  assert.deepEqual(await request('?scenario=critical&step=9').json(), { snapshot, health });
});

test('API rejects invalid query parameters and non-GET methods', () => {
  for (const query of ['?step=-1', '?step=', '?step=1.5', '?step=1000001', '?scenario=live']) assert.equal(request(query).status, 400);
  const response = request('', 'POST');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});
