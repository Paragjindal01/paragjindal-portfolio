import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { templates } from '../../core/index.mjs';
import { client } from './client.mjs';
import Icon from './Icon.jsx';
import Studio, { startTemplate } from './Studio.jsx';
import Execution from './Execution.jsx';
import { Agents, Evaluation, Integrations, Overview, Reports, Settings } from './Views.jsx';
import { pretty } from './format.mjs';
import './styles.css';

const routes = [
  ['overview', 'Overview'], ['studio', 'Workflow Studio'], ['agents', 'Agents'], ['executions', 'Executions'],
  ['integrations', 'Integrations'], ['evaluation', 'Evaluation Lab'], ['reports', 'Reports'], ['settings', 'Settings'],
];
const currentRoute = () => routes.some(([id]) => id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'studio';
const startingTemplate = templates.find((template) => template.id === 'incident-investigator') || templates[0];

function App() {
  const [page, setPage] = useState(currentRoute);
  const [open, setOpen] = useState(false);
  const [workflow, setWorkflow] = useState(() => startTemplate(startingTemplate));
  const [sampleInput, setSampleInput] = useState(() => pretty(startingTemplate.inputs));
  const [versions, setVersions] = useState([]);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [health, setHealth] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [run, setRun] = useState(null);
  const [globalError, setGlobalError] = useState('');
  const active = runs.some((item) => item.status === 'queued' || item.status === 'running');

  useEffect(() => {
    const listener = () => { setPage(currentRoute()); setOpen(false); };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);

  function go(next) {
    setPage(next);
    setOpen(false);
    window.location.hash = next;
    window.scrollTo(0, 0);
  }
  function chooseTemplate(template) {
    setWorkflow(startTemplate(template));
    setSampleInput(pretty(template.inputs || {}));
    go('studio');
  }
  const retryHealth = useCallback(async () => {
    try { setHealth(await client.health()); setGlobalError(''); }
    catch (error) { setGlobalError(error.message); }
  }, []);
  useEffect(() => { void retryHealth(); }, [retryHealth]);

  const refreshVersions = useCallback(async (id) => {
    try {
      const [history, recent] = await Promise.all([client.versions(id), client.workflows()]);
      setVersions(history);
      setSavedWorkflows(recent);
    } catch (error) { setGlobalError(error.message); }
  }, []);
  useEffect(() => { void refreshVersions(workflow.id); }, [refreshVersions, workflow.id]);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const items = await client.runs();
        if (!alive) return;
        setRuns(items);
        if (!selectedId && items[0]) setSelectedId(items[0].id);
        if (selectedId) {
          const item = await client.run(selectedId);
          if (alive) setRun(item);
        }
      } catch (error) { if (alive) setGlobalError(error.message); }
      finally { inFlight = false; }
    };
    void load();
    const interval = setInterval(load, active ? 700 : 3200);
    return () => { alive = false; clearInterval(interval); };
  }, [selectedId, active]);

  function openRun(item) {
    if (item.steps) setRun(item);
    else setRun(null);
    setSelectedId(item.id);
    setRuns((items) => items.some((entry) => entry.id === item.id) ? items : [item, ...items]);
    go('executions');
  }
  function selectRun(id) { setSelectedId(id); setRun(null); }

  const views = {
    overview: <Overview runs={runs} selectTemplate={chooseTemplate} openRun={openRun} go={go} />,
    studio: <Studio workflow={workflow} setWorkflow={setWorkflow} onRun={openRun} versions={versions} savedWorkflows={savedWorkflows} refreshVersions={refreshVersions} sampleInput={sampleInput} setSampleInput={setSampleInput} health={health} />,
    agents: <Agents workflow={workflow} go={go} />,
    executions: <Execution runs={runs} run={run?.id === selectedId ? run : null} selectedId={selectedId} setSelected={selectRun} onRun={openRun} onUpdate={setRun} onStudio={() => go('studio')} />,
    integrations: <Integrations health={health} />,
    evaluation: <Evaluation runs={runs} selectedId={selectedId} go={go} />,
    reports: <Reports runs={runs} selectedId={selectedId} />,
    settings: <Settings health={health} retry={retryHealth} />,
  };
  const title = routes.find(([id]) => id === page)?.[1];
  const warning = client.warning();

  return <div className="app-shell"><a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content').focus(); }}>Skip to main content</a>
    <aside className="sidebar" data-open={open}>
      <a className="brand" href="#overview" onClick={() => go('overview')}><span><Icon name="brand" size={20} /></span><strong>RelayOps <b>AI</b></strong></a>
      <button type="button" className="icon-button nav-toggle" aria-controls="main-navigation" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} /></button>
      <nav id="main-navigation" aria-label="Main navigation"><p className="sidebar-label">Workspace</p>{routes.slice(0, 4).map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}><Icon name={id} /><span>{label}</span>{page === id && <i aria-hidden="true" />}</a>)}<p className="sidebar-label">Platform</p>{routes.slice(4).map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => go(id)} aria-current={page === id ? 'page' : undefined}><Icon name={id} /><span>{label}</span>{page === id && <i aria-hidden="true" />}</a>)}</nav>
      <div className="sidebar-foot"><span className="node-icon"><Icon name="approval" size={15} /></span><div><strong>{client.mode === 'offline' ? 'Private browser session' : 'Isolated local session'}</strong><small>{client.mode === 'offline' ? 'Stored on this device' : 'Backed by SQLite'}</small></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div><span>Workspace</span><Icon name="chevron" size={12} /><strong>{title}</strong></div><span className="environment"><i aria-hidden="true" />{client.mode === 'offline' ? 'Offline demonstration' : 'Local service'}</span></header><main id="main-content" className="page-content" tabIndex={-1}>{globalError && <p className="notice failure" role="alert">{globalError}</p>}{warning && <p className="notice failure" role="status">{warning}</p>}{views[page]}</main></div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
