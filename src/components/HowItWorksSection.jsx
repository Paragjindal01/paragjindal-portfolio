import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const steps = [
  {
    number: '01',
    title: 'Tell Me What You Need',
    description: 'Describe the website, software project, or technical issue you need help with.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Get a Clear Plan',
    description: 'I review the request, explain the recommended approach, and provide an estimated timeline and quote.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Build or Resolve',
    description: 'I complete the work, test the solution, and make sure the client understands how everything works.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const stepVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function HowItWorksSection() {
  return (
    <SectionWrapper id="how-it-works">
      <div className="text-center mb-16">
        <h2 className="section-title">
          How It <span className="text-[var(--color-accent-blue)]">Works</span>
        </h2>
        <p className="section-subtitle">
          A simple, transparent process from first message to finished work.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto"
      >
        {steps.map((step) => (
          <motion.div
            key={step.number}
            variants={stepVariants}
            className="glass-card p-8 text-center relative group hover:border-cyan-400/40 transition-all duration-300"
          >
            <span className="absolute top-6 right-6 text-4xl font-extrabold text-white/5 select-none" aria-hidden="true">
              {step.number}
            </span>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center text-[var(--color-accent-cyan)] mb-5 group-hover:border-[var(--color-accent-cyan)]/50 transition-colors duration-300">
              {step.icon}
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
              {step.title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {step.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
