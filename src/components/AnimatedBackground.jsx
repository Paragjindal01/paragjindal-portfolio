import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

/* Precomputed particle configs — stable across renders (no impure calls during render) */
const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  // Deterministic pseudo-random values seeded by index
  const seed = (n) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    id: i,
    speed: 50 + seed(1) * 150,
    startY: seed(2) * 100,
    drift: (seed(3) - 0.5) * 100,
    opacity: 0.3 + seed(4) * 0.3,
    left: 10 + seed(5) * 80,
  };
});

function Particle({ config, smoothProgress }) {
  const y = useTransform(
    smoothProgress,
    [0, 1],
    [`${config.startY}vh`, `${config.startY - config.speed / 10}vh`]
  );
  const x = useTransform(smoothProgress, [0, 1], [0, config.drift]);

  return (
    <motion.div
      className="fixed w-[3px] h-[3px] rounded-full pointer-events-none z-0"
      style={{
        background: 'var(--color-accent-silver)',
        opacity: config.opacity,
        left: `${config.left}%`,
        y,
        x,
        boxShadow: '0 0 10px rgba(148,163,184,0.5)',
      }}
    />
  );
}

export default function AnimatedBackground({ children }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 40, damping: 20 });

  /* Soft luxury gradient orbs that move slowly with scroll */
  const orb1Y = useTransform(smoothProgress, [0, 1], [0, -300]);
  const orb1X = useTransform(smoothProgress, [0, 1], [0, 100]);
  const orb2Y = useTransform(smoothProgress, [0, 1], [0, -250]);
  const orb2X = useTransform(smoothProgress, [0, 1], [0, -80]);

  return (
    <div ref={ref} className="relative min-h-screen bg-[var(--color-bg-base)] overflow-hidden">

      {/* Subtle Dotted Mesh Pattern */}
      <div className="absolute inset-0 bg-mesh-dark opacity-50 pointer-events-none z-0 mask-image-gradient" />

      {/* Premium dark radial gradients */}
      <motion.div
        className="fixed top-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.08) 0%, transparent 60%)',
          y: orb1Y,
          x: orb1X,
        }}
      />
      <motion.div
        className="fixed top-[20%] right-[-15%] w-[1000px] h-[1000px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(251, 113, 133, 0.05) 0%, transparent 60%)',
          y: orb2Y,
          x: orb2X,
        }}
      />

      {/* Extremely subtle, slow-floating particles for depth */}
      {PARTICLES.map((config) => (
        <Particle key={config.id} config={config} smoothProgress={smoothProgress} />
      ))}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
