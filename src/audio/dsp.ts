// Offline DSP for the procedural audio: Karplus–Strong dombra strings, a synthetic room impulse for
// the reverb, RBJ biquads to bake body resonance into buffers, and peak normalisation. Everything
// is computed in JS into AudioBuffers (WebAudio feedback loops can't be shorter than one render
// quantum, which would cap a node-based string at ~340 Hz).

class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    private readonly b0: number,
    private readonly b1: number,
    private readonly b2: number,
    private readonly a1: number,
    private readonly a2: number,
  ) {}
  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function make(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad {
  return new Biquad(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function coeffs(sr: number, f: number, q: number): { cs: number; al: number } {
  const w = (2 * Math.PI * f) / sr;
  return { cs: Math.cos(w), al: Math.sin(w) / (2 * q) };
}

function peaking(sr: number, f: number, q: number, db: number): Biquad {
  const A = Math.pow(10, db / 40);
  const { cs, al } = coeffs(sr, f, q);
  return make(1 + al * A, -2 * cs, 1 - al * A, 1 + al / A, -2 * cs, 1 - al / A);
}

function highpass(sr: number, f: number, q: number): Biquad {
  const { cs, al } = coeffs(sr, f, q);
  return make((1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al);
}

function bandpass(sr: number, f: number, q: number): Biquad {
  const { cs, al } = coeffs(sr, f, q);
  return make(al, 0, -al, 1 + al, -2 * cs, 1 - al);
}

/** Scale so the loudest sample sits at `target`; returns the applied gain. */
export function normalizePeak(data: Float32Array, target = 0.9): number {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 1e-6) return 1;
  const k = target / peak;
  for (let i = 0; i < data.length; i++) data[i] *= k;
  return k;
}

export function noiseBuffer(ac: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * One plucked string (Karplus–Strong): a delay line of one period fed back through a two-tap loss
 * filter and a first-order allpass for the fractional part of the period (exact tuning). The
 * excitation is noise shaped by a pick-position comb (plucked near the bridge → bright, hollow).
 * @param bright 0..1 — lower loss in the highs and a brighter excitation
 * @param t60 seconds for the note to fall by 60 dB
 */
function ksString(sr: number, freq: number, len: number, t60: number, bright: number, pick: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(len);
  const S = 0.5 - bright * 0.32; // loss filter weight; phase delay ≈ S samples
  const period = sr / freq;
  let N = Math.floor(period - S);
  let frac = period - S - N;
  if (frac < 0.15 && N > 2) {
    N -= 1;
    frac += 1;
  }
  const C = (1 - frac) / (1 + frac);
  const rho = Math.pow(0.001, 1 / (t60 * freq));
  const line = new Float32Array(N);
  const exc = new Float32Array(N);
  let lp = 0;
  const k = 0.3 + bright * 0.6;
  for (let i = 0; i < N; i++) {
    lp += (Math.random() * 2 - 1 - lp) * k;
    exc[i] = lp;
  }
  const P = Math.max(1, Math.round(pick * N));
  for (let i = 0; i < N; i++) line[i] = exc[i] - (i >= P ? exc[i - P] * 0.9 : 0);
  let idx = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  for (let n = 0; n < len; n++) {
    const y = line[idx];
    out[n] = y;
    const loss = (1 - S) * y + S * prev;
    prev = y;
    const ap = C * loss + apX - C * apY;
    apX = loss;
    apY = ap;
    line[idx] = ap * rho;
    if (++idx === N) idx = 0;
  }
  return out;
}

export interface DombraOpts {
  /** 0..1 */
  bright?: number;
  /** Decay to −60 dB, seconds. */
  t60?: number;
  /** Second string detune, cents (3–6). */
  detune?: number;
}

/**
 * A dombra note: two strings a few cents apart (the pair beats gently), a short band-passed noise
 * transient for the nail on the string, the wooden bowl's low resonance and a bright formant,
 * then peak-normalised.
 */
export function dombraNote(sr: number, freq: number, opts: DombraOpts = {}): Float32Array<ArrayBuffer> {
  const bright = opts.bright ?? 0.55;
  const t60 = opts.t60 ?? Math.min(2.2, 1.1 + 160 / freq);
  const detune = opts.detune ?? 4.5;
  const n = Math.floor(sr * Math.min(2.4, Math.max(0.8, t60 * 0.85)));
  const a = ksString(sr, freq, n, t60, bright, 0.13);
  const b = ksString(sr, freq * Math.pow(2, detune / 1200), n, t60 * 0.9, bright * 0.85, 0.17);
  const out = new Float32Array(n);
  const click = bandpass(sr, 3200, 0.9);
  const clickLen = Math.floor(sr * 0.012);
  for (let i = 0; i < n; i++) {
    let v = a[i] * 0.55 + b[i] * 0.45;
    if (i < clickLen) v += click.process(Math.random() * 2 - 1) * 0.55 * Math.pow(1 - i / clickLen, 2);
    out[i] = v;
  }
  const hp = highpass(sr, 70, 0.7);
  const bowl = peaking(sr, 210, 1.3, 5);
  const formant = peaking(sr, 2600, 1.0, 3);
  for (let i = 0; i < n; i++) out[i] = formant.process(bowl.process(hp.process(out[i])));
  const fade = Math.floor(sr * 0.03);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  normalizePeak(out, 0.9);
  return out;
}

/**
 * Synthetic room impulse: a few early reflections, then decaying noise that darkens over time
 * (high frequencies die first), with a short pre-delay. Stereo, slightly decorrelated.
 */
export function roomImpulse(ac: BaseAudioContext, seconds = 1.5): AudioBuffer {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ac.createBuffer(2, len, sr);
  const pre = Math.floor(sr * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.48 * t);
      d[i] = lp * Math.exp(-6.9 * t);
    }
    for (const [ms, g] of [[17, 0.55], [29, 0.4], [41, 0.3], [63, 0.22], [87, 0.15]] as [number, number][]) {
      const j = Math.floor((sr * (ms + ch * 3.1)) / 1000);
      if (j < len) d[j] += ch ? -g : g;
    }
    normalizePeak(d, 0.8);
  }
  return buf;
}
