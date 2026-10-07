// Procedural room art. Every room shares one construction — stone slab, warm arched windows,
// ornamental cornice, a round medallion with its icon — and differs in colour and details. That
// shared grammar is what keeps the campus visually whole.

import { ROOMS, type RoomDef, type RoomId } from "../meta/rooms";
import { FACULTIES, type FacultyId } from "../social/faculties";
import { windowCount } from "../gameplay/students";
import { mix, PALETTE, rgba, shade } from "./color";
import { drawGlyph } from "./glyphs";

export interface RoomDrawOptions {
  facade: string;
  ornament: string;
  faculty: FacultyId | null;
  studentSkin: string;
  t: number;
  /** 0..1: how strongly windows glow (night/session make them brighter). */
  glow: number;
  students: number;
  crack: number;
  seed: number;
  festive: boolean;
}

interface Colors {
  body: string;
  trim: string;
  accent: string;
  glass: string;
  neon: boolean;
}

export function roomColors(def: RoomDef, facade: string, faculty: FacultyId | null): Colors {
  let { body, trim, accent, glass } = def.colors;
  if (def.id === "faculty" && faculty) {
    body = FACULTIES[faculty].color;
    trim = FACULTIES[faculty].dark;
  }
  let neon = false;
  switch (facade) {
    case "fac_turquoise":
      body = mix(body, "#1fa7a0", 0.38);
      trim = mix(trim, "#126a66", 0.4);
      break;
    case "fac_felt":
      body = mix(body, PALETTE.felt, 0.55);
      trim = mix(trim, "#8a5a33", 0.55);
      accent = mix(accent, "#b8323f", 0.5);
      break;
    case "fac_night":
      body = mix(body, "#1c1a36", 0.78);
      trim = "#0f0e22";
      accent = shade(def.colors.body, 0.25);
      neon = true;
      break;
    case "fac_gold":
      body = mix(body, PALETTE.gold, 0.42);
      trim = mix(trim, PALETTE.goldDeep, 0.5);
      accent = "#fff1c2";
      break;
    default:
      break;
  }
  return { body, trim, accent, glass, neon };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Ornament band between x0..x1 at vertical centre cy, band height bh. */
export function drawOrnamentBand(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x0: number,
  x1: number,
  cy: number,
  bh: number,
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, cy - bh / 2, x1 - x0, bh);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, bh * 0.14);
  ctx.lineCap = "round";
  const step = bh * 1.6;
  const n = Math.ceil((x1 - x0) / step) + 1;
  const start = (x0 + x1) / 2 - (n * step) / 2;
  for (let i = 0; i < n; i++) {
    const x = start + i * step + step / 2;
    const r = bh * 0.32;
    switch (kind) {
      case "orn_tumar": {
        ctx.beginPath();
        ctx.moveTo(x - r * 1.3, cy + r);
        ctx.lineTo(x, cy - r);
        ctx.lineTo(x + r * 1.3, cy + r);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, cy + r * 0.25, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "orn_shyrmak": {
        ctx.beginPath();
        ctx.moveTo(x - step / 2, cy);
        ctx.bezierCurveTo(x - step / 4, cy - r * 1.6, x + step / 4, cy + r * 1.6, x + step / 2, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x, cy - r * 0.6, r * 0.4, r * 0.22, -0.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "orn_gul": {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.45, r * 0.22, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, cy, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = shade(color, -0.35);
        ctx.fill();
        ctx.fillStyle = color;
        break;
      }
      default: {
        // Қошқар мүйіз — paired ram-horn curls
        ctx.beginPath();
        ctx.moveTo(x, cy + r * 1.1);
        ctx.lineTo(x, cy - r * 0.1);
        ctx.bezierCurveTo(x, cy - r * 1.2, x - r * 1.4, cy - r * 1.2, x - r * 1.3, cy - r * 0.1);
        ctx.bezierCurveTo(x - r * 1.2, cy + r * 0.6, x - r * 0.45, cy + r * 0.5, x - r * 0.5, cy);
        ctx.moveTo(x, cy - r * 0.1);
        ctx.bezierCurveTo(x, cy - r * 1.2, x + r * 1.4, cy - r * 1.2, x + r * 1.3, cy - r * 0.1);
        ctx.bezierCurveTo(x + r * 1.2, cy + r * 0.6, x + r * 0.45, cy + r * 0.5, x + r * 0.5, cy);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

const SKIN_TONES = ["#f1c9a5", "#e0ac84", "#c68b62", "#a86c4a", "#f5d6b8"];
const SHIRTS = ["#e85d5d", "#4fb6ff", "#ffd75e", "#8ef0a5", "#c27dff", "#ff9ad5", "#ffffff"];

function drawStudent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, skin: string, t: number): void {
  const bob = Math.sin(t * 3 + seed) * 0.6;
  const tone = SKIN_TONES[seed % SKIN_TONES.length];
  const shirt = skin === "stu_sport" ? ["#2a6fd6", "#d63a2a", "#f2b84b"][seed % 3] : SHIRTS[(seed * 7) % SHIRTS.length];
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(x, y + bob, s * 0.62, s * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.72 + bob, s * 0.36, 0, Math.PI * 2);
  ctx.fill();
  const hy = y - s * 0.72 + bob;
  if (skin === "stu_takiya") {
    ctx.fillStyle = seed % 2 ? "#b8323f" : "#1f5f99";
    ctx.beginPath();
    ctx.ellipse(x, hy - s * 0.24, s * 0.34, s * 0.16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x - s * 0.3, hy - s * 0.26, s * 0.6, s * 0.06);
  } else if (skin === "stu_grad") {
    ctx.fillStyle = "#1b1d3a";
    ctx.fillRect(x - s * 0.45, hy - s * 0.42, s * 0.9, s * 0.1);
    ctx.fillRect(x - s * 0.22, hy - s * 0.36, s * 0.44, s * 0.14);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(x + s * 0.3, hy - s * 0.38, s * 0.05, s * 0.3);
  } else {
    ctx.fillStyle = ["#2b1a12", "#3b2416", "#111", "#5a3a1e"][seed % 4];
    ctx.beginPath();
    ctx.arc(x, hy - s * 0.08, s * 0.37, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }
}

/**
 * Draw a room with its centre-bottom at the current origin (y grows downward, so the room
 * occupies y ∈ [-h, 0]).
 */
export function drawRoom(ctx: CanvasRenderingContext2D, type: RoomId, w: number, h: number, o: RoomDrawOptions): void {
  const def = ROOMS[type];
  const c = roomColors(def, o.facade, o.faculty);
  const x0 = -w / 2;
  const slabH = h * 0.13;
  const cornH = h * 0.2;
  const bodyTop = -h + cornH;

  // Body
  if (type === "garden") {
    ctx.fillStyle = rgba(c.glass, 0.55);
    roundRect(ctx, x0, -h, w, h, 4);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x0, -h, w, h, 4);
    ctx.clip();
    // plants inside the greenhouse
    for (let i = 0; i < 7; i++) {
      const px = x0 + ((i + 0.5) / 7) * w;
      const ph = h * (0.35 + ((o.seed + i * 13) % 5) * 0.06);
      ctx.fillStyle = i % 2 ? "#3f8f5a" : "#5cb071";
      ctx.beginPath();
      ctx.ellipse(px, -slabH - ph * 0.5, w / 14, ph * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.fillStyle = ["#ff8fb0", "#ffd75e", "#ffffff"][i % 3];
        ctx.beginPath();
        ctx.arc(px, -slabH - ph * 0.9, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // glass panes
    ctx.strokeStyle = c.body;
    ctx.lineWidth = 2;
    const panes = Math.round(w / 26);
    for (let i = 1; i < panes; i++) {
      const px = x0 + (i / panes) * w;
      ctx.beginPath();
      ctx.moveTo(px, -h);
      ctx.lineTo(px, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x0, -h * 0.55);
    ctx.lineTo(x0 + w, -h * 0.55);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.1, -h);
    ctx.lineTo(x0 + w * 0.3, -h);
    ctx.lineTo(x0 + w * 0.12, 0);
    ctx.lineTo(x0 - w * 0.08, 0);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = c.trim;
    ctx.lineWidth = 3;
    roundRect(ctx, x0, -h, w, h, 4);
    ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, shade(c.body, 0.1));
    g.addColorStop(1, shade(c.body, -0.14));
    ctx.fillStyle = g;
    roundRect(ctx, x0, -h, w, h, 4);
    ctx.fill();
    // brick texture hint
    ctx.strokeStyle = rgba(shade(c.body, -0.3), 0.18);
    ctx.lineWidth = 1;
    for (let yy = bodyTop + 8; yy < -slabH; yy += 9) {
      ctx.beginPath();
      ctx.moveTo(x0 + 2, yy);
      ctx.lineTo(x0 + w - 2, yy);
      ctx.stroke();
    }
    if (c.neon) {
      ctx.strokeStyle = c.accent;
      ctx.shadowColor = c.accent;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x0 + 2, -h + 2, w - 4, h - 4, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Slab
  ctx.fillStyle = shade(c.trim, -0.1);
  ctx.fillRect(x0, -slabH, w, slabH);
  ctx.fillStyle = rgba("#000000", 0.18);
  ctx.fillRect(x0, -slabH, w, 2);

  // Windows / special facades
  const n = type === "foundation" ? 4 : windowCount(w);
  const gap = w / n;
  const ww = Math.min(30, gap - 12);
  const wh = h * 0.42;
  const wy = -slabH - 5 - wh;
  const glowA = 0.55 + 0.45 * o.glow;
  let studentsLeft = Math.floor(o.students);
  for (let i = 0; i < n; i++) {
    const cx = x0 + gap * (i + 0.5);
    if (type === "foundation" && (i === 1 || i === 2)) continue;
    if (type === "garden") break;
    // window shape: arch
    const wx = cx - ww / 2;
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx, wy + ww / 2);
    ctx.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.closePath();
    let lit: CanvasGradient | string;
    if (type === "itlab") {
      const lg = ctx.createLinearGradient(0, wy, 0, wy + wh);
      lg.addColorStop(0, rgba("#7cefff", glowA));
      lg.addColorStop(1, rgba("#2a8fb8", glowA));
      lit = lg;
    } else {
      const lg = ctx.createLinearGradient(0, wy, 0, wy + wh);
      lg.addColorStop(0, rgba(c.glass, glowA));
      lg.addColorStop(1, rgba(PALETTE.windowHot, glowA * 0.9));
      lit = lg;
    }
    ctx.fillStyle = lit;
    ctx.fill();
    if (o.glow > 0.5) {
      ctx.save();
      ctx.shadowColor = type === "itlab" ? "#45e0ff" : PALETTE.windowHot;
      ctx.shadowBlur = 10 * o.glow;
      ctx.fill();
      ctx.restore();
    }
    // interior details
    ctx.save();
    ctx.clip();
    if (type === "library") {
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = ["#b8323f", "#2f4c8c", "#3c6e4f", "#f2b84b", "#6b4fa0"][(k + i) % 5];
        ctx.fillRect(wx + 2 + k * (ww / 5), wy + wh - 9, ww / 5 - 1.5, 8);
      }
    } else if (type === "itlab") {
      ctx.strokeStyle = "rgba(10,40,60,0.55)";
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        const len = ((o.seed + i * 3 + k * 5 + Math.floor(o.t * 2)) % 4) * 3 + 5;
        ctx.beginPath();
        ctx.moveTo(wx + 4, wy + ww / 2 + 3 + k * 5);
        ctx.lineTo(wx + 4 + len, wy + ww / 2 + 3 + k * 5);
        ctx.stroke();
      }
    } else if (type === "dorm") {
      ctx.fillStyle = ["#7fc8ff", "#ff9ad5", "#ffe08a", "#9be3b0"][(o.seed + i) % 4];
      ctx.fillRect(wx, wy + 2, ww * 0.28, wh);
      ctx.fillRect(wx + ww * 0.72, wy + 2, ww * 0.28, wh);
    } else if (type === "hall") {
      ctx.fillStyle = "#b8323f";
      ctx.fillRect(wx, wy, ww * 0.25, wh);
      ctx.fillRect(wx + ww * 0.75, wy, ww * 0.25, wh);
    } else if (type === "coworking") {
      ctx.fillStyle = "#3c6e4f";
      ctx.beginPath();
      ctx.arc(wx + ww * 0.8, wy + wh - 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // students
    const seats = 2;
    for (let s = 0; s < seats && studentsLeft > 0; s++, studentsLeft--) {
      const sx = cx + (s === 0 ? -ww * 0.2 : ww * 0.2);
      drawStudent(ctx, sx, wy + wh - 1, 7.5, o.seed * 3 + i * 2 + s, o.studentSkin, o.t);
    }
    ctx.restore();
    // frame
    ctx.strokeStyle = shade(c.trim, -0.1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx, wy + ww / 2);
    ctx.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.stroke();
    ctx.fillStyle = shade(c.trim, 0.05);
    ctx.fillRect(wx - 2, wy + wh, ww + 4, 3);
    if (type === "hall" && i < n - 1) {
      // pilasters between windows
      ctx.fillStyle = shade(c.body, -0.08);
      ctx.fillRect(cx + gap / 2 - 3, bodyTop + 2, 6, -slabH - bodyTop - 2);
    }
  }

  // Foundation door and steps
  if (type === "foundation") {
    const dw = 38;
    const dh = h * 0.6;
    ctx.fillStyle = "#3a2618";
    ctx.beginPath();
    ctx.moveTo(-dw / 2, -slabH);
    ctx.lineTo(-dw / 2, -slabH - dh + dw / 2);
    ctx.arc(0, -slabH - dh + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dw / 2, -slabH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(PALETTE.window, 0.85);
    ctx.fillRect(-dw / 2 + 5, -slabH - dh * 0.55, dw - 10, dh * 0.5);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = shade(c.trim, 0.1);
    ctx.fillRect(-dw / 2 - 10, -slabH, dw + 20, 4);
    ctx.fillRect(-dw / 2 - 18, -slabH + 4, dw + 36, 4);
    // lanterns
    for (const sx of [-dw / 2 - 12, dw / 2 + 12]) {
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(sx - 1, -slabH - dh * 0.75, 2, 8);
      ctx.fillStyle = PALETTE.window;
      ctx.save();
      ctx.shadowColor = PALETTE.windowHot;
      ctx.shadowBlur = 12;
      ctx.fillRect(sx - 4, -slabH - dh * 0.75 + 8, 8, 10);
      ctx.restore();
    }
  }

  // Awnings for chaikhana and canteen
  if (type === "chaikhana" || type === "canteen") {
    const aw = w * 0.92;
    const ay = bodyTop + 2;
    const stripes = 9;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? PALETTE.white : type === "chaikhana" ? "#b8323f" : "#2f4c8c";
      const sx = -aw / 2 + (i / stripes) * aw;
      ctx.beginPath();
      ctx.moveTo(sx, ay);
      ctx.lineTo(sx + aw / stripes, ay);
      ctx.lineTo(sx + aw / stripes, ay + 7);
      ctx.arc(sx + aw / stripes / 2, ay + 7, aw / stripes / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Nauryz garlands
  if (type === "nauryz" || o.festive) {
    const colors = ["#c0392b", "#2aa79a", "#f2b84b", "#2f4c8c", "#ff9ad5"];
    const flags = Math.floor(w / 14);
    ctx.strokeStyle = "rgba(60,30,10,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 4, bodyTop + 4);
    ctx.quadraticCurveTo(0, bodyTop + 16, x0 + w - 4, bodyTop + 4);
    ctx.stroke();
    for (let i = 0; i < flags; i++) {
      const tt = (i + 0.5) / flags;
      const fx = x0 + 4 + tt * (w - 8);
      const fy = bodyTop + 4 + 4 * 12 * tt * (1 - tt) * 1.0;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy);
      ctx.lineTo(fx + 4, fy);
      ctx.lineTo(fx, fy + 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Cornice with ornament
  const overhang = 4;
  ctx.fillStyle = c.trim;
  roundRect(ctx, x0 - overhang, -h, w + overhang * 2, cornH, 3);
  ctx.fill();
  ctx.fillStyle = rgba("#ffffff", 0.12);
  ctx.fillRect(x0 - overhang, -h, w + overhang * 2, 2);
  drawOrnamentBand(ctx, o.ornament, x0 + 2, x0 + w - 2, -h + cornH / 2, cornH * 0.8, c.neon ? c.accent : PALETTE.gold);

  // IT antenna / dish
  if (type === "itlab") {
    ctx.strokeStyle = "#9fb3c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + w - 16, -h);
    ctx.lineTo(x0 + w - 16, -h - 12);
    ctx.stroke();
    ctx.fillStyle = Math.sin(o.t * 4 + o.seed) > 0 ? "#ff5a5a" : "#7a2a2a";
    ctx.beginPath();
    ctx.arc(x0 + w - 16, -h - 13, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Medallion with the room's glyph
  const mr = Math.min(13, h * 0.2);
  const my = -h + cornH / 2;
  ctx.fillStyle = c.neon ? "#0f0e22" : PALETTE.cream;
  ctx.beginPath();
  ctx.arc(0, my, mr + 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = type === "faculty" && o.faculty ? FACULTIES[o.faculty].color : c.neon ? c.accent : PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, my, mr, 0, Math.PI * 2);
  ctx.fill();
  if (type === "faculty" && o.faculty) {
    ctx.fillStyle = PALETTE.white;
    ctx.font = `700 ${Math.round(mr * 1.25)}px "Rubik", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(FACULTIES[o.faculty].emblem, 0, my + 1);
  } else {
    drawGlyph(ctx, def.glyph, mr * 0.75, c.neon ? "#0f0e22" : shade(c.trim, -0.25));
  }

  // Crack overlay
  if (o.crack > 0.05) {
    ctx.strokeStyle = rgba("#1b0f08", 0.55 * o.crack);
    ctx.lineWidth = 1.6;
    const sx = x0 + w * (0.2 + ((o.seed * 37) % 60) / 100);
    ctx.beginPath();
    ctx.moveTo(sx, bodyTop);
    ctx.lineTo(sx + 6, bodyTop + 10);
    ctx.lineTo(sx - 3, bodyTop + 18);
    ctx.lineTo(sx + 5, bodyTop + 28);
    ctx.moveTo(sx + 6, bodyTop + 10);
    ctx.lineTo(sx + 14, bodyTop + 14);
    ctx.stroke();
  }
}

/** Small preview picture of a room for DOM cards (cached data URLs). */
const thumbCache = new Map<string, string>();

export function roomThumb(type: RoomId, faculty: FacultyId | null, facade = "fac_classic", ornament = "orn_koshkar"): string {
  const key = `${type}|${faculty}|${facade}|${ornament}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return "";
  const scale = 2;
  const w = 150;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = (w + 20) * scale;
  canvas.height = (h + 20) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(scale, scale);
  ctx.translate((w + 20) / 2, h + 10);
  drawRoom(ctx, type, w, h, {
    facade,
    ornament,
    faculty,
    studentSkin: "stu_classic",
    t: 0,
    glow: 0.8,
    students: type === "foundation" ? 0 : 3,
    crack: 0,
    seed: 3,
    festive: false,
  });
  const url = canvas.toDataURL("image/png");
  thumbCache.set(key, url);
  return url;
}
