/**
 * Procedural sound design for the site. Everything is synthesised in the
 * browser with the Web Audio API: no audio files, no licences, no network
 * requests, so the same code runs on any host.
 *
 * The opening sting fires once the browser allows playback, followed by
 * the rain and hum.
 */

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  rain: GainNode;
  hum: GainNode;
  lastGlitch: number;
  stingPlayed: boolean;
};

let engine: Engine | null = null;
let enabled = false;
let requested = false;

const MASTER_VOLUME = 0.5;

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.4;
  }
  return buffer;
}

function build(ctx: AudioContext): Engine {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  /* rain: two filtered noise layers, slowly breathing */
  const buffer = noiseBuffer(ctx, 4);

  const rain = ctx.createGain();
  rain.gain.value = 0.5;
  rain.connect(master);

  const sheet = ctx.createBufferSource();
  sheet.buffer = buffer;
  sheet.loop = true;
  const sheetFilter = ctx.createBiquadFilter();
  sheetFilter.type = "bandpass";
  sheetFilter.frequency.value = 1500;
  sheetFilter.Q.value = 0.6;
  const sheetGain = ctx.createGain();
  sheetGain.gain.value = 0.085;
  sheet.connect(sheetFilter).connect(sheetGain).connect(rain);

  const rumble = ctx.createBufferSource();
  rumble.buffer = buffer;
  rumble.loop = true;
  rumble.playbackRate.value = 0.55;
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 380;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.16;
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(rain);

  const breath = ctx.createOscillator();
  breath.type = "sine";
  breath.frequency.value = 0.06;
  const breathDepth = ctx.createGain();
  breathDepth.gain.value = 0.035;
  breath.connect(breathDepth).connect(sheetGain.gain);
  breath.start();

  sheet.start();
  rumble.start();

  /* neon hum: two low tones through a soft filter with slow tremolo */
  const hum = ctx.createGain();
  hum.gain.value = 0.5;
  hum.connect(master);

  const humFilter = ctx.createBiquadFilter();
  humFilter.type = "lowpass";
  humFilter.frequency.value = 420;
  humFilter.Q.value = 0.9;
  humFilter.connect(hum);

  const humGain = ctx.createGain();
  humGain.gain.value = 0.05;
  humGain.connect(humFilter);

  const toneA = ctx.createOscillator();
  toneA.type = "sawtooth";
  toneA.frequency.value = 55;
  toneA.detune.value = -6;
  const toneB = ctx.createOscillator();
  toneB.type = "sine";
  toneB.frequency.value = 110;
  toneB.detune.value = 4;
  toneA.connect(humGain);
  toneB.connect(humGain);
  toneA.start();
  toneB.start();

  const tremolo = ctx.createOscillator();
  tremolo.type = "sine";
  tremolo.frequency.value = 0.13;
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.018;
  tremolo.connect(tremoloDepth).connect(humGain.gain);
  tremolo.start();

  return { ctx, master, rain, hum, lastGlitch: 0, stingPlayed: false };
}

function sting(current: Engine) {
  const { ctx, master } = current;
  const now = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
  bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
  bus.connect(master);

  [196, 294, 392, 588].forEach((hz, index) => {
    const osc = ctx.createOscillator();
    osc.type = index % 2 === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(hz * 1.01, now);
    osc.frequency.exponentialRampToValueAtTime(hz, now + 0.6);
    const gain = ctx.createGain();
    gain.gain.value = 0.32 / (index + 1);
    osc.connect(gain).connect(bus);
    osc.start(now + index * 0.015);
    osc.stop(now + 2);
  });

  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, 1.2);
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = "bandpass";
  airFilter.frequency.setValueAtTime(700, now);
  airFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.8);
  airFilter.Q.value = 1.2;
  const airGain = ctx.createGain();
  airGain.gain.setValueAtTime(0.0001, now);
  airGain.gain.exponentialRampToValueAtTime(0.09, now + 0.12);
  airGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  air.connect(airFilter).connect(airGain).connect(bus);
  air.start(now);
  air.stop(now + 1.2);
}

export async function enableSound(): Promise<void> {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  requested = true;
  if (enabled && engine?.ctx.state === "running") return;

  try {
    if (!engine) engine = build(new Ctor());
    await engine.ctx.resume();
  } catch {
    return;
  }
  if (!requested || engine.ctx.state !== "running" || enabled) return;

  enabled = true;
  const now = engine.ctx.currentTime;
  engine.master.gain.cancelScheduledValues(now);
  engine.master.gain.setValueAtTime(engine.master.gain.value, now);
  engine.master.gain.linearRampToValueAtTime(MASTER_VOLUME, now + 1.4);

  if (!engine.stingPlayed) {
    engine.stingPlayed = true;
    sting(engine);
  }
}

export function disableSound(): void {
  requested = false;
  enabled = false;
  if (!engine) return;
  const now = engine.ctx.currentTime;
  engine.master.gain.cancelScheduledValues(now);
  engine.master.gain.setValueAtTime(engine.master.gain.value, now);
  engine.master.gain.linearRampToValueAtTime(0, now + 0.45);

  /* park the graph once the fade lands, so a muted tab costs nothing */
  const audio = engine.ctx;
  window.setTimeout(() => {
    if (!enabled && audio.state === "running") {
      void audio.suspend();
    }
  }, 600);
}

/** Short hover tick: filtered noise burst plus a falling blip. */
export function glitch(): void {
  if (!enabled || !engine) return;
  const { ctx, master } = engine;
  const now = ctx.currentTime;
  if (now - engine.lastGlitch < 0.11) return;
  engine.lastGlitch = now;

  const burst = ctx.createBufferSource();
  burst.buffer = noiseBuffer(ctx, 0.12);
  burst.playbackRate.value = 1.4;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  burst.connect(filter).connect(gain).connect(master);
  burst.start(now);
  burst.stop(now + 0.12);

  const blip = ctx.createOscillator();
  blip.type = "square";
  blip.frequency.setValueAtTime(1250, now);
  blip.frequency.exponentialRampToValueAtTime(280, now + 0.07);
  const blipGain = ctx.createGain();
  blipGain.gain.setValueAtTime(0.05, now);
  blipGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  blip.connect(blipGain).connect(master);
  blip.start(now);
  blip.stop(now + 0.09);
}
