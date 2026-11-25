export const DEFAULT_PLAN = Object.freeze({
  nodes: 8,
  drives: 12,
  driveTB: 18,
  replicas: 3,
  data: 4,
  parity: 2,
  reserve: 5,
  headroom: 20,
  failed: 1,
  add: 2,
})

export const PLAN_FIELDS = Object.freeze([
  ['nodes', 'Storage nodes', 1, 500, 1],
  ['drives', 'Drives per node', 1, 500, 1],
  ['driveTB', 'Drive capacity (TB)', 0.01, 1_000, 0.01],
  ['replicas', 'Replication factor', 1, 10, 1],
  ['data', 'Data shards (k)', 1, 32, 1],
  ['parity', 'Parity shards (m)', 1, 32, 1],
  ['reserve', 'Capacity reservation (%)', 0, 99, 0.1],
  ['headroom', 'Operating headroom (%)', 0, 99, 0.1],
  ['failed', 'Failed nodes', 0, 500, 1],
  ['add', 'Additional nodes', 0, 500, 1],
])

export const tbToTib = tb => tb * 1e12 / (2 ** 40)

function capacity(nodes, plan, columns, payload) {
  const rawTB = nodes * plan.drives * plan.driveTB
  const theoreticalTB = rawTB * payload / columns
  const planningTB = theoreticalTB * (1 - plan.reserve / 100) * (1 - plan.headroom / 100)
  const placementPossible = nodes >= columns

  return {
    domains: nodes,
    requiredDomains: columns,
    placementPossible,
    rawTB,
    rawTiB: tbToTib(rawTB),
    theoreticalTB,
    theoreticalTiB: tbToTib(theoreticalTB),
    planningTB: placementPossible ? planningTB : null,
    planningTiB: placementPossible ? tbToTib(planningTB) : null,
  }
}

export function calculateStorage(plan) {
  for (const [name, label, min, max, step] of PLAN_FIELDS) {
    const value = plan[name]
    if (!Number.isFinite(value) || value < min || value > max || (step === 1 && !Number.isInteger(value))) {
      throw new RangeError(`${label} must be ${step === 1 ? 'a whole number' : 'a number'} between ${min} and ${max}.`)
    }
  }
  if (plan.failed > plan.nodes) throw new RangeError('Failed nodes cannot exceed installed nodes.')

  const layouts = [
    { label: `${plan.replicas}× replication`, columns: plan.replicas, payload: 1 },
    { label: `Erasure coding ${plan.data}+${plan.parity}`, columns: plan.data + plan.parity, payload: plan.data },
  ]

  return layouts.map(({ label, columns, payload }) => {
    const current = capacity(plan.nodes, plan, columns, payload)
    const failed = capacity(plan.nodes - plan.failed, plan, columns, payload)
    const expanded = capacity(plan.nodes + plan.add, plan, columns, payload)
    const modelLossBudget = columns - payload

    return {
      label,
      current,
      failed,
      expanded,
      modelLossBudget,
      withinModelLossBudget: current.placementPossible && plan.failed <= modelLossBudget,
      expansionDeltaTB: current.planningTB === null || expanded.planningTB === null
        ? null
        : expanded.planningTB - current.planningTB,
    }
  })
}
