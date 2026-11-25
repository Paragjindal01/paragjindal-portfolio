import { CLUSTER_PRESETS, comparePolicies, generateWorkload } from '../src/core/simulator.mjs';

const atlas = CLUSTER_PRESETS.find(({ id }) => id === 'atlas');
const meridian = CLUSTER_PRESETS.find(({ id }) => id === 'meridian');
const foundry = CLUSTER_PRESETS.find(({ id }) => id === 'foundry');

const scenarios = [
  { name: 'Mixed arrivals', cluster: atlas, seed: 42, count: 36 },
  { name: 'Device outage', cluster: meridian, seed: 165, count: 64, outage: { at: 18, duration: 12 } },
  { name: 'Lower power budget', cluster: { ...foundry, powerCapWatts: Math.floor(foundry.powerCapWatts * 0.8) }, seed: 123, count: 52 },
];

function describeScenario({ name, cluster, seed, count, outage }) {
  const jobs = generateWorkload({ seed, count });
  const failures = outage ? [{ gpuId: cluster.nodes[0].gpus[0].id, ...outage }] : [];
  const results = comparePolicies({ cluster, jobs, failures });
  return {
    name, cluster: cluster.name, seed, count, powerCapWatts: cluster.powerCapWatts, failures,
    policies: results.map(({ policyId, label, metrics }) => ({ policy: policyId, label, ...metrics })),
  };
}

const display = (value, digits = 2) => value === null ? '—' : value.toFixed(digits);
const percent = (value) => value === null ? '—' : display(value * 100, 1) + '%';
const report = scenarios.map(describeScenario);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const scenario of report) {
    console.log(`\n${scenario.name} · ${scenario.cluster} · seed ${scenario.seed} · ${scenario.count} jobs · ${scenario.powerCapWatts} W cap`);
    console.table(scenario.policies.map((entry) => ({
      Policy: entry.label,
      Completed: entry.completed,
      'p95 wait (min)': display(entry.p95Wait),
      'p95 turnaround (min)': display(entry.p95Completion),
      'Jobs / h': display(entry.throughput),
      'On time': percent(entry.deadlineRate),
      GPU: percent(entry.utilization),
      Fragmentation: percent(entry.fragmentation),
      kWh: display(entry.energyKwh, 3),
      Fairness: display(entry.fairness, 3),
    })));
  }
}
