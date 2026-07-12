const btnClass =
  'inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-white/10 border border-[var(--color-accent-cyan)]/30 text-[var(--color-text-primary)] hover:text-[var(--color-accent-cyan)] hover:border-[var(--color-accent-cyan)]/70 hover:bg-[var(--color-accent-cyan)]/10 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed';

const Icon = ({ children }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const SoundOnIcon = () => (
  <Icon>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </Icon>
);

export const SoundOffIcon = () => (
  <Icon>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </Icon>
);

/**
 * Compact icon controls for the greeting audio.
 * The sound (mute/unmute) toggle is ALWAYS visible so visitors can see
 * the greeting has audio before starting it. Every button has an
 * aria-label; state comes from the parent.
 */
export default function RobotAudioControls({
  status,
  muted,
  onPause,
  onResume,
  onToggleMute,
  onReplay,
  onClose,
}) {
  const speaking = status === 'speaking';
  const paused = status === 'paused';

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Greeting audio controls">
      {speaking && (
        <button type="button" className={btnClass} onClick={onPause} aria-label="Pause greeting">
          <Icon>
            <line x1="10" y1="5" x2="10" y2="19" />
            <line x1="15" y1="5" x2="15" y2="19" />
          </Icon>
        </button>
      )}
      {paused && (
        <button type="button" className={btnClass} onClick={onResume} aria-label="Resume greeting">
          <Icon>
            <polygon points="6 4 20 12 6 20 6 4" />
          </Icon>
        </button>
      )}
      {/* Sound toggle — always visible */}
      <button
        type="button"
        className={`${btnClass} ${muted ? '!text-[var(--color-accent-coral)] !border-[var(--color-accent-coral)]/50' : ''}`}
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute greeting' : 'Mute greeting'}
        aria-pressed={muted}
        title={muted ? 'Sound off — click to unmute' : 'Sound on — click to mute'}
      >
        {muted ? <SoundOffIcon /> : <SoundOnIcon />}
      </button>
      {(status === 'completed' || status === 'error') && (
        <button type="button" className={btnClass} onClick={onReplay} aria-label="Replay greeting">
          <Icon>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </Icon>
        </button>
      )}
      <button type="button" className={btnClass} onClick={onClose} aria-label="Close greeting">
        <Icon>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </Icon>
      </button>
    </div>
  );
}
