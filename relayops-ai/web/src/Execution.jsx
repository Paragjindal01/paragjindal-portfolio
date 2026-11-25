import { useState } from 'react';
import { client, downloadFile, downloadJson } from './client.mjs';
import Icon from './Icon.jsx';
import { ACTIVE, durationMs, formatDate, pretty, statusWords, titleWords, typeWords } from './format.mjs';

export function Status({ value }) {
  return <span className="status-chip" data-status={value}><i aria-hidden="true" />{statusWords[value] || titleWords(value)}</span>;
}
export function Empty({ icon = 'executions', title, children }) {
  return <div className="empty-state"><span className="node-icon"><Icon name={icon} size={21} /></span><h2>{title}</h2>{children}</div>;
}

function JsonBlock({ value }) {
  return <pre className="json-block" tabIndex={0}>{pretty(value)}</pre>;
}

export function runArtifacts(run) {
  if (!run) return [];
  return (run.steps || []).flatMap((step) => {
    const artifacts = Array.isArray(step.artifacts) ? step.artifacts : [];
    return artifacts.map((item, index) => ({
      ...item, key: `${step.id}-${index}`, stepId: step.id,
      name: item.name || item.filename || item.title || `Artifact ${index + 1}`,
      content: item.content ?? item.data ?? item.text ?? step.output,
    }));
  });
}

function Artifact({ item }) {
  const text = typeof item.content === 'string' ? item.content : pretty(item.content);
  const type = item.mimeType || item.mediaType || item.type || (typeof item.content === 'string' ? 'text/plain' : 'application/json');
  return <article className="artifact"><div><div className="node-icon"><Icon name="document" /></div><h3>{item.name}</h3></div><button type="button" className="button secondary" onClick={() => downloadFile(item.name, text, type.includes('/') ? type : 'text/plain')}><Icon name="download" size={15} /> Download</button><pre tabIndex={0}>{text}</pre></article>;
}

function Approval({ step, onApprove, busy }) {
  const [note, setNote] = useState('');
  return <div className="approval-panel"><span className="node-icon" data-type="approval"><Icon name="approval" /></span><div><h3>{step.label}</h3><p>Review this step before continuing the simulated workflow. The decision and note are written to the execution trace.</p><label>Reviewer note<input value={note} maxLength={400} onChange={(event) => setNote(event.target.value)} placeholder="Optional" /></label><div className="button-row"><button type="button" className="button primary" disabled={busy} onClick={() => onApprove(step.id, 'approve', note)}>Approve simulation</button><button type="button" className="button danger" disabled={busy} onClick={() => onApprove(step.id, 'reject', note)}>Reject</button></div></div></div>;
}

function Summary({ run }) {
  const completed = run.steps.filter((step) => step.status === 'completed').length;
  const duration = run.startedAt && Date.parse(run.finishedAt || new Date()) - Date.parse(run.startedAt);
  const tokens = run.steps.reduce((sum, step) => sum + (Number(step.usage?.totalTokens ?? step.usage?.tokens) || 0), 0);
  const reported = run.steps.filter((step) => step.usage);
  const unpriced = run.mode === 'connected' && reported.some((step) => !Number.isFinite(step.usage.estimatedCostUsd));
  const cost = reported.reduce((sum, step) => sum + (Number(step.usage.estimatedCostUsd) || 0), 0);
  return <dl className="metric-row"><div><dt>Steps completed</dt><dd>{completed} / {run.steps.length}</dd></div><div><dt>Elapsed</dt><dd>{durationMs(duration)}</dd></div><div><dt>Reported tokens</dt><dd>{run.mode === 'connected' && !reported.length ? '—' : tokens.toLocaleString()}</dd></div><div><dt>Estimated cost</dt><dd>{unpriced ? 'Unpriced' : `$${cost ? cost.toFixed(4) : '0.00'}`}</dd></div></dl>;
}

function StepTrace({ step, dependencies }) {
  return <details className="step-trace">
    <summary><span className="trace-icon" data-status={step.status}><Icon name={step.type} size={17} /></span><span className="trace-label"><strong>{step.label}</strong><small>{typeWords[step.type]}{step.attempt ? ` · attempt ${step.attempt}` : ''}</small></span><Status value={step.status} /><Icon name="chevron" size={15} /></summary>
    <div className="step-details">
      {dependencies.length > 0 && <p><strong>Dependencies:</strong> {dependencies.map((edge) => edge.source).join(', ')}</p>}
      <p><strong>Started:</strong> {formatDate(step.startedAt)} · <strong>Finished:</strong> {formatDate(step.finishedAt)}</p>
      {step.error && <div className="notice failure">{typeof step.error === 'string' ? step.error : step.error.message || pretty(step.error)}</div>}
      {step.output !== undefined && step.output !== null && <><h3>Structured output</h3><JsonBlock value={step.output} /></>}
      {step.usage && <><h3>Usage</h3><JsonBlock value={step.usage} /></>}
    </div>
  </details>;
}

export default function Execution({ runs, run, selectedId, setSelected, onRun, onUpdate, onStudio }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function action(callback) {
    setBusy(true); setError('');
    try { await callback(); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="title-row"><div><p className="eyebrow">Run history</p><h1>Executions</h1><p className="screen-description">Inspect steps, review decisions, and replay a recorded workflow.</p></div><button className="button secondary" type="button" onClick={onStudio}>Open Workflow Studio <Icon name="arrow" size={15} /></button></div>
    {error && <p className="notice failure" role="alert">{error}</p>}
    <div className="execution-layout">
      <aside className="panel run-list" aria-label="Execution history"><div className="list-heading"><strong>History</strong><small>{runs.length} {runs.length === 1 ? 'run' : 'runs'}</small></div>{runs.length ? runs.map((item) => <button type="button" key={item.id} aria-pressed={item.id === selectedId} onClick={() => setSelected(item.id)}><strong>{item.workflowName}</strong><small>{formatDate(item.createdAt)}</small><Status value={item.status} /></button>) : <p>Runs you start will appear here.</p>}</aside>
      <section className="panel execution-detail" aria-label="Selected execution">
        {!run ? <Empty title="Select an execution"><p>Start a template from the studio or open a run from history.</p></Empty> : <>
          <div className="execution-header"><div><Status value={run.status} /><h2>{run.workflowName}</h2><p>{run.mode === 'offline' ? 'Deterministic offline' : titleWords(run.provider || 'Configured provider')} · {formatDate(run.createdAt)}{run.version ? ` · Version ${run.version}` : ''}</p></div>
            <div className="button-row">
              {ACTIVE.has(run.status) && <button type="button" className="button danger" disabled={busy} onClick={() => action(async () => onUpdate(await client.cancel(run.id)))}>Cancel run</button>}
              {!ACTIVE.has(run.status) && <button type="button" className="button secondary" disabled={busy} onClick={() => action(async () => onRun(await client.replay(run.id)))}>Replay run</button>}
              <button type="button" className="button secondary" disabled={busy} onClick={() => action(async () => downloadJson(`relayops-${run.id}.json`, await client.trace(run.id)))}><Icon name="download" size={15} /> Export trace</button>
            </div>
          </div>
          <Summary run={run} />
          {run.replayOf && <p className="muted replay-note">Replay of <code>{run.replayOf}</code></p>}
          {run.status === 'waiting' && run.steps.filter((step) => step.status === 'waiting').map((step) => <Approval key={step.id} step={step} busy={busy} onApprove={(stepId, decision, note) => action(async () => onUpdate(await client.approve(run.id, { stepId, decision, note })))} />)}
          <div className="steps"><h3>Step timeline</h3>{run.steps.map((step) => <StepTrace key={step.id} step={step} dependencies={(run.workflow?.edges || []).filter((edge) => edge.target === step.id)} />)}</div>
          <details className="studio-details"><summary><Icon name="code" size={16} /> Execution input</summary><JsonBlock value={run.input} /></details>
          <details className="studio-details"><summary><Icon name="clock" size={16} /> Event log <span>{run.trace?.length || 0}</span></summary><ol className="event-list">{run.trace?.map((event) => <li key={event.sequence}><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time><strong>{titleWords(event.type)}</strong><small>{event.stepId || 'Workflow'}{event.data?.note ? ` · ${event.data.note}` : ''}</small></li>)}</ol></details>
          <div className="steps">{runArtifacts(run).length > 0 && <><h3>Execution artifacts</h3>{runArtifacts(run).map((item) => <Artifact key={item.key} item={item} />)}</>}</div>
        </>}
      </section>
    </div>
  </>;
}

export function ReportArtifacts({ run }) {
  return runArtifacts(run).map((item) => <Artifact key={item.key} item={item} />);
}
