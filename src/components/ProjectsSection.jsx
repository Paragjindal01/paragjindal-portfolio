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
