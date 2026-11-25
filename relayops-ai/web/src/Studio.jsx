import { useRef, useState } from 'react';
import { nodeDefaults, nodeKinds, operations, roles, validateWorkflow } from '../../core/contracts.mjs';
import { templates } from '../../core/index.mjs';
import { client, downloadJson } from './client.mjs';
import { parseObject, pretty, titleWords, typeWords } from './format.mjs';
import Icon from './Icon.jsx';

const NODE_WIDTH = 172;
const NODE_HEIGHT = 68;
const COLUMN = 214;
const ROW = 108;
const PAD = 26;
const INITIAL_LAYOUTS = {
  'github-review': [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1]],
  'research-pipeline': [[0, 1], [1, 0], [1, 2], [2, 1], [2, 2], [1, 3]],
  'data-analyst': [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1]],
  'incident-investigator': [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [2, 2], [2, 3], [0, 2]],
};

export function startTemplate(template) {
  const copy = structuredClone(template);
  if (!INITIAL_LAYOUTS[copy.id]) return copy;
  copy.nodes.forEach((node, index) => {
    const location = INITIAL_LAYOUTS[copy.id][index];
    if (location) {
      node.x = PAD + location[0] * COLUMN;
      node.y = PAD + location[1] * ROW;
    }
  });
  return copy;
}

function point(node, index = 0) {
  return {
    x: Number.isFinite(node.x) ? node.x : PAD + (index % 3) * COLUMN,
    y: Number.isFinite(node.y) ? node.y : PAD + Math.floor(index / 3) * ROW,
  };
}

function edgeLine(source, target) {
  if (Math.abs(target.x - source.x) >= Math.abs(target.y - source.y) * 0.9) {
    const forward = target.x >= source.x;
    const a = { x: source.x + (forward ? NODE_WIDTH : 0), y: source.y + NODE_HEIGHT / 2 };
    const b = { x: target.x + (forward ? 0 : NODE_WIDTH), y: target.y + NODE_HEIGHT / 2 };
    const handle = Math.max(15, Math.abs(b.x - a.x) * .5) * (forward ? 1 : -1);
    return { drawing: `M ${a.x} ${a.y} C ${a.x + handle} ${a.y} ${b.x - handle} ${b.y} ${b.x} ${b.y}`, midpoint: [(a.x + b.x) / 2, (a.y + b.y) / 2 - 6] };
  }
  const forward = target.y >= source.y;
  const a = { x: source.x + NODE_WIDTH / 2, y: source.y + (forward ? NODE_HEIGHT : 0) };
  const b = { x: target.x + NODE_WIDTH / 2, y: target.y + (forward ? 0 : NODE_HEIGHT) };
  const handle = Math.max(15, Math.abs(b.y - a.y) * .45) * (forward ? 1 : -1);
  return { drawing: `M ${a.x} ${a.y} C ${a.x} ${a.y + handle} ${b.x} ${b.y - handle} ${b.x} ${b.y}`, midpoint: [(a.x + b.x) / 2 + 7, (a.y + b.y) / 2 - 4] };
}

function Graph({ workflow, active, onSelect, onMove, onAdd }) {
  const [zoom, setZoom] = useState(1);
  const view = useRef(null);
  const drag = useRef(null);
  const positions = new Map(workflow.nodes.map((node, index) => [node.id, point(node, index)]));
  const width = Math.max(630, ...[...positions.values()].map(({ x }) => x + NODE_WIDTH + PAD));
  const height = Math.max(420, ...[...positions.values()].map(({ y }) => y + NODE_HEIGHT + PAD));

  function start(event, node) {
    if (event.button !== 0) return;
    const pos = positions.get(node.id);
    drag.current = { id: node.id, pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...pos };
    onSelect(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (drag.current?.pointer !== event.pointerId) return;
    const { id, clientX, clientY, x, y } = drag.current;
    onMove(id, x + (event.clientX - clientX) / zoom, y + (event.clientY - clientY) / zoom);
  }
  function release(event) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }
  function keyboard(event, node) {
    const shift = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!shift) return;
    event.preventDefault();
    const pos = positions.get(node.id);
    const speed = event.shiftKey ? 24 : 8;
    onMove(node.id, pos.x + shift[0] * speed, pos.y + shift[1] * speed);
  }
  function drop(event) {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/relayops-node');
    if (!nodeKinds.includes(type)) return;
    const rect = view.current.getBoundingClientRect();
    onAdd(type, { x: (event.clientX - rect.left + view.current.scrollLeft) / zoom - NODE_WIDTH / 2, y: (event.clientY - rect.top + view.current.scrollTop) / zoom - NODE_HEIGHT / 2 });
  }
  function fit() {
    const next = Math.min(1, Math.max(.45, (view.current.clientWidth - 12) / width));
    setZoom(next);
    view.current.scrollTo(0, 0);
  }

  return <>
    <div className="canvas-head"><div><strong>Workflow graph</strong><span>{workflow.nodes.length} nodes · {workflow.edges.length} connections</span></div><div className="zoom-tools" aria-label="Canvas zoom"><button type="button" className="icon-button" aria-label="Zoom out" onClick={() => setZoom(Math.max(.4, zoom - .1))}><Icon name="minus" size={15} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" className="icon-button" aria-label="Zoom in" onClick={() => setZoom(Math.min(1.6, zoom + .1))}><Icon name="plus" size={15} /></button><button type="button" className="small-button" onClick={fit}>Fit</button></div></div>
    <div className="canvas-scroll" ref={view} tabIndex={0} aria-label="Workflow canvas. Select a node or move it using the arrow keys." onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={drop}>
      <div className="canvas-size" style={{ width: width * zoom, height: height * zoom }}>
        <div className="canvas-graph" style={{ width, height, transform: `scale(${zoom})` }}>
          <svg className="canvas-connections" width={width} height={height} aria-hidden="true">
            <defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" stroke="currentColor" strokeWidth="1.5" fill="none" /></marker></defs>
            {workflow.edges.map((edge, index) => {
              const source = positions.get(edge.source);
              const target = positions.get(edge.target);
              if (!source || !target) return null;
              const line = edgeLine(source, target);
              return <g key={`${edge.source}-${edge.target}-${index}`}>
                <path d={line.drawing} className={edge.when == null ? 'graph-edge' : 'graph-edge graph-edge-branch'} markerEnd="url(#edge-arrow)" />
                {edge.when != null && <text x={line.midpoint[0]} y={line.midpoint[1]}>{String(edge.when)}</text>}
              </g>;
            })}
          </svg>
          {workflow.nodes.map((node) => {
            const pos = positions.get(node.id);
            return <button key={node.id} type="button" className="graph-node" data-type={node.type} aria-label={`Select ${node.label} node`} aria-pressed={node.id === active} style={{ left: pos.x, top: pos.y, width: NODE_WIDTH }} onPointerDown={(event) => start(event, node)} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onKeyDown={(event) => keyboard(event, node)} onClick={() => onSelect(node.id)}>
              <span className="node-icon"><Icon name={node.type} size={16} /></span><span><small>{typeWords[node.type]}</small><strong>{node.label}</strong></span>
            </button>;
          })}
        </div>
      </div>
    </div>
  </>;
}

function Inspector({ node, workflow, onChange, onDelete, saveId }) {
  const [raw, setRaw] = useState(pretty(node.config));
  const [error, setError] = useState('');
  const config = node.config;
  function replaceConfig(value) {
    onChange({ ...node, config: value });
    setRaw(pretty(value));
    setError('');
  }
  function apply() {
    try { replaceConfig(parseObject(raw, 'Node configuration')); }
    catch (issue) { setError(issue.message); }
  }
  return <aside className="studio-inspector" aria-label="Node inspector">
    <div className="panel-heading"><span className="node-icon" data-type={node.type}><Icon name={node.type} /></span><div><span className="eyebrow">Node inspector</span><h2>{typeWords[node.type]}</h2></div></div>
    <div className="inspector-body">
      <label>Node label<input value={node.label} maxLength={100} onChange={(event) => onChange({ ...node, label: event.target.value })} /></label>
      <label>Operation<select value={config.operation} onChange={(event) => replaceConfig({ ...config, operation: event.target.value })}>{operations[node.type].map((operation) => <option key={operation} value={operation}>{titleWords(operation)}</option>)}</select></label>
      {node.type === 'agent' && <label>Agent role<select value={config.role} onChange={(event) => replaceConfig({ ...config, role: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{titleWords(role)}</option>)}</select></label>}
      {node.type !== 'trigger' && <label>Source step<select value={config.source || ''} onChange={(event) => { const { source: removed, ...rest } = config; void removed; replaceConfig(event.target.value ? { ...rest, source: event.target.value } : rest); }}><option value="">Automatic</option>{workflow.nodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      <label><span>Node ID</span><input readOnly value={node.id} className="code-input" /></label>
      <details className="detail-line"><summary>Advanced JSON configuration</summary><label className="sr-only" htmlFor={`configuration-${saveId}`}>Configuration JSON</label><textarea id={`configuration-${saveId}`} className="code-input" rows={5} spellCheck={false} value={raw} onChange={(event) => setRaw(event.target.value)} /><button type="button" className="small-button" onClick={apply}>Apply configuration</button>{error && <p className="error-text" role="alert">{error}</p>}</details>
      {node.type !== 'trigger' && <label className="checkbox-line"><input type="checkbox" checked={workflow.outputs?.includes(node.id) || false} onChange={(event) => onChange({ ...node }, event.target.checked)} /> Include in workflow outputs</label>}
      <button type="button" className="subtle-danger small-button" disabled={node.type === 'trigger'} onClick={onDelete}>Remove node</button>
    </div>
  </aside>;
}

function Connections({ workflow, update }) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [when, setWhen] = useState('true');
  const node = workflow.nodes.find((item) => item.id === source);
  const picks = workflow.nodes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>);
  function connect(event) {
    event.preventDefault();
    if (!node || source === target || !workflow.nodes.some((item) => item.id === target)) return;
    if (workflow.edges.some((edge) => edge.source === source && edge.target === target)) return;
    update({ ...workflow, edges: [...workflow.edges, { source, target, ...(node.type === 'condition' ? { when } : {}) }] });
    setTarget('');
  }
  return <details className="studio-details"><summary><Icon name="studio" size={17} /> Connections <span>{workflow.edges.length}</span></summary>
    <form className="connection-form" onSubmit={connect}>
      <label>From node<select value={source} onChange={(event) => setSource(event.target.value)} required><option value="">Choose source</option>{picks}</select></label>
      <label>To node<select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Choose destination</option>{workflow.nodes.filter((item) => item.type !== 'trigger' && item.id !== source).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {node?.type === 'condition' && <label>Branch<select value={when} onChange={(event) => setWhen(event.target.value)}><option value="true">True</option><option value="false">False</option></select></label>}
      <button className="button secondary" type="submit" disabled={!source || !target}>Add connection</button>
    </form>
    <ul className="edge-list">{workflow.edges.map((edge, index) => <li key={`${edge.source}-${edge.target}-${index}`}><span>{edge.source} → {edge.target} {edge.when == null ? '' : `· ${edge.when}`}</span><button type="button" className="icon-button" aria-label={`Remove connection ${edge.source} to ${edge.target}`} onClick={() => update({ ...workflow, edges: workflow.edges.filter((_, edgeIndex) => edgeIndex !== index) })}><Icon name="close" size={15} /></button></li>)}</ul>
  </details>;
}

export default function Studio({ workflow, setWorkflow, onRun, versions, savedWorkflows, refreshVersions, sampleInput, setSampleInput, health }) {
  const [active, setActive] = useState(workflow.nodes[0]?.id);
  const [palette, setPalette] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [provider, setProvider] = useState('offline');
  const inputRef = useRef(null);
  const selected = workflow.nodes.find((node) => node.id === active) || workflow.nodes[0];
  const statusCount = versions.length;
  const configuredProviders = (health?.providers || []).map((item) => typeof item === 'string' ? item : item.provider || item.id || item.name).filter((item) => item && item !== 'offline');

  function update(next) { setWorkflow(next); setErrors([]); setStatus(''); }
  function move(id, x, y) {
    setWorkflow((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, x: Math.max(12, Math.min(2500, Math.round(x))), y: Math.max(12, Math.min(2000, Math.round(y))) } : node) }));
  }
  function add(type, position) {
    if (workflow.nodes.length >= 32) { setErrors(['A workflow supports up to 32 nodes.']); return; }
    if (type === 'trigger' && workflow.nodes.some((node) => node.type === type)) { setErrors(['The workflow already has its trigger.']); return; }
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    const pos = point(position || {}, workflow.nodes.length);
    const node = { id, type, ...nodeDefaults(type), x: Math.max(12, Math.round(pos.x)), y: Math.max(12, Math.round(pos.y)) };
    update({ ...workflow, nodes: [...workflow.nodes, node] });
    setActive(id);
    setPalette(false);
  }
  function choose(next, text) {
    update(next);
    setActive(next.nodes[0]?.id);
    setSampleInput(pretty(next.inputs || {}));
    setRevision((value) => value + 1);
    if (text) setStatus(text);
  }
  function chooseTemplate(id) {
    if (id === '__new') {
      choose({ id: `workflow-${crypto.randomUUID().slice(0, 8)}`, name: 'Untitled workflow', nodes: [{ id: 'receive', type: 'trigger', ...nodeDefaults('trigger'), x: PAD, y: PAD }], edges: [], inputs: {}, outputs: [] });
      return;
    }
    const template = templates.find((item) => item.id === id);
    if (template) choose(startTemplate(template));
  }
  function valid(input) {
    const value = validateWorkflow(input);
    setErrors(value.errors);
    if (!value.ok) throw Error(value.errors[0]);
    return input;
  }
  async function run(event) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      if (sampleInput.length > 65536) throw Error('Execution inputs exceed the 64 KiB limit.');
      const input = parseObject(sampleInput, 'Execution input');
      const definition = valid({ ...workflow, inputs: input });
      const matching = versions.find((item) => pretty(item.workflow) === pretty(definition));
      const launched = await client.launch({ ...(matching ? { workflowId: definition.id, version: matching.version } : { workflow: definition }), input, mode: provider === 'offline' ? 'offline' : 'connected', provider });
      onRun(launched);
    } catch (error) { setErrors((list) => list.length ? list : [error.message]); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const next = valid({ ...workflow, inputs: parseObject(sampleInput, 'Workflow inputs') });
      const saved = await client.save(next);
      setWorkflow(next);
      await refreshVersions(next.id);
      setStatus(`Version ${saved.version} saved.`);
    } catch (error) { setErrors((list) => list.length ? list : [error.message]); }
    finally { setBusy(false); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 128 * 1024) throw Error('Workflow imports are limited to 128 KiB.');
      const next = valid(parseObject(await file.text(), 'Workflow definition'));
      choose(next, `Loaded ${file.name}.`);
    } catch (error) { setErrors((list) => list.length ? list : [error.message]); }
  }

  return <>
    <div className="title-row"><div><h1>Workflow Studio</h1><p className="screen-description">Build a graph, configure each step, and trace its execution.</p></div><button type="button" className="button primary" onClick={() => { setShowRun(true); setTimeout(() => inputRef.current?.focus(), 0); }}><Icon name="play" size={16} /> Run workflow</button></div>
    <div className="studio-toolbar">
      <div className="studio-identity"><span className="node-icon"><Icon name="studio" /></span><div><label className="sr-only" htmlFor="workflow-name">Workflow name</label><input id="workflow-name" className="name-input" value={workflow.name} maxLength={100} onChange={(event) => update({ ...workflow, name: event.target.value })} /><small>{workflow.id} · {statusCount ? `${statusCount} saved ${statusCount === 1 ? 'version' : 'versions'}` : 'Draft'}</small></div></div>
      <div className="toolbar-actions"><label className="sr-only" htmlFor="template-select">Workflow template</label><select id="template-select" value={templates.some((item) => item.id === workflow.id) ? workflow.id : ''} onChange={(event) => chooseTemplate(event.target.value)}><option value="" disabled>Choose template</option><option value="__new">New blank workflow</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button type="button" className="button secondary" disabled={busy} onClick={save}>Save version</button><button type="button" className="button secondary" onClick={() => downloadJson(`${workflow.id || 'workflow'}.json`, workflow)}><Icon name="download" size={15} /> Export</button><label className="button secondary import-button">Import JSON<input type="file" accept=".json,application/json" onChange={importFile} /></label></div>
    </div>
    {status && <p className="notice success" role="status">{status}</p>}
    {errors.length > 0 && <div className="notice failure" role="alert"><strong>Workflow needs attention</strong><ul>{errors.slice(0, 8).map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
    <div className="studio-grid">
      <section className="studio-board" aria-label="Graph editor">
        <Graph workflow={workflow} active={selected?.id} onSelect={setActive} onMove={move} onAdd={add} />
        <div className="canvas-footer"><button type="button" className="small-button" aria-expanded={palette} onClick={() => setPalette(!palette)}><Icon name="plus" size={16} /> Add node</button><p>Drag to move. Arrow keys work on focused nodes.</p></div>
        {palette && <div className="node-palette" aria-label="Node types">{nodeKinds.map((type) => <button key={type} type="button" className="small-button" draggable onDragStart={(event) => { event.dataTransfer.setData('application/relayops-node', type); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => add(type)}><Icon name={type} size={15} /> {typeWords[type]}</button>)}</div>}
      </section>
      {selected && <Inspector node={selected} workflow={workflow} saveId={revision} key={`${selected.id}-${revision}`} onChange={(node, output) => update({ ...workflow, nodes: workflow.nodes.map((item) => item.id === node.id ? node : item), ...(output === undefined ? {} : { outputs: output ? [...(workflow.outputs || []), node.id] : workflow.outputs.filter((item) => item !== node.id) }) })} onDelete={() => update({ ...workflow, nodes: workflow.nodes.filter((item) => item.id !== selected.id), edges: workflow.edges.filter((edge) => edge.source !== selected.id && edge.target !== selected.id), outputs: workflow.outputs?.filter((item) => item !== selected.id) })} />}
    </div>
    <Connections key={revision} workflow={workflow} update={update} />
    <details className="studio-details" open={showRun} onToggle={(event) => setShowRun(event.currentTarget.open)}>
      <summary><Icon name="code" size={17} /> Workflow inputs <span>JSON</span></summary>
      <form className="run-form" onSubmit={run}><label>Execution input JSON<textarea ref={inputRef} className="code-input" rows={8} spellCheck={false} value={sampleInput} onChange={(event) => setSampleInput(event.target.value)} /></label>
        {health?.connected && <label>Execution provider<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="offline">Deterministic offline</option><option value="auto">Connected and auto-routed</option>{configuredProviders.filter((item) => item !== 'auto').map((item) => <option key={item} value={item}>{titleWords(item)}</option>)}</select></label>}
        <button type="submit" className="button primary" disabled={busy}><Icon name="play" size={16} /> Start execution</button>
      </form>
    </details>
    <details className="studio-details"><summary><Icon name="clock" size={17} /> Versions <span>{versions.length}</span></summary><div className="version-list">{savedWorkflows.length > 0 && <label>Load saved workflow<select value="" onChange={(event) => { const selectedWorkflow = savedWorkflows.find((item) => item.workflow.id === event.target.value); if (selectedWorkflow) choose(selectedWorkflow.workflow, `Loaded ${selectedWorkflow.workflow.name} version ${selectedWorkflow.version}.`); }}><option value="">Choose a saved workflow</option>{savedWorkflows.map((item) => <option key={item.workflow.id} value={item.workflow.id}>{item.workflow.name} · version {item.version}</option>)}</select></label>}{versions.length ? versions.map((item) => <div key={item.version}><span>Version {item.version} · {item.workflow.nodes.length} nodes</span><button type="button" className="small-button" onClick={() => choose(item.workflow, `Loaded version ${item.version} into the editor.`)}>Load version {item.version}</button></div>) : <p>Save the workflow to keep a versioned definition.</p>}</div></details>
  </>;
}
