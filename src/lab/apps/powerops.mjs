import { percent } from './monitoring.mjs';

const ACTIONS = new Set(['on', 'off', 'reboot']);
const PHASES = ['A', 'B', 'C'];

export function createPowerAdapter({ now = Date.now, rebootMs = 3000, approvalMs = 30_000 } = {}) {
  const overrides = new Map();
  const approvals = new Map();
  const audit = [];
  let sequence = 0;

  function inspect(snapshot) {
    return snapshot.pdus.map((pdu) => {
      const phaseWatts = { A: 0, B: 0, C: 0 };
      const outlets = pdu.outlets.map((outlet) => {
        const override = overrides.get(outlet.id);
        const state = override?.state === 'rebooting' && now() >= override.readyAt
          ? 'on'
          : override?.state ?? outlet.state;
        const powerW = state === 'on' ? outlet.powerW : 0;
        phaseWatts[outlet.phase] += powerW;
        return { ...outlet, state, powerW };
      });
      return { ...pdu, phaseWatts, outlets, powerW: Object.values(phaseWatts).reduce((sum, value) => sum + value, 0) };
    });
  }

  function verify(snapshot, role, outletId, action) {
    if (snapshot.mode !== 'simulation') throw new Error('A simulated snapshot is required.');
    if (role !== 'operator') throw new Error('Operator role is required.');
    if (!ACTIONS.has(action)) throw new Error('Unknown outlet action.');
    const pdu = inspect(snapshot).find((item) => item.outlets.some((outlet) => outlet.id === outletId));
    const outlet = pdu?.outlets.find((item) => item.id === outletId);
    if (!outlet) throw new Error('Outlet was not found.');
    if (outlet.state === 'rebooting') throw new Error('Wait for the current reboot to finish.');
    if (action === 'reboot' && outlet.state !== 'on') throw new Error('Turn the outlet on before rebooting.');
    return { pdu, outlet };
  }

  return {
    inspect,
    history: () => audit.map((entry) => ({ ...entry })),
    prepare(snapshot, { role, outletId, action }) {
      verify(snapshot, role, outletId, action);
      approvals.clear();
      const id = ++sequence;
      const request = { id, outletId, action, expiresAt: now() + approvalMs };
      approvals.set(id, request);
      return { ...request };
    },
    cancel(id) {
      approvals.delete(id);
    },
    confirm(snapshot, { role, id }) {
      const request = approvals.get(id);
      if (!request) throw new Error('Prepare a new simulated action before confirming.');
      approvals.delete(id);
      if (now() >= request.expiresAt) throw new Error('Approval expired. Prepare the action again.');
      const { outletId, action } = request;
      const { pdu, outlet: before } = verify(snapshot, role, outletId, action);
      const timestamp = now();
      const afterState = action === 'reboot' ? 'rebooting' : action;
      overrides.set(outletId, { state: afterState, readyAt: timestamp + rebootMs });
      const after = inspect(snapshot).find((item) => item.id === pdu.id).outlets.find((item) => item.id === outletId);
      const entry = {
        id, timestamp: new Date(timestamp).toISOString(), role, outletId, action, mode: 'simulation',
        pduId: pdu.id, scenario: snapshot.scenario, step: snapshot.step,
        beforeState: before.state, afterState: after.state, beforePowerW: before.powerW, afterPowerW: after.powerW,
      };
      audit.push(entry);
      return { ...entry };
    },
  };
}

export function phaseBalance(outlets) {
  const phaseWatts = { A: 0, B: 0, C: 0 };
  const assignments = [...outlets].filter((outlet) => outlet.powerW > 0)
    .sort((left, right) => right.powerW - left.powerW || left.id.localeCompare(right.id))
    .map((outlet) => {
      const phase = PHASES.reduce((lightest, next) => phaseWatts[next] < phaseWatts[lightest] ? next : lightest);
      phaseWatts[phase] += outlet.powerW;
      return { outletId: outlet.id, number: outlet.number, from: outlet.phase, to: phase, powerW: outlet.powerW };
    });
  return { phaseWatts, assignments };
}

export function loadStatus(watts, ratedWatts, warningPercent) {
  const loadPercent = percent(watts, ratedWatts);
  if (loadPercent >= 100) return 'Overload';
  if (loadPercent >= warningPercent) return 'Warning';
  return 'Normal';
}

export function historicalEnergy(samples, deviceId, stepHours = 0.25) {
  return samples.reduce((total, sample) => {
    const watts = sample.pdus.filter((pdu) => pdu.id === deviceId || pdu.rackId === deviceId)
      .reduce((sum, pdu) => sum + pdu.powerW, 0);
    return total + watts * stepHours / 1000;
  }, 0);
}
