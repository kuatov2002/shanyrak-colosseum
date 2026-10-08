// Instruments and sound effects, written against any BaseAudioContext so the same code plays live
// and renders offline (for peak normalisation and the listening check). Every effect is layered:
// a transient (what hits), a body (what it is made of) and a tail (the room, via the reverb send).

export interface VoiceOut {
  ac: BaseAudioContext;
  /** Dry destination. */
  out: AudioNode;
  /** Reverb send. */
  send: AudioNode;
  noise: AudioBuffer;
  /** A cached Karplus–Strong dombra note. */
  note(freq: number, bright?: number): AudioBuffer;
  /** Pitch of a scale degree in the current musical theme (0 = tonic). */
  degree(d: number): number;
}

/** A node that feeds the dry output and the reverb send (`wet` 0.1–0.3). */
function bus(v: VoiceOut, wet: number, gain = 1, dest = v.out): GainNode {
  const g = v.ac.createGain();
  g.gain.value = gain;
  g.connect(dest);
  if (wet > 0) {
    const s = v.ac.createGain();
    s.gain.value = wet;
    g.connect(s);
    s.connect(v.send);
  }
  return g;
}

function envelope(p: AudioParam, t: number, attack: number, peak: number, decay: number): void {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Oscillator with an optional exponential glide. */
function tone(v: VoiceOut, dest: AudioNode, type: OscillatorType, t: number, f0: number, f1: number, dur: number, peak: number, attack = 0.004): void {
  const o = v.ac.createOscillator();
  const g = v.ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  envelope(g.gain, t, attack, peak, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + dur + 0.02);
}

/** Filtered noise burst; the filter can sweep from f0 to f1. */
function hiss(v: VoiceOut, dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, attack = 0.002): void {
  const src = v.ac.createBufferSource();
  src.buffer = v.noise;
  const f = v.ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = v.ac.createGain();
  envelope(g.gain, t, attack, peak, dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * Math.max(0, v.noise.duration - dur - 0.1));
  src.stop(t + attack + dur + 0.02);
}

/** Pluck a dombra string. Returns the source so a later note on the same string can damp it. */
export function pluck(v: VoiceOut, dest: AudioNode, freq: number, t: number, peak: number, bright = 0.55, ring = 2): AudioBufferSourceNode {
  const src = v.ac.createBufferSource();
  src.buffer = v.note(freq, bright);
  const g = v.ac.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.setTargetAtTime(0.0001, t + ring, 0.08);
  src.connect(g).connect(dest);
  src.start(t);
  src.stop(t + Math.min(src.buffer.duration, ring + 0.5));
  return src;
}

/** Frame drum (dauylpaz): a sine with a pitch fall for the skin, a noise slap for the hand. */
export function drum(v: VoiceOut, dest: AudioNode, t: number, kind: "dum" | "tak", peak = 1): void {
  if (kind === "dum") {
    tone(v, dest, "sine", t, 128, 72, 0.34, 0.9 * peak, 0.002);
    hiss(v, dest, t, 0.05, "bandpass", 700, 500, 0.8, 0.28 * peak);
  } else {
    tone(v, dest, "sine", t, 210, 140, 0.12, 0.45 * peak, 0.001);
    hiss(v, dest, t, 0.06, "bandpass", 1900, 1300, 1.1, 0.5 * peak);
  }
}

/** Shaker (asatayak rattle): bright noise with a quick swell. */
export function shaker(v: VoiceOut, dest: AudioNode, t: number, peak = 1): void {
  hiss(v, dest, t, 0.07, "highpass", 6200, 7600, 0.7, 0.35 * peak, 0.012);
}

const VOWELS: [number, number][] = [
  [730, 1090],
  [530, 1840],
  [570, 840],
  [300, 870],
  [400, 2000],
];

/** One voice in the crowd: a short glottal buzz through two vowel formants, panned somewhere. */
export function blip(v: VoiceOut, dest: AudioNode, t: number, peak: number, cheer: boolean): void {
  const ac = v.ac;
  const f0 = cheer ? 170 + Math.random() * 140 : 105 + Math.random() * 110;
  const dur = 0.07 + Math.random() * (cheer ? 0.22 : 0.12);
  const o = ac.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * (cheer ? 1.22 : 0.88), t + dur);
  const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
  const g = ac.createGain();
  envelope(g.gain, t, 0.015, peak, dur);
  const pan = ac.createStereoPanner();
  pan.pan.value = Math.random() * 1.4 - 0.7;
  for (const [f, q, k] of [[f1, 6, 1], [f2, 9, 0.6]] as [number, number, number][]) {
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = q;
    const kg = ac.createGain();
    kg.gain.value = k;
    o.connect(bp).connect(kg).connect(g);
  }
  g.connect(pan).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.04);
}

// ── Sound effects ───────────────────────────────────────────────────────────

/** A room landing: contact click (transient), pitch-falling thump + felt thud (body), room (tail). */
function landing(v: VoiceOut, o: AudioNode, t: number, heavy: boolean): void {
  hiss(v, o, t, 0.02, "bandpass", 2300, 1600, 1.0, 0.5);
  tone(v, o, "sine", t, heavy ? 84 : 108, heavy ? 40 : 54, heavy ? 0.42 : 0.28, 0.95, 0.002);
  hiss(v, o, t + 0.004, heavy ? 0.24 : 0.15, "lowpass", 520, 260, 0.7, 0.55);
}

/** Bright chime partials over a plucked note (inharmonic 3.01 for a felt-bell colour). */
function chime(v: VoiceOut, o: AudioNode, t: number, f: number, peak: number): void {
  tone(v, o, "sine", t, f * 2, f * 2, 0.9, 0.22 * peak, 0.003);
  tone(v, o, "sine", t, f * 3.01, f * 3.01, 0.6, 0.09 * peak, 0.003);
}

export type SfxName =
  | "click"
  | "drop"
  | "place"
  | "placeHeavy"
  | "perfect"
  | "good"
  | "crack"
  | "miss"
  | "collapse"
  | "warning"
  | "event"
  | "bonus"
  | "uplift"
  | "shabyt"
  | "crown"
  | "reward";

/** Designed peak level of each effect (pre-limiter) — the normaliser scales every effect to it. */
export const SFX_LEVEL: Record<SfxName, number> = {
  click: 0.22,
  drop: 0.3,
  place: 0.5,
  placeHeavy: 0.58,
  perfect: 0.6,
  good: 0.52,
  crack: 0.6,
  miss: 0.55,
  collapse: 0.8,
  warning: 0.34,
  event: 0.45,
  bonus: 0.45,
  uplift: 0.36,
  shabyt: 0.5,
  crown: 0.75,
  reward: 0.42,
};

/** Effects; `k` is an optional intensity parameter (combo for perfect/uplift). */
export const SFX: Record<SfxName, (v: VoiceOut, t: number, k: number) => void> = {
  click(v, t) {
    const o = bus(v, 0.06);
    hiss(v, o, t, 0.022, "bandpass", 2600, 2200, 1.4, 0.6);
    tone(v, o, "triangle", t, 1320, 980, 0.05, 0.3, 0.002);
  },
  drop(v, t) {
    const o = bus(v, 0.1);
    hiss(v, o, t, 0.22, "bandpass", 1500, 520, 0.9, 0.5, 0.02);
    tone(v, o, "sine", t, 420, 300, 0.08, 0.12);
  },
  place(v, t) {
    landing(v, bus(v, 0.14), t, false);
  },
  placeHeavy(v, t) {
    landing(v, bus(v, 0.16), t, true);
  },
  perfect(v, t, combo) {
    const o = bus(v, 0.24);
    landing(v, o, t, false);
    const f = v.degree(2 + Math.min(8, combo));
    pluck(v, o, f, t + 0.012, 0.85, 0.75, 1.2);
    chime(v, o, t + 0.03, f, 1);
    hiss(v, o, t + 0.02, 0.28, "highpass", 7000, 9000, 0.7, 0.07, 0.04);
  },
  good(v, t) {
    const o = bus(v, 0.18);
    landing(v, o, t, false);
    pluck(v, o, v.degree(2), t + 0.012, 0.55, 0.5, 0.8);
  },
  crack(v, t) {
    const o = bus(v, 0.2);
    hiss(v, o, t, 0.03, "highpass", 3800, 3000, 0.7, 0.9, 0.001);
    landing(v, o, t + 0.006, true);
    // timber creak: a buzz through a sweeping band, then settling dust
    const src = v.ac.createOscillator();
    src.type = "sawtooth";
    src.frequency.setValueAtTime(150, t + 0.04);
    src.frequency.exponentialRampToValueAtTime(96, t + 0.36);
    const bp = v.ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(950, t + 0.04);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.36);
    const g = v.ac.createGain();
    envelope(g.gain, t + 0.04, 0.03, 0.32, 0.3);
    src.connect(bp).connect(g).connect(o);
    src.start(t + 0.04);
    src.stop(t + 0.42);
    hiss(v, o, t + 0.08, 0.4, "bandpass", 1900, 1200, 0.8, 0.16, 0.05);
  },
  miss(v, t) {
    const o = bus(v, 0.22);
    tone(v, o, "triangle", t, 720, 140, 0.62, 0.32, 0.01);
    hiss(v, o, t, 0.55, "bandpass", 1300, 320, 1.2, 0.24, 0.05);
    tone(v, o, "sine", t + 0.58, 74, 40, 0.38, 0.8, 0.003);
    hiss(v, o, t + 0.58, 0.3, "lowpass", 380, 200, 0.7, 0.5);
  },
  collapse(v, t) {
    const o = bus(v, 0.3);
    hiss(v, o, t, 0.035, "highpass", 3200, 2600, 0.7, 0.8, 0.001);
    hiss(v, o, t, 1.7, "lowpass", 220, 90, 0.8, 0.95, 0.05);
    tone(v, o, "sine", t, 52, 30, 1.4, 0.9, 0.03);
    for (let i = 0; i < 10; i++) {
      const at = t + 0.12 + Math.pow(i / 10, 1.4) * 1.3 + Math.random() * 0.05;
      hiss(v, o, at, 0.05 + Math.random() * 0.08, "bandpass", 900 + Math.random() * 2200, 700, 1.2, 0.18 + Math.random() * 0.22);
    }
  },
  warning(v, t) {
    const o = bus(v, 0.12);
    pluck(v, o, v.degree(5), t, 0.6, 0.8, 0.25);
    pluck(v, o, v.degree(4), t + 0.2, 0.6, 0.8, 0.3);
    drum(v, o, t, "tak", 0.5);
  },
  event(v, t) {
    const o = bus(v, 0.2);
    [0, 2, 4].forEach((d, i) => pluck(v, o, v.degree(d), t + i * 0.08, 0.6, 0.6, 0.7));
    drum(v, o, t, "dum", 0.8);
  },
  bonus(v, t) {
    const o = bus(v, 0.22);
    [2, 4, 5, 7].forEach((d, i) => pluck(v, o, v.degree(d), t + i * 0.065, 0.55, 0.7, 0.6));
    hiss(v, o, t + 0.05, 0.4, "highpass", 6500, 9000, 0.7, 0.08, 0.1);
  },
  uplift(v, t, combo) {
    // combo going up: a quick rising pair and a sparkle, a step higher each time
    const o = bus(v, 0.2);
    const d = 4 + Math.min(6, combo);
    pluck(v, o, v.degree(d), t, 0.5, 0.85, 0.4);
    pluck(v, o, v.degree(d + 2), t + 0.07, 0.5, 0.85, 0.5);
    chime(v, o, t + 0.07, v.degree(d + 2), 0.7);
  },
  shabyt(v, t) {
    const o = bus(v, 0.26);
    [0, 2, 4, 5, 7].forEach((d, i) => pluck(v, o, v.degree(d + 2), t + i * 0.055, 0.5, 0.8, 0.6));
    hiss(v, o, t, 0.6, "highpass", 4000, 9000, 0.6, 0.12, 0.35);
    for (let i = 0; i < 4; i++) drum(v, o, t + i * 0.06, "tak", 0.4 + i * 0.12);
  },
  crown(v, t) {
    // the finale: a swelling pad, a strummed rise, three drum strokes and bells, long tail
    const o = bus(v, 0.3);
    const ac = v.ac;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + 1.4);
    const pad = ac.createGain();
    pad.gain.setValueAtTime(0.0001, t);
    pad.gain.exponentialRampToValueAtTime(0.22, t + 0.9);
    pad.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    lp.connect(pad).connect(o);
    for (const [d, det] of [[0, -7], [4, 5], [7, 0]] as [number, number][]) {
      const s = ac.createOscillator();
      s.type = "sawtooth";
      s.frequency.value = v.degree(d) / 2;
      s.detune.value = det;
      s.connect(lp);
      s.start(t);
      s.stop(t + 3.3);
    }
    [0, 2, 4, 5, 7, 9].forEach((d, i) => pluck(v, o, v.degree(d), t + 0.15 + i * 0.09, 0.55, 0.65, 1.4));
    [0, 0.42, 0.84].forEach((dt, i) => drum(v, o, t + dt, i === 2 ? "dum" : "tak", 0.9));
    [7, 9, 11].forEach((d, i) => chime(v, o, t + 0.9 + i * 0.16, v.degree(d), 0.8));
  },
  reward(v, t) {
    const o = bus(v, 0.2);
    [4, 6, 7].forEach((d, i) => pluck(v, o, v.degree(d), t + i * 0.075, 0.5, 0.75, 0.5));
    chime(v, o, t + 0.15, v.degree(7), 0.6);
  },
};
