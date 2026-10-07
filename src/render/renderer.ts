// Canvas renderer: sky → landscape → campus ground → tower → crane → crown → particles → overlays.
// Reads a WorldView (a Round, or the decorative MenuScene); never mutates game state.

import { BALANCE } from "../config/balance";
import { CROWN_DURATION } from "../gameplay/round";
import type { Debris, EventId, FloatText, RoundEvent } from "../gameplay/types";
import type { Tower } from "../gameplay/tower";
import type { Equipped } from "../meta/collection";
import type { RoomId } from "../meta/rooms";
import { FACULTIES, type FacultyId } from "../social/faculties";
import { Particles } from "../visuals/particles";
import { clamp01, easeOutBack, PALETTE, rgba, shade } from "./color";
import { drawRoom } from "./rooms";
import { drawCrown } from "./shanyrak";
import { drawSky, themeFor } from "./sky";

export interface WorldView {
  t: number;
  tower: Tower;
  hanging: { type: RoomId; w: number } | null;
  crane: { x: number; tilt: number };
  falling: { type: RoomId; w: number; x: number; y: number; rot: number } | null;
  debris: Debris[];
  floats: FloatText[];
  event: { id: EventId } | null;
  wind: number;
  windDir: number;
  shabytLevel: number;
  danger: boolean;
  flash: number;
  shake: number;
  phase: string;
  crownT: number;
  crowned: boolean;
  height: number;
  students: number;
  isTutorial: boolean;
  eff: { teaBreak: number };
  cfg: { faculty: FacultyId | null; cosmetics: Equipped; weather?: "clear" | "rain" | "snow" };
}

export interface RenderOptions {
  menu: boolean;
  guide: boolean;
  reducedMotion: boolean;
}

const H = BALANCE.world.blockH;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly particles = new Particles();
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  scale = 1;
  private camY = 0;
  private camX = 0;
  private eventK = 0;
  private lastEvent: EventId | null = null;
  private steamT = 0;
  private weatherT = 0;
  private fireworkQueue: { at: number; x: number; y: number }[] = [];
  private kick = 0;
  private time = 0;
  /** Horizontal focus as a fraction of the screen (menus push the tower aside on wide screens). */
  focus = 0.5;
  private focusCur = 0.5;
  view: WorldView | null = null;
  opts: RenderOptions = { menu: true, guide: true, reducedMotion: false };

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "world";
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.parent = parent;
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(parent);
    } else window.addEventListener("resize", this.onResize);
  }

  private parent: HTMLElement;
  private observer: ResizeObserver | null = null;
  private readonly onResize = () => this.resize();

  dispose(): void {
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.particles.clear();
    this.canvas.remove();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = this.parent.clientWidth || window.innerWidth;
    this.cssH = this.parent.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    // Portrait phones must show the whole swing (±~250 world units); landscape is height-bound.
    this.scale = Math.max(0.5, Math.min(this.cssW / 500, this.cssH / 800, 1.6));
  }

  get groundY(): number {
    return this.cssH - 96 * this.scale;
  }

  private screenX(x: number): number {
    return this.cssW * this.focusCur + (x - this.camX) * this.scale;
  }
  private screenY(y: number): number {
    return this.groundY - (y - this.camY) * this.scale;
  }
  toScreen = (x: number, y: number): [number, number] => [this.screenX(x), this.screenY(y)];

  /** Hook a round's events to visual effects. Returns an unsubscribe. */
  attach(events: { on(fn: (e: RoundEvent) => void): () => void }, cosmetics: Equipped): () => void {
    return events.on((e) => this.onEvent(e, cosmetics));
  }

  private settleBurst(effect: string, x: number, y: number, n: number): void {
    const p = this.particles;
    switch (effect) {
      case "fx_petals":
        p.burst("petal", x, y, n, { speed: 180, size: 5, colors: ["#ffd1dc", "#ff9ab8", "#fff5f8"], g: -120, life: 1.6, drag: 1.6 });
        break;
      case "fx_stars":
        p.burst("star", x, y, n, { speed: 220, size: 6, colors: ["#fff3c4", "#9fe3ff", "#ffd75e"], g: -60, life: 1.1 });
        break;
      case "fx_confetti":
        p.burst("confetti", x, y, n, { speed: 260, size: 7, colors: ["#c0392b", "#2aa79a", "#f2b84b", "#2f4c8c", "#ff9ad5"], g: -380, life: 1.5 });
        break;
      default:
        p.burst("spark", x, y, n, { speed: 240, size: 3.2, colors: ["#ffd75e", "#fff3c4", "#ffb347"], g: -200, life: 0.9 });
    }
  }

  private onEvent(e: RoundEvent, cos: Equipped): void {
    const p = this.particles;
    switch (e.k) {
      case "land": {
        const y = e.y;
        if (e.q === "perfect") {
          this.settleBurst(cos.effect, e.x, y, 28);
          p.burst("glow", e.x, y, 10, { speed: 90, size: 6, color: "#ffe9a8", g: 40, life: 0.8 });
          this.kick = 0.25;
        } else if (e.q === "good") {
          this.settleBurst(cos.effect, e.x, y, 12);
          p.burst("dust", e.x, y, 6, { speed: 80, size: 7, color: "#e9dcc0", g: 30, life: 0.7 });
        } else if (e.q === "normal") {
          p.burst("dust", e.x, y, 10, { speed: 110, size: 8, color: "#d8cbb0", g: 20, life: 0.8 });
        } else {
          p.burst("dust", e.x, y, 16, { speed: 140, size: 9, color: "#bfae8f", g: 10, life: 1 });
          p.burst("chip", e.x, y, 10, { speed: 220, size: 5, colors: ["#7a5a3a", "#5d4e43", "#a88b6a"], g: -900, life: 1.2 });
        }
        if (e.students > 0) p.burst("glow", e.x, y - 25, Math.min(12, e.students), { speed: 50, size: 4, color: "#ffd27a", g: 60, life: 1 });
        break;
      }
      case "miss":
        p.burst("chip", e.x, e.y, 18, { speed: 260, size: 6, colors: ["#7a5a3a", "#5d4e43", "#a88b6a"], g: -900, life: 1.4 });
        p.burst("dust", e.x, e.y, 14, { speed: 120, size: 10, color: "#bfae8f", g: 10, life: 1 });
        break;
      case "combo":
        p.burst("star", this.view ? this.view.crane.x : 0, (this.view?.tower.topY ?? 0) + 40, 22, { speed: 300, size: 7, colors: ["#ffd75e", "#fff3c4"], g: -120, life: 1.2 });
        break;
      case "shabyt":
        if (e.on && this.view) p.burst("glow", this.view.crane.x, this.view.tower.topY, 30, { speed: 260, size: 6, color: "#ffd75e", g: 0, life: 1.2 });
        break;
      case "material":
        p.burst("coin", e.x, e.y + 20, 6, { speed: 160, size: 5, g: -500, life: 1.1 });
        break;
      case "collapse":
        if (this.view) {
          const y = this.view.tower.topY;
          p.burst("dust", 0, y, 40, { speed: 220, size: 14, color: "#bfae8f", g: 10, life: 1.6, spread: 160 });
          p.burst("chip", 0, y, 30, { speed: 320, size: 6, colors: ["#7a5a3a", "#5d4e43"], g: -900, life: 1.6, spread: 120 });
        }
        break;
      case "crowned":
        if (this.view) {
          const top = this.view.tower.top;
          const x = this.view.tower.visualX(top);
          const y = this.view.tower.topY + 50;
          this.settleBurst(cos.effect, x, y, 50);
          p.burst("star", x, y + 40, 30, { speed: 340, size: 7, colors: ["#fff3c4", "#ffd75e"], g: -80, life: 1.6 });
          p.burst("confetti", x, y, 60, { speed: 380, size: 7, colors: ["#c0392b", "#2aa79a", "#f2b84b", "#2f4c8c", "#ffffff"], g: -420, life: 2.2, spread: 80 });
          for (let i = 0; i < 4; i++) this.fireworkQueue.push({ at: this.time + 0.3 + i * 0.45, x: x + (i - 1.5) * 120, y: y + 200 + (i % 2) * 80 });
        }
        break;
      case "fireworks":
        for (let i = 0; i < 3; i++) this.fireworkQueue.push({ at: this.time + i * 0.4, x: e.x + (i - 1) * 140, y: e.y + 160 + i * 40 });
        break;
      case "examPassed":
        if (this.view) p.burst("star", this.view.tower.visualX(this.view.tower.top), this.view.tower.topY, 20, { speed: 200, size: 6, colors: ["#c9b8ff", "#fff3c4"], g: -60 });
        break;
      case "bonusApplied":
        if (this.view) p.burst("glow", this.view.crane.x, this.view.tower.topY + BALANCE.world.hangAbove, 24, { speed: 200, size: 5, color: "#ffe9a8", g: 0 });
        break;
      default:
        break;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.particles.reduced = this.opts.reducedMotion;
    this.particles.update(dt);
    const v = this.view;
    if (!v) return;
    this.focusCur += (this.focus - this.focusCur) * Math.min(1, dt * 3);

    // Camera
    const topY = v.tower.topY;
    let target: number;
    if (this.opts.menu) {
      const fullH = topY + (v.crowned ? 140 : 40);
      const visible = (this.groundY - this.cssH * 0.2) / this.scale;
      target = Math.max(0, fullH - visible);
    } else {
      const anchor = this.cssH * 0.56;
      target = Math.max(0, topY - (this.groundY - anchor) / this.scale);
      if (v.phase === "crowning") target += 40;
    }
    this.camY += (target - this.camY) * Math.min(1, dt * (this.opts.menu ? 2 : 3.2));
    const topX = v.tower.blocks.length > 1 ? v.tower.visualX(v.tower.top) * 0.35 : 0;
    this.camX += (topX - this.camX) * Math.min(1, dt * 1.5);

    // Event tint
    if (v.event) this.lastEvent = v.event.id;
    this.eventK += ((v.event ? 1 : 0) - this.eventK) * Math.min(1, dt * 1.2);

    // Ambient emitters
    this.steamT += dt;
    if (this.steamT > 0.22) {
      this.steamT = 0;
      for (const b of v.tower.blocks) {
        if (b.type !== "chaikhana" && b.type !== "canteen") continue;
        const sy = this.screenY(b.floor * H + H);
        if (sy < -40 || sy > this.cssH + 40) continue;
        if (b.type === "canteen" && Math.random() < 0.6) continue;
        const x = v.tower.visualX(b) + b.w * 0.3;
        this.particles.spawn({ kind: "steam", x, y: (b.floor + 1) * H + 4, vx: 6 + v.wind * v.windDir * 40, vy: 28, life: 2, size: 5, color: "#f4efe4", g: 6, drag: 0.4 });
      }
      if (v.shabytLevel > 0) {
        const b = v.tower.blocks[1 + Math.floor(Math.random() * Math.max(1, v.tower.blocks.length - 1))];
        if (b) this.particles.spawn({ kind: "glow", x: v.tower.visualX(b) + (Math.random() - 0.5) * b.w, y: b.floor * H + Math.random() * H, vy: 40, life: 1.4, size: 3, color: "#ffd75e", g: 10, drag: 0.5 });
      }
      if (v.event?.id === "festival") {
        this.particles.spawn({ kind: "confetti", x: (Math.random() - 0.5) * 500, y: 160 + Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: 0, life: 2.4, size: 6, color: ["#c0392b", "#2aa79a", "#f2b84b", "#ff9ad5"][Math.floor(Math.random() * 4)], g: -120, vr: 5, drag: 0.8 });
      }
      if (v.event?.id === "nauryz" && Math.random() < 0.12) {
        this.fireworkQueue.push({ at: this.time, x: (Math.random() - 0.5) * 600, y: topY + 200 + Math.random() * 150 });
      }
    }
    // Weather (screen space)
    this.weatherT += dt;
    const rate = this.opts.reducedMotion ? 0.35 : 1;
    if (v.wind > 0.05 && Math.random() < v.wind * 0.9 * rate) {
      const fromLeft = v.windDir > 0;
      this.particles.spawn({ kind: "wind", x: fromLeft ? -40 : this.cssW + 40, y: Math.random() * this.cssH * 0.8, vx: v.windDir * (500 + Math.random() * 300), vy: 0, life: 1.6, size: 1, color: "#e8f4ff", screen: true });
    }
    const weather = this.opts.menu ? "clear" : (v.cfg.weather ?? "clear");
    if (weather === "rain" && Math.random() < 0.9 * rate) {
      for (let i = 0; i < 2; i++) this.particles.spawn({ kind: "rain", x: Math.random() * this.cssW * 1.2 - 40, y: -10, vx: -60 + v.wind * v.windDir * 200, vy: 900, life: 1.4, size: 1, color: "rgba(190,215,255,0.55)", screen: true });
    } else if (weather === "snow" && Math.random() < 0.6 * rate) {
      this.particles.spawn({ kind: "snow", x: Math.random() * this.cssW, y: -10, vx: v.wind * v.windDir * 120 + (Math.random() - 0.5) * 20, vy: 50 + Math.random() * 40, life: 12, size: 1 + Math.random() * 2, color: "rgba(255,255,255,0.85)", screen: true });
    }
    // Fireworks
    const due = this.fireworkQueue.filter((f) => f.at <= this.time);
    this.fireworkQueue = this.fireworkQueue.filter((f) => f.at > this.time);
    for (const f of due) {
      const colors = [["#ffd75e", "#fff3c4"], ["#ff6b6b", "#ffd1dc"], ["#7cefff", "#ffffff"], ["#8ef0a5", "#fff3c4"]][Math.floor(Math.random() * 4)];
      this.particles.burst("firework", f.x, f.y, 34, { speed: 320, size: 2.6, colors, g: -140, life: 1.3, drag: 1.4 });
    }
    this.kick = Math.max(0, this.kick - dt * 2);
  }

  render(): void {
    const v = this.view;
    const ctx = this.ctx;
    const s = this.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!v) {
      ctx.fillStyle = PALETTE.night;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      return;
    }
    const cos = v.cfg.cosmetics;
    const theme = themeFor(v.height, this.lastEvent, this.opts.menu, this.eventK);
    drawSky(ctx, { w: this.cssW, h: this.cssH, theme, t: this.time, camY: this.camY, scale: s, groundY: this.groundY, background: cos.background });

    // Shake
    const shakeAmp = this.opts.reducedMotion ? 0 : v.shake * 7 + this.kick * 3;
    const ox = (Math.random() - 0.5) * shakeAmp;
    const oy = (Math.random() - 0.5) * shakeAmp;
    ctx.save();
    ctx.translate(ox, oy);

    this.drawGround(ctx, v, theme.lights);

    // World transform: 1 unit = scale px, y up → canvas -y
    const worldT = () => ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * (this.screenX(0) + ox), this.dpr * (this.screenY(0) + oy));
    worldT();
    const night = Math.min(1, theme.lights * 0.8 + (v.event?.id === "session" ? 0.4 : 0));

    // Shabyt aura behind the tower: a soft vertical glow (elliptical radial gradient)
    if (v.shabytLevel > 0 && v.tower.floors > 1) {
      const top = v.tower.topY;
      const a = (v.shabytLevel === 2 ? 0.38 : 0.24) * (0.8 + 0.2 * Math.sin(this.time * 4));
      const cx = v.tower.visualX(v.tower.top);
      const ry = Math.min(top, 700) * 0.6 + 80;
      ctx.save();
      ctx.translate(cx, -top + ry * 0.55);
      ctx.scale(1, ry / 190);
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 190);
      g.addColorStop(0, rgba("#ffd75e", a));
      g.addColorStop(0.55, rgba("#ffb347", a * 0.45));
      g.addColorStop(1, rgba("#ffb347", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 190, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Tower
    const viewTop = this.camY + (this.groundY + 40) / s;
    const viewBottom = this.camY - (this.cssH - this.groundY + 40) / s;
    const festive = v.event?.id === "nauryz";
    for (const b of v.tower.blocks) {
      const by = b.floor * H;
      if (by > viewTop || by + H < viewBottom) continue;
      const x = v.tower.visualX(b);
      ctx.save();
      ctx.translate(x, -by);
      if (b.tilt) ctx.rotate(b.tilt);
      if (b.squash > 0) {
        const sq = Math.sin(b.squash * Math.PI) * 0.08 * b.squash;
        ctx.scale(1 + sq, 1 - sq);
      }
      drawRoom(ctx, b.type, b.w, H, {
        facade: cos.facade,
        ornament: cos.ornament,
        faculty: v.cfg.faculty,
        studentSkin: cos.student,
        t: this.time,
        glow: b.type === "foundation" ? night * 0.7 : night,
        students: b.shown,
        crack: b.crack,
        seed: b.id,
        festive: festive && b.floor > 0,
      });
      ctx.restore();
    }

    // Crown (yurt dome + shanyrak)
    if (v.phase === "crowning" || v.crowned) {
      const top = v.tower.top;
      const p = this.opts.menu ? 1 : clamp01(v.crownT / (CROWN_DURATION * 0.62));
      const drop = (1 - easeOutBack(p)) * 320;
      const x = v.tower.visualX(top);
      const y = v.tower.topY + Math.max(-20, drop);
      if (p < 1) {
        ctx.strokeStyle = "#3b3b4f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, -(y + top.w * 0.4));
        ctx.lineTo(x, -(y + 900));
        ctx.stroke();
      }
      const glow = v.crowned ? clamp01((this.opts.menu ? 3 : v.crownT - CROWN_DURATION * 0.62) * 1.5) : 0;
      ctx.save();
      ctx.translate(x, -y);
      drawCrown(ctx, top.w, { t: this.time, deco: cos.shanyrak, glow, ornament: cos.ornament });
      ctx.restore();
    }

    // Crane + hanging room
    if (v.hanging && !this.opts.menu) {
      const hy = v.tower.topY + BALANCE.world.hangAbove;
      const hx = v.crane.x;
      // rail at the top of the screen
      const railY = this.camY + (this.groundY - 22) / s;
      ctx.fillStyle = "#3a3d55";
      ctx.fillRect(-2000, -railY - 8, 4000, 8);
      ctx.fillStyle = "#f2b84b";
      for (let k = -2000; k < 2000; k += 40) ctx.fillRect(k, -railY - 8, 20, 3);
      ctx.fillStyle = "#4a4e6d";
      ctx.fillRect(hx - 16, -railY, 32, 12);
      // cable
      ctx.strokeStyle = "#2b2d40";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, -railY + 12);
      ctx.lineTo(hx + Math.sin(v.crane.tilt) * 20, -(hy + H + 10));
      ctx.stroke();
      // guide
      const guideOn = this.opts.guide && (v.isTutorial || v.height < 6 || v.eff.teaBreak > 0);
      if (guideOn) {
        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = rgba("#fff3c4", 0.55);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx, -hy);
        ctx.lineTo(hx, -v.tower.topY);
        ctx.stroke();
        ctx.restore();
        const tx = v.tower.visualX(v.tower.top);
        const aligned = Math.abs(hx - tx) < 10;
        ctx.fillStyle = aligned ? "#8ef0a5" : rgba("#ffd75e", 0.9);
        ctx.beginPath();
        ctx.moveTo(tx, -v.tower.topY - 4);
        ctx.lineTo(tx - 8, -v.tower.topY - 16);
        ctx.lineTo(tx + 8, -v.tower.topY - 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.save();
      ctx.translate(hx, -hy);
      ctx.rotate(v.crane.tilt);
      // hook
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -H - 8, 6, Math.PI * 0.2, Math.PI * 1.1);
      ctx.stroke();
      ctx.strokeStyle = "#2b2d40";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-v.hanging.w * 0.4, -H);
      ctx.lineTo(0, -H - 12);
      ctx.lineTo(v.hanging.w * 0.4, -H);
      ctx.stroke();
      drawRoom(ctx, v.hanging.type, v.hanging.w, H, {
        facade: cos.facade, ornament: cos.ornament, faculty: v.cfg.faculty, studentSkin: cos.student,
        t: this.time, glow: night * 0.6, students: 0, crack: 0, seed: 1, festive: false,
      });
      ctx.restore();
    }
    if (v.falling) {
      const f = v.falling;
      ctx.save();
      ctx.translate(f.x, -f.y);
      ctx.rotate(f.rot);
      drawRoom(ctx, f.type, f.w, H, {
        facade: cos.facade, ornament: cos.ornament, faculty: v.cfg.faculty, studentSkin: cos.student,
        t: this.time, glow: night * 0.6, students: 0, crack: 0, seed: 1, festive: false,
      });
      ctx.restore();
    }
    for (const d of v.debris) {
      ctx.save();
      ctx.translate(d.x, -d.y - H / 2);
      ctx.rotate(d.rot);
      ctx.globalAlpha = Math.min(1, d.life);
      ctx.translate(0, H / 2);
      drawRoom(ctx, d.type, d.w, H, {
        facade: cos.facade, ornament: cos.ornament, faculty: v.cfg.faculty, studentSkin: cos.student,
        t: this.time, glow: 0, students: 0, crack: 1, seed: 2, festive: false,
      });
      ctx.restore();
    }
    ctx.restore();

    // Screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.particles.draw(ctx, this.toScreen, s, false);

    // Floating texts
    for (const f of v.floats) {
      const [sx, sy] = this.toScreen(f.x, f.y);
      const k = f.t / f.life;
      const pop = f.t < 0.15 ? 0.6 + (f.t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (f.t - 0.15) * 0.3);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `800 ${Math.round(f.size * pop * Math.max(0.8, s))}px "Rubik", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(20,16,40,0.85)";
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
      ctx.globalAlpha = 1;
    }

    this.particles.draw(ctx, this.toScreen, s, true);

    // Vignettes
    if (v.event?.id === "session" || theme.stars > 0.7) {
      const g = ctx.createRadialGradient(this.cssW / 2, this.cssH / 2, this.cssH * 0.3, this.cssW / 2, this.cssH / 2, this.cssH * 0.8);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(5,3,20,0.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (v.danger && !this.opts.menu) {
      const a = 0.22 + 0.14 * Math.sin(this.time * 7);
      const g = ctx.createRadialGradient(this.cssW / 2, this.cssH / 2, this.cssH * 0.35, this.cssW / 2, this.cssH / 2, this.cssH * 0.75);
      g.addColorStop(0, "rgba(255,40,40,0)");
      g.addColorStop(1, `rgba(200,30,40,${a.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (v.flash > 0 && !this.opts.reducedMotion) {
      ctx.fillStyle = `rgba(255,244,214,${(v.flash * 0.22).toFixed(3)})`;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D, v: WorldView, lights: number): void {
    const s = this.scale;
    const gy = this.screenY(0);
    if (gy > this.cssH + 10) return;
    const foundW = v.tower.blocks[0]?.w ?? 250;
    // grass
    const grass = ctx.createLinearGradient(0, gy, 0, this.cssH);
    grass.addColorStop(0, shade("#4f8f58", -lights * 0.45));
    grass.addColorStop(1, shade("#2f5e3a", -lights * 0.5));
    ctx.fillStyle = grass;
    ctx.fillRect(0, gy, this.cssW, Math.max(0, this.cssH - gy) + 20);
    // plaza
    const px0 = this.screenX(-foundW / 2 - 150);
    const px1 = this.screenX(foundW / 2 + 150);
    ctx.fillStyle = shade("#cdb994", -lights * 0.45);
    ctx.fillRect(px0, gy, px1 - px0, 18 * s);
    ctx.fillStyle = shade("#b39d76", -lights * 0.45);
    for (let x = px0; x < px1; x += 22 * s) ctx.fillRect(x, gy + 6 * s, 1.5, 12 * s);
    // path towards the viewer
    ctx.fillStyle = shade("#cdb994", -lights * 0.5);
    ctx.beginPath();
    ctx.moveTo(this.screenX(-26), gy + 18 * s);
    ctx.lineTo(this.screenX(26), gy + 18 * s);
    ctx.lineTo(this.screenX(60), this.cssH + 10);
    ctx.lineTo(this.screenX(-60), this.cssH + 10);
    ctx.closePath();
    ctx.fill();

    // trees & lamps & flags
    const trees = [-foundW / 2 - 60, foundW / 2 + 60, -foundW / 2 - 200, foundW / 2 + 210, -foundW / 2 - 330, foundW / 2 + 340];
    trees.forEach((tx, i) => {
      const x = this.screenX(tx);
      if (x < -60 || x > this.cssW + 60) return;
      ctx.fillStyle = shade("#6b4a2b", -lights * 0.4);
      ctx.fillRect(x - 3 * s, gy - 26 * s, 6 * s, 28 * s);
      ctx.fillStyle = shade(i % 2 ? "#3f8f5a" : "#4f9d69", -lights * 0.45);
      ctx.beginPath();
      ctx.arc(x, gy - 40 * s, 22 * s, 0, Math.PI * 2);
      ctx.arc(x - 12 * s, gy - 30 * s, 14 * s, 0, Math.PI * 2);
      ctx.arc(x + 13 * s, gy - 31 * s, 15 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    for (const lx of [-foundW / 2 - 120, foundW / 2 + 125]) {
      const x = this.screenX(lx);
      ctx.fillStyle = "#2b2d40";
      ctx.fillRect(x - 1.5 * s, gy - 46 * s, 3 * s, 46 * s);
      ctx.fillStyle = lights > 0.3 ? "#ffe2a0" : "#d9cba8";
      ctx.beginPath();
      ctx.arc(x, gy - 48 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      if (lights > 0.3) {
        const lg = ctx.createRadialGradient(x, gy - 48 * s, 1, x, gy - 48 * s, 40 * s);
        lg.addColorStop(0, rgba("#ffd27a", 0.45 * lights));
        lg.addColorStop(1, rgba("#ffd27a", 0));
        ctx.fillStyle = lg;
        ctx.fillRect(x - 40 * s, gy - 88 * s, 80 * s, 80 * s);
      }
    }
    // faculty flags flanking the entrance
    const flagColor = (() => {
      const id = v.cfg.cosmetics.flag.replace("flag_", "");
      if (id in FACULTIES) return FACULTIES[id as FacultyId].color;
      return v.cfg.faculty ? FACULTIES[v.cfg.faculty].color : "#00afca";
    })();
    for (const fx of [-foundW / 2 - 18, foundW / 2 + 18]) {
      const x = this.screenX(fx);
      ctx.fillStyle = "#d9d4c8";
      ctx.fillRect(x - 1.2 * s, gy - 70 * s, 2.4 * s, 70 * s);
      ctx.fillStyle = flagColor;
      ctx.beginPath();
      const wave = Math.sin(this.time * 3 + fx) * 3 * s;
      ctx.moveTo(x + 1 * s, gy - 70 * s);
      ctx.quadraticCurveTo(x + 14 * s, gy - 74 * s + wave, x + 28 * s, gy - 68 * s);
      ctx.lineTo(x + 28 * s, gy - 54 * s);
      ctx.quadraticCurveTo(x + 14 * s, gy - 58 * s + wave, x + 1 * s, gy - 56 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x + 14 * s, gy - 63 * s + wave * 0.5, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // students walking across the campus
    const walkers = Math.min(16, 3 + Math.floor(v.students / 12));
    const crowd = v.event?.id === "festival" ? 26 : 0;
    for (let i = 0; i < walkers + crowd; i++) {
      const isCrowd = i >= walkers;
      let wx: number;
      let jump = 0;
      if (isCrowd) {
        const k = i - walkers;
        wx = (k % 2 ? 1 : -1) * (foundW / 2 + 20 + (k * 17) % 160);
        jump = Math.abs(Math.sin(this.time * 6 + k)) * 6;
      } else {
        const speed = 18 + (i * 7) % 20;
        const dir = i % 2 ? 1 : -1;
        const span = 1100;
        wx = ((((i * 137 + this.time * speed * dir) % span) + span) % span) - span / 2;
        jump = Math.abs(Math.sin(this.time * 8 + i)) * 1.5;
      }
      const x = this.screenX(wx);
      if (x < -20 || x > this.cssW + 20) continue;
      const y = gy + (isCrowd ? 6 : 12 + (i % 3) * 3) * s - jump * s;
      const c = ["#e85d5d", "#4fb6ff", "#ffd75e", "#8ef0a5", "#c27dff", "#ff9ad5"][i % 6];
      ctx.fillStyle = shade(c, -lights * 0.35);
      ctx.fillRect(x - 3 * s, y - 12 * s, 6 * s, 10 * s);
      ctx.fillStyle = shade("#e0ac84", -lights * 0.35);
      ctx.beginPath();
      ctx.arc(x, y - 15 * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
      if (isCrowd) {
        ctx.strokeStyle = shade("#e0ac84", -lights * 0.35);
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(x - 3 * s, y - 11 * s);
        ctx.lineTo(x - 6 * s, y - 18 * s - jump * 0.3 * s);
        ctx.moveTo(x + 3 * s, y - 11 * s);
        ctx.lineTo(x + 6 * s, y - 18 * s - jump * 0.3 * s);
        ctx.stroke();
      }
    }
  }

  capture(): Promise<Blob | null> {
    return new Promise((resolve) => {
      try {
        this.render();
        this.canvas.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    });
  }
}
