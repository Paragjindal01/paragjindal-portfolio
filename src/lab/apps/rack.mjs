export function rackEquipment(snapshot) {
  const racks = new Map(snapshot.racks.map(rack => [rack.id, rack.name]))
  return [
    ...snapshot.servers,
    ...snapshot.switches.map(item => ({ ...item, kind: 'switch' })),
    ...snapshot.pdus.map(item => ({
      ...item, kind: 'pdu', status: item.powerW >= item.ratedW ? 'critical' : item.powerW >= item.ratedW * 0.8 ? 'warning' : 'online',
    })),
  ].map(item => ({ ...item, rackName: racks.get(item.rackId) ?? item.rackId })).sort((a, b) => (
    a.rackName.localeCompare(b.rackName) || (b.u ?? 0) - (a.u ?? 0) || a.name.localeCompare(b.name)
  ))
}

export function filterEquipment(items, { query = '', kind = '', status = '', rackId = '' } = {}) {
  const term = query.trim().toLowerCase()
  return items.filter(item => (!kind || item.kind === kind)
    && (!status || item.status === status)
    && (!rackId || item.rackId === rackId)
    && (!term || [item.id, item.name, item.rackName, item.kind].some(value => value?.toLowerCase().includes(term))))
}

export function floorPositions(racks) {
  const axis = key => [...new Set(racks.map(rack => rack[key]))].sort((a, b) => a - b)
  const columns = axis('x')
  const rows = axis('y')
  return {
    columns: columns.length,
    racks: racks.map(rack => ({ ...rack, column: columns.indexOf(rack.x) + 1, row: rows.indexOf(rack.y) + 1 })),
  }
}

export function rackUnitPosition(item, units) {
  const start = item.u
  const height = item.heightU
  if (!Number.isInteger(units) || units < 1 || !Number.isInteger(start) || !Number.isInteger(height)
    || start < 1 || height < 1 || start + height - 1 > units) return null
  return { bottom: `${(start - 1) / units * 100}%`, height: `${height / units * 100}%` }
}

export function rackSpace(rack, equipment) {
  const occupied = new Set()
  for (const item of equipment) {
    if (item.rackId !== rack.id || !rackUnitPosition(item, rack.units)) continue
    for (let unit = item.u; unit < item.u + item.heightU; unit += 1) occupied.add(unit)
  }
  const gaps = []
  for (let unit = 1; unit <= rack.units; unit += 1) {
    if (occupied.has(unit)) continue
    const previous = gaps.at(-1)
    if (previous?.end === unit - 1) previous.end = unit
    else gaps.push({ start: unit, end: unit })
  }
  return { occupied: occupied.size, free: rack.units - occupied.size, largestGap: Math.max(0, ...gaps.map(({ start, end }) => end - start + 1)), gaps }
}

export function pduDependencies(snapshot, pdu) {
  const assets = new Map([...snapshot.servers, ...snapshot.switches].map((asset) => [asset.id, asset]))
  const byHost = new Map()
  for (const workload of snapshot.workloads) {
    if (!byHost.has(workload.hostId)) byHost.set(workload.hostId, [])
    byHost.get(workload.hostId).push(workload)
  }
  return pdu.outlets.flatMap((outlet) => {
    const device = assets.get(outlet.deviceId ?? outlet.serverId)
    return device ? [{ outlet, device, workloads: byHost.get(device.id) ?? [] }] : []
  })
}

export function rackAlerts(snapshot, rackId, equipment) {
  const labels = new Map([[rackId, snapshot.racks.find((rack) => rack.id === rackId)?.name ?? rackId]])
  for (const asset of equipment.filter((item) => item.rackId === rackId)) {
    labels.set(asset.id, asset.name)
    for (const gpu of asset.gpus ?? []) labels.set(gpu.id, `${asset.name} · ${gpu.id}`)
  }
  return snapshot.alerts.filter((alert) => labels.has(alert.assetId)).map((alert) => ({ ...alert, label: labels.get(alert.assetId) }))
}
