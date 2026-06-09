import { motion } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export default function ProjectCard({ project, index }) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="glass-card p-8 flex flex-col h-full group relative overflow-hidden transition-all duration-300 hover:shadow-[0_20px_40px_-10px_rgba(34,211,238,0.2)] hover:border-cyan-400/40"
    >
      {/* Premium subtle corner glow on hover */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-[var(--color-accent-cyan)] opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-2xl z-0" />

      {/* Project number & icon */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)]">
          Project {String(index + 1).padStart(2, '0')}
        </span>
        <div className="w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center group-hover:border-[var(--color-accent-cyan)] group-hover:text-[var(--color-accent-cyan)] transition-colors duration-300">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent-cyan)] transition-colors duration-300"
          >
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3 group-hover:text-[var(--color-accent-cyan)] transition-colors duration-300 relative z-10 tracking-tight">
        {project.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6 flex-grow relative z-10">
        {project.description}
      </p>

      {/* Tech tags */}
      <div className="flex flex-wrap gap-2 relative z-10 mt-auto">
        {project.tags.map((tag) => (
          <span key={tag} className="tech-tag">
            {tag}
          </span>
        ))}
      </div>
      
      {/* View Project link hover hint */}
      <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 z-10">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-cyan)] flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
