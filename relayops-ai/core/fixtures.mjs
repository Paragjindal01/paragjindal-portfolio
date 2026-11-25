export const sampleRepository = {
  mode: 'fixture',
  name: 'example-service',
  fullName: 'relayops-example/example-service',
  language: 'JavaScript',
  description: 'Fictional inventory service used to demonstrate an engineering review.',
  files: ['README.md', 'package.json', 'src', 'tests'],
  evidence: [
    { id: 'repo-readme', title: 'Sample README.md', path: 'README.md', text: 'Example Inventory API. Run npm start to launch the local service. Set INVENTORY_REGION to a fictional region.' },
    { id: 'repo-manifest', title: 'Sample package.json', path: 'package.json', text: '{"name":"example-service","type":"module","scripts":{"start":"node src/server.mjs","test":"node --test"}}' },
    { id: 'repo-source', title: 'Sample src/server.mjs', path: 'src/server.mjs', text: 'import { createServer } from "node:http";\ncreateServer((request, response) => response.end(JSON.stringify({ service: "example-inventory", status: "ok" })));' },
  ],
};

export const repositoryInput = { repositoryUrl: 'https://github.com/relayops-example/example-service' };

export const researchQuestion = 'How can an operations team use traces and postmortems to make infrastructure incidents reproducible?';
export const researchSources = [
  {
    id: 'otel-traces', title: 'OpenTelemetry documentation: Traces', url: 'https://opentelemetry.io/docs/concepts/signals/traces/',
    passage: 'A distributed trace describes how one request progresses through a system. Each span describes an individual operation. Parent-child relationships and trace context let a reader reconstruct how operations connect.',
    keywords: 'telemetry observability infrastructure trace traces incidents reproducible spans context',
  },
  {
    id: 'sre-postmortems', title: 'Google SRE Book: Postmortem Culture', url: 'https://sre.google/sre-book/postmortem-culture/',
    passage: 'An incident postmortem records what happened, the impact, actions taken to resolve the incident, and actions that can prevent it happening again. Keeping reviews blameless supports learning and candid reporting.',
    keywords: 'incident incidents operations infrastructure postmortems postmortem review incident timeline reproducible',
  },
  {
    id: 'sre-incidents', title: 'Google SRE Book: Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/',
    passage: 'A clear incident command structure assigns responsibility for coordination, operations, and communication. A shared incident state document keeps information available as responders join and responsibilities change.',
    keywords: 'operations infrastructure incidents incident coordination response command reproducible actions',
  },
];

export const datasetInput = {
  format: 'csv',
  dataset: 'interval,requests,errorRate,latencyMs\n08:00,1200,0.8,96\n08:15,1250,0.7,102\n08:30,1180,0.9,91\n08:45,1340,0.8,106\n09:00,1270,0.9,98\n09:15,1300,5.6,245\n09:30,1210,1.1,109\n09:45,1240,0.8,104',
};

export const incidentInput = {
  synthetic: true,
  incidentId: 'LAB-INC-014',
  telemetry: [
    { minute: 0, asset: 'LAB-GPU-04', serverCpuPct: 46, gpuC: 61, powerPct: 59, networkPct: 52 },
    { minute: 5, asset: 'LAB-GPU-04', serverCpuPct: 53, gpuC: 69, powerPct: 65, networkPct: 58 },
    { minute: 10, asset: 'LAB-GPU-04', serverCpuPct: 87, gpuC: 85, powerPct: 88, networkPct: 92 },
    { minute: 15, asset: 'LAB-GPU-04', serverCpuPct: 93, gpuC: 94, powerPct: 96, networkPct: 91 },
    { minute: 20, asset: 'LAB-GPU-04', serverCpuPct: 75, gpuC: 85, powerPct: 85, networkPct: 68 },
    { minute: 25, asset: 'LAB-GPU-04', serverCpuPct: 48, gpuC: 71, powerPct: 65, networkPct: 61 },
  ],
};
