import { pathToFileURL } from 'node:url';

const bytesToGiB = (bytes) => Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes / 1024 ** 3 * 100) / 100 : null;
const resourceTypes = new Set(['node', 'qemu', 'lxc', 'storage']);

function inventoryText(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && !/[\p{Cc}\p{Cf}]/u.test(value)
    ? value
    : null;
}

function createSettings(env) {
  const { PROXMOX_URL, PROXMOX_TOKEN_ID, PROXMOX_TOKEN_SECRET } = env;
  if (!PROXMOX_URL || !PROXMOX_TOKEN_ID || !PROXMOX_TOKEN_SECRET) {
    throw new Error('Set PROXMOX_URL, PROXMOX_TOKEN_ID and PROXMOX_TOKEN_SECRET in the local environment.');
  }
  let origin;
  try {
    origin = new URL(PROXMOX_URL);
  } catch {
    throw new Error('PROXMOX_URL must be an HTTPS origin.');
  }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('PROXMOX_URL must be an HTTPS origin with no path, credentials, query or fragment.');
  }
  if (!/^[a-z\d_.-]+@[a-z\d_.-]+![a-z\d_.-]+$/i.test(PROXMOX_TOKEN_ID) || !/^[a-z\d-]+$/i.test(PROXMOX_TOKEN_SECRET)) {
    throw new Error('Proxmox API token settings are invalid.');
  }
  const authorization = 'PVEAPIToken=' + PROXMOX_TOKEN_ID + '=' + PROXMOX_TOKEN_SECRET;
  return { origin, authorization };
}

export async function collectProxmoxInventory(env, { fetcher = fetch, now = Date.now } = {}) {
  const { origin, authorization } = createSettings(env);
  let data;
  try {
    const response = await fetcher(new URL('/api2/json/cluster/resources', origin), {
      method: 'GET',
      headers: { accept: 'application/json', authorization },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Inventory request failed (HTTP ' + response.status + ').');
    ({ data } = await response.json());
  } catch (error) {
    if (error.message.startsWith('Inventory request failed (HTTP ')) throw error;
    throw new Error('Unable to read inventory over the configured HTTPS connection.');
  }
  if (!Array.isArray(data) || data.length > 20_000) throw new Error('Invalid Proxmox inventory response.');
  const resources = data.filter((entry) => entry && resourceTypes.has(entry.type) && inventoryText(entry.id));
  const assets = resources.filter(({ type }) => type !== 'storage').map((asset) => ({
    id: asset.id,
    name: inventoryText(asset.name) ?? inventoryText(asset.node) ?? asset.id,
    type: { node: 'host', qemu: 'vm', lxc: 'container' }[asset.type],
    location: asset.type === 'node' ? 'cluster' : inventoryText(asset.node),
    os: null,
    status: inventoryText(asset.status) ?? 'unknown',
    cpuCores: Number.isSafeInteger(asset.maxcpu) && asset.maxcpu >= 0 ? asset.maxcpu : null,
    memoryGiB: bytesToGiB(asset.maxmem),
    storageGiB: bytesToGiB(asset.maxdisk),
    interfaces: [],
  }));
  const storage = resources.filter(({ type }) => type === 'storage').map((device) => ({
    id: device.id,
    name: inventoryText(device.storage) ?? device.id,
    node: inventoryText(device.node),
    status: inventoryText(device.status) ?? 'unknown',
    capacityGiB: bytesToGiB(device.maxdisk),
    usedGiB: bytesToGiB(device.disk),
  }));
  return { mode: 'local-api', timestamp: new Date(now()).toISOString(), assets, storage };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await collectProxmoxInventory(process.env);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
