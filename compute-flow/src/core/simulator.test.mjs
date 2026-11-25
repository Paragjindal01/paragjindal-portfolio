import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLUSTER_PRESETS, comparePolicies, generateWorkload, LIMITS, percentile, recommendPolicy, simulate,
} from './simulator.mjs';

const gpu = (id, config) => ({
  id, memoryGiB: 32, compute: 1, idleWatts: 10, activeWatts: 110, ...config,
});
const node = (id, gpus) => ({ id, gpus });
const lab = (nodes, powerCapWatts = 1000) => ({ name: 'Fixture cluster', powerCapWatts, nodes });
const job = (id, options) => ({
  id, team: 'Research', kind: 'training', arrival: 0, gpuCount: 1, memoryGiB: 8, work: 2, ...options,
});
const gpuOutage = (gpuId, at, duration) => ({ gpuId, at, duration });
const startTimes = (result) => Object.fromEntries(result.jobs.map(({ id, firstStart }) => [id, firstStart]));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' differs from ' + expected);

test('seeded generation is repeatable, ordered, and respects the explicit workload mix', () => {
  const jobs = generateWorkload({ seed: 39, count: 24 });
  assert.deepEqual(jobs, generateWorkload({ seed: 39, count: 24 }));
  assert.notDeepEqual(jobs, generateWorkload({ seed: 40, count: 24 }));
  assert.ok(jobs.every((job, index) => index === 0 || job.arrival >= jobs[index - 1].arrival));
  assert.ok(jobs.every(({ arrival, deadline }) => deadline > arrival));
  assert.ok(generateWorkload({ trainingShare: 1 }).every(({ kind }) => kind === 'training'));
  assert.ok(generateWorkload({ trainingShare: 0 }).every(({ kind }) => kind === 'inference'));
  assert.throws(() => generateWorkload({ seed: -1 }), /unsigned/);
  assert.throws(() => generateWorkload({ count: LIMITS.jobs + 1 }), /Workload size/);
  assert.throws(() => generateWorkload({ teams: ['A', 'A'] }), /distinct/);
});

test('reports mathematically solved queue wait, turnaround, energy, deadline rate, utilization and fairness', () => {
  const cluster = lab([node('a', [gpu('g0')])], 110);
  const jobs = [job('first', { deadline: 2 }), job('next', { team: 'Serving', arrival: 1, deadline: 3 })];
  const { metrics, horizon, teams, series } = simulate({ cluster, jobs });
  assert.equal(horizon, 4);
  assert.equal(metrics.completed, 2);
  assert.equal(metrics.meanWait, 0.5);
  assert.equal(metrics.p50Wait, 0.5);
  assert.equal(metrics.p95Wait, 0.95);
  assert.equal(metrics.maxWait, 1);
  assert.equal(metrics.meanCompletion, 2.5);
  assert.equal(metrics.p95Completion, 2.95);
  assert.equal(metrics.utilization, 1);
  assert.equal(metrics.throughput, 30);
  assert.equal(metrics.deadlineRate, 0.5);
  assert.equal(metrics.deadlinesMet, 1);
  assert.equal(metrics.peakWatts, 110);
  assert.equal(metrics.energyKwh, 440 / 60000);
  assert.equal(metrics.onlineGpuMinutes, 4);
  assert.equal(metrics.busyGpuMinutes, 4);
  assert.equal(metrics.fragmentation, 0);
  near(metrics.fairness, 25 / 26);
  assert.deepEqual(teams.map(({ team, gpuMinutes, demandGpuMinutes }) => [team, gpuMinutes, demandGpuMinutes]),
    [['Research', 2, 2], ['Serving', 2, 3]]);
  assert.deepEqual(series.map(({ time, queueDepth, busyGpus }) => [time, queueDepth, busyGpus]),
    [[0, 0, 1], [1, 1, 1], [2, 0, 1], [4, 0, 0]]);
});

test('percentiles use inclusive type 7 interpolation without mutating observations', () => {
  const sample = [30, 0, 20, 10];
  assert.equal(percentile(sample, 0), 0);
  assert.equal(percentile(sample, 0.5), 15);
  near(percentile(sample, 0.95), 28.5);
  assert.equal(percentile(sample, 1), 30);
  assert.equal(percentile([12], 0.95), 12);
  assert.equal(percentile([], 0.95), null);
  assert.deepEqual(sample, [30, 0, 20, 10]);
});

test('FIFO maintains stable admission order and higher priority overtakes older waiters', () => {
  const cluster = lab([node('a', [gpu('g0')])]);
  const jobs = [
    job('holder', { work: 5 }),
    job('older', { arrival: 1, priority: 1 }),
    job('urgent', { arrival: 2, priority: 10 }),
  ];
  assert.deepEqual(startTimes(simulate({ cluster, jobs })), { holder: 0, older: 5, urgent: 7 });
  assert.deepEqual(startTimes(simulate({ cluster, jobs, policy: 'priority' })), { holder: 0, older: 7, urgent: 5 });
});

test('fair share gives the less-served team preference over a higher-priority job', () => {
  const cluster = lab([node('a', [gpu('g0')])]);
  const jobs = [
    job('holder', { work: 5 }),
    job('served', { arrival: 1, priority: 10 }),
    job('waiting-team', { team: 'Serving', arrival: 1, priority: 2 }),
  ];
  assert.deepEqual(startTimes(simulate({ cluster, jobs, policy: 'fair-share' })),
    { holder: 0, served: 7, 'waiting-team': 5 });
});

test('best fit preserves larger-memory GPUs and first fit retains inventory order', () => {
  const cluster = lab([node('a', [gpu('big', { memoryGiB: 64 }), gpu('small', { memoryGiB: 16 })])]);
  const jobs = [job('small-request'), job('larger-request', { arrival: 1, memoryGiB: 64 })];
  const best = simulate({ cluster, jobs, allocation: 'best-fit' });
  assert.deepEqual(best.jobs.map(({ attempts }) => attempts[0].gpuIds), [['small'], ['big']]);
  assert.deepEqual(startTimes(best), { 'small-request': 0, 'larger-request': 1 });
  const first = simulate({ cluster, jobs, allocation: 'first-fit' });
  assert.deepEqual(first.jobs[0].attempts[0].gpuIds, ['big']);
  assert.equal(first.jobs[1].firstStart, 2);
});

test('gang placement admits a feasible memory and power combination and uses the bottleneck compute rate', () => {
  const adjustable = (id, memoryGiB, compute, watts) => gpu(id, { memoryGiB, compute, activeWatts: 10 + watts });
  const cluster = lab([
    node('a', [adjustable('a0', 12, 4, 90), adjustable('a1', 16, 1, 40), adjustable('a2', 16, 2, 40)]),
    node('b', [adjustable('b0', 8, 4, 10)]),
  ], 140);
  const result = simulate({ cluster, jobs: [job('gang', { gpuCount: 2, work: 8 })] });
  assert.deepEqual(result.jobs[0].attempts[0].gpuIds, ['a2', 'a1']);
  assert.equal(result.jobs[0].completedAt, 4);
  assert.equal(result.metrics.peakWatts, 120);
});

test('GPU repairs respect the power cap throughout the run without treating offline draw as energy use', () => {
  const device = (id) => gpu(id, { idleWatts: 40, activeWatts: 80 });
  const cluster = lab([node('a', [device('g0'), device('g1')])], 130);
  const jobs = [job('one', { work: 5 }), job('two', { arrival: 1, work: 3 })];
  const result = simulate({ cluster, jobs, failures: [gpuOutage('g0', 0, 2)] });
  assert.deepEqual(startTimes(result), { one: 0, two: 5 });
  assert.ok(result.series.every(({ drawWatts }) => drawWatts <= cluster.powerCapWatts));
  assert.deepEqual(result.series.filter(({ time }) => time === 0 || time === 2).map(({ drawWatts }) => drawWatts), [80, 120]);
  assert.equal(result.metrics.energyKwh, (2 * 80 + 6 * 120) / 60000);
  assert.equal(result.metrics.utilization, 8 / 14);
});

test('recovery restarts full work and accounts for interrupted GPU usage and later queue delay', () => {
  const cluster = lab([node('a', [gpu('g0'), gpu('g1')])]);
  const result = simulate({ cluster, jobs: [job('gang', { gpuCount: 2, work: 8 })], failures: [gpuOutage('g0', 1, 2)] });
  const [entry] = result.jobs;
  assert.equal(entry.firstStart, 0);
  assert.equal(entry.queueWait, 2);
  assert.equal(entry.completedAt, 7);
  assert.deepEqual(entry.attempts.map(({ start, end, outcome }) => [start, end, outcome]),
    [[0, 1, 'interrupted'], [3, 7, 'completed']]);
  assert.equal(result.metrics.busyGpuMinutes, 10);
  assert.equal(result.metrics.onlineGpuMinutes, 12);
  assert.equal(result.metrics.meanCompletion, 7);
  assert.equal(result.metrics.meanWait, 2);
  assert.deepEqual(result.events.map(({ type }) => type),
    ['arrival', 'started', 'gpu-failed', 'retry-queued', 'gpu-repaired', 'started', 'completed']);
});

test('simultaneous GPU outages interrupt a gang once and respect exhausted retries', () => {
  const cluster = lab([node('a', [gpu('g0'), gpu('g1')])]);
  const jobs = [job('gang', { gpuCount: 2, work: 20, maxRetries: 0, deadline: 10 })];
  const failures = [gpuOutage('g0', 1, 10), gpuOutage('g1', 1, 10), gpuOutage('g0', 50, 2)];
  const result = simulate({ cluster, jobs, failures });
  assert.equal(result.horizon, 1);
  assert.equal(result.failureCount, 2);
  assert.equal(result.jobs[0].attempts.length, 1);
  assert.equal(result.jobs[0].status, 'failed');
  assert.equal(result.metrics.failed, 1);
  assert.equal(result.metrics.completed, 0);
  assert.equal(result.metrics.deadlineRate, 0);
  assert.equal(result.metrics.meanWait, null);
  assert.equal(result.events.filter(({ type }) => type === 'failed').length, 1);
});

test('completion at a failure timestamp wins and repair then failure can share a timestamp', () => {
  const cluster = lab([node('a', [gpu('g0')])]);
  const jobs = [job('exact'), job('later', { arrival: 3 })];
  const failures = [gpuOutage('g0', 2, 1), gpuOutage('g0', 3, 1)];
  const result = simulate({ cluster, jobs, failures });
  assert.equal(result.jobs[0].completedAt, 2);
  assert.equal(result.jobs[1].firstStart, 4);
  assert.deepEqual(result.events.filter(({ time }) => time === 2).map(({ type }) => type), ['completed', 'gpu-failed']);
  assert.deepEqual(result.events.filter(({ time }) => time === 3).map(({ type }) => type), ['gpu-repaired', 'gpu-failed', 'arrival']);
  assert.equal(result.series.find(({ time }) => time === 3).onlineGpus, 0);
});

test('same-tick trace snapshots reflect only transitions already committed', () => {
  const cluster = lab([node('a', [gpu('g0'), gpu('g1'), gpu('g2')])]);
  const jobs = [job('first', { work: 10 }), job('second', { work: 10 })];
  const result = simulate({ cluster, jobs, failures: [gpuOutage('g2', 0, 10)] });
  const snapshots = result.events.filter(({ time }) => time === 10)
    .map(({ type, runningJobs, busyGpus, onlineGpus, drawWatts }) => [type, runningJobs, busyGpus, onlineGpus, drawWatts]);
  assert.deepEqual(snapshots, [
    ['completed', 1, 1, 2, 120],
    ['completed', 0, 0, 2, 20],
    ['gpu-repaired', 0, 0, 3, 30],
  ]);
  assert.deepEqual(result.series.at(-1), {
    time: 10, queueDepth: 0, runningJobs: 0, onlineGpus: 3, busyGpus: 0, idleGpus: 3, drawWatts: 30, fragmentedGpus: 0,
  });
});

test('conservative backfill starts short work while preserving the FIFO head reservation', () => {
  const cluster = lab([node('a', [gpu('g0'), gpu('g1')])]);
  const jobs = [
    job('holder', { work: 10 }),
    job('head', { arrival: 1, gpuCount: 2, work: 4 }),
    job('short', { arrival: 2, work: 3 }),
    job('long', { arrival: 3, work: 20 }),
  ];
  const fifo = simulate({ cluster, jobs });
  const backfill = simulate({ cluster, jobs, policy: 'backfill' });
  assert.deepEqual(startTimes(fifo), { holder: 0, head: 10, short: 12, long: 12 });
  assert.deepEqual(startTimes(backfill), { holder: 0, head: 10, short: 2, long: 12 });
  assert.equal(backfill.jobs[2].attempts[0].reservationAt, 10);
  assert.equal(backfill.jobs[2].attempts[0].backfilled, true);
});

test('backfill permits a long job on spare devices when it leaves head placement feasible', () => {
  const cluster = lab([
    node('big', [gpu('b0', { memoryGiB: 64 }), gpu('b1', { memoryGiB: 64 })]),
    node('small', [gpu('s0', { memoryGiB: 8 })]),
  ]);
  const jobs = [
    job('holder', { work: 10, memoryGiB: 64 }),
    job('head', { arrival: 1, memoryGiB: 64, gpuCount: 2 }),
    job('spare', { arrival: 2, work: 50 }),
  ];
  const result = simulate({ cluster, jobs, backfill: true });
  assert.deepEqual(startTimes(result), { holder: 0, head: 10, spare: 2 });
  assert.deepEqual(result.jobs[2].attempts[0].gpuIds, ['s0']);
  assert.equal(result.jobs[2].attempts[0].reservationAt, 10);
});

test('fragmentation is idle device time stranded by gang constraints with actual queue demand', () => {
  const cluster = lab([
    node('big', [gpu('b0', { memoryGiB: 64 }), gpu('b1', { memoryGiB: 64 })]),
    node('small', [gpu('s0'), gpu('s1')]),
  ]);
  const jobs = [job('holder', { work: 10, memoryGiB: 64 }), job('big-gang', { arrival: 1, memoryGiB: 64, gpuCount: 2 })];
  const blocked = simulate({ cluster, jobs });
  assert.equal(blocked.series.find(({ time }) => time === 1).fragmentedGpus, 3);
  assert.equal(blocked.metrics.fragmentation, 1);
  const viableOther = simulate({ cluster, jobs: [...jobs, job('small', { arrival: 4 })] });
  assert.equal(viableOther.series.find(({ time }) => time === 4).fragmentedGpus, 0);
  near(viableOther.metrics.fragmentation, 9 / 27);
});

test('marks statically impossible memory, placement and power requests as unschedulable', () => {
  const cluster = lab([node('a', [gpu('g0'), gpu('g1')]), node('b', [gpu('g2')])], 140);
  const jobs = [
    job('memory', { memoryGiB: 64, deadline: 5 }),
    job('multi-node', { gpuCount: 3 }),
    job('watts', { gpuCount: 2 }),
  ];
  const result = simulate({ cluster, jobs });
  assert.equal(result.metrics.unschedulable, 3);
  assert.equal(result.metrics.failed, 0);
  assert.equal(result.metrics.deadlineRate, 0);
  assert.equal(result.metrics.fairness, null);
  assert.equal(result.metrics.fragmentation, 0);
  assert.equal(result.jobs.every(({ attempts, status }) => attempts.length === 0 && status === 'unschedulable'), true);
  assert.equal(recommendPolicy([result]), null);
});

test('rejects malformed input before advancing the clock', () => {
  const cluster = lab([node('a', [gpu('g0')])], 200);
  assert.throws(() => simulate({ cluster: { ...cluster, powerCapWatts: 9 } }), /power cap/);
  assert.throws(() => simulate({ cluster: { ...cluster, nodes: [...cluster.nodes, node('b', [gpu('g0')])] } }), /GPU IDs/);
  assert.throws(() => simulate({ cluster, jobs: [job('a'), job('a')] }), /Job IDs/);
  assert.throws(() => simulate({ cluster, jobs: [job('a', { arrival: 5, deadline: 4 })] }), /precede/);
  assert.throws(() => simulate({ cluster, failures: [gpuOutage('missing', 0, 1)] }), /unknown GPU/);
  assert.throws(() => simulate({ cluster, failures: [gpuOutage('g0', 0, 2), gpuOutage('g0', 1, 2)] }), /overlap/);
  assert.throws(() => simulate({ cluster, policy: 'random' }), /scheduling/);
  assert.throws(() => comparePolicies({ cluster }, ['random']), /Unknown comparison/);
});

test('empty workload preserves a time-zero snapshot and reports undefined metrics honestly', () => {
  const result = simulate({ jobs: [], failures: [gpuOutage('atlas-1-g0', 1, 3)] });
  assert.equal(result.horizon, 0);
  assert.equal(result.events.length, 0);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].time, 0);
  assert.equal(result.metrics.energyKwh, 0);
  assert.equal(result.metrics.meanWait, null);
  assert.equal(result.metrics.deadlineRate, null);
  assert.equal(result.metrics.fairness, null);
  assert.equal(recommendPolicy([result]), null);
});

test('all policies receive identical inputs and sample-level constraints hold under a seeded outage', () => {
  const jobs = generateWorkload({ seed: 42 });
  const input = { cluster: CLUSTER_PRESETS[0], jobs, failures: [gpuOutage('atlas-1-g0', 18, 12)] };
  const original = structuredClone(input);
  const results = comparePolicies(input);
  assert.deepEqual(input, original);
  assert.deepEqual(results, comparePolicies(input));
  assert.deepEqual(results.map(({ policyId }) => policyId), ['fifo', 'priority', 'fair-share', 'backfill']);
  assert.equal(results.every(({ jobs }) => jobs.length === 32), true);
  for (const result of results) {
    assert.ok(result.metrics.peakWatts <= input.cluster.powerCapWatts);
    assert.equal(result.metrics.completed + result.metrics.failed + result.metrics.unschedulable, jobs.length);
    assert.ok(result.series.every((sample, index) => index === 0 || sample.time > result.series[index - 1].time));
    const attempts = result.jobs.flatMap(({ attempts }) => attempts).sort((a, b) => a.start - b.start);
    const releasedAt = new Map();
    for (const attempt of attempts) {
      assert.ok(attempt.end >= attempt.start);
      for (const id of attempt.gpuIds) {
        assert.ok(attempt.start >= (releasedAt.get(id) ?? 0), 'Concurrent use of ' + id);
        releasedAt.set(id, attempt.end);
      }
    }
    const energy = result.series.slice(1).reduce((sum, current, index) => {
      const previous = result.series[index];
      return sum + (current.time - previous.time) * previous.drawWatts;
    }, 0) / 60000;
    near(result.metrics.energyKwh, energy);
  }
  const recommendation = recommendPolicy(results);
  assert.ok(results.some(({ policyId }) => policyId === recommendation.policyId));
  assert.match(recommendation.reason, /completions.*deadlines met.*p95 wait/);
});

test('recommendation describes tied scores and an absent deadline sample', () => {
  const cluster = lab([node('a', [gpu('g0')])]);
  const results = comparePolicies({ cluster, jobs: [job('single')] });
  const recommendation = recommendPolicy(results);
  assert.equal(recommendation.policyId, 'fifo');
  assert.match(recommendation.reason, /shares the best score.*1 completion, no deadline-bearing jobs/);
});

test('placement supports maximum-sized clusters, 32-device gangs, and bounded workloads without enumeration', () => {
  const cluster = lab([node('wide', Array.from({ length: LIMITS.gpus }, (_, index) => gpu('g' + index, {
    memoryGiB: 32 + index % 5,
    idleWatts: 10,
    activeWatts: 80 + index % 3 * 20,
  })))], 4500);
  const jobs = Array.from({ length: LIMITS.jobs }, (_, index) => job('j' + index, {
    arrival: index % 7, gpuCount: index % 2 ? 32 : 16, memoryGiB: 32, work: 320,
  }));
  const failures = Array.from({ length: LIMITS.failures }, (_, index) => gpuOutage('g' + index % LIMITS.gpus, index, 1));
  const result = simulate({ cluster, jobs, failures, policy: 'backfill' });
  assert.equal(result.jobs.length, LIMITS.jobs);
  assert.equal(result.metrics.unschedulable, 0);
  assert.equal(result.metrics.completed + result.metrics.failed, LIMITS.jobs);
  assert.ok(result.metrics.peakWatts <= cluster.powerCapWatts);
});
