import { useRef, lazy, Suspense } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

/* Lazy-load the heavy Spline runtime so it never blocks initial page load */
const SplineHero = lazy(() => import('./SplineHero'));

const wordVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.2 + i * 0.03, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function HeroSection() {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 30 });

  /* Text parallax & exit (Layer 1 - Intro) */
  // Left side text fades out and moves up as user scrolls
  const introY = useTransform(smoothProgress, [0, 0.35], [0, -150]);
  const introOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);
  const introX = useTransform(smoothProgress, [0, 0.35], [0, -50]);

  /* Mid-scroll content (Layer 2 - Focus) */
  const midOpacity = useTransform(smoothProgress, [0.35, 0.5, 0.65, 0.8], [0, 1, 1, 0]);
  const midY = useTransform(smoothProgress, [0.35, 0.5, 0.65, 0.8], [60, 0, 0, -60]);

  /* Transition text (Layer 3 - Outro) */
  const outroOpacity = useTransform(smoothProgress, [0.75, 0.9, 0.95], [0, 1, 0]);
  const outroY = useTransform(smoothProgress, [0.75, 0.9, 0.95], [40, 0, -40]);

  const subtitleWords = 'I build modern websites, AI-powered applications, and backend systems—and help individuals and small businesses solve everyday computer, device, Wi-Fi, and home technology problems.'.split(' ');

  return (
    <section ref={sectionRef} id="home" className="relative" style={{ minHeight: '220vh' }}>
      {/* ═══════ Sticky viewport ═══════ */}
      <div className="sticky top-0 min-h-screen flex items-center justify-center overflow-hidden">

        {/* ═══════ Spline 3D scene (right side -> center) ═══════ */}
        <Suspense fallback={null}>
          <SplineHero smoothProgress={smoothProgress} />
        </Suspense>

        {/* ═══════ Phase 1: Introduction (scroll 0–25%) ═══════ */}
        <motion.div
          style={{ y: introY, x: introX, opacity: introOpacity }}
          className="absolute inset-0 flex items-center z-30 pointer-events-none"
        >
          {/* Grid layout matching the max-w-7xl container to align text left */}
          <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2">
            <div className="max-w-lg pt-12 lg:pt-0">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mb-5 inline-flex"
              >
                <span className="glass-badge">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-blue)] animate-pulse" />
                  Kelowna, BC · Remote across Canada
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold leading-[1.05] tracking-tight mb-5"
              >
                <span className="text-[var(--color-text-primary)]">Parag</span>{' '}
                <span className="gradient-text">Jindal</span>
              </motion.h1>

              <motion.h2
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-lg sm:text-xl font-medium text-[var(--color-text-secondary)] mb-6"
              >
                AI Product Engineer, Full-Stack Developer &amp; Technical Support Specialist
              </motion.h2>

              {/* Word-by-word subtitle */}
              <div className="text-[var(--color-text-muted)] text-base leading-relaxed mb-10 flex flex-wrap gap-x-[5px] gap-y-0 font-normal">
                {subtitleWords.map((word, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={wordVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {word}
                  </motion.span>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="flex flex-wrap gap-4 pointer-events-auto"
              >
                <motion.a
                  href="#projects"
                  className="btn-primary"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View My Work
                </motion.a>
                <motion.a
                  href="#services"
                  className="btn-secondary"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Explore Services
                </motion.a>
                <motion.a
                  href="#contact"
                  className="btn-secondary"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Contact Me
                </motion.a>
              </motion.div>
            </div>
            {/* Empty right column for Spline spacing */}
            <div className="hidden lg:block"></div>
          </div>
        </motion.div>

        {/* ═══════ Phase 2: Focus on 3D (scroll 35–65%) ═══════ */}
        <motion.div
          style={{ y: midY, opacity: midOpacity }}
          className="absolute bottom-16 left-0 right-0 z-30 pointer-events-none"
        >
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] tracking-widest uppercase mb-6">
              Scroll to explore
            </p>
          </div>
        </motion.div>

        {/* ═══════ Phase 3: Transition to About (scroll 75–95%) ═══════ */}
        <motion.div
          style={{ y: outroY, opacity: outroOpacity }}
          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
        >
          <div className="text-center max-w-2xl px-6 bg-slate-900/60 backdrop-blur-xl p-10 rounded-[32px] border border-white/10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] pointer-events-auto">
            <h3 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text-primary)] mb-4 tracking-tight">
              Build. Automate. <span className="gradient-text">Solve.</span>
            </h3>
            <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
              I build modern digital products and solve everyday technology problems —
              from websites and AI-powered applications to computers, Wi-Fi, and home tech.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
