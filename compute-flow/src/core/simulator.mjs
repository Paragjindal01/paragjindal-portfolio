import { countFragmented, findPlacement } from './placement.mjs';
import { CLUSTER_PRESETS, generateWorkload, LIMITS, POLICY_PRESETS } from './scenarios.mjs';

export { CLUSTER_PRESETS, generateWorkload, LIMITS, POLICY_PRESETS };

const clockResolution = 1_000_000;
const time = (value) => Math.round(value * clockResolution) / clockResolution;
const sortNumber = (a, b) => a - b;
const sortText = (a, b) => (a === b ? 0 : a < b ? -1 : 1);
const total = (values) => values.reduce((sum, value) => sum + value, 0);
const mean = (values) => (values.length ? total(values) / values.length : null);
const deadlineSummary = (rate) => rate === null ? 'no deadline-bearing jobs' : (100 * rate).toFixed(1) + '% deadlines met';

function requireValue(condition, message) {
  if (!condition) throw new RangeError(message);
}

function number(value, min, max, name, integer = false) {
  requireValue(Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)),
    name + ' must be ' + (integer ? 'an integer' : 'a number') + ' from ' + min + ' to ' + max + '.');
  return value;
}

function identifier(value, field) {
  requireValue(typeof value === 'string' && value.trim() !== '' && value.length <= 64,
    field + ' must have between 1 and 64 characters.');
  return value;
}

function list(value, max, name, min = 0) {
  requireValue(Array.isArray(value) && value.length >= min && value.length <= max,
    name + ' must contain between ' + min + ' and ' + max + ' entries.');
  return value;
}

function distinct(items, label) {
  requireValue(new Set(items.map((item) => item.id)).size === items.length, label + ' IDs must be unique.');
}

function validateCluster(input) {
  requireValue(input && typeof input === 'object', 'Provide a cluster configuration.');
  const nodes = list(input.nodes, LIMITS.nodes, 'Cluster nodes', 1).map((node) => {
    requireValue(node && typeof node === 'object', 'Every node must be a configuration object.');
    const id = identifier(node.id, 'Node ID');
    const gpus = list(node.gpus, LIMITS.gpus, 'Node GPUs', 1).map((gpu) => {
      requireValue(gpu && typeof gpu === 'object', 'Every GPU must be a configuration object.');
      const idleWatts = number(gpu.idleWatts, 0, 10000, 'Idle GPU watts', true);
      const activeWatts = number(gpu.activeWatts, idleWatts, 10000, 'Active GPU watts', true);
      return {
        id: identifier(gpu.id, 'GPU ID'),
        memoryGiB: number(gpu.memoryGiB, 1, 4096, 'GPU memory'),
        compute: number(gpu.compute, 0.01, 10000, 'GPU compute rating'),
        idleWatts,
        activeWatts,
        extraWatts: activeWatts - idleWatts,
      };
    });
    return { id, gpus };
  });
  const gpus = list(nodes.flatMap((node) => node.gpus), LIMITS.gpus, 'Cluster GPUs', 1);
  distinct(nodes, 'Node');
  distinct(gpus, 'GPU');
  const idleDraw = total(gpus.map((gpu) => gpu.idleWatts));
  const powerCapWatts = number(input.powerCapWatts, Math.max(1, idleDraw), 1_000_000, 'Cluster power cap', true);
  return {
    name: identifier(input.name ?? 'Custom cluster', 'Cluster name'),
    nodes,
    gpus,
    powerCapWatts,
    idleDraw,
  };
}

function validateJobs(input) {
  const jobs = list(input, LIMITS.jobs, 'Jobs').map((job, index) => {
    requireValue(job && typeof job === 'object', 'Every job must be a configuration object.');
    const arrival = time(number(job.arrival, 0, LIMITS.inputMinutes, 'Job arrival'));
    const deadline = job.deadline == null
      ? null
      : time(number(job.deadline, 0, LIMITS.inputMinutes, 'Job deadline'));
    requireValue(deadline === null || deadline >= arrival, 'Job deadlines cannot precede their arrival.');
    requireValue(['training', 'inference'].includes(job.kind), 'Job kind must be training or inference.');
    return {
      id: identifier(job.id, 'Job ID'),
      team: identifier(job.team, 'Job team'),
      kind: job.kind,
      arrival,
      gpuCount: number(job.gpuCount, 1, LIMITS.gpus, 'Requested GPUs', true),
      memoryGiB: number(job.memoryGiB, 1, 4096, 'Job memory per GPU'),
      work: number(job.work, 0.001, 100000, 'Job work'),
      priority: number(job.priority ?? 0, 0, 100, 'Job priority', true),
      deadline,
      maxRetries: number(job.maxRetries ?? 1, 0, 5, 'Job retries', true),
      inputOrder: index,
      status: 'pending',
      firstStart: null,
      completedAt: null,
      terminalAt: null,
      queueWait: 0,
      queueSince: arrival,
      attempts: [],
    };
  });
  distinct(jobs, 'Job');
  return jobs;
}

function validateFailures(input, devices) {
  const failures = list(input, LIMITS.failures, 'GPU outages').map((failure, index) => {
    requireValue(failure && typeof failure === 'object', 'Every GPU outage must be a configuration object.');
    requireValue(devices.has(failure.gpuId), 'An outage references an unknown GPU.');
    const at = time(number(failure.at, 0, LIMITS.inputMinutes, 'Outage time'));
    const duration = time(number(failure.duration, 0.000001, LIMITS.inputMinutes, 'Repair duration'));
    return { gpuId: failure.gpuId, at, repair: time(at + duration), index };
  }).sort((a, b) => a.at - b.at || a.index - b.index);
  const repairs = new Map();
  for (const outage of failures) {
    requireValue(outage.at >= (repairs.get(outage.gpuId) ?? 0), 'Outages cannot overlap on the same GPU.');
    repairs.set(outage.gpuId, outage.repair);
  }
  return failures;
}

const fifoOrder = (a, b) => a.arrival - b.arrival || a.inputOrder - b.inputOrder;
const queueOrder = (a, b) => a.queueSince - b.queueSince || fifoOrder(a, b);

// Hyndman-Fan type 7 interpolation, equivalent to Excel PERCENTILE.INC.
export function percentile(values, probability) {
  number(probability, 0, 1, 'Quantile');
  if (values.length === 0) return null;
  const sorted = [...values].sort(sortNumber);
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

// The event trace reads committed transitions. An explicit clock projects future releases and repairs.
function deviceState(devices, running, at = null) {
  const busy = new Set();
  for (const run of running) {
    if (at === null || run.end > at) for (const gpuId of run.gpuIds) busy.add(gpuId);
  }
  const free = new Set();
  let drawWatts = 0;
  let committedWatts = 0;
  let online = 0;
  for (const device of devices.values()) {
    // Reserve every device's idle draw so a repair can never put running jobs over budget.
    committedWatts += device.idleWatts;
    if (at === null ? device.repairAt > 0 : device.repairAt > at) continue;
    online += 1;
    if (busy.has(device.id)) {
      drawWatts += device.activeWatts;
      committedWatts += device.extraWatts;
    } else {
      drawWatts += device.idleWatts;
      free.add(device.id);
    }
  }
  return { busy: online - free.size, online, drawWatts, committedWatts, free };
}

function publicJob(job) {
  const { inputOrder: _order, queueSince: _queued, ...result } = job;
  return result;
}

export function simulate({
  cluster: inputCluster = CLUSTER_PRESETS[0],
  jobs: inputJobs = [],
  failures: inputFailures = [],
  policy: inputPolicy = 'fifo',
  allocation = 'best-fit',
  backfill: inputBackfill = false,
} = {}) {
  const policy = inputPolicy === 'backfill' ? 'fifo' : inputPolicy;
  const backfill = inputPolicy === 'backfill' || inputBackfill;
  requireValue(['fifo', 'priority', 'fair-share'].includes(policy), 'Choose FIFO, priority, or fair-share scheduling.');
  requireValue(['first-fit', 'best-fit'].includes(allocation), 'Choose first-fit or best-fit resource allocation.');
  requireValue(typeof inputBackfill === 'boolean', 'Backfill must be a boolean.');
  const defaultPreset = POLICY_PRESETS.find((option) => option.policy === policy && option.backfill === backfill);
  const policyId = defaultPreset?.id ?? policy + '+backfill';
  const label = defaultPreset?.label ?? POLICY_PRESETS.find((option) => option.policy === policy).label + ' + backfill';

  const cluster = validateCluster(inputCluster);
  const jobs = validateJobs(inputJobs);
  const arrivals = [...jobs].sort(fifoOrder);
  const devices = new Map(cluster.gpus.map((gpu) => [gpu.id, { ...gpu, repairAt: 0 }]));
  const failures = validateFailures(inputFailures, devices);
  const allGpus = new Set(devices.keys());
  const possible = new Set(jobs.filter((job) =>
    findPlacement(cluster, job, allGpus, cluster.powerCapWatts - cluster.idleDraw, allocation),
  ).map((job) => job.id));
  const teams = new Map(jobs.map((job) => [job.team, {
    team: job.team,
    submitted: 0,
    completed: 0,
    gpuMinutes: 0,
    demandGpuMinutes: 0,
    waits: [],
  }]));
  for (const job of jobs) teams.get(job.team).submitted += 1;

  const events = [];
  const series = [];
  const queue = [];
  const running = new Map();
  const integrals = {
    onlineMinutes: 0, busyMinutes: 0, idleDemandMinutes: 0, fragmentedMinutes: 0, wattMinutes: 0,
  };
  let now = 0;
  let arrivalIndex = 0;
  let failureIndex = 0;
  let terminal = 0;
  let peakWatts = 0;

  const placementAt = (job, allocations, at) => {
    const state = deviceState(devices, allocations, at);
    return findPlacement(cluster, job, state.free, cluster.powerCapWatts - state.committedWatts, allocation);
  };
  const snapshot = (state) => ({
    time: now,
    queueDepth: queue.length,
    runningJobs: running.size,
    onlineGpus: state.online,
    busyGpus: state.busy,
    idleGpus: state.free.size,
    drawWatts: state.drawWatts,
  });
  const emit = (type, fields) => events.push({
    ...snapshot(deviceState(devices, running.values())), type, ...fields,
  });
  function addSample() {
    const state = deviceState(devices, running.values());
    const sample = {
      ...snapshot(state),
      fragmentedGpus: countFragmented(cluster, queue, state.free, cluster.powerCapWatts - state.committedWatts),
    };
    if (series.at(-1)?.time === now) series[series.length - 1] = sample;
    else series.push(sample);
    peakWatts = Math.max(peakWatts, sample.drawWatts);
  }
  function accountInterval(until) {
    const elapsed = until - now;
    if (elapsed === 0) return;
    const last = series.at(-1);
    integrals.onlineMinutes += last.onlineGpus * elapsed;
    integrals.busyMinutes += last.busyGpus * elapsed;
    integrals.wattMinutes += last.drawWatts * elapsed;
    if (queue.length) {
      integrals.idleDemandMinutes += last.idleGpus * elapsed;
      integrals.fragmentedMinutes += last.fragmentedGpus * elapsed;
    }
    for (const { job } of running.values()) {
      const team = teams.get(job.team);
      const gpuMinutes = job.gpuCount * elapsed;
      team.gpuMinutes += gpuMinutes;
      team.demandGpuMinutes += gpuMinutes;
    }
    for (const job of queue) teams.get(job.team).demandGpuMinutes += job.gpuCount * elapsed;
  }

  function enqueue(job) {
    job.status = 'queued';
    job.queueSince = now;
    queue.push(job);
  }

  function finish(run) {
    const { job, attempt } = run;
    running.delete(job.id);
    attempt.end = now;
    attempt.outcome = 'completed';
    job.status = 'completed';
    job.completedAt = now;
    job.terminalAt = now;
    terminal += 1;
    const team = teams.get(job.team);
    team.completed += 1;
    team.waits.push(job.queueWait);
    emit('completed', { jobId: job.id, gpuIds: attempt.gpuIds, attempt: job.attempts.length });
  }

  function failDevice(outage) {
    const device = devices.get(outage.gpuId);
    device.repairAt = outage.repair;
    const interrupted = [...running.values()].find((run) => run.gpuIds.includes(device.id));
    if (interrupted) {
      const { job, attempt } = interrupted;
      running.delete(job.id);
      attempt.end = now;
      attempt.outcome = 'interrupted';
      attempt.failedGpuId = device.id;
    }
    emit('gpu-failed', { gpuId: device.id, repairAt: outage.repair, ...(interrupted && { jobId: interrupted.job.id }) });
    if (!interrupted) return;
    const { job } = interrupted;
    if (job.attempts.length <= job.maxRetries) {
      enqueue(job);
      emit('retry-queued', { jobId: job.id, attempt: job.attempts.length });
    } else {
      job.status = 'failed';
      job.terminalAt = now;
      job.reason = 'Retry budget exhausted after a GPU failure.';
      terminal += 1;
      emit('failed', { jobId: job.id, reason: job.reason });
    }
  }

  function arrive(job) {
    enqueue(job);
    emit('arrival', { jobId: job.id });
    if (possible.has(job.id)) return;
    queue.pop();
    job.status = 'unschedulable';
    job.terminalAt = now;
    terminal += 1;
    job.reason = 'No single node can host this GPU count and per-device memory request within the power cap.';
    emit('unschedulable', { jobId: job.id, reason: job.reason });
  }

  function chooseOrder() {
    if (policy === 'fifo') return queueOrder;
    if (policy === 'priority') return (a, b) => b.priority - a.priority || queueOrder(a, b);

    const inFlight = new Map();
    for (const { job } of running.values()) {
      inFlight.set(job.team, (inFlight.get(job.team) ?? 0) + job.gpuCount);
    }
    const ratio = (job) => {
      const team = teams.get(job.team);
      return team.demandGpuMinutes ? team.gpuMinutes / team.demandGpuMinutes : 0;
    };
    return (a, b) => ratio(a) - ratio(b) || (inFlight.get(a.team) ?? 0) - (inFlight.get(b.team) ?? 0)
      || b.priority - a.priority || queueOrder(a, b);
  }

  function estimatedRun(job, placement) {
    const duration = Math.max(1 / clockResolution, time(job.work / placement.speed));
    return { job, ...placement, end: time(now + duration) };
  }

  function start(run, reservationAt = null) {
    const { job, nodeId, gpuIds, end } = run;
    queue.splice(queue.indexOf(job), 1);
    job.status = 'running';
    job.firstStart ??= now;
    job.queueWait = time(job.queueWait + now - job.queueSince);
    const attempt = {
      start: now,
      end: null,
      projectedEnd: end,
      nodeId,
      gpuIds,
      outcome: null,
      backfilled: reservationAt !== null,
      reservationAt,
    };
    job.attempts.push(attempt);
    running.set(job.id, { ...run, attempt });
    emit('started', { jobId: job.id, gpuIds, nodeId, attempt: job.attempts.length, projectedEnd: end,
      backfilled: attempt.backfilled, reservationAt });
  }

  function dispatch() {
    while (queue.length) {
      const order = [...queue].sort(chooseOrder());
      const head = order[0];
      const active = [...running.values()];
      const direct = placementAt(head, active, now);
      if (direct) {
        start(estimatedRun(head, direct));
        continue;
      }
      if (!backfill || order.length < 2) return;

      // Preserve the head's first feasible start from active end times and current repairs.
      const changes = new Set([
        ...active.map((run) => run.end),
        ...[...devices.values()].map((gpu) => gpu.repairAt).filter((repairAt) => repairAt > now),
      ]);
      const reservationAt = [...changes].sort(sortNumber)
        .find((change) => placementAt(head, active, change));
      if (reservationAt === undefined) return;
      let usedSpareCapacity = false;
      for (const candidate of order.slice(1)) {
        const placement = placementAt(candidate, active, now);
        if (!placement) continue;
        const run = estimatedRun(candidate, placement);
        if (run.end > reservationAt && !placementAt(head, [...active, run], reservationAt)) continue;
        start(run, reservationAt);
        usedSpareCapacity = true;
        break;
      }
      if (!usedSpareCapacity) return;
    }
  }

  addSample();
  while (terminal < jobs.length) {
    const next = Math.min(
      arrivals[arrivalIndex]?.arrival ?? Infinity,
      failures[failureIndex]?.at ?? Infinity,
      ...[...devices.values()].map((gpu) => gpu.repairAt > now ? gpu.repairAt : Infinity),
      ...[...running.values()].map((run) => run.end),
    );
    if (!Number.isFinite(next)) throw new Error('Simulation reached a queue with no schedulable future event.');
    accountInterval(next);
    now = next;

    // At an identical clock tick, finish work first, then repair, inject failures, admit and dispatch.
    for (const run of running.values()) if (run.end === now) finish(run);
    for (const device of devices.values()) {
      if (now > 0 && device.repairAt === now) {
        device.repairAt = 0;
        emit('gpu-repaired', { gpuId: device.id });
      }
    }
    while (failures[failureIndex]?.at === now) failDevice(failures[failureIndex++]);
    while (arrivals[arrivalIndex]?.arrival === now) arrive(arrivals[arrivalIndex++]);
    dispatch();
    addSample();
  }

  const completed = jobs.filter((job) => job.status === 'completed');
  const waits = completed.map((job) => job.queueWait);
  const turnaround = completed.map((job) => time(job.completedAt - job.arrival));
  const deadlineJobs = jobs.filter((job) => job.deadline !== null).length;
  const deadlinesMet = completed.filter((job) => job.deadline !== null && job.completedAt <= job.deadline).length;
  const teamResults = [...teams.values()].sort((a, b) => sortText(a.team, b.team)).map((team) => ({
    team: team.team,
    submitted: team.submitted,
    completed: team.completed,
    meanWait: mean(team.waits),
    gpuMinutes: team.gpuMinutes,
    demandGpuMinutes: team.demandGpuMinutes,
    serviceRatio: team.demandGpuMinutes === 0 ? null : team.gpuMinutes / team.demandGpuMinutes,
  }));
  const ratios = teamResults.map((team) => team.serviceRatio).filter((value) => value !== null);
  const serviceSquares = total(ratios.map((ratio) => ratio * ratio));
  return {
    policyId, label, policy, allocation, backfill,
    cluster: { name: cluster.name, powerCapWatts: cluster.powerCapWatts, nodes: cluster.nodes },
    horizon: now,
    failureCount: failureIndex,
    jobs: jobs.map(publicJob),
    events,
    series,
    teams: teamResults,
    metrics: {
      submitted: jobs.length,
      completed: completed.length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      unschedulable: jobs.filter((job) => job.status === 'unschedulable').length,
      meanWait: mean(waits),
      p50Wait: percentile(waits, 0.50),
      p95Wait: percentile(waits, 0.95),
      maxWait: waits.length ? Math.max(...waits) : null,
      meanCompletion: mean(turnaround),
      p95Completion: percentile(turnaround, 0.95),
      turnaroundSamples: turnaround.length,
      utilization: integrals.onlineMinutes ? integrals.busyMinutes / integrals.onlineMinutes : 0,
      throughput: now ? completed.length * 60 / now : 0,
      deadlineJobs,
      deadlinesMet,
      deadlineRate: deadlineJobs ? deadlinesMet / deadlineJobs : null,
      fragmentation: integrals.idleDemandMinutes ? integrals.fragmentedMinutes / integrals.idleDemandMinutes : 0,
      energyKwh: integrals.wattMinutes / 60000,
      fairness: serviceSquares ? total(ratios) ** 2 / (ratios.length * serviceSquares) : null,
      peakWatts,
      busyGpuMinutes: integrals.busyMinutes,
      onlineGpuMinutes: integrals.onlineMinutes,
    },
  };
}

export function comparePolicies(input, policies = POLICY_PRESETS) {
  return policies.map((preset) => {
    const { policy, allocation, backfill, id, label } = typeof preset === 'string'
      ? POLICY_PRESETS.find((option) => option.id === preset) ?? {}
      : preset;
    requireValue(typeof policy === 'string', 'Unknown comparison policy.');
    const result = simulate({ ...input, policy, allocation, backfill });
    return { ...result, policyId: id ?? result.policyId, label: label ?? result.label };
  });
}

export function recommendPolicy(results) {
  if (!results.some(({ metrics }) => metrics.completed > 0)) return null;
  const highestWait = Math.max(1, ...results.map(({ metrics }) => metrics.p95Wait ?? 0));
  const highestEnergy = Math.max(1e-9, ...results.map(({ metrics }) => metrics.energyKwh));
  const rank = (m) => 0.30 * (m.completed / m.submitted)
    + 0.26 * (m.deadlineRate ?? m.completed / m.submitted)
    + 0.19 * (m.p95Wait === null ? 0 : 1 - m.p95Wait / highestWait)
    + 0.15 * (m.fairness ?? 0)
    + 0.10 * (1 - m.energyKwh / highestEnergy);
  const ranked = [...results].sort((a, b) => rank(b.metrics) - rank(a.metrics));
  const [winner, runnerUp] = ranked;
  const m = winner.metrics;
  const wait = m.p95Wait === null ? 'unmeasured p95 wait' : m.p95Wait.toFixed(1) + ' min p95 wait';
  const tied = runnerUp && Math.abs(rank(m) - rank(runnerUp.metrics)) < 1e-12;
  const tradeoffs = [];
  if (runnerUp) {
    const alternate = runnerUp.metrics;
    tradeoffs.push(runnerUp.label + ' recorded ' + alternate.completed + ' completions, '
      + deadlineSummary(alternate.deadlineRate) + ', and ' + alternate.energyKwh.toFixed(3) + ' kWh.');
  }
  tradeoffs.push('Scoring weights completions 30%, deadlines 26%, p95 wait 19%, fairness 15%, and GPU energy 10%.');
  return {
    policyId: winner.policyId,
    label: winner.label,
    reason: winner.label + (tied ? ' shares the best score and is listed first. It recorded ' : ' led this comparison with ')
      + m.completed + (m.completed === 1 ? ' completion, ' : ' completions, ') + deadlineSummary(m.deadlineRate) + ', and ' + wait + '.',
    tradeoffs,
  };
}
