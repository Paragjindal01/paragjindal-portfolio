export const inventoryTypes = ['host', 'vm', 'container'];

export function inventoryFromSnapshot(snapshot) {
  const hosts = snapshot.servers.map((server) => ({
    id: server.id,
    name: server.name,
    type: 'host',
    location: server.rackId,
    os: server.os,
    status: server.status,
    cpuCores: server.cpuCores,
    memoryGiB: server.memoryTotalGiB,
    storageGiB: Math.round(server.storageTotalTB * 1000 ** 4 / 1024 ** 3),
    interfaces: server.interfaces.map(({ name, ip, mac, speedGbps }) => ({ name, ip, mac, speedGbps })),
  }));
  const workloads = snapshot.workloads.map((workload) => ({
    id: workload.id,
    name: workload.name,
    type: workload.type,
    location: workload.hostId,
    os: workload.os,
    status: workload.status,
    cpuCores: workload.cpuCores,
    memoryGiB: workload.memoryGiB,
    storageGiB: workload.storageGiB,
    interfaces: [{ name: 'virt-net0', ip: workload.ip, mac: workload.mac }],
  }));
  return { mode: 'simulation', timestamp: snapshot.timestamp, scenario: snapshot.scenario, assets: [...hosts, ...workloads] };
}

export function compareInventory(previous, current) {
  const before = new Map(previous.assets.map((asset) => [asset.id, asset]));
  const after = new Map(current.assets.map((asset) => [asset.id, asset]));
  const changes = [];
  for (const asset of after.values()) {
    const older = before.get(asset.id);
    if (!older) {
      changes.push({ id: asset.id, name: asset.name, type: 'Added', detail: asset.type });
      continue;
    }
    const fields = Object.keys(asset).filter((key) => JSON.stringify(asset[key]) !== JSON.stringify(older[key]));
    if (fields.length) {
      const detail = fields.map((key) => key === 'status' ? older.status + ' → ' + asset.status : key).join(', ');
      changes.push({ id: asset.id, name: asset.name, type: 'Changed', detail });
    }
  }
  for (const asset of before.values()) {
    if (!after.has(asset.id)) changes.push({ id: asset.id, name: asset.name, type: 'Removed', detail: asset.type });
  }
  return changes;
}

export function filterInventory(assets, { query = '', type = '', status = '' } = {}) {
  const term = query.trim().toLowerCase();
  return assets.filter((asset) => {
    if (type && asset.type !== type) return false;
    if (status && asset.status !== status) return false;
    const searchable = [asset.id, asset.name, asset.location, asset.os, ...asset.interfaces.flatMap((item) => [item.name, item.ip, item.mac])];
    return searchable.some((value) => String(value ?? '').toLowerCase().includes(term));
  });
}
