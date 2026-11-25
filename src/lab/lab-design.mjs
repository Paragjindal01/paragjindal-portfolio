import { ALL_PROJECTS } from '../data/projects.mjs';

const design = [
  ['relayops-ai', 'RO', 'Orchestration', 'world/hall-05-poster.jpg', 'Multi-agent workflow graphs, provider integrations and execution tracking.'],
  ['rackops', 'RK', 'Digital twin', 'world/hall-02-poster.jpg', 'Walk a fictional hall, inspect a rack from either side, trace every unit to its outlet.'],
  ['gpuwatch', 'GW', 'Observability', 'world/hall-03-poster.jpg', 'Utilisation, temperature, memory and power across a GPU fleet, with thresholds you can move.'],
  ['powerops', 'PO', 'Power', 'world/hall-04-poster.jpg', 'Phase balance, rack demand and an outlet control workflow with a full audit trail.'],
  ['infrapilot-ai', 'IP', 'Automation', 'world/hall-05-poster.jpg', 'Ask operational questions, inspect tool output, approve an incident handoff.'],
  ['fabriclab', 'FL', 'Network', 'img/tower.jpg', 'Build Ethernet or InfiniBand topology, assign ports and VLANs, test the redundancy.'],
  ['virtscan', 'VS', 'Discovery', 'img/ep-02.jpg', 'Synchronise hosts, VMs and containers, then diff two inventory snapshots.'],
  ['storagecalc', 'SC', 'Storage', 'img/ep-01.jpg', 'Compare replication against erasure coding, model a node outage, quantify the headroom.'],
  ['localmind', 'LM', 'Retrieval', 'img/ep-03.jpg', 'Index documents, retrieve passages, and trace each answer back to its source.'],
  ['compute-flow', 'CF', 'Scheduling', 'img/ep-04.jpg', 'Compare GPU scheduling policies on one workload and replay queue decisions.'],
];

export const LAB_TOOLS = design.map(([id, code, category, art, caption], index) => ({
  ...ALL_PROJECTS.find((project) => project.id === id),
  code,
  category,
  art: `/assets/${art}`,
  preview: `/lab-previews/${id}.webp`,
  caption,
  number: String(index + 1).padStart(2, '0'),
}));

export function toolHref(tool, scenario) {
  const { demo } = tool.links;
  return scenario === 'normal' || !demo.startsWith('/lab/') ? demo : `${demo}?scenario=${scenario}`;
}
