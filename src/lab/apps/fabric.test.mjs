import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCableOutage, fabricDesignReport, exampleTopology, inspectTopology, parseTopology } from './fabric.mjs'

test('both presets round-trip with redundant endpoints and calculated cable capacity', () => {
  for (const [fabric, capacity] of [['Ethernet', 300], ['InfiniBand', 800]]) {
    const topology = exampleTopology(fabric)
    assert.deepEqual(parseTopology(JSON.stringify(topology)), topology)
    const result = inspectTopology(topology)
    assert.deepEqual(result.issues, [])
    assert.equal(result.bandwidthGbps, capacity)
    assert.ok(result.redundancy.every(item => item.connected && !item.singlePoints.length))
  }
})

test('single cable failures identify all upstream single points', () => {
  const topology = exampleTopology()
  topology.links = topology.links.filter(cable => cable.id !== 'cable-5')
  const result = inspectTopology(topology)
  assert.deepEqual(result.redundancy[0].singlePoints, ['cable-2', 'cable-6'])
  assert.deepEqual(result.redundancy[1].singlePoints, ['cable-4', 'cable-6'])
})

test('port collision, undefined and duplicate VLANs and subnet overlap are diagnosed', () => {
  const topology = exampleTopology()
  topology.links[1] = { ...topology.links[1], fromPort: '1', vlanIds: [110, 999, 999] }
  topology.vlans.push({ id: 110, label: 'Duplicate', cidr: '192.0.2.0/24' })
  const { issues } = inspectTopology(topology)
  assert.match(issues.join('\n'), /more than one segment/)
  assert.match(issues.join('\n'), /overlaps/)
  assert.match(issues.join('\n'), /port 1 is assigned/)
  assert.match(issues.join('\n'), /undefined VLAN 999/)
  assert.match(issues.join('\n'), /repeats a VLAN/)
})

test('invalid cable topology and non-network VLAN addresses are rejected', () => {
  const topology = exampleTopology()
  topology.links[0].to = 'phantom'
  assert.throws(() => parseTopology(JSON.stringify(topology)), /Invalid cable/)
  const invalidSubnet = exampleTopology()
  invalidSubnet.vlans[0].cidr = '192.0.2.1/25'
  assert.throws(() => parseTopology(JSON.stringify(invalidSubnet)), /IPv4 subnet/)
})

test('reachability excludes intermediate endpoints and incompatible fabrics', () => {
  const topology = exampleTopology()
  topology.links = topology.links.filter(cable => ['cable-1', 'cable-5'].includes(cable.id))
  topology.links[0].fabric = 'InfiniBand'
  assert.ok(inspectTopology(topology).redundancy.every(item => !item.connected))
})

test('outage drills preserve the topology and report new losses separately from baseline gaps', () => {
  const topology = exampleTopology()
  assert.deepEqual(analyzeCableOutage(topology, 'cable-5').lostReachability, [])
  const design = { ...topology, links: topology.links.filter(({ id }) => id !== 'cable-5') }
  design.devices = [...design.devices, { id: 'isolated', kind: 'storage', label: 'Isolated node', x: 300, y: 200 }]
  const before = structuredClone(design)
  const baseline = inspectTopology(design)
  const outage = analyzeCableOutage(design, 'cable-2', baseline)
  assert.equal(outage.remainingBandwidthGbps, 175)
  assert.deepEqual(outage.lostReachability.map(({ id }) => id), ['server-1'])
  assert.deepEqual(outage.alreadyIsolated.map(({ id }) => id), ['isolated'])
  assert.deepEqual(design, before)
  assert.equal(fabricDesignReport(design, baseline, outage).validation.bandwidthGbps, 200)
  assert.throws(() => analyzeCableOutage(design, 'unknown'), /Choose a cable/)
})
