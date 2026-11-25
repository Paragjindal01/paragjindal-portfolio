import { useEffect, useState } from 'react';
import { roles } from '../../core/contracts.mjs';
import { templates } from '../../core/index.mjs';
import { client, downloadJson } from './client.mjs';
import { Empty, ReportArtifacts, Status, runArtifacts } from './Execution.jsx';
import { ACTIVE, durationMs, formatDate, titleWords } from './format.mjs';
import Icon from './Icon.jsx';

const templateIcons = { 'github-review': 'code', 'research-pipeline': 'agents', 'data-analyst': 'evaluation', 'incident-investigator': 'executions' };
const roleTasks = {
  research: 'Collect and organize relevant evidence from bounded sources.',
  planning: 'Break a research objective into concrete, reviewable stages.',
  'data-analysis': 'Calculate descriptive statistics and correlate telemetry.',
  'engineering-review': 'Review public project structure, tests, and documentation.',
  document: 'Prepare structured notes for a downstream report step.',
  verification: 'Check that claims are represented in the supplied evidence.',
  coordinator: 'Annotate and pass structured results to dependent steps.',
};

function PageTitle({ title, description, children }) {
  return <div className="title-row"><div><h1>{title}</h1><p className="screen-description">{description}</p></div>{children}</div>;
}

export function Overview({ runs, selectTemplate, openRun, go }) {
  const completed = runs.filter((run) => run.status === 'completed').length;
  return <>
    <div className="overview-hero"><div><span className="eyebrow">Workflow operations</span><h1>Design, run, and review AI workflows.</h1><p>Connect specialized steps into a repeatable workflow. Inspect the inputs, decisions, and artifacts behind every result.</p><button type="button" className="button primary" onClick={() => go('studio')}>Open Workflow Studio <Icon name="arrow" size={16} /></button></div><div className="overview-diagram" aria-hidden="true"><span /><span /><span /><span /><i /><i /><i /><i /><div><Icon name="studio" size={66} /></div></div></div>
    <dl className="metric-row overview-metrics"><div><dt>Templates</dt><dd>{templates.length}</dd></div><div><dt>Recorded runs</dt><dd>{runs.length}</dd></div><div><dt>Active runs</dt><dd>{runs.filter((run) => ACTIVE.has(run.status)).length}</dd></div><div><dt>Completed runs</dt><dd>{completed}</dd></div></dl>
    <div className="section-heading"><h2>Workflow templates</h2><p>Load a working graph with sample inputs.</p></div>
    <div className="template-grid">{templates.map((template) => <article key={template.id} className="panel template-card"><span className="node-icon"><Icon name={templateIcons[template.id]} /></span><h3>{template.name}</h3><p>{template.description}</p><button type="button" className="link-button" onClick={() => selectTemplate(template)}>Use template <Icon name="arrow" size={15} /></button></article>)}</div>
    <section className="panel activity-panel"><div className="section-heading"><h2>Recent executions</h2><p>Open a run to view its timeline.</p></div>{runs.length ? <ul className="recent-list">{runs.slice(0, 5).map((run) => <li key={run.id}><button type="button" onClick={() => openRun(run)}><strong>{run.workflowName}</strong><span>{formatDate(run.createdAt)}</span><Status value={run.status} /><Icon name="arrow" size={17} /></button></li>)}</ul> : <p className="muted">Start a workflow to see execution activity.</p>}</section>
  </>;
}

export function Agents({ workflow, go }) {
  const used = workflow.nodes.filter((item) => item.type === 'agent');
  return <><PageTitle title="Agents" description="Specialized roles and the workflow steps currently assigned to them."><button className="button secondary" type="button" onClick={() => go('studio')}>Configure steps in studio <Icon name="arrow" size={15} /></button></PageTitle><div className="template-grid role-grid">{roles.map((role) => <article key={role} className="panel template-card"><span className="node-icon" data-type="agent"><Icon name="agent" /></span><h2>{titleWords(role)}</h2><p>{roleTasks[role]}</p><div className="role-usage">{used.filter((node) => node.config.role === role).length ? used.filter((node) => node.config.role === role).map((node) => <span key={node.id}>{node.label}</span>) : <span>No steps in the open workflow</span>}</div></article>)}</div></>;
}

export function Integrations({ health }) {
  const external = Boolean(health?.connected);
  const integrations = [
    ['code', 'GitHub public repositories', external ? 'Read-only connector' : 'Fixture mode', external ? 'Evidence is gathered from allowlisted public GitHub API routes. Repository text is treated as data.' : 'The review template reads the bundled repository example. Online mode uses the local backend.'],
    ['integrations', 'Public HTTP', external ? 'Read-only connector' : 'Fixture mode', 'The connector accepts predefined operations and validates their responses.'],
    ['document', 'CSV and JSON', 'Available', 'Data is parsed, normalized, and analyzed within the execution runtime.'],
    ['trigger', 'Webhook trigger', client.mode === 'service' ? 'Service session' : 'Sample only', client.mode === 'service' ? 'The backend accepts bounded authenticated requests for saved webhook workflows.' : 'Select a trigger in the studio or submit a saved workflow through the local service.'],
    ['notification', 'Notifications', 'Simulated', 'Notification steps produce trace events without sending messages.'],
    ['agents', 'Model providers', external ? `${(health?.providers || []).length} available` : 'Deterministic', 'Provider configuration lives on the server. Browser demos use deterministic workflow stages.'],
  ];
  return <><PageTitle title="Integrations" description="Inspect connector capabilities and the active execution environment." /><div className="template-grid role-grid">{integrations.map(([icon, title, state, copy]) => <article className="panel template-card" key={title}><div className="connector-head"><span className="node-icon"><Icon name={icon} /></span><span className="plain-badge">{state}</span></div><h2>{title}</h2><p>{copy}</p></article>)}</div></>;
}

function RunSelect({ runs, value, onChange, label = 'Execution', optional = false }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{optional ? 'No comparison' : 'Choose an execution'}</option>{runs.map((run) => <option value={run.id} key={run.id}>{run.workflowName} · {formatDate(run.createdAt)}</option>)}</select></label>;
}

function EvaluationResult({ result, title }) {
  if (!result) return null;
  const checks = result.checks || [];
  const score = Number.isFinite(result.score) ? `${result.score}%` : '—';
  return <article className="panel evaluation-result"><div className="section-heading"><span className="eyebrow">{title}</span><h2>{score} checks passed</h2></div><ul className="check-list">{checks.map((check) => <li key={check.id}><span className="node-icon" data-type={check.passed === false ? 'approval' : 'validate'}><Icon name={check.passed === null ? 'minus' : check.passed ? 'validate' : 'approval'} /></span><div><strong>{check.label}</strong><p>{check.detail}</p></div><span className="plain-badge" data-result={check.passed === null ? 'skip' : check.passed ? 'pass' : 'fail'}>{check.passed === null ? 'Not applicable' : check.passed ? 'Passed' : 'Failed'}</span></li>)}</ul><dl className="metric-row"><div><dt>Elapsed</dt><dd>{durationMs(result.metrics?.durationMs)}</dd></div><div><dt>Tokens</dt><dd>{result.metrics?.tokens ?? '—'}</dd></div><div><dt>Cost estimate</dt><dd>{Number.isFinite(result.metrics?.estimatedCostUsd) ? `$${result.metrics.estimatedCostUsd.toFixed(4)}` : 'Unpriced'}</dd></div></dl></article>;
}

export function Evaluation({ runs, selectedId, go }) {
  const candidates = runs.filter((run) => !ACTIVE.has(run.status));
  const [primary, setPrimary] = useState(candidates.find((item) => item.id === selectedId)?.id || candidates[0]?.id || '');
  const [comparison, setComparison] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function evaluate(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const [first, second] = await Promise.all([client.evaluate(primary), comparison ? client.evaluate(comparison) : null]);
      setReport({ primary, comparison, first, second });
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <>
    <PageTitle title="Evaluation Lab" description="Score actual executions and compare the effects of workflow or model changes." />
    {candidates.length ? <><form className="panel evaluation-controls" onSubmit={evaluate}><RunSelect runs={candidates} value={primary} onChange={setPrimary} label="Baseline execution" /><RunSelect runs={candidates.filter((item) => item.id !== primary)} value={comparison} onChange={setComparison} label="Comparison execution" optional /><button className="button primary" type="submit" disabled={!primary || busy}>Evaluate runs</button></form>{error && <p className="notice failure" role="alert">{error}</p>}{report && <><div className="button-row evaluation-export"><button type="button" className="button secondary" onClick={() => downloadJson('relayops-evaluation.json', report)}><Icon name="download" size={15} /> Export evaluation</button></div><div className="evaluation-grid"><EvaluationResult result={report.first} title="Baseline" /><EvaluationResult result={report.second} title="Comparison" /></div></>}</> : <div className="panel"><Empty icon="evaluation" title="No finished executions"><p>Complete a workflow to evaluate its recorded results.</p><button className="button primary" type="button" onClick={() => go('studio')}>Open Workflow Studio</button></Empty></div>}
  </>;
}

function Chart({ chart }) {
  const finite = (Array.isArray(chart.points) ? chart.points : []).filter((point) => Number.isFinite(point.value));
  const points = finite.length > 90 ? finite.filter((_, index) => index % Math.ceil(finite.length / 90) === 0 || index === finite.length - 1) : finite;
  if (!points.length) return null;
  const high = Math.max(...finite.map((point) => point.value));
  const low = Math.min(...finite.map((point) => point.value));
  const coordinates = points.map((point, index) => `${30 + index / Math.max(1, points.length - 1) * 260},${105 - (high > low ? (point.value - low) / (high - low) : .5) * 82}`).join(' ');
  return <figure className="report-chart"><figcaption>{titleWords(chart.column)}</figcaption><svg viewBox="0 0 312 126" role="img" aria-label={`${chart.column} series with ${finite.length} observations`}><path d="M30 12v93h260" fill="none" stroke="currentColor" strokeOpacity=".37"/><polyline points={coordinates} fill="none" stroke="#2f6348" strokeWidth="2.8" vectorEffect="non-scaling-stroke" /></svg><small>{finite.length} observations · {low.toLocaleString()}–{high.toLocaleString()}</small></figure>;
}

export function Reports({ runs, selectedId }) {
  const [selected, setSelected] = useState(selectedId || runs[0]?.id || '');
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const selectedStatus = runs.find((item) => item.id === selected)?.status;
  useEffect(() => {
    if (!selected) return undefined;
    let active = true;
    client.run(selected).then((item) => { if (active) setRun(item); }).catch((issue) => { if (active) setError(issue.message); });
    return () => { active = false; };
  }, [selected, selectedStatus]);
  const charts = (run?.steps || []).flatMap((step) => Array.isArray(step.output?.charts) ? step.output.charts : []);
  return <><PageTitle title="Reports" description="Review the report and data series produced by a recorded workflow." />{runs.length > 0 && <div className="panel evaluation-controls"><RunSelect runs={runs} value={selected} onChange={(value) => { setRun(null); setError(''); setSelected(value); }} /></div>}{error && <p className="notice failure" role="alert">{error}</p>}{charts.length > 0 && <section className="panel chart-panel"><div className="section-heading"><h2>Execution charts</h2><p>Generated from the selected run’s structured results.</p></div><div className="chart-grid">{charts.map((chart, index) => <Chart key={`${chart.column}-${index}`} chart={chart} />)}</div></section>}{runArtifacts(run).length === 0 ? <div className="panel"><Empty icon="reports" title="No report artifacts"><p>{run ? 'This run has no report artifacts yet.' : 'Select an execution that includes a document step.'}</p></Empty></div> : <ReportArtifacts run={run} />}</>;
}

export function Settings({ health, retry }) {
  return <><PageTitle title="Settings" description="Inspect execution mode, persistence, and available providers." /><div className="settings-grid"><section className="panel settings-panel"><div className="section-heading"><h2>Execution environment</h2></div><dl className="definition-list"><div><dt>Mode</dt><dd>{client.mode === 'offline' ? 'Offline browser' : 'Local backend'}</dd></div><div><dt>Persistence</dt><dd>{health?.persistence === 'sqlite' ? 'SQLite' : health?.persistence === 'browser' ? 'Browser storage' : 'Unavailable'}</dd></div><div><dt>Health</dt><dd>{health?.ok ? 'Available' : 'Unavailable'}</dd></div></dl><button type="button" className="button secondary" onClick={retry}>Refresh health</button></section><section className="panel settings-panel"><div className="section-heading"><h2>Model providers</h2></div><ul className="provider-list">{(health?.providers || ['offline']).map((provider) => { const id = typeof provider === 'string' ? provider : provider.provider || provider.id || provider.name; return <li key={id}><strong>{id === 'offline' ? 'Deterministic offline' : titleWords(id)}</strong><span className="plain-badge">{typeof provider === 'object' && provider.status ? titleWords(provider.status) : 'Available'}</span></li>; })}</ul><p className="muted">Real model credentials and routing policies are configured on the local server.</p></section></div></>;
}
