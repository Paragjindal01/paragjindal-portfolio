export const EXAMPLE_QUERIES = [
  'Which servers require attention?',
  'Which rack has the highest power consumption?',
  'Are any GPUs exceeding their configured temperature thresholds?',
  'Which PDU outlets are approaching their allocated capacity?',
  'Generate a daily infrastructure health report.',
  'Recommend actions to resolve the simulated incident.',
  'Compare server utilization across racks.',
  'Identify potentially underutilized computing resources.',
  'Collect and normalize server inventory.',
];

export const THRESHOLDS = Object.freeze({ gpuC: 85, outletPercent: 80, inletC: 30 });
const SEVERITIES = new Set(['normal', 'warning', 'critical']);
const RISK = Object.freeze({ normal: 0, warning: 1, critical: 2 });

const format = (value, unit = '') => Number.isFinite(value) ? Math.round(value * 10) / 10 + unit : 'Unavailable';
const watts = (value) => format(value, ' W');
const percent = (value) => format(value, '%');
const celsius = (value) => format(value, ' °C');
const utilization = (draw, rated) => rated > 0 ? 100 * draw / rated : 0;
const statusSeverity = (status) => status === 'critical' || status === 'offline' ? 'critical' : status === 'warning' ? 'warning' : 'normal';
const row = (asset, measurement, detail, severity = 'normal') => ({ asset, measurement: String(measurement), detail, severity });
const strongest = (rows) => rows.reduce((severity, candidate) => RISK[candidate.severity] > RISK[severity] ? candidate.severity : severity, 'normal');
const sortSeverity = (first, second) => RISK[second.severity] - RISK[first.severity];

export function validateThresholds(thresholds) {
  if (!thresholds || !Number.isFinite(thresholds.gpuC) || thresholds.gpuC < 45 || thresholds.gpuC > 105 ||
      !Number.isFinite(thresholds.inletC) || thresholds.inletC < 15 || thresholds.inletC > 60 ||
      !Number.isFinite(thresholds.outletPercent) || thresholds.outletPercent < 10 || thresholds.outletPercent > 100) {
    throw new Error('Thresholds must be 45–105 °C for GPUs, 15–60 °C for rack inlets, and 10–100% for outlets.');
  }
  return thresholds;
}

export function captureAnalysisContext(snapshot, thresholds = THRESHOLDS) {
  if (snapshot?.mode !== 'simulation' || !Number.isSafeInteger(snapshot.schemaVersion) ||
      !Number.isSafeInteger(snapshot.step) || snapshot.step < 0 || typeof snapshot.scenario !== 'string' ||
      !Number.isFinite(Date.parse(snapshot.timestamp))) {
    throw new Error('A compatible simulation frame is required.');
  }
  const { gpuC, inletC, outletPercent } = validateThresholds(thresholds);
  return {
    simulatorSchemaVersion: snapshot.schemaVersion,
    scenario: snapshot.scenario,
    step: snapshot.step,
    capturedTelemetryAt: snapshot.timestamp,
    thresholds: { gpuC, inletC, outletPercent },
  };
}

export function filterActivity(history, { scenario = '', resultsOnly = false } = {}) {
  return history.filter((item) => (!scenario || item.context.scenario === scenario) && (!resultsOnly || item.result));
}

export function normalizeInventory(snapshot) {
  return snapshot.servers.map((server) => ({
    assetId: server.id,
    name: server.name,
    rackId: server.rackId,
    kind: server.kind,
    status: server.status,
    cpuCores: server.cpuCores,
    ramGiB: server.memoryTotalGiB,
    storageTB: server.storageTotalTB,
    gpuCount: server.gpus.length,
    operatingSystem: server.os,
  })).sort((first, second) => first.assetId.localeCompare(second.assetId));
}

export function listOutlets(snapshot) {
  const names = new Map([...snapshot.servers, ...(snapshot.switches || [])].map((device) => [device.id, device.name]));
  return snapshot.pdus.flatMap((pdu) => pdu.outlets.map((outlet) => ({
    ...outlet,
    pduId: pdu.id,
    pduName: pdu.name,
    rackId: pdu.rackId,
    deviceName: names.get(outlet.serverId || outlet.deviceId) || 'Unassigned',
    utilizationPercent: utilization(outlet.powerW, outlet.ratedW),
  })));
}

function buildResult(tool, title, summary, rows, recommendations = []) {
  return { tool, title, summary, severity: strongest(rows), rows, recommendations };
}

function inventory(snapshot) {
  const hosts = normalizeInventory(snapshot);
  return buildResult('inventory', 'Normalized server inventory', 'Collected ' + hosts.length + ' server records from the simulation snapshot.', hosts.map((host) => row(
    host.name, host.rackId, host.kind + ' · ' + host.cpuCores + ' CPU cores · ' + host.ramGiB + ' GiB · ' + host.storageTB + ' TB · ' + host.gpuCount + ' GPU(s) · ' + host.operatingSystem, statusSeverity(host.status),
  )));
}

function health(snapshot) {
  const warnings = snapshot.servers.filter((server) => statusSeverity(server.status) !== 'normal');
  const rows = warnings.map((server) => row(server.name, server.status, server.rackId + ' · ' + server.kind, statusSeverity(server.status))).sort(sortSeverity);
  return buildResult('health', 'Servers requiring attention', warnings.length + ' of ' + snapshot.servers.length + ' servers are warning, critical, or offline.', rows,
    rows.length ? ['Compare flagged hosts with the same rack and check for correlated thermal, power, or workload changes.'] : []);
}

function gpu(snapshot, thresholds) {
  const devices = snapshot.servers.flatMap((server) => server.gpus.map((device) => ({ device, server })));
  const hot = devices.filter(({ device }) => device.temperatureC >= thresholds.gpuC).sort((a, b) => b.device.temperatureC - a.device.temperatureC);
  return buildResult('gpu', 'GPU temperature thresholds', hot.length + ' of ' + devices.length + ' GPUs meet or exceed ' + celsius(thresholds.gpuC) + '.', hot.map(({ device, server }) => row(
    server.name + ' / ' + device.id, celsius(device.temperatureC), device.model + ' · ' + percent(device.utilizationPercent) + ' GPU usage · ' + server.rackId,
    device.temperatureC >= thresholds.gpuC + 7 ? 'critical' : 'warning',
  )), hot.length ? ['Review GPU workload and fan state, then compare the rack inlet with neighboring hosts.'] : []);
}

function environment(snapshot, thresholds) {
  const flagged = snapshot.racks.filter((rack) => rack.ambientC >= thresholds.inletC || rack.humidityPercent < 25 || rack.humidityPercent > 65);
  const rows = flagged.map((rack) => row(rack.name, celsius(rack.ambientC) + ' · ' + percent(rack.humidityPercent) + ' RH',
    rack.roomId + ' · Temperature threshold ' + celsius(thresholds.inletC) + ' · Humidity band 25–65%', rack.ambientC >= thresholds.inletC + 5 ? 'critical' : 'warning')).sort(sortSeverity);
  return buildResult('environment', 'Rack environmental anomalies', flagged.length + ' rack(s) are outside the configured thermal or humidity band.', rows,
    rows.length ? ['Check the affected aisle and rule out a shared sensor issue before changing simulated cooling.'] : []);
}

function rackPower(snapshot) {
  const ranking = snapshot.racks.map((rack) => ({
    rack,
    draw: snapshot.pdus.filter((pdu) => pdu.rackId === rack.id).reduce((sum, pdu) => sum + pdu.powerW, 0),
  })).sort((a, b) => b.draw - a.draw);
  return buildResult('rackPower', 'Rack power ranking', ranking.length ? ranking[0].rack.name + ' has the highest measured draw at ' + watts(ranking[0].draw) + '.' : 'The snapshot has no racks.', ranking.map(({ rack, draw }) => row(
    rack.name, watts(draw), percent(utilization(draw, rack.capacityW)) + ' of ' + watts(rack.capacityW) + ' rack capacity', draw >= rack.capacityW ? 'critical' : 'normal',
  )));
}

function pdu(snapshot, thresholds) {
  const ranked = snapshot.pdus.map((item) => ({ item, load: utilization(item.powerW, item.ratedW) })).sort((a, b) => b.load - a.load);
  return buildResult('pdu', 'PDU utilization', ranked.length + ' simulated PDUs, ranked by the percentage of rated capacity used.', ranked.map(({ item, load }) => row(
    item.name, percent(load), watts(item.powerW) + ' of ' + watts(item.ratedW) + ' · ' + item.rackId, load >= 100 ? 'critical' : load >= thresholds.outletPercent ? 'warning' : 'normal',
  )));
}

function outlets(snapshot, thresholds) {
  const high = listOutlets(snapshot).filter(({ utilizationPercent }) => utilizationPercent >= thresholds.outletPercent).sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  return buildResult('outlets', 'Outlets near allocated capacity', high.length + ' outlet(s) meet or exceed the ' + percent(thresholds.outletPercent) + ' warning threshold.', high.map((outlet) => row(
    outlet.pduName + ' / ' + outlet.number, percent(outlet.utilizationPercent), outlet.deviceName + ' · ' + watts(outlet.powerW) + ' of ' + watts(outlet.ratedW) + ' · Phase ' + outlet.phase,
    outlet.utilizationPercent >= 100 ? 'critical' : 'warning',
  )), high.length ? ['Verify outlet-to-device mapping and compare phase headroom before proposing a move in PowerOps.'] : []);
}

function alertClass(metric) {
  if (/temperature|thermal|humidity|ambient/i.test(metric)) return 'Thermal';
  if (/power|outlet|phase/i.test(metric)) return 'Power';
  if (/network|link/i.test(metric)) return 'Network';
  if (/cpu|gpu|memory|storage/i.test(metric)) return 'Capacity';
  return 'Equipment health';
}

function incidents(snapshot) {
  const rows = snapshot.alerts.map((alert) => row(String(alert.assetId), alertClass(alert.metric), alert.metric + ': ' + alert.value + ' · Threshold ' + alert.threshold, statusSeverity(alert.severity))).sort(sortSeverity);
  const recommendations = [...new Set(snapshot.alerts.map(({ recommendation }) => recommendation).filter(Boolean))];
  const critical = rows.filter(({ severity }) => severity === 'critical').length;
  return buildResult('incidents', 'Incident classification and triage', rows.length + ' active alert(s), including ' + critical + ' critical.', rows, recommendations);
}

function compare(snapshot) {
  const ranking = snapshot.racks.map((rack) => {
    const hosts = snapshot.servers.filter(({ rackId, status }) => rackId === rack.id && status !== 'offline');
    const mean = hosts.length ? hosts.reduce((sum, host) => sum + host.cpuPercent, 0) / hosts.length : null;
    return { name: rack.name, count: hosts.length, mean };
  }).sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1));
  return buildResult('compare', 'CPU utilization across racks', 'Mean CPU utilization per rack across reachable hosts in this snapshot.', ranking.map(({ name, count, mean }) => row(
    name, percent(mean), count + ' reporting host(s)',
  )));
}

function underused(snapshot) {
  const candidates = snapshot.servers
    .filter(({ status, cpuPercent, gpus, gpuPercent }) => status === 'online' && cpuPercent < 30 && (gpus.length === 0 || gpuPercent < 25))
    .sort((a, b) => a.cpuPercent - b.cpuPercent);
  return buildResult('underused', 'Potential compute headroom', candidates.length + ' online host(s) have CPU under 30% and, if equipped, GPU usage under 25%.', candidates.map((host) => row(
    host.name, percent(host.cpuPercent) + ' CPU', host.rackId + (host.gpus.length ? ' · ' + percent(host.gpuPercent) + ' GPU' : ''),
  )), candidates.length ? ['Confirm utilization over a representative time window before moving workloads.'] : []);
}

function report(snapshot, thresholds) {
  const parts = [health(snapshot), gpu(snapshot, thresholds), environment(snapshot, thresholds), rackPower(snapshot), outlets(snapshot, thresholds), incidents(snapshot)];
  const recommendations = [...new Set(parts.flatMap((part) => part.recommendations))];
  return buildResult('report', 'Infrastructure health report',
    snapshot.scenario + ' simulated scenario · ' + snapshot.servers.length + ' hosts · ' + snapshot.racks.length + ' racks · ' + snapshot.pdus.length + ' PDUs.',
    parts.map((part) => row(part.title, part.severity, part.summary, part.severity)), recommendations);
}

const TOOLS = Object.freeze({ inventory, health, gpu, environment, rackPower, pdu, outlets, incidents, compare, underused, report });

export function validateToolResult(result) {
  if (!result || !Object.hasOwn(TOOLS, result.tool) || typeof result.title !== 'string' ||
      typeof result.summary !== 'string' || !SEVERITIES.has(result.severity) ||
      !Array.isArray(result.rows) || !Array.isArray(result.recommendations) ||
      !result.rows.every((entry) => entry && typeof entry.asset === 'string' && typeof entry.measurement === 'string' &&
        typeof entry.detail === 'string' && SEVERITIES.has(entry.severity)) ||
      !result.recommendations.every((item) => typeof item === 'string')) {
    throw new Error('The tool output failed schema validation.');
  }
  return result;
}

export function chooseTool(query) {
  if (typeof query !== 'string' || !query.trim() || query.length > 500) throw new Error('Enter a query of 1–500 characters.');
  const text = query.trim().toLowerCase();
  if (/\b(reboot|shutdown|shut down|turn off|turn on|power cycle|disable|enable|restart|delete|drain|change)\b/.test(text) &&
    !/^(why|when|what|which|how|recommend|suggest|describe|explain)\b/.test(text)) {
    throw new Error('InfraPilot runs read-only tools. Start a reviewed handoff for simulated outlet operations.');
  }
  if (/\b(report|summary report|daily brief)\b/.test(text)) return 'report';
  if (/\b(inventory|normalize|normalise|collect|discover)\b/.test(text)) return 'inventory';
  if (/\b(underutili[sz]ed|idle|headroom|underused)\b/.test(text) && !/\b(outlets?|pdus?)\b/.test(text)) return 'underused';
  if (/\b(compare|comparison|across racks)\b/.test(text) && /\b(cpu|server|racks|utilization|utilisation)\b/.test(text)) return 'compare';
  if (/\b(incident|incidents|alerts|alert|troubleshoot|triage|remediation|resolve)\b/.test(text)) return 'incidents';
  if (/\b(gpus?|accelerators?)\b/.test(text)) return 'gpu';
  if (/\b(outlets?|sockets?)\b/.test(text)) return 'outlets';
  if (/\b(pdus?)\b/.test(text)) return 'pdu';
  if (/\b(power|wattage|watts)\b/.test(text) && /\b(racks?|highest|consumption)\b/.test(text)) return 'rackPower';
  if (/\b(temperature|anomaly|anomalies|ambient|inlet|humidity|thermal|cooling)\b/.test(text)) return 'environment';
  if (/\b(health|attention|server|servers|degraded|status|offline)\b/.test(text)) return 'health';
  throw new Error('This query does not match a lab tool. Try an example covering inventory, health, GPUs, power, or incidents.');
}

export function runTool(tool, snapshot, thresholds = THRESHOLDS) {
  if (!Object.hasOwn(TOOLS, tool)) throw new Error('The requested tool is not registered.');
  if (snapshot?.mode !== 'simulation' || !Array.isArray(snapshot.servers) || !Array.isArray(snapshot.pdus) ||
    !Array.isArray(snapshot.racks) || !Array.isArray(snapshot.alerts)) throw new Error('A compatible simulation snapshot is required.');
  return validateToolResult(TOOLS[tool](snapshot, validateThresholds(thresholds)));
}

export function prepareHandoff(snapshot, outletId, operation, now, requestId) {
  const outlet = listOutlets(snapshot).find(({ id, serverId, deviceId }) => id === outletId && (serverId || deviceId));
  if (!outlet || !['on', 'off', 'reboot'].includes(operation) || !Number.isFinite(now) || !requestId) {
    throw new Error('Choose an assigned simulated outlet and a supported operation.');
  }
  return { id: requestId, outletId, operation, assetLabel: outlet.pduName + ' / ' + outlet.number + ' · ' + outlet.deviceName,
    status: 'pending', preparedAt: now, expiresAt: now + 5 * 60_000 };
}

export function decideHandoff(request, role, approved, now) {
  if (!request || request.status !== 'pending') throw new Error('This handoff is no longer awaiting review.');
  if (!Number.isFinite(now) || now < request.preparedAt || now >= request.expiresAt) throw new Error('This handoff request has expired.');
  if (role !== 'operator') throw new Error('The simulated operator role is required to review a handoff.');
  if (typeof approved !== 'boolean') throw new Error('An explicit review decision is required.');
  return { ...request, status: approved ? 'approved' : 'rejected', reviewedAt: now };
}
