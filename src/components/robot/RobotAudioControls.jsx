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

export default function RobotAudioControls({
  actionRef,
  status,
  muted,
  onStart,
  onPause,
  onResume,
  onToggleMute,
  onClose,
}) {
  const play = <Icon><path d="m7 4 13 8-13 8z" /></Icon>;
  const actions = {
    ready: { label: "Meet Parag's AI", onClick: onStart, icon: play },
    speaking: { label: 'Pause greeting', onClick: onPause, icon: <Icon><path d="M9 5v14m6-14v14" /></Icon> },
    paused: { label: 'Resume greeting', onClick: onResume, icon: play },
    replay: { label: 'Replay Greeting', onClick: onStart, icon: <Icon><path d="M1 4v6h6m-6 0 4-4a8.9 8.9 0 1 1-2 9" /></Icon> },
  };
  const action = actions[status] ?? actions.replay;

  return (
    <div className="robot-greeting__controls" role="group" aria-label="Greeting audio controls">
      <button ref={actionRef} type="button" className="robot-greeting__action" onClick={action.onClick}>
        {action.icon}<span>{action.label}</span>
      </button>
      <button
        type="button"
        className="robot-greeting__icon-button"
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute greeting' : 'Mute greeting'}
        aria-pressed={muted}
        title={muted ? 'Sound off — click to unmute' : 'Sound on — click to mute'}
      >
        {muted ? <SoundOffIcon /> : <SoundOnIcon />}
      </button>
      <button type="button" className="robot-greeting__icon-button" onClick={onClose} aria-label="Close greeting" title="Close greeting">
        <Icon>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </Icon>
      </button>
    </div>
  );
}
