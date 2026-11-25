import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateStorage, DEFAULT_PLAN, tbToTib } from './storage.mjs'

test('replication and erasure coding use their distinct overhead ratios', () => {
  const [replicated, encoded] = calculateStorage(DEFAULT_PLAN)
  assert.equal(replicated.current.rawTB, 1728)
  assert.equal(replicated.current.theoreticalTB, 576)
  assert.equal(encoded.current.theoreticalTB, 1152)
  assert.equal(replicated.current.planningTB, 576 * 0.95 * 0.8)
  assert.equal(encoded.current.planningTiB, tbToTib(encoded.current.planningTB))
  assert.equal(tbToTib(2 ** 40 / 1e12), 1)
})

test('capacity distinguishes possible full placement from surviving shard budget', () => {
  const [replicated, encoded] = calculateStorage({ ...DEFAULT_PLAN, nodes: 6, failed: 2 })
  assert.equal(replicated.failed.placementPossible, true)
  assert.equal(encoded.failed.placementPossible, false)
  assert.equal(encoded.withinModelLossBudget, true)
  assert.equal(encoded.failed.planningTB, null)
  assert.equal(encoded.failed.theoreticalTB, 576)
  assert.equal(encoded.expanded.placementPossible, true)
  assert.ok(encoded.expansionDeltaTB > 0)
})

test('an undersized installation has undefined planning capacity, including its expansion delta', () => {
  const [, encoded] = calculateStorage({ ...DEFAULT_PLAN, nodes: 5, failed: 0, add: 1 })
  assert.equal(encoded.current.planningTB, null)
  assert.equal(encoded.withinModelLossBudget, false)
  assert.equal(encoded.expansionDeltaTB, null)
  assert.ok(encoded.expanded.planningTB > 0)
})

test('invalid inputs and impossible failures are rejected', () => {
  for (const changes of [{ nodes: 1.5 }, { failed: 9 }, { reserve: 100 }, { drives: 0 }, { driveTB: Infinity }, { data: NaN }]) {
    assert.throws(() => calculateStorage({ ...DEFAULT_PLAN, ...changes }), RangeError)
  }
})
