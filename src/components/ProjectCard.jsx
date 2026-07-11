import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export default function ProjectCard({ project, index, featured = false }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className={`glass-card p-8 ${featured ? 'lg:p-12' : ''} flex flex-col h-full group relative overflow-hidden transition-all duration-300 hover:shadow-[0_20px_40px_-10px_rgba(34,211,238,0.2)] hover:border-cyan-400/40`}
    >
      {/* Premium subtle corner glow on hover */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-[var(--color-accent-cyan)] opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-2xl z-0" />

      {/* Label row */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)]">
          {featured ? (
            <span className="text-[var(--color-accent-cyan)]">★ Featured Project</span>
          ) : (
            `Project ${String(index + 1).padStart(2, '0')}`
          )}
        </span>
        {project.liveUrl && (
          <span className="glass-badge normal-case tracking-normal text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className={`${featured ? 'text-2xl' : 'text-xl'} font-bold text-[var(--color-text-primary)] mb-3 group-hover:text-[var(--color-accent-cyan)] transition-colors duration-300 relative z-10 tracking-tight`}>
        {project.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6 flex-grow relative z-10">
        {project.description}
      </p>

      {/* Expanded details (featured only) */}
      <AnimatePresence initial={false}>
        {detailsOpen && project.details && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 overflow-hidden"
          >
            <ul className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6 list-disc list-inside space-y-1.5">
              {project.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tech tags */}
      <div className="flex flex-wrap gap-2 relative z-10 mt-auto mb-0">
        {project.tags.map((tag) => (
          <span key={tag} className="tech-tag">
            {tag}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      {(project.liveUrl || project.repoUrl || project.details) && (
        <div className="flex flex-wrap gap-3 relative z-10 mt-6 pt-6 border-t border-white/10">
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !px-6 !py-2.5 text-xs"
            >
              <ExternalLinkIcon />
              Visit Live Site
            </a>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !px-6 !py-2.5 text-xs"
            >
              GitHub
            </a>
          )}
          {project.details && (
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="btn-secondary !px-6 !py-2.5 text-xs"
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? 'Hide Details' : 'View Details'}
            </button>
          )}
        </div>
      )}
    </motion.article>
  );
}
