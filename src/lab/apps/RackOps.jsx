import { useState } from 'react'
import { filterEquipment, floorPositions, pduDependencies, rackAlerts, rackEquipment, rackSpace, rackUnitPosition } from './rack.mjs'
import './visual-tools.css'
import './monitoring.css'

const kindLabels = { gpu: 'GPU server', compute: 'Compute server', management: 'Management server', storage: 'Storage node', switch: 'Network switch', pdu: 'Power distribution' }
const statusLabels = { normal: 'Normal', online: 'Online', warning: 'Warning', critical: 'Critical', offline: 'Offline', recovery: 'Recovery' }
const environmentMetrics = { ambientC: ['Ambient temperature', '°C'], humidityPercent: ['Relative humidity', '% RH'], gpuTemperatureC: ['GPU temperature', '°C'] }
const enumLabel = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown'

function EquipmentBadge({ status }) {
  return <span className="rack-status" data-health={status}>{statusLabels[status] ?? enumLabel(status)}</span>
}

function RackFace({ rear, active, rack, items, selected, select }) {
  const equipment = items.filter(item => item.kind !== 'pdu')
  const pdus = items.filter(item => item.kind === 'pdu')
  return <div className={`rack-face ${rear ? 'rack-face-rear' : 'rack-face-front'}`} aria-hidden={!active}>
    <div className="rack-face-label">{rack.name} / {rear ? 'REAR' : 'FRONT'}</div>
    <div className="rack-units" style={{ '--rack-mark': `${100 / rack.units}%` }}>
      {equipment.map(item => {
        const style = rackUnitPosition(item, rack.units)
        return style && <button type="button" key={item.id} tabIndex={active ? 0 : -1}
          aria-label={`${item.name}, ${kindLabels[item.kind]}, ${item.status}, rack unit ${item.u}`}
          className="rack-hardware" data-health={item.status} aria-pressed={item.id === selected}
          style={style} onClick={() => select(item)}>
          <i aria-hidden="true" /><span>{item.name}</span>
        </button>
      })}
    </div>
    {rear && <div className="rack-pdu-strips">
      {pdus.map(item => <button type="button" key={item.id} tabIndex={active ? 0 : -1}
        className="rack-pdu-strip" aria-label={`Select ${item.name}, ${item.outlets.length} outlets`}
        aria-pressed={item.id === selected} onClick={() => select(item)}>
        {item.outlets.map(outlet => <span aria-hidden="true" key={outlet.id} data-state={outlet.state} title={`Outlet ${outlet.number}`} />)}
      </button>)}
    </div>}
    <div className="rack-face-foot">{rack.units}U</div>
  </div>
}

function RackModel({ rack, items, selected, select }) {
  const [rear, setRear] = useState(false)
  const [angle, setAngle] = useState(-22)
  return <div className="rack-model-region">
    <div className="visual-actions">
      <button type="button" aria-pressed={!rear} onClick={() => setRear(false)}>Front</button>
      <button type="button" aria-pressed={rear} onClick={() => setRear(true)}>Rear</button>
      <label className="rack-angle">View angle<input type="range" min="-55" max="55" step="1" value={angle} onChange={event => setAngle(Number(event.target.value))} /></label>
    </div>
    <div className="rack-perspective">
      <div className="rack-model" style={{ '--rack-angle': `${angle + (rear ? 180 : 0)}deg` }}>
        <div className="rack-side rack-side-left" aria-hidden="true" />
        <div className="rack-side rack-side-right" aria-hidden="true" />
        <div className="rack-top" aria-hidden="true" />
        <RackFace rack={rack} active={!rear} items={items} selected={selected} select={select} />
        <RackFace rear rack={rack} active={rear} items={items} selected={selected} select={select} />
      </div>
    </div>
  </div>
}

function PowerDependencies({ item, snapshot }) {
  const connected = pduDependencies(snapshot, item)
  const guests = connected.reduce((total, record) => total + record.workloads.length, 0)
  return <details className="ops-disclosure">
    <summary>Power dependencies</summary>
    <p>{connected.length} mapped devices · {guests} guest workloads. Review the equipment and guests that depend on this simulated PDU.</p>
    <ul>
      {connected.map(({ outlet, device, workloads }) => {
        const params = new URLSearchParams({ scenario: snapshot.scenario, step: String(snapshot.step), outlet: outlet.id })
        return <li key={outlet.id}><strong>{device.name}</strong> · {outlet.powerW} W · <a href={'/lab/powerops?' + params}>Open outlet {outlet.number} in PowerOps</a>
          {workloads.length > 0 && <small className="ops-subline">Guests: {workloads.map((guest) => `${guest.name} (${guest.status})`).join(', ')}</small>}
        </li>
      })}
    </ul>
  </details>
}

function EquipmentDetails({ item, snapshot, select }) {
  if (!item) return <p>Select equipment in the rack model or inventory.</p>
  const pdu = snapshot.pdus.find(entry => entry.id === item.pduId)
  return <>
    <h4>{item.name}</h4>
    <p>{kindLabels[item.kind]} · {item.rackName} <EquipmentBadge status={item.status} /></p>
    <dl className="rack-details">
      <dt>Asset ID</dt><dd>{item.id}</dd>
      {item.u != null && <><dt>Position</dt><dd>U{item.u} · {item.heightU}U chassis</dd></>}
      <dt>Power</dt><dd>{item.powerW} W{item.ratedW != null && ` / ${item.ratedW} W rated`}</dd>
      {item.networkPercent != null && <><dt>Network utilization</dt><dd>{item.networkPercent}%</dd></>}
      {item.cpuPercent != null && <><dt>CPU</dt><dd>{item.cpuPercent}% of {item.cpuCores} cores</dd></>}
      {item.memoryTotalGiB != null && <><dt>Memory</dt><dd>{item.memoryUsedGiB} / {item.memoryTotalGiB} GiB</dd></>}
      {item.storageTotalTB != null && <><dt>Storage</dt><dd>{item.storageUsedTB} / {item.storageTotalTB} TB</dd></>}
      {item.gpus?.length > 0 && <><dt>GPU temperature</dt><dd>{item.gpuTemperatureC} °C</dd></>}
      {item.os && <><dt>Operating system</dt><dd>{item.os}</dd></>}
      {pdu && <><dt>Power feed</dt><dd><button type="button" onClick={() => select({ ...pdu, kind: 'pdu' })}>{pdu.name} · outlet {item.outlet}</button></dd></>}
    </dl>
    {item.outlets && <div className="visual-table-wrap">
      <table className="lab-table"><thead><tr><th scope="col">Outlet</th><th scope="col">Connected device</th><th scope="col">Phase</th><th scope="col">Draw / capacity</th><th scope="col">State</th></tr></thead>
        <tbody>{item.outlets.map(outlet => {
          const deviceId = outlet.deviceId ?? outlet.serverId
          const device = [...snapshot.servers, ...snapshot.switches].find(asset => asset.id === deviceId)
          return <tr key={outlet.id}>
            <th scope="row">{outlet.number}</th>
            <td>{device ? <button type="button" onClick={() => select({ ...device, kind: device.kind ?? 'switch' })}>{device.name}</button> : 'Unassigned'}</td>
            <td>{outlet.phase}</td><td>{outlet.powerW} / {outlet.ratedW} W</td><td>{enumLabel(outlet.state)}</td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    {item.outlets && <PowerDependencies item={item} snapshot={snapshot} />}
  </>
}

export default function RackOps({ snapshot }) {
  const [roomId, setRoomId] = useState('')
  const [rackId, setRackId] = useState('')
  const [assetId, setAssetId] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const room = snapshot.rooms.find(item => item.id === roomId) ?? snapshot.rooms[0]
  const facility = snapshot.facilities.find(site => site.id === room?.facilityId)
  const roomsRacks = snapshot.racks.filter(item => item.roomId === room?.id)
  const rack = roomsRacks.find(item => item.id === rackId) ?? roomsRacks[0]
  const equipment = rackEquipment(snapshot)
  const rackItems = equipment.filter(item => item.rackId === rack?.id)
  const asset = rackItems.find(item => item.id === assetId)
  const busyFilters = query.trim() || kind || status
  const inventory = filterEquipment(equipment, { query, kind, status, rackId: busyFilters ? '' : rack?.id })
  const layout = floorPositions(roomsRacks)
  const space = rack ? rackSpace(rack, rackItems) : null
  const alerts = rack ? rackAlerts(snapshot, rack.id, rackItems) : []
  const environmental = alerts.filter(item => /temperature|humidity|ambient|thermal/i.test(item.metric))

  function selectEquipment(item) {
    const nextRack = snapshot.racks.find(candidate => candidate.id === item.rackId)
    if (!nextRack) return
    setRoomId(nextRack.roomId)
    setRackId(nextRack.id)
    setAssetId(item.id)
  }

  return <div className="visual-tool">
    <section className="lab-panel rack-floor-panel">
      <h3>Facility floor plan</h3>
      <div className="visual-actions">
        <label>Room<select value={room?.id ?? ''} onChange={event => { setRoomId(event.target.value); setRackId(''); setAssetId('') }}>
          {snapshot.facilities.map(site => <optgroup label={site.name} key={site.id}>
            {snapshot.rooms.filter(item => item.facilityId === site.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </optgroup>)}
        </select></label>
        {facility && room && <p>{facility.name} / {room.name}</p>}
      </div>
      {layout.racks.length ? <div role="group" aria-label={`${room.name} rack floor plan`} className="rack-floor-scroll">
        <div className="rack-floor" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(7.5rem, 1fr))` }}>
          {layout.racks.map(item => <button type="button" className="rack-floor-asset" aria-pressed={item.id === rack?.id} key={item.id}
            style={{ gridColumn: item.column, gridRow: item.row }} onClick={() => { setRackId(item.id); setAssetId('') }}>
            <span className="rack-floor-label">{item.name}</span>
            <EquipmentBadge status={item.status} />
            <span>{item.ambientC} °C · {item.humidityPercent}% RH</span>
          </button>)}
        </div>
      </div> : <p>This room has no racks.</p>}
    </section>
    {rack && <div className="visual-split">
      <section className="lab-panel">
        <h3>{rack.name} rack model</h3>
        <p>{rack.ambientC} °C · {rack.humidityPercent}% RH · {rack.capacityW} W capacity</p>
        <RackModel key={rack.id} rack={rack} items={rackItems} selected={assetId} select={selectEquipment} />
        <details className="ops-disclosure"><summary>Rack space assessment</summary><p>{space.occupied}U occupied · {space.free}U free · {space.largestGap}U largest contiguous space.</p>
          {space.gaps.length > 0 && <p>Free ranges: {space.gaps.map(({ start, end }) => start === end ? `U${start}` : `U${start}–U${end}`).join(', ')}.</p>}
        </details>
      </section>
      <section className="lab-panel">
        <h3>Equipment information</h3>
        <EquipmentDetails item={asset} snapshot={snapshot} select={selectEquipment} />
        <h3>Environmental alerts</h3>
        {environmental.length ? <ul>
          {environmental.map((alert, index) => {
            const [metric, unit] = environmentMetrics[alert.metric] ?? [alert.metric, '']
            return <li key={`${alert.assetId}-${alert.metric}-${index}`}>
              <EquipmentBadge status={alert.severity} /> {alert.label} · {metric} recorded {alert.value} {unit} (threshold {alert.threshold} {unit}). {alert.recommendation}
            </li>
          })}
        </ul> : <p>No simulated environmental alerts for this rack.</p>}
      </section>
    </div>}
    <section className="lab-panel">
      <h3>Equipment inventory</h3>
      <div className="visual-form-grid">
        <label>Search equipment<input type="search" placeholder="Asset name, ID, type or rack" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>Equipment type<select value={kind} onChange={event => setKind(event.target.value)}>
          <option value="">All types</option>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
        <label>Equipment status<select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">All statuses</option>{['online', 'warning', 'critical', 'offline'].map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}
        </select></label>
      </div>
      <p>{inventory.length} assets · {busyFilters ? 'All simulated facilities' : rack?.name ?? 'All racks'}</p>
      <div className="visual-table-wrap">
        <table className="lab-table">
          <thead><tr><th scope="col">Asset</th><th scope="col">Type</th><th scope="col">Rack</th><th scope="col">Position</th><th scope="col">Status</th><th scope="col">Power</th></tr></thead>
          <tbody>{inventory.map(item => <tr key={item.id}>
            <th scope="row"><button type="button" aria-pressed={assetId === item.id} onClick={() => selectEquipment(item)}>{item.name}</button></th>
            <td>{kindLabels[item.kind]}</td><td>{item.rackName}</td><td>{item.kind === 'pdu' ? 'Rear vertical' : `U${item.u}`}</td>
            <td><EquipmentBadge status={item.status} /></td><td>{item.powerW} W</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>
}
