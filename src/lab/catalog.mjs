export const GITHUB = 'https://github.com/Paragjindal01';
export const REPOSITORY = `${GITHUB}/paragjindal-portfolio`;
export const LAB_PROJECTS = [
  { id: 'rackops', name: 'RackOps', file: 'RackOps', area: 'Digital twin', description: 'Walk a fictional data centre, inspect a rack from either side, and trace equipment to its PDU outlets.', stack: 'React · CSS 3D · Simulator', icon: 'rack', simulation: true },
  { id: 'gpuwatch', name: 'GPUWatch', file: 'GPUWatch', area: 'GPU observability', description: 'Explore historical CPU and GPU telemetry, adjust alert thresholds, and export a monitoring report.', stack: 'React · Telemetry series · CSV', icon: 'activity', simulation: true },
  { id: 'powerops', name: 'PowerOps', file: 'PowerOps', area: 'Power distribution', description: 'Review rack demand and phase balance, then safely exercise the simulated outlet control workflow.', stack: 'React · Simulator adapter · Audit', icon: 'power', simulation: true },
  { id: 'infrapilot-ai', name: 'InfraPilot AI', file: 'InfraPilot', area: 'Operations automation', description: 'Ask operational questions, inspect structured tool output, and approve an incident handoff.', stack: 'React · Rule-based tools · Ollama optional', icon: 'spark', simulation: true },
  { id: 'fabriclab', name: 'FabricLab', file: 'FabricLab', area: 'Network planning', description: 'Build an Ethernet or InfiniBand topology, assign ports and VLANs, and validate redundancy.', stack: 'React · Interactive canvas · JSON', icon: 'network', simulation: false },
  { id: 'virtscan', name: 'VirtScan', file: 'VirtScan', area: 'Read-only discovery', description: 'Synchronize hosts, VMs and containers, compare inventory snapshots, and export the results.', stack: 'React · Snapshot diff · Proxmox adapter', icon: 'server', simulation: true },
  { id: 'storagecalc', name: 'StorageCalc', file: 'StorageCalc', area: 'Storage resilience', description: 'Compare replication and erasure coding, model a node outage, and quantify expansion headroom.', stack: 'React · Capacity model · Ceph concepts', icon: 'storage', simulation: false },
  { id: 'localmind', name: 'LocalMind', file: 'LocalMind', area: 'Document retrieval', description: 'Index sample documents, retrieve relevant passages, and trace answers back to their sources.', stack: 'React · Vector retrieval · Ollama optional', icon: 'book', simulation: false },
];
