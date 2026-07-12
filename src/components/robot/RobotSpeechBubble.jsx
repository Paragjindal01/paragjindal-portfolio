import { motion, AnimatePresence } from 'framer-motion';
import RobotAudioControls from './RobotAudioControls';
import RobotSpeakingIndicator from './RobotSpeakingIndicator';

/**
 * Dark glass speech bubble anchored to the robot panel, with a tail
 * pointing toward the robot. Presentational only — all state and
 * handlers come from RobotVoiceGreeting.
 */
export default function RobotSpeechBubble({
  open,
  status,
  muted,
  caption,
  reducedMotion,
  onStart,
  onPause,
  onResume,
  onToggleMute,
  onReplay,
  onClose,
}) {
  const inConversation = status === 'speaking' || status === 'paused';
  const buttonLabel = status === 'completed' || status === 'error' ? 'Replay Greeting' : "Meet Parag's AI";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.95 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="absolute left-3 bottom-3 sm:left-4 sm:bottom-6 z-40 pointer-events-auto w-[calc(100%-1.5rem)] max-w-[300px] sm:max-w-[320px]"
        >
          <div className="relative rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-[var(--color-accent-cyan)]/25 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.7),0_0_24px_-8px_rgba(34,211,238,0.25)] p-4">
            {/* Tail pointing toward the robot (up-right) */}
            <div
              aria-hidden="true"
              className="absolute -top-[7px] right-8 w-3.5 h-3.5 rotate-45 bg-slate-950/80 border-t border-l border-[var(--color-accent-cyan)]/25"
            />

            {/* Header row */}
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden="true"
                  className={`w-1.5 h-1.5 rounded-full bg-[var(--color-accent-cyan)] shrink-0 ${
                    inConversation && !reducedMotion ? 'animate-pulse' : ''
                  }`}
                />
                <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-text-muted)] truncate">
                  Digital Assistant
                </span>
                <RobotSpeakingIndicator active={status === 'speaking'} reducedMotion={reducedMotion} />
              </div>
              {/* Sound toggle + transport controls — always visible so the
                  audio option is discoverable before the greeting starts */}
              <RobotAudioControls
                status={status}
                muted={muted}
                onPause={onPause}
                onResume={onResume}
                onToggleMute={onToggleMute}
                onReplay={onReplay}
                onClose={onClose}
              />
            </div>

            {/* Caption / message. aria-live announces caption changes. */}
            <p
              aria-live="polite"
              className="text-sm leading-relaxed text-[var(--color-text-secondary)] min-h-[2.5rem]"
            >
              {caption}
            </p>

            {/* Invite / replay button */}
            {(status === 'ready' || status === 'completed' || status === 'error') && (
              <>
                <button type="button" onClick={onStart} className="btn-primary !px-5 !py-2.5 text-xs mt-3 w-full justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {status === 'ready' ? (
                      <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </>
                    ) : (
                      <>
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </>
                    )}
                  </svg>
                  {buttonLabel}
                </button>
                <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-2 flex items-center justify-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  Plays a short voice intro — use the speaker button to mute
                </p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
