import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

const skills = [
  'Python',
  'TypeScript',
  'JavaScript',
  'FastAPI',
  'Node.js',
  'React',
  'Next.js',
  'PostgreSQL',
  'MongoDB',
  'Docker',
  'AWS',
  'Linux',
  'REST APIs',
  'GraphQL',
  'RAG',
  'Technical Support',
  'Networking',
];

const skillVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.35, ease: 'easeOut' },
  }),
};

export default function AboutSection() {
  return (
    <SectionWrapper id="about">
      <div className="text-center mb-16">
        <h2 className="section-title">
          About <span className="text-[var(--color-accent-blue)]">Me</span>
        </h2>
        <p className="section-subtitle">
          I build modern digital products and solve everyday technology problems.
        </p>
      </div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1 } },
        }}
        className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 max-w-4xl mx-auto rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        {/* Subtle decorative glow in top corner */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[var(--color-accent-cyan)] blur-3xl opacity-10 pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-10 items-start relative z-10">
          {/* Avatar */}
          <div className="flex justify-center md:justify-start">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-32 h-32 rounded-3xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-4xl font-extrabold text-[var(--color-accent-cyan)] shadow-[0_10px_20px_-5px_rgba(34,211,238,0.2)] relative"
              aria-hidden="true"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[rgba(34,211,238,0.1)] to-transparent pointer-events-none" />
              PJ
            </motion.div>
          </div>

          {/* Bio */}
          <div className="space-y-5">
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-base">
              I&apos;m <span className="text-[var(--color-text-primary)] font-semibold">Parag Jindal</span>, a
              Computer Information Systems graduate (Software Development Specialization,{' '}
              <span className="text-[var(--color-accent-cyan)] font-medium">Okanagan College</span>) based in
              Kelowna, British Columbia.
            </p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-base">
              I work as an <span className="text-[var(--color-text-primary)] font-semibold">AI Product Engineer</span>,
              developing AI products, backend services, workflow automations, and secure internal tools. I also have
              hands-on experience supporting customers with computers, printers, Wi-Fi networks, smart-home devices,
              televisions, software, and other technology.
            </p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-base">
              My work combines software development, practical problem-solving, and clear communication. Whether
              someone needs a professional website, a custom application, or help fixing a technology problem, I
              focus on delivering <span className="text-[var(--color-text-primary)] font-semibold">reliable and
              understandable solutions</span>.
            </p>

            {/* Compact skills */}
            <div className="pt-6 mt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold tracking-widest uppercase text-[var(--color-text-muted)] mb-4">
                Core Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <motion.span
                    key={skill}
                    custom={i}
                    variants={skillVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    className="tech-tag"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </SectionWrapper>
  );
}
