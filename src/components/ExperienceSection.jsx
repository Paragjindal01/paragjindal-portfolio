import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const experiences = [
  {
    role: 'AI Product Engineer',
    company: 'AltaAI Inc. — Ottawa, Ontario / Remote',
    period: 'May 2026 – Present',
    description:
      'Developing AI products, backend services, internal automations, retrieval-augmented generation systems, secure API integrations, and business workflow tools.',
  },
  {
    role: 'Field Service Agent',
    company: 'Best Buy / Geek Squad — Kelowna, British Columbia',
    period: 'Apr 2026 – Present',
    description:
      'Providing in-home and in-store technical support for computers, printers, televisions, smart-home devices, mobile devices, peripherals, software, and Wi-Fi networks.',
  },
  {
    role: 'Student Employee — Peer Support and Athletics & Recreation',
    company: 'Okanagan College — Kelowna, British Columbia',
    period: 'Jan 2025 – Apr 2026',
    description:
      'Supported students, campus programs, events, recreation operations, and service requests while helping users access appropriate college resources.',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export default function ExperienceSection() {
  return (
    <SectionWrapper id="experience">
      <div className="text-center mb-16">
        <h2 className="section-title">
          Work <span className="text-[var(--color-accent-blue)]">Experience</span>
        </h2>
        <p className="section-subtitle">
          My professional journey across tech, AI, and beyond.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="relative max-w-3xl mx-auto pl-8 sm:pl-10 md:pl-14"
      >
        {/* Elegant subtle timeline line */}
        <div className="absolute left-[7px] sm:left-[11px] md:left-[15px] top-2 bottom-0 w-[1px] bg-gradient-to-b from-[var(--color-accent-cyan)] via-[var(--color-accent-silver)] to-transparent opacity-50" />

        {experiences.map((exp, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            className="relative mb-10 last:mb-0 group"
          >
            {/* Minimalist timeline dot */}
            <motion.div
              className="absolute -left-[28px] sm:-left-[31px] md:-left-[44px] w-[6px] h-[6px] rounded-full bg-[var(--color-accent-cyan)] top-6 ring-4 ring-[#0f172a] shadow-[0_0_0_5px_rgba(5,5,5,1)]"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 300 }}
            />

            {/* Clean dark card */}
            <div className="bg-slate-900/60 rounded-2xl p-6 md:p-8 border border-white/10 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_30px_-10px_rgba(34,211,238,0.15)] hover:border-cyan-400/40 transition-all duration-300 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-accent-cyan)] transition-colors duration-300">
                    {exp.role}
                  </h3>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
                    {exp.company}
                  </p>
                </div>
                <span className="text-xs font-semibold tracking-wider text-[var(--color-text-muted)] uppercase bg-black/50 px-3 py-1.5 rounded-full border border-white/10 w-fit shrink-0">
                  {exp.period}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {exp.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
