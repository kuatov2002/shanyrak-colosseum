// Badge art for achievement NFTs — the same drawing is used for the PNG files shipped with the
// build (exported once in the browser, see scripts/README) and for the in-game badge previews.

import badges from "./nft-badges.json";

const GOLD = "#f2b84b";
const NIGHT = "#1b1840";

export function badgeInfo(id: string): (typeof badges.badges)[number] | undefined {
  return badges.badges.find((b) => b.id === id);
}

export function drawBadge(ctx: CanvasRenderingContext2D, size: number, id: string): void {
  const b = badgeInfo(id);
  const accent = b?.color ?? GOLD;
  const c = size / 2;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  // background
  const bg = ctx.createRadialGradient(c, c * 0.8, size * 0.05, c, c, size * 0.75);
  bg.addColorStop(0, "#3a3280");
  bg.addColorStop(1, NIGHT);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // rays
  ctx.translate(c, c);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = "rgba(255,241,194,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.7, -size * 0.05);
    ctx.lineTo(size * 0.7, size * 0.05);
    ctx.closePath();
    ctx.fill();
  }
  // medallion
  const R = size * 0.38;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, R + size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = NIGHT;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  // ornament ring (ram-horn curls)
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = size * 0.012;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.rotate((i / 12) * Math.PI * 2);
    ctx.translate(0, -R * 0.86);
    const r = size * 0.028;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(0, -r, -r * 1.6, -r, -r * 1.4, 0);
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(0, -r, r * 1.6, -r, r * 1.4, 0);
    ctx.stroke();
    ctx.restore();
  }
  // shanyrak: ring + crossed bars
  const rr = R * 0.5;
  ctx.lineWidth = size * 0.03;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineWidth = size * 0.016;
  for (const k of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(-rr, k * rr);
    ctx.quadraticCurveTo(0, k * rr - rr * 0.35, rr, k * rr);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(k * rr, -rr);
    ctx.quadraticCurveTo(k * rr + rr * 0.35, 0, k * rr, rr);
    ctx.stroke();
  }
  ctx.restore();
  // uyks
  ctx.strokeStyle = accent;
  ctx.lineWidth = size * 0.01;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rr * 1.12, Math.sin(a) * rr * 1.12);
    ctx.lineTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72);
    ctx.stroke();
  }
  // title ribbon
  ctx.fillStyle = accent;
  const rw = size * 0.78;
  const rh = size * 0.12;
  ctx.beginPath();
  ctx.moveTo(-rw / 2, R * 0.92);
  ctx.lineTo(rw / 2, R * 0.92);
  ctx.lineTo(rw / 2 - rh * 0.4, R * 0.92 + rh / 2);
  ctx.lineTo(rw / 2, R * 0.92 + rh);
  ctx.lineTo(-rw / 2, R * 0.92 + rh);
  ctx.lineTo(-rw / 2 + rh * 0.4, R * 0.92 + rh / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = NIGHT;
  ctx.font = `800 ${Math.round(size * 0.052)}px Rubik, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((b?.trait ?? "Шанырак").toUpperCase(), 0, R * 0.92 + rh / 2 + 1);
  ctx.fillStyle = GOLD;
  ctx.font = `800 ${Math.round(size * 0.06)}px Rubik, system-ui, sans-serif`;
  ctx.fillText("ШАНЫРАК", 0, -R - size * 0.07);
  ctx.restore();
}

const urlCache = new Map<string, string>();

export function badgeDataUrl(id: string, size = 160): string {
  const key = `${id}|${size}`;
  const hit = urlCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  drawBadge(ctx, size, id);
  const url = c.toDataURL("image/png");
  urlCache.set(key, url);
  return url;
}
