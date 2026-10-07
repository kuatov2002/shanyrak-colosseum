// GPU particles on PixiJS ParticleContainer. Three containers share one atlas: additive (sparks,
// glows, stars, fire), normal (dust, chips, confetti, petals, steam) and screen-space weather.
// World particles use world units with y up; the container is a child of the camera-transformed
// world, so it is flipped (y = -y) here.

import { Particle, ParticleContainer, type Texture } from "pixi.js";

export type ParticleKind =
  | "spark"
  | "dust"
  | "chip"
  | "steam"
  | "confetti"
  | "petal"
  | "star"
  | "firework"
  | "glow"
  | "rain"
  | "snow"
  | "wind"
  | "coin"
  | "fire"
  | "leaf"
  | "ring";

const ADDITIVE = new Set<ParticleKind>(["spark", "glow", "star", "firework", "fire", "ring"]);
const TEX_OF: Record<ParticleKind, string> = {
  spark: "spark",
  dust: "dust",
  chip: "chip",
  steam: "steam",
  confetti: "confetti",
  petal: "petal",
  star: "star",
  firework: "spark",
  glow: "glow",
  rain: "rain",
  snow: "snow",
  wind: "wind",
  coin: "coin",
  fire: "fire",
  leaf: "leaf",
  ring: "ring",
};
/** Pixel size of the art inside a 64px atlas cell (so `size` means world units of radius). */
const ART_RADIUS: Partial<Record<ParticleKind, number>> = { spark: 14, glow: 30, steam: 30, fire: 30, dust: 26, star: 22, coin: 16, snow: 10, ring: 24 };

interface Live {
  p: Particle;
  kind: ParticleKind;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  g: number;
  drag: number;
  vr: number;
  screen: boolean;
  container: ParticleContainer;
}

export interface SpawnOptions {
  kind: ParticleKind;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life?: number;
  max?: number;
  size?: number;
  color?: string | number;
  rot?: number;
  vr?: number;
  g?: number;
  drag?: number;
  screen?: boolean;
}

export interface BurstOptions extends Partial<Omit<SpawnOptions, "kind" | "x" | "y">> {
  speed?: number;
  spread?: number;
  colors?: string[];
}

const DYNAMIC = { position: true, rotation: true, color: true, vertex: true, uvs: true };

export class Particles {
  readonly worldAdd: ParticleContainer;
  readonly worldNormal: ParticleContainer;
  readonly screen: ParticleContainer;
  readonly screenAdd: ParticleContainer;
  private live: Live[] = [];
  private pool: Particle[] = [];
  private dirty = new Set<ParticleContainer>();
  reduced = false;
  max = 1600;

  constructor(private readonly atlas: Record<string, Texture>) {
    const base = atlas.spark;
    this.worldAdd = new ParticleContainer({ texture: base, dynamicProperties: DYNAMIC, blendMode: "add" });
    this.worldNormal = new ParticleContainer({ texture: base, dynamicProperties: DYNAMIC });
    this.screen = new ParticleContainer({ texture: base, dynamicProperties: DYNAMIC });
    this.screenAdd = new ParticleContainer({ texture: base, dynamicProperties: DYNAMIC, blendMode: "add" });
  }

  get count(): number {
    return this.live.length;
  }

  spawn(o: SpawnOptions): void {
    if (this.live.length >= this.max) return;
    const tex = this.atlas[TEX_OF[o.kind]];
    const p = this.pool.pop() ?? new Particle({ texture: tex });
    p.texture = tex;
    p.anchorX = 0.5;
    p.anchorY = 0.5;
    p.rotation = o.rot ?? Math.random() * Math.PI * 2;
    p.tint = o.color ?? 0xffffff;
    p.alpha = 1;
    const screen = o.screen ?? false;
    const add = ADDITIVE.has(o.kind);
    const container = screen ? (add ? this.screenAdd : this.screen) : add ? this.worldAdd : this.worldNormal;
    const max = o.max ?? o.life ?? 1;
    const l: Live = {
      p,
      kind: o.kind,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      life: o.life ?? max,
      max,
      size: o.size ?? 4,
      g: o.g ?? 0,
      drag: o.drag ?? 0,
      vr: o.vr ?? 0,
      screen,
      container,
    };
    p.x = o.x;
    p.y = screen ? o.y : -o.y;
    this.applyScale(l, 1);
    container.particleChildren.push(p);
    this.dirty.add(container);
    this.live.push(l);
  }

  burst(kind: ParticleKind, x: number, y: number, n: number, opts: BurstOptions = {}): void {
    const count = this.reduced ? Math.ceil(n / 3) : n;
    const speed = opts.speed ?? 200;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.spawn({
        kind,
        x: x + (Math.random() - 0.5) * (opts.spread ?? 0),
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.8 + (opts.vy ?? 0),
        life: (opts.life ?? 1) * (0.6 + Math.random() * 0.6),
        size: (opts.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: opts.colors ? opts.colors[Math.floor(Math.random() * opts.colors.length)] : opts.color,
        g: opts.g ?? -300,
        drag: opts.drag ?? 1.2,
        vr: (Math.random() - 0.5) * 8,
        screen: opts.screen,
      });
    }
  }

  private applyScale(l: Live, k: number): void {
    const r = ART_RADIUS[l.kind] ?? 20;
    let s = l.size / r;
    if (l.kind === "steam") s *= 1 + (1 - k) * 2.2;
    else if (l.kind === "dust") s *= 1 + (1 - k);
    else if (l.kind === "glow" || l.kind === "spark" || l.kind === "firework" || l.kind === "fire") s *= 0.5 + k * 0.5;
    if (l.kind === "rain") {
      l.p.scaleX = 0.4;
      l.p.scaleY = 0.5;
      return;
    }
    if (l.kind === "wind") {
      l.p.scaleX = 1.6;
      l.p.scaleY = 0.6;
      return;
    }
    l.p.scaleX = s;
    l.p.scaleY = s;
  }

  update(dt: number): void {
    const keep: Live[] = [];
    let died = false;
    for (const l of this.live) {
      l.life -= dt;
      if (l.life <= 0) {
        this.pool.push(l.p);
        this.dirty.add(l.container);
        died = true;
        continue;
      }
      l.vy += l.g * dt;
      const d = Math.exp(-l.drag * dt);
      l.vx *= d;
      l.vy *= d;
      const p = l.p;
      p.x += l.vx * dt;
      p.y += (l.screen ? l.vy : -l.vy) * dt;
      p.rotation += l.vr * dt;
      const k = l.life / l.max;
      let a = Math.min(1, k * 1.6);
      if (l.kind === "steam") a *= 0.38 * k;
      else if (l.kind === "dust") a *= 0.55 * k;
      else if (l.kind === "wind") a = 0.5 * Math.sin(k * Math.PI);
      p.alpha = a;
      if (l.kind === "coin") p.scaleX = (l.size / 16) * Math.abs(Math.cos(p.rotation));
      else this.applyScale(l, k);
      keep.push(l);
    }
    this.live = keep;
    if (died || this.dirty.size) this.rebuild();
  }

  private rebuild(): void {
    for (const c of this.dirty) {
      c.particleChildren.length = 0;
    }
    for (const l of this.live) if (this.dirty.has(l.container)) l.container.particleChildren.push(l.p);
    for (const c of this.dirty) c.update();
    this.dirty.clear();
  }

  clear(): void {
    for (const l of this.live) this.pool.push(l.p);
    this.live = [];
    for (const c of [this.worldAdd, this.worldNormal, this.screen, this.screenAdd]) {
      c.particleChildren.length = 0;
      c.update();
    }
  }
}
