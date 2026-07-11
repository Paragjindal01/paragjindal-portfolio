import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import RobotSpeechBubble from './RobotSpeechBubble';
import useSplineRobotActions from './useSplineRobotActions';
import {
  GREETING_AUDIO_SRC,
  GREETING_STORAGE_KEY,
  GREETING_SEGMENTS,
  GREETING_FULL_TEXT,
  SEGMENT_FALLBACK_MS,
} from './robotGreeting';

const INVITE_TEXT = "Hi! I'm Parag's digital assistant.";
const COMPLETED_TEXT = 'Thanks for listening! Feel free to explore or replay the greeting.';

const readPlayed = () => {
  try {
    return sessionStorage.getItem(GREETING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const markPlayed = () => {
  try {
    sessionStorage.setItem(GREETING_STORAGE_KEY, 'true');
  } catch {
    /* private mode — ignore */
  }
};

/**
 * Orchestrates the robot greeting: speech bubble, audio playback,
 * captions, controls, session memory, and the Spline speaking/wave
 * animations. Audio state lives entirely here, outside Spline logic.
 *
 * Status flow:
 *   ready → (click) → speaking ⇄ paused → completed → (replay) → speaking
 * Any playback failure degrades: mp3 → browser speechSynthesis → timed
 * captions only ('error' status keeps the written greeting available).
 */
export default function RobotVoiceGreeting({ splineRef, robotLoaded }) {
  const reducedMotion = useReducedMotion();
  const { playWave, startTalking, stopTalking, resetPose } = useSplineRobotActions(splineRef, {
    reducedMotion,
  });

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState(() => (readPlayed() ? 'completed' : 'ready'));
  const [muted, setMuted] = useState(false);
  const [segmentIdx, setSegmentIdx] = useState(-1);

  const audioRef = useRef(null); // single HTMLAudioElement, created lazily
  const modeRef = useRef('audio'); // 'audio' | 'tts' | 'text'
  const startLockRef = useRef(false); // guards rapid clicks / double start
  const textTimerRef = useRef(0);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /* ── Show the invitation shortly after the robot loads ── */
  useEffect(() => {
    if (!robotLoaded || dismissed) return undefined;
    const t = setTimeout(() => setOpen(true), 1400);
    return () => clearTimeout(t);
  }, [robotLoaded, dismissed]);

  /* ── Helpers ── */
  const clearTextTimer = () => {
    if (textTimerRef.current) {
      clearTimeout(textTimerRef.current);
      textTimerRef.current = 0;
    }
  };

  const finish = useCallback(() => {
    clearTextTimer();
    stopTalking();
    resetPose();
    setSegmentIdx(-1);
    setStatus('completed');
    startLockRef.current = false;
  }, [stopTalking, resetPose]);

  /* Timed captions only — final fallback (no sound available). */
  const runTextCaptions = useCallback(
    (fromIdx = 0) => {
      modeRef.current = 'text';
      const advance = (idx) => {
        if (idx >= GREETING_SEGMENTS.length) {
          finish();
          return;
        }
        setSegmentIdx(idx);
        textTimerRef.current = setTimeout(() => advance(idx + 1), SEGMENT_FALLBACK_MS);
      };
      setStatus('speaking');
      advance(fromIdx);
    },
    [finish]
  );

  /* Browser speech synthesis fallback. */
  const runSpeechSynthesis = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis || muted) {
      runTextCaptions();
      return;
    }
    modeRef.current = 'tts';
    window.speechSynthesis.cancel();
    setStatus('speaking');
    GREETING_SEGMENTS.forEach((seg, i) => {
      const u = new SpeechSynthesisUtterance(seg.text);
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => setSegmentIdx(i);
      if (i === GREETING_SEGMENTS.length - 1) u.onend = () => finish();
      window.speechSynthesis.speak(u);
    });
  }, [muted, runTextCaptions, finish]);

  /* Primary path: prerecorded MP3 via a single HTMLAudioElement. */
  const runAudio = useCallback(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(GREETING_AUDIO_SRC);
      audio.preload = 'metadata';
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration || !isFinite(audio.duration)) return;
        const frac = audio.currentTime / audio.duration;
        let idx = 0;
        for (let i = GREETING_SEGMENTS.length - 1; i >= 0; i--) {
          if (frac >= GREETING_SEGMENTS[i].at) {
            idx = i;
            break;
          }
        }
        setSegmentIdx((prev) => (prev === idx ? prev : idx));
      });
      audio.addEventListener('ended', () => finish());
    }

    audio.muted = muted;
    audio.currentTime = 0;
    modeRef.current = 'audio';
    setStatus('speaking');
    setSegmentIdx(0);

    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.catch((err) => {
        // Missing file or blocked playback — degrade gracefully.
        if (import.meta.env.DEV) {
          console.warn(
            '[RobotVoiceGreeting] Audio unavailable (%s). Place the greeting MP3 at public/audio/robot-welcome.mp3. Falling back to speech synthesis / captions.',
            err?.name || err
          );
        }
        runSpeechSynthesis();
      });
    }
  }, [muted, finish, runSpeechSynthesis]);

  /* ── Public actions ── */
  const start = useCallback(() => {
    if (startLockRef.current || statusRef.current === 'speaking' || statusRef.current === 'paused') return;
    startLockRef.current = true;
    markPlayed();
    // Wave greeting first (≈1.8s, skipped under reduced motion), audio in parallel.
    playWave(() => {
      if (statusRef.current === 'speaking') startTalking();
    });
    runAudio();
  }, [playWave, startTalking, runAudio]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'speaking') return;
    if (modeRef.current === 'audio') audioRef.current?.pause();
    else if (modeRef.current === 'tts') window.speechSynthesis?.pause();
    else clearTextTimer();
    stopTalking();
    resetPose(); // robot returns to idle while paused
    setStatus('paused');
  }, [stopTalking, resetPose]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    setStatus('speaking');
    startTalking();
    if (modeRef.current === 'audio') {
      const p = audioRef.current?.play();
      p?.catch?.(() => runSpeechSynthesis());
    } else if (modeRef.current === 'tts') {
      window.speechSynthesis?.resume();
    } else {
      runTextCaptions(Math.max(segmentIdx, 0));
    }
  }, [startTalking, runSpeechSynthesis, runTextCaptions, segmentIdx]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      if (modeRef.current === 'tts' && next && window.speechSynthesis) {
        // TTS volume can't change mid-utterance: switch to silent captions.
        window.speechSynthesis.cancel();
        clearTextTimer();
        runTextCaptions(Math.max(segmentIdx, 0));
      }
      return next;
    });
  }, [runTextCaptions, segmentIdx]);

  const stopEverything = useCallback(() => {
    clearTextTimer();
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    stopTalking();
    resetPose();
    startLockRef.current = false;
  }, [stopTalking, resetPose]);

  const replay = useCallback(() => {
    stopEverything();
    setStatus('ready');
    // allow state to settle, then start fresh
    startLockRef.current = false;
    start();
  }, [stopEverything, start]);

  const close = useCallback(() => {
    stopEverything();
    setSegmentIdx(-1);
    setStatus(readPlayed() ? 'completed' : 'ready');
    setOpen(false);
    setDismissed(true);
  }, [stopEverything]);

  /* Release the start lock whenever we leave active playback. */
  useEffect(() => {
    if (status === 'completed' || status === 'error' || status === 'ready') {
      startLockRef.current = false;
    }
  }, [status]);

  /* Pause when the tab is hidden. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && statusRef.current === 'speaking') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  /* Unmount cleanup: stop audio/synthesis/timers. */
  useEffect(
    () => () => {
      clearTextTimer();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      window.speechSynthesis?.cancel();
    },
    []
  );

  /* ── Caption text ── */
  let caption;
  if (status === 'speaking' || status === 'paused') {
    caption = segmentIdx >= 0 ? GREETING_SEGMENTS[segmentIdx].text : GREETING_SEGMENTS[0].text;
  } else if (status === 'completed') {
    caption = COMPLETED_TEXT;
  } else if (status === 'error') {
    caption = GREETING_FULL_TEXT; // text-only graceful experience
  } else {
    caption = INVITE_TEXT;
  }

  const speaking = status === 'speaking';

  return (
    <>
      {/* Subtle audio-reactive glow on the robot panel while speaking */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-[2rem] pointer-events-none z-30 transition-opacity duration-500 ${
          speaking && !reducedMotion ? 'opacity-100 robot-speaking-glow' : 'opacity-0'
        }`}
      />

      <RobotSpeechBubble
        open={open}
        status={status}
        muted={muted}
        caption={caption}
        reducedMotion={reducedMotion}
        onStart={status === 'completed' || status === 'error' ? replay : start}
        onPause={pause}
        onResume={resume}
        onToggleMute={toggleMute}
        onReplay={replay}
        onClose={close}
      />

      {/* Re-open chip after the bubble is dismissed */}
      {dismissed && !open && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => {
            setDismissed(false);
            setOpen(true);
          }}
          aria-label="Open assistant greeting"
          className="absolute left-4 bottom-6 z-40 pointer-events-auto inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-950/80 backdrop-blur-xl border border-[var(--color-accent-cyan)]/25 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-accent-cyan)] hover:border-[var(--color-accent-cyan)]/50 transition-colors duration-200 shadow-lg"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Assistant
        </motion.button>
      )}

      {/* Screen-reader status updates */}
      <span className="sr-only" role="status">
        {status === 'speaking' && 'Greeting is playing.'}
        {status === 'paused' && 'Greeting paused.'}
        {status === 'completed' && 'Greeting finished.'}
      </span>
    </>
  );
}
