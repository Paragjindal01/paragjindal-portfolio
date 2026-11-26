export default function RobotSpeakingIndicator({ active, reducedMotion = false }) {
  return (
    <div
      aria-hidden="true"
      className="robot-greeting__wave"
      data-speaking={active}
      data-static={reducedMotion || undefined}
    >
      <span /><span /><span /><span /><span />
    </div>
  );
}
