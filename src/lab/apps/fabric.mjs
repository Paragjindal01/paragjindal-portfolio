export const DEVICE_TYPES = ['firewall', 'switch', 'server', 'storage']
export const FABRICS = ['Ethernet', 'InfiniBand']
export const GRAPH_WIDTH = 800
export const GRAPH_HEIGHT = 420

const device = (id, kind, label, x, y) => ({ id, kind, label, x, y })
const link = (id, from, to, fromPort, toPort, speedGbps, fabric, vlanIds = []) => ({
  id, from, to, fromPort, toPort, speedGbps, fabric, vlanIds,
  mode: fabric === 'InfiniBand' ? 'none' : vlanIds.length > 1 ? 'trunk' : 'access',
})

export function exampleTopology(fabric = 'Ethernet') {
  const ethernet = fabric === 'Ethernet'
  const speed = ethernet ? 25 : 200
  return {
    version: 1,
    devices: [
      device('switch-a', 'switch', ethernet ? 'Distribution A' : 'Fabric A', 218, 165),
      device('switch-b', 'switch', ethernet ? 'Distribution B' : 'Fabric B', 582, 165),
      device('server-1', 'server', 'Compute 01', 218, 330),
      device('storage-1', 'storage', 'Storage 01', 582, 330),
      ...(ethernet ? [device('edge-1', 'firewall', 'Edge gateway', 400, 68)] : []),
    ],
    vlans: ethernet ? [
      { id: 110, label: 'Compute', cidr: '192.0.2.0/25' },
      { id: 120, label: 'Storage', cidr: '198.51.100.0/25' },
    ] : [],
    links: [
      link('cable-1', 'server-1', 'switch-a', '1', '3', speed, fabric, ethernet ? [110] : []),
      link('cable-2', 'server-1', 'switch-b', '2', '3', speed, fabric, ethernet ? [110] : []),
      link('cable-3', 'storage-1', 'switch-a', '1', '4', speed, fabric, ethernet ? [120] : []),
      link('cable-4', 'storage-1', 'switch-b', '2', '4', speed, fabric, ethernet ? [120] : []),
      ...(ethernet ? [
        link('cable-5', 'switch-a', 'edge-1', '1', '1', 100, fabric, [110, 120]),
        link('cable-6', 'switch-b', 'edge-1', '1', '2', 100, fabric, [110, 120]),
      ] : []),
    ],
  }
}

const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,60}$/.test(value)
const port = value => typeof value === 'string' && /^[a-zA-Z0-9_.:/-]{1,60}$/.test(value)
const name = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 60
const numberIn = (value, min, max) => Number.isFinite(value) && value >= min && value <= max
const validVlan = value => Number.isInteger(value) && numberIn(value, 1, 4094)

function subnet(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(value)) return null
  const [address, length] = value.split('/')
  const columns = address.split('.')
  const octets = columns.map(Number)
  const prefix = Number(length)
  if (octets.some((octet, index) => octet > 255 || String(octet) !== columns[index]) || prefix > 32 || String(prefix) !== length) return null
  const ip = octets.reduce((value, octet) => value * 256 + octet, 0)
  const size = 2 ** (32 - prefix)
  const start = Math.floor(ip / size) * size
  return ip === start ? [start, start + size - 1] : null
}

export function parseTopology(text) {
  if (typeof text !== 'string' || text.length > 131072) throw new Error('Choose a topology JSON file under 128 KB.')
  const data = JSON.parse(text)
  if (data?.version !== 1 || !Array.isArray(data.devices) || !Array.isArray(data.links) || !Array.isArray(data.vlans)) {
    throw new Error('Expected a FabricLab version 1 topology.')
  }
  if (data.devices.length > 50 || data.links.length > 100 || data.vlans.length > 100) throw new Error('The imported topology exceeds the device, cable or VLAN limit.')

  const usedDeviceIds = new Set()
  const devices = data.devices.map(item => {
    if (!identifier(item?.id) || usedDeviceIds.has(item.id) || !DEVICE_TYPES.includes(item.kind) || !name(item.label)
      || !numberIn(item.x, 60, GRAPH_WIDTH - 60) || !numberIn(item.y, 43, GRAPH_HEIGHT - 43)) {
      throw new Error('Invalid device identifier, label, category or position.')
    }
    usedDeviceIds.add(item.id)
    return device(item.id, item.kind, item.label, item.x, item.y)
  })
  const usedCableIds = new Set()
  const links = data.links.map(item => {
    if (!identifier(item?.id) || usedCableIds.has(item.id) || !usedDeviceIds.has(item.from)
      || !usedDeviceIds.has(item.to) || item.from === item.to || !port(item.fromPort) || !port(item.toPort)
      || !numberIn(item.speedGbps, 0.1, 1600) || !FABRICS.includes(item.fabric)
      || !Array.isArray(item.vlanIds) || item.vlanIds.length > 100 || !item.vlanIds.every(validVlan)
      || !['none', 'access', 'trunk'].includes(item.mode)) {
      throw new Error('Invalid cable endpoints, ports, speed or fabric configuration.')
    }
    usedCableIds.add(item.id)
    return { ...link(item.id, item.from, item.to, item.fromPort, item.toPort, item.speedGbps, item.fabric, [...item.vlanIds]), mode: item.mode }
  })
  const vlans = data.vlans.map(item => {
    if (!validVlan(item?.id) || !name(item.label) || !subnet(item.cidr)) throw new Error('VLANs require an ID from 1 to 4094, a label and a canonical IPv4 subnet.')
    return { id: item.id, label: item.label, cidr: item.cidr }
  })

  return { version: 1, devices, links, vlans }
}

export function inspectTopology({ devices, links, vlans }) {
  const labels = new Map(devices.map(item => [item.id, item.label]))
  const issues = []
  const ports = new Map()
  const networks = new Map()
  const subnets = []

  for (const vlan of vlans) {
    if (networks.has(vlan.id)) issues.push(`VLAN ${vlan.id} has more than one segment definition.`)
    networks.set(vlan.id, vlan)
    const range = subnet(vlan.cidr)
    if (!range) {
      issues.push(`VLAN ${vlan.id} requires a canonical IPv4 subnet.`)
      continue
    }
    for (const [other, [start, end]] of subnets) {
      if (range[0] <= end && start <= range[1]) issues.push(`VLAN ${vlan.id} overlaps VLAN ${other}.`)
    }
    subnets.push([vlan.id, range])
  }

  for (const cable of links) {
    for (const [endpoint, port] of [[cable.from, cable.fromPort], [cable.to, cable.toPort]]) {
      const key = `${endpoint}/${port.toLowerCase()}`
      if (ports.has(key)) issues.push(`${labels.get(endpoint)} port ${port} is assigned to ${ports.get(key)} and ${cable.id}.`)
      ports.set(key, cable.id)
    }
    if (new Set(cable.vlanIds).size !== cable.vlanIds.length) issues.push(`${cable.id} repeats a VLAN assignment.`)
    for (const id of new Set(cable.vlanIds)) {
      if (!networks.has(id)) issues.push(`${cable.id} uses undefined VLAN ${id}.`)
    }
    if (cable.fabric === 'InfiniBand' && (cable.mode !== 'none' || cable.vlanIds.length > 0)) {
      issues.push(`${cable.id} assigns Ethernet VLANs to an InfiniBand link.`)
    }
    if (cable.fabric === 'Ethernet' && cable.mode === 'access' && cable.vlanIds.length !== 1) {
      issues.push(`${cable.id} requires exactly one VLAN in access mode.`)
    }
    if (cable.fabric === 'Ethernet' && cable.mode === 'trunk' && cable.vlanIds.length === 0) {
      issues.push(`${cable.id} requires at least one VLAN in trunk mode.`)
    }
    if (cable.fabric === 'Ethernet' && cable.mode === 'none' && cable.vlanIds.length > 0) {
      issues.push(`${cable.id} must use access or trunk mode to carry VLANs.`)
    }
  }

  const endpoints = devices.filter(item => ['server', 'storage'].includes(item.kind))
  const fabricDevices = devices.filter(item => ['firewall', 'switch'].includes(item.kind))
  const roots = new Set(fabricDevices.filter(item => item.kind === 'firewall').map(item => item.id))
  const core = roots.size ? roots : new Set(fabricDevices.map(item => item.id))
  const transit = new Set(fabricDevices.map(item => item.id))
  const adjacency = new Map(devices.map(item => [item.id, []]))
  for (const cable of links) {
    adjacency.get(cable.from)?.push([cable.to, cable])
    adjacency.get(cable.to)?.push([cable.from, cable])
  }

  function canReachCore(start, removed, fabric) {
    const pending = [start]
    const visited = new Set([start])
    for (const id of pending) {
      if (core.has(id)) return true
      for (const [next, cable] of adjacency.get(id)) {
        if (cable.id === removed || cable.fabric !== fabric || !transit.has(next) || visited.has(next)) continue
        visited.add(next)
        pending.push(next)
      }
    }
    return false
  }

  const redundancy = endpoints.map(item => {
    const activeFabrics = FABRICS.filter(fabric => canReachCore(item.id, null, fabric))
    const singlePoints = activeFabrics.length > 0
      ? links.filter(cable => !activeFabrics.some(fabric => canReachCore(item.id, cable.id, fabric))).map(cable => cable.id)
      : []
    return { id: item.id, label: item.label, connected: activeFabrics.length > 0, singlePoints }
  })

  return { issues, redundancy, bandwidthGbps: links.reduce((total, cable) => total + cable.speedGbps, 0) }
}

export function analyzeCableOutage(topology, cableId, baseline = inspectTopology(topology)) {
  const cable = topology.links.find(({ id }) => id === cableId)
  if (!cable) throw new RangeError('Choose a cable in this topology.')
  const after = inspectTopology({ ...topology, links: topology.links.filter(({ id }) => id !== cableId) })
  const reachableBefore = new Set(baseline.redundancy.filter(({ connected }) => connected).map(({ id }) => id))
  return {
    cableId,
    fabric: cable.fabric,
    removedBandwidthGbps: cable.speedGbps,
    remainingBandwidthGbps: after.bandwidthGbps,
    lostReachability: after.redundancy.filter(({ id, connected }) => !connected && reachableBefore.has(id))
      .map(({ id, label }) => ({ id, label })),
    alreadyIsolated: baseline.redundancy.filter(({ connected }) => !connected).map(({ id, label }) => ({ id, label })),
  }
}

export function fabricDesignReport(topology, baseline, outage = null) {
  return {
    schemaVersion: 1,
    topology,
    validation: baseline,
    outage,
    assumptions: [
      'Installed link rates are additive and do not measure end-to-end throughput.',
      'Reachability requires a continuous fabric to a firewall or a switch when no firewall exists.',
      'Cable removal is a topology exercise and does not simulate forwarding policies or protocols.',
    ],
  }
}
