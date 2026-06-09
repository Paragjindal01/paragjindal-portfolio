import { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import Spline from '@splinetool/react-spline';

export default function SplineHero({ smoothProgress }) {
  const [loaded, setLoaded] = useState(false);

  /* ═══════ Cursor-following spotlight behind the robot ═══════ */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springMouseX = useSpring(mouseX, { stiffness: 25, damping: 20 });
  const springMouseY = useSpring(mouseY, { stiffness: 25, damping: 20 });

  useEffect(() => {
    const handleMouse = (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 40;
      const cy = (e.clientY / window.innerHeight - 0.5) * 40;
      mouseX.set(cx);
      mouseY.set(cy);
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, [mouseX, mouseY]);

  /* ═══════ Scroll-driven parallax and layout shift ═══════ */
  // Start on the right side (translateX), move slightly to center
  const xTranslate = useTransform(smoothProgress, [0, 0.4], ['5vw', '0vw']);
  // Scale up slightly on scroll
  const scale = useTransform(smoothProgress, [0, 0.4, 1], [1, 1.05, 1.1]);
  // Move slightly upward on scroll
  const yScroll = useTransform(smoothProgress, [0, 1], [0, -40]);
  
  // Pulse the glow as user scrolls (Cyan / Coral)
  const borderGlowOpacity = useTransform(smoothProgress, [0, 0.5, 1], [0.3, 0.7, 0.2]);

  return (
    <div className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[5vw] xl:pr-[10vw] z-20 pointer-events-none overflow-hidden max-w-[100vw]">
      {/* Spline scene container with scroll layout shift - NO pointer-events-none here to allow canvas interaction */}
      <motion.div
        style={{ 
          x: xTranslate, 
          y: yScroll,
          scale,
        }}
        className="relative w-[95vw] sm:w-[90vw] max-w-[500px] md:max-w-[650px] lg:max-w-[750px] h-[480px] sm:h-[560px] md:h-[720px] mt-12 lg:mt-0"
      >
        {/* Soft floating motion wrapper */}
        <motion.div 
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-full h-full relative"
        >
          {/* Cursor-following spotlight behind the robot container */}
          <motion.div
            style={{ x: springMouseX, y: springMouseY }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-tr from-[var(--color-accent-cyan)] to-[var(--color-accent-coral)] rounded-full blur-[100px] opacity-20 pointer-events-none z-0"
          />

          {/* Premium dark outer glow frame */}
          <motion.div
            className="absolute -inset-1 rounded-[2rem] pointer-events-none z-0"
            style={{ opacity: borderGlowOpacity }}
            animate={{
              boxShadow: [
                '0 0 30px rgba(34,211,238,0.1), 0 0 60px rgba(251,113,133,0.05)',
                '0 0 50px rgba(34,211,238,0.2), 0 0 90px rgba(251,113,133,0.1)',
                '0 0 30px rgba(34,211,238,0.1), 0 0 60px rgba(251,113,133,0.05)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Main Spline container - Dark glass border, 2rem rounded */}
          <motion.div 
            className="relative w-full h-full rounded-[2rem] overflow-hidden border border-cyan-400/20 bg-black/40 shadow-2xl z-10 pointer-events-auto"
            animate={{
              boxShadow: [
                'inset 0 0 30px rgba(34,211,238,0.05)',
                'inset 0 0 60px rgba(34,211,238,0.15)',
                'inset 0 0 30px rgba(34,211,238,0.05)',
              ],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Loading state */}
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/80 backdrop-blur-xl">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-2 border-[var(--color-accent-cyan)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[var(--color-text-secondary)] font-medium">Initializing AI Core...</p>
                </div>
              </div>
            )}

            {/* Interactive Spline Scene */}
            <Spline
              scene="https://prod.spline.design/wmlbgIVajKF3kFwY/scene.splinecode"
              onLoad={() => setLoaded(true)}
              style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
            />

            {/* Subtle instruction if needed */}
            {loaded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 2, duration: 2 }}
                className="absolute bottom-6 left-0 right-0 text-center pointer-events-none z-20"
              >
                <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-[var(--color-text-muted)] uppercase drop-shadow-md">
                  Move your cursor to interact
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Floating Tech Badges (Pointer Events None to avoid blocking Spline) */}
          <motion.div
            className="absolute top-[15%] -left-4 sm:-left-12 lg:-left-16 z-30 pointer-events-none"
            animate={{ y: [0, -10, 0], rotate: [0, 2, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <div className="glass-badge bg-black/60 shadow-[0_4px_20px_rgba(34,211,238,0.15)] text-[10px] sm:text-xs border-[var(--color-accent-cyan)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-cyan)] animate-pulse" /> React
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-[25%] -left-2 sm:-left-8 lg:-left-12 z-30 pointer-events-none"
            animate={{ y: [0, 10, 0], rotate: [0, -2, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            <div className="glass-badge bg-black/60 shadow-[0_4px_20px_rgba(139,92,246,0.15)] text-[10px] sm:text-xs border-[var(--color-accent-violet)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-violet)] animate-pulse" /> FastAPI
            </div>
          </motion.div>

          <motion.div
            className="absolute top-[20%] -right-4 sm:-right-10 lg:-right-14 z-30 pointer-events-none hidden sm:block"
            animate={{ y: [0, -12, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          >
            <div className="glass-badge bg-black/60 shadow-[0_4px_20px_rgba(251,113,133,0.15)] text-[10px] sm:text-xs border-[var(--color-accent-coral)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-coral)] animate-pulse" /> RAG
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-[20%] -right-2 sm:-right-8 lg:-right-12 z-30 pointer-events-none hidden sm:block"
            animate={{ y: [0, 8, 0], rotate: [0, 2, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          >
            <div className="glass-badge bg-black/60 shadow-[0_4px_20px_rgba(255,255,255,0.1)] text-[10px] sm:text-xs border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> OpenAI
            </div>
          </motion.div>

        </motion.div>
      </motion.div>
    </div>
  );
}
