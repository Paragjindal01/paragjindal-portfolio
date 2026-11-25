import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Cursor, SiteNav } from '../higgsfield/home/chrome.tsx';
import { GITHUB, REPOSITORY } from './catalog.mjs';
import { LAB_TOOLS, toolHref } from './lab-design.mjs';
import { createSnapshot, SCENARIOS } from './simulator.mjs';
import '../higgsfield/home/shared-chrome.css';
import '../higgsfield/lab/engineering-lab.css';

const LabOverview = lazy(() => import('./LabOverview.jsx'));
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

function LabHero({ overview, project, slug, snapshot }) {
  const title = project?.name ?? (slug ? 'Application unavailable' : 'Engineering Lab');
  return <header className="labhero">
    <div aria-hidden="true" className="labhero__art"><img alt="" decoding="async" fetchPriority="high" src={project?.art ?? '/assets/world/hall-01-poster.webp'} /></div>
    <div className="labhero__inner">
      <div className="labhero__crumb">
        <a href="/">Portfolio</a><i aria-hidden="true">/</i><a href="/lab">Engineering lab</a><i aria-hidden="true">/</i>
        <span>{project ? `${project.number} / ${project.category}` : 'Overview'}</span>
      </div>
      <h1 className="labhero__title">{title}</h1>
      <p className="labhero__sub">{project?.description ?? (slug ? 'Choose a project from the engineering lab.' : 'My independent projects run on synthetic data from the fictional Alder Research Facility. Explore each tool, try an incident scenario, and see how the software responds.')}</p>
      {overview && <div className="labhero__facts">
        <span className="chip">Tools <strong>{LAB_TOOLS.length}</strong></span>
        <span className="chip">Servers <strong>{snapshot.servers.length}</strong></span>
        <span className="chip chip--cool">Scenarios <strong>{String(SCENARIOS.length).padStart(2, '0')}</strong></span>
        <span className="chip chip--hot">Synthetic data</span>
      </div>}
      {project && <div className="labhero__facts">
        {project.simulation && <span className="chip chip--hot">Synthetic data</span>}
        <a className="chip" href={project.links.source}>Source <span aria-hidden="true">↗</span></a>
        <a className="chip chip--cool" href={project.links.caseStudy}>Case study <span aria-hidden="true">↗</span></a>
        {project.id === 'infrapilot-ai' && <a className="chip" href="#incident-replay">Incident replay <span aria-hidden="true">↓</span></a>}
      </div>}
    </div>
  </header>;
}

function LabNavigation({ project, scenario }) {
  return <nav aria-label="Engineering applications" className="labswitch">
    <a aria-current={!project ? 'page' : undefined} aria-label="Lab overview" data-on={!project ? 'true' : undefined} href="/lab">Overview</a>
    {LAB_TOOLS.map((tool) => <a key={tool.id} href={toolHref(tool, scenario)} aria-current={project?.id === tool.id ? 'page' : undefined} data-on={project?.id === tool.id ? 'true' : undefined}>
      <span aria-hidden="true">{tool.code} · </span>{tool.name}
    </a>)}
  </nav>;
}

function ScenarioControls({ snapshot, scenario, setScenario, advance }) {
  return <div className="lab-scenario">
    <div><strong><span className="status-dot" /> Simulated telemetry</strong><small>{snapshot.facilities[0].name} · step {snapshot.step}</small></div>
    <div className="lab-controls">
      <label>Scenario<select value={scenario} onChange={(event) => setScenario(event.target.value)}>{SCENARIOS.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
      <button type="button" onClick={advance}>Advance 15 min</button>
    </div>
  </div>;
}

function ReplayAnchor({ enabled }) {
  useEffect(() => {
    if (enabled && window.location.hash === '#incident-replay') {
      document.getElementById('incident-replay')?.scrollIntoView();
    }
  }, [enabled]);
  return null;
}

export default function LabShell({ slug }) {
  const query = new URLSearchParams(window.location.search);
  const Application = applications[slug];
  const project = Application && LAB_TOOLS.find(({ id }) => id === slug);
  const requestedScenario = query.get('scenario');
  const [scenario, updateScenario] = useState(SCENARIOS.includes(requestedScenario) ? requestedScenario : 'normal');
  const [step, setStep] = useState(() => {
    const initial = Number(query.get('step'));
    return Number.isSafeInteger(initial) && initial >= 0 && initial < 96 ? initial : 0;
  });
  const snapshot = useMemo(() => createSnapshot({ scenario, step }), [scenario, step]);

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

  return <div className="lab-shell hf-engineering-lab">
    <a className="skip-link" href="#lab-main">Skip to {project ? 'application' : 'lab index'}</a>
    <Cursor />
    <div aria-hidden="true" className="grain" />
    <div aria-hidden="true" className="scan" />
    <SiteNav insideHome={false} />
    <LabHero overview={!slug} project={project} slug={slug} snapshot={snapshot} />
    <LabNavigation project={project} scenario={scenario} />
    <main className="labbody lab-main" id="lab-main" tabIndex={-1}>
      {project ? <>
        {project.simulation && <ScenarioControls snapshot={snapshot} scenario={scenario} setScenario={setScenario} advance={advance} />}
        <Suspense fallback={<p role="status">Loading {project.name}…</p>}>
          <Application snapshot={snapshot} scenario={scenario} setScenario={setScenario} />
          <ReplayAnchor enabled={project.id === 'infrapilot-ai'} />
        </Suspense>
      </> : slug ? <a className="cta-text" href="/lab">Open lab overview <span aria-hidden="true">↗</span></a> : (
        <Suspense fallback={<p role="status">Loading lab tools…</p>}><LabOverview scenario={scenario} /></Suspense>
      )}
      <footer className="lab-footer"><a href={GITHUB}>Parag Jindal</a><a href={REPOSITORY}>Portfolio source <span aria-hidden="true">↗</span></a></footer>
    </main>
  </div>;
}
