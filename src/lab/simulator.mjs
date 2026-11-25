export const SCENARIOS = Object.freeze(['normal', 'warning', 'critical', 'recovery']);
export const MAX_STEP = 1_000_000;
const START_TIME = Date.UTC(2026, 0, 12, 8);
const INTERVAL_MS = 15 * 60_000;
const GPU_LIMIT = 80;
const PHASES = ['A', 'B', 'C'];
const FACILITY = { id: 'LAB-F01', name: 'Alder Research Facility' };
const ROOMS = [
  { id: 'LAB-RM01', name: 'Compute Hall', facilityId: FACILITY.id },
  { id: 'LAB-RM02', name: 'Systems Hall', facilityId: FACILITY.id },
];
const HARDWARE = [
  { kind: 'gpu', name: 'Accelerator node', u: 7, heightU: 4, cpuCores: 64, memoryTotalGiB: 256, storageTotalTB: 7.68, os: 'Ubuntu 24.04 LTS' },
  { kind: 'compute', name: 'Compute node', u: 16, heightU: 2, cpuCores: 32, memoryTotalGiB: 128, storageTotalTB: 3.84, os: 'Debian 13' },
  { kind: 'management', name: 'Management node', u: 22, heightU: 1, cpuCores: 16, memoryTotalGiB: 64, storageTotalTB: 1.92, os: 'Debian 13' },
  { kind: 'storage', name: 'Storage node', u: 2, heightU: 4, cpuCores: 24, memoryTotalGiB: 128, storageTotalTB: 76.8, os: 'Rocky Linux 9' },
];
const profiles = {
  normal: { heat: 0, load: 0, humidity: 0 },
  warning: { heat: 8, load: 12, humidity: 11 },
  critical: { heat: 15, load: 53, humidity: 17 },
  recovery: { heat: 3, load: -13, humidity: 4 },
};

function networkAddress(index, prefix) {
  return { ip: `192.0.2.${index}`, mac: `02:00:00:00:${prefix}:${index.toString(16).padStart(2, '0')}` };
}

function collectAlerts({ racks, servers, pdus }) {
  const alerts = [];
  for (const rack of racks) {
    if (rack.ambientC >= 29) alerts.push({ severity: rack.ambientC >= 35 ? 'critical' : 'warning', assetId: rack.id, metric: 'ambientC', value: rack.ambientC, threshold: 29, recommendation: 'Check the simulated cooling path and inspect the rack intake.' });
    if (rack.humidityPercent >= 60) alerts.push({ severity: 'warning', assetId: rack.id, metric: 'humidityPercent', value: rack.humidityPercent, threshold: 60, recommendation: 'Review the simulated humidity trend.' });
  }
  for (const server of servers) {
    if (server.status === 'offline') alerts.push({ severity: 'critical', assetId: server.id, metric: 'availability', value: 0, threshold: 1, recommendation: 'Review the synthetic inventory and last reported host state.' });
    for (const gpu of server.gpus) {
      if (gpu.temperatureC >= GPU_LIMIT) alerts.push({ severity: gpu.temperatureC >= 90 ? 'critical' : 'warning', assetId: gpu.id, metric: 'gpuTemperatureC', value: gpu.temperatureC, threshold: GPU_LIMIT, recommendation: 'Review accelerator workload placement and simulated cooling.' });
    }
  }
  for (const pdu of pdus) {
    const utilization = pdu.powerW / pdu.ratedW;
    if (utilization >= 0.8) alerts.push({ severity: utilization >= 1 ? 'critical' : 'warning', assetId: pdu.id, metric: 'powerUtilization', value: utilization, threshold: 0.8, recommendation: 'Review the rack power budget and available outlet allocation.' });
  }
  return alerts;
}

export function createSnapshot({ scenario = 'normal', step = 0 } = {}) {
  if (!SCENARIOS.includes(scenario)) throw new RangeError('Scenario must be normal, warning, critical or recovery.');
  if (!Number.isSafeInteger(step) || step < 0 || step > MAX_STEP) throw new RangeError(`Step must be an integer from 0 to ${MAX_STEP}.`);
  const profile = profiles[scenario];
  const racks = Array.from({ length: 4 }, (_, index) => {
    const id = `LAB-R0${index + 1}`;
    const ambientC = 22 + index + (step % 5) / 2 + (index === 1 ? profile.heat : 0);
    const humidityPercent = 43 + index * 2 + step % 5 + (index === 1 ? profile.humidity : 0);
    return { id, name: `Rack ${index + 1}`, roomId: ROOMS[Math.floor(index / 2)].id, x: 20 + (index % 2) * 45, y: 42, units: 24, ambientC, humidityPercent, capacityW: index === 1 ? 2230 : 2750, networkPercent: 22 + (step * 9 + index * 11) % 54, status: ambientC >= 35 ? 'critical' : ambientC >= 29 || humidityPercent >= 60 ? 'warning' : 'online' };
  });
  const servers = racks.flatMap((rack, rackIndex) => HARDWARE.map((hardware, index) => {
    const number = rackIndex * HARDWARE.length + index + 1;
    const hotspot = rackIndex === 1;
    const offline = scenario === 'critical' && hotspot && hardware.kind === 'storage';
    const id = `SIM-S${String(number).padStart(2, '0')}`;
    const activity = offline ? 0 : Math.max(5, Math.min(98, 24 + (step * 17 + number * 13) % 60 + (hotspot ? profile.load : 0)));
    const gpus = hardware.kind === 'gpu' ? [0, 1, 2, 3].map((gpuIndex) => {
      const utilizationPercent = Math.min(100, activity + gpuIndex * 3);
      const temperatureC = Math.round(39 + utilizationPercent * 0.43 + (hotspot ? profile.heat * 1.5 : 0));
      return { id: `${id}-GPU${gpuIndex + 1}`, model: 'Lab Accelerator 48', utilizationPercent, temperatureC, vramUsedGiB: Math.round(utilizationPercent * 0.43), vramTotalGiB: 48, powerW: Math.round(35 + utilizationPercent * 2.9) };
    }) : [];
    const gpuTemperatureC = Math.max(0, ...gpus.map((gpu) => gpu.temperatureC));
    const powerW = offline ? 0 : 95 + activity * (index === 0 ? 3 : 2) + gpus.reduce((sum, gpu) => sum + gpu.powerW, 0);
    return {
      ...hardware, id, name: `${hardware.name} ${number}`,
      rackId: rack.id, pduId: `SIM-P${rackIndex + 1}`, outlet: index + 1,
      cpuPercent: activity, gpuPercent: gpus.length ? Math.round(gpus.reduce((sum, gpu) => sum + gpu.utilizationPercent, 0) / gpus.length) : 0,
      gpuTemperatureC, gpus, powerW, memoryUsedGiB: Math.round(activity * hardware.memoryTotalGiB / 120),
      storageUsedTB: Number((hardware.storageTotalTB * (0.31 + number % 5 / 12)).toFixed(2)),
      interfaces: [{ name: 'eth0', ...networkAddress(number + 10, '10'), speedGbps: index === 0 ? 100 : 25 }],
      status: offline ? 'offline' : gpuTemperatureC >= 90 ? 'critical' : gpuTemperatureC >= GPU_LIMIT ? 'warning' : 'online',
    };
  }));
  const switches = racks.map((rack, index) => ({ id: `SIM-SW${index + 1}`, name: `Top-of-rack switch ${index + 1}`, kind: 'switch', rackId: rack.id, u: 24, heightU: 1, pduId: `SIM-P${index + 1}`, outlet: 5, networkPercent: rack.networkPercent, powerW: 65 + rack.networkPercent, status: 'online' }));
  const pdus = racks.map((rack, index) => {
    const id = `SIM-P${index + 1}`;
    const equipment = [...servers.filter((server) => server.rackId === rack.id), switches[index]];
    const outlets = Array.from({ length: 9 }, (_, offset) => {
      const device = equipment[offset];
      return { id: `${id}-O${String(offset + 1).padStart(2, '0')}`, number: offset + 1, serverId: device?.id ?? null, deviceId: device?.id ?? null, ratedW: offset === 0 ? 1600 : 450, phase: PHASES[offset % PHASES.length], powerW: device?.powerW ?? 0, state: 'on' };
    });
    const phaseWatts = Object.fromEntries(PHASES.map((phase) => [phase, outlets.filter((outlet) => outlet.phase === phase).reduce((sum, outlet) => sum + outlet.powerW, 0)]));
    return { id, name: `Metered PDU ${index + 1}`, rackId: rack.id, ratedW: rack.capacityW, powerW: Object.values(phaseWatts).reduce((sum, watts) => sum + watts, 0), phaseWatts, outlets };
  });
  const workloads = servers.flatMap((server, index) => [
    { id: `SIM-VM${index + 1}`, name: `lab-vm-${index + 1}`, hostId: server.id, type: 'vm', os: 'Ubuntu 24.04 LTS', cpuCores: 4 + index % 3 * 2, memoryGiB: 8 + index % 3 * 4, storageGiB: 80, ...networkAddress(index + 50, '20'), status: server.status === 'offline' ? 'stopped' : 'running' },
    ...(index % 2 === 0 ? [{ id: `SIM-CT${index + 1}`, name: `lab-container-${index + 1}`, hostId: server.id, type: 'container', os: 'Alpine Linux', cpuCores: 2, memoryGiB: 4, storageGiB: 24, ...networkAddress(index + 100, '30'), status: server.status === 'offline' ? 'stopped' : 'running' }] : []),
  ]);
  const snapshot = { schemaVersion: 2, mode: 'simulation', scenario, step, timestamp: new Date(START_TIME + step * INTERVAL_MS).toISOString(), facilities: [{ ...FACILITY }], rooms: ROOMS.map((room) => ({ ...room })), racks, servers, switches, pdus, workloads };
  return { ...snapshot, alerts: collectAlerts(snapshot) };
}

export function history(scenario, steps = 24) {
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > 96) throw new RangeError('History must contain 1 to 96 steps.');
  return Array.from({ length: steps }, (_, step) => createSnapshot({ scenario, step }));
}

export function analyze(snapshot) {
  if (snapshot?.schemaVersion !== 2 || snapshot.mode !== 'simulation') throw new TypeError('A version 2 simulation snapshot is required.');
  return { mode: snapshot.mode, scenario: snapshot.scenario, step: snapshot.step, serverCount: snapshot.servers.length, totalPowerW: snapshot.pdus.reduce((sum, pdu) => sum + pdu.powerW, 0), alerts: collectAlerts(snapshot) };
}
