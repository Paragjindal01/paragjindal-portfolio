import { useId, useState } from 'react';
import { chartMetrics, gpuRows, gpuThresholds, historicalSeries, warningExposure } from './gpuwatch.mjs';
import { decimal, downloadReport, scenarioWindow, toCsv } from './monitoring.mjs';
import './monitoring.css';

const thresholdFields = [
  ['temperatureC', 'GPU temperature (°C)', 120],
  ['vramPercent', 'VRAM utilization (%)', 100],
  ['cpuPercent', 'CPU utilization (%)', 100],
];

function readingTime(timestamp) {
  return new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(timestamp));
}

function ThresholdForm({ thresholds, setThresholds }) {
  const [editing, setEditing] = useState(false);
  const id = useId();

  function save(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setThresholds(Object.fromEntries(thresholdFields.map(([key]) => [key, Number(fields.get(key))])));
    setEditing(false);
  }

  return <>
    <button type="button" aria-expanded={editing} aria-controls={id} onClick={() => setEditing((value) => !value)}>Warning thresholds</button>
    {editing && <form id={id} className="lab-controls ops-thresholds" onSubmit={save}>
      {thresholdFields.map(([key, label, max]) => (
        <label key={key}>{label}
          <input name={key} type="number" required min="1" max={max} defaultValue={thresholds[key]} />
        </label>
      ))}
      <button type="submit">Apply thresholds</button>
    </form>}
  </>;
}

function TelemetryChart({ series, metric, currentTimestamp }) {
  const definition = chartMetrics[metric];
  const ceiling = Math.max(1, definition.max, ...series.map(({ value }) => Math.ceil(value)));
  return <section className="lab-panel">
    <h2>Telemetry history</h2>
    <p>{definition.name} · {series.length} synthetic samples · 15-minute intervals · UTC</p>
    <div className="ops-chart" role="img" aria-label={definition.name + ' from ' + readingTime(series[0].timestamp) + ' to ' + readingTime(series.at(-1).timestamp) + ' UTC'}>
      <div className="ops-chart-axis" aria-hidden="true">
        <span>{decimal(ceiling)}{definition.unit}</span>
        <span>{decimal(ceiling / 2)}{definition.unit}</span>
        <span>0{definition.unit}</span>
      </div>
      <div className="ops-chart-bars" aria-hidden="true" style={{ '--samples': series.length }}>
        {series.map(({ timestamp, value }, index) => <div key={timestamp} className="ops-chart-column"
          data-current={timestamp === currentTimestamp}
          title={readingTime(timestamp) + ' UTC · ' + decimal(value, 1) + definition.unit + (timestamp === currentTimestamp ? ' · Current step' : '')}>
          <span className="ops-chart-bar" style={{ height: (value / ceiling * 100) + '%' }} />
          {(index === 0 || index === series.length - 1) && <span className="ops-chart-time">{readingTime(timestamp)}</span>}
        </div>)}
      </div>
    </div>
    <details className="ops-chart-data">
      <summary>View sample values</summary>
      <table className="lab-table"><thead><tr><th scope="col">Time (UTC)</th><th scope="col">{definition.name}</th></tr></thead>
        <tbody>{series.map(({ timestamp, value }) => <tr key={timestamp}>
          <td>{readingTime(timestamp)}{timestamp === currentTimestamp ? ' · Current step' : ''}</td><td>{decimal(value, 1)}{definition.unit}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </section>;
}

function ThresholdExposure({ samples, filters }) {
  const exposure = warningExposure(samples, filters);
  const affected = exposure.filter(({ warningSamples }) => warningSamples > 0);
  const displayTime = (timestamp) => timestamp ? readingTime(timestamp) + ' UTC' : '—';
  return <section className="lab-panel">
    <h2>Threshold exposure</h2>
    <p>{affected.length} of {exposure.length} GPUs recorded a warning in this {samples.length}-sample scenario window. Consecutive warnings count observations at 15-minute intervals.</p>
    <details className="ops-disclosure">
      <summary>View per-GPU warning history</summary>
      <div className="ops-overflow" tabIndex="0" role="region" aria-label="GPU warning exposure table">
        <table className="lab-table ops-table">
          <thead><tr>{['GPU', 'Warning samples', 'Longest streak', 'Peak temperature', 'Last warning', 'Warnings by type'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{exposure.map((item) => <tr key={item.gpuId}>
            <th scope="row">{item.gpuId}<small>{item.serverName}</small></th>
            <td>{item.warningSamples} / {item.observations}</td><td>{item.longestStreak}</td><td>{decimal(item.peakTemperatureC, 1)} °C</td><td>{displayTime(item.lastWarningAt)}</td>
            <td>{Object.entries(item.counts).map(([name, count]) => `${name} (${count})`).join(', ') || 'None'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>;
}

export default function GPUWatch({ snapshot, scenario }) {
  const [serverId, setServerId] = useState('');
  const [gpuId, setGpuId] = useState('');
  const [metric, setMetric] = useState('temperature');
  const [thresholds, setThresholds] = useState(gpuThresholds);
  const gpuServers = snapshot.servers.filter((server) => server.gpus.length > 0);
  const rows = gpuRows(snapshot, { serverId, gpuId, thresholds });
  const options = gpuRows(snapshot, { serverId });
  const warnings = rows.filter((row) => row.warnings.length > 0).length;
  const unhealthyServers = new Set(rows.filter(({ server }) => server.status !== 'online').map(({ server }) => server.id)).size;
  const latestTemperature = rows.length ? Math.max(...rows.map(({ gpu }) => gpu.temperatureC)) : 0;
  const samples = scenarioWindow(snapshot);
  const series = historicalSeries(samples, metric, { serverId, gpuId });

  function exportReport() {
    const header = ['Timestamp (UTC)', 'Scenario', 'Server', 'Status', 'GPU', 'GPU %', 'VRAM used GiB', 'VRAM total GiB', 'GPU °C', 'GPU W', 'CPU %', 'System RAM used GiB', 'System RAM total GiB', 'Server W', 'Warnings'];
    const metrics = rows.map(({ server, gpu, warnings: issues }) => [
      snapshot.timestamp, scenario, server.name, server.status, gpu.id, gpu.utilizationPercent, gpu.vramUsedGiB,
      gpu.vramTotalGiB, gpu.temperatureC, gpu.powerW, server.cpuPercent, server.memoryUsedGiB,
      server.memoryTotalGiB, server.powerW, issues.join(' / '),
    ]);
    downloadReport('gpuwatch-' + scenario + '.csv', toCsv([header, ...metrics]), 'text/csv;charset=utf-8');
  }

  return <div className="ops-stack">
    <div className="lab-grid ops-stats" aria-label="GPU health summary">
      <div className="lab-stat"><span>GPUs in scope</span><strong>{rows.length}</strong></div>
      <div className="lab-stat"><span>Peak temperature</span><strong>{decimal(latestTemperature, 1)} °C</strong></div>
      <div className="lab-stat"><span>GPUs with warnings</span><strong>{warnings}</strong></div>
      <div className="lab-stat"><span>Servers needing attention</span><strong>{unhealthyServers}</strong></div>
    </div>
    <section className="lab-panel">
      <h2>Telemetry controls</h2>
      <div className="lab-controls">
        <label>Server<select value={serverId} onChange={(event) => { setServerId(event.target.value); setGpuId(''); }}>
          <option value="">All GPU servers</option>
          {gpuServers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
        </select></label>
        <label>GPU<select value={gpuId} onChange={(event) => setGpuId(event.target.value)}>
          <option value="">All GPUs</option>
          {options.map(({ server, gpu }) => <option key={server.id + ':' + gpu.id} value={gpu.id}>{server.name} · {gpu.id}</option>)}
        </select></label>
        <label>Chart metric<select value={metric} onChange={(event) => setMetric(event.target.value)}>
          {Object.entries(chartMetrics).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
        </select></label>
        <button type="button" onClick={exportReport}>Export report CSV</button>
        <ThresholdForm thresholds={thresholds} setThresholds={setThresholds} />
      </div>
    </section>
    <TelemetryChart series={series} metric={metric} currentTimestamp={snapshot.timestamp} />
    <ThresholdExposure samples={samples} filters={{ serverId, gpuId, thresholds }} />
    <section className="lab-panel">
      <h2>Equipment telemetry</h2>
      <div className="ops-overflow" tabIndex="0" role="region" aria-label="Equipment telemetry table">
        <table className="lab-table ops-table">
          <thead><tr>{['Server / GPU', 'Health', 'GPU', 'VRAM', 'GPU temp', 'CPU', 'System RAM', 'GPU / server power', 'Threshold warnings'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows.map(({ server, gpu, vramPercent, warnings: issues }) => <tr key={server.id + ':' + gpu.id}>
            <th scope="row">{server.name}<small>{gpu.model} · {gpu.id}</small></th>
            <td><span className="lab-badge" data-status={server.status}>{server.status}</span></td>
            <td>{decimal(gpu.utilizationPercent)}%</td>
            <td>{decimal(gpu.vramUsedGiB, 1)} / {gpu.vramTotalGiB} GiB<small>{decimal(vramPercent)}% allocated</small></td>
            <td>{decimal(gpu.temperatureC, 1)} °C</td>
            <td>{decimal(server.cpuPercent)}%</td>
            <td>{decimal(server.memoryUsedGiB, 1)} / {server.memoryTotalGiB} GiB</td>
            <td>{decimal(gpu.powerW)} / {decimal(server.powerW)} W</td>
            <td>{issues.length ? <span className="lab-badge" data-status="warning">{issues.join(', ')}</span> : 'Within thresholds'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
