import { percent } from './monitoring.mjs';

export const gpuThresholds = { temperatureC: 82, vramPercent: 90, cpuPercent: 90 };

export const chartMetrics = {
  gpu: { name: 'GPU utilization', unit: '%', max: 100 },
  vram: { name: 'VRAM utilization', unit: '%', max: 100 },
  cpu: { name: 'CPU utilization', unit: '%', max: 100 },
  memory: { name: 'System memory', unit: '%', max: 100 },
  temperature: { name: 'GPU temperature', unit: ' °C', max: 100 },
  power: { name: 'Server power', unit: ' W', max: 0 },
};

export function gpuRows(snapshot, { serverId = '', gpuId = '', thresholds = gpuThresholds } = {}) {
  return snapshot.servers.filter((server) => server.gpus.length && (!serverId || server.id === serverId))
    .flatMap((server) => server.gpus.filter((gpu) => !gpuId || gpu.id === gpuId).map((gpu) => {
      const vramPercent = percent(gpu.vramUsedGiB, gpu.vramTotalGiB);
      const warnings = [];
      if (gpu.temperatureC >= thresholds.temperatureC) warnings.push('GPU temperature');
      if (vramPercent >= thresholds.vramPercent) warnings.push('VRAM usage');
      if (server.cpuPercent >= thresholds.cpuPercent) warnings.push('CPU utilization');
      return { server, gpu, vramPercent, warnings };
    }));
}

export function historicalSeries(samples, metric, filters = {}) {
  return samples.map((snapshot) => {
    const rows = gpuRows(snapshot, filters);
    const servers = [...new Map(rows.map(({ server }) => [server.id, server])).values()];
    let values;
    switch (metric) {
      case 'gpu': values = rows.map(({ gpu }) => gpu.utilizationPercent); break;
      case 'vram': values = rows.map(({ vramPercent }) => vramPercent); break;
      case 'cpu': values = servers.map((server) => server.cpuPercent); break;
      case 'memory': values = servers.map((server) => percent(server.memoryUsedGiB, server.memoryTotalGiB)); break;
      case 'temperature': values = rows.map(({ gpu }) => gpu.temperatureC); break;
      case 'power': values = servers.map((server) => server.powerW); break;
      default: throw new Error('Unknown telemetry metric.');
    }
    const sum = values.reduce((total, value) => total + value, 0);
    const value = metric === 'power' ? sum : values.length ? sum / values.length : 0;
    return { timestamp: snapshot.timestamp, value };
  });
}

export function warningExposure(samples, filters = {}) {
  const rows = new Map();
  samples.forEach((snapshot, index) => {
    for (const { server, gpu, warnings } of gpuRows(snapshot, filters)) {
      const record = rows.get(gpu.id) ?? { serverId: server.id, serverName: server.name, gpuId: gpu.id, observations: 0, warningSamples: 0, longestStreak: 0, currentStreak: 0, latestWarningIndex: -2, lastWarningAt: null, peakTemperatureC: gpu.temperatureC, counts: {} };
      record.observations += 1;
      record.peakTemperatureC = Math.max(record.peakTemperatureC, gpu.temperatureC);
      if (warnings.length) {
        record.warningSamples += 1;
        record.currentStreak = record.latestWarningIndex === index - 1 ? record.currentStreak + 1 : 1;
        record.longestStreak = Math.max(record.longestStreak, record.currentStreak);
        record.latestWarningIndex = index;
        record.lastWarningAt = snapshot.timestamp;
        for (const warning of warnings) record.counts[warning] = (record.counts[warning] ?? 0) + 1;
      }
      rows.set(gpu.id, record);
    }
  });
  return [...rows.values()].sort((left, right) => right.warningSamples - left.warningSamples || right.peakTemperatureC - left.peakTemperatureC || left.gpuId.localeCompare(right.gpuId))
    .map(({ currentStreak: _currentStreak, latestWarningIndex: _latestWarningIndex, ...row }) => row);
}
