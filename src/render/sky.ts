// Sky and landscape. The sky follows the tower: day at the ground, sunset in the middle, a starry
// night up high — and events tint it (Наурыз warm, session violet, wind stormy).

import { hashString, Rng } from "../core/rng";
import type { EventId } from "../gameplay/types";
import { mix, rgba } from "./color";

export interface Theme {
  top: string;
  bottom: string;
  far: string;
  mid: string;
  snow: string;
  stars: number;
  lights: number;
  sun: number;
}

const THEMES: Record<string, Theme> = {
  day: { top: "#4b8fd8", bottom: "#c7e7f4", far: "#7d9cc4", mid: "#5f7fa8", snow: "#f4f8ff", stars: 0, lights: 0, sun: 1 },
  sunset: { top: "#3c3f84", bottom: "#f4a06a", far: "#6e5b8f", mid: "#4f4473", snow: "#ffd9c2", stars: 0.25, lights: 0.5, sun: 0.6 },
  night: { top: "#0b0f2c", bottom: "#2c2f68", far: "#262a55", mid: "#1c1f42", snow: "#9aa6d6", stars: 1, lights: 1, sun: 0 },
  nauryz: { top: "#3a2a72", bottom: "#ffb36b", far: "#7a5a8f", mid: "#5a3f6f", snow: "#ffe1c4", stars: 0.4, lights: 1, sun: 0.4 },
  session: { top: "#0d0820", bottom: "#3b1f63", far: "#2a1d4a", mid: "#1b1335", snow: "#8f7fc0", stars: 0.8, lights: 1, sun: 0 },
  storm: { top: "#27324a", bottom: "#6d7b94", far: "#56627a", mid: "#424d63", snow: "#dfe6f2", stars: 0, lights: 0.6, sun: 0 },
  menu: { top: "#141a46", bottom: "#d98a6a", far: "#4a4877", mid: "#2e2c58", snow: "#f2c9b8", stars: 0.7, lights: 1, sun: 0.25 },
};

function blend(a: Theme, b: Theme, t: number): Theme {
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    far: mix(a.far, b.far, t),
    mid: mix(a.mid, b.mid, t),
    snow: mix(a.snow, b.snow, t),
    stars: a.stars + (b.stars - a.stars) * t,
    lights: a.lights + (b.lights - a.lights) * t,
    sun: a.sun + (b.sun - a.sun) * t,
  };
}

export function themeFor(height: number, event: EventId | null, menu: boolean, eventK: number): Theme {
  let base: Theme;
  if (menu) base = THEMES.menu;
  else if (height < 8) base = blend(THEMES.day, THEMES.sunset, height / 8 * 0.35);
  else if (height < 18) base = blend(THEMES.day, THEMES.sunset, 0.35 + ((height - 8) / 10) * 0.65);
  else if (height < 28) base = blend(THEMES.sunset, THEMES.night, (height - 18) / 10);
  else base = THEMES.night;
  if (event && eventK > 0) {
    const target =
      event === "nauryz" ? THEMES.nauryz : event === "session" ? THEMES.session : event === "wind" ? THEMES.storm : null;
    if (target) base = blend(base, target, eventK * (event === "wind" ? 0.55 : 0.85));
  }
  return base;
}

/** Ridge line generated once per background kind (deterministic). */
function ridge(kind: string, layer: number, count: number): number[] {
  const rng = new Rng(hashString(`${kind}:${layer}`));
  const pts: number[] = [];
  let v = rng.next();
  for (let i = 0; i <= count; i++) {
    v += (rng.next() - 0.5) * (layer === 0 ? 0.9 : 0.5);
    v = Math.max(0, Math.min(1, v));
    pts.push(v);
  }
  return pts;
}

const ridgeCache = new Map<string, number[]>();
function getRidge(kind: string, layer: number, count: number): number[] {
  const key = `${kind}|${layer}|${count}`;
  let r = ridgeCache.get(key);
  if (!r) {
    r = ridge(kind, layer, count);
    ridgeCache.set(key, r);
  }
  return r;
}

const starField = (() => {
  const rng = new Rng(77);
  return Array.from({ length: 140 }, () => ({ x: rng.next(), y: rng.next(), s: rng.range(0.6, 1.8), p: rng.range(0, 6) }));
})();

export interface SkyDrawParams {
  w: number;
  h: number;
  theme: Theme;
  t: number;
  /** Camera height in world units (for parallax). */
  camY: number;
  scale: number;
  groundY: number;
  background: string;
}

export function drawSky(ctx: CanvasRenderingContext2D, p: SkyDrawParams): void {
  const { w, h, theme } = p;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, theme.top);
  g.addColorStop(1, theme.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (theme.stars > 0.02) {
    for (const s of starField) {
      const a = theme.stars * (0.5 + 0.5 * Math.sin(p.t * 1.5 + s.p));
      ctx.fillStyle = `rgba(255,248,230,${a.toFixed(3)})`;
      ctx.fillRect(s.x * w, ((s.y * h * 0.75 + p.camY * p.scale * 0.03) % (h * 0.8)), s.s, s.s);
    }
  }
  // sun / moon
  const bodyY = h * 0.22 + p.camY * p.scale * 0.04;
  if (theme.sun > 0.05) {
    const sg = ctx.createRadialGradient(w * 0.78, bodyY, 4, w * 0.78, bodyY, 90);
    sg.addColorStop(0, rgba("#fff3c4", 0.9 * theme.sun));
    sg.addColorStop(0.25, rgba("#ffd27a", 0.5 * theme.sun));
    sg.addColorStop(1, rgba("#ffd27a", 0));
    ctx.fillStyle = sg;
    ctx.fillRect(w * 0.78 - 90, bodyY - 90, 180, 180);
  } else {
    ctx.fillStyle = "rgba(255,246,220,0.92)";
    ctx.beginPath();
    ctx.arc(w * 0.8, bodyY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.top;
    ctx.beginPath();
    ctx.arc(w * 0.8 + 7, bodyY - 4, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Landscape layers (parallax: they sink as the camera rises)
  const sink = (k: number) => p.camY * p.scale * k;
  const horizon = p.groundY + sink(0.18);
  if (horizon - 260 * p.scale > h) return;
  const bg = p.background;
  if (bg === "bg_steppe") {
    drawHills(ctx, w, horizon - 30 * p.scale, 40 * p.scale, theme.far, getRidge(bg, 1, 10));
    // distant yurts
    for (let i = 0; i < 4; i++) {
      const x = w * (0.12 + i * 0.24);
      const y = horizon - 28 * p.scale;
      drawTinyYurt(ctx, x, y, 12 * p.scale, theme);
    }
  } else if (bg === "bg_city") {
    drawSkyline(ctx, w, horizon - 10 * p.scale, p.scale, theme, p.t);
  } else {
    drawMountains(ctx, w, horizon - 40 * p.scale, (bg === "bg_lake" ? 170 : 210) * p.scale, theme.far, theme.snow, getRidge("alatau", 0, 9));
    drawHills(ctx, w, horizon - 18 * p.scale, 55 * p.scale, theme.mid, getRidge(bg, 1, 7));
    if (bg === "bg_lake") {
      const ly = horizon - 16 * p.scale;
      const lg = ctx.createLinearGradient(0, ly, 0, ly + 40 * p.scale);
      lg.addColorStop(0, rgba("#3fc1c9", 0.85));
      lg.addColorStop(1, rgba("#1d6f86", 0.9));
      ctx.fillStyle = lg;
      ctx.fillRect(0, ly, w, 40 * p.scale);
      for (let i = 0; i < 9; i++) drawSpruce(ctx, w * (0.05 + i * 0.115), ly + 2, 26 * p.scale, mix(theme.mid, "#0f3d2e", 0.6));
    }
  }
  // city lights at dusk/night
  if (theme.lights > 0.05 && bg !== "bg_city") {
    const rng = new Rng(5);
    for (let i = 0; i < 60; i++) {
      const x = rng.next() * w;
      const y = horizon - rng.next() * 12 * p.scale;
      ctx.fillStyle = rgba(rng.chance(0.7) ? "#ffd27a" : "#fff3c4", theme.lights * (0.4 + 0.6 * Math.sin(p.t * 2 + i) ** 2));
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function drawMountains(ctx: CanvasRenderingContext2D, w: number, base: number, height: number, color: string, snow: string, r: number[]): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 60);
  const n = r.length - 1;
  const peaks: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const y = base - (0.35 + r[i] * 0.65) * height;
    ctx.lineTo(x, y);
    peaks.push([x, y]);
  }
  ctx.lineTo(w, base + 60);
  ctx.closePath();
  ctx.fill();
  // snow caps
  ctx.fillStyle = snow;
  for (let i = 1; i < peaks.length - 1; i++) {
    const [x, y] = peaks[i];
    if (y > peaks[i - 1][1] || y > peaks[i + 1][1]) continue;
    const dl = (peaks[i][0] - peaks[i - 1][0]) * 0.28;
    const dr = (peaks[i + 1][0] - peaks[i][0]) * 0.28;
    const sl = (peaks[i - 1][1] - y) * 0.28;
    const sr = (peaks[i + 1][1] - y) * 0.28;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dl, y + sl);
    ctx.lineTo(x - dl * 0.4, y + sl * 0.7);
    ctx.lineTo(x, y + Math.min(sl, sr) * 0.9);
    ctx.lineTo(x + dr * 0.5, y + sr * 0.6);
    ctx.lineTo(x + dr, y + sr);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHills(ctx: CanvasRenderingContext2D, w: number, base: number, height: number, color: string, r: number[]): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 80);
  const n = r.length - 1;
  let px = 0;
  let py = base - r[0] * height;
  ctx.lineTo(px, py);
  for (let i = 1; i <= n; i++) {
    const x = (i / n) * w;
    const y = base - r[i] * height;
    ctx.quadraticCurveTo(px + (x - px) / 2, Math.min(py, y) - height * 0.2, x, y);
    px = x;
    py = y;
  }
  ctx.lineTo(w, base + 80);
  ctx.closePath();
  ctx.fill();
}

function drawTinyYurt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, theme: Theme): void {
  ctx.fillStyle = mix("#efe3c8", theme.mid, 0.45);
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s, y - s * 0.6);
  ctx.quadraticCurveTo(x, y - s * 1.4, x + s, y - s * 0.6);
  ctx.lineTo(x + s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba("#ffd27a", 0.4 + theme.lights * 0.5);
  ctx.fillRect(x - s * 0.18, y - s * 0.5, s * 0.36, s * 0.5);
}

function drawSpruce(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x - s * 0.32, y);
  ctx.lineTo(x + s * 0.32, y);
  ctx.closePath();
  ctx.fill();
}

function drawSkyline(ctx: CanvasRenderingContext2D, w: number, base: number, s: number, theme: Theme, t: number): void {
  const rng = new Rng(11);
  let x = 0;
  while (x < w) {
    const bw = rng.range(26, 60) * s;
    const bh = rng.range(40, 150) * s;
    ctx.fillStyle = mix(theme.mid, "#0c0e22", 0.3);
    ctx.fillRect(x, base - bh, bw - 3 * s, bh + 40);
    for (let yy = base - bh + 8 * s; yy < base - 6 * s; yy += 10 * s) {
      for (let xx = x + 4 * s; xx < x + bw - 8 * s; xx += 8 * s) {
        if (rng.chance(0.45)) {
          ctx.fillStyle = rgba("#ffd27a", theme.lights * (0.35 + 0.4 * Math.sin(t * 0.5 + xx + yy) ** 2));
          ctx.fillRect(xx, yy, 3 * s, 4 * s);
        }
      }
    }
    x += bw;
  }
}
