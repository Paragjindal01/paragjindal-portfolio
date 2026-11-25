import { useEffect, useState } from 'react';
import { eventLabel, MAX_REPLAY_BYTES, parseIncident, summarize } from './incident.mjs';
import { deleteRecording } from './store.mjs';
import './replay.css';

const exportReplay = (trace) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(trace)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `incident-${trace.id.slice(0, 8)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const utc = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' });
const describe = (event) => {
  const { payload } = event;
  if (event.type === 'scenario.changed') return `${payload.from} → ${payload.to}`;
  if (event.type === 'telemetry.captured') return `${payload.alerts.length} alerts · ${payload.servers.length} servers`;
  if (event.type === 'analysis.completed' && typeof payload.result.summary === 'string') return payload.result.summary;
  if (typeof payload.request?.assetLabel === 'string' && typeof payload.request.operation === 'string') return `${payload.request.operation} · ${payload.request.assetLabel}`;
  if (typeof payload.outletId === 'string') return payload.outletId;
  return typeof payload.reason === 'string' ? payload.reason : '';
};

function ReplayTimeline({ trace }) {
  const [cursor, setCursor] = useState(null);
  const [playing, setPlaying] = useState(false);
  const last = trace.events.length;
  const current = Math.min(cursor ?? last, last);
  const event = trace.events[current - 1];
  const { telemetry, analysis, decision } = summarize(trace, current);
  const watts = telemetry?.pdus.reduce((total, pdu) => total + pdu.powerW, 0) ?? 0;

  useEffect(() => {
    if (!playing || current >= last) return undefined;
    const next = window.setTimeout(() => {
      setCursor(current + 1);
      if (current + 1 === last) setPlaying(false);
    }, 850);
    return () => window.clearTimeout(next);
  }, [playing, current, last]);

  function move(sequence) {
    setCursor(sequence);
    setPlaying(false);
  }

  return <div className="replay-review">
    <div className="replay-playback">
      <div className="lab-controls">
        <button type="button" disabled={current === 1} onClick={() => move(current - 1)}>Previous event</button>
        <button type="button" onClick={() => {
          if (!playing && current === last) setCursor(1);
          setPlaying(!playing);
        }}>{playing ? 'Pause replay' : 'Play replay'}</button>
        <button type="button" disabled={current === last} onClick={() => move(current + 1)}>Next event</button>
        <button type="button" onClick={() => move(last)}>Jump to latest</button>
      </div>
      <label>Event {current} of {last}
        <input type="range" aria-label="Replay position" min="1" max={last} value={current} onChange={(change) => move(Number(change.target.value))} />
      </label>
    </div>
    <div className="replay-columns">
      <nav aria-label="Recorded events" className="replay-timeline"><ol>{trace.events.map((item) => <li key={item.sequence}>
        <button type="button" aria-current={item.sequence === current ? 'step' : undefined} onClick={() => move(item.sequence)}>
          <span className="replay-sequence">{String(item.sequence).padStart(2, '0')}</span>
          <span><strong>{eventLabel(item.type)}</strong><small>{item.scenario} · step {item.step} · {item.source === 'powerops' ? 'PowerOps' : 'InfraPilot'}</small></span>
        </button>
      </li>)}</ol></nav>
      <div className="replay-event" aria-live={playing ? 'off' : 'polite'}>
        <p className="eyebrow">Event {event.sequence} · {event.source === 'powerops' ? 'PowerOps' : 'InfraPilot'}</p>
        <h3>{eventLabel(event.type)}</h3>
        <p><time dateTime={event.recordedAt}>{utc.format(new Date(event.recordedAt))} UTC</time>{describe(event) && ` · ${describe(event)}`}</p>
        {telemetry && <dl className="replay-metrics"><div><dt>Scenario and step</dt><dd>{telemetry.scenario} · {telemetry.step}</dd></div><div><dt>Facility power</dt><dd>{(watts / 1000).toFixed(2)} kW</dd></div><div><dt>Active alerts</dt><dd>{telemetry.alerts.length}</dd></div></dl>}
        {analysis?.result.recommendations.length > 0 && <div><h4>Latest recorded recommendations</h4><ul>{analysis.result.recommendations.map((text, index) => <li key={index}>{text}</li>)}</ul></div>}
        {decision && <p><strong>Latest decision</strong> {eventLabel(decision.type)} · event {decision.sequence}</p>}
        {telemetry && <details><summary>Full recorded telemetry</summary><pre className="replay-json">{JSON.stringify(telemetry, null, 2)}</pre></details>}
        <details><summary>Full event payload</summary><pre className="replay-json">{JSON.stringify(event.payload, null, 2)}</pre></details>
      </div>
    </div>
  </div>;
}

export default function IncidentReplay({ recording }) {
  const [selected, setSelected] = useState('');
  const [imported, setImported] = useState(null);
  const [remove, setRemove] = useState('');
  const [notice, setNotice] = useState('');
  const trace = imported || recording.library.find((item) => item.id === (selected || recording.id)) || recording.library[0];
  const closed = trace?.events.at(-1)?.type === 'recording.stopped';

  useEffect(() => {
    if (window.location.hash === '#incident-replay') document.getElementById('incident-replay')?.scrollIntoView();
  }, []);

  async function importFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_REPLAY_BYTES) throw new Error('Incident files must be under 6 MiB.');
      setImported(parseIncident(await file.text()));
      setNotice('Imported a read-only copy.');
    } catch (failure) { setNotice(failure.message); }
  }

  async function removeClosed(id) {
    try {
      await deleteRecording(id);
      await recording.refresh();
      setSelected('');
      setRemove('');
      setNotice('Saved recording deleted from this browser.');
    } catch (failure) { setNotice(failure.message); }
  }

  return <section id="incident-replay" className="lab-panel incident-replay" aria-labelledby="incident-replay-heading">
    <div className="replay-heading"><div><span className="eyebrow">InfraPilot evidence</span><h2 id="incident-replay-heading">Incident replay</h2><p>Record simulated telemetry, recommendations, and operator decisions. Step through the saved events or export a trace for review.</p></div>
      {recording.id && <span className="lab-badge replay-live"><span className="status-dot" /> Recording</span>}
    </div>
    <div className="lab-controls replay-controls">
      {recording.id ? <button type="button" className="lab-primary" disabled={recording.busy} onClick={recording.stop}>Stop recording</button>
        : <button type="button" className="lab-primary" disabled={recording.busy} onClick={async () => { setImported(null); setSelected(''); await recording.start(); }}>Start incident recording</button>}
      {trace && <button type="button" onClick={() => exportReplay(trace)}>Export replay JSON</button>}
      {trace && !closed && !imported && !recording.id && <button type="button" onClick={() => recording.resume(trace)}>Resume recording</button>}
      {trace && closed && !imported && <button type="button" onClick={() => setRemove(trace.id)}>Delete saved recording</button>}
      <label>Open replay file<input type="file" accept=".json,application/json" onChange={importFile} /></label>
    </div>
    {recording.library.length > 0 && <label className="replay-picker">Saved recordings<select value={imported ? '' : (trace?.id ?? '')} onChange={(change) => {
      setImported(null);
      setSelected(change.target.value);
      setNotice('');
    }}>
      {imported && <option value="">Imported replay</option>}
      {recording.library.map((stored) => <option key={stored.id} value={stored.id}>{utc.format(new Date(stored.startedAt))} UTC · {stored.id.slice(0, 8)}</option>)}
    </select></label>}
    {remove && <div className="lab-controls" role="group" aria-label="Confirm deletion"><p>Delete this recording from this browser?</p><button type="button" onClick={() => removeClosed(remove)}>Confirm delete</button><button type="button" onClick={() => setRemove('')}>Keep recording</button></div>}
    {recording.error && <p role="alert">{recording.error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!trace && <p className="replay-empty">Start a recording, change the simulation scenario, then run an infrastructure query or review a handoff.</p>}
    {trace && <ReplayTimeline key={`${imported ? 'import' : 'local'}-${trace.id}`} trace={trace} />}
  </section>;
}
