import { lazy, Suspense, useMemo, useState } from 'react';
import { GITHUB, LAB_PROJECTS, REPOSITORY } from './catalog.mjs';
import LabIcon from './LabIcon.jsx';
import { createSnapshot, SCENARIOS } from './simulator.mjs';

const applications = {
  rackops: lazy(() => import('./apps/RackOps.jsx')),
  gpuwatch: lazy(() => import('./apps/GPUWatch.jsx')),
  powerops: lazy(() => import('./apps/PowerOps.jsx')),
  'infrapilot-ai': lazy(() => import('./apps/InfraPilot.jsx')),
  fabriclab: lazy(() => import('./apps/FabricLab.jsx')),
  virtscan: lazy(() => import('./apps/VirtScan.jsx')),
  storagecalc: lazy(() => import('./apps/StorageCalc.jsx')),
  localmind: lazy(() => import('./apps/LocalMind.jsx')),
};

function routeFor(id, scenario) {
  return `/lab/${id}${scenario === 'normal' ? '' : `?scenario=${scenario}`}`;
}

export default function LabShell({ slug }) {
  const query = new URLSearchParams(window.location.search);
  const project = LAB_PROJECTS.find(({ id }) => id === slug);
  const requestedScenario = query.get('scenario');
  const [scenario, updateScenario] = useState(SCENARIOS.includes(requestedScenario) ? requestedScenario : 'normal');
  const [step, setStep] = useState(() => {
    const initial = Number(query.get('step'));
    return Number.isSafeInteger(initial) && initial >= 0 && initial < 96 ? initial : 0;
  });
  const snapshot = useMemo(() => createSnapshot({ scenario, step }), [scenario, step]);
  const Application = applications[slug];
  function setScenario(value) {
    if (!SCENARIOS.includes(value)) return;
    const url = new URL(window.location.href);
    if (value === 'normal') url.searchParams.delete('scenario');
    else url.searchParams.set('scenario', value);
    window.history.replaceState(null, '', url);
    updateScenario(value);
  }

  function advance() {
    const next = (step + 1) % 96;
    const url = new URL(window.location.href);
    if (next === 0) url.searchParams.delete('step');
    else url.searchParams.set('step', String(next));
    window.history.replaceState(null, '', url);
    setStep(next);
  }

  return <div className="lab-shell">
    <a className="skip-link" href="#lab-main">Skip to application</a>
    <header className="lab-header"><a className="lab-brand" href="/lab"><span className="brand-symbol"><LabIcon name="grid" size={17} /></span> Engineering Lab</a><div><a href="/">Portfolio</a><a href={REPOSITORY}>GitHub <LabIcon name="external" size={15} /></a></div></header>
    <div className="lab-workspace">
      <nav className="lab-sidebar" aria-label="Engineering applications">
        <a className="sidebar-overview" href="/lab" aria-current={slug ? undefined : 'page'}><LabIcon name="grid" size={17} /> Lab overview</a>
        {LAB_PROJECTS.map((item) => <a key={item.id} href={routeFor(item.id, scenario)} aria-current={slug === item.id ? 'page' : undefined}><LabIcon name={item.icon} size={17} />{item.name}</a>)}
      </nav>
      <main id="lab-main" className="lab-main" tabIndex={-1}>
        {project ? <>
          <div className="lab-heading"><span className="eyebrow">{project.area}</span><h1>{project.name}</h1><p>{project.description}</p><div className="lab-heading-links"><a href={`${REPOSITORY}/blob/main/src/lab/apps/${project.file}.jsx`}>Source <LabIcon name="external" size={14} /></a><a href={`${REPOSITORY}/blob/main/docs/projects/${project.id}.md`}>Case study <LabIcon name="external" size={14} /></a></div></div>
          {project.simulation && <div className="lab-scenario"><div><strong><span className="status-dot" /> Simulated telemetry</strong><small>{snapshot.facilities[0].name} · step {snapshot.step}</small></div><div className="lab-controls"><label>Scenario<select value={scenario} onChange={(event) => setScenario(event.target.value)}>{SCENARIOS.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label><button type="button" onClick={advance}>Advance 15 min</button></div></div>}
          <Suspense fallback={<p role="status">Loading {project.name}…</p>}><Application snapshot={snapshot} scenario={scenario} setScenario={setScenario} /></Suspense>
        </> : slug ? <div className="lab-heading"><h1>Application unavailable</h1><p>Choose a project from the engineering lab.</p><a className="site-button site-button-primary" href="/lab">Open lab overview</a></div> : <>
          <div className="lab-heading lab-overview"><span className="eyebrow">Independent projects by Parag Jindal</span><h1>Engineering Lab</h1><p>Eight interactive applications for infrastructure operations, capacity planning, and local AI. Explore the fictional Alder Research Facility or open a standalone tool.</p></div>
          <div className="lab-overview-stats"><div><strong>{snapshot.racks.length}</strong><span>Simulation racks</span></div><div><strong>{snapshot.servers.length}</strong><span>Fictional servers</span></div><div><strong>{SCENARIOS.length}</strong><span>Operational scenarios</span></div></div>
          <div className="lab-card-grid">{LAB_PROJECTS.map((item) => <a href={routeFor(item.id, scenario)} className="lab-card" key={item.id}><span className="lab-icon"><LabIcon name={item.icon} /></span><span className="eyebrow">{item.area}</span><h2>{item.name}</h2><p>{item.description}</p><span className="lab-card-link">Open application <LabIcon name="arrow" size={16} /></span></a>)}</div>
        </>}
        <footer className="lab-footer"><span>Independent engineering portfolio</span><a href={GITHUB}>Parag Jindal</a></footer>
      </main>
    </div>
  </div>;
}
