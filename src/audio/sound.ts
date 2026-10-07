// Procedural audio (WebAudio, no files): every sound is synthesised so the build stays tiny and
// the palette stays coherent — plucked dombra-like tones in a pentatonic scale, soft thuds, felt.

type MusicTheme = "mus_campus" | "mus_nauryz" | "mus_session";

// D minor pentatonic-ish scale for chimes (Hz)
const SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66];

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private theme: MusicTheme = "mus_campus";
  sfxVolume = 0.8;
  musicVolume = 0.5;
  private musicWanted = false;

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.35;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (this.musicWanted) this.startMusic(this.theme);
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
    if (this.musicBus) this.musicBus.gain.value = music * 0.35;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, attack = 0.005, bus?: GainNode | null): void {
    const ctx = this.ctx;
    const out = bus ?? this.sfxBus;
    if (!ctx || !out) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Plucked string: saw through a closing low-pass — reads as dombra. */
  private pluck(freq: number, dur: number, vol: number, when = 0, bus?: GainNode | null): void {
    const ctx = this.ctx;
    const out = bus ?? this.sfxBus;
    if (!ctx || !out) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + dur * 0.8);
    f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, filter: BiquadFilterType, freq: number, when = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noise) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  click(): void {
    this.tone(880, 0.06, "triangle", 0.12);
  }
  drop(): void {
    this.noiseBurst(0.18, 0.08, "bandpass", 900);
  }
  thud(heavy = false): void {
    this.tone(heavy ? 70 : 95, heavy ? 0.35 : 0.22, "sine", heavy ? 0.5 : 0.38);
    this.noiseBurst(0.12, 0.12, "lowpass", 400);
  }
  perfect(combo: number): void {
    this.thud();
    const i = Math.min(SCALE.length - 3, 2 + combo);
    this.pluck(SCALE[i], 0.5, 0.22, 0.02);
    this.tone(SCALE[i + 2], 0.6, "triangle", 0.12, 0.08);
    this.tone(SCALE[i] * 2, 0.4, "sine", 0.05, 0.12);
  }
  good(): void {
    this.thud();
    this.pluck(SCALE[3], 0.35, 0.14, 0.02);
  }
  bad(): void {
    this.thud(true);
    this.noiseBurst(0.25, 0.22, "highpass", 2200, 0.02);
    this.tone(140, 0.4, "sawtooth", 0.06, 0.05);
  }
  miss(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.7);
    this.noiseBurst(0.4, 0.25, "lowpass", 600, 0.55);
  }
  collapse(): void {
    this.tone(55, 1.2, "sine", 0.5);
    this.noiseBurst(1.2, 0.35, "lowpass", 300);
    this.noiseBurst(0.6, 0.2, "bandpass", 1200, 0.3);
  }
  warning(): void {
    this.tone(330, 0.15, "square", 0.05);
    this.tone(330, 0.15, "square", 0.05, 0.22);
  }
  event(): void {
    [0, 2, 4].forEach((k, i) => this.pluck(SCALE[k], 0.5, 0.15, i * 0.09));
  }
  bonus(): void {
    [2, 4, 6, 8].forEach((k, i) => this.pluck(SCALE[k], 0.4, 0.13, i * 0.07));
  }
  coin(): void {
    this.tone(1318, 0.08, "square", 0.05);
    this.tone(1760, 0.12, "square", 0.05, 0.07);
  }
  shabyt(): void {
    [4, 6, 8, 10].forEach((k, i) => this.tone(SCALE[k], 0.5, "triangle", 0.1, i * 0.06));
  }
  crown(): void {
    // gentle major-ish swell + dombra arpeggio
    [SCALE[0], SCALE[2], SCALE[4]].forEach((f) => this.tone(f, 2.2, "sine", 0.1, 0, 0.4));
    [0, 2, 4, 5, 7, 9].forEach((k, i) => this.pluck(SCALE[k], 0.7, 0.14, 0.2 + i * 0.11));
  }
  reward(): void {
    [5, 7, 9].forEach((k, i) => this.tone(SCALE[k], 0.3, "triangle", 0.1, i * 0.08));
  }

  setWind(strength: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noise) return;
    if (!this.windSrc && strength > 0.02) {
      this.windSrc = ctx.createBufferSource();
      this.windSrc.buffer = this.noise;
      this.windSrc.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 500;
      f.Q.value = 0.7;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSrc.connect(f);
      f.connect(this.windGain);
      this.windGain.connect(this.sfxBus);
      this.windSrc.start();
    }
    if (this.windGain) this.windGain.gain.setTargetAtTime(strength * 0.18, ctx.currentTime, 0.3);
  }

  // ── Music: a small generative dombra loop ────────────────────────────────

  startMusic(theme: MusicTheme): void {
    this.musicWanted = true;
    this.theme = theme;
    if (!this.ctx) return;
    if (this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = setInterval(() => this.schedule(), 60);
  }

  setTheme(theme: MusicTheme): void {
    this.theme = theme;
  }

  stopMusic(): void {
    this.musicWanted = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const bpm = this.theme === "mus_nauryz" ? 128 : this.theme === "mus_session" ? 76 : 96;
    const spb = 60 / bpm / 2; // eighth notes
    const patterns: Record<MusicTheme, number[]> = {
      // indices into SCALE, -1 = rest; a dombra kui-like figure: drone + melody
      mus_campus: [0, 4, 2, 4, 3, 4, 2, -1, 0, 4, 2, 4, 5, 4, 3, 2],
      mus_nauryz: [0, 2, 4, 5, 4, 2, 4, 7, 5, 4, 2, 4, 0, 2, 4, -1],
      mus_session: [0, -1, 2, -1, 4, -1, 3, -1, 0, -1, 2, -1, 1, -1, 0, -1],
    };
    const pat = patterns[this.theme];
    while (this.nextNoteTime < ctx.currentTime + 0.25) {
      const when = this.nextNoteTime - ctx.currentTime;
      const n = pat[this.step % pat.length];
      if (n >= 0) this.pluck(SCALE[n] / (this.theme === "mus_session" ? 2 : 1), spb * 2.4, 0.16, when, this.musicBus);
      if (this.step % 4 === 0) this.pluck(SCALE[0] / 2, spb * 3.5, 0.1, when, this.musicBus); // drone string
      if (this.theme === "mus_nauryz" && this.step % 2 === 1) this.noiseBurstMusic(when);
      this.nextNoteTime += spb;
      this.step++;
    }
  }

  private noiseBurstMusic(when: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.noise) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }

  vibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not supported */
    }
  }
}
