import { motion } from 'framer-motion';
import SectionWrapper from './SectionWrapper';

export default function AboutSection() {
  return (
    <SectionWrapper id="about">
      <div className="text-center mb-16">
        <h2 className="section-title">
          About <span className="text-[var(--color-accent-blue)]">Me</span>
        </h2>
        <p className="section-subtitle">
          A passionate engineer building the future with code and AI.
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
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[rgba(34,211,238,0.1)] to-transparent pointer-events-none" />
              PJ
            </motion.div>
          </div>

          {/* Bio */}
          <div className="space-y-5">
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-base">
              <span className="text-[var(--color-text-primary)] font-semibold">Parag Jindal</span> is a Bachelor of Computer Information Systems graduate from <span className="text-[var(--color-accent-cyan)] font-medium">Okanagan College</span> based in Kelowna, BC (Sep 2022 – Apr 2026).
            </p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-base">
              He has hands-on experience in <span className="text-[var(--color-text-primary)] font-semibold">AI automation, full-stack development, backend APIs</span>, IT troubleshooting, field technician support, system documentation, and customer-facing technical support.
            </p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-base">
              He is focused on building intelligent, reliable, and practical technology solutions.
            </p>

            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 mt-4 border-t border-white/10">
              {[
                { value: 'B.CIS', label: 'Degree' },
                { value: 'AI', label: 'Specialization' },
                { value: 'Full-Stack', label: 'Development' },
                { value: '5+', label: 'Projects Shipped' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3">
                  <div className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">{stat.value}</div>
                  <div className="text-xs font-medium text-[var(--color-text-muted)] mt-1 tracking-wide uppercase">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </SectionWrapper>
  );
}
