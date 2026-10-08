// Procedural audio (WebAudio, no files). Signal flow:
//
//   music ─→ duck ─┐
//   sfx ───────────┼─→ master ─→ limiter (DynamicsCompressor) ─→ speakers
//   ambient ───────┘     ↑
//   sends (10–25 %) ─→ convolver (synthetic 1.5 s room) ─┘
//
// Music: Karplus–Strong dombra, frame drum and shaker; three themes in folk modes × two
// intensities (music.ts). Effects are layered (transient + body + tail) and peak-normalised by an
// offline render at start-up (voices.ts). Ambience: wind with LFOs, a campus crowd murmur with
// formant voices. The context resumes on the first gesture; pause and a hidden tab mute every bus.

import { dombraNote, noiseBuffer, roomImpulse } from "./dsp";
import { degreeHz, playStep, stepSeconds, THEMES, type MusicTheme, type StringState } from "./music";
import { blip, SFX, SFX_LEVEL, type SfxName, type VoiceOut } from "./voices";

export type { MusicTheme } from "./music";

/** Bus trims at volume 1.0 (settings sliders scale these). */
const MUSIC_TRIM = 0.42;
const SFX_TRIM = 0.9;
const AMB_TRIM = 0.55;
/** Reverb sends of the music and ambient buses (effects set their own, 10–30 %). */
const MUSIC_SEND = 0.22;
const AMB_SEND = 0.12;
/** −3 dB under the finale sting. */
const DUCK = 0.708;
const REVERB_RETURN = 0.8;
const NOTE_CACHE = 64;

export class Sound {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicDuck!: GainNode;
  private sfxBus!: GainNode;
  /** Reverb send of the effects; follows the sfx bus gain so pause/volume mute the tails too. */
  private sfxWet!: GainNode;
  private ambBus!: GainNode;
  private reverbIn!: GainNode;
  private reverbOut!: GainNode;
  private noise!: AudioBuffer;
  private notes = new Map<string, AudioBuffer>();
  private norm: Partial<Record<SfxName, number>> = {};
  private paused = false;
  private hidden = false;
  private theme: MusicTheme = "mus_campus";
  private intensity = 0;
  private scene: "menu" | "round" = "menu";
  private musicWanted = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepT = 0;
  private step = 0;
  private strings: StringState = { melody: null };
  private windGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private cheerUntil = 0;
  private nextBlipT = 0;
  private upliftK = 0;
  private upliftT = 0;
  sfxVolume = 0.8;
  musicVolume = 0.5;
  ambientVolume = 0.6;

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (this.ac) {
      if (this.ac.state === "suspended" && !this.hidden) void this.ac.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ac = new AC();
    } catch {
      return;
    }
    const ac = this.ac;
    this.noise = noiseBuffer(ac, 3);

    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    const out = ac.createGain();
    out.gain.value = 0.95;
    this.master = ac.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(limiter).connect(out).connect(ac.destination);

    const conv = ac.createConvolver();
    conv.buffer = roomImpulse(ac, 1.5);
    this.reverbIn = ac.createGain();
    this.reverbOut = ac.createGain();
    this.reverbIn.connect(conv).connect(this.reverbOut).connect(this.master);

    this.musicBus = ac.createGain();
    this.musicDuck = ac.createGain();
    this.musicBus.connect(this.musicDuck).connect(this.master);
    this.send(this.musicDuck, MUSIC_SEND);
    this.sfxBus = ac.createGain();
    this.sfxBus.connect(this.master);
    this.sfxWet = ac.createGain();
    this.sfxWet.connect(this.reverbIn);
    this.ambBus = ac.createGain();
    this.ambBus.connect(this.master);
    this.send(this.ambBus, AMB_SEND);
    for (const g of [this.musicBus, this.sfxBus, this.sfxWet, this.ambBus, this.reverbOut]) g.gain.value = 0;

    this.buildAmbience();
    this.hidden = document.hidden;
    document.addEventListener("visibilitychange", this.onVisibility);
    this.applyGains();
    this.timer = setInterval(() => this.tick(), 50);
    // measure every effect offline once the first tap has been answered
    setTimeout(() => void this.calibrate(), 600);
    this.prewarm();
  }

  /** Synthesise the theme's notes in idle time (~6 ms each) so the first bars never hitch. */
  private prewarm(): void {
    if (!this.ac) return;
    const theme = this.theme;
    const def = THEMES[theme];
    const jobs: [number, number][] = [];
    const degrees = new Set<number>();
    for (const p of def.phrases) for (const d of p) if (d >= 0) degrees.add(d);
    for (const d of degrees) jobs.push([degreeHz(theme, d), 0.5]);
    const root = def.tonic / 2;
    jobs.push([root, 0.5], [root * 1.5, 0.5], [root, 0.8], [root * 1.5, 0.8]);
    for (let d = 2; d <= 12; d++) jobs.push([degreeHz(theme, d), 0.8]);
    type Idle = (cb: (d: { timeRemaining(): number }) => void) => void;
    const idle: Idle =
      (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback ?? ((cb) => setTimeout(() => cb({ timeRemaining: () => 10 }), 40));
    const run = (deadline: { timeRemaining(): number }) => {
      while (jobs.length && this.ac && deadline.timeRemaining() > 7) {
        const [f, b] = jobs.shift()!;
        this.note(f, b);
      }
      if (jobs.length && this.ac && this.theme === theme) idle(run);
    };
    idle(run);
  }

  private send(from: AudioNode, amount: number): void {
    const s = this.ac!.createGain();
    s.gain.value = amount;
    from.connect(s).connect(this.reverbIn);
  }

  private readonly onVisibility = () => {
    if (!this.ac) return;
    this.hidden = document.hidden;
    this.applyGains();
    if (this.hidden) void this.ac.suspend();
    else void this.ac.resume();
  };

  /** Bus gains from the settings; pause and a hidden tab take every bus to silence. */
  private applyGains(): void {
    const ac = this.ac;
    if (!ac) return;
    const mute = this.paused || this.hidden;
    const t = ac.currentTime;
    const set = (g: GainNode, v: number) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(mute ? 0 : v, t, 0.03);
    };
    set(this.musicBus, this.musicVolume * MUSIC_TRIM);
    set(this.sfxBus, this.sfxVolume * SFX_TRIM);
    set(this.sfxWet, this.sfxVolume * SFX_TRIM);
    set(this.ambBus, this.ambientVolume * AMB_TRIM);
    set(this.reverbOut, REVERB_RETURN);
  }

  setVolumes(sfx: number, music: number, ambient = this.ambientVolume): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.ambientVolume = ambient;
    this.applyGains();
  }

  /** Round paused (or resumed): all buses and the reverb tails fade out/in, the sequencer holds its place. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.applyGains();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** 0 = dombra alone, 1 = with frame drum, shaker and up-strokes. */
  setIntensity(level: number): void {
    this.intensity = level > 0 ? 1 : 0;
  }

  /** Menus are quieter than a round: softer crowd, no wind. */
  setScene(scene: "menu" | "round"): void {
    if (scene === this.scene) return;
    this.scene = scene;
    if (scene === "menu") this.setWind(0);
    this.crowdTo(this.crowdBase(), 0.6);
  }

  // ── buffers ─────────────────────────────────────────────────────────────

  private note(freq: number, bright = 0.55): AudioBuffer {
    const ac = this.ac!;
    const b = bright >= 0.65 ? 0.8 : 0.5;
    const key = `${Math.round(freq * 4)}|${b}`;
    let buf = this.notes.get(key);
    if (buf) {
      // keep recently used notes at the end of the map (LRU)
      this.notes.delete(key);
      this.notes.set(key, buf);
      return buf;
    }
    const data = dombraNote(ac.sampleRate, freq, { bright: b, t60: Math.min(1.8, 1.0 + 150 / freq) });
    buf = ac.createBuffer(1, data.length, ac.sampleRate);
    buf.copyToChannel(data, 0);
    this.notes.set(key, buf);
    if (this.notes.size > NOTE_CACHE) this.notes.delete(this.notes.keys().next().value as string);
    return buf;
  }

  private voice(out: AudioNode, send: AudioNode, ac: BaseAudioContext = this.ac!): VoiceOut {
    return { ac, out, send, noise: this.noise, note: (f, b) => this.note(f, b), degree: (d) => degreeHz(this.theme, d) };
  }

  /** Render every effect offline and scale it to its designed peak (SFX_LEVEL). */
  private async calibrate(): Promise<void> {
    const ac = this.ac;
    if (!ac || typeof OfflineAudioContext === "undefined") return;
    const sr = ac.sampleRate;
    for (const name of Object.keys(SFX) as SfxName[]) {
      try {
        const dur = name === "crown" ? 3.6 : name === "collapse" ? 2.2 : 1.4;
        const oc = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
        SFX[name](this.voice(oc.destination, oc.createGain(), oc), 0.01, 3);
        const d = (await oc.startRendering()).getChannelData(0);
        let peak = 0;
        for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
        if (peak > 1e-4) this.norm[name] = Math.min(4, Math.max(0.2, SFX_LEVEL[name] / peak));
      } catch {
        /* keep unity gain for this one */
      }
    }
  }

  /** Peak-normalisation gains measured at start-up (for the listening report). */
  get normalisation(): Readonly<Partial<Record<SfxName, number>>> {
    return this.norm;
  }

  // ── effects ─────────────────────────────────────────────────────────────

  private fx(name: SfxName, k = 0): void {
    const ac = this.ac;
    if (!ac || this.paused || this.hidden || this.sfxVolume <= 0) return;
    const n = this.norm[name] ?? 1;
    const dry = ac.createGain();
    dry.gain.value = n;
    dry.connect(this.sfxBus);
    const wet = ac.createGain();
    wet.gain.value = n;
    wet.connect(this.sfxWet);
    SFX[name](this.voice(dry, wet), ac.currentTime + 0.005, k);
    setTimeout(() => {
      dry.disconnect();
      wet.disconnect();
    }, 5000);
  }

  click(): void {
    this.fx("click");
  }
  drop(): void {
    this.fx("drop");
  }
  thud(heavy = false): void {
    this.fx(heavy ? "placeHeavy" : "place");
  }
  perfect(combo: number): void {
    this.fx("perfect", combo);
    this.cheer(combo >= 3 ? 1.1 : 0.6);
  }
  good(): void {
    this.fx("good");
  }
  bad(): void {
    this.fx("crack");
  }
  miss(): void {
    this.fx("miss");
  }
  collapse(): void {
    this.fx("collapse");
  }
  warning(): void {
    this.fx("warning");
  }
  event(): void {
    this.fx("event");
  }
  bonus(): void {
    this.fx("bonus");
  }
  /** Combo uplift / coins: each call within two seconds climbs a step. */
  coin(): void {
    const now = this.ac?.currentTime ?? 0;
    this.upliftK = now - this.upliftT < 2 ? Math.min(6, this.upliftK + 1) : 0;
    this.upliftT = now;
    this.fx("uplift", this.upliftK);
  }
  shabyt(): void {
    this.fx("shabyt");
    this.cheer(1.4);
  }
  /** The shanyrak finale: music ducks −3 dB under the sting, the crowd cheers. */
  crown(): void {
    const ac = this.ac;
    if (ac) {
      const t = ac.currentTime;
      const g = this.musicDuck.gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(DUCK, t, 0.05);
      g.setTargetAtTime(1, t + 3.4, 0.5);
    }
    this.fx("crown");
    this.cheer(3);
  }
  reward(): void {
    this.fx("reward");
  }

  // ── ambience ────────────────────────────────────────────────────────────

  private buildAmbience(): void {
    const ac = this.ac!;
    const lfo = (freq: number, depth: number, target: AudioParam) => {
      const o = ac.createOscillator();
      o.frequency.value = freq;
      const g = ac.createGain();
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start();
    };
    // Wind: band-passed noise whose centre wanders (LFO) and whose level gusts (second LFO), with a
    // narrow whistle band on top that only shows when the wind is strong.
    const wsrc = ac.createBufferSource();
    wsrc.buffer = this.noise;
    wsrc.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 480;
    bp.Q.value = 0.9;
    lfo(0.11, 190, bp.frequency);
    const whistle = ac.createBiquadFilter();
    whistle.type = "bandpass";
    whistle.frequency.value = 1150;
    whistle.Q.value = 7;
    lfo(0.17, 140, whistle.frequency);
    const whistleGain = ac.createGain();
    whistleGain.gain.value = 0.3;
    const gust = ac.createGain();
    gust.gain.value = 0.8;
    lfo(0.23, 0.35, gust.gain);
    this.windGain = ac.createGain();
    this.windGain.gain.value = 0;
    wsrc.connect(bp).connect(gust);
    wsrc.connect(whistle).connect(whistleGain).connect(gust);
    gust.connect(this.windGain).connect(this.ambBus);
    wsrc.start(0, 0.4);
    // Crowd murmur: speech-band noise under three slow amplitude LFOs (a babble); the formant
    // voices on top are scheduled in tick().
    const csrc = ac.createBufferSource();
    csrc.buffer = this.noise;
    csrc.loop = true;
    const low = ac.createBiquadFilter();
    low.type = "bandpass";
    low.frequency.value = 520;
    low.Q.value = 0.7;
    const high = ac.createBiquadFilter();
    high.type = "bandpass";
    high.frequency.value = 1500;
    high.Q.value = 1.2;
    const highGain = ac.createGain();
    highGain.gain.value = 0.5;
    const am = ac.createGain();
    am.gain.value = 0.6;
    for (const f of [0.37, 0.53, 0.71]) lfo(f, 0.13, am.gain);
    this.crowdGain = ac.createGain();
    this.crowdGain.gain.value = this.crowdBase();
    csrc.connect(low).connect(am);
    csrc.connect(high).connect(highGain).connect(am);
    am.connect(this.crowdGain).connect(this.ambBus);
    csrc.start(0, 1.7);
  }

  private crowdBase(): number {
    return this.scene === "round" ? 0.12 : 0.07;
  }

  private crowdTo(v: number, tc: number): void {
    if (!this.ac || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(v, this.ac.currentTime, tc);
  }

  /** The crowd swells and more voices call out for `seconds`. */
  private cheer(seconds: number): void {
    const ac = this.ac;
    if (!ac || !this.crowdGain) return;
    const t = ac.currentTime;
    this.cheerUntil = Math.max(this.cheerUntil, t + seconds);
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.crowdBase() * 2.2, t, 0.08);
    g.setTargetAtTime(this.crowdBase(), this.cheerUntil, 0.5);
  }

  setWind(strength: number): void {
    if (!this.ac || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(Math.min(1, Math.max(0, strength)) * 0.5, this.ac.currentTime, 0.4);
  }

  // ── music ───────────────────────────────────────────────────────────────

  startMusic(theme: MusicTheme): void {
    this.musicWanted = true;
    this.setTheme(theme);
  }

  setTheme(theme: MusicTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.step = 0;
    this.prewarm();
  }

  stopMusic(): void {
    this.musicWanted = false;
  }

  /** Lookahead scheduler (50 ms timer, 200 ms horizon): music steps and crowd voices. */
  private tick(): void {
    const ac = this.ac;
    if (!ac || ac.state !== "running") return;
    const now = ac.currentTime;
    if (this.paused || this.hidden) {
      this.nextStepT = now + 0.1;
      this.nextBlipT = now + 0.3;
      return;
    }
    if (this.musicWanted && this.musicVolume > 0) {
      if (this.nextStepT < now) this.nextStepT = now + 0.05;
      const v = this.voice(this.musicBus, this.reverbIn);
      while (this.nextStepT < now + 0.2) {
        playStep(v, this.strings, this.theme, this.step, this.nextStepT, this.intensity);
        this.nextStepT += stepSeconds(this.theme);
        this.step++;
      }
    }
    if (this.ambientVolume > 0) {
      if (this.nextBlipT < now) this.nextBlipT = now + 0.05;
      const v = this.voice(this.ambBus, this.reverbIn);
      while (this.nextBlipT < now + 0.2) {
        const cheer = this.nextBlipT < this.cheerUntil;
        blip(v, this.ambBus, this.nextBlipT, (cheer ? 0.09 : 0.04) * (this.scene === "round" ? 1 : 0.6), cheer);
        this.nextBlipT += cheer ? 0.05 + Math.random() * 0.12 : 0.35 + Math.random() * 0.9;
      }
    }
  }

  /** Stop the scheduler and release the audio device (game unmounted). */
  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.ac?.close();
    this.ac = null;
  }

  vibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not supported */
    }
  }
}
