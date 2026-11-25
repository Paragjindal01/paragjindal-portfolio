function compareValues(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

// Each row gives the cheapest total watts for every feasible crew size in that suffix.
// This is linear in GPU count times crew size and never enumerates device combinations.
function suffixPower(gpus, crewSize) {
  const required = Array.from({ length: gpus.length + 1 }, () => Array(crewSize + 1).fill(Infinity));
  required[gpus.length][0] = 0;
  for (let index = gpus.length - 1; index >= 0; index -= 1) {
    const next = required[index + 1];
    const row = required[index];
    row[0] = 0;
    for (let count = 1; count <= Math.min(crewSize, gpus.length - index); count += 1) {
      row[count] = Math.min(next[count], gpus[index].extraWatts + next[count - 1]);
    }
  }
  return required;
}

export function findPlacement(cluster, job, freeGpus, availableWatts, allocation = 'best-fit') {
  let best = null;
  for (const node of cluster.nodes) {
    const eligible = node.gpus.filter((gpu) => freeGpus.has(gpu.id) && gpu.memoryGiB >= job.memoryGiB);
    if (eligible.length < job.gpuCount) continue;
    if (allocation === 'best-fit') {
      eligible.sort((a, b) => compareValues(
        [a.memoryGiB, -a.compute, a.extraWatts, a.id],
        [b.memoryGiB, -b.compute, b.extraWatts, b.id],
      ));
    }
    const power = suffixPower(eligible, job.gpuCount);
    if (power[0][job.gpuCount] > availableWatts) continue;

    const chosen = [];
    let extraWatts = 0;
    for (const [index, gpu] of eligible.entries()) {
      const remaining = job.gpuCount - chosen.length - 1;
      if (extraWatts + gpu.extraWatts + power[index + 1][remaining] > availableWatts) continue;
      extraWatts += gpu.extraWatts;
      chosen.push(gpu);
      if (chosen.length === job.gpuCount) break;
    }

    const speed = job.gpuCount * Math.min(...chosen.map((gpu) => gpu.compute));
    const placement = { nodeId: node.id, gpuIds: chosen.map((gpu) => gpu.id), speed, extraWatts };
    if (allocation === 'first-fit') return placement;
    const memoryWaste = chosen.reduce((sum, gpu) => sum + gpu.memoryGiB - job.memoryGiB, 0);
    const score = [memoryWaste, eligible.length - job.gpuCount, -speed, extraWatts, node.id];
    if (!best || compareValues(score, best.score) < 0) best = { ...placement, score };
  }
  return best;
}

// An idle GPU contributes if it can belong to any complete, power-feasible queued placement.
export function countFragmented(cluster, queue, freeGpus, availableWatts) {
  if (queue.length === 0 || freeGpus.size === 0) return 0;
  const usable = new Set();
  const demands = new Map(queue.map((job) => [job.gpuCount + ':' + job.memoryGiB, job]));
  for (const node of cluster.nodes) {
    const idle = node.gpus.filter((gpu) => freeGpus.has(gpu.id)).sort((a, b) => a.extraWatts - b.extraWatts);
    for (const job of demands.values()) {
      const eligible = idle.filter((gpu) => gpu.memoryGiB >= job.memoryGiB);
      if (eligible.length < job.gpuCount) continue;
      const peersNeeded = job.gpuCount - 1;
      const cheapestPeers = eligible.slice(0, peersNeeded).reduce((total, gpu) => total + gpu.extraWatts, 0);
      for (const [index, gpu] of eligible.entries()) {
        const peerCost = index < peersNeeded
          ? cheapestPeers + eligible[peersNeeded].extraWatts - gpu.extraWatts
          : cheapestPeers;
        if (peerCost + gpu.extraWatts <= availableWatts) usable.add(gpu.id);
      }
    }
  }
  return freeGpus.size - usable.size;
}
