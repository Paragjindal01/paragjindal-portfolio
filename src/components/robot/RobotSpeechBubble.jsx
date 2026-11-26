import RobotAudioControls from './RobotAudioControls';
import RobotSpeakingIndicator from './RobotSpeakingIndicator';

export default function RobotSpeechBubble({
  actionRef,
  status,
  muted,
  caption,
  reducedMotion,
  onStart,
  onPause,
  onResume,
  onToggleMute,
  onClose,
}) {
  return (
    <section className="robot-greeting__panel" aria-label="Voice greeting">
      <header className="robot-greeting__header">
        <h2 className="robot-greeting__heading">Digital assistant</h2>
        <RobotSpeakingIndicator active={status === 'speaking'} reducedMotion={reducedMotion} />
      </header>
      <p className="robot-greeting__caption" aria-live="polite">{caption}</p>
      <RobotAudioControls
        actionRef={actionRef}
        status={status}
        muted={muted}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onToggleMute={onToggleMute}
        onClose={onClose}
      />
    </section>
  );
}
