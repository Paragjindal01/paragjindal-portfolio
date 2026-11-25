const makeNode = (id, count, memoryGiB, compute, idleWatts, activeWatts) => ({
  id,
  gpus: Array.from({ length: count }, (_, index) => ({
    id: id + '-g' + index,
    memoryGiB,
    compute,
    idleWatts,
    activeWatts,
  })),
});

export const CLUSTER_PRESETS = [
  {
    id: 'atlas',
    name: 'Atlas Mixed Cluster',
    powerCapWatts: 2900,
    nodes: [
      makeNode('atlas-1', 4, 48, 1.3, 48, 350),
      makeNode('atlas-2', 4, 24, 0.85, 30, 225),
      makeNode('atlas-3', 2, 80, 1.75, 65, 475),
    ],
  },
  {
    id: 'meridian',
    name: 'Meridian Training Cluster',
    powerCapWatts: 4350,
    nodes: [
      makeNode('meridian-1', 4, 80, 1.85, 68, 480),
      makeNode('meridian-2', 4, 64, 1.4, 55, 380),
      makeNode('meridian-3', 4, 32, 0.8, 30, 220),
    ],
  },
  {
    id: 'foundry',
    name: 'Foundry Power-Capped Cluster',
    powerCapWatts: 1125,
    nodes: [
      makeNode('foundry-1', 4, 48, 1.5, 45, 335),
      makeNode('foundry-2', 4, 40, 0.95, 32, 190),
      makeNode('foundry-3', 2, 80, 1.25, 60, 300),
    ],
  },
];

export const POLICY_PRESETS = [
  { id: 'fifo', label: 'FIFO', policy: 'fifo', allocation: 'best-fit', backfill: false },
  { id: 'priority', label: 'Priority', policy: 'priority', allocation: 'best-fit', backfill: false },
  { id: 'fair-share', label: 'Fair share', policy: 'fair-share', allocation: 'best-fit', backfill: false },
  { id: 'backfill', label: 'FIFO + backfill', policy: 'fifo', allocation: 'best-fit', backfill: true },
];

export const LIMITS = Object.freeze({
  nodes: 16,
  gpus: 64,
  jobs: 250,
  failures: 128,
  inputMinutes: 10080,
});

const pick = (values, random) => values[Math.floor(random() * values.length)];

export function generateWorkload({
  seed = 42,
  count = 32,
  teams = ['Research', 'Serving', 'Platform'],
  trainingShare = 0.58,
} = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer.');
  }
  if (!Number.isInteger(count) || count < 0 || count > LIMITS.jobs) {
    throw new RangeError('Workload size must be between 0 and ' + LIMITS.jobs + '.');
  }
  if (!Number.isFinite(trainingShare) || trainingShare < 0 || trainingShare > 1) {
    throw new RangeError('Training share must be between 0 and 1.');
  }
  if (!Array.isArray(teams) || teams.length < 1 || teams.length > 32 || new Set(teams).size !== teams.length
    || teams.some((team) => typeof team !== 'string' || team.trim() === '' || team.length > 64)) {
    throw new RangeError('Provide between 1 and 32 distinct team names of at most 64 characters.');
  }
  let state = seed;
  function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }

  let arrival = 0;
  return Array.from({ length: count }, (_, index) => {
    arrival += index === 0 ? 0 : pick([0, 0, 1, 1, 2, 4], random);
    const team = pick(teams, random);
    const training = random() < trainingShare;
    const gpuCount = training ? pick([1, 2, 2, 4], random) : pick([1, 1, 1, 2], random);
    const memoryGiB = training
      ? pick(gpuCount > 2 ? [24, 32, 40, 48] : [24, 40, 48, 64], random)
      : pick([8, 12, 16, 24, 32], random);
    const work = gpuCount * (training ? 17 + Math.floor(random() * 28) : 3 + Math.floor(random() * 10));
    const priority = training ? pick([1, 2, 3, 5], random) : pick([4, 6, 8, 9], random);
    const lag = training ? 28 + Math.floor(random() * 67) : 9 + Math.floor(random() * 18);
    return {
      id: 'job-' + String(index + 1).padStart(3, '0'),
      team,
      kind: training ? 'training' : 'inference',
      arrival,
      gpuCount,
      memoryGiB,
      work,
      priority,
      deadline: arrival + lag,
      maxRetries: training ? 2 : 1,
    };
  });
}
