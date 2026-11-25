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
