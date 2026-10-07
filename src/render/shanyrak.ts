// The shanyrak crown. It is never damaged, mocked or knocked over: it only ever descends gently
// and completes the campus — a yurt dome of felt with uyks (roof poles) meeting in the shanyrak
// ring with its crossed kuldireush bars, lit from within.

import { PALETTE, rgba, shade } from "./color";
import { drawOrnamentBand } from "./rooms";

export interface CrownOptions {
  t: number;
  deco: string;
  /** 0..1 glow after it settles. */
  glow: number;
  ornament: string;
}

/** Draw the crown with its base centred at the origin (sits on the top room). */
export function drawCrown(ctx: CanvasRenderingContext2D, baseW: number, o: CrownOptions): void {
  const W = baseW + 26;
  const H = W * 0.34;
  const gold = o.deco === "sh_gold";
  const wood = gold ? PALETTE.gold : PALETTE.woodLight;
  const ringR = W * 0.15;

  // Inner light / halo
  if (o.glow > 0) {
    const halo = ctx.createRadialGradient(0, -H, 2, 0, -H, W * 0.95);
    halo.addColorStop(0, rgba("#fff1c2", 0.55 * o.glow));
    halo.addColorStop(0.4, rgba(PALETTE.gold, 0.22 * o.glow));
    halo.addColorStop(1, rgba(PALETTE.gold, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, -H, W * 0.95, 0, Math.PI * 2);
    ctx.fill();
    // soft rotating rays
    ctx.save();
    ctx.translate(0, -H);
    ctx.rotate(o.t * 0.15);
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.fillStyle = rgba("#fff1c2", 0.07 * o.glow);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 1.2, -W * 0.08);
      ctx.lineTo(W * 1.2, W * 0.08);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Dome (felt)
  ctx.beginPath();
  ctx.moveTo(-W / 2, 0);
  ctx.bezierCurveTo(-W / 2, -H * 0.55, -ringR * 1.6, -H * 0.92, -ringR, -H);
  ctx.lineTo(ringR, -H);
  ctx.bezierCurveTo(ringR * 1.6, -H * 0.92, W / 2, -H * 0.55, W / 2, 0);
  ctx.closePath();
  const felt = ctx.createLinearGradient(-W / 2, -H, W / 2, 0);
  felt.addColorStop(0, "#fbf3e2");
  felt.addColorStop(1, "#d8c7a3");
  ctx.fillStyle = felt;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // uyks — poles from the ring down to the wall
  ctx.strokeStyle = rgba(shade(wood, -0.3), 0.55);
  ctx.lineWidth = 1.6;
  const poles = 13;
  for (let i = 0; i <= poles; i++) {
    const tt = i / poles;
    const bx = -W / 2 + tt * W;
    const rx = -ringR + tt * ringR * 2;
    ctx.beginPath();
    ctx.moveTo(rx, -H);
    ctx.quadraticCurveTo((rx + bx) / 2 + (bx > 0 ? W * 0.06 : -W * 0.06), -H * 0.5, bx, 0);
    ctx.stroke();
  }
  // ornament band near the base
  ctx.fillStyle = gold ? "#7a1f2a" : "#9c2b38";
  ctx.fillRect(-W / 2, -H * 0.24, W, H * 0.16);
  drawOrnamentBand(ctx, o.ornament, -W / 2, W / 2, -H * 0.16, H * 0.15, PALETTE.gold);
  ctx.restore();
  ctx.strokeStyle = shade(wood, -0.35);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lights garland along the dome edge
  if (o.deco === "sh_lights") {
    for (let i = 0; i < 16; i++) {
      const tt = i / 15;
      const a = Math.PI + tt * Math.PI;
      const x = Math.cos(a) * (W / 2) * 0.98;
      const y = Math.sin(a) * H * 0.62 - H * 0.05;
      const on = Math.sin(o.t * 4 + i) > -0.2;
      ctx.fillStyle = on ? ["#ffd75e", "#ff6b6b", "#7cefff", "#8ef0a5"][i % 4] : "#555";
      ctx.save();
      if (on) {
        ctx.shadowColor = ctx.fillStyle as string;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // The shanyrak ring (seen slightly from below/side)
  const ry = ringR * 0.42;
  ctx.save();
  ctx.translate(0, -H);
  // sky seen through the opening
  ctx.fillStyle = rgba("#fff6dc", 0.85 * Math.max(0.35, o.glow));
  ctx.beginPath();
  ctx.ellipse(0, 0, ringR, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // kuldireush: crossed bars, three each way
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, ringR, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = shade(wood, -0.15);
  ctx.lineWidth = 2.2;
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(-ringR, k * ry * 1.4 - ry * 0.3);
    ctx.quadraticCurveTo(0, k * ry * 1.4 - ry * 1.2, ringR, k * ry * 1.4 - ry * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(k * ringR * 1.2, -ry);
    ctx.quadraticCurveTo(k * ringR * 1.2 + ringR * 0.25, 0, k * ringR * 1.2, ry);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = wood;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, ringR, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = shade(wood, 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -1, ringR - 1, ry - 1, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Ribbons of good wishes
  if (o.deco === "sh_ribbons" || gold) {
    const colors = gold ? ["#fff1c2", "#f2b84b"] : ["#c0392b", "#2aa79a", "#f2b84b", "#2f4c8c", "#ffffff"];
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? 1 : -1;
      const bx = side * (ringR * 0.6 + i * 2);
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      const sway = Math.sin(o.t * 2.2 + i) * 6;
      ctx.bezierCurveTo(bx + side * 8 + sway, 16, bx + side * 14 - sway, 30, bx + side * 22 + sway, 44 + i * 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}
