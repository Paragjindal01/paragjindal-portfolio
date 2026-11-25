import { CONTACT } from './professional.mjs';

export const GITHUB = CONTACT.github;
export const REPOSITORY = `${GITHUB}/paragjindal-portfolio`;
const DEFINITIONS = [
  { id: 'rackops', name: 'RackOps', file: 'RackOps', area: 'Digital twin', description: 'Walk a fictional data centre, inspect a rack from either side, and trace equipment to its PDU outlets.', stack: 'React · CSS 3D · Simulator', icon: 'rack', simulation: true },
  { id: 'gpuwatch', name: 'GPUWatch', file: 'GPUWatch', area: 'GPU observability', description: 'Explore historical CPU and GPU telemetry, adjust alert thresholds, and export a monitoring report.', stack: 'React · Telemetry series · CSV', icon: 'activity', simulation: true },
  { id: 'powerops', name: 'PowerOps', file: 'PowerOps', area: 'Power distribution', description: 'Review rack demand and phase balance, then safely exercise the simulated outlet control workflow.', stack: 'React · Simulator adapter · Audit', icon: 'power', simulation: true },
  { id: 'infrapilot-ai', name: 'InfraPilot AI', file: 'InfraPilot', area: 'Operations automation', description: 'Ask operational questions, inspect structured tool output, and approve an incident handoff.', stack: 'React · Rule-based tools · Ollama optional', icon: 'spark', simulation: true },
  { id: 'fabriclab', name: 'FabricLab', file: 'FabricLab', area: 'Network planning', description: 'Build an Ethernet or InfiniBand topology, assign ports and VLANs, and validate redundancy.', stack: 'React · Interactive canvas · JSON', icon: 'network', simulation: false },
  { id: 'virtscan', name: 'VirtScan', file: 'VirtScan', area: 'Read-only discovery', description: 'Synchronize hosts, VMs and containers, compare inventory snapshots, and export the results.', stack: 'React · Snapshot diff · Proxmox adapter', icon: 'server', simulation: true },
  { id: 'storagecalc', name: 'StorageCalc', file: 'StorageCalc', area: 'Storage resilience', description: 'Compare replication and erasure coding, model a node outage, and quantify expansion headroom.', stack: 'React · Capacity model · Ceph concepts', icon: 'storage', simulation: false },
  { id: 'localmind', name: 'LocalMind', file: 'LocalMind', area: 'Document retrieval', description: 'Index sample documents, retrieve relevant passages, and trace answers back to their sources.', stack: 'React · Vector retrieval · Ollama optional', icon: 'book', simulation: false },
];

export const LAB_RELEASE = { version: '0.1.0', tag: 'standalone-lab-v0.1.0', simulator: '2.0.0' };
export const STANDALONE_RELEASES = `${REPOSITORY}/releases`;
const WORKFLOW = `${REPOSITORY}/actions/workflows/verify.yml`;
const VERIFICATION = {
  rackops: 'Rack placement and equipment relationships plus browser rack inspection and navigation.',
  gpuwatch: 'Telemetry invariants and browser threshold, filtering, and report workflows.',
  powerops: 'Role, confirmation, reboot, phase, and audit checks plus browser action and report flows.',
  'infrapilot-ai': 'Validated tools, incident archive invariants, and cross-browser PowerOps handoff and replay.',
  fabriclab: 'Topology import, graph validation, cable failures, and browser design export.',
  virtscan: 'Snapshot normalization and change detection, the fixture-tested read-only adapter, and browser synchronization.',
  storagecalc: 'Capacity mathematics, placement constraints, sizing, and browser report workflows.',
  localmind: 'Chunking, retrieval and citations, sample evaluation, and browser document workflows.',
};

const SCREENSHOT_SIZE = {
  'fabriclab': { width: 1050, height: 646 },
  'gpuwatch': { width: 1120, height: 785 },
  'infrapilot-ai': { width: 1050, height: 646 },
  'localmind': { width: 750, height: 675 },
  'powerops': { width: 1120, height: 785 },
  'rackops': { width: 1120, height: 785 },
  'storagecalc': { width: 1050, height: 646 },
  'virtscan': { width: 1120, height: 785 },
};

export const LAB_PROJECTS = DEFINITIONS.map((item) => ({
  ...item,
  version: LAB_RELEASE.version,
  status: 'Interactive demo',
  standaloneRepositoryUrl: null,
  standaloneAsset: `${item.id}-v${LAB_RELEASE.version}.tgz`,
  screenshot: { path: `/lab-screenshots/${item.id}.webp`, alt: `${item.name} running in the engineering lab`, ...SCREENSHOT_SIZE[item.id] },
  links: {
    demo: `/lab/${item.id}`,
    source: `${REPOSITORY}/blob/main/src/lab/apps/${item.file}.jsx`,
    caseStudy: `/case-studies/${item.id}`,
    documentation: `${REPOSITORY}/blob/main/docs/projects/${item.id}.md`,
    verification: WORKFLOW,
  },
  verification: VERIFICATION[item.id],
}));

export const RELAYOPS = {
  id: 'relayops-ai', name: 'RelayOps AI', area: 'Workflow orchestration',
  description: 'Build an executable graph, run it against sample data, inspect every step, and decide whether a simulated action should proceed.',
  stack: 'React · Node.js · SQLite · Docker Compose',
  detail: 'The visual studio shares a validated workflow contract with a local SQLite execution service that retains approvals, retries, and trace events across restarts.',
  version: '0.1.0', status: 'Offline public demo and runnable local service', standaloneRepositoryUrl: null,
  screenshot: { source: 'relayops-ai/docs/screenshots/studio.webp', alt: 'RelayOps AI studio with the Infrastructure Incident Investigator graph', width: 1099, height: 690 },
  links: {
    demo: '/relayops/', source: `${REPOSITORY}/tree/main/relayops-ai`, caseStudy: '/case-studies/relayops-ai',
    documentation: `${REPOSITORY}/blob/main/relayops-ai/README.md`, verification: `${REPOSITORY}/actions/workflows/relayops.yml`,
    benchmark: `${REPOSITORY}/blob/main/relayops-ai/docs/benchmark.md`,
    release: `${REPOSITORY}/releases/tag/relayops-ai-v0.1.0`,
  },
  verification: 'Node and HTTP lifecycle coverage, all four templates in browser tests, signed webhook integration, and Docker Compose verification.',
};

export const ALL_PROJECTS = [RELAYOPS, ...LAB_PROJECTS];
export const findProject = (id) => ALL_PROJECTS.find((project) => project.id === id);
export const FEATURED_LAB_IDS = ['infrapilot-ai', 'rackops', 'gpuwatch', 'powerops', 'localmind', 'fabriclab', 'virtscan', 'storagecalc'];

export const NAVIGATION = [
  ['#about', 'About'], ['#services', 'Expertise'], ['#projects', 'Projects'], ['#experience', 'Experience'], ['#contact', 'Contact'],
];
export const EXPERTISE = [
  ['spark', 'AI product engineering and automation', 'Local inference, retrieval-augmented generation, structured tools, and workflow automation.'],
  ['rack', 'GPU and data centre infrastructure', 'GPU systems, rack visualization, environmental monitoring, PDU telemetry, and asset inventory.'],
  ['network', 'Networks and distributed systems', 'Ethernet and InfiniBand fabrics, VLAN segmentation, virtualization, and capacity planning.'],
  ['server', 'Full-stack engineering', 'Accessible interfaces, typed APIs, relational data, reproducible deployments, and automated testing.'],
];
export const SELECTED_SOFTWARE = [
  { title: 'SafeKelowna', description: 'Community safety platform with map-based reporting, lost-and-found listings, private messaging, and moderation.', tech: 'Next.js · TypeScript · PostgreSQL · Leaflet', url: 'https://safekelowna.com', link: 'Visit website' },
  { title: 'Algorithmic Trading Platform', description: 'Team capstone for preparing market data and serving XGBoost predictions through backend APIs.', tech: 'FastAPI · XGBoost · Docker · Slurm' },
  { title: 'Diagram Data Warehouse', description: 'Educational diagram uploads, metadata, advanced search, API access, and analysis exports.', tech: 'React · GraphQL · PostgreSQL · AWS S3' },
  { title: 'Financial Analytics iOS App', description: 'Mobile development project for financial analytics workflows.', tech: 'Swift · iOS', url: `${GITHUB}/financial-analytic-ios-app`, link: 'View source' },
  { title: 'Cybersecurity Home Lab', description: 'Personal learning and documentation for networking and security fundamentals.', tech: 'Networking · Security fundamentals', url: `${GITHUB}/cybersecurity-home-lab`, link: 'View repository' },
];
