import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

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
      {[...Array(8)].map((_, i) => {
        const speed = 50 + Math.random() * 150;
        const startY = Math.random() * 100;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const particleY = useTransform(smoothProgress, [0, 1], [`${startY}vh`, `${startY - speed / 10}vh`]);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const particleX = useTransform(smoothProgress, [0, 1], [0, (Math.random() - 0.5) * 100]);

        return (
          <motion.div
            key={i}
            className="fixed w-[3px] h-[3px] rounded-full pointer-events-none z-0"
            style={{
              background: 'var(--color-accent-silver)',
              opacity: 0.3 + Math.random() * 0.3,
              left: `${10 + Math.random() * 80}%`,
              y: particleY,
              x: particleX,
              boxShadow: '0 0 10px rgba(148,163,184,0.5)',
            }}
          />
        );
      })}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
