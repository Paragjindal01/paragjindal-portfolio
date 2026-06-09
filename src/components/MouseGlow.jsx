import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function MouseGlow() {
  const mouseX = useMotionValue(-200);
  const mouseY = useMotionValue(-200);

  const springX = useSpring(mouseX, { stiffness: 40, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 25 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseX.set(e.clientX - 200);
      mouseY.set(e.clientY - 200);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="pointer-events-none fixed z-0"
      style={{
        left: springX,
        top: springY,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
      }}
    />
  );
}
