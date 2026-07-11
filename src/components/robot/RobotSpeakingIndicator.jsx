/**
 * Small CSS waveform shown while the robot is "speaking".
 * Purely decorative (aria-hidden); captions carry the content.
 * Bars are static when reduced motion is preferred.
 */
export default function RobotSpeakingIndicator({ active, reducedMotion = false }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-[3px] h-4 transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-[var(--color-accent-cyan)] ${
            active && !reducedMotion ? 'robot-wave-bar' : 'h-2'
          }`}
          style={active && !reducedMotion ? { animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
    </div>
  );
}
