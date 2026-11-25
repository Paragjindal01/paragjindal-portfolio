import { useState } from 'react';
import { format } from './format.mjs';

const eventLabels = {
  arrival: 'Submitted',
  started: 'Started',
  completed: 'Completed',
  'gpu-failed': 'GPU failure',
  'gpu-repaired': 'GPU recovered',
  'retry-queued': 'Retry queued',
  failed: 'Failed',
  unschedulable: 'Unschedulable',
};

const minutes = (value) => value == null ? '—' : `${format(value)} min`;
const percent = (value) => value == null ? '—' : `${format(value * 100, 1)}%`;
const energy = (value) => value == null ? '—' : `${format(value, 2)} kWh`;

export function Metrics({ result }) {
  const { metrics, jobs } = result;
  const cells = [
    ['Median queue wait', minutes(metrics.p50Wait), `P95 ${minutes(metrics.p95Wait)}`],
    ['GPU utilization', percent(metrics.utilization), 'Of online device-minutes'],
    ['Jobs completed', `${metrics.completed} / ${jobs.length}`, `${format(metrics.throughput)} jobs/hour`],
    ['Energy estimate', energy(metrics.energyKwh), `Deadlines met ${percent(metrics.deadlineRate)}`],
  ];
  return (
    <dl className="metrics" aria-label="Simulation metrics">
      {cells.map(([title, value, detail]) => <div key={title}><dt>{title}</dt><dd><span className="metric-value">{value}</span><span className="metric-note">{detail}</span></dd></div>)}
    </dl>
  );
}

function EventList({ result, frame, onSelect }) {
  const events = result.events.filter((event) => event.time === frame.time);
  return (
    <div className="event-summary">
      <h3>Events at {minutes(frame.time)}</h3>
      <ul>
        {events.length === 0 && <li>No event at this point.</li>}
        {events.map((event, index) => {
          const name = eventLabels[event.type] ?? event.type;
          const title = `${name}${event.jobId || event.gpuId ? ` · ${event.jobId ?? event.gpuId}` : ''}`;
          return <li key={`${event.type}-${index}`} className={event.type === 'gpu-failed' ? 'event-failure' : ''}>
            {event.jobId ? <button type="button" onClick={() => onSelect(event.jobId)}>{title}</button> : title}
          </li>;
        })}
      </ul>
    </div>
  );
}

function JobDetail({ job, onClose }) {
  if (!job) return null;
  return (
    <section id="job-details" className="job-detail" tabIndex={-1} aria-label={`Details for ${job.id}`}>
      <div className="job-detail-title"><div><h3>{job.id}</h3><p>{job.team} · {job.kind} · Priority {job.priority}</p></div><button type="button" className="text-button" onClick={onClose}>Close details</button></div>
      <dl>
        <div><dt>Request</dt><dd>{job.gpuCount} GPU{job.gpuCount === 1 ? '' : 's'} · {job.memoryGiB} GiB each</dd></div>
        <div><dt>Deadline</dt><dd>{minutes(job.deadline)}</dd></div>
        <div><dt>Queue wait</dt><dd>{minutes(job.queueWait)}</dd></div>
        <div><dt>Finished at</dt><dd>{minutes(job.completedAt)}</dd></div>
        <div><dt>Outcome</dt><dd>{job.status}</dd></div>
      </dl>
      {job.reason && <p className="job-reason">{job.reason}</p>}
      {job.attempts.length > 0 && <ul aria-label="Execution attempts">
        {job.attempts.map((attempt, index) => <li key={`${attempt.start}-${index}`}><strong>Attempt {index + 1} · {attempt.outcome}</strong><span>{minutes(attempt.start)} → {minutes(attempt.end)} · {attempt.gpuIds.join(', ')}</span></li>)}
      </ul>}
    </section>
  );
}

export function Timeline({ result, frame, frameIndex, playing, onPlay, onSeek, selected, onSelect }) {
  const { series, horizon } = result;
  const [filter, setFilter] = useState('all');
  const jobs = result.jobs.filter((job) => filter === 'all' || job.kind === filter);
  const selectedJob = result.jobs.find((job) => job.id === selected);
  const maxIndex = series.length - 1;
  const position = (value) => horizon > 0 ? `${Math.min(100, 100 * value / horizon)}%` : '0%';
  const tickMarks = Array.from({ length: 5 }, (_, index) => horizon * index / 4);
  return (
    <section className="panel timeline" id="workload-timeline" aria-labelledby="timeline-title">
      <header className="panel-header">
        <div><h2 id="timeline-title">Workload timeline</h2><p>Placement, waiting, and every execution attempt.</p></div>
        <label className="timeline-filter"><span className="sr-only">Filter timeline</span><select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All jobs</option><option value="training">Training</option><option value="inference">Inference</option>
        </select></label>
      </header>
      <div className="timeline-scroll" tabIndex={0} aria-label="Workload timeline chart">
        <div className="timeline-axis"><span>Job</span><div>{tickMarks.map((mark, index) => <span key={index}>{format(mark)}{index === tickMarks.length - 1 ? ' min' : ''}</span>)}</div></div>
        {jobs.length === 0 && <p className="empty-timeline">No jobs match this profile.</p>}
        {jobs.map((job) => {
          return (
            <button type="button" key={job.id} className="timeline-row" aria-label={`${job.id}, ${job.kind}, ${job.status}`} aria-pressed={selected === job.id} onClick={() => onSelect(job.id)}>
              <span className="job-label"><i className={`swatch ${job.kind}`} aria-hidden="true" />{job.id}</span>
              <span className="timeline-track" aria-hidden="true">
                {job.attempts.map(({ start }, index) => {
                  const queued = job.attempts[index - 1]?.end ?? job.arrival;
                  return start > queued ? <i key={`wait-${index}`} className="timeline-wait" style={{ left: position(queued), width: position(start - queued) }} /> : null;
                })}
                {job.attempts.length === 0 && <i className="timeline-terminal" style={{ left: position(job.arrival) }} />}
                {job.attempts.map((attempt, index) => <i key={index} className={`timeline-attempt ${job.kind} ${attempt.outcome}`} style={{ left: position(attempt.start), width: position(attempt.end - attempt.start) }} title={`${attempt.gpuIds.join(', ')} · ${minutes(attempt.start)} to ${minutes(attempt.end)} · ${attempt.outcome}`} />)}
                <i className="timeline-cursor" style={{ left: position(frame.time) }} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="timeline-legend" aria-label="Timeline legend">
        <span><i className="swatch training" aria-hidden="true" />Training</span>
        <span><i className="swatch inference" aria-hidden="true" />Inference</span>
        <span><i className="swatch waiting" aria-hidden="true" />Waiting</span>
        <span><i className="swatch failure" aria-hidden="true" />Interrupted or unschedulable</span>
      </div>
      <div className="seek-controls">
        <div className="transport" aria-label="Timeline controls">
          <button type="button" aria-label="Previous event" disabled={frameIndex === 0} onClick={() => onSeek(frameIndex - 1)}>‹</button>
          <button type="button" aria-label={playing ? 'Pause timeline' : 'Play timeline'} disabled={maxIndex === 0} onClick={onPlay}>{playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" aria-label="Next event" disabled={frameIndex === maxIndex} onClick={() => onSeek(frameIndex + 1)}>›</button>
        </div>
        <label className="seek-range"><span className="sr-only">Simulation time</span><input type="range" min="0" max={maxIndex} value={frameIndex} disabled={maxIndex === 0} aria-valuetext={minutes(frame.time)} onChange={(event) => onSeek(Number(event.target.value))} /></label>
        <output className="clock">t = {minutes(frame.time)}</output>
      </div>
      <EventList result={result} frame={frame} onSelect={onSelect} />
      <JobDetail job={selectedJob} onClose={() => onSelect(null)} />
    </section>
  );
}

function chartBins(series, horizon, measure) {
  const binCount = 48;
  const binDuration = horizon / binCount;
  let index = 0;
  return Array.from({ length: binCount }, (_, bin) => {
    const start = bin * binDuration;
    const end = start + binDuration;
    let total = 0;
    let cursor = start;
    while (cursor < end && index < series.length) {
      const next = series[index + 1]?.time ?? horizon;
      if (cursor >= next) { index += 1; continue; }
      const stop = Math.min(end, next);
      total += (stop - cursor) * measure(series[index]);
      cursor = stop;
    }
    return binDuration ? total / binDuration : 0;
  });
}

export function Resources({ result, frame, cluster }) {
  const [mode, setMode] = useState('gpu');
  const isPower = mode === 'power';
  const unit = isPower ? 'W' : '%';
  const max = isPower ? Math.max(cluster.powerCapWatts, ...result.series.map((entry) => entry.drawWatts)) : 100;
  const measure = (entry) => isPower ? entry.drawWatts : entry.onlineGpus > 0 ? 100 * entry.busyGpus / entry.onlineGpus : 0;
  const data = chartBins(result.series, result.horizon, measure);
  const selectedBin = result.horizon > 0 ? Math.min(data.length - 1, Math.floor(data.length * frame.time / result.horizon)) : 0;

  return (
    <section className="panel resource-panel" aria-labelledby="resource-title">
      <header className="panel-header">
        <div><h2 id="resource-title">Resource utilization</h2><p>Time-weighted averages across the run.</p></div>
        <div className="mode-toggle" aria-label="Chart metrics" role="group">
          <button type="button" aria-pressed={!isPower} onClick={() => setMode('gpu')}>GPU</button><button type="button" aria-pressed={isPower} onClick={() => setMode('power')}>Power</button>
        </div>
      </header>
      <div className="chart" role="img" aria-label={`${isPower ? 'Power draw' : 'GPU utilization'} over ${minutes(result.horizon)}, time-bucket averages range from ${format(Math.min(...data))} ${unit} to ${format(Math.max(...data))} ${unit}.`}>
        <span className="chart-axis">{format(max)}{unit}</span>
        <div className="chart-bars" aria-hidden="true">
          {data.map((value, index) => <div key={index} className={selectedBin === index ? 'current' : ''} style={{ '--column': `${max > 0 ? 100 * value / max : 0}%` }} />)}
        </div>
        <span className="chart-axis chart-zero">0</span>
        <span className="chart-time">{minutes(result.horizon)}</span>
      </div>
      <dl className="resource-readings">
        <div><dt>Busy / online</dt><dd>{frame.busyGpus} / {frame.onlineGpus}</dd></div>
        <div><dt>Power draw</dt><dd>{format(frame.drawWatts, 0)} W</dd></div>
        <div><dt>Fragmented GPUs</dt><dd>{frame.fragmentedGpus}</dd></div>
      </dl>
    </section>
  );
}

function queuedAt(result, time) {
  const waiting = new Map();
  for (const event of result.events) {
    if (event.time > time) break;
    if (!event.jobId) continue;
    if (event.type === 'arrival' || event.type === 'retry-queued') waiting.set(event.jobId, event.time);
    else if (['started', 'completed', 'failed', 'unschedulable'].includes(event.type)) waiting.delete(event.jobId);
  }
  const jobs = new Map(result.jobs.map((job) => [job.id, job]));
  return Array.from(waiting, ([id, enteredAt]) => ({ ...jobs.get(id), enteredAt }));
}

export function Queue({ result, frame, selected, onSelect }) {
  const waiting = queuedAt(result, frame.time);
  return (
    <section className="panel queue-panel" aria-labelledby="queue-title">
      <header className="panel-header"><div><h2 id="queue-title">Queue at this time</h2><p>Waiting jobs in queue-entry order.</p></div><span className="queue-count">{waiting.length} queued</span></header>
      {waiting.length === 0 ? <p className="queue-empty">No jobs are waiting at {minutes(frame.time)}.</p> : <div className="queue-scroll" tabIndex={0} aria-label="Waiting jobs">
        <table className="queue-table">
          <thead><tr><th scope="col">Job</th><th scope="col">GPU request</th><th scope="col">Priority</th><th scope="col">Wait</th></tr></thead>
          <tbody>{waiting.map((job) => <tr key={job.id}>
            <th scope="row"><button className="table-job" type="button" aria-pressed={job.id === selected} onClick={() => onSelect(job.id)}>{job.id}</button></th>
            <td>{job.gpuCount} × {job.memoryGiB} GiB</td><td>{job.priority}</td><td>{minutes(frame.time - job.enteredAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}

const comparisonFields = [
  ['Completed', ({ completed, failed, unschedulable }) => `${completed} · ${failed + (unschedulable ?? 0)} unserved`],
  ['Mean wait', ({ meanWait }) => minutes(meanWait)],
  ['P50 wait', ({ p50Wait }) => minutes(p50Wait)],
  ['P95 wait', ({ p95Wait }) => minutes(p95Wait)],
  ['Mean turnaround', ({ meanCompletion }) => minutes(meanCompletion)],
  ['P95 turnaround', ({ p95Completion }) => minutes(p95Completion)],
  ['GPU utilization', ({ utilization }) => percent(utilization)],
  ['Throughput', ({ throughput }) => `${format(throughput)} jobs/hour`],
  ['Deadline completion', ({ deadlineRate }) => percent(deadlineRate)],
  ['Fragmentation', ({ fragmentation }) => percent(fragmentation)],
  ['Energy', ({ energyKwh }) => energy(energyKwh)],
  ['Fairness', ({ fairness }) => percent(fairness)],
];

function TeamService({ result }) {
  if (!result?.teams?.length) return null;
  return (
    <div className="team-service">
      <h3>Service by team under {result.label}</h3>
      <ul>{result.teams.map((team) => <li key={team.team}><span>{team.team}</span><strong>{team.completed} / {team.submitted} completed</strong><span>{minutes(team.meanWait)} mean wait</span></li>)}</ul>
    </div>
  );
}

export function Comparison({ results, currentPolicy, onCompare, onChoose, dirty, recommendation, recommendationEnabled, toggleRecommendation, recommendAvailable }) {
  return (
    <section className="panel comparison" id="policy-comparison" aria-labelledby="comparison-title">
      <header className="panel-header">
        <div><h2 id="comparison-title">Policy comparison</h2><p>Each policy runs against the same cluster, jobs, and failures.</p></div>
        <button className="button button-outline" type="button" onClick={onCompare}>{results ? 'Run comparison again' : 'Run comparison'}</button>
      </header>
      {results && <>
        <div className="comparison-scroll" tabIndex={0} aria-label="Scheduling metrics by policy">
          <table>
            <thead><tr><th scope="col">Metric</th>{results.map((result) => <th key={result.policyId} scope="col"><button type="button" className="table-job" aria-pressed={result.policyId === currentPolicy} disabled={dirty} onClick={() => onChoose(result.policyId, result)}>{result.label}</button></th>)}</tr></thead>
            <tbody>{comparisonFields.map(([label, render]) => <tr key={label}><th scope="row">{label}</th>{results.map(({ policyId, metrics }) => <td key={policyId}>{render(metrics)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <TeamService result={results.find((result) => result.policyId === currentPolicy)} />
        {dirty && <p className="comparison-note">Run the current settings to apply changes before loading a compared run.</p>}
        {recommendAvailable && <div className="recommendation">
          <label className="check-field"><input type="checkbox" checked={recommendationEnabled} onChange={toggleRecommendation} /><span>Recommend a policy</span></label>
          {recommendationEnabled && recommendation && <div className="recommendation-result"><h3>{recommendation.label}</h3><p>{recommendation.reason}</p>{recommendation.tradeoffs?.length > 0 && <ul>{recommendation.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul>}</div>}
          {recommendationEnabled && !recommendation && <p className="comparison-note">None of these policies completed a job under this configuration.</p>}
        </div>}
      </>}
    </section>
  );
}
