import { useCallback, useEffect, useState } from 'react';
import {
  chooseTool, decideHandoff, EXAMPLE_QUERIES, listOutlets, prepareHandoff, runTool, THRESHOLDS, validateThresholds,
} from './infrapilot.mjs';
import { AiProvider } from './LabAiProvider.jsx';
import { requestAi } from './lab-ai-client.mjs';
import IncidentReplay from '../replay/IncidentReplay.jsx';
import { useIncidentRecording } from '../replay/useIncidentRecording.js';
import './lab-ai.css';

const INITIAL_QUERY = EXAMPLE_QUERIES[0];
const nowMs = () => Date.now();
const formatTime = (time) => new Date(time).toLocaleTimeString();

function Handoffs({ snapshot, record, capture }) {
  const [outlet, setOutlet] = useState('');
  const [operation, setOperation] = useState('reboot');
  const [role, setRole] = useState('viewer');
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const outlets = listOutlets(snapshot).filter(({ serverId, deviceId }) => serverId || deviceId);
  const selected = outlets.find(({ id }) => id === outlet)?.id || outlets[0]?.id || '';

  function prepare(event) {
    event.preventDefault();
    try {
      const request = prepareHandoff(snapshot, selected, operation, nowMs(), crypto.randomUUID());
      setRequests((prior) => [request, ...prior].slice(0, 20));
      setMessage('Handoff saved for review.');
      record('Handoff prepared', request.operation + ' · ' + request.assetLabel);
      void capture('handoff.prepared', { request });
    } catch (failure) {
      setMessage(failure.message);
    }
  }

  async function review(request, approved) {
    try {
      const next = decideHandoff(request, role, approved, nowMs());
      const pendingTrace = capture('handoff.' + next.status, { request: next, role });
      setRequests((prior) => prior.map((item) => item.id === request.id ? { ...next, linking: approved } : item));
      const trace = await pendingTrace;
      setRequests((prior) => prior.map((item) => item.id === request.id ? { ...next, incidentId: trace?.id } : item));
      setMessage(approved ? 'Approved for handoff to PowerOps.' : 'Handoff rejected.');
      record('Handoff ' + next.status, request.operation + ' · ' + request.assetLabel);
    } catch (failure) {
      setMessage(failure.message);
      record('Handoff denied', failure.message);
      void capture('handoff.denied', { request, role, reason: failure.message });
    }
  }

  function powerLink(request) {
    const params = new URLSearchParams({ outlet: request.outletId, scenario: snapshot.scenario });
    if (snapshot.step) params.set('step', String(snapshot.step));
    if (request.incidentId) {
      params.set('incident', request.incidentId);
      params.set('handoff', request.id);
    }
    return '/lab/powerops?' + params;
  }

  return (
    <section className="lab-panel" aria-labelledby="infrapilot-handoff">
      <h2 id="infrapilot-handoff">Simulated outlet handoff</h2>
      <p>An operator reviews the proposed action. PowerOps handles outlet control and requires its own confirmation.</p>
      <form className="lab-ai-form" onSubmit={prepare}>
        <label>Assigned outlet <select value={selected} onChange={(event) => setOutlet(event.target.value)} disabled={!selected}>
          {outlets.map(({ id, pduName, number, deviceName }) => <option key={id} value={id}>{pduName} / {number} · {deviceName}</option>)}
        </select></label>
        <label>Proposed operation <select value={operation} onChange={(event) => setOperation(event.target.value)}>
          <option value="reboot">Reboot</option><option value="off">Turn off</option><option value="on">Turn on</option>
        </select></label>
        <button type="submit" disabled={!selected}>Prepare handoff</button>
      </form>
      <div className="lab-controls lab-ai-metrics">
        <label>Demo reviewer role <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="viewer">Viewer</option><option value="operator">Operator</option>
        </select></label>
      </div>
      {message && <p role="status">{message}</p>}
      {requests.length > 0 && <ol className="lab-ai-sources">
        {requests.map((request) => (
          <li key={request.id}>
            <strong>{request.operation} · {request.assetLabel}</strong>{' '}<span className="lab-badge">{request.status}</span>
            {request.status === 'pending' && <div className="lab-ai-actions">
              <button type="button" onClick={() => review(request, true)}>Approve handoff</button>
              <button type="button" onClick={() => review(request, false)}>Reject</button>
            </div>}
            {request.status === 'approved' && !request.linking && <p><a href={powerLink(request)}>Review selected outlet in PowerOps</a></p>}
          </li>
        ))}
      </ol>}
    </section>
  );
}

export default function InfraPilot({ snapshot }) {
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [thresholds, setThresholds] = useState(THRESHOLDS);
  const [draftThresholds, setDraftThresholds] = useState(THRESHOLDS);
  const [thresholdError, setThresholdError] = useState('');
  const [provider, setProvider] = useState('offline');
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState('');
  const [modelError, setModelError] = useState('');
  const [execution, setExecution] = useState(null);
  const [pending, setPending] = useState(false);
  const [schedule, setSchedule] = useState(0);
  const [lastScheduled, setLastScheduled] = useState(null);
  const [history, setHistory] = useState([]);
  const recording = useIncidentRecording(snapshot);
  const { capture } = recording;

  const record = useCallback((actor, text, result = null) => {
    const item = { id: crypto.randomUUID(), time: nowMs(), actor, text, result };
    setHistory((prior) => [item, ...prior].slice(0, 40));
  }, []);

  useEffect(() => {
    if (!schedule) return undefined;
    const timer = window.setInterval(() => {
      try {
        const result = runTool('report', snapshot, thresholds);
        record('Scheduled report', result.summary, result);
        void capture('analysis.completed', { trigger: 'scheduled report', thresholds, result });
        setLastScheduled(nowMs());
      } catch (failure) {
        record('Scheduled report failed', failure.message);
        void capture('analysis.rejected', { trigger: 'scheduled report', reason: failure.message });
      }
    }, schedule * 1000);
    return () => window.clearInterval(timer);
  }, [schedule, snapshot, thresholds, record, capture]);

  const display = execution || { question: INITIAL_QUERY, result: runTool('health', snapshot, thresholds), scenario: snapshot.scenario };

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setModelError('');
    setGenerated(null);
    try {
      const tool = chooseTool(query);
      const result = runTool(tool, snapshot, thresholds);
      const nextExecution = { question: query.trim(), result, scenario: snapshot.scenario };
      setExecution(nextExecution);
      record('Query', query.trim(), result);
      void capture('analysis.completed', { trigger: 'operator query', thresholds, result });
      if (provider !== 'offline') {
        setPending(true);
        try {
          const response = await requestAi('infrapilot', { provider, question: query.trim(), result });
          setGenerated({ execution: nextExecution, answer: response });
          record('Model summary', response.provider + ' · ' + result.tool);
        } catch (failure) {
          setModelError(failure.message + ' The deterministic tool result is shown.');
          record('Model summary unavailable', failure.message);
        } finally {
          setPending(false);
        }
      }
    } catch (failure) {
      setError(failure.message);
      record('Query rejected', failure.message);
      void capture('analysis.rejected', { trigger: 'operator query', reason: failure.message });
    }
  }

  function updateThresholds(event) {
    event.preventDefault();
    try {
      const next = Object.fromEntries(Object.entries(draftThresholds).map(([key, value]) => [key, Number(value)]));
      validateThresholds(next);
      setThresholds(next);
      setThresholdError('');
      void capture('thresholds.changed', { previous: thresholds, next });
      record('Thresholds updated', next.gpuC + ' °C GPU · ' + next.inletC + ' °C inlet · ' + next.outletPercent + '% outlet');
    } catch (failure) {
      setThresholdError(failure.message);
    }
  }

  function openReport(item) {
    setExecution({ question: item.actor, result: item.result, scenario: item.scenario || 'Recorded snapshot' });
    setGenerated(null);
    setError('');
    setModelError('');
  }

  function exportReport(result) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'infrapilot-' + result.tool + '.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="lab-ai-stack">
      <section className="lab-panel" aria-labelledby="infrapilot-query">
        <h2 id="infrapilot-query">Infrastructure operations console</h2>
        <p>Run validated inventory, telemetry, and incident queries against the active simulation. <a href="#incident-replay">Open incident replay</a></p>
        <form className="lab-ai-form" onSubmit={submit}>
          <label>Ask about the laboratory <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} required /></label>
          <div className="lab-controls">
            <AiProvider value={provider} onChange={(next) => { setProvider(next); setGenerated(null); }} />
            <button type="submit" disabled={pending}>{pending ? 'Generating…' : 'Run infrastructure query'}</button>
          </div>
        </form>
        <details className="lab-ai-output">
          <summary>Example queries</summary>
          <div className="lab-ai-actions">
            {EXAMPLE_QUERIES.map((example) => <button type="button" key={example} onClick={() => setQuery(example)}>{example}</button>)}
          </div>
        </details>
        {error && <p role="alert">{error}</p>}
        {modelError && <p role="status">{modelError}</p>}
        <div className="lab-ai-output" aria-live="polite">
          <p className="lab-ai-query">{display.question}</p>
          <div className="lab-controls">
            <span className="lab-badge">Rule-based analytics</span>
            <span className={'lab-badge ' + display.result.severity}>{display.result.severity}</span>
            <span className="lab-badge">{display.scenario}</span>
          </div>
          <h3>{display.result.title}</h3>
          <p>{display.result.summary}</p>
          {display.result.rows.length ? <div className="lab-table-wrap">
            <table className="lab-table">
              <thead><tr><th>Asset or check</th><th>Reading</th><th>Detail</th><th>Severity</th></tr></thead>
              <tbody>{display.result.rows.map((item, index) => (
                <tr key={item.asset + index}><td>{item.asset}</td><td>{item.measurement}</td><td>{item.detail}</td><td>{item.severity}</td></tr>
              ))}</tbody>
            </table>
          </div> : <p>No affected assets matched this query.</p>}
          {display.result.recommendations.length > 0 && <>
            <h3>Suggested actions</h3>
            <ul>{display.result.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
          </>}
          {generated?.execution === execution && generated?.answer.provider === provider && <>
            <h3>{generated.answer.provider === 'ollama' ? 'Ollama summary' : 'External model summary'}</h3>
            <p>{generated.answer.text}</p>
          </>}
          <button type="button" onClick={() => exportReport(display.result)}>Export results as JSON</button>
        </div>
      </section>

      <div className="lab-grid lab-ai-columns">
        <section className="lab-panel" aria-labelledby="infrapilot-workflows">
          <h2 id="infrapilot-workflows">Report workflows</h2>
          <p>Run a health report on an interval while this tab is open. Scheduled reports appear in activity history.</p>
          <div className="lab-controls">
            <label>Run cadence <select value={schedule} onChange={(event) => {
              const seconds = Number(event.target.value);
              setSchedule(seconds);
              record('Schedule changed', seconds ? 'Every ' + seconds + ' seconds' : 'Disabled');
              void capture('schedule.changed', { seconds });
            }}>
              <option value={0}>Disabled</option><option value={15}>Every 15 seconds</option><option value={60}>Every minute</option><option value={300}>Every five minutes</option>
            </select></label>
            <button type="button" onClick={() => {
              const result = runTool('report', snapshot, thresholds);
              setExecution({ question: 'Manual report workflow', result, scenario: snapshot.scenario });
              setGenerated(null);
              record('Manual report', result.summary, result);
              void capture('analysis.completed', { trigger: 'manual report', thresholds, result });
            }}>Run health report now</button>
          </div>
          {lastScheduled && <p aria-live="polite">Last scheduled run: {formatTime(lastScheduled)}</p>}

          <h3>Analysis thresholds</h3>
          <form className="lab-ai-form" onSubmit={updateThresholds}>
            {[
              ['gpuC', 'GPU warning (°C)', 45, 105],
              ['inletC', 'Inlet warning (°C)', 15, 60],
              ['outletPercent', 'Outlet warning (%)', 10, 100],
            ].map(([key, label, min, max]) => (
              <label key={key}>{label}<input type="number" min={min} max={max} value={draftThresholds[key]} required
                onChange={(event) => setDraftThresholds({ ...draftThresholds, [key]: event.target.value })} /></label>
            ))}
            <button type="submit">Save thresholds</button>
          </form>
          {thresholdError && <p role="alert">{thresholdError}</p>}
        </section>
        <Handoffs snapshot={snapshot} record={record} capture={capture} />
      </div>

      <IncidentReplay recording={recording} />

      <section className="lab-panel" aria-labelledby="infrapilot-history">
        <h2 id="infrapilot-history">Activity and execution history</h2>
        {history.length ? <div className="lab-table-wrap">
          <table className="lab-table">
            <thead><tr><th>Time</th><th>Event</th><th>Detail</th><th>Result</th></tr></thead>
            <tbody>{history.map((item) => (
              <tr key={item.id}><td>{formatTime(item.time)}</td><td>{item.actor}</td><td>{item.text}</td>
                <td>{item.result && <button type="button" onClick={() => openReport(item)}>View result</button>}</td></tr>
            ))}</tbody>
          </table>
        </div> : <p>Run a query or workflow to start the session history.</p>}
      </section>
    </div>
  );
}
