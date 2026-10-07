// Tiny vector icons for room medallions (and DOM thumbnails). Drawn centred at (0,0) in a box of
// radius r with a single colour so every room reads at a glance.

import type { Glyph } from "../meta/rooms";

export function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph, r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const u = r / 10;
  switch (g) {
    case "door": {
      ctx.beginPath();
      ctx.moveTo(-5 * u, 8 * u);
      ctx.lineTo(-5 * u, -1 * u);
      ctx.arc(0, -1 * u, 5 * u, Math.PI, 0);
      ctx.lineTo(5 * u, 8 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "bed": {
      ctx.fillRect(-8 * u, 0, 16 * u, 4 * u);
      ctx.fillRect(-8 * u, -6 * u, 3 * u, 12 * u);
      ctx.beginPath();
      ctx.arc(-2 * u, -2 * u, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(5.5 * u, 2 * u, 2.5 * u, 4 * u);
      break;
    }
    case "teapot": {
      ctx.beginPath();
      ctx.ellipse(0, 2 * u, 6 * u, 5 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-2.5 * u, -4.5 * u, 5 * u, 2 * u);
      ctx.beginPath();
      ctx.arc(0, -5 * u, 1.4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5 * u, 1 * u);
      ctx.quadraticCurveTo(9 * u, 0, 9.5 * u, -4 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-6.5 * u, 2 * u, 2.6 * u, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      break;
    }
    case "books": {
      ctx.fillRect(-7 * u, -6 * u, 3.5 * u, 13 * u);
      ctx.fillRect(-2.5 * u, -8 * u, 3.5 * u, 15 * u);
      ctx.save();
      ctx.translate(4.5 * u, 0);
      ctx.rotate(0.25);
      ctx.fillRect(-1.5 * u, -6 * u, 3.5 * u, 13 * u);
      ctx.restore();
      break;
    }
    case "monitor": {
      ctx.strokeRect(-8 * u, -7 * u, 16 * u, 10 * u);
      ctx.fillRect(-1.2 * u, 3 * u, 2.4 * u, 3 * u);
      ctx.fillRect(-4.5 * u, 6 * u, 9 * u, 1.6 * u);
      ctx.beginPath();
      ctx.moveTo(-4 * u, -2 * u);
      ctx.lineTo(-6 * u, -2 * u + 0.01);
      ctx.moveTo(-3 * u, -4 * u);
      ctx.lineTo(-5.5 * u, -2 * u);
      ctx.lineTo(-3 * u, 0);
      ctx.moveTo(3 * u, -4 * u);
      ctx.lineTo(5.5 * u, -2 * u);
      ctx.lineTo(3 * u, 0);
      ctx.stroke();
      break;
    }
    case "laptop": {
      ctx.strokeRect(-6 * u, -6 * u, 12 * u, 8 * u);
      ctx.beginPath();
      ctx.moveTo(-9 * u, 4 * u);
      ctx.lineTo(9 * u, 4 * u);
      ctx.lineTo(7 * u, 6.5 * u);
      ctx.lineTo(-7 * u, 6.5 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "dumbbell": {
      ctx.fillRect(-6 * u, -1 * u, 12 * u, 2 * u);
      ctx.fillRect(-9 * u, -5 * u, 3 * u, 10 * u);
      ctx.fillRect(6 * u, -5 * u, 3 * u, 10 * u);
      ctx.fillRect(-10.5 * u, -3 * u, 1.5 * u, 6 * u);
      ctx.fillRect(9 * u, -3 * u, 1.5 * u, 6 * u);
      break;
    }
    case "columns": {
      ctx.beginPath();
      ctx.moveTo(-9 * u, -4 * u);
      ctx.lineTo(0, -9 * u);
      ctx.lineTo(9 * u, -4 * u);
      ctx.closePath();
      ctx.fill();
      for (const x of [-6, -1.25, 3.5]) ctx.fillRect(x * u, -3 * u, 2.5 * u, 9 * u);
      ctx.fillRect(-9 * u, 6 * u, 18 * u, 2 * u);
      break;
    }
    case "leaf": {
      ctx.beginPath();
      ctx.moveTo(-7 * u, 7 * u);
      ctx.quadraticCurveTo(-8 * u, -6 * u, 7 * u, -8 * u);
      ctx.quadraticCurveTo(6 * u, 6 * u, -7 * u, 7 * u);
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(1, u);
      ctx.beginPath();
      ctx.moveTo(-6 * u, 6 * u);
      ctx.lineTo(4 * u, -5 * u);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "bowl": {
      ctx.beginPath();
      ctx.arc(0, 0, 8 * u, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-3 * u, 7.5 * u, 6 * u, 1.6 * u);
      for (const x of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(x * u, -2 * u);
        ctx.quadraticCurveTo((x + 1.5) * u, -5 * u, x * u, -8 * u);
        ctx.stroke();
      }
      break;
    }
    case "sun": {
      ctx.beginPath();
      ctx.arc(0, 0, 4.5 * u, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6.5 * u, Math.sin(a) * 6.5 * u);
        ctx.lineTo(Math.cos(a) * 9.5 * u, Math.sin(a) * 9.5 * u);
        ctx.stroke();
      }
      break;
    }
    case "flag": {
      ctx.fillRect(-7 * u, -9 * u, 1.8 * u, 18 * u);
      ctx.beginPath();
      ctx.moveTo(-5 * u, -8.5 * u);
      ctx.quadraticCurveTo(0, -11 * u, 8 * u, -7 * u);
      ctx.lineTo(8 * u, 0);
      ctx.quadraticCurveTo(0, -3.5 * u, -5 * u, -1 * u);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}
