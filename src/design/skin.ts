// Shared design system. One art pass generates 9-slice frames and button states from the CSS
// palette tokens; the same canvases become PixiJS textures (NineSliceSprite in the round HUD) and
// CSS border-image sources (menus) — so the world and the menus look like one game.

import { CanvasSource, Texture } from "pixi.js";

export interface Tokens {
  gold: string;
  gold2: string;
  goldDeep: string;
  turq: string;
  red: string;
  cream: string;
  text: string;
  muted: string;
  panel: string;
  panel2: string;
  night: string;
  green: string;
  font: string;
}

const FALLBACK: Tokens = {
  gold: "#f2b84b",
  gold2: "#ffd75e",
  goldDeep: "#c98a1b",
  turq: "#2aa79a",
  red: "#e04848",
  cream: "#efe3c8",
  text: "#fbf3e2",
  muted: "#b9b0cf",
  panel: "#1e1b44",
  panel2: "#30285f",
  night: "#141833",
  green: "#4fd08a",
  font: "Rubik, system-ui, sans-serif",
};

/** Read the palette from CSS custom properties (single source of truth for DOM and textures). */
export function readTokens(): Tokens {
  if (typeof document === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    gold: v("--gold", FALLBACK.gold),
    gold2: v("--gold-2", FALLBACK.gold2),
    goldDeep: v("--gold-deep", FALLBACK.goldDeep),
    turq: v("--turq", FALLBACK.turq),
    red: v("--red", FALLBACK.red),
    cream: v("--cream", FALLBACK.cream),
    text: v("--text", FALLBACK.text),
    muted: v("--muted", FALLBACK.muted),
    panel: v("--panel-solid", FALLBACK.panel),
    panel2: v("--panel-2-solid", FALLBACK.panel2),
    night: v("--bg", FALLBACK.night),
    green: v("--green", FALLBACK.green),
    font: v("--font", FALLBACK.font),
  };
}

export type ButtonKind = "gold" | "teal" | "soft" | "danger" | "ghost";
export type ButtonState = "normal" | "hover" | "pressed" | "focus";
export const BUTTON_KINDS: ButtonKind[] = ["gold", "teal", "soft", "danger", "ghost"];
export const BUTTON_STATES: ButtonState[] = ["normal", "hover", "pressed", "focus"];

/** Logical size of button textures; drawn at 2× for crisp edges. Slice = 14 logical px. */
export const BTN = { w: 56, h: 44, slice: 14, lip: 4 };
export const PANEL = { w: 64, h: 64, slice: 22 };
export const CHIP = { w: 40, h: 28, slice: 13 };
const K = 2;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w * K;
  c.height = h * K;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(K, K);
  return [c, ctx];
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = k >= 0 ? 255 : 0;
  const a = Math.abs(k);
  const f = (c: number) => Math.round(c + (t - c) * a);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function buttonColors(kind: ButtonKind, t: Tokens): { top: string; bottom: string; lip: string; text: string; line: string } {
  switch (kind) {
    case "gold":
      return { top: t.gold2, bottom: t.gold, lip: "#9a6413", text: "#2a1a05", line: "rgba(80,40,0,0.55)" };
    case "teal":
      return { top: shade(t.turq, 0.18), bottom: t.turq, lip: "#13584f", text: "#ffffff", line: "rgba(0,40,36,0.6)" };
    case "danger":
      return { top: shade(t.red, 0.15), bottom: t.red, lip: "#7d2020", text: "#ffffff", line: "rgba(60,0,0,0.6)" };
    case "ghost":
      return { top: "rgba(0,0,0,0)", bottom: "rgba(0,0,0,0)", lip: "rgba(0,0,0,0)", text: t.cream, line: "rgba(242,184,75,0.55)" };
    default:
      return { top: shade(t.panel2, 0.1), bottom: t.panel2, lip: shade(t.panel, -0.35), text: t.text, line: "rgba(255,255,255,0.12)" };
  }
}

function drawButton(kind: ButtonKind, state: ButtonState, t: Tokens): HTMLCanvasElement {
  const { w, h, lip } = BTN;
  const [c, ctx] = canvas(w, h);
  const col = buttonColors(kind, t);
  const pressed = state === "pressed";
  const lipH = kind === "ghost" ? 0 : pressed ? 1 : lip;
  const bodyY = pressed ? lip - 1 : 0;
  const bodyH = h - lip;
  // lip (3D bottom edge)
  if (lipH > 0) {
    ctx.fillStyle = col.lip;
    rr(ctx, 1, bodyY + lipH, w - 2, bodyH, 12);
    ctx.fill();
  }
  // body
  const g = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  const lift = state === "hover" ? 0.1 : pressed ? -0.06 : 0;
  if (kind === "ghost") {
    g.addColorStop(0, state === "hover" ? "rgba(242,184,75,0.12)" : pressed ? "rgba(242,184,75,0.18)" : "rgba(0,0,0,0)");
    g.addColorStop(1, state === "hover" ? "rgba(242,184,75,0.06)" : "rgba(0,0,0,0)");
  } else {
    g.addColorStop(0, lift ? shade(col.top.startsWith("#") ? col.top : t.panel2, lift) : col.top);
    g.addColorStop(1, lift ? shade(col.bottom.startsWith("#") ? col.bottom : t.panel2, lift) : col.bottom);
  }
  ctx.fillStyle = g;
  rr(ctx, 1, bodyY, w - 2, bodyH, 12);
  ctx.fill();
  ctx.strokeStyle = col.line;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // top highlight
  if (kind !== "ghost") {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, bodyY + 2.5);
    ctx.lineTo(w - 12, bodyY + 2.5);
    ctx.stroke();
  }
  // tiny ornament ticks at the sides (shared with panels)
  ctx.fillStyle = kind === "gold" ? "rgba(122,74,20,0.55)" : "rgba(242,184,75,0.6)";
  for (const x of [5, w - 7]) {
    ctx.beginPath();
    ctx.arc(x + 1, bodyY + bodyH / 2, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // focus ring (keyboard)
  if (state === "focus") {
    ctx.strokeStyle = t.gold2;
    ctx.lineWidth = 2;
    rr(ctx, 1, bodyY, w - 2, bodyH + lipH - 0.5, 12);
    ctx.stroke();
  }
  return c;
}

/** Panel frame: deep fill, gold double line, koshkar-muiz corner curls. */
function drawPanel(t: Tokens, variant: "panel" | "cream" | "frame"): HTMLCanvasElement {
  const { w, h } = PANEL;
  const [c, ctx] = canvas(w, h);
  if (variant === "frame") {
    // white frame for tinting (rarity)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    rr(ctx, 2, 2, w - 4, h - 4, 14);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    rr(ctx, 5, 5, w - 10, h - 10, 11);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return c;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (variant === "cream") {
    g.addColorStop(0, "#fff8e6");
    g.addColorStop(1, "#f3e3bd");
  } else {
    g.addColorStop(0, shade(t.panel2, 0.04));
    g.addColorStop(1, t.panel);
  }
  ctx.fillStyle = g;
  rr(ctx, 1, 1, w - 2, h - 2, 16);
  ctx.fill();
  ctx.strokeStyle = variant === "cream" ? "rgba(150,100,40,0.6)" : "rgba(242,184,75,0.55)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = variant === "cream" ? "rgba(150,100,40,0.25)" : "rgba(242,184,75,0.22)";
  ctx.lineWidth = 1;
  rr(ctx, 4.5, 4.5, w - 9, h - 9, 13);
  ctx.stroke();
  // corner curls
  ctx.strokeStyle = variant === "cream" ? "rgba(150,100,40,0.7)" : t.gold;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  const curl = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * 7);
    ctx.bezierCurveTo(x, y, x + sx * 2, y, x + sx * 7, y);
    ctx.moveTo(x + sx * 3, y + sy * 3);
    ctx.bezierCurveTo(x + sx * 3, y + sy * 1, x + sx * 5, y + sy * 1, x + sx * 5, y + sy * 3);
    ctx.stroke();
  };
  curl(8, 8, 1, 1);
  curl(w - 8, 8, -1, 1);
  curl(8, h - 8, 1, -1);
  curl(w - 8, h - 8, -1, -1);
  return c;
}

function drawChip(t: Tokens): HTMLCanvasElement {
  const { w, h } = CHIP;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = "rgba(20,16,50,0.82)";
  rr(ctx, 1, 1, w - 2, h - 2, (h - 2) / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(242,184,75,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = t.gold;
  ctx.beginPath();
  ctx.arc(6, h / 2, 1.2, 0, Math.PI * 2);
  ctx.arc(w - 6, h / 2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Bar track & fill (fill is white, tinted by value). */
function drawBar(kind: "track" | "fill"): HTMLCanvasElement {
  const w = 24;
  const h = 14;
  const [c, ctx] = canvas(w, h);
  if (kind === "track") {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    rr(ctx, 0.5, 0.5, w - 1, h - 1, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#cfcfcf");
    ctx.fillStyle = g;
    rr(ctx, 1.5, 1.5, w - 3, h - 3, 5.5);
    ctx.fill();
  }
  return c;
}

export interface Skin {
  tokens: Tokens;
  button(kind: ButtonKind, state: ButtonState): Texture;
  panel: Texture;
  cream: Texture;
  frame: Texture;
  chip: Texture;
  barTrack: Texture;
  barFill: Texture;
}

let cached: Skin | null = null;

function tex(c: HTMLCanvasElement): Texture {
  return new Texture({ source: new CanvasSource({ resource: c, resolution: K }) });
}

/**
 * Build the skin once: Pixi textures + CSS variables (--ds-*) with the same pixels as data URLs.
 */
export function buildSkin(): Skin {
  if (cached) return cached;
  const t = readTokens();
  const root = document.documentElement.style;
  const buttons = new Map<string, Texture>();
  for (const kind of BUTTON_KINDS) {
    for (const state of BUTTON_STATES) {
      const c = drawButton(kind, state, t);
      buttons.set(`${kind}|${state}`, tex(c));
      root.setProperty(`--ds-btn-${kind}-${state}`, `url("${c.toDataURL("image/png")}")`);
    }
  }
  const panelC = drawPanel(t, "panel");
  const creamC = drawPanel(t, "cream");
  const frameC = drawPanel(t, "frame");
  const chipC = drawChip(t);
  root.setProperty("--ds-panel", `url("${panelC.toDataURL("image/png")}")`);
  root.setProperty("--ds-cream", `url("${creamC.toDataURL("image/png")}")`);
  root.setProperty("--ds-chip", `url("${chipC.toDataURL("image/png")}")`);
  document.documentElement.classList.add("ds-ready");
  cached = {
    tokens: t,
    button: (kind, state) => buttons.get(`${kind}|${state}`) as Texture,
    panel: tex(panelC),
    cream: tex(creamC),
    frame: tex(frameC),
    chip: tex(chipC),
    barTrack: tex(drawBar("track")),
    barFill: tex(drawBar("fill")),
  };
  return cached;
}
