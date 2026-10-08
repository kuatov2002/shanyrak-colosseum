// Generative dombra music: three themes in folk modes, each a kui-like melody over a strummed drone
// (the two-string dombra: melody on one string, the open strings ringing under it). Intensity 0 is
// dombra alone; intensity 1 adds the frame drum, the shaker and the up-strokes of the strum.
// One step = one eighth note; four 16-step phrases make a verse.

import { drum, pluck, shaker, type VoiceOut } from "./voices";

export type MusicTheme = "mus_campus" | "mus_nauryz" | "mus_session";

interface ThemeDef {
  bpm: number;
  /** Melody root, Hz (the drone sits an octave below). */
  tonic: number;
  /** Mode as semitones from the root. */
  mode: number[];
  /** Scale degrees per step, -1 = rest. */
  phrases: number[][];
  order: number[];
  /** Strum: D = down-stroke over both open strings, u = light up-stroke (intensity 1 only). */
  strum: string;
  /** B = dum (low), t = tak (high). */
  drum: string;
  /** x = accent, o = soft. */
  shaker: string;
  /** Delay of off-beats, fraction of a step. */
  swing: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];

export const THEMES: Record<MusicTheme, ThemeDef> = {
  // Campus: D Dorian, an easy walking kui
  mus_campus: {
    bpm: 104,
    tonic: 293.66,
    mode: DORIAN,
    phrases: [
      [4, -1, 3, 4, 2, -1, 0, -1, 1, 2, 3, -1, 2, 1, 0, -1],
      [4, -1, 3, 4, 5, -1, 4, -1, 3, 4, 5, 7, 6, 5, 4, -1],
      [7, -1, 6, 5, 4, -1, 5, 4, 3, -1, 2, 1, 0, -1, -1, -1],
    ],
    order: [0, 1, 0, 2],
    strum: "D.u.D.uuD.u.D.uu",
    drum: "B..t..B.B..t.t..",
    shaker: "x.o.x.o.x.o.x.oo",
    swing: 0.08,
  },
  // Nauryz: G Mixolydian, festive and quick
  mus_nauryz: {
    bpm: 126,
    tonic: 392,
    mode: MIXOLYDIAN,
    phrases: [
      [0, 2, 4, -1, 4, 5, 4, 2, 0, 2, 4, 7, 6, 4, 5, -1],
      [0, 2, 4, -1, 4, 5, 7, 5, 4, 2, 1, 2, 0, -1, 0, -1],
      [7, -1, 8, 7, 6, -1, 5, 4, 5, 4, 2, -1, 4, -1, -1, -1],
    ],
    order: [0, 1, 0, 2],
    strum: "DuuDuuDuDuuDuuDu",
    drum: "B.tBt.B.B.tBt.Bt",
    shaker: "xoooxoooxoooxoxo",
    swing: 0.05,
  },
  // Session night: A Aeolian, slow and sparse
  mus_session: {
    bpm: 74,
    tonic: 220,
    mode: AEOLIAN,
    phrases: [
      [0, -1, -1, 2, 3, -1, -1, -1, 4, -1, 3, -1, 2, -1, -1, -1],
      [4, -1, 5, -1, 4, -1, 3, -1, 2, -1, 1, -1, 0, -1, -1, -1],
      [-1, -1, 7, -1, 5, -1, 4, -1, 3, -1, -1, 2, 0, -1, -1, -1],
    ],
    order: [0, 1, 0, 2],
    strum: "D...u...D...u.u.",
    drum: "B.......B...t...",
    shaker: "....o.......o...",
    swing: 0,
  },
};

/** Pitch of a scale degree (degrees past the mode wrap into higher octaves). */
export function degreeHz(theme: MusicTheme, d: number): number {
  const def = THEMES[theme];
  const m = def.mode;
  const oct = Math.floor(d / m.length);
  const i = ((d % m.length) + m.length) % m.length;
  return def.tonic * Math.pow(2, (m[i] + 12 * oct) / 12);
}

export function stepSeconds(theme: MusicTheme): number {
  return 60 / THEMES[theme].bpm / 2;
}

/** Strings currently ringing, so a new note on the same string damps the old one (monophonic string). */
export interface StringState {
  melody: AudioBufferSourceNode | null;
}

function damp(src: AudioBufferSourceNode | null, t: number): void {
  if (!src) return;
  try {
    src.stop(t + 0.03);
  } catch {
    /* already stopped */
  }
}

/** Schedule step `step` of the theme at time `t`. */
export function playStep(v: VoiceOut, strings: StringState, theme: MusicTheme, step: number, t: number, intensity: number): void {
  const def = THEMES[theme];
  const i = step % 16;
  const phrase = def.phrases[def.order[Math.floor(step / 16) % def.order.length]];
  const at = t + (i % 2 === 1 ? def.swing * stepSeconds(theme) : 0);
  const d = phrase[i];
  if (d >= 0) {
    damp(strings.melody, at);
    strings.melody = pluck(v, v.out, degreeHz(theme, d), at, intensity ? 0.62 : 0.55, 0.6, stepSeconds(theme) * 3.2);
  }
  // drone: root and fifth an octave below the melody, strummed low string first
  const s = def.strum[i];
  if (s === "D" || (s === "u" && intensity > 0)) {
    const root = def.tonic / 2;
    const up = s === "u";
    const k = up ? 0.22 : 0.34;
    const order = up ? [root * 1.5, root] : [root, root * 1.5];
    order.forEach((f, j) => pluck(v, v.out, f, at + j * 0.007, k, up ? 0.7 : 0.45, stepSeconds(theme) * (up ? 1 : 2.2)));
  }
  if (intensity > 0) {
    const dr = def.drum[i];
    if (dr === "B") drum(v, v.out, at, "dum", 0.75);
    else if (dr === "t") drum(v, v.out, at, "tak", 0.55);
    const sh = def.shaker[i];
    if (sh === "x") shaker(v, v.out, at, 0.5);
    else if (sh === "o") shaker(v, v.out, at, 0.28);
  }
}
