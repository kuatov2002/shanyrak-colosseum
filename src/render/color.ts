// Colour helpers shared by every drawing function (one palette, one way to shade it).

export type RGB = [number, number, number];

const cache = new Map<string, RGB>();

export function hexToRgb(hex: string): RGB {
  const hit = cache.get(hex);
  if (hit) return hit;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const rgb: RGB = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, rgb);
  return rgb;
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** k > 0 lightens towards white, k < 0 darkens towards black. */
export function shade(c: string, k: number): string {
  return k >= 0 ? mix(c, "#ffffff", k) : mix(c, "#000000", -k);
}

export function rgba(c: string, a: number): string {
  const [r, g, b] = hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

export const PALETTE = {
  night: "#141833",
  ink: "#1b1d3a",
  cream: "#efe3c8",
  felt: "#e9dcc0",
  gold: "#f2b84b",
  goldDeep: "#c98a1b",
  window: "#ffd27a",
  windowHot: "#ffb347",
  terracotta: "#c8643b",
  turquoise: "#2aa79a",
  sky: "#00afca",
  burgundy: "#8e2f3c",
  green: "#4f9d69",
  wood: "#7a4a26",
  woodLight: "#a86b3a",
  white: "#fff8ea",
};

export function easeOutBack(t: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
