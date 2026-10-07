// Vector icon set for the WebGL HUD (emoji can't be drawn by BitmapText and look different on every
// OS). Drawn once in the shared palette and cached as textures.

import { CanvasSource, Texture } from "pixi.js";
import type { BonusId, EventId } from "../gameplay/types";

export type IconName =
  | "coin"
  | "cap"
  | "helmet"
  | "shield"
  | "pause"
  | "cup"
  | "crane"
  | "magnet"
  | "tree"
  | "calendar"
  | "columns"
  | "lantern"
  | "teapot"
  | "flag"
  | "wind"
  | "clock"
  | "scroll"
  | "tulip"
  | "moon"
  | "tent"
  | "target"
  | "dome"
  | "next"
  | "star";

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

const GOLD = "#f2b84b";
const GOLD2 = "#ffd75e";
const CREAM = "#fff3d6";
const TURQ = "#2aa79a";
const RED = "#e85d5d";
const DEEP = "#7a4a14";
const K = 2;
const S = 48;

function draw(ctx: CanvasRenderingContext2D, name: IconName): void {
  const c = S / 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const stroke = (col: string, w: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const fill = (col: string) => {
    ctx.fillStyle = col;
    ctx.fill();
  };
  ctx.beginPath();
  switch (name) {
    case "coin":
      ctx.arc(c, c, 16, 0, Math.PI * 2);
      fill(GOLD);
      stroke(DEEP, 2.5);
      ctx.beginPath();
      ctx.arc(c, c, 10, 0, Math.PI * 2);
      stroke("rgba(122,74,20,0.5)", 2);
      ctx.beginPath();
      ctx.moveTo(c - 5, c - 4);
      ctx.lineTo(c + 5, c - 4);
      ctx.moveTo(c, c - 8);
      ctx.lineTo(c, c + 8);
      stroke(DEEP, 2.5);
      break;
    case "cap":
      ctx.moveTo(c - 18, c - 4);
      ctx.lineTo(c, c - 12);
      ctx.lineTo(c + 18, c - 4);
      ctx.lineTo(c, c + 4);
      ctx.closePath();
      fill(CREAM);
      stroke("#2b2d40", 2);
      ctx.beginPath();
      ctx.moveTo(c - 10, c);
      ctx.lineTo(c - 10, c + 9);
      ctx.quadraticCurveTo(c, c + 15, c + 10, c + 9);
      ctx.lineTo(c + 10, c);
      fill(TURQ);
      ctx.beginPath();
      ctx.moveTo(c + 15, c - 3);
      ctx.lineTo(c + 15, c + 9);
      stroke(GOLD, 2.5);
      break;
    case "helmet":
      ctx.arc(c, c + 6, 15, Math.PI, 0);
      ctx.closePath();
      fill(GOLD2);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c - 19, c + 7);
      ctx.lineTo(c + 19, c + 7);
      stroke(DEEP, 3.5);
      ctx.beginPath();
      ctx.moveTo(c, c - 9);
      ctx.lineTo(c, c + 5);
      stroke("rgba(122,74,20,0.6)", 2.5);
      break;
    case "shield":
      ctx.moveTo(c, c - 17);
      ctx.lineTo(c + 14, c - 11);
      ctx.quadraticCurveTo(c + 14, c + 8, c, c + 17);
      ctx.quadraticCurveTo(c - 14, c + 8, c - 14, c - 11);
      ctx.closePath();
      fill("#9fd8ff");
      stroke("#2f4c8c", 2.5);
      ctx.beginPath();
      ctx.moveTo(c, c - 11);
      ctx.lineTo(c, c + 11);
      ctx.moveTo(c - 8, c - 2);
      ctx.lineTo(c + 8, c - 2);
      stroke("#2f4c8c", 2);
      break;
    case "pause":
      ctx.roundRect(c - 10, c - 13, 7, 26, 2);
      ctx.roundRect(c + 3, c - 13, 7, 26, 2);
      fill(CREAM);
      break;
    case "cup":
      ctx.moveTo(c - 13, c - 4);
      ctx.lineTo(c + 9, c - 4);
      ctx.quadraticCurveTo(c + 9, c + 13, c - 2, c + 13);
      ctx.quadraticCurveTo(c - 13, c + 13, c - 13, c - 4);
      fill(CREAM);
      stroke(TURQ, 2);
      ctx.beginPath();
      ctx.arc(c + 11, c + 3, 5, -Math.PI / 2, Math.PI / 2);
      stroke(TURQ, 2.5);
      for (const x of [-6, 1]) {
        ctx.beginPath();
        ctx.moveTo(c + x, c - 8);
        ctx.quadraticCurveTo(c + x + 4, c - 13, c + x, c - 18);
        stroke("rgba(255,255,255,0.8)", 2);
      }
      break;
    case "crane":
      ctx.moveTo(c - 14, c + 17);
      ctx.lineTo(c - 14, c - 15);
      ctx.lineTo(c + 17, c - 15);
      stroke(GOLD, 3.5);
      ctx.beginPath();
      ctx.moveTo(c + 10, c - 15);
      ctx.lineTo(c + 10, c + 1);
      stroke("#2b2d40", 2);
      ctx.beginPath();
      ctx.rect(c + 3, c + 1, 14, 9);
      fill(RED);
      break;
    case "magnet":
      ctx.arc(c, c - 2, 13, Math.PI, 0);
      ctx.lineTo(c + 13, c + 12);
      ctx.lineTo(c + 6, c + 12);
      ctx.lineTo(c + 6, c - 2);
      ctx.arc(c, c - 2, 6, 0, Math.PI, true);
      ctx.lineTo(c - 6, c + 12);
      ctx.lineTo(c - 13, c + 12);
      ctx.closePath();
      fill(RED);
      ctx.beginPath();
      ctx.rect(c - 13, c + 7, 7, 5);
      ctx.rect(c + 6, c + 7, 7, 5);
      fill(CREAM);
      break;
    case "tree":
      ctx.moveTo(c, c - 18);
      ctx.lineTo(c + 13, c + 6);
      ctx.lineTo(c - 13, c + 6);
      ctx.closePath();
      fill("#4f9d69");
      ctx.beginPath();
      ctx.moveTo(c, c - 10);
      ctx.lineTo(c + 15, c + 12);
      ctx.lineTo(c - 15, c + 12);
      ctx.closePath();
      fill("#3f8f5a");
      ctx.beginPath();
      ctx.rect(c - 2.5, c + 12, 5, 6);
      fill("#6b4a2b");
      break;
    case "calendar":
      ctx.roundRect(c - 15, c - 12, 30, 28, 4);
      fill(CREAM);
      stroke("#2b2d40", 2);
      ctx.beginPath();
      ctx.rect(c - 15, c - 12, 30, 8);
      fill(RED);
      ctx.beginPath();
      ctx.moveTo(c - 6, c + 5);
      ctx.lineTo(c - 1, c + 10);
      ctx.lineTo(c + 8, c);
      stroke(TURQ, 3);
      break;
    case "columns":
      ctx.moveTo(c - 18, c - 8);
      ctx.lineTo(c, c - 18);
      ctx.lineTo(c + 18, c - 8);
      ctx.closePath();
      fill(GOLD);
      ctx.beginPath();
      for (const x of [-13, -3, 7]) ctx.rect(c + x, c - 6, 6, 18);
      fill(CREAM);
      ctx.beginPath();
      ctx.rect(c - 18, c + 12, 36, 4);
      fill(GOLD);
      break;
    case "lantern":
      ctx.ellipse(c, c + 2, 11, 14, 0, 0, Math.PI * 2);
      fill(RED);
      ctx.beginPath();
      ctx.rect(c - 6, c - 16, 12, 4);
      ctx.rect(c - 6, c + 15, 12, 4);
      fill(GOLD);
      ctx.beginPath();
      ctx.moveTo(c, c - 11);
      ctx.lineTo(c, c + 14);
      stroke("rgba(255,215,94,0.7)", 2);
      break;
    case "teapot":
      ctx.ellipse(c - 2, c + 4, 13, 10, 0, 0, Math.PI * 2);
      fill(TURQ);
      ctx.beginPath();
      ctx.moveTo(c + 10, c + 2);
      ctx.quadraticCurveTo(c + 18, c, c + 19, c - 7);
      stroke(TURQ, 3.5);
      ctx.beginPath();
      ctx.rect(c - 7, c - 9, 10, 4);
      fill(GOLD);
      ctx.beginPath();
      ctx.arc(c - 2, c - 11, 2.5, 0, Math.PI * 2);
      fill(GOLD);
      break;
    case "flag":
      ctx.rect(c - 13, c - 17, 3, 34);
      fill(CREAM);
      ctx.beginPath();
      ctx.moveTo(c - 10, c - 16);
      ctx.quadraticCurveTo(c + 2, c - 21, c + 16, c - 13);
      ctx.lineTo(c + 16, c + 1);
      ctx.quadraticCurveTo(c + 2, c - 6, c - 10, c - 1);
      ctx.closePath();
      fill(TURQ);
      ctx.beginPath();
      ctx.arc(c + 3, c - 8, 3, 0, Math.PI * 2);
      fill(GOLD);
      break;
    case "wind":
      for (const [y, l] of [[-8, 26], [0, 32], [8, 22]] as [number, number][]) {
        ctx.beginPath();
        ctx.moveTo(c - 17, c + y);
        ctx.lineTo(c - 17 + l - 6, c + y);
        ctx.arc(c - 17 + l - 6, c + y - 4, 4, Math.PI / 2, -Math.PI / 2, true);
        stroke("#cfe8ff", 3);
      }
      break;
    case "clock":
      ctx.arc(c, c, 16, 0, Math.PI * 2);
      fill(CREAM);
      stroke(RED, 3);
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c, c - 10);
      ctx.moveTo(c, c);
      ctx.lineTo(c + 7, c + 4);
      stroke("#2b2d40", 2.5);
      break;
    case "scroll":
      ctx.rect(c - 12, c - 15, 24, 30);
      fill(CREAM);
      stroke(DEEP, 2);
      for (const y of [-8, -2, 4, 10]) {
        ctx.beginPath();
        ctx.moveTo(c - 7, c + y);
        ctx.lineTo(c + 7, c + y);
        stroke("rgba(0,0,0,0.35)", 2);
      }
      break;
    case "tulip":
      ctx.moveTo(c, c + 18);
      ctx.lineTo(c, c);
      stroke("#3f8f5a", 3);
      ctx.beginPath();
      ctx.moveTo(c - 11, c - 12);
      ctx.lineTo(c - 5, c - 4);
      ctx.lineTo(c, c - 14);
      ctx.lineTo(c + 5, c - 4);
      ctx.lineTo(c + 11, c - 12);
      ctx.quadraticCurveTo(c + 12, c + 4, c, c + 4);
      ctx.quadraticCurveTo(c - 12, c + 4, c - 11, c - 12);
      fill("#ff6b8a");
      break;
    case "moon":
      ctx.arc(c, c, 15, 0, Math.PI * 2);
      fill("#fff6dc");
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(c + 8, c - 5, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      break;
    case "tent":
      ctx.moveTo(c - 18, c + 14);
      ctx.lineTo(c, c - 16);
      ctx.lineTo(c + 18, c + 14);
      ctx.closePath();
      fill("#ff9ad5");
      ctx.beginPath();
      ctx.moveTo(c - 5, c + 14);
      ctx.lineTo(c, c + 2);
      ctx.lineTo(c + 5, c + 14);
      fill("#7a2a5a");
      ctx.beginPath();
      ctx.moveTo(c, c - 16);
      ctx.lineTo(c + 6, c - 20);
      stroke(GOLD, 2);
      break;
    case "target":
      for (const [r, col] of [[16, RED], [11, CREAM], [6, RED]] as [number, string][]) {
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        fill(col);
      }
      break;
    case "dome":
      ctx.moveTo(c - 18, c + 10);
      ctx.quadraticCurveTo(c - 16, c - 10, c - 4, c - 12);
      ctx.lineTo(c + 4, c - 12);
      ctx.quadraticCurveTo(c + 16, c - 10, c + 18, c + 10);
      ctx.closePath();
      fill("#fbf3e2");
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.ellipse(c, c - 12, 6, 2.5, 0, 0, Math.PI * 2);
      stroke(GOLD, 2.5);
      ctx.beginPath();
      ctx.rect(c - 18, c + 4, 36, 4);
      fill("#9c2b38");
      break;
    case "next":
      ctx.moveTo(c - 10, c - 12);
      ctx.lineTo(c + 4, c);
      ctx.lineTo(c - 10, c + 12);
      ctx.moveTo(c + 2, c - 12);
      ctx.lineTo(c + 16, c);
      ctx.lineTo(c + 2, c + 12);
      stroke(CREAM, 3.5);
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 7 : 17;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      ctx.closePath();
      fill(GOLD2);
      stroke(DEEP, 1.5);
      break;
  }
}

const cache = new Map<IconName, Texture>();

export function icon(name: IconName): Texture {
  const hit = cache.get(name);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = S * K;
  cv.height = S * K;
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(K, K);
  draw(ctx, name);
  const t = new Texture({ source: new CanvasSource({ resource: cv, resolution: K }) });
  cache.set(name, t);
  return t;
}
