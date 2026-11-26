import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getSoundPreference, onSoundInteraction, setSoundPreference } from '../../data/sound-preference.mjs';
import RobotSpeechBubble from './RobotSpeechBubble';
import useSplineRobotActions from './useSplineRobotActions';
import './robot-greeting.css';
import {
  GREETING_AUDIO_SOURCES,
  GREETING_STORAGE_KEY,
  GREETING_SEGMENTS,
  GREETING_FULL_TEXT,
  GREETING_DURATION_MS,
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

  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState(() => (readPlayed() ? 'completed' : 'ready'));
  const [muted, setMuted] = useState(() => !getSoundPreference());
  const [segmentIdx, setSegmentIdx] = useState(-1);

  const audioRef = useRef(null); // single HTMLAudioElement, created lazily
  const modeRef = useRef('audio'); // 'audio' | 'tts' | 'text'
  const startLockRef = useRef(false); // guards rapid clicks / double start
  const playbackRef = useRef(0);
  const mutedRef = useRef(muted);
  const autoplayPending = useRef(true);
  const textTimerRef = useRef(0);
  const statusRef = useRef(status);
  const actionRef = useRef(null);
  const reopenRef = useRef(null);
  const restoreFocusRef = useRef(false);

  const changeStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // If audio starts while the scene is loading, join the current greeting
  // once the model is ready without interrupting playback.
  useEffect(() => {
    if (robotLoaded && statusRef.current === 'speaking') startTalking();
  }, [robotLoaded, startTalking]);

  useEffect(() => {
    if (!restoreFocusRef.current) return;
    (open ? actionRef : reopenRef).current?.focus({ preventScroll: true });
    restoreFocusRef.current = false;
  }, [open]);

  /* ── Helpers ── */
  const clearTextTimer = () => {
    if (textTimerRef.current) {
      clearTimeout(textTimerRef.current);
      textTimerRef.current = 0;
    }
  };

  const finish = useCallback(() => {
    playbackRef.current += 1;
    clearTextTimer();
    stopTalking();
    resetPose();
    setSegmentIdx(-1);
    changeStatus('completed');
    startLockRef.current = false;
  }, [changeStatus, stopTalking, resetPose]);

  /* Timed captions only — final fallback (no sound available). */
  const runTextCaptions = useCallback(
    (fromIdx = 0) => {
      const playback = playbackRef.current;
      modeRef.current = 'text';
      const advance = (idx) => {
        if (playback !== playbackRef.current || modeRef.current !== 'text' || statusRef.current !== 'speaking') return;
        if (idx >= GREETING_SEGMENTS.length) {
          finish();
          return;
        }
        setSegmentIdx(idx);
        const end = GREETING_SEGMENTS[idx + 1]?.at ?? 1;
        const duration = (end - GREETING_SEGMENTS[idx].at) * GREETING_DURATION_MS;
        textTimerRef.current = setTimeout(() => advance(idx + 1), duration);
      };
      changeStatus('speaking');
      advance(fromIdx);
    },
    [changeStatus, finish]
  );

  /* Browser speech synthesis fallback. */
  const runSpeechSynthesis = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis || mutedRef.current) {
      runTextCaptions();
      return;
    }
    const playback = playbackRef.current;
    const isCurrent = () => playback === playbackRef.current && modeRef.current === 'tts' && statusRef.current === 'speaking';
    const speech = window.speechSynthesis;
    const voice = speech.getVoices().find(item => item.lang.startsWith('en') && /samantha|ava|female|susan|sandy|serena/i.test(item.name));
    modeRef.current = 'tts';
    speech.cancel();
    changeStatus('speaking');
    GREETING_SEGMENTS.forEach((seg, i) => {
      const u = new SpeechSynthesisUtterance(seg.text);
      if (voice) u.voice = voice;
      u.rate = .92;
      u.pitch = 1;
      u.onstart = () => { if (isCurrent()) setSegmentIdx(i); };
      if (i === GREETING_SEGMENTS.length - 1) u.onend = () => { if (isCurrent()) finish(); };
      speech.speak(u);
    });
  }, [changeStatus, runTextCaptions, finish]);

  /* Prerecorded narration, with browser speech and captions as fallbacks. */
  const sourceIdxRef = useRef(0);

  const playAudio = useCallback((audio, onStarted, onAutoplayBlocked) => {
    const playback = ++playbackRef.current;
    const isCurrent = () => playback === playbackRef.current &&
      modeRef.current === 'audio' && statusRef.current === 'speaking';
    async function attempt() {
      try {
        await audio.play();
        if (isCurrent()) onStarted?.();
      } catch (error) {
        // A paused or replaced request can still reject after the browser
        // stops it. Only the current play request may pick another source.
        if (!isCurrent()) return;
        if (error?.name === 'NotAllowedError' && onAutoplayBlocked) {
          onAutoplayBlocked();
          return;
        }
        if (sourceIdxRef.current < GREETING_AUDIO_SOURCES.length - 1) {
          sourceIdxRef.current += 1;
          audio.src = GREETING_AUDIO_SOURCES[sourceIdxRef.current];
          audio.currentTime = 0;
          void attempt();
          return;
        }
        onStarted?.();
        runSpeechSynthesis();
      }
    }
    void attempt();
  }, [runSpeechSynthesis]);

  const runAudio = useCallback((onStarted, onAutoplayBlocked) => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(GREETING_AUDIO_SOURCES[sourceIdxRef.current]);
      audio.preload = 'metadata';
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        if (modeRef.current !== 'audio' || statusRef.current !== 'speaking' || !audio.duration || !Number.isFinite(audio.duration)) return;
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
      audio.addEventListener('ended', () => {
        if (modeRef.current === 'audio' && statusRef.current === 'speaking' && audio.ended) finish();
      });
    }

    audio.muted = mutedRef.current;
    audio.currentTime = 0;
    modeRef.current = 'audio';
    changeStatus('speaking');
    setSegmentIdx(0);
    playAudio(audio, onStarted, onAutoplayBlocked);
  }, [changeStatus, finish, playAudio]);

  /* ── Public actions ── */
  const start = useCallback((automatic = false) => {
    if (startLockRef.current || statusRef.current === 'speaking' || statusRef.current === 'paused') return;
    if (automatic && (!autoplayPending.current || mutedRef.current || document.hidden)) return;
    const previous = statusRef.current;
    startLockRef.current = true;
    if (!automatic) autoplayPending.current = false;
    runAudio(() => {
      autoplayPending.current = false;
      markPlayed();
      playWave(() => {
        if (statusRef.current === 'speaking') startTalking();
      });
    }, automatic ? () => {
      startLockRef.current = false;
      setSegmentIdx(-1);
      stopTalking();
      resetPose();
      changeStatus(previous);
    } : undefined);
  }, [changeStatus, playWave, resetPose, runAudio, startTalking, stopTalking]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'speaking') return;
    autoplayPending.current = false;
    changeStatus('paused');
    if (modeRef.current === 'audio') {
      playbackRef.current += 1;
      audioRef.current?.pause();
    } else if (modeRef.current === 'tts') window.speechSynthesis?.pause();
    else clearTextTimer();
    stopTalking();
    resetPose(); // robot returns to idle while paused
  }, [changeStatus, stopTalking, resetPose]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    changeStatus('speaking');
    startTalking();
    if (modeRef.current === 'audio') {
      if (audioRef.current) playAudio(audioRef.current, markPlayed);
    } else if (modeRef.current === 'tts') {
      window.speechSynthesis?.resume();
    } else {
      runTextCaptions(Math.max(segmentIdx, 0));
    }
  }, [changeStatus, startTalking, playAudio, runTextCaptions, segmentIdx]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setSoundPreference(!next);
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (modeRef.current === 'tts' && next && window.speechSynthesis) {
      // TTS volume can't change mid-utterance: switch to silent captions.
      modeRef.current = 'text';
      window.speechSynthesis.cancel();
      if (statusRef.current === 'speaking') {
        runTextCaptions(Math.max(segmentIdx, 0));
      }
    }
    if (!next && autoplayPending.current) start(true);
  }, [runTextCaptions, segmentIdx, start]);

  const stopEverything = useCallback(() => {
    playbackRef.current += 1;
    clearTextTimer();
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    stopTalking();
    resetPose();
    startLockRef.current = false;
  }, [stopTalking, resetPose]);

  const replay = useCallback(() => {
    stopEverything();
    changeStatus('ready');
    start();
  }, [changeStatus, stopEverything, start]);

  const close = useCallback(() => {
    autoplayPending.current = false;
    stopEverything();
    setSegmentIdx(-1);
    changeStatus(readPlayed() ? 'completed' : 'ready');
    restoreFocusRef.current = true;
    setOpen(false);
  }, [changeStatus, stopEverything]);

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
      playbackRef.current += 1;
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

  useEffect(() => {
    if (muted || !open) return undefined;
    const attempt = () => start(true);
    const stopListening = onSoundInteraction(attempt, '.robot-greeting, a[href]');
    const initialAttempt = setTimeout(attempt, 0);
    document.addEventListener('visibilitychange', attempt);
    return () => {
      clearTimeout(initialAttempt);
      stopListening();
      document.removeEventListener('visibilitychange', attempt);
    };
  }, [muted, open, start]);

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

  return (
    <div className="robot-greeting">
      {open ? <RobotSpeechBubble
        actionRef={actionRef}
        status={status}
        muted={muted}
        caption={caption}
        reducedMotion={reducedMotion}
        onStart={status === 'completed' || status === 'error' ? replay : () => start()}
        onPause={pause}
        onResume={resume}
        onToggleMute={toggleMute}
        onClose={close}
      /> : (
        <button
          ref={reopenRef}
          type="button"
          onClick={() => {
            restoreFocusRef.current = true;
            setOpen(true);
          }}
          aria-label="Open assistant greeting"
          className="robot-greeting__reopen"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Open greeting
        </button>
      )}

      {/* Screen-reader status updates */}
      <span className="sr-only" role="status">
        {status === 'speaking' && 'Greeting is playing.'}
        {status === 'paused' && 'Greeting paused.'}
        {status === 'completed' && 'Greeting finished.'}
      </span>
    </div>
  );
}
