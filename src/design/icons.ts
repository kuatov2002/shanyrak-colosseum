// Vector icon set for the WebGL HUD (emoji can't be drawn by BitmapText and look different on every
// OS). The drawings live in design/glyphs.ts and are shared with the DOM (inline SVG); here they are
// baked once into textures.

import { CanvasSource, Texture } from "pixi.js";
import type { BonusId, EventId } from "../gameplay/types";
import { drawIcon, ICON_GRID, type IconName } from "./glyphs";

export type { IconName } from "./glyphs";

export const BONUS_ICON: Record<BonusId, IconName> = {
  teaBreak: "cup",
  wideCrane: "crane",
  reinforce: "shield",
  magnet: "magnet",
  windbreak: "tree",
  antiDeadline: "calendar",
  balcony: "columns",
  garland: "lantern",
  builderTea: "teapot",
  facultySpirit: "flag",
};

export const EVENT_ICON: Record<EventId, IconName> = {
  wind: "wind",
  deadline: "clock",
  exam: "scroll",
  nauryz: "tulip",
  session: "moon",
  festival: "tent",
};

const K = 2;
const cache = new Map<IconName, Texture>();

export function icon(name: IconName): Texture {
  const hit = cache.get(name);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = ICON_GRID * K;
  cv.height = ICON_GRID * K;
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(K, K);
  drawIcon(ctx, name);
  const t = new Texture({ source: new CanvasSource({ resource: cv, resolution: K }) });
  cache.set(name, t);
  return t;
}
