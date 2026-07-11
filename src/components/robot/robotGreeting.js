/**
 * Shared constants for the robot voice greeting feature.
 *
 * AUDIO FILE — place the final AI-generated voice file at:
 *   public/audio/robot-welcome.mp3
 * It is served from /audio/robot-welcome.mp3. If the file is missing,
 * the feature falls back to browser speech synthesis, then to
 * timed captions only. No key or API call happens in the browser.
 */

export const GREETING_AUDIO_SRC = '/audio/robot-welcome.mp3';

export const GREETING_STORAGE_KEY = 'parag-robot-greeting-played';

/** Progressive caption segments. `at` = fraction of total audio duration
 *  at which the segment begins (approximate, intentionally not word-level). */
export const GREETING_SEGMENTS = [
  { at: 0.0, text: "Hi, I'm Parag's digital assistant." },
  { at: 0.28, text: 'Parag builds websites, AI solutions, and helps solve everyday technology problems.' },
  { at: 0.68, text: 'Explore his work, check out his services, or get in touch.' },
];

export const GREETING_FULL_TEXT = GREETING_SEGMENTS.map((s) => s.text).join(' ');

/** Fallback per-segment display time (ms) when no audio duration is available. */
export const SEGMENT_FALLBACK_MS = 4200;
