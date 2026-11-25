import test from 'node:test'
import assert from 'node:assert/strict'
import { filterEquipment, floorPositions, rackEquipment, rackUnitPosition } from './rack.mjs'

const fixture = {
  racks: [{ id: 'a', name: 'Rack A', x: 4, y: 1 }, { id: 'b', name: 'Rack B', x: 1, y: 5 }],
  servers: [{ id: 'compute01', name: 'Compute 01', rackId: 'a', kind: 'gpu', status: 'online', u: 3 }],
  switches: [{ id: 'sw1', name: 'Switch 01', rackId: 'b', status: 'online', u: 20 }],
  pdus: [{ id: 'pdu1', name: 'PDU 01', rackId: 'a', ratedW: 1000, powerW: 1001 }],
}

test('rack inventory joins all equipment classes and supports combined filters', () => {
  const equipment = rackEquipment(fixture)
  assert.equal(equipment.length, 3)
  assert.equal(equipment.find(item => item.kind === 'pdu').status, 'critical')
  assert.deepEqual(filterEquipment(equipment, { query: ' rack a ', kind: 'gpu', status: 'online' }).map(item => item.id), ['compute01'])
  assert.equal(filterEquipment(equipment, { rackId: 'b' })[0].kind, 'switch')
})

test('floor sections preserve coordinate order', () => {
  const layout = floorPositions(fixture.racks)
  assert.equal(layout.columns, 2)
  assert.deepEqual(layout.racks.map(rack => [rack.column, rack.row]), [[2, 1], [1, 2]])
})

test('rack positions respect bottom-origin rack units and reject out of bounds equipment', () => {
  assert.deepEqual(rackUnitPosition({ u: 8, heightU: 3 }, 10), { bottom: '70%', height: '30%' })
  assert.equal(rackUnitPosition({ u: 9, heightU: 3 }, 10), null)
  assert.equal(rackUnitPosition({ u: 0, heightU: 1 }, 10), null)
})
