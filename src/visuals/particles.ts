// Pooled particles. World-space ones move with the camera (sparks, steam, dust, confetti);
// screen-space ones are weather (wind streaks, rain, snow).

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
  | "coin";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  g: number;
  drag: number;
  screen: boolean;
}

const MAX = 1400;

export class Particles {
  list: Particle[] = [];
  private pool: Particle[] = [];
  reduced = false;

  spawn(p: Partial<Particle> & { kind: ParticleKind; x: number; y: number }): void {
    if (this.list.length >= MAX) return;
    const o = this.pool.pop() ?? ({} as Particle);
    o.kind = p.kind;
    o.x = p.x;
    o.y = p.y;
    o.vx = p.vx ?? 0;
    o.vy = p.vy ?? 0;
    o.max = p.max ?? p.life ?? 1;
    o.life = p.life ?? o.max;
    o.size = p.size ?? 4;
    o.color = p.color ?? "#fff";
    o.rot = p.rot ?? Math.random() * Math.PI * 2;
    o.vr = p.vr ?? 0;
    o.g = p.g ?? 0;
    o.drag = p.drag ?? 0;
    o.screen = p.screen ?? false;
    this.list.push(o);
  }

  burst(kind: ParticleKind, x: number, y: number, n: number, opts: Partial<Particle> & { speed?: number; spread?: number; colors?: string[] } = {}): void {
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

  update(dt: number): void {
    const keep: Particle[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        continue;
      }
      p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  clear(): void {
    this.pool.push(...this.list);
    this.list = [];
  }

  /** Draw particles; `toScreen` maps world → screen for world-space particles. */
  draw(ctx: CanvasRenderingContext2D, toScreen: (x: number, y: number) => [number, number], scale: number, screenOnly: boolean): void {
    for (const p of this.list) {
      if (p.screen !== screenOnly) continue;
      const [sx, sy] = p.screen ? [p.x, p.y] : toScreen(p.x, p.y);
      const k = p.life / p.max;
      const s = p.size * (p.screen ? 1 : scale);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      switch (p.kind) {
        case "spark":
        case "glow":
        case "firework": {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, s * (p.kind === "glow" ? 1.6 : 1) * (0.5 + k * 0.5), 0, Math.PI * 2);
          ctx.fill();
          if (p.kind === "firework") {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = s * 0.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - p.vx * 0.04 * scale, sy + p.vy * 0.04 * scale);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = "source-over";
          break;
        }
        case "star": {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? s * 0.35 : s;
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.globalCompositeOperation = "source-over";
          break;
        }
        case "dust":
        case "steam": {
          const grow = p.kind === "steam" ? 1 + (1 - k) * 2.2 : 1 + (1 - k);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = (p.kind === "steam" ? 0.35 : 0.5) * k;
          ctx.beginPath();
          ctx.arc(sx, sy, s * grow, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "chip":
        case "confetti": {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.fillRect(-s / 2, -s / 4, s, s / 2);
          ctx.restore();
          break;
        }
        case "petal": {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "coin": {
          ctx.fillStyle = "#f2b84b";
          ctx.beginPath();
          ctx.ellipse(sx, sy, s * Math.abs(Math.cos(p.rot)), s, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#c98a1b";
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        }
        case "rain": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + p.vx * 0.02, sy + p.vy * 0.02);
          ctx.stroke();
          break;
        }
        case "snow": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "wind": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5 * Math.sin(k * Math.PI);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx - p.vx * 0.06, sy - 6, sx - p.vx * 0.12, sy);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
