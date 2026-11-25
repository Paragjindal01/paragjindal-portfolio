import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, createSnapshot, history, SCENARIOS } from '../src/index.mjs';

test('snapshots are deterministic, with 15-minute intervals and no shared mutable records', () => {
  const first = createSnapshot({ scenario: 'warning', step: 6 });
  assert.deepEqual(first, createSnapshot({ scenario: 'warning', step: 6 }));
  first.facilities[0].name = 'changed';
  assert.equal(createSnapshot().facilities[0].name, 'Alder Research Facility');
  const [start, next] = history('normal', 2);
  assert.equal(Date.parse(next.timestamp) - Date.parse(start.timestamp), 900_000);
});

test('all scenarios reconcile inventory links and power across racks, outlets and phases', () => {
  for (const scenario of SCENARIOS) {
    for (const frame of history(scenario, 24)) {
      const devices = [...frame.servers, ...frame.switches];
      const occupied = frame.pdus.flatMap(({ outlets }) => outlets.filter(({ deviceId }) => deviceId));
      assert.equal(new Set(occupied.map(({ deviceId }) => deviceId)).size, devices.length);
      assert.equal(analyze(frame).totalPowerW, devices.reduce((sum, item) => sum + item.powerW, 0));
      for (const pdu of frame.pdus) {
        assert.equal(pdu.powerW, pdu.outlets.reduce((sum, outlet) => sum + outlet.powerW, 0));
        assert.equal(pdu.powerW, Object.values(pdu.phaseWatts).reduce((sum, watts) => sum + watts, 0));
        for (const outlet of pdu.outlets.filter(({ deviceId }) => deviceId)) {
          const device = devices.find(({ id }) => id === outlet.deviceId);
          assert.equal(device.rackId, pdu.rackId);
          assert.equal(device.powerW, outlet.powerW);
        }
      }
      for (const rack of frame.racks) {
        assert.ok(frame.rooms.some(({ id }) => rack.roomId === id));
        const slots = devices.filter(({ rackId }) => rackId === rack.id).flatMap(({ u, heightU }) => Array.from({ length: heightU }, (_, index) => u + index));
        assert.equal(slots.length, new Set(slots).size);
        assert.ok(slots.every((slot) => slot > 0 && slot <= rack.units));
      }
      assert.ok(frame.workloads.every(({ hostId, ip }) => ip.startsWith('192.0.2.') && frame.servers.some(({ id }) => id === hostId)));
    }
  }
});

test('scenario severity changes and malformed inputs are rejected', () => {
  assert.equal(createSnapshot().alerts.length, 0);
  assert.ok(createSnapshot({ scenario: 'warning' }).alerts.some(({ metric }) => metric === 'ambientC'));
  const critical = createSnapshot({ scenario: 'critical' });
  assert.ok(critical.alerts.some(({ severity, metric }) => severity === 'critical' && metric === 'availability'));
  assert.ok(createSnapshot({ scenario: 'recovery' }).alerts.length < critical.alerts.length);
  for (const options of [{ step: -1 }, { step: 1.25 }, { step: Infinity }, { scenario: 'live' }]) assert.throws(() => createSnapshot(options), RangeError);
  assert.throws(() => history('normal', 97), RangeError);
  assert.throws(() => analyze({ mode: 'live', schemaVersion: 2 }), TypeError);
});
