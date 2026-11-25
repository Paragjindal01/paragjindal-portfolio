import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';
import ProjectCard from './ProjectCard';

const projects = [
  {
    title: 'SafeKelowna — Community Safety Platform',
    featured: true,
    liveUrl: 'https://safekelowna.com',
    description:
      'A production community platform for Kelowna and the Central Okanagan featuring an interactive safety map, community alerts, lost-and-found listings, location-based incident reporting, private messaging, user verification, moderation workflows, reputation features, and privacy-focused reporting.',
    details: [
      'Interactive safety map with location-based incident reporting',
      'Community alerts and lost-and-found listings',
      'Private messaging and user verification',
      'Moderation workflows, approval queues, and reputation features',
      'Privacy-focused reporting for the Central Okanagan community',
    ],
    tags: ['Next.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Leaflet', 'Vercel'],
  },
  {
    title: 'Algorithmic Trading Platform — Backend & ML Serving',
    description:
      'A backend and machine-learning serving platform for processing live and historical market data, preparing model inputs, and delivering XGBoost prediction outputs through FastAPI services.',
    tags: ['Python', 'FastAPI', 'XGBoost', 'PostgreSQL', 'Docker', 'Git', 'Slurm'],
  },
  {
    title: 'Diagram Data Warehouse',
    description:
      'A full-stack educational diagram platform supporting uploads, advanced search, metadata management, cloud storage, REST and GraphQL APIs, data analysis, and CSV exports.',
    tags: ['React', 'Node.js', 'Express.js', 'GraphQL', 'PostgreSQL', 'MongoDB Atlas', 'AWS S3', 'CloudFront'],
  },
];

const infrastructureProjects = [
  {
    "title": "RackOps — Data centre digital twin",
    "description": "Interactive rack inventory, equipment visualization and environmental monitoring.",
    "tags": [
      "React",
      "Three.js",
      "FastAPI",
      "PostgreSQL"
    ],
    "status": "Planned"
  },
  {
    "title": "GPUWatch — GPU observability",
    "description": "GPU utilization, temperature, VRAM and power telemetry. Synthetic GPU metrics already exist in the shared lab.",
    "tags": [
      "Python",
      "NVML",
      "Prometheus",
      "Grafana"
    ],
    "status": "Lab foundation"
  },
  {
    "title": "PowerOps — Intelligent power management",
    "description": "PDU outlet telemetry, rack power budgets and simulated switching. Synthetic outlet readings already exist in the shared lab.",
    "tags": [
      "Python",
      "SNMP",
      "FastAPI",
      "React"
    ],
    "status": "Lab foundation"
  },
  {
    "title": "InfraPilot AI — Infrastructure automation",
    "description": "Planned AI-assisted inventory analysis, incident summaries and operational recommendations. The shared lab currently provides deterministic rule-based reports, not an LLM agent.",
    "tags": [
      "Python",
      "Tool calling",
      "FastAPI",
      "Ollama"
    ],
    "status": "Lab foundation"
  },
  {
    "title": "FabricLab — Network architecture",
    "description": "Network topology, port mapping, VLAN planning and redundancy validation.",
    "tags": [
      "Next.js",
      "TypeScript",
      "React Flow"
    ],
    "status": "Planned"
  },
  {
    "title": "VirtScan — Infrastructure discovery",
    "description": "Read-only discovery of virtual machines, containers and server resources.",
    "tags": [
      "Python",
      "Proxmox API",
      "Docker"
    ],
    "status": "Planned"
  },
  {
    "title": "StorageCalc — Distributed storage planning",
    "description": "Replication, usable storage capacity and failure scenario planning.",
    "tags": [
      "Python",
      "TypeScript",
      "Ceph concepts"
    ],
    "status": "Planned"
  },
  {
    "title": "LocalMind — Private AI knowledge platform",
    "description": "Local document processing, semantic retrieval, citations and retrieval evaluation.",
    "tags": [
      "Ollama",
      "ChromaDB",
      "FastAPI",
      "React"
    ],
    "status": "Planned"
  }
];
const labPrototype = {
  "title": "Infrastructure Lab — Server & PDU Simulator",
  "status": "Working prototype",
  "description": "An independent deterministic simulator with synthetic server inventory, GPU and CPU telemetry, PDU outlet measurements, power totals and read-only rule-based health reports.",
  "tags": [
    "JavaScript",
    "Node.js",
    "Telemetry",
    "Unit tests"
  ],
  "repoUrl": "https://github.com/Paragjindal01/Paragjindal01/tree/main/labs/infra-sim",
  "details": [
    "Three fictional racks, six servers and three PDUs",
    "Deterministic synthetic telemetry and thermal warning scenarios",
    "Power reconciliation and automated invariant tests",
    "No production connections or real hardware control"
  ]
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

export default function ProjectsSection() {
  const featured = projects.find((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  return (
    <SectionWrapper id="projects">
      <div className="text-center mb-16">
        <h2 className="section-title">
          Featured <span className="text-[var(--color-accent-blue)]">Projects</span>
        </h2>
        <p className="section-subtitle">
          A selection of projects that showcase my engineering capabilities.
        </p>
      </div>

      <div className="max-w-7xl mx-auto mb-16 space-y-6">
        <h3 className="text-2xl font-bold">Independent infrastructure engineering lab</h3>
        <p className="text-[var(--color-text-secondary)] max-w-3xl">Original personal projects using fictional environments and public documentation. Planned capabilities are not represented as completed products. No proprietary employer code, real customer data or production infrastructure configurations are included.</p>
        <motion.div initial="visible" animate="visible"><ProjectCard project={labPrototype} index={0} featured /></motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {infrastructureProjects.map((project, i) => (
            <motion.div key={project.title} initial="visible" animate="visible"><ProjectCard project={project} index={i + 1} /></motion.div>
          ))}
        </div>
        <h3 className="text-2xl font-bold pt-8">Selected software projects</h3>
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="max-w-7xl mx-auto space-y-6 lg:space-y-8"
      >
        {/* Featured project — full width */}
        {featured && <ProjectCard project={featured} index={0} featured />}

        {/* Remaining projects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {rest.map((project, i) => (
            <ProjectCard key={project.title} project={project} index={i + 1} />
          ))}
        </div>
      </motion.div>
    </SectionWrapper>
  );
}
