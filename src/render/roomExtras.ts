// Per-room animated details layered on top of the baked base sprite. Everything is in room-local
// world units (origin centre-bottom, y up = negative). Roof items peek out only on the top room —
// the next room lands over them, like a real building.

import { Sprite, Texture, TilingSprite } from "pixi.js";
import type { RoomId } from "../meta/rooms";
import { FACULTIES } from "../social/faculties";
import type { BlockView } from "./blockView";
import { BLOCK_H, makeCanvas, canvasTexture, type TextureBank } from "./textures";

const cache = new Map<string, Texture>();
function baked(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const k = 3;
  const [c, ctx] = makeCanvas(w * k, h * k);
  ctx.scale(k, k);
  draw(ctx);
  const t = canvasTexture(c, k);
  cache.set(key, t);
  return t;
}

const laundry = () =>
  baked("laundry", 60, 18, (ctx) => {
    ctx.strokeStyle = "#4a4e6d";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(30, 6, 60, 2);
    ctx.stroke();
    const colors = ["#ff9ad5", "#7fc8ff", "#ffe08a", "#9be3b0", "#ffffff"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = colors[i];
      const x = 5 + i * 11;
      ctx.fillRect(x, 3.5 + Math.sin(i) * 0.6, 7, 9 + (i % 2) * 3);
    }
  });

const antenna = () =>
  baked("antenna", 16, 22, (ctx) => {
    ctx.strokeStyle = "#9fb3c8";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(8, 22);
    ctx.lineTo(8, 4);
    ctx.moveTo(2, 8);
    ctx.lineTo(14, 8);
    ctx.moveTo(4, 13);
    ctx.lineTo(12, 13);
    ctx.stroke();
  });

const rack = () =>
  baked("rack", 14, 30, (ctx) => {
    ctx.fillStyle = "#101826";
    ctx.fillRect(0, 0, 14, 30);
    ctx.strokeStyle = "#2b3a52";
    ctx.lineWidth = 1;
    for (let y = 4; y < 30; y += 5) {
      ctx.beginPath();
      ctx.moveTo(2, y);
      ctx.lineTo(12, y);
      ctx.stroke();
    }
  });

const plant = (v: number) =>
  baked(`plant${v}`, 18, 16, (ctx) => {
    ctx.fillStyle = v % 2 ? "#3f8f5a" : "#5cb071";
    ctx.beginPath();
    ctx.ellipse(9, 10, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ["#ff8fb0", "#ffd75e", "#ffffff"][v % 3];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(4 + i * 5, 5 + (i % 2) * 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(4, 13, 10, 3);
  });

const yurt = () =>
  baked("yurt", 40, 26, (ctx) => {
    ctx.fillStyle = "#fbf3e2";
    ctx.beginPath();
    ctx.moveTo(2, 26);
    ctx.lineTo(2, 14);
    ctx.quadraticCurveTo(20, -4, 38, 14);
    ctx.lineTo(38, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7a4a26";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#9c2b38";
    ctx.fillRect(2, 15, 36, 3);
    ctx.fillStyle = "#f2b84b";
    for (let x = 4; x < 38; x += 4) ctx.fillRect(x, 16, 1.6, 1.2);
    ctx.fillStyle = "#3a2618";
    ctx.fillRect(16, 18, 8, 8);
    ctx.strokeStyle = "#f2b84b";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(20, 5, 4, 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

const lantern = () =>
  baked("lantern", 10, 16, (ctx) => {
    ctx.strokeStyle = "#3a2618";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(5, 4);
    ctx.stroke();
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.ellipse(5, 9, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2b84b";
    ctx.fillRect(2, 3, 6, 1.6);
    ctx.fillRect(2, 14, 6, 1.6);
  });

/** Blade sign of the chaikhana: dark board + neon lettering (the lettering is emissive). */
const signBoard = () =>
  baked("signBoard", 12, 34, (ctx) => {
    ctx.fillStyle = "#3a2618";
    ctx.fillRect(5.2, 0, 1.6, 4);
    ctx.fillStyle = "#24161c";
    ctx.beginPath();
    ctx.moveTo(1, 4);
    ctx.lineTo(11, 4);
    ctx.lineTo(11, 31);
    ctx.quadraticCurveTo(6, 34, 1, 31);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f2b84b";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

const signNeon = () =>
  baked("signNeon", 12, 34, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.font = '700 5.2px "Rubik", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    "ЧАЙ".split("").forEach((ch, i) => ctx.fillText(ch, 6, 10 + i * 6.4));
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(3, 29);
    ctx.quadraticCurveTo(6, 30.5, 9, 29);
    ctx.stroke();
  });

const pole = () =>
  baked("pole", 3, 34, (ctx) => {
    ctx.fillStyle = "#d9d4c8";
    ctx.fillRect(0.6, 0, 1.8, 34);
    ctx.fillStyle = "#f2b84b";
    ctx.beginPath();
    ctx.arc(1.5, 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

/** An additive copy of an emissive source for the bloom layer. */
function emit(bv: BlockView, bank: TextureBank, tint: number, size: number, x: number, y: number): Sprite {
  const s = glow(bank, tint, size);
  s.position.set(x, y);
  bv.glow.addChild(s);
  return s;
}

function glow(bank: TextureBank, tint: number, size: number): Sprite {
  const s = new Sprite(bank.softDot());
  s.anchor.set(0.5);
  s.blendMode = "add";
  s.tint = tint;
  s.width = size;
  s.height = size;
  return s;
}

/** Attach animated extras to a room view. */
export function decorateRoom(bv: BlockView, bank: TextureBank, type: RoomId): void {
  const w = bv.w;
  const x0 = -w / 2;
  const roofY = -BLOCK_H;
  const extras = bv.extras;
  const seed = bv.seed;

  // Ornament decal on the walls: one grid and scale for every room, low alpha (0.15), aligned to
  // world x by BlockView so the pattern lines up from floor to floor.
  if (type !== "garden" && type !== "foundation") {
    const orn = new TilingSprite({ texture: bank.wallOrnament(bv.look.ornament), width: w - 10, height: BLOCK_H * 0.5 });
    orn.position.set(x0 + 5, -BLOCK_H * 0.78);
    orn.alpha = 0.15;
    bv.wall.addChild(orn);
    bv.ornament = orn;
  }

  switch (type) {
    case "dorm": {
      const line = new Sprite(laundry());
      line.anchor.set(0, 0);
      line.position.set(x0 + 8, roofY - 14);
      const ant = new Sprite(antenna());
      ant.anchor.set(0.5, 1);
      ant.position.set(x0 + w - 18, roofY);
      extras.addChild(line, ant);
      bv.tickers.push((t) => {
        line.skew.x = Math.sin(t * 2.2 + seed) * 0.08;
      });
      break;
    }
    case "chaikhana": {
      const lamp = new Sprite(lantern());
      lamp.anchor.set(0.5, 0);
      lamp.position.set(x0 + 10, roofY + 14);
      const g = glow(bank, 0xff9a3c, 34);
      g.position.set(x0 + 10, roofY + 24);
      const lampCore = emit(bv, bank, 0xffb35a, 12, x0 + 10, roofY + 23);
      // blade sign on the right edge, neon lettering at night
      const board = new Sprite(signBoard());
      board.anchor.set(0, 0);
      board.position.set(x0 + w - 1, roofY + 11);
      const neon = new Sprite(signNeon());
      neon.anchor.set(0, 0);
      neon.position.set(x0 + w - 1, roofY + 11);
      neon.tint = 0xff7ac0;
      const neonBloom = new Sprite(signNeon());
      neonBloom.anchor.set(0, 0);
      neonBloom.position.set(x0 + w - 1, roofY + 11);
      neonBloom.tint = 0xff7ac0;
      bv.glow.addChild(neonBloom);
      extras.addChild(g, lamp, board, neon);
      bv.tickers.push((t, night) => {
        lamp.rotation = Math.sin(t * 1.6 + seed) * 0.12;
        const flick = 0.85 + 0.15 * Math.sin(t * 11 + seed);
        g.alpha = (0.35 + 0.65 * night) * flick;
        lampCore.alpha = night * flick;
        const buzz = Math.sin(t * 37 + seed) > 0.97 ? 0.4 : 1;
        neon.alpha = 0.35 + 0.65 * night * buzz;
        neonBloom.alpha = night * buzz;
      });
      break;
    }
    case "itlab": {
      const r = new Sprite(rack());
      r.anchor.set(1, 1);
      r.position.set(x0 + w - 6, -BLOCK_H * 0.14);
      extras.addChild(r);
      const leds: Sprite[] = [];
      for (let i = 0; i < 5; i++) {
        const led = glow(bank, i % 2 ? 0x45e0ff : 0x8ef0a5, 6);
        led.position.set(x0 + w - 13, -BLOCK_H * 0.14 - 27 + i * 5);
        leds.push(led);
        extras.addChild(led);
      }
      // LEDs of the racks behind the glass (emissive)
      for (const win of bv.windowRects) {
        for (const rx of [win.x + win.w * 0.31, win.x + win.w * 0.71]) {
          for (let k = 0; k < 3; k++) {
            const led = emit(bv, bank, k % 2 ? 0x45e0ff : 0x8ef0a5, 2.6, rx, win.y + win.w * 0.55 + k * 2.6);
            leds.push(led);
            extras.addChild(Object.assign(glow(bank, led.tint as number, 2.2), { x: rx, y: win.y + win.w * 0.55 + k * 2.6 }));
          }
        }
      }
      const halo = glow(bank, 0x45e0ff, w * 0.9);
      halo.height = BLOCK_H * 0.9;
      halo.position.set(0, -BLOCK_H * 0.45);
      bv.wall.addChild(halo);
      bv.tickers.push((t, night) => {
        leds.forEach((l, i) => (l.alpha = (Math.sin(t * (5 + (i % 7)) + i * 2 + seed) > 0.2 ? 1 : 0.15) * (l.parent === bv.glow ? 0.4 + 0.6 * night : 1)));
        halo.alpha = 0.08 + 0.18 * night;
      });
      break;
    }
    case "gym": {
      const cones: Sprite[] = [];
      for (const side of [-1, 1]) {
        const c = new Sprite(bank.cone());
        c.anchor.set(0.5, 0);
        c.blendMode = "add";
        c.tint = 0xfff3c4;
        c.width = 40;
        c.height = 120;
        c.position.set(side * (w / 2 - 14), roofY);
        c.rotation = Math.PI + side * 0.25;
        cones.push(c);
        extras.addChild(c);
      }
      bv.tickers.push((t, night) => {
        cones.forEach((c, i) => {
          c.alpha = Math.max(0, night - 0.3) * 0.5;
          c.rotation = Math.PI + (i ? 1 : -1) * (0.25 + Math.sin(t * 0.9 + i * 2) * 0.35);
        });
      });
      break;
    }
    case "hall":
    case "faculty": {
      const p = new Sprite(pole());
      p.anchor.set(0.5, 1);
      p.position.set(0, roofY);
      const color = type === "faculty" && bv.look.faculty ? FACULTIES[bv.look.faculty].color : "#b8323f";
      const cloth = new TilingSprite({ texture: bank.flagCloth(color), width: 22, height: 12 });
      cloth.position.set(1.5, roofY - 33);
      extras.addChild(p, cloth);
      bv.tickers.push((t) => {
        cloth.tilePosition.x = t * 24 + seed;
        cloth.skew.y = Math.sin(t * 3 + seed) * 0.08;
      });
      break;
    }
    case "garden": {
      const plants: Sprite[] = [];
      const n = Math.max(3, Math.floor(w / 34));
      for (let i = 0; i < n; i++) {
        const s = new Sprite(plant(i + seed));
        s.anchor.set(0.5, 1);
        s.position.set(x0 + ((i + 0.5) / n) * w, roofY + 1);
        plants.push(s);
        extras.addChild(s);
      }
      bv.tickers.push((t) => plants.forEach((s, i) => (s.rotation = Math.sin(t * 1.8 + i + seed) * 0.06)));
      break;
    }
    case "nauryz": {
      const y = new Sprite(yurt());
      y.anchor.set(0.5, 1);
      y.position.set(0, roofY + 1);
      extras.addChild(y);
      const bulbs: Sprite[] = [];
      const n = Math.floor(w / 16);
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const b = glow(bank, [0xff6b6b, 0xffd75e, 0x7cefff, 0x8ef0a5][i % 4], 9);
        b.position.set(x0 + 6 + k * (w - 12), -BLOCK_H * 0.82 + 10 * 4 * k * (1 - k));
        bulbs.push(b);
        extras.addChild(b);
        bulbs.push(emit(bv, bank, b.tint as number, 4, b.x, b.y));
      }
      bv.tickers.push((t) => bulbs.forEach((b, i) => (b.alpha = Math.sin(t * 4 + i * 1.3) > -0.3 ? 1 : 0.25)));
      break;
    }
    case "foundation": {
      const lamps = [glow(bank, 0xffb347, 30), glow(bank, 0xffb347, 30)];
      lamps[0].position.set(-31, -BLOCK_H * 0.47);
      lamps[1].position.set(31, -BLOCK_H * 0.47);
      extras.addChild(...lamps);
      lamps.push(emit(bv, bank, 0xffc46b, 10, -31, -BLOCK_H * 0.47), emit(bv, bank, 0xffc46b, 10, 31, -BLOCK_H * 0.47));
      bv.tickers.push((t, night) => lamps.forEach((l, i) => (l.alpha = (0.25 + 0.75 * night) * (0.9 + 0.1 * Math.sin(t * 9 + i)))));
      break;
    }
    case "coworking": {
      const screens: Sprite[] = [];
      for (const win of bv.windowRects) {
        const s = glow(bank, 0x9fe3ff, 10);
        s.position.set(win.cx, win.y + win.h - 7);
        screens.push(s);
        extras.addChild(s);
      }
      bv.tickers.push((t, night) => screens.forEach((s, i) => (s.alpha = (0.3 + 0.6 * night) * (0.8 + 0.2 * Math.sin(t * 3 + i)))));
      break;
    }
    default:
      break;
  }
}

