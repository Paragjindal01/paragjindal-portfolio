import { useMemo, useRef, useState } from 'react'
import { analyzeCableOutage, DEVICE_TYPES, FABRICS, GRAPH_HEIGHT, GRAPH_WIDTH, exampleTopology, fabricDesignReport, inspectTopology, parseTopology } from './fabric.mjs'
import './visual-tools.css'

const typeLabels = { firewall: 'Firewall', switch: 'Switch', server: 'Server', storage: 'Storage' }
const typeSymbols = { firewall: 'FW', switch: 'SW', server: 'SV', storage: 'ST' }
const coordinate = (value, min, max) => Math.max(min, Math.min(max, value))
const position = (x, y) => ({
  x: coordinate(Math.round(x), 60, GRAPH_WIDTH - 60),
  y: coordinate(Math.round(y), 43, GRAPH_HEIGHT - 43),
})
const linkDefault = devices => ({
  from: devices[0]?.id ?? '', to: devices[1]?.id ?? '', fromPort: '1', toPort: '1',
  speedGbps: '25', fabric: 'Ethernet', mode: 'none', vlanIds: '',
})
const nextId = (items, prefix) => {
  let suffix = items.length + 1
  while (items.some(item => item.id === `${prefix}-${suffix}`)) suffix += 1
  return `${prefix}-${suffix}`
}

function TopologyCanvas({ topology, selected, setSelected, onMove, onAdd, failedCable }) {
  const canvas = useRef(null)
  const drag = useRef(null)
  const points = new Map(topology.devices.map(item => [item.id, item]))
  function canvasPosition(event) {
    const bounds = canvas.current.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * GRAPH_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * GRAPH_HEIGHT / bounds.height,
    }
  }

  return <div className="fabric-canvas" ref={canvas}
    onDragOver={event => event.preventDefault()}
    onDrop={event => {
      event.preventDefault()
      const kind = event.dataTransfer.getData('application/x-fabriclab-device')
      if (DEVICE_TYPES.includes(kind)) onAdd(kind, canvasPosition(event))
    }}>
    <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {topology.links.map(cable => {
        const from = points.get(cable.from)
        const to = points.get(cable.to)
        return <line key={cable.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} opacity={failedCable === cable.id ? 0.23 : undefined}
          className={cable.fabric === 'InfiniBand' ? 'fabric-link-ib' : 'fabric-link-eth'} />
      })}
    </svg>
    {topology.devices.map(item => <button type="button" key={item.id}
      className={`fabric-device fabric-device-${item.kind}`} aria-pressed={item.id === selected}
      aria-label={`${item.label}, ${typeLabels[item.kind]}. Use arrow keys to move.`}
      style={{ left: `${item.x / GRAPH_WIDTH * 100}%`, top: `${item.y / GRAPH_HEIGHT * 100}%` }}
      onClick={() => setSelected(item.id)}
      onPointerDown={event => {
        if (event.button !== 0) return
        const point = canvasPosition(event)
        drag.current = { id: item.id, x: item.x - point.x, y: item.y - point.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (drag.current?.id !== item.id) return
        const point = canvasPosition(event)
        onMove(item.id, position(point.x + drag.current.x, point.y + drag.current.y))
      }}
      onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={event => {
        const offsets = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }
        if (!offsets[event.key]) return
        event.preventDefault()
        const [dx, dy] = offsets[event.key]
        onMove(item.id, position(item.x + dx, item.y + dy))
      }}>
      <span aria-hidden="true">{typeSymbols[item.kind]}</span>
      <strong>{item.label}</strong>
    </button>)}
  </div>
}

function LinkEditor({ devices, draft, setDraft, onSave, onCancel }) {
  const set = key => event => setDraft(current => ({ ...current, [key]: event.target.value }))
  return <form onSubmit={onSave}>
    <div className="visual-form-grid">
      <label>From device<select value={draft.from} onChange={set('from')} required>
        <option value="">Select</option>{devices.map(device => <option value={device.id} key={device.id}>{device.label}</option>)}
      </select></label>
      <label>From port<input required value={draft.fromPort} onChange={set('fromPort')} maxLength={60} /></label>
      <label>To device<select value={draft.to} onChange={set('to')} required>
        <option value="">Select</option>{devices.map(device => <option value={device.id} key={device.id}>{device.label}</option>)}
      </select></label>
      <label>To port<input required value={draft.toPort} onChange={set('toPort')} maxLength={60} /></label>
      <label>Link rate (Gbps)<input required type="number" min="0.1" max="1600" step="any" value={draft.speedGbps} onChange={set('speedGbps')} /></label>
      <label>Fabric<select value={draft.fabric} onChange={set('fabric')}>
        {FABRICS.map(fabric => <option key={fabric}>{fabric}</option>)}
      </select></label>
      <label>VLAN mode<select value={draft.mode} onChange={set('mode')}>
        <option value="none">None</option><option value="access">Access</option><option value="trunk">Trunk</option>
      </select></label>
      <label>VLAN IDs<input value={draft.vlanIds} onChange={set('vlanIds')} placeholder="110, 120" maxLength={500} /></label>
    </div>
    <div className="visual-actions"><button type="submit">Save cable</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>
}

export default function FabricLab() {
  const [topology, setTopology] = useState(exampleTopology)
  const [selected, setSelected] = useState('')
  const [cableDraft, setCableDraft] = useState(null)
  const [vlanDraft, setVlanDraft] = useState(null)
  const [error, setError] = useState('')
  const [failedCable, setFailedCable] = useState('')
  const report = useMemo(() => inspectTopology(topology), [topology])
  const activeFailure = topology.links.find(({ id }) => id === failedCable)?.id || ''
  const outage = useMemo(() => activeFailure ? analyzeCableOutage(topology, activeFailure, report) : null,
    [topology, activeFailure, report])
  const selectedNode = topology.devices.find(item => item.id === selected)
  const labels = new Map(topology.devices.map(item => [item.id, item.label]))

  function reset(next) {
    setTopology(next)
    setSelected('')
    setCableDraft(null)
    setVlanDraft(null)
    setError('')
    setFailedCable('')
  }

  function update(candidate) {
    try {
      setTopology(parseTopology(JSON.stringify(candidate)))
      setError('')
      return true
    } catch (exception) {
      setError(exception.message)
      return false
    }
  }

  function addDevice(kind, point) {
    const id = nextId(topology.devices, kind)
    const offset = (topology.devices.length % 4) * 48
    const placement = point ? position(point.x, point.y) : position(90 + offset, 48 + offset)
    const added = { id, kind, label: `${typeLabels[kind]} ${id.split('-').at(-1)}`, ...placement }
    if (update({ ...topology, devices: [...topology.devices, added] })) setSelected(id)
  }

  function moveDevice(id, next) {
    setTopology(current => ({
      ...current,
      devices: current.devices.map(item => item.id === id ? { ...item, ...next } : item),
    }))
  }

  async function importFile(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 131072) throw new Error('Choose a topology JSON file under 128 KB.')
      reset(parseTopology(await file.text()))
    } catch (exception) {
      setError(exception.message)
    }
  }

  function exportJson(filename, payload) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function saveCable(event) {
    event.preventDefault()
    const source = cableDraft.vlanIds.trim()
    if (source && !/^\d+(?:\s*,\s*\d+)*$/.test(source)) {
      setError('Enter one or more numeric VLAN IDs separated by commas.')
      return
    }

    const id = cableDraft.id ?? nextId(topology.links, 'cable')
    const cable = {
      ...cableDraft, id, fromPort: cableDraft.fromPort.trim(), toPort: cableDraft.toPort.trim(),
      speedGbps: Number(cableDraft.speedGbps), vlanIds: source ? source.split(',').map(Number) : [],
    }
    const links = cableDraft.id
      ? topology.links.map(item => item.id === id ? cable : item)
      : [...topology.links, cable]
    if (update({ ...topology, links })) setCableDraft(null)
  }

  function saveVlan(event) {
    event.preventDefault()
    const vlan = { id: Number(vlanDraft.id), label: vlanDraft.label.trim(), cidr: vlanDraft.cidr.trim() }
    const vlans = vlanDraft.index === undefined
      ? [...topology.vlans, vlan]
      : topology.vlans.map((item, index) => index === vlanDraft.index ? vlan : item)
    if (update({ ...topology, vlans })) setVlanDraft(null)
  }

  return <div className="visual-tool">
    <section className="lab-panel">
      <h3>Topology canvas</h3>
      <div className="visual-actions">
        {FABRICS.map(fabric => <button type="button" key={fabric} onClick={() => reset(exampleTopology(fabric))}>Load {fabric} example</button>)}
        <button type="button" onClick={() => reset({ version: 1, devices: [], links: [], vlans: [] })}>Blank topology</button>
        <button type="button" onClick={() => exportJson('fabriclab-topology.json', topology)}>Export topology JSON</button>
        <label className="fabric-file">Import topology JSON<input type="file" accept=".json,application/json" onChange={importFile} /></label>
      </div>
      {error && <p className="visual-error" role="alert">{error}</p>}
      <p>Drag device types onto the canvas or press a device type to add it. Move devices by dragging them or using arrow keys while focused.</p>
      <div className="visual-actions" aria-label="Device palette">
        {DEVICE_TYPES.map(kind => <button type="button" key={kind} draggable
          onDragStart={event => event.dataTransfer.setData('application/x-fabriclab-device', kind)}
          onClick={() => addDevice(kind)}>Add {typeLabels[kind].toLowerCase()}</button>)}
      </div>
      <TopologyCanvas topology={topology} selected={selected} setSelected={setSelected} onAdd={addDevice} onMove={moveDevice} />
      {selectedNode && <div className="visual-actions">
        <label>{typeLabels[selectedNode.kind]} label
          <input key={selectedNode.id} maxLength={60} defaultValue={selectedNode.label} onBlur={event => {
            const label = event.target.value.trim()
            if (label) update({ ...topology, devices: topology.devices.map(item => item.id === selected ? { ...item, label } : item) })
            else event.target.value = selectedNode.label
          }} />
        </label>
        <button type="button" onClick={() => {
          setTopology(current => ({
            ...current,
            devices: current.devices.filter(item => item.id !== selected),
            links: current.links.filter(item => item.from !== selected && item.to !== selected),
          }))
          setSelected('')
          setCableDraft(null)
        }}>Remove {selectedNode.label}</button>
      </div>}
    </section>
    <section className="lab-panel">
      <h3>Cables and port assignments</h3>
      <p>{topology.links.length} cables · {Number(report.bandwidthGbps.toFixed(2))} Gbps installed link capacity</p>
      {cableDraft
        ? <LinkEditor devices={topology.devices} draft={cableDraft} setDraft={setCableDraft} onSave={saveCable} onCancel={() => setCableDraft(null)} />
        : <button type="button" disabled={topology.devices.length < 2} onClick={() => setCableDraft(linkDefault(topology.devices))}>Add cable</button>}
      <div className="visual-table-wrap">
        <table className="lab-table">
          <thead><tr><th scope="col">Cable</th><th scope="col">From</th><th scope="col">To</th><th scope="col">Fabric / rate</th><th scope="col">VLANs</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            {topology.links.map(cable => <tr key={cable.id}>
              <th scope="row">{cable.id}</th>
              <td>{labels.get(cable.from)} · {cable.fromPort}</td><td>{labels.get(cable.to)} · {cable.toPort}</td>
              <td>{cable.fabric} · {cable.speedGbps} Gbps</td>
              <td>{cable.vlanIds.length ? `${cable.mode} ${cable.vlanIds.join(', ')}` : '—'}</td>
              <td><div className="visual-actions">
                <button type="button" aria-label={`Edit ${cable.id}`} onClick={() => setCableDraft({ ...cable, vlanIds: cable.vlanIds.join(', ') })}>Edit</button>
                <button type="button" aria-label={`Remove ${cable.id}`} onClick={() => {
                  setTopology(current => ({ ...current, links: current.links.filter(item => item.id !== cable.id) }))
                  if (cableDraft?.id === cable.id) setCableDraft(null)
                }}>Remove</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
    <div className="visual-split">
      <section className="lab-panel">
        <h3>VLAN segmentation</h3>
        {vlanDraft ? <form onSubmit={saveVlan}>
          <div className="visual-form-grid">
            <label>VLAN ID<input required type="number" min="1" max="4094" value={vlanDraft.id} onChange={event => setVlanDraft({ ...vlanDraft, id: event.target.value })} /></label>
            <label>Segment label<input required maxLength={60} value={vlanDraft.label} onChange={event => setVlanDraft({ ...vlanDraft, label: event.target.value })} /></label>
            <label>IPv4 subnet<input required maxLength={18} placeholder="203.0.113.0/24" value={vlanDraft.cidr} onChange={event => setVlanDraft({ ...vlanDraft, cidr: event.target.value })} /></label>
          </div>
          <div className="visual-actions"><button type="submit">Save VLAN</button><button type="button" onClick={() => setVlanDraft(null)}>Cancel</button></div>
        </form> : <button type="button" onClick={() => setVlanDraft({ id: '', label: '', cidr: '' })}>Add VLAN</button>}
        <div className="visual-table-wrap">
          <table className="lab-table"><thead><tr><th scope="col">VLAN</th><th scope="col">Segment</th><th scope="col">Subnet</th><th scope="col">Actions</th></tr></thead>
            <tbody>{topology.vlans.map((vlan, index) => <tr key={`${vlan.id}-${index}`}>
              <th scope="row">{vlan.id}</th><td>{vlan.label}</td><td>{vlan.cidr}</td><td><div className="visual-actions">
                <button type="button" aria-label={`Edit VLAN ${vlan.id} ${vlan.label}`} onClick={() => setVlanDraft({ ...vlan, index })}>Edit</button>
                <button type="button" aria-label={`Remove VLAN ${vlan.id} ${vlan.label}`} onClick={() => {
                  setTopology(current => ({ ...current, vlans: current.vlans.filter((_, position) => position !== index) }))
                  setVlanDraft(null)
                }}>Remove</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="lab-panel">
        <h3>Design validation</h3>
        {report.issues.length
          ? <ul className="visual-error">{report.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>
          : <p>Port and VLAN checks passed.</p>}
        <h4>Single-cable failure analysis</h4>
        <p>Checks whether a server or storage device can still reach the gateway, or a switch when there is no gateway, after losing any one cable.</p>
        {report.redundancy.length ? <ul>
          {report.redundancy.map(entry => <li key={entry.id}>
            <strong>{entry.label}.</strong> {!entry.connected ? 'No path to core.' : entry.singlePoints.length
              ? `Single points of failure are ${entry.singlePoints.join(', ')}.` : 'Redundant cable paths.'}
          </li>)}
        </ul> : <p>Add a server or storage device to check cable redundancy.</p>}
      </section>
    </div>
    <section className="lab-panel" aria-labelledby="fabric-outage">
      <h3 id="fabric-outage">Cable outage drill</h3>
      <p>Preview the loss of a single cable while keeping the saved topology intact. Already isolated endpoints are reported separately.</p>
      <div className="visual-actions">
        <label>Simulated failed cable <select value={activeFailure} onChange={event => setFailedCable(event.target.value)}>
          <option value="">No failure selected</option>
          {topology.links.map(cable => <option value={cable.id} key={cable.id}>{cable.id} · {labels.get(cable.from)} to {labels.get(cable.to)}</option>)}
        </select></label>
        <button type="button" onClick={() => exportJson('fabriclab-design-report.json', fabricDesignReport(topology, report, outage))}>Export design report</button>
      </div>
      {outage && <div aria-live="polite">
        <p><strong>{outage.cableId}</strong> disabled in the drill · {outage.removedBandwidthGbps} Gbps removed · {Number(outage.remainingBandwidthGbps.toFixed(2))} Gbps remaining installed link capacity.</p>
        <p>{outage.lostReachability.length ? 'Newly isolated: ' + outage.lostReachability.map(({ label }) => label).join(', ') : 'No additional endpoints lose their path to core.'}</p>
        {outage.alreadyIsolated.length > 0 && <p>Already isolated: {outage.alreadyIsolated.map(({ label }) => label).join(', ')}.</p>}
      </div>}
    </section>
  </div>
}
