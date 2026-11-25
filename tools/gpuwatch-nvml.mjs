import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const properties = ['index', 'utilization.gpu', 'memory.used', 'memory.total', 'temperature.gpu', 'power.draw'];

function parseMetric(value) {
  if (value === 'N/A' || value === '[N/A]' || value === '[Not Supported]') return null;
  if (!value || !Number.isFinite(Number(value))) throw new Error('Unexpected NVIDIA metric format.');
  return Number(value);
}

export function parseGpuMetrics(stdout) {
  return stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
    const fields = line.split(',').map((field) => field.trim());
    if (fields.length !== properties.length) throw new Error('Unexpected NVIDIA metric column count.');
    const [index, utilizationPercent, usedMiB, totalMiB, temperatureC, powerW] = fields.map(parseMetric);
    if (!Number.isInteger(index) || index < 0) throw new Error('Unexpected NVIDIA GPU index.');
    return {
      id: 'gpu-' + index,
      utilizationPercent,
      vramUsedGiB: usedMiB === null ? null : usedMiB / 1024,
      vramTotalGiB: totalMiB === null ? null : totalMiB / 1024,
      temperatureC,
      powerW,
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { stdout } = await exec('nvidia-smi', [
      '--query-gpu=' + properties.join(','),
      '--format=csv,noheader,nounits',
    ], { timeout: 10_000, maxBuffer: 128 * 1024 });
    console.log(JSON.stringify({ mode: 'local-nvml', timestamp: new Date().toISOString(), gpus: parseGpuMetrics(stdout) }, null, 2));
  } catch {
    console.error('GPU telemetry is unavailable. Check the local NVIDIA driver and nvidia-smi.');
    process.exitCode = 1;
  }
}
