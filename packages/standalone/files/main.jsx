import { createRoot } from 'react-dom/client';
import { StrictMode, useMemo, useState } from 'react';
import { createSnapshot, SCENARIOS } from './lab/simulator.mjs';
import { apps, primary } from './project.mjs';
import './standalone.css';
import './engineering.css';

const lab = 'https://paragjindal.com/lab';
const route = /^\/lab\/([a-z-]+)\/?$/.exec(window.location.pathname)?.[1];
const project = apps.find(({ id }) => id === route) ?? primary;
const Application = project.Application;

function setParameter(key, value) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, String(value));
  window.history.replaceState(null, '', url);
}

export default function Standalone() {
  const [scenario, updateScenario] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('scenario');
    return SCENARIOS.includes(value) ? value : 'normal';
  });
  const [step, setStep] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get('step'));
    return Number.isInteger(value) && value >= 0 && value < 96 ? value : 0;
  });
  const snapshot = useMemo(() => createSnapshot({ scenario, step }), [scenario, step]);

  function setScenario(value) {
    if (!SCENARIOS.includes(value)) return;
    setParameter('scenario', value === 'normal' ? null : value);
    updateScenario(value);
  }

  function advance() {
    const next = (step + 1) % 96;
    setParameter('step', next === 0 ? null : next);
    setStep(next);
  }

  return (
    <div className="lab-shell standalone-shell">
      <a className="skip-link" href="#lab-main">Skip to application</a>
      <header className="lab-header">
        <a className="lab-brand" href="/">{primary.name}</a>
        <div><a href={lab + '/' + primary.id}>Online demo</a><a href={lab}>Engineering Lab</a></div>
      </header>
      <main className="lab-main standalone-main" id="lab-main" tabIndex={-1}>
        <div className="lab-heading">
          <span className="eyebrow">{project.area}</span>
          <h1>{project.name}</h1>
          <p>{project.description}</p>
        </div>
        {project.simulation && (
          <div className="lab-scenario">
            <div><strong><span className="status-dot" /> Simulated telemetry</strong><small>{snapshot.facilities[0].name} · step {snapshot.step}</small></div>
            <div className="lab-controls">
              <label>Scenario<select value={scenario} onChange={(event) => setScenario(event.target.value)}>{SCENARIOS.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
              <button type="button" onClick={advance}>Advance 15 min</button>
            </div>
          </div>
        )}
        <Application snapshot={snapshot} scenario={scenario} setScenario={setScenario} />
      </main>
    </div>
  );
}

const root = document.getElementById('root');
createRoot(root).render(<StrictMode><Standalone /></StrictMode>);
