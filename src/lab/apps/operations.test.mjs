import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot, history } from '../simulator.mjs';
import { parseGpuMetrics } from '../../../tools/gpuwatch-nvml.mjs';
import { collectProxmoxInventory } from '../../../tools/proxmox-inventory.mjs';
import { gpuRows, historicalSeries } from './gpuwatch.mjs';
import { scenarioWindow, toCsv } from './monitoring.mjs';
import { createPowerAdapter, historicalEnergy, loadStatus, phaseBalance } from './powerops.mjs';
import { compareInventory, filterInventory, inventoryFromSnapshot } from './virtscan.mjs';

test('GPU warnings, filters and the modeled overheating scenario', () => {
  const normal = gpuRows(createSnapshot({ scenario: 'normal' }));
  const critical = gpuRows(createSnapshot({ scenario: 'critical' }));
  assert.equal(normal.length, 16);
  assert.equal(critical.some(({ warnings }) => warnings.includes('GPU temperature')), true);
  const { server, gpu } = critical.find(({ warnings }) => warnings.includes('GPU temperature'));
  assert.equal(gpuRows(createSnapshot({ scenario: 'critical' }), { serverId: server.id, gpuId: gpu.id }).length, 1);
  assert.equal(gpuRows(createSnapshot(), { thresholds: { temperatureC: 1, vramPercent: 100, cpuPercent: 100 } })
    .every(({ warnings }) => warnings.includes('GPU temperature')), true);
});

test('GPU history counts each server once and returns deterministic trend values', () => {
  const samples = history('warning', 4);
  const series = historicalSeries(samples, 'power');
  const total = samples[0].servers.filter((server) => server.gpus.length > 0)
    .reduce((sum, server) => sum + server.powerW, 0);
  assert.equal(series[0].value, total);
  assert.deepEqual(series, historicalSeries(history('warning', 4), 'power'));
  assert.equal(new Date(series[1].timestamp) - new Date(series[0].timestamp), 15 * 60 * 1000);
});

test('The operational sample window follows the current step past the opening replay', () => {
  assert.equal(scenarioWindow(createSnapshot()).at(-1).step, 23);
  const window = scenarioWindow(createSnapshot({ step: 96, scenario: 'warning' }));
  assert.equal(window[0].step, 73);
  assert.equal(window.at(-1).step, 96);
  assert.equal(window.at(-1).scenario, 'warning');
});

test('PowerOps enforces role, explicit single-use approval, expiry and cancellation', () => {
  let time = 0;
  const adapter = createPowerAdapter({ now: () => time, approvalMs: 1000 });
  const snapshot = createSnapshot();
  const outletId = snapshot.pdus[0].outlets[0].id;
  const request = { outletId, action: 'off', role: 'operator' };
  assert.throws(() => adapter.prepare(snapshot, { ...request, role: 'viewer' }), /Operator role/);
  assert.throws(() => adapter.prepare({ ...snapshot, mode: 'local-api' }, request), /simulated snapshot/);
  assert.throws(() => adapter.prepare(snapshot, { ...request, outletId: 'unknown' }), /was not found/);
  assert.throws(() => adapter.prepare(snapshot, { ...request, action: 'unconfigured' }), /Unknown/);
  assert.throws(() => adapter.confirm(snapshot, { id: 0, role: 'operator' }), /Prepare/);
  const cancelled = adapter.prepare(snapshot, request);
  adapter.cancel(cancelled.id);
  assert.throws(() => adapter.confirm(snapshot, { id: cancelled.id, role: 'operator' }), /Prepare/);
  const revoked = adapter.prepare(snapshot, request);
  assert.throws(() => adapter.confirm(snapshot, { id: revoked.id, role: 'viewer' }), /Operator role/);
  const expiring = adapter.prepare(snapshot, request);
  time += 1000;
  assert.throws(() => adapter.confirm(snapshot, { id: expiring.id, role: 'operator' }), /expired/);
  const allowed = adapter.prepare(snapshot, request);
  adapter.confirm(snapshot, { id: allowed.id, role: 'operator' });
  assert.throws(() => adapter.confirm(snapshot, { id: allowed.id, role: 'operator' }), /Prepare/);
  assert.equal(adapter.history().length, 1);
  assert.equal(adapter.inspect(snapshot)[0].outlets[0].state, 'off');
  assert.equal(snapshot.pdus[0].outlets[0].state, 'on');
});

test('PowerOps reboot is observable and restores configured power on schedule', () => {
  let time = 0;
  const adapter = createPowerAdapter({ now: () => time, rebootMs: 500 });
  const snapshot = createSnapshot();
  const outlet = snapshot.pdus[0].outlets[0];
  const approval = adapter.prepare(snapshot, { outletId: outlet.id, action: 'reboot', role: 'operator' });
  adapter.confirm(snapshot, { id: approval.id, role: 'operator' });
  assert.equal(adapter.inspect(snapshot)[0].outlets[0].state, 'rebooting');
  assert.equal(adapter.inspect(snapshot)[0].powerW, snapshot.pdus[0].powerW - outlet.powerW);
  time += 500;
  assert.equal(adapter.inspect(snapshot)[0].outlets[0].state, 'on');
  assert.equal(adapter.inspect(snapshot)[0].powerW, snapshot.pdus[0].powerW);
});

test('PowerOps computes phase conservation, warning boundary and kWh', () => {
  const snapshot = createSnapshot({ scenario: 'critical' });
  const pdu = snapshot.pdus[1];
  const { phaseWatts, assignments } = phaseBalance(pdu.outlets);
  assert.equal(Object.values(phaseWatts).reduce((sum, watts) => sum + watts, 0), pdu.powerW);
  assert.equal(assignments.length, pdu.outlets.filter((outlet) => outlet.powerW > 0).length);
  assert.equal(loadStatus(80, 100, 80), 'Warning');
  assert.equal(loadStatus(100, 100, 80), 'Overload');
  assert.equal(historicalEnergy([snapshot, snapshot, snapshot, snapshot], pdu.rackId), pdu.powerW / 1000);
});

test('VirtScan normalizes inventory and detects state, addition and removal', () => {
  const baseline = inventoryFromSnapshot(createSnapshot());
  const critical = inventoryFromSnapshot(createSnapshot({ scenario: 'critical' }));
  assert.equal(baseline.assets.filter(({ type }) => type === 'host').length, 16);
  const changes = compareInventory(baseline, critical);
  assert.ok(changes.some((change) => change.detail === 'online → offline'));
  assert.ok(changes.some((change) => change.detail === 'running → stopped'));
  assert.equal(compareInventory(baseline, inventoryFromSnapshot(createSnapshot({ step: 1 }))).some(({ detail }) => detail === 'interfaces'), false);
  const first = baseline.assets[0];
  assert.deepEqual(filterInventory(baseline.assets, { query: first.interfaces[0].ip, type: 'host' }), [first]);
  const modified = { assets: [...baseline.assets.slice(1), { ...first, id: 'SYNTHETIC-NEW' }] };
  assert.deepEqual(compareInventory(baseline, modified).map(({ type }) => type), ['Added', 'Removed']);
});

test('CSV reports quote multiline text and neutralize formula-like fields', () => {
  assert.equal(toCsv([['a"b', '=2+3', -1, '+example', 'one\ntwo']]), '"a""b","\'=2+3","-1","\'+example","one\ntwo"\r\n');
});

test('CSV neutralizes control and full-width spreadsheet formula prefixes', () => {
  const fields = ['\rhidden', '\ttext', '＝1', '\u200B=1', '@cmd'];
  for (const value of fields) assert.equal(toCsv([[value]]), "\"" + "'" + value + "\"\r\n");
});

test('Local NVML adapter parses units and unavailable metrics', () => {
  assert.deepEqual(parseGpuMetrics('0, 99, 4096, 24576, 83, [N/A]\n'), [{
    id: 'gpu-0', utilizationPercent: 99, vramUsedGiB: 4, vramTotalGiB: 24, temperatureC: 83, powerW: null,
  }]);
  assert.throws(() => parseGpuMetrics('0, fake, 4096, 24576, 83, 140.0'), /Unexpected NVIDIA metric format/);
});

test('Proxmox adapter uses one allowlisted read-only route and sanitizes output', async () => {
  const env = { PROXMOX_URL: 'https://pve.example.invalid:8006', PROXMOX_TOKEN_ID: 'reader@pve!inventory', PROXMOX_TOKEN_SECRET: 'example-secret' };
  const report = await collectProxmoxInventory(env, { now: () => 0, fetcher: async (url, options) => {
    assert.equal(url.pathname, '/api2/json/cluster/resources');
    assert.equal(url.origin, env.PROXMOX_URL);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.authorization, 'PVEAPIToken=reader@pve!inventory=example-secret');
    return new Response(JSON.stringify({ data: [
      { id: 'qemu/100', type: 'qemu', node: 'fictional-node', maxcpu: 4, maxmem: 1024 ** 3, ignoredSecret: 'unused', name: { value: 'nested' }, status: '\u001B' },
      { id: 'bad\u0000node', type: 'node' },
      { id: 'storage/node1/sim', type: 'storage', maxdisk: 10 * 1024 ** 3 },
      { id: 'pool/unrelated', type: 'pool' },
    ] }));
  } });
  assert.equal(report.mode, 'local-api');
  assert.equal(report.assets.length, 1);
  assert.equal(report.assets[0].memoryGiB, 1);
  assert.equal(report.assets[0].name, 'fictional-node');
  assert.equal(report.assets[0].status, 'unknown');
  assert.equal(report.storage[0].capacityGiB, 10);
  assert.doesNotMatch(JSON.stringify(report), /unused|nested/);
  await assert.rejects(collectProxmoxInventory({ ...env, PROXMOX_URL: 'http://pve.example.invalid' }), /HTTPS origin/);
  await assert.rejects(collectProxmoxInventory({ ...env, PROXMOX_URL: 'https://user@pve.example.invalid' }), /HTTPS origin/);
});
