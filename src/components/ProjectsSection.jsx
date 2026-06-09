import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';
import ProjectCard from './ProjectCard';

const projects = [
  {
    title: 'AltaAI Internal AI Assistant / RAG Platform',
    description:
      'Internal AI automation and RAG platform focused on AI-assisted workflows, API integrations, backend troubleshooting, PostgreSQL, OpenAI API, and internal productivity tools.',
    tags: ['React', 'Node.js', 'Express.js', 'PostgreSQL', 'OpenAI API', 'RAG'],
  },
  {
    title: 'Kelowna Crime Map – Full-Stack Reporting',
    description:
      'Built a full-stack reporting application using Next.js, TypeScript, PostgreSQL, Prisma, and Leaflet. Developed report submission, filtering, admin moderation, approval workflows, and public map display features.',
    tags: ['Next.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Leaflet'],
  },
  {
    title: 'ML Model Backend – Stock Market Prediction',
    description:
      'Built a FastAPI backend to serve an XGBoost model, process structured data, and support prediction requests. Developed API workflows for data ingestion, preprocessing, model inference, backend testing, and technical documentation.',
    tags: ['Python', 'FastAPI', 'XGBoost', 'REST API', 'Backend'],
  },
  {
    title: 'Cybersecurity and IT Home Lab',
    description:
      'Built a Kali Linux and Ubuntu Server lab to practice networking, Linux administration, and security troubleshooting. Used Nmap, Wireshark, SSH, firewall rules, and Linux logs to identify open ports, analyze traffic, and review system activity.',
    tags: ['Kali Linux', 'Ubuntu Server', 'Nmap', 'Wireshark', 'SSH', 'UFW'],
  },
  {
    title: 'Data Diagram Warehouse',
    description:
      'Academic full-stack data warehouse project for storing, searching, and analyzing textbook diagram metadata.',
    tags: ['React', 'Tailwind CSS', 'Node.js', 'Express', 'PostgreSQL', 'MongoDB'],
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

export default function ProjectsSection() {
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

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto"
      >
        {projects.map((project, i) => (
          <ProjectCard key={project.title} project={project} index={i} />
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
