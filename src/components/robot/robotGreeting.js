/** The same narration in MP3 and AAC for browser compatibility. */
export const GREETING_AUDIO_SOURCES = ['/audio/robot-welcome.mp3', '/audio/robot-welcome.m4a'];

export const GREETING_STORAGE_KEY = 'parag-robot-greeting-played';

/** The start of each caption as a fraction of the prerecorded narration. */
export const GREETING_SEGMENTS = [
  { at: 0, text: "Hi, I’m Parag’s digital assistant. Thanks for stopping by." },
  { at: 0.19496, text: 'Parag works on AI products, software automation, and GPU infrastructure.' },
  { at: 0.43945, text: 'In the Engineering Lab, you can replay an incident with InfraPilot, build a workflow in RelayOps, or compare GPU schedulers in ComputeFlow, all with simulated data.' },
  { at: 0.91612, text: 'I hope you enjoy exploring.' },
];

export const GREETING_FULL_TEXT = GREETING_SEGMENTS.map((s) => s.text).join(' ');
export const GREETING_DURATION_MS = 22_169;
