import { useEffect, useRef, useState } from 'react';
import { Comparison, Metrics, Queue, Resources, Timeline } from './Panels.jsx';
import { format } from './format.mjs';
import LabMasthead from './design/LabMasthead.jsx';
import './workbench.css';

const DEVICES_NOTE = 'Each multi-GPU job needs its requested devices on the same node.';

function devices(cluster) {
  return cluster.nodes.flatMap((node) => node.gpus.map((gpu) => ({ ...gpu, nodeId: node.id })));
}

function requestFor(settings, policies, generateWorkloads) {
  const dispatch = policies.find((item) => item.id === settings.policyId);
  const { cluster, seed, count, trainingShare, fail, failureDevice, failureAt, failureDuration, allocation } = settings;
  return {
    cluster,
    jobs: generateWorkloads({ seed, count, trainingShare: trainingShare / 100 }),
    failures: fail ? [{ gpuId: failureDevice, at: failureAt, duration: failureDuration }] : [],
    policy: dispatch.policy,
    backfill: dispatch.backfill,
    allocation,
  };
}

function firstFrame(result) {
  return result.series.reduce((best, frame, index, list) => (
    frame.queueDepth > list[best].queueDepth || (frame.queueDepth === list[best].queueDepth && frame.busyGpus > list[best].busyGpus)
      ? index : best
  ), 0);
}

function initialSettings(presets, policies) {
  const cluster = presets[0];
  const failureDevice = devices(cluster)[0].id;
  return {
    cluster,
    policyId: policies[0].id,
    allocation: 'best-fit',
    seed: 42,
    count: 32,
    trainingShare: 58,
    fail: true,
    failureDevice,
    failureAt: 18,
    failureDuration: 12,
  };
}

function NumberField({ id, title, value, onChange, min, max, step = 1, unit }) {
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{title}</span>
      <span className="field-input">
        <input id={id} aria-labelledby={`${id}-label`} aria-describedby={unit ? `${id}-unit` : undefined} type="number" min={min} max={max} step={step} value={value} required onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />
        {unit && <span id={`${id}-unit`} aria-hidden="true">{unit}</span>}
      </span>
    </label>
  );
}

function Controls({ settings, update, presets, policies, onRun, onReset, dirty }) {
  const [editDevice, setEditDevice] = useState(() => devices(settings.cluster)[0].id);
  const { cluster } = settings;
  const inventory = devices(cluster);
  const device = inventory.find(({ id }) => id === editDevice) ?? inventory[0];
  const selectedPolicy = policies.find(({ id }) => id === settings.policyId);
  const field = (key) => (value) => update({ [key]: value });
  const onCluster = (id) => {
    const selected = presets.find((preset) => preset.id === id);
    const firstDevice = devices(selected)[0].id;
    setEditDevice(firstDevice);
    update({ cluster: selected, failureDevice: firstDevice });
  };
  const updateDevice = (key) => (value) => {
    const nodes = cluster.nodes.map((node) => ({
      ...node,
      gpus: node.gpus.map((gpu) => gpu.id === device.id ? { ...gpu, [key]: value } : gpu),
    }));
    update({ cluster: { ...cluster, nodes } });
  };

  return (
    <aside className="settings" aria-label="Simulation configuration">
      <form id="scenario-settings" onSubmit={onRun}>
        <div className="settings-title">
          <h2>Scenario</h2>
          <button type="button" className="text-button" onClick={onReset}>Reset</button>
        </div>
        <fieldset>
          <legend>Cluster</legend>
          <label className="field" htmlFor="cluster">
            <span>Cluster preset</span>
            <select id="cluster" value={cluster.id} onChange={(event) => onCluster(event.target.value)}>
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <p className="field-note">{cluster.nodes.length} {cluster.nodes.length === 1 ? 'node' : 'nodes'} · {inventory.length} GPUs · {inventory.reduce((sum, gpu) => sum + Number(gpu.memoryGiB), 0)} GiB total</p>
          <NumberField id="power-cap" title="Cluster power cap" value={cluster.powerCapWatts} onChange={(powerCapWatts) => update({ cluster: { ...cluster, powerCapWatts } })} min={1} max={100000} unit="W" />
          <details className="advanced">
            <summary>Edit GPU capacities</summary>
            <label className="field" htmlFor="edit-gpu">
              <span>GPU to edit</span>
              <select id="edit-gpu" value={device.id} onChange={(event) => setEditDevice(event.target.value)}>
                {inventory.map((gpu) => <option key={gpu.id} value={gpu.id}>{gpu.id} · {gpu.memoryGiB} GiB</option>)}
              </select>
            </label>
            <div className="field-pair">
              <NumberField id="gpu-memory" title="Memory" value={device.memoryGiB} onChange={updateDevice('memoryGiB')} min={1} max={512} unit="GiB" />
              <NumberField id="gpu-compute" title="Compute" value={device.compute} onChange={updateDevice('compute')} min={0.01} max={10000} step={0.01} unit="×" />
            </div>
            <div className="field-pair">
              <NumberField id="gpu-idle" title="Idle draw" value={device.idleWatts} onChange={updateDevice('idleWatts')} min={0} max={10000} unit="W" />
              <NumberField id="gpu-active" title="Active draw" value={device.activeWatts} onChange={updateDevice('activeWatts')} min={device.idleWatts} max={10000} unit="W" />
            </div>
            <p className="field-note">{DEVICES_NOTE}</p>
          </details>
        </fieldset>
        <fieldset>
          <legend>Workload</legend>
          <div className="field-pair">
            <NumberField id="seed" title="Seed" value={settings.seed} onChange={field('seed')} min={0} max={4294967295} />
            <NumberField id="jobs" title="Jobs" value={settings.count} onChange={field('count')} min={1} max={120} />
          </div>
          <label className="range-field" htmlFor="training-mix">
            <span>Training share <output htmlFor="training-mix">{settings.trainingShare}%</output></span>
            <input type="range" id="training-mix" min="0" max="100" step="1" value={settings.trainingShare} onChange={(event) => field('trainingShare')(Number(event.target.value))} />
          </label>
          <p className="field-note">The remaining jobs use the inference profile.</p>
        </fieldset>
        <fieldset>
          <legend>Scheduling</legend>
          <label className="field" htmlFor="dispatch-rule">
            <span>Dispatch policy</span>
            <select id="dispatch-rule" value={settings.policyId} onChange={(event) => field('policyId')(event.target.value)}>
              {policies.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          {selectedPolicy.backfill && <p className="field-note">Later jobs may run when the head job keeps its reserved start.</p>}
          <label className="field" htmlFor="allocation-rule">
            <span>Placement</span>
            <select id="allocation-rule" value={settings.allocation} onChange={(event) => field('allocation')(event.target.value)}>
              <option value="best-fit">Best fit</option>
              <option value="first-fit">First fit</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>GPU failure</legend>
          <label className="check-field">
            <input type="checkbox" checked={settings.fail} onChange={(event) => field('fail')(event.target.checked)} />
            <span>Simulate an outage</span>
          </label>
          {settings.fail && <>
            <label className="field" htmlFor="outage-device">
              <span>Device</span>
              <select id="outage-device" value={settings.failureDevice} onChange={(event) => field('failureDevice')(event.target.value)}>
                {inventory.map((gpu) => <option key={gpu.id} value={gpu.id}>{gpu.id}</option>)}
              </select>
            </label>
            <div className="field-pair">
              <NumberField id="outage-at" title="Starts at" value={settings.failureAt} onChange={field('failureAt')} min={0} max={1500} unit="min" />
              <NumberField id="outage-duration" title="Duration" value={settings.failureDuration} onChange={field('failureDuration')} min={1} max={1500} unit="min" />
            </div>
          </>}
        </fieldset>
        {dirty && <p className="field-note settings-dirty" role="status">Scenario settings changed. Run to apply them.</p>}
      </form>
    </aside>
  );
}

export default function App({ presets, policies, generateWorkloads, simulate, comparePolicies, recommend }) {
  const [settings, setSettings] = useState(() => initialSettings(presets, policies));
  const [run, setRun] = useState(() => {
    const input = requestFor(settings, policies, generateWorkloads);
    return { input, result: simulate(input), settings };
  });
  const [frameIndex, setFrameIndex] = useState(() => firstFrame(run.result));
  const [jobId, setJobId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [recommendationEnabled, setRecommendationEnabled] = useState(false);
  const [error, setError] = useState('');
  const resultsRef = useRef(null);
  const { result, input } = run;
  const dirty = settings !== run.settings;
  const policy = policies.find(({ id }) => id === run.settings.policyId);
  const frame = result.series[frameIndex] ?? result.series[0];
  const recommendation = recommendationEnabled && comparison && recommend ? recommend(comparison) : null;

  useEffect(() => {
    const limit = result.series.length - 1;
    if (!playing || frameIndex >= limit) return;
    const timeout = window.setTimeout(() => {
      setFrameIndex(frameIndex + 1);
      if (frameIndex + 1 === limit) setPlaying(false);
    }, 360);
    return () => window.clearTimeout(timeout);
  }, [frameIndex, playing, result.series.length]);

  function showRun(next, knownResult) {
    try {
      const input = requestFor(next, policies, generateWorkloads);
      const result = knownResult ?? simulate(input);
      setRun({ input, result, settings: next });
      setFrameIndex(firstFrame(result));
      setJobId(null);
      setPlaying(false);
      setError('');
      return true;
    } catch (failure) {
      setError(failure.message || 'This scenario could not be simulated.');
      return false;
    }
  }

  function runSettings(event) {
    event.preventDefault();
    if (!showRun(settings)) return;
    setComparison(null);
    if (window.matchMedia('(max-width: 650px)').matches) {
      window.requestAnimationFrame(() => resultsRef.current?.focus());
    }
  }

  function resetSettings() {
    const next = initialSettings(presets, policies);
    setSettings(next);
    showRun(next);
    setComparison(null);
  }

  function compare() {
    try {
      const tested = policies.map((item) => ({ ...item, allocation: run.settings.allocation }));
      setComparison(comparePolicies(input, tested));
      setError('');
    } catch (failure) {
      setError(failure.message || 'This workload could not be compared.');
    }
  }

  function viewCompared(policyId, selected) {
    const next = { ...run.settings, policyId };
    setSettings(next);
    showRun(next, selected);
  }

  function seek(next) {
    setPlaying(false);
    setFrameIndex(next);
  }

  function selectQueued(id) {
    setJobId(id);
    window.requestAnimationFrame(() => document.getElementById('job-details')?.focus());
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
    } else {
      if (frameIndex >= result.series.length - 1) setFrameIndex(0);
      setPlaying(result.series.length > 1);
    }
  }

  return (
    <>
      <LabMasthead title="ComputeFlow" index="10" category="Scheduling" description="Compare GPU scheduling policies on the same workload and replay each queue decision." source="https://github.com/Paragjindal01/compute-flow" status="Live demo · Synthetic data" />
      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="#main"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>ComputeFlow</a>
          <nav aria-label="Workbench navigation">
            <a href="#workload-timeline">Timeline</a>
            <a href="#policy-comparison">Policies</a>
          </nav>
          <span className="environment"><span aria-hidden="true" />Simulation</span>
        </div>
      </header>
      <main id="main" className="layout">
        <section className="intro" aria-labelledby="main-title">
          <div>
            <h1 id="main-title">GPU scheduling workbench</h1>
            <p>Run fictional clusters under pressure and compare scheduling decisions on the same workload.</p>
          </div>
          <div className="intro-actions">
            <button className="button run-compare" type="button" onClick={() => { compare(); document.getElementById('policy-comparison')?.scrollIntoView({ block: 'start' }); }}>
              Compare policies <span aria-hidden="true">↘</span>
            </button>
            <button type="submit" form="scenario-settings" className="button button-primary">Run simulation <span aria-hidden="true">↗</span></button>
          </div>
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="workspace">
          <Controls settings={settings} update={(patch) => setSettings((value) => ({ ...value, ...patch }))} presets={presets} policies={policies} onRun={runSettings} onReset={resetSettings} dirty={dirty} />
          <div className="results">
            <div className="run-summary" ref={resultsRef} tabIndex={-1} aria-label="Latest simulation" aria-live="polite">
              <div><span className="live-dot" aria-hidden="true" /><strong>{input.cluster.name}</strong><span className="run-divider" aria-hidden="true" /><span>{policy.label}</span></div>
              <span>{input.jobs.length} jobs · seed {run.settings.seed} · {format(result.horizon, 1)} min</span>
            </div>
            <Metrics result={result} />
            <Timeline result={result} frame={frame} frameIndex={frameIndex} playing={playing} onPlay={togglePlayback} onSeek={seek} selected={jobId} onSelect={setJobId} />
            <div className="operational-grid">
              <Resources result={result} frame={frame} cluster={input.cluster} />
              <Queue result={result} frame={frame} selected={jobId} onSelect={selectQueued} />
            </div>
            <Comparison results={comparison} currentPolicy={run.settings.policyId} onCompare={compare} onChoose={viewCompared} dirty={dirty} recommendation={recommendation} recommendationEnabled={recommendationEnabled} toggleRecommendation={() => setRecommendationEnabled((enabled) => !enabled)} recommendAvailable={Boolean(recommend)} />
          </div>
        </div>
        <footer className="site-footer"><span>ComputeFlow</span><span>Fictional accelerator inventory · time measured in simulated minutes</span></footer>
      </main>
    </>
  );
}
