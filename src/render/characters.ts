// Campus people as a vector rig. Every part is a Bézier shape baked once into a texture with soft
// light — cool ambient from above, a warm bounce from below-side (the windows) — and assembled into
// a hierarchy of sprites: head (hair, face, eyes that blink, brows and mouth with three states each),
// torso, two-segment arms and legs, shoes and an accessory that makes each archetype readable as a
// silhouette. Clothing, skin and hair are drawn in neutral tones and tinted, so one set of textures
// serves every faculty colour and skin tone.
//
// Units are world units (1 = 1 px at scale 1). A full figure is 30 tall: head 8, body 22 (1 : 2.75).

import { Container, Sprite, type Texture } from "pixi.js";
import type { RoomId } from "../meta/rooms";
import { FACULTIES, FACULTY_IDS, type FacultyId } from "../social/faculties";
import { hexToRgb, mix } from "./color";
import { canvasTexture, makeCanvas, type TextureBank } from "./textures";

// ── Proportions ──────────────────────────────────────────────────────────

export const FIGURE_H = 30;
const HEAD_H = 8;
const HIP_Y = -11;
const NECK_Y = -21.6;
const SHOULDER_Y = -20.4;
const SHOULDER_X = 3.7;
const HIP_X = 1.55;
const THIGH = 5.6;
const SHIN = 4.5;
const UPPER = 5;
const FORE = 4.2;

export type Archetype = "backpack" | "scarf" | "laptop" | "athlete" | "teacher" | "courier";
export const ARCHETYPES: Archetype[] = ["backpack", "scarf", "laptop", "athlete", "teacher", "courier"];
export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  backpack: "Студент с рюкзаком",
  scarf: "Студентка с шарфом",
  laptop: "Очкарик с ноутбуком",
  athlete: "Спортсмен с сумкой",
  teacher: "Преподаватель с портфелем",
  courier: "Курьер с термосумкой",
};

type Hair = "crop" | "long" | "sidepart" | "buzz" | "receding" | "capped" | "bun" | "ponytail";
type Torso = "hoodie" | "coat" | "sweater" | "track" | "blazer" | "courier";
type Shoe = "sneaker" | "boot" | "trainer" | "loafer" | "work";
type Brow = "neutral" | "raised" | "frown";
type Mouth = "smile" | "open" | "flat";
export type Pose = "idle" | "walk" | "cheer" | "panic" | "sleep" | "tea";

interface ArchDef {
  hair: Hair;
  torso: Torso;
  shoe: Shoe;
  pants: string;
  glasses?: boolean;
  beard?: boolean;
}

const ARCH: Record<Archetype, ArchDef> = {
  backpack: { hair: "crop", torso: "hoodie", shoe: "sneaker", pants: "#3e5a8c" },
  scarf: { hair: "long", torso: "coat", shoe: "boot", pants: "#2b2a3d" },
  laptop: { hair: "sidepart", torso: "sweater", shoe: "sneaker", pants: "#b59a74", glasses: true },
  athlete: { hair: "buzz", torso: "track", shoe: "trainer", pants: "#2c3046" },
  teacher: { hair: "receding", torso: "blazer", shoe: "loafer", pants: "#55596e", beard: true, glasses: true },
  courier: { hair: "capped", torso: "courier", shoe: "work", pants: "#3a3b48" },
};

const SKIN = ["#f3d2b6", "#e8bd98", "#d8a47e", "#c18a62", "#a97452"];
const HAIR_COLOR = ["#1d1a22", "#2e2219", "#4a3121", "#6b4a2e", "#141217"];
const GREY_HAIR = "#9a98a2";

// ── Baking ───────────────────────────────────────────────────────────────

interface Part {
  tex: Texture;
  ax: number;
  ay: number;
}

type Bounds = [number, number, number, number];
const cache = new Map<string, Part>();

/** Bake a part drawn in local units around its joint (0,0) into a texture anchored at that joint. */
function bake(key: string, k: number, b: Bounds, draw: (ctx: CanvasRenderingContext2D) => void): Part {
  const id = `${key}|${k}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const pad = 0.6;
  const x0 = b[0] - pad;
  const y0 = b[1] - pad;
  const w = b[2] - b[0] + pad * 2;
  const h = b[3] - b[1] + pad * 2;
  const [c, ctx] = makeCanvas(w * k, h * k);
  ctx.scale(k, k);
  ctx.translate(-x0, -y0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx);
  const part = { tex: canvasTexture(c, k), ax: -x0 / w, ay: -y0 / h };
  cache.set(id, part);
  return part;
}

const OUTLINE = "rgba(28,22,46,0.62)";

/**
 * Soft light on a shape: cool ambient from above, warm bounce from below-left (window light at
 * night), form shadow on the far side, and a thin dark outline that keeps small figures readable.
 */
function lit(ctx: CanvasRenderingContext2D, path: Path2D, b: Bounds, base: string, shadow: string, outline = true): void {
  const [x0, y0, x1, y1] = b;
  const w = x1 - x0;
  const h = y1 - y0;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, base);
  g.addColorStop(1, shadow);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const side = ctx.createLinearGradient(x0, 0, x1, 0);
  side.addColorStop(0.5, "rgba(36,30,78,0)");
  side.addColorStop(1, "rgba(36,30,78,0.24)");
  ctx.fillStyle = side;
  ctx.fillRect(x0, y0, w, h);
  const warm = ctx.createRadialGradient(x0, y1, 0, x0, y1, Math.max(w, h) * 0.95);
  warm.addColorStop(0, "rgba(255,190,110,0.34)");
  warm.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(x0, y0, w, h);
  const top = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.35);
  top.addColorStop(0, "rgba(214,232,255,0.42)");
  top.addColorStop(1, "rgba(214,232,255,0)");
  ctx.fillStyle = top;
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();
  if (outline) {
    ctx.lineWidth = 0.42;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke(path);
  }
}

/** Neutral (to-be-tinted) light: white top, cool grey shadow. */
const N = { base: "#ffffff", shadow: "#c3c5d8" };

function seam(ctx: CanvasRenderingContext2D, d: Path2D, a = 0.3, w = 0.32): void {
  ctx.lineWidth = w;
  ctx.strokeStyle = `rgba(28,22,46,${a})`;
  ctx.stroke(d);
}

function path(build: (p: Path2D) => void): Path2D {
  const p = new Path2D();
  build(p);
  return p;
}

// ── Head ─────────────────────────────────────────────────────────────────
// Head container origin = the neck point. The skull is an egg 7 wide, 8 tall centred 4.4 above it.

const HEAD_CY = -4.4;

function headPart(k: number): Part {
  return bake("face", k, [-4.2, -8.6, 4.2, 0.6], (ctx) => {
    const neck = path((p) => {
      p.moveTo(-1.25, -1.2);
      p.lineTo(-1.15, 0.6);
      p.lineTo(1.15, 0.6);
      p.lineTo(1.25, -1.2);
      p.closePath();
    });
    lit(ctx, neck, [-1.3, -1.2, 1.3, 0.6], "#e9e5ee", "#b9b5c8");
    const ears = path((p) => {
      p.ellipse(-3.45, HEAD_CY + 0.2, 0.75, 1.1, 0, 0, Math.PI * 2);
      p.ellipse(3.45, HEAD_CY + 0.2, 0.75, 1.1, 0, 0, Math.PI * 2);
    });
    lit(ctx, ears, [-4.2, HEAD_CY - 1, 4.2, HEAD_CY + 1.4], N.base, "#d9cfd6");
    const skull = path((p) => {
      p.moveTo(0, -8.4);
      p.bezierCurveTo(2.4, -8.4, 3.55, -6.6, 3.5, -4.5);
      p.bezierCurveTo(3.45, -2.4, 2.1, -0.4, 0, -0.35);
      p.bezierCurveTo(-2.1, -0.4, -3.45, -2.4, -3.5, -4.5);
      p.bezierCurveTo(-3.55, -6.6, -2.4, -8.4, 0, -8.4);
      p.closePath();
    });
    lit(ctx, skull, [-3.6, -8.4, 3.6, -0.35], N.base, "#d8cdd4");
    // cheeks and nose shading (tinted with the skin tone)
    ctx.fillStyle = "rgba(255,120,120,0.22)";
    ctx.beginPath();
    ctx.ellipse(-2.1, -3.2, 0.85, 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(2.1, -3.2, 0.85, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,70,60,0.35)";
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(0.15, -4.2);
    ctx.quadraticCurveTo(0.55, -3.4, 0.05, -3.25);
    ctx.stroke();
  });
}

function eyesPart(k: number): Part {
  // origin at the eye line (rows scale to blink)
  return bake("eyes", k, [-2.2, -0.75, 2.2, 0.75], (ctx) => {
    for (const x of [-1.3, 1.3]) {
      ctx.fillStyle = "#1d1a2e";
      ctx.beginPath();
      ctx.ellipse(x, 0, 0.5, 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x - 0.16, -0.24, 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function browPart(k: number, state: Brow): Part {
  return bake(`brow|${state}`, k, [-2.3, -0.9, 2.3, 0.6], (ctx) => {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.45;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (state === "neutral") {
        ctx.moveTo(s * 0.7, 0.05);
        ctx.quadraticCurveTo(s * 1.3, -0.3, s * 1.95, 0);
      } else if (state === "raised") {
        ctx.moveTo(s * 0.7, -0.35);
        ctx.quadraticCurveTo(s * 1.3, -0.85, s * 1.95, -0.45);
      } else {
        ctx.moveTo(s * 0.65, 0.3);
        ctx.lineTo(s * 1.95, -0.25);
      }
      ctx.stroke();
    }
  });
}

function mouthPart(k: number, state: Mouth): Part {
  return bake(`mouth|${state}`, k, [-1.3, -0.8, 1.3, 1.0], (ctx) => {
    if (state === "smile") {
      ctx.strokeStyle = "#5a2a2e";
      ctx.lineWidth = 0.38;
      ctx.beginPath();
      ctx.moveTo(-0.85, -0.15);
      ctx.quadraticCurveTo(0, 0.6, 0.85, -0.15);
      ctx.stroke();
    } else if (state === "open") {
      ctx.fillStyle = "#4a1f27";
      ctx.beginPath();
      ctx.ellipse(0, 0.1, 0.62, 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e86a76";
      ctx.beginPath();
      ctx.ellipse(0, 0.45, 0.4, 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#5a2a2e";
      ctx.lineWidth = 0.36;
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.05);
      ctx.lineTo(0.7, 0.05);
      ctx.stroke();
    }
  });
}

/** Hair drawn in light grey and tinted. `back` sits behind the skull, `front` on top of it. */
function hairPart(k: number, style: Hair, layer: "back" | "front"): Part | null {
  const key = `hair|${style}|${layer}`;
  const base = "#f4f4f6";
  const shadow = "#a3a3b6";
  const strands = (ctx: CanvasRenderingContext2D, pts: [number, number, number, number][]) => {
    ctx.strokeStyle = "rgba(40,30,60,0.28)";
    ctx.lineWidth = 0.22;
    for (const [x0, y0, x1, y1] of pts) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + 0.3, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }
  };
  if (layer === "back") {
    if (style === "long") {
      return bake(key, k, [-4.4, -9, 4.4, 3.2], (ctx) => {
        const p = path((q) => {
          q.moveTo(0, -8.9);
          q.bezierCurveTo(3.3, -8.9, 4.3, -6.2, 4.2, -3);
          q.bezierCurveTo(4.15, -0.4, 4.4, 1.6, 3.6, 3);
          q.bezierCurveTo(1.5, 2.2, -1.5, 2.2, -3.6, 3);
          q.bezierCurveTo(-4.4, 1.6, -4.15, -0.4, -4.2, -3);
          q.bezierCurveTo(-4.3, -6.2, -3.3, -8.9, 0, -8.9);
          q.closePath();
        });
        lit(ctx, p, [-4.4, -8.9, 4.4, 3], base, shadow);
        strands(ctx, [[-3.2, -5, -3.5, 2], [3.2, -5, 3.5, 2], [-2.2, -1, -2.4, 2.2], [2.2, -1, 2.4, 2.2]]);
      });
    }
    if (style === "bun" || style === "ponytail") {
      return bake(key, k, [-2.4, -11.2, 5.6, -3], (ctx) => {
        const p = style === "bun"
          ? path((q) => q.ellipse(0, -9.4, 1.8, 1.6, 0, 0, Math.PI * 2))
          : path((q) => {
              q.moveTo(2.6, -7.8);
              q.bezierCurveTo(4.8, -7.6, 5.5, -5.5, 4.6, -3.2);
              q.bezierCurveTo(4.2, -4.8, 3.4, -5.6, 2.2, -6);
              q.closePath();
            });
        lit(ctx, p, style === "bun" ? [-1.8, -11, 1.8, -7.8] : [2.2, -7.8, 5.5, -3.2], base, shadow);
      });
    }
    if (style === "capped") {
      return bake(key, k, [-3.9, -6, 3.9, -1.2], (ctx) => {
        const p = path((q) => {
          q.moveTo(-3.7, -5.6);
          q.lineTo(-3.8, -2.6);
          q.quadraticCurveTo(-3.2, -1.4, -2.4, -2.2);
          q.lineTo(2.4, -2.2);
          q.quadraticCurveTo(3.2, -1.4, 3.8, -2.6);
          q.lineTo(3.7, -5.6);
          q.closePath();
        });
        lit(ctx, p, [-3.8, -5.6, 3.8, -1.4], base, shadow);
      });
    }
    return null;
  }
  // front layer
  switch (style) {
    case "crop":
      return bake(key, k, [-3.9, -9.4, 3.9, -4.6], (ctx) => {
        const p = path((q) => {
          q.moveTo(-3.6, -4.8);
          q.bezierCurveTo(-4.0, -7.6, -2.4, -9.3, 0.2, -9.2);
          q.bezierCurveTo(2.8, -9.2, 4.1, -7.4, 3.6, -4.8);
          q.lineTo(2.9, -6.0);
          q.lineTo(2.2, -5.4);
          q.lineTo(1.3, -6.4);
          q.lineTo(0.2, -5.6);
          q.lineTo(-0.8, -6.5);
          q.lineTo(-1.9, -5.5);
          q.lineTo(-2.7, -6.2);
          q.closePath();
        });
        lit(ctx, p, [-3.9, -9.3, 3.9, -4.8], base, shadow);
        strands(ctx, [[-1.5, -8.6, -1.2, -6.6], [0.8, -8.8, 1.1, -6.8], [2.4, -8, 2.6, -6.4]]);
      });
    case "long":
      return bake(key, k, [-3.9, -9.1, 3.9, -3.8], (ctx) => {
        const p = path((q) => {
          q.moveTo(-3.7, -3.9);
          q.bezierCurveTo(-4.0, -7.4, -2.6, -9.0, 0.2, -9.0);
          q.bezierCurveTo(2.9, -9.0, 4.1, -7.2, 3.7, -3.9);
          q.bezierCurveTo(3.0, -5.6, 1.4, -6.6, -0.4, -6.4);
          q.bezierCurveTo(-1.6, -6.2, -2.6, -5.4, -3.7, -3.9);
          q.closePath();
        });
        lit(ctx, p, [-3.9, -9, 3.9, -3.9], base, shadow);
        strands(ctx, [[-2.2, -8.2, -3, -5], [0.4, -8.6, -0.6, -6.6], [2.4, -8.2, 3.2, -5.2]]);
      });
    case "sidepart":
      return bake(key, k, [-3.9, -9.6, 3.9, -4.8], (ctx) => {
        const p = path((q) => {
          q.moveTo(-3.6, -4.9);
          q.bezierCurveTo(-3.9, -7.8, -2.6, -9.5, 0.4, -9.4);
          q.bezierCurveTo(3.1, -9.3, 4.1, -7.6, 3.6, -5.0);
          q.bezierCurveTo(2.6, -6.6, 0.4, -7.4, -1.5, -7.0);
          q.bezierCurveTo(-2.4, -6.6, -3.1, -5.9, -3.6, -4.9);
          q.closePath();
        });
        lit(ctx, p, [-3.9, -9.4, 3.9, -4.9], base, shadow);
        strands(ctx, [[-1.6, -8.9, 2.8, -7.6], [-0.6, -9.2, 3.2, -8.0]]);
      });
    case "buzz":
      return bake(key, k, [-3.7, -8.8, 3.7, -5.4], (ctx) => {
        const p = path((q) => {
          q.moveTo(-3.45, -5.6);
          q.bezierCurveTo(-3.6, -7.8, -2.2, -8.75, 0, -8.75);
          q.bezierCurveTo(2.2, -8.75, 3.6, -7.8, 3.45, -5.6);
          q.bezierCurveTo(2.2, -6.5, -2.2, -6.5, -3.45, -5.6);
          q.closePath();
        });
        lit(ctx, p, [-3.6, -8.75, 3.6, -5.6], base, shadow);
      });
    case "receding":
      return bake(key, k, [-3.9, -7.6, 3.9, -2.8], (ctx) => {
        for (const s of [-1, 1]) {
          const p = path((q) => {
            q.moveTo(s * 3.55, -3.0);
            q.bezierCurveTo(s * 3.9, -5.0, s * 3.6, -6.6, s * 2.4, -7.4);
            q.bezierCurveTo(s * 2.6, -6.0, s * 2.7, -4.6, s * 2.6, -3.4);
            q.closePath();
          });
          lit(ctx, p, s < 0 ? [-3.9, -7.4, -2.4, -3] : [2.4, -7.4, 3.9, -3], base, shadow);
        }
      });
    case "capped":
      return null; // the cap is headwear (drawn in colour)
    case "bun":
    case "ponytail":
      return bake(key, k, [-3.8, -9.0, 3.8, -5.2], (ctx) => {
        const p = path((q) => {
          q.moveTo(-3.55, -5.3);
          q.bezierCurveTo(-3.8, -7.9, -2.2, -8.95, 0, -8.95);
          q.bezierCurveTo(2.2, -8.95, 3.8, -7.9, 3.55, -5.3);
          q.bezierCurveTo(2.6, -6.4, 1.2, -6.9, 0, -6.6);
          q.bezierCurveTo(-1.2, -6.9, -2.6, -6.4, -3.55, -5.3);
          q.closePath();
        });
        lit(ctx, p, [-3.8, -8.95, 3.8, -5.3], base, shadow);
        strands(ctx, [[0, -8.8, -2.6, -6.2], [0, -8.8, 2.6, -6.2]]);
      });
    default:
      return null;
  }
}

function beardPart(k: number): Part {
  return bake("beard", k, [-3.6, -4, 3.6, 0.4], (ctx) => {
    const p = path((q) => {
      q.moveTo(-3.3, -3.6);
      q.bezierCurveTo(-3.2, -1.4, -1.8, 0.2, 0, 0.25);
      q.bezierCurveTo(1.8, 0.2, 3.2, -1.4, 3.3, -3.6);
      q.bezierCurveTo(2.6, -2.2, 1.6, -2.4, 0.9, -2.6);
      q.quadraticCurveTo(0, -2.1, -0.9, -2.6);
      q.bezierCurveTo(-1.6, -2.4, -2.6, -2.2, -3.3, -3.6);
      q.closePath();
    });
    lit(ctx, p, [-3.3, -3.6, 3.3, 0.25], "#f4f4f6", "#a3a3b6");
  });
}

function glassesPart(k: number): Part {
  return bake("glasses", k, [-2.6, -0.95, 2.6, 0.95], (ctx) => {
    ctx.fillStyle = "rgba(190,225,255,0.35)";
    ctx.strokeStyle = "#2a2440";
    ctx.lineWidth = 0.34;
    for (const x of [-1.3, 1.3]) {
      ctx.beginPath();
      ctx.ellipse(x, 0, 1.05, 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.1);
    ctx.quadraticCurveTo(0, -0.35, 0.25, -0.1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(-1.8, -0.3);
    ctx.lineTo(-1.4, -0.6);
    ctx.moveTo(0.8, -0.3);
    ctx.lineTo(1.2, -0.6);
    ctx.stroke();
  });
}

type Headwear = "cap" | "headband" | "takiya" | "grad";

function headwearPart(k: number, kind: Headwear): Part {
  return bake(`hw|${kind}`, k, [-5.6, -11, 5.6, -4.4], (ctx) => {
    if (kind === "cap") {
      const crown = path((q) => {
        q.moveTo(-3.7, -5.4);
        q.bezierCurveTo(-3.9, -8.2, -2.2, -9.3, 0.2, -9.3);
        q.bezierCurveTo(2.6, -9.3, 3.9, -8.0, 3.7, -5.4);
        q.closePath();
      });
      lit(ctx, crown, [-3.9, -9.3, 3.9, -5.4], "#ff8a3c", "#c75418");
      const brim = path((q) => {
        q.moveTo(1.2, -5.6);
        q.bezierCurveTo(3.6, -5.9, 5.4, -5.6, 5.5, -4.8);
        q.bezierCurveTo(4.2, -4.6, 2.4, -4.8, 1.0, -5.0);
        q.closePath();
      });
      lit(ctx, brim, [1, -5.9, 5.5, -4.6], "#e86a24", "#a8410f");
      ctx.fillStyle = "#fff3d6";
      ctx.beginPath();
      ctx.arc(0.4, -7.4, 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "headband") {
      const band = path((q) => {
        q.moveTo(-3.55, -6.1);
        q.bezierCurveTo(-1.2, -7.0, 1.2, -7.0, 3.55, -6.1);
        q.lineTo(3.5, -5.2);
        q.bezierCurveTo(1.2, -6.0, -1.2, -6.0, -3.5, -5.2);
        q.closePath();
      });
      lit(ctx, band, [-3.6, -7, 3.6, -5.2], "#ffffff", "#d8d8e6");
      ctx.fillStyle = "#e04848";
      ctx.fillRect(-0.6, -6.7, 1.2, 0.8);
    } else if (kind === "takiya") {
      const cap = path((q) => {
        q.moveTo(-3.3, -6.6);
        q.bezierCurveTo(-3.2, -9.0, 3.2, -9.0, 3.3, -6.6);
        q.closePath();
      });
      lit(ctx, cap, [-3.3, -9, 3.3, -6.6], "#2f4c8c", "#1b2f5c");
      ctx.strokeStyle = "#f2b84b";
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.moveTo(-3.1, -6.9);
      ctx.lineTo(3.1, -6.9);
      for (let x = -2.4; x <= 2.4; x += 1.2) {
        ctx.moveTo(x, -7.1);
        ctx.quadraticCurveTo(x + 0.6, -8.3, x + 1.2, -7.1);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = "#1b1d3a";
      const board = path((q) => {
        q.moveTo(-5.2, -9.4);
        q.lineTo(0, -10.8);
        q.lineTo(5.2, -9.4);
        q.lineTo(0, -8.0);
        q.closePath();
      });
      lit(ctx, board, [-5.2, -10.8, 5.2, -8], "#2a2c50", "#14152c");
      const crown = path((q) => {
        q.moveTo(-3.0, -8.6);
        q.lineTo(-3.1, -6.6);
        q.quadraticCurveTo(0, -5.8, 3.1, -6.6);
        q.lineTo(3.0, -8.6);
        q.closePath();
      });
      lit(ctx, crown, [-3.1, -8.6, 3.1, -5.8], "#2a2c50", "#14152c");
      ctx.strokeStyle = "#f2b84b";
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.moveTo(0, -9.4);
      ctx.lineTo(3.8, -9.0);
      ctx.lineTo(4.0, -6.6);
      ctx.stroke();
    }
  });
}

// ── Torso ────────────────────────────────────────────────────────────────
// Origin = hip centre; the shoulder line sits 9.4 above it.

const T_TOP = SHOULDER_Y - HIP_Y; // -9.4

function torsoShape(kind: Torso): Path2D {
  return path((p) => {
    const flare = kind === "coat" ? 1.4 : kind === "blazer" ? 0.5 : 0.2;
    const len = kind === "coat" ? 4.6 : kind === "blazer" ? 1.8 : 1.1;
    p.moveTo(-1.2, T_TOP - 1.0);
    p.bezierCurveTo(-2.4, T_TOP - 0.9, -3.9, T_TOP - 0.5, -4.2, T_TOP + 0.6);
    p.bezierCurveTo(-4.3, T_TOP + 3, -3.7, -2.2, -3.6 - flare, len);
    p.lineTo(3.6 + flare, len);
    p.bezierCurveTo(3.7, -2.2, 4.3, T_TOP + 3, 4.2, T_TOP + 0.6);
    p.bezierCurveTo(3.9, T_TOP - 0.5, 2.4, T_TOP - 0.9, 1.2, T_TOP - 1.0);
    p.quadraticCurveTo(0, T_TOP + 0.1, -1.2, T_TOP - 1.0);
    p.closePath();
  });
}

function torsoPart(k: number, kind: Torso): Part {
  return bake(`torso|${kind}`, k, [-5.8, T_TOP - 2.4, 5.8, 5], (ctx) => {
    if (kind === "hoodie") {
      const hood = path((q) => {
        q.moveTo(-2.8, T_TOP - 0.6);
        q.bezierCurveTo(-3.2, T_TOP - 2.3, 3.2, T_TOP - 2.3, 2.8, T_TOP - 0.6);
        q.closePath();
      });
      lit(ctx, hood, [-3.2, T_TOP - 2.3, 3.2, T_TOP - 0.6], N.base, N.shadow);
    }
    const body = torsoShape(kind);
    lit(ctx, body, [-5.2, T_TOP - 1, 5.2, 4.6], N.base, N.shadow);
    // construction lines: side seams, hems, pockets
    seam(ctx, path((q) => {
      q.moveTo(-3.2, T_TOP + 2.2);
      q.quadraticCurveTo(-3.4, -2, -3.4, 0.4);
      q.moveTo(3.2, T_TOP + 2.2);
      q.quadraticCurveTo(3.4, -2, 3.4, 0.4);
    }), 0.18);
    switch (kind) {
      case "hoodie":
        seam(ctx, path((q) => {
          q.moveTo(-2.2, -2.6);
          q.lineTo(2.2, -2.6);
          q.lineTo(2.6, 0);
          q.lineTo(-2.6, 0);
          q.closePath();
        }), 0.3);
        seam(ctx, path((q) => {
          q.moveTo(-3.5, 0.6);
          q.lineTo(3.5, 0.6);
        }), 0.35, 0.5);
        break;
      case "coat":
        seam(ctx, path((q) => {
          q.moveTo(0.4, T_TOP + 0.6);
          q.lineTo(0.7, 4.4);
        }), 0.32);
        ctx.fillStyle = "rgba(28,22,46,0.45)";
        for (const y of [-6.2, -3.6, -1]) {
          ctx.beginPath();
          ctx.arc(1.4, y, 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        seam(ctx, path((q) => {
          q.moveTo(-4.4, 2.4);
          q.lineTo(-2.4, 2.2);
          q.moveTo(2.8, 2.2);
          q.lineTo(4.6, 2.4);
        }), 0.25);
        break;
      case "sweater":
        seam(ctx, path((q) => {
          for (let y = -6; y < 0; y += 1.4) {
            q.moveTo(-3.4, y);
            q.lineTo(3.4, y);
          }
        }), 0.1, 0.25);
        seam(ctx, path((q) => {
          q.moveTo(-3.7, 0.4);
          q.lineTo(3.7, 0.4);
        }), 0.32, 0.55);
        break;
      case "track":
        seam(ctx, path((q) => {
          q.moveTo(0, T_TOP + 0.2);
          q.lineTo(0, 1);
        }), 0.45, 0.3);
        break;
      case "blazer":
        seam(ctx, path((q) => {
          q.moveTo(-1.6, T_TOP - 0.4);
          q.lineTo(-0.2, -3.6);
          q.moveTo(1.6, T_TOP - 0.4);
          q.lineTo(0.2, -3.6);
          q.moveTo(-3, -2.4);
          q.lineTo(-1.6, -2.4);
          q.moveTo(1.6, -2.4);
          q.lineTo(3, -2.4);
        }), 0.42, 0.34);
        break;
      case "courier":
        seam(ctx, path((q) => {
          q.moveTo(0.3, T_TOP + 0.4);
          q.lineTo(0.3, 1);
          q.moveTo(-3.3, -3.2);
          q.lineTo(-1.4, -3.2);
          q.lineTo(-1.4, -1.6);
          q.lineTo(-3.3, -1.6);
        }), 0.32);
        break;
    }
  });
}

/** Fixed-colour details over the torso (collars, ties, stripes, straps). */
function trimPart(k: number, arch: Archetype): Part {
  return bake(`trim|${arch}`, k, [-5.8, T_TOP - 2.4, 5.8, 5], (ctx) => {
    switch (arch) {
      case "backpack": {
        // backpack straps over the shoulders + hoodie strings
        for (const s of [-1, 1]) {
          const strap = path((q) => {
            q.moveTo(s * 2.1, T_TOP - 0.6);
            q.bezierCurveTo(s * 2.6, -5.4, s * 2.8, -3.6, s * 2.9, -1.8);
            q.lineTo(s * 2.1, -1.8);
            q.bezierCurveTo(s * 2.0, -3.6, s * 1.7, -5.4, s * 1.3, T_TOP - 0.5);
            q.closePath();
          });
          lit(ctx, strap, s < 0 ? [-2.9, T_TOP - 0.6, -1.3, -1.8] : [1.3, T_TOP - 0.6, 2.9, -1.8], "#3a3f5c", "#23263a");
        }
        ctx.strokeStyle = "#f4f1e6";
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-0.6, T_TOP + 0.2);
        ctx.lineTo(-0.7, T_TOP + 2.6);
        ctx.moveTo(0.6, T_TOP + 0.2);
        ctx.lineTo(0.7, T_TOP + 2.6);
        ctx.stroke();
        break;
      }
      case "scarf": {
        const wrap = path((q) => {
          q.moveTo(-2.6, T_TOP - 1.1);
          q.bezierCurveTo(-1, T_TOP - 0.2, 1, T_TOP - 0.2, 2.6, T_TOP - 1.1);
          q.lineTo(2.8, T_TOP + 0.8);
          q.bezierCurveTo(1, T_TOP + 1.8, -1, T_TOP + 1.8, -2.8, T_TOP + 0.8);
          q.closePath();
        });
        lit(ctx, wrap, [-2.8, T_TOP - 1.1, 2.8, T_TOP + 1.8], "#e8545e", "#a82f3b");
        knit(ctx, -2.6, T_TOP - 0.6, 5.2);
        break;
      }
      case "laptop": {
        const collar = path((q) => {
          q.moveTo(-1.5, T_TOP - 0.7);
          q.lineTo(0, T_TOP + 1.9);
          q.lineTo(1.5, T_TOP - 0.7);
          q.lineTo(0.9, T_TOP - 0.9);
          q.lineTo(0, T_TOP + 0.6);
          q.lineTo(-0.9, T_TOP - 0.9);
          q.closePath();
        });
        lit(ctx, collar, [-1.5, T_TOP - 0.9, 1.5, T_TOP + 1.9], "#ffffff", "#d6dbe8");
        break;
      }
      case "athlete": {
        ctx.fillStyle = "#ffffff";
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 3.9, T_TOP + 1.2);
          ctx.quadraticCurveTo(s * 4.0, -4, s * 3.7, 0.9);
          ctx.lineTo(s * 3.2, 0.9);
          ctx.quadraticCurveTo(s * 3.5, -4, s * 3.4, T_TOP + 1.2);
          ctx.closePath();
          ctx.fill();
        }
        // duffel strap across the chest
        const strap = path((q) => {
          q.moveTo(-3.0, T_TOP - 0.4);
          q.lineTo(3.4, -0.6);
          q.lineTo(3.4, 0.4);
          q.lineTo(-3.0, T_TOP + 0.7);
          q.closePath();
        });
        lit(ctx, strap, [-3, T_TOP - 0.4, 3.4, 0.4], "#2c3046", "#16182a");
        break;
      }
      case "teacher": {
        const shirt = path((q) => {
          q.moveTo(-1.5, T_TOP - 0.7);
          q.lineTo(0, -3.4);
          q.lineTo(1.5, T_TOP - 0.7);
          q.closePath();
        });
        lit(ctx, shirt, [-1.5, T_TOP - 0.7, 1.5, -3.4], "#ffffff", "#dfe3ee");
        const tie = path((q) => {
          q.moveTo(-0.45, T_TOP - 0.2);
          q.lineTo(0.45, T_TOP - 0.2);
          q.lineTo(0.75, -4.4);
          q.lineTo(0, -3.5);
          q.lineTo(-0.75, -4.4);
          q.closePath();
        });
        lit(ctx, tie, [-0.75, T_TOP - 0.2, 0.75, -3.5], "#b8323f", "#7a1d28");
        break;
      }
      case "courier": {
        ctx.fillStyle = "#d9dde6";
        ctx.fillRect(-4.2, -5.0, 8.4, 0.9);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(-4.2, -5.0, 8.4, 0.25);
        const strap = path((q) => {
          for (const s of [-1, 1]) {
            q.moveTo(s * 2.0, T_TOP - 0.6);
            q.lineTo(s * 2.7, -2.0);
            q.lineTo(s * 1.9, -2.0);
            q.lineTo(s * 1.2, T_TOP - 0.5);
            q.closePath();
          }
        });
        lit(ctx, strap, [-2.7, T_TOP - 0.6, 2.7, -2], "#2a2d3d", "#14161f");
        ctx.fillStyle = "#ff8a3c";
        ctx.fillRect(1.0, -3.2, 1.7, 1.2);
        break;
      }
    }
  });
}

function knit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = "rgba(255,240,230,0.7)";
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  for (let i = 0; i < w; i += 0.9) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + 0.45, y + 0.5);
    ctx.lineTo(x + i + 0.9, y);
  }
  ctx.stroke();
}

// ── Limbs ────────────────────────────────────────────────────────────────

/** Sleeve segment hanging down from its joint (tinted with the clothing colour). */
function sleevePart(k: number, kind: "upper" | "fore", torso: Torso): Part {
  const len = kind === "upper" ? UPPER : FORE;
  const wTop = kind === "upper" ? 1.55 : 1.3;
  const wBot = kind === "upper" ? 1.3 : (torso === "track" || torso === "hoodie" ? 1.15 : 1.05);
  return bake(`sleeve|${kind}|${torso}`, k, [-wTop - 0.2, -0.9, wTop + 0.2, len + 0.6], (ctx) => {
    const p = path((q) => {
      q.moveTo(-wTop, 0);
      q.bezierCurveTo(-wTop, -1.1, wTop, -1.1, wTop, 0);
      q.bezierCurveTo(wTop + 0.1, len * 0.5, wBot + 0.1, len * 0.8, wBot, len);
      q.lineTo(-wBot, len);
      q.bezierCurveTo(-wBot - 0.1, len * 0.8, -wTop - 0.1, len * 0.5, -wTop, 0);
      q.closePath();
    });
    lit(ctx, p, [-wTop, -1.1, wTop, len], N.base, N.shadow);
    if (kind === "fore") seam(ctx, path((q) => {
      q.moveTo(-wBot, len - 0.6);
      q.lineTo(wBot, len - 0.6);
    }), 0.4, 0.35);
    if (torso === "track") {
      ctx.fillStyle = "rgba(255,255,255,0.0)";
      seam(ctx, path((q) => {
        q.moveTo(wTop - 0.35, 0);
        q.lineTo(wBot - 0.3, len);
      }), 0.55, 0.42);
    }
  });
}

function handPart(k: number): Part {
  return bake("hand", k, [-1.1, -0.3, 1.1, 2.1], (ctx) => {
    const p = path((q) => {
      q.moveTo(-0.85, 0);
      q.bezierCurveTo(-1.05, 0.9, -0.7, 1.9, 0, 1.95);
      q.bezierCurveTo(0.75, 1.9, 1.05, 0.9, 0.85, 0);
      q.closePath();
    });
    lit(ctx, p, [-1, 0, 1, 1.95], N.base, "#d8cdd4");
  });
}

function legPart(k: number, kind: "thigh" | "shin"): Part {
  const len = kind === "thigh" ? THIGH : SHIN;
  const wTop = kind === "thigh" ? 1.75 : 1.45;
  const wBot = kind === "thigh" ? 1.5 : 1.2;
  return bake(`leg|${kind}`, k, [-wTop - 0.2, -0.9, wTop + 0.2, len + 0.5], (ctx) => {
    const p = path((q) => {
      q.moveTo(-wTop, 0);
      q.bezierCurveTo(-wTop, -0.9, wTop, -0.9, wTop, 0);
      q.bezierCurveTo(wTop + 0.05, len * 0.55, wBot + 0.05, len * 0.8, wBot, len);
      q.lineTo(-wBot, len);
      q.bezierCurveTo(-wBot - 0.05, len * 0.8, -wTop - 0.05, len * 0.55, -wTop, 0);
      q.closePath();
    });
    lit(ctx, p, [-wTop, -0.9, wTop, len], N.base, N.shadow);
    seam(ctx, path((q) => {
      q.moveTo(wTop * 0.35, 0.4);
      q.lineTo(wBot * 0.3, len - 0.2);
    }), 0.16);
  });
}

function shoePart(k: number, kind: Shoe): Part {
  // origin = ankle; the toe points to +x (forward)
  const colors: Record<Shoe, [string, string, string]> = {
    sneaker: ["#f2f2f6", "#b8bccc", "#ffffff"],
    boot: ["#5a3424", "#2e1a12", "#3a2218"],
    trainer: ["#ff6b4a", "#b83a22", "#ffffff"],
    loafer: ["#3a2a22", "#1e1410", "#1e1410"],
    work: ["#4a4038", "#24201c", "#1a1714"],
  };
  const [base, shade, sole] = colors[kind];
  return bake(`shoe|${kind}`, k, [-1.6, -1.6, 2.9, 1.3], (ctx) => {
    const tall = kind === "boot" || kind === "work";
    const p = path((q) => {
      q.moveTo(-1.3, tall ? -1.5 : -0.4);
      q.lineTo(0.9, tall ? -1.5 : -0.5);
      q.bezierCurveTo(1.4, 0.1, 2.6, 0.1, 2.7, 0.8);
      q.lineTo(-1.4, 0.95);
      q.closePath();
    });
    lit(ctx, p, [-1.4, tall ? -1.5 : -0.5, 2.7, 0.95], base, shade);
    ctx.fillStyle = sole;
    ctx.beginPath();
    ctx.moveTo(-1.45, 0.75);
    ctx.lineTo(2.75, 0.62);
    ctx.lineTo(2.7, 1.15);
    ctx.lineTo(-1.45, 1.2);
    ctx.closePath();
    ctx.fill();
    if (kind === "sneaker" || kind === "trainer") {
      ctx.strokeStyle = kind === "trainer" ? "#ffffff" : "#5b8fd9";
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.moveTo(-0.6, 0.2);
      ctx.quadraticCurveTo(0.6, -0.2, 1.6, 0.5);
      ctx.stroke();
    }
  });
}

// ── Accessories ─────────────────────────────────────────────────────────

type AccPart = { part: Part; slot: "back" | "front" | "handF" | "handB" };

function accessory(k: number, arch: Archetype): AccPart[] {
  switch (arch) {
    case "backpack":
      return [{
        slot: "back",
        part: bake("acc|backpack", k, [-7.4, T_TOP - 0.8, -2.2, -0.6], (ctx) => {
          const bag = path((q) => {
            q.moveTo(-3.0, T_TOP - 0.2);
            q.bezierCurveTo(-6.6, T_TOP - 0.6, -7.3, -4.4, -6.6, -1.4);
            q.quadraticCurveTo(-6.2, -0.7, -3.4, -0.8);
            q.closePath();
          });
          lit(ctx, bag, [-7.3, T_TOP - 0.6, -3, -0.7], "#3f6fb3", "#22406c");
          seam(ctx, path((q) => {
            q.moveTo(-6.6, -4.2);
            q.quadraticCurveTo(-5, -3.8, -3.6, -4.2);
          }), 0.4);
          ctx.fillStyle = "#f2b84b";
          ctx.fillRect(-5.6, -3.6, 0.9, 0.5);
        }),
      }];
    case "scarf":
      return [{
        slot: "front",
        part: bake("acc|scarf", k, [0.6, T_TOP - 0.6, 3.6, -1.6], (ctx) => {
          const tail = path((q) => {
            q.moveTo(1.2, T_TOP + 0.4);
            q.bezierCurveTo(2.6, T_TOP + 1.6, 2.2, -4.6, 3.2, -2.0);
            q.lineTo(1.9, -1.8);
            q.bezierCurveTo(1.4, -4.4, 1.2, T_TOP + 2.4, 0.8, T_TOP + 0.6);
            q.closePath();
          });
          lit(ctx, tail, [0.8, T_TOP + 0.4, 3.2, -1.8], "#e8545e", "#a82f3b");
          ctx.strokeStyle = "rgba(255,240,230,0.85)";
          ctx.lineWidth = 0.22;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.moveTo(1.9 + i * 0.32, -2.0);
            ctx.lineTo(2.0 + i * 0.32, -1.3);
          }
          ctx.stroke();
        }),
      }];
    case "laptop":
      return [{
        slot: "handB",
        part: bake("acc|laptop", k, [-4.4, -0.6, 3.4, 1.6], (ctx) => {
          const lid = path((q) => {
            q.moveTo(-4.2, -0.3);
            q.lineTo(3.2, -0.3);
            q.lineTo(3.2, 1.2);
            q.lineTo(-4.2, 1.2);
            q.closePath();
          });
          lit(ctx, lid, [-4.2, -0.3, 3.2, 1.2], "#c9cfdc", "#7d8498");
          ctx.fillStyle = "#e6ebf5";
          ctx.beginPath();
          ctx.arc(-0.5, 0.45, 0.32, 0, Math.PI * 2);
          ctx.fill();
        }),
      }];
    case "athlete":
      return [{
        slot: "back",
        part: bake("acc|duffel", k, [-7.6, -3.8, 1.2, 2.4], (ctx) => {
          const bag = path((q) => {
            q.moveTo(-6.8, -2.6);
            q.bezierCurveTo(-7.6, -3.6, -1.4, -3.7, 0.4, -2.6);
            q.bezierCurveTo(1.2, -1.6, 1.0, 1.6, 0.2, 2.0);
            q.bezierCurveTo(-1.6, 2.4, -6.2, 2.4, -7.0, 2.0);
            q.bezierCurveTo(-7.8, 1.4, -7.6, -1.6, -6.8, -2.6);
            q.closePath();
          });
          lit(ctx, bag, [-7.6, -3.7, 1.2, 2.4], "#2f3550", "#191c2d");
          ctx.fillStyle = "#e04848";
          ctx.fillRect(-6.4, -0.6, 6.4, 0.6);
          seam(ctx, path((q) => {
            q.moveTo(-6.6, -2.2);
            q.quadraticCurveTo(-3.2, -3.0, 0.2, -2.2);
          }), 0.45, 0.3);
        }),
      }];
    case "teacher":
      return [{
        slot: "handF",
        part: bake("acc|briefcase", k, [-2.6, 0.6, 2.6, 5.0], (ctx) => {
          ctx.strokeStyle = "#2b1d14";
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(-0.9, 1.9);
          ctx.quadraticCurveTo(0, 0.7, 0.9, 1.9);
          ctx.stroke();
          const box = path((q) => {
            q.moveTo(-2.4, 1.9);
            q.lineTo(2.4, 1.9);
            q.lineTo(2.3, 4.9);
            q.lineTo(-2.3, 4.9);
            q.closePath();
          });
          lit(ctx, box, [-2.4, 1.9, 2.4, 4.9], "#8a5a33", "#4e3019");
          ctx.fillStyle = "#f2b84b";
          ctx.fillRect(-0.35, 2.6, 0.7, 0.5);
          seam(ctx, path((q) => {
            q.moveTo(-2.35, 2.9);
            q.lineTo(2.35, 2.9);
          }), 0.4);
        }),
      }];
    case "courier":
      return [{
        slot: "back",
        part: bake("acc|thermo", k, [-9.6, T_TOP - 3.4, -2.6, -0.4], (ctx) => {
          const box = path((q) => {
            q.moveTo(-3.0, T_TOP - 3.2);
            q.lineTo(-9.4, T_TOP - 3.2);
            q.lineTo(-9.4, -0.6);
            q.lineTo(-3.0, -0.6);
            q.closePath();
          });
          lit(ctx, box, [-9.4, T_TOP - 3.2, -3, -0.6], "#ffb300", "#c27c00");
          ctx.fillStyle = "#2a2d3d";
          ctx.fillRect(-9.4, T_TOP - 3.2, 6.4, 0.7);
          ctx.fillStyle = "#fff3d6";
          ctx.beginPath();
          ctx.arc(-6.2, -5.4, 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ff8a3c";
          ctx.beginPath();
          ctx.moveTo(-6.8, -5.9);
          ctx.lineTo(-5.4, -5.4);
          ctx.lineTo(-6.8, -4.9);
          ctx.closePath();
          ctx.fill();
        }),
      }];
  }
}

function cupPart(k: number): Part {
  return bake("cup", k, [-1.2, -0.4, 1.6, 1.8], (ctx) => {
    const c = path((q) => {
      q.moveTo(-1.0, -0.2);
      q.lineTo(1.0, -0.2);
      q.bezierCurveTo(1.0, 1.0, 0.6, 1.6, 0, 1.6);
      q.bezierCurveTo(-0.6, 1.6, -1.0, 1.0, -1.0, -0.2);
      q.closePath();
    });
    lit(ctx, c, [-1, -0.2, 1, 1.6], "#fbf3e2", "#c9b99a");
    ctx.fillStyle = "#2f4c8c";
    ctx.fillRect(-0.9, 0.35, 1.8, 0.28);
    ctx.fillStyle = "#8a4a22";
    ctx.beginPath();
    ctx.ellipse(0, -0.15, 0.9, 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function wispPart(k: number): Part {
  return bake("wisp", k, [-0.8, -2.4, 0.8, 0.2], (ctx) => {
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.7, -0.6, -0.7, -1.4, 0.2, -2.3);
    ctx.stroke();
  });
}

function zPart(k: number): Part {
  return bake("zz", k, [-0.9, -0.9, 0.9, 0.9], (ctx) => {
    ctx.strokeStyle = "#e8f0ff";
    ctx.lineWidth = 0.34;
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.6);
    ctx.lineTo(0.6, -0.6);
    ctx.lineTo(-0.6, 0.6);
    ctx.lineTo(0.6, 0.6);
    ctx.stroke();
  });
}

/** Bust of shoulders + upper chest for the window seats (origin = window sill, bottom centre). */
function bustTorsoPart(k: number, kind: Torso): Part {
  return bake(`bust|${kind}`, k, [-5, -6.2, 5, 0.2], (ctx) => {
    const p = path((q) => {
      q.moveTo(-1.2, -5.8);
      q.bezierCurveTo(-2.4, -5.7, -3.9, -5.3, -4.3, -4.0);
      q.bezierCurveTo(-4.6, -2.6, -4.5, -1.2, -4.4, 0);
      q.lineTo(4.4, 0);
      q.bezierCurveTo(4.5, -1.2, 4.6, -2.6, 4.3, -4.0);
      q.bezierCurveTo(3.9, -5.3, 2.4, -5.7, 1.2, -5.8);
      q.quadraticCurveTo(0, -4.8, -1.2, -5.8);
      q.closePath();
    });
    lit(ctx, p, [-4.6, -5.8, 4.6, 0], N.base, N.shadow);
    if (kind === "hoodie") seam(ctx, path((q) => {
      q.moveTo(-0.6, -5.1);
      q.lineTo(-0.7, -3);
      q.moveTo(0.6, -5.1);
      q.lineTo(0.7, -3);
    }), 0.4);
    if (kind === "blazer") seam(ctx, path((q) => {
      q.moveTo(-1.6, -5.6);
      q.lineTo(-0.2, -1.6);
      q.moveTo(1.6, -5.6);
      q.lineTo(0.2, -1.6);
    }), 0.45, 0.34);
  });
}

function bustTrimPart(k: number, arch: Archetype): Part | null {
  if (arch === "scarf") {
    return bake("bustTrim|scarf", k, [-3.2, -6.4, 3.2, -2.4], (ctx) => {
      const wrap = path((q) => {
        q.moveTo(-2.7, -6.2);
        q.bezierCurveTo(-1, -5.3, 1, -5.3, 2.7, -6.2);
        q.lineTo(2.9, -4.3);
        q.bezierCurveTo(1, -3.3, -1, -3.3, -2.9, -4.3);
        q.closePath();
      });
      lit(ctx, wrap, [-2.9, -6.2, 2.9, -3.3], "#e8545e", "#a82f3b");
      knit(ctx, -2.7, -5.7, 5.4);
    });
  }
  if (arch === "teacher") {
    return bake("bustTrim|teacher", k, [-1.6, -6.2, 1.6, -0.6], (ctx) => {
      const shirt = path((q) => {
        q.moveTo(-1.5, -5.8);
        q.lineTo(0, -1.4);
        q.lineTo(1.5, -5.8);
        q.closePath();
      });
      lit(ctx, shirt, [-1.5, -5.8, 1.5, -1.4], "#ffffff", "#dfe3ee");
      const tie = path((q) => {
        q.moveTo(-0.4, -5.4);
        q.lineTo(0.4, -5.4);
        q.lineTo(0.65, -1.2);
        q.lineTo(-0.65, -1.2);
        q.closePath();
      });
      lit(ctx, tie, [-0.65, -5.4, 0.65, -1.2], "#b8323f", "#7a1d28");
    });
  }
  if (arch === "laptop") {
    return bake("bustTrim|laptop", k, [-1.6, -6.2, 1.6, -3], (ctx) => {
      const collar = path((q) => {
        q.moveTo(-1.5, -5.8);
        q.lineTo(0, -3.3);
        q.lineTo(1.5, -5.8);
        q.lineTo(0.9, -6.0);
        q.lineTo(0, -4.4);
        q.lineTo(-0.9, -6.0);
        q.closePath();
      });
      lit(ctx, collar, [-1.5, -6, 1.5, -3.3], "#ffffff", "#d6dbe8");
    });
  }
  if (arch === "courier") {
    return bake("bustTrim|courier", k, [-4.4, -2.6, 4.4, -1.4], (ctx) => {
      ctx.fillStyle = "#d9dde6";
      ctx.fillRect(-4.3, -2.4, 8.6, 0.9);
    });
  }
  return null;
}

/** Full-body silhouette (dark, solid) for the distant crowd on the plaza. */
export function crowdSilhouette(bank: TextureBank, arch: Archetype, variant: number): Part {
  const k = bank.scale;
  const hair: Hair = variant % 3 === 0 ? ARCH[arch].hair : (["bun", "ponytail", "crop", "long", "sidepart", "buzz"] as Hair[])[variant % 6];
  return bake(`crowd|${arch}|${hair}`, k, [-10, -32, 7, 0.5], (ctx) => {
    ctx.fillStyle = "#ffffff";
    const off = (dx: number, dy: number, part: Part | null) => {
      if (!part) return;
      const src = part.tex.source.resource as HTMLCanvasElement;
      const w = part.tex.width;
      const h = part.tex.height;
      ctx.drawImage(src, dx - part.ax * w, dy - part.ay * h, w, h);
    };
    const def = ARCH[arch];
    const acc = accessory(k, arch);
    for (const a of acc) if (a.slot === "back") off(0, HIP_Y, a.part);
    off(-HIP_X, HIP_Y, legPart(k, "thigh"));
    off(HIP_X, HIP_Y, legPart(k, "thigh"));
    off(-HIP_X, HIP_Y + THIGH, legPart(k, "shin"));
    off(HIP_X, HIP_Y + THIGH, legPart(k, "shin"));
    off(-HIP_X, HIP_Y + THIGH + SHIN, shoePart(k, def.shoe));
    off(HIP_X, HIP_Y + THIGH + SHIN, shoePart(k, def.shoe));
    off(0, NECK_Y, hairPart(k, hair, "back"));
    off(0, HIP_Y, torsoPart(k, def.torso));
    off(0, NECK_Y, headPart(k));
    off(0, NECK_Y, hairPart(k, hair, "front"));
    if (hair === "capped") off(0, NECK_Y, headwearPart(k, "cap"));
    for (const s of [-1, 1]) {
      off(s * SHOULDER_X, SHOULDER_Y, sleevePart(k, "upper", def.torso));
      off(s * SHOULDER_X, SHOULDER_Y + UPPER, sleevePart(k, "fore", def.torso));
    }
    for (const a of acc) if (a.slot !== "back") off(a.slot === "front" ? 0 : SHOULDER_X, a.slot === "front" ? HIP_Y : SHOULDER_Y + UPPER + FORE, a.part);
    // flatten to one solid silhouette colour
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-12, -40, 30, 50);
    ctx.globalCompositeOperation = "source-over";
  });
}

// ── Specs ───────────────────────────────────────────────────────────────

export interface CharacterSpec {
  arch: Archetype;
  hair: Hair;
  skin: string;
  hairColor: string;
  cloth: string;
  pants: string;
  headwear: Headwear | null;
  seed: number;
}

function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

const ROOM_ARCH: Partial<Record<RoomId, Archetype[]>> = {
  library: ["laptop", "teacher", "scarf", "laptop"],
  itlab: ["laptop", "laptop", "backpack", "courier"],
  gym: ["athlete", "athlete", "backpack", "scarf"],
  faculty: ["teacher", "laptop", "scarf", "backpack"],
  canteen: ["courier", "backpack", "scarf", "athlete"],
  chaikhana: ["teacher", "scarf", "backpack", "courier"],
  dorm: ["backpack", "scarf", "athlete", "laptop"],
  coworking: ["laptop", "scarf", "courier", "teacher"],
};

/**
 * A deterministic person for a seed: archetype (biased by the room), skin tone, hair, faculty
 * clothing colour (biased to the player's faculty) and the equipped student skin (takiya,
 * mortarboard, sports kit) for the students.
 */
export function specFor(seed: number, playerFaculty: FacultyId | null, studentSkin: string, room?: RoomId): CharacterSpec {
  const h = hash(seed);
  const pool = (room && ROOM_ARCH[room]) || ARCHETYPES;
  const arch = pool[h % pool.length];
  const def = ARCH[arch];
  const altHair: Hair[] = ["bun", "ponytail", "crop", "long", "sidepart", "buzz"];
  const hair: Hair = (h >>> 5) % 4 === 0 && arch !== "teacher" && arch !== "courier" && arch !== "athlete" ? altHair[(h >>> 9) % altHair.length] : def.hair;
  const fac = (h >>> 12) % 3 === 0 || !playerFaculty ? FACULTY_IDS[(h >>> 14) % FACULTY_IDS.length] : playerFaculty;
  const student = arch !== "teacher" && arch !== "courier";
  let cloth = FACULTIES[fac].color;
  if (arch === "teacher") cloth = mix(FACULTIES[fac].dark, "#3a3550", 0.5);
  if (arch === "courier") cloth = "#2d6a5c";
  if (student && studentSkin === "stu_sport") cloth = ["#2a6fd6", "#d63a2a", "#f2b84b"][(h >>> 3) % 3];
  let headwear: Headwear | null = null;
  if (arch === "courier") headwear = "cap";
  else if (arch === "athlete") headwear = "headband";
  if (student && studentSkin === "stu_takiya") headwear = "takiya";
  if (student && studentSkin === "stu_grad") headwear = "grad";
  return {
    arch,
    hair: arch === "teacher" ? "receding" : hair,
    skin: SKIN[(h >>> 18) % SKIN.length],
    hairColor: arch === "teacher" ? GREY_HAIR : HAIR_COLOR[(h >>> 21) % HAIR_COLOR.length],
    cloth,
    pants: def.pants,
    headwear,
    seed,
  };
}

const toHex = (c: string) => {
  const [r, g, b] = hexToRgb(c);
  return (r << 16) | (g << 8) | b;
};

function sprite(part: Part | null, tint?: string): Sprite {
  const s = new Sprite(part?.tex);
  if (part) s.anchor.set(part.ax, part.ay);
  else s.visible = false;
  if (tint) s.tint = toHex(tint);
  return s;
}

// ── The rig ─────────────────────────────────────────────────────────────

interface Face {
  eyes: Sprite;
  brows: Sprite;
  mouth: Sprite;
  browTex: Record<Brow, Texture>;
  mouthTex: Record<Mouth, Texture>;
}

function buildHead(k: number, spec: CharacterSpec): { head: Container; face: Face } {
  const def = ARCH[spec.arch];
  const head = new Container();
  const back = sprite(hairPart(k, spec.hair, "back"), spec.hairColor);
  const face = sprite(headPart(k), spec.skin);
  const eyes = sprite(eyesPart(k));
  eyes.position.set(0, HEAD_CY - 0.2);
  const browTex = { neutral: browPart(k, "neutral").tex, raised: browPart(k, "raised").tex, frown: browPart(k, "frown").tex };
  const bp = browPart(k, "neutral");
  const brows = new Sprite(bp.tex);
  brows.anchor.set(bp.ax, bp.ay);
  brows.position.set(0, HEAD_CY - 1.55);
  brows.tint = toHex(mix(spec.hairColor, "#000000", 0.2));
  const mouthTex = { smile: mouthPart(k, "smile").tex, open: mouthPart(k, "open").tex, flat: mouthPart(k, "flat").tex };
  const mp = mouthPart(k, "smile");
  const mouth = new Sprite(mp.tex);
  mouth.anchor.set(mp.ax, mp.ay);
  mouth.position.set(0, -2.15);
  const front = sprite(hairPart(k, spec.hair, "front"), spec.hairColor);
  head.addChild(back, face);
  if (def.beard) head.addChild(sprite(beardPart(k), spec.hairColor));
  head.addChild(eyes, brows, mouth);
  if (def.glasses) {
    const g = sprite(glassesPart(k));
    g.position.set(0, HEAD_CY - 0.2);
    head.addChild(g);
  }
  head.addChild(front);
  if (spec.headwear) head.addChild(sprite(headwearPart(k, spec.headwear)));
  return { head, face: { eyes, brows, mouth, browTex, mouthTex } };
}

interface Limb {
  root: Container;
  joint: Container;
}

function buildArm(k: number, spec: CharacterSpec, held: Part | null, cup: boolean): Limb & { cup: Sprite | null; wisps: Sprite[] } {
  const def = ARCH[spec.arch];
  const root = new Container();
  root.addChild(sprite(sleevePart(k, "upper", def.torso), spec.cloth));
  const joint = new Container();
  joint.position.set(0, UPPER);
  joint.addChild(sprite(sleevePart(k, "fore", def.torso), spec.cloth));
  const hand = sprite(handPart(k), spec.skin);
  hand.position.set(0, FORE);
  joint.addChild(hand);
  if (held) {
    const h = sprite(held);
    h.position.set(0, FORE);
    joint.addChild(h);
  }
  let cupSprite: Sprite | null = null;
  const wisps: Sprite[] = [];
  if (cup) {
    cupSprite = sprite(cupPart(k));
    cupSprite.position.set(0.4, FORE + 0.6);
    cupSprite.visible = false;
    joint.addChild(cupSprite);
    for (let i = 0; i < 2; i++) {
      const w = sprite(wispPart(k));
      w.position.set(0.2 + i * 0.6, FORE + 0.2);
      w.visible = false;
      joint.addChild(w);
      wisps.push(w);
    }
  }
  root.addChild(joint);
  return { root, joint, cup: cupSprite, wisps };
}

function buildLeg(k: number, spec: CharacterSpec): Limb {
  const def = ARCH[spec.arch];
  const root = new Container();
  root.addChild(sprite(legPart(k, "thigh"), spec.pants));
  const joint = new Container();
  joint.position.set(0, THIGH);
  joint.addChild(sprite(legPart(k, "shin"), spec.pants));
  const shoe = sprite(shoePart(k, def.shoe));
  shoe.position.set(0, SHIN);
  joint.addChild(shoe);
  root.addChild(joint);
  return { root, joint };
}

const D = Math.PI / 180;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Walk keyframes [thighF, shinF, thighB, shinB, armF, foreF, armB, foreB, bob] (degrees forward). */
const WALK: number[][] = [
  [24, 4, -20, 22, -22, 14, 20, 18, 0],
  [8, 12, -6, 34, -10, 18, 10, 22, -0.45],
  [-20, 22, 24, 4, 20, 18, -22, 14, 0],
  [-6, 34, 8, 12, 10, 22, -10, 18, -0.45],
];

/** A full figure for the plaza: idle, walk, cheer, panic, sleep, tea. */
export class Figure extends Container {
  readonly spec: CharacterSpec;
  pose: Pose = "idle";
  /** Walk cycles per second (scaled by speed). */
  stride = 1.15;
  private t: number;
  private nextBlink: number;
  private blinkT = 0;
  private readonly rig = new Container();
  private readonly torso: Container;
  private readonly head: Container;
  private readonly face: Face;
  private readonly armF: ReturnType<typeof buildArm>;
  private readonly armB: ReturnType<typeof buildArm>;
  private readonly legF: Limb;
  private readonly legB: Limb;
  private readonly front: Sprite | null;
  private readonly zs: Sprite[] = [];

  constructor(bank: TextureBank, spec: CharacterSpec) {
    super();
    this.spec = spec;
    const k = bank.scale;
    const def = ARCH[spec.arch];
    this.t = (spec.seed % 997) * 0.37;
    this.nextBlink = 1 + (spec.seed % 5);
    const acc = accessory(k, spec.arch);
    const back = acc.filter((a) => a.slot === "back");
    this.addChild(this.rig);
    for (const a of back) {
      const s = sprite(a.part);
      s.position.set(0, HIP_Y);
      this.rig.addChild(s);
    }
    this.armB = buildArm(k, spec, acc.find((a) => a.slot === "handB")?.part ?? null, false);
    this.armB.root.position.set(-SHOULDER_X + 0.4, SHOULDER_Y);
    this.legB = buildLeg(k, spec);
    this.legB.root.position.set(-HIP_X * 0.6, HIP_Y);
    this.legF = buildLeg(k, spec);
    this.legF.root.position.set(HIP_X * 0.6, HIP_Y);
    this.rig.addChild(this.armB.root, this.legB.root, this.legF.root);
    for (const s of [this.armB.root, this.legB.root]) s.tint = 0xd8d6e6; // the far side sits in shade
    this.torso = new Container();
    this.torso.position.set(0, HIP_Y);
    this.torso.addChild(sprite(torsoPart(k, def.torso), spec.cloth), sprite(trimPart(k, spec.arch)));
    this.rig.addChild(this.torso);
    const { head, face } = buildHead(k, spec);
    this.head = head;
    this.face = face;
    head.position.set(0, NECK_Y - HIP_Y);
    this.torso.addChild(head);
    const frontAcc = acc.find((a) => a.slot === "front");
    this.front = frontAcc ? sprite(frontAcc.part) : null;
    if (this.front) this.torso.addChild(this.front);
    this.armF = buildArm(k, spec, acc.find((a) => a.slot === "handF")?.part ?? null, true);
    this.armF.root.position.set(SHOULDER_X - 0.4, SHOULDER_Y);
    this.rig.addChild(this.armF.root);
    for (let i = 0; i < 3; i++) {
      const z = sprite(zPart(k));
      z.visible = false;
      this.rig.addChild(z);
      this.zs.push(z);
    }
  }

  /** dt in seconds; night 0..1 tints the figure with the cool night ambient. */
  update(dt: number, night: number): void {
    this.t += dt;
    const t = this.t;
    const p = this.pose;
    // light: the baked parts carry the warm bounce; at night a cool ambient settles over them
    const amb = 1 - night * 0.38;
    this.rig.tint = (Math.round(255 * amb * 0.96) << 16) | (Math.round(255 * amb * 0.98) << 8) | Math.round(255 * Math.min(1, amb * 1.12));
    // blink
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.13;
      this.nextBlink = 2 + ((this.spec.seed + Math.floor(t * 7)) % 40) / 10;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    const closed = p === "sleep" || this.blinkT > 0;
    this.face.eyes.scale.y = closed ? 0.12 : 1;
    // expression
    const brow: Brow = p === "cheer" || p === "panic" ? "raised" : p === "walk" && Math.sin(t * 0.4 + this.spec.seed) > 0.85 ? "frown" : "neutral";
    const mouth: Mouth = p === "cheer" || p === "panic" ? "open" : p === "sleep" || p === "tea" ? "flat" : "smile";
    this.face.brows.texture = this.face.browTex[brow];
    this.face.mouth.texture = this.face.mouthTex[mouth];
    this.face.brows.y = HEAD_CY - 1.55 - (brow === "raised" ? 0.15 : 0);
    // reset
    let rootY = 0;
    let rootX = 0;
    let rootRot = 0;
    let headRot = 0;
    let torsoSY = 1;
    let aF = 6;
    let fF = 10;
    let aB = -6;
    let fB = 10;
    let lF = 2;
    let sF = 0;
    let lB = -2;
    let sB = 0;
    const breath = Math.sin(t * Math.PI * 2 * 0.4);
    switch (p) {
      case "idle":
        torsoSY = 1 + breath * 0.014;
        rootRot = Math.sin(t * 1.6 + this.spec.seed) * 0.018;
        headRot = Math.sin(t * 0.9 + this.spec.seed) * 0.05;
        aF = 4 + breath * 2;
        aB = -4 - breath * 2;
        break;
      case "walk": {
        const ph = (t * this.stride * 2) % 4;
        const i = Math.floor(ph);
        const f = ease(ph - i);
        const a = WALK[i];
        const b = WALK[(i + 1) % 4];
        const v = a.map((x, j) => x + (b[j] - x) * f);
        [lF, sF, lB, sB, aF, fF, aB, fB] = v;
        rootY = v[8];
        headRot = Math.sin(ph * Math.PI) * 0.03;
        break;
      }
      case "cheer": {
        const j = Math.abs(Math.sin(t * 5.5));
        rootY = -j * 2.8;
        aF = 160 + Math.sin(t * 11) * 12;
        aB = 165 + Math.sin(t * 11 + 1) * 12;
        fF = -20;
        fB = -20;
        lF = 8 * j;
        sF = 16 * j;
        lB = -8 * j;
        sB = 16 * j;
        headRot = -0.08;
        break;
      }
      case "panic":
        rootX = Math.sin(t * 31) * 0.45;
        rootRot = Math.sin(t * 24) * 0.06;
        aF = 150;
        fF = 125;
        aB = 150;
        fB = 125;
        lF = Math.sin(t * 18) * 10;
        lB = -Math.sin(t * 18) * 10;
        sF = 8;
        sB = 8;
        break;
      case "sleep":
        torsoSY = 1 + Math.sin(t * Math.PI * 2 * 0.22) * 0.02;
        headRot = 0.38;
        rootRot = 0.05;
        aF = 2;
        aB = -2;
        break;
      case "tea": {
        torsoSY = 1 + breath * 0.012;
        const sip = Math.max(0, Math.sin(t * 0.8 + this.spec.seed)) ** 6;
        aF = 80 + sip * 6;
        fF = 150 + sip * 8;
        headRot = -sip * 0.12;
        break;
      }
    }
    this.rig.position.set(rootX, rootY);
    this.rig.rotation = rootRot;
    this.torso.scale.y = torsoSY;
    this.head.rotation = headRot;
    // angles are "forward-positive" degrees; facing +x, forward = counter-clockwise for hanging limbs
    this.armF.root.rotation = -aF * D;
    this.armF.joint.rotation = -fF * D;
    this.armB.root.rotation = -aB * D;
    this.armB.joint.rotation = -fB * D;
    this.legF.root.rotation = -lF * D;
    this.legF.joint.rotation = sF * D;
    this.legB.root.rotation = -lB * D;
    this.legB.joint.rotation = sB * D;
    const cupOn = p === "tea";
    if (this.armF.cup) this.armF.cup.visible = cupOn;
    this.armF.wisps.forEach((w, i) => {
      w.visible = cupOn;
      if (!cupOn) return;
      const ph = (t * 0.7 + i * 0.5) % 1;
      w.y = FORE - ph * 2.4;
      w.alpha = Math.sin(ph * Math.PI) * 0.8;
    });
    if (this.front) this.front.rotation = p === "walk" ? Math.sin(t * this.stride * Math.PI * 2) * 0.06 : Math.sin(t * 1.3) * 0.03;
    this.zs.forEach((z, i) => {
      z.visible = p === "sleep";
      if (!z.visible) return;
      const ph = (t * 0.45 + i / 3) % 1;
      z.position.set(2.4 + ph * 2.4, NECK_Y - 7 - ph * 6);
      z.scale.set(0.6 + ph * 0.7);
      z.alpha = Math.sin(ph * Math.PI);
    });
  }
}

/** Window-seat bust: head + shoulders with breathing, blinking, a rare wave, tea or sleep. */
export class Bust extends Container {
  readonly spec: CharacterSpec;
  mood: "idle" | "sleep" | "tea" | "cheer" = "idle";
  private t: number;
  private nextBlink: number;
  private blinkT = 0;
  private waveT = 0;
  private nextWave: number;
  private readonly body = new Container();
  private readonly head: Container;
  private readonly face: Face;
  private readonly arm: ReturnType<typeof buildArm>;
  private readonly zs: Sprite[] = [];

  constructor(bank: TextureBank, spec: CharacterSpec) {
    super();
    this.spec = spec;
    const k = bank.scale;
    const def = ARCH[spec.arch];
    this.t = (spec.seed % 991) * 0.53;
    this.nextBlink = 1.5 + (spec.seed % 4);
    this.nextWave = 6 + (spec.seed % 9);
    this.arm = buildArm(k, spec, null, true);
    this.arm.root.position.set(3.2, -4.6);
    this.arm.root.visible = false;
    const torso = sprite(bustTorsoPart(k, def.torso), spec.cloth);
    const trim = bustTrimPart(k, spec.arch);
    const { head, face } = buildHead(k, spec);
    this.head = head;
    this.face = face;
    head.position.set(0, -5.7);
    this.body.addChild(torso);
    if (trim) this.body.addChild(sprite(trim));
    this.body.addChild(head);
    this.addChild(this.body, this.arm.root);
    for (let i = 0; i < 2; i++) {
      const z = sprite(zPart(k));
      z.visible = false;
      this.addChild(z);
      this.zs.push(z);
    }
  }

  update(dt: number, night: number): void {
    this.t += dt;
    const t = this.t;
    const m = this.mood;
    // warm interior light from behind at night, cool otherwise
    const warm = night * 0.25;
    this.body.tint = (255 << 16) | (Math.round(255 * (1 - warm * 0.25)) << 8) | Math.round(255 * (1 - warm * 0.6));
    const breath = Math.sin(t * Math.PI * 2 * 0.4);
    this.body.scale.y = 1 + breath * 0.012;
    this.head.rotation = m === "sleep" ? 0.42 : Math.sin(t * 0.7 + this.spec.seed) * 0.06;
    this.head.y = -5.7 - (m === "cheer" ? Math.abs(Math.sin(t * 6)) * 0.8 : 0);
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.13;
      this.nextBlink = 2 + ((this.spec.seed * 7 + Math.floor(t * 5)) % 40) / 10;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    this.face.eyes.scale.y = m === "sleep" || this.blinkT > 0 ? 0.12 : 1;
    this.face.mouth.texture = this.face.mouthTex[m === "cheer" ? "open" : m === "sleep" || m === "tea" ? "flat" : "smile"];
    this.face.brows.texture = this.face.browTex[m === "cheer" ? "raised" : "neutral"];
    // arm: wave now and then, tea at the chaikhana, both arms up when cheering
    const armOn = m === "tea" || m === "cheer" || this.waveT > 0;
    this.arm.root.visible = armOn;
    if (m === "idle") {
      this.nextWave -= dt;
      if (this.nextWave <= 0 && this.waveT <= 0) {
        this.waveT = 1.4;
        this.nextWave = 8 + ((this.spec.seed * 13 + Math.floor(t)) % 12);
      }
    }
    if (this.waveT > 0) {
      this.waveT -= dt;
      this.arm.root.rotation = -150 * D;
      this.arm.joint.rotation = (-30 + Math.sin(t * 14) * 28) * D;
    } else if (m === "tea") {
      const sip = Math.max(0, Math.sin(t * 0.9 + this.spec.seed)) ** 6;
      this.arm.root.rotation = -(80 + sip * 6) * D;
      this.arm.joint.rotation = -(150 + sip * 8) * D;
    } else if (m === "cheer") {
      this.arm.root.rotation = -(165 + Math.sin(t * 10) * 10) * D;
      this.arm.joint.rotation = -10 * D;
    }
    if (this.arm.cup) this.arm.cup.visible = m === "tea" && this.waveT <= 0;
    this.arm.wisps.forEach((w, i) => {
      w.visible = !!this.arm.cup?.visible;
      if (!w.visible) return;
      const ph = (t * 0.7 + i * 0.5) % 1;
      w.y = FORE - ph * 2.4;
      w.alpha = Math.sin(ph * Math.PI) * 0.8;
    });
    this.zs.forEach((z, i) => {
      z.visible = m === "sleep";
      if (!z.visible) return;
      const ph = (t * 0.4 + i / 2) % 1;
      z.position.set(2.2 + ph * 2, -12 - ph * 5);
      z.scale.set(0.5 + ph * 0.6);
      z.alpha = Math.sin(ph * Math.PI);
    });
  }
}

/** Height of a bust in units (for fitting into windows). */
export const BUST_H = 14.1;
export const HEAD_TO_BODY = (FIGURE_H - HEAD_H) / HEAD_H;

// ── Dev showcase (private/showcase) ─────────────────────────────────────

export async function showcase(
  app: import("pixi.js").Application,
  bank: TextureBank,
  label: (t: string, x: number, y: number) => void,
): Promise<void> {
  bank.scale = 10;
  const big = 6;
  label("ПОСЛЕ: 6 архетипов, векторный риг (×6)", 30, 16);
  const people: Figure[] = [];
  ARCHETYPES.forEach((arch, i) => {
    const spec = specFor(i * 11 + 3, "tulpar", "stu_classic");
    const s: CharacterSpec = { ...spec, arch, hair: ARCH[arch].hair, cloth: FACULTIES[FACULTY_IDS[i % 5]].color, pants: ARCH[arch].pants, headwear: arch === "courier" ? "cap" : arch === "athlete" ? "headband" : null, hairColor: arch === "teacher" ? GREY_HAIR : HAIR_COLOR[i % 5], skin: SKIN[i % 5] };
    const f = new Figure(bank, s);
    f.scale.set(big);
    f.position.set(110 + i * 205, 250);
    f.update(0.016, 0);
    app.stage.addChild(f);
    people.push(f);
    label(ARCHETYPE_LABEL[arch], 40 + i * 205, 262);
    const sil = new Figure(bank, s);
    sil.scale.set(big * 0.7);
    sil.position.set(110 + i * 205, 480);
    sil.update(0.016, 0);
    sil.tint = 0x000000;
    app.stage.addChild(sil);
  });
  label("Силуэт-тест (чёрная заливка)", 30, 300);
  const poses: Pose[] = ["idle", "walk", "cheer", "panic", "sleep", "tea"];
  label("Состояния: idle · walk · cheer · panic · sleep · tea   |   бюсты в окнах", 30, 505);
  poses.forEach((p, i) => {
    const s = specFor(40 + i * 7, "barys", "stu_classic");
    const f = new Figure(bank, s);
    f.pose = p;
    f.scale.set(3.6);
    f.position.set(60 + i * 105, 760);
    f.update(0.7 + i * 0.11, 0.3);
    app.stage.addChild(f);
  });
  for (let i = 0; i < 4; i++) {
    const s = specFor(77 + i * 5, "dombyra", i === 3 ? "stu_takiya" : "stu_classic", (["library", "chaikhana", "dorm", "gym"] as RoomId[])[i]);
    const b = new Bust(bank, s);
    b.mood = (["idle", "tea", "sleep", "cheer"] as const)[i];
    b.scale.set(5);
    b.position.set(760 + i * 130, 760);
    b.update(0.9, 0.5);
    app.stage.addChild(b);
  }
}
