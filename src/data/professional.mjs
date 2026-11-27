export const CONTACT = {
  name: 'Parag Jindal',
  email: 'paragjindal023@gmail.com',
  website: 'https://paragjindal.com',
  github: 'https://github.com/Paragjindal01',
  linkedin: 'https://www.linkedin.com/in/parag-jindal-604b41320/',
  instagram: 'https://www.instagram.com/paragjindal23/',
  city: 'Ottawa',
  province: 'Ontario',
  country: 'Canada',
};

export const POSITIONING = 'AI Product Engineering · Intelligent Automation · Full-Stack Development · GPU Infrastructure';
export const BRAND_STATEMENT = 'Building Intelligence. Engineering What Powers It.';

export const EMPLOYMENT = [
  {
    id: 'altaai',
    organization: 'AltaAI Inc.',
    roles: [
      {
        title: 'AI & Information Systems Specialist',
        from: '2026-09',
        to: null,
        employmentType: 'Permanent full-time',
        workplace: 'On-site',
        location: 'Ottawa, Ontario, Canada',
        summary: 'Develop AI-assisted infrastructure operations and internal software. Contribute to GPU and high-performance computing deployment planning and validation.',
        highlights: [
          'Build agent and API workflows to collect, normalize, and analyze infrastructure data. Develop internal integrations, operational reporting, and business process automation.',
          'Develop DCIM capabilities for asset hierarchy, interactive 2D and 3D rack inspection, equipment discovery, VM and container inventory, resource and environmental telemetry, and PDU monitoring. Design role-based access and audit logging for sensitive workflows.',
          'Plan GPU architecture, management and control servers, equipment integration, and validation. Evaluate management networks, VLANs, port mapping, and redundant Ethernet and InfiniBand designs.',
          'Plan shared Ceph storage with replication, capacity headroom, and failure domains. Use read-only Proxmox integrations, React and Next.js, Python and Node.js, REST and GraphQL, PostgreSQL, Docker, documentation, and automated testing.',
        ],
      },
      {
        title: 'AI Product Engineer',
        from: '2026-05',
        to: '2026-09',
        employmentType: 'Permanent part-time',
        workplace: 'Remote',
        location: null,
        summary: 'Developed internal AI products and productivity tools across retrieval, backend services, and business workflow automation.',
        highlights: [
          'Developed self-hosted retrieval and semantic search workflows with FastAPI, Ollama, and ChromaDB. Worked on PostgreSQL migration and self-hosted database infrastructure.',
          'Built LinkedIn workflow integrations for scheduled comment monitoring, AI-assisted response drafts, and content generation. Used Node.js and OAuth2 for integration work.',
          'Implemented API authentication, input validation, and rate limiting. Troubleshot GPU, CUDA, and Docker environments for local AI development.',
        ],
      },
    ],
  },
  {
    id: 'best-buy',
    organization: 'Best Buy / Geek Squad',
    roles: [{
      title: 'Field Service Agent', from: '2026-04', to: '2026-09', employmentType: 'Permanent full-time', workplace: 'On-site',
      location: 'Kelowna, British Columbia, Canada',
      summary: 'Diagnosed and resolved hardware, software, Wi-Fi, and peripheral issues in field service. Installed and configured devices and communicated fixes to customers.',
    }],
  },
  {
    id: 'okanagan-college',
    organization: 'Okanagan College',
    roles: [{
      title: 'Student Employee — Peer Support and Athletics & Recreation', from: '2025-01', to: '2026-04', workplace: 'On-site',
      location: 'Kelowna, British Columbia, Canada',
      summary: 'Supported students, campus programs, recreation operations, and events through front-line service and team collaboration.',
    }],
  },
];

export const CURRENT_ROLE = EMPLOYMENT[0].roles[0];
export const EDUCATION = {
  institution: 'Okanagan College', degree: 'Bachelor of Computer Information Systems', specialization: 'Software Development', completed: '2026-04',
};

const dateFormat = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const employmentMonth = (value) => dateFormat.format(new Date(`${value}-01T00:00:00Z`));
export const employmentPeriod = ({ from, to }) => `${employmentMonth(from)} – ${to ? employmentMonth(to) : 'Present'}`;
export const workplaceDetails = (role) => [role.employmentType, role.workplace, role.location].filter(Boolean).join(' · ');

export const TECHNOLOGIES = [
  ['AI and Machine Learning', ['Ollama', 'Retrieval-augmented generation', 'ChromaDB', 'XGBoost']],
  ['Agentic AI and Automation', ['Structured tool calling', 'Workflow orchestration', 'Evaluation', 'Approval gates']],
  ['Backend Engineering', ['Python', 'FastAPI', 'Node.js', 'REST', 'GraphQL']],
  ['Frontend Engineering', ['React', 'Next.js', 'TypeScript', 'Vite']],
  ['Data and Storage', ['PostgreSQL', 'SQLite', 'Ceph', 'Distributed storage']],
  ['GPU Infrastructure', ['CUDA', 'NVML', 'Slurm', 'GPU deployment planning']],
  ['Networking and Virtualization', ['Proxmox', 'Ethernet', 'InfiniBand', 'VLANs']],
  ['DevOps and Security', ['Linux', 'Docker', 'GitHub Actions', 'Vercel', 'OAuth2', 'Audit logging']],
];
