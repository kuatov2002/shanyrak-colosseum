// One vector icon set for the whole game. Each icon is drawn once, in the shared palette, through a
// tiny "pen" interface: the WebGL HUD renders it to a canvas texture (design/icons.ts) and the DOM
// gets the very same drawing recorded as inline SVG (iconSvg / iconEl). Emoji in UI strings are
// mapped onto these icons (EMOJI_ICON), so menus never depend on the OS emoji font.
// No Pixi import here: this module is safe for the DOM layer and for tests.

export const ICON_NAMES = [
  // HUD (bonuses, events, round)
  "coin", "cap", "helmet", "shield", "pause", "cup", "crane", "magnet", "tree", "calendar", "columns", "lantern",
  "teapot", "flag", "wind", "clock", "scroll", "tulip", "moon", "tent", "target", "dome", "next", "star",
  // chrome
  "hammer", "trophy", "gear", "wallet", "brick", "felt", "thread", "close", "play", "check", "lock", "gift", "fire",
  "medal", "medal1", "medal2", "medal3", "music", "sound", "mute", "pencil", "trash", "help", "chart", "refresh",
  "external", "copy", "sparkle", "bolt", "infinity", "palette", "mountain", "ornament", "basket", "books", "tap",
  "cards", "hook", "ruler", "clover", "moneybag", "up", "cloud", "key", "city", "crown", "toolbox", "dotGreen",
  "dotGray", "square", "starEmpty",
  // avatar totems
  "eagle", "horse", "leopard", "owl", "wolf", "deer",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Emoji / symbols used in UI copy → icon. Variation selectors are ignored when matching. */
export const EMOJI_ICON: Record<string, IconName> = {
  "🪙": "coin", "💰": "moneybag", "🎓": "cap", "⛑": "helmet", "🛡": "shield", "🍵": "cup", "☕": "cup",
  "🏗": "crane", "🪝": "hook", "🧲": "magnet", "🌲": "tree", "🌳": "tree", "📅": "calendar", "🏛": "columns",
  "🏘": "columns", "🏮": "lantern", "🫖": "teapot", "🚩": "flag", "🌬": "wind", "⏰": "clock", "📜": "scroll",
  "📝": "scroll", "🌷": "tulip", "🌙": "moon", "🎪": "tent", "🎯": "target", "⭐": "star", "★": "star",
  "☆": "starEmpty", "🛠": "hammer", "🔨": "hammer", "🏆": "trophy", "⚙": "gear", "◎": "wallet", "🧱": "brick",
  "🟫": "felt", "🧵": "thread", "✕": "close", "▶": "play", "✅": "check", "🔒": "lock", "🎁": "gift",
  "🔥": "fire", "🏅": "medal", "🥇": "medal1", "🥈": "medal2", "🥉": "medal3", "🎵": "music", "🎶": "music",
  "🔊": "sound", "🔇": "mute", "✏": "pencil", "🗑": "trash", "❓": "help", "📊": "chart", "🔁": "refresh",
  "↻": "refresh", "↗": "external", "📋": "copy", "✨": "sparkle", "⚡": "bolt", "♾": "infinity", "🎨": "palette",
  "🏔": "mountain", "🏞": "mountain", "🌀": "ornament", "🧺": "basket", "📚": "books", "👆": "tap", "🃏": "cards",
  "📐": "ruler", "🍀": "clover", "🔺": "up", "☁": "cloud", "🗝": "key", "🌃": "city", "👑": "crown",
  "🧰": "toolbox", "🟢": "dotGreen", "⚪": "dotGray", "🟩": "square", "🦅": "eagle", "🐎": "horse",
  "🐆": "leopard", "🦉": "owl", "🐺": "wolf", "🦌": "deer",
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Matches any mapped emoji (with an optional variation selector). */
export const EMOJI_RE = new RegExp(
  `(${Object.keys(EMOJI_ICON)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})\\uFE0F?`,
  "gu",
);

const GOLD = "#f2b84b";
const GOLD2 = "#ffd75e";
const CREAM = "#fff3d6";
const TURQ = "#2aa79a";
const RED = "#e85d5d";
const DEEP = "#7a4a14";
const INK = "#2b2d40";
const STEEL = "#cfd6e6";
const TERRA = "#c8643b";
const GREEN = "#4fd08a";
const SKIN = "#f3c9a0";
/** Icon design grid (px); textures are baked at 2×. */
export const ICON_GRID = 48;

/** The subset of CanvasRenderingContext2D the icons use (implemented by the SVG recorder too). */
export interface Pen {
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
  stroke(): void;
}

/** Five-pointed star path (starts a new path). */
function star(ctx: Pen, x: number, y: number, ro: number, ri: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Four-pointed sparkle (starts a new path). */
function sparkle(ctx: Pen, x: number, y: number, r: number): void {
  const k = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}

/** Crescent: circle (x,y,R) minus circle (ix,iy,r), as one path (no compositing, so SVG gets it too). */
function crescent(ctx: Pen, x: number, y: number, R: number, ix: number, iy: number, r: number): void {
  const dx = ix - x;
  const dy = iy - y;
  const d = Math.hypot(dx, dy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const p1 = [x + a * ux - h * uy, y + a * uy + h * ux];
  const p2 = [x + a * ux + h * uy, y + a * uy - h * ux];
  const o1 = Math.atan2(p1[1] - y, p1[0] - x);
  const o2 = Math.atan2(p2[1] - y, p2[0] - x);
  const i1 = Math.atan2(p1[1] - iy, p1[0] - ix);
  const i2 = Math.atan2(p2[1] - iy, p2[0] - ix);
  ctx.beginPath();
  ctx.arc(x, y, R, o1, o2, false);
  ctx.arc(ix, iy, r, i2, i1, true);
  ctx.closePath();
}

export function drawIcon(ctx: Pen, name: IconName): void {
  const c = ICON_GRID / 2;
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
      crescent(ctx, c, c, 15, c + 8, c - 5, 13);
      fill("#fff6dc");
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
    // ── chrome (menus, topbar, buttons) ─────────────────────────────────────
    case "hammer":
      ctx.moveTo(c - 13, c + 15);
      ctx.lineTo(c + 3, c - 1);
      stroke("#8a5a2b", 5);
      ctx.beginPath();
      ctx.moveTo(c - 2, c - 14);
      ctx.lineTo(c + 10, c - 2);
      ctx.lineTo(c + 16, c - 8);
      ctx.lineTo(c + 4, c - 20);
      ctx.closePath();
      fill(STEEL);
      stroke(INK, 2);
      break;
    case "trophy":
      ctx.arc(c - 11, c - 9, 5.5, Math.PI / 2, Math.PI * 1.5);
      ctx.moveTo(c + 11, c - 14.5);
      ctx.arc(c + 11, c - 9, 5.5, -Math.PI / 2, Math.PI / 2);
      stroke(GOLD, 3);
      ctx.beginPath();
      ctx.moveTo(c - 11, c - 16);
      ctx.lineTo(c + 11, c - 16);
      ctx.lineTo(c + 10, c - 5);
      ctx.quadraticCurveTo(c + 8, c + 5, c, c + 5);
      ctx.quadraticCurveTo(c - 8, c + 5, c - 10, c - 5);
      ctx.closePath();
      fill(GOLD);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.rect(c - 2.5, c + 5, 5, 7);
      fill(GOLD);
      ctx.beginPath();
      ctx.roundRect(c - 10, c + 12, 20, 6, 2);
      fill(DEEP);
      star(ctx, c, c - 6, 5, 2.2);
      fill(GOLD2);
      break;
    case "gear": {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        for (const [r, da] of [[13, -0.36], [17.5, -0.2], [17.5, 0.2], [13, 0.36]] as [number, number][]) {
          ctx.lineTo(c + Math.cos(a + da) * r, c + Math.sin(a + da) * r);
        }
      }
      ctx.closePath();
      fill(STEEL);
      stroke(INK, 2);
      ctx.beginPath();
      ctx.arc(c, c, 5.5, 0, Math.PI * 2);
      fill(INK);
      break;
    }
    case "wallet":
      ctx.moveTo(c - 13, c - 11);
      ctx.lineTo(c + 7, c - 18);
      ctx.lineTo(c + 10, c - 11);
      ctx.closePath();
      fill(GOLD);
      ctx.beginPath();
      ctx.roundRect(c - 17, c - 11, 34, 26, 5);
      fill(TURQ);
      stroke("#13584f", 2);
      ctx.beginPath();
      ctx.roundRect(c + 4, c - 3, 14, 10, 3);
      fill("#1d8277");
      ctx.beginPath();
      ctx.arc(c + 10, c + 2, 2.2, 0, Math.PI * 2);
      fill(CREAM);
      break;
    case "brick":
      ctx.rect(c - 17, c - 9, 34, 18);
      fill(TERRA);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c - 17, c);
      ctx.lineTo(c + 17, c);
      ctx.moveTo(c - 5, c - 9);
      ctx.lineTo(c - 5, c);
      ctx.moveTo(c + 6, c);
      ctx.lineTo(c + 6, c + 9);
      stroke("#f3d2b5", 2);
      break;
    case "felt":
      ctx.roundRect(c - 16, c - 13, 32, 26, 5);
      fill("#a8794a");
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c, c - 8);
      ctx.lineTo(c + 8, c);
      ctx.lineTo(c, c + 8);
      ctx.lineTo(c - 8, c);
      ctx.closePath();
      stroke(CREAM, 2);
      ctx.beginPath();
      for (const [x, y] of [[-12, -9], [12, -9], [-12, 9], [12, 9]]) {
        ctx.moveTo(c + x + 1.6, c + y);
        ctx.arc(c + x, c + y, 1.6, 0, Math.PI * 2);
      }
      fill(CREAM);
      break;
    case "thread":
      ctx.rect(c - 9, c - 10, 18, 20);
      fill(RED);
      ctx.beginPath();
      ctx.moveTo(c - 9, c - 5);
      ctx.lineTo(c + 9, c - 3);
      ctx.moveTo(c - 9, c + 1);
      ctx.lineTo(c + 9, c + 3);
      stroke("rgba(255,255,255,0.45)", 1.5);
      ctx.beginPath();
      ctx.roundRect(c - 13, c - 15, 26, 5, 2);
      ctx.roundRect(c - 13, c + 10, 26, 5, 2);
      fill("#8a5a2b");
      ctx.beginPath();
      ctx.moveTo(c + 9, c + 5);
      ctx.quadraticCurveTo(c + 19, c + 8, c + 16, c + 18);
      stroke(RED, 2);
      break;
    case "close":
      ctx.moveTo(c - 9, c - 9);
      ctx.lineTo(c + 9, c + 9);
      ctx.moveTo(c + 9, c - 9);
      ctx.lineTo(c - 9, c + 9);
      stroke(CREAM, 4);
      break;
    case "play":
      ctx.moveTo(c - 9, c - 15);
      ctx.lineTo(c + 15, c);
      ctx.lineTo(c - 9, c + 15);
      ctx.closePath();
      fill(CREAM);
      stroke(CREAM, 3);
      break;
    case "check":
      ctx.roundRect(c - 16, c - 16, 32, 32, 8);
      fill(GREEN);
      ctx.beginPath();
      ctx.moveTo(c - 8, c);
      ctx.lineTo(c - 2, c + 7);
      ctx.lineTo(c + 9, c - 7);
      stroke("#ffffff", 4);
      break;
    case "lock":
      ctx.moveTo(c - 7, c - 2);
      ctx.lineTo(c - 7, c - 9);
      ctx.arc(c, c - 9, 7, Math.PI, 0);
      ctx.lineTo(c + 7, c - 2);
      stroke(STEEL, 3.5);
      ctx.beginPath();
      ctx.roundRect(c - 12, c - 3, 24, 19, 4);
      fill(GOLD);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.arc(c, c + 5, 2.6, 0, Math.PI * 2);
      fill(DEEP);
      ctx.beginPath();
      ctx.moveTo(c, c + 6);
      ctx.lineTo(c, c + 10);
      stroke(DEEP, 2);
      break;
    case "gift":
      ctx.moveTo(c, c - 10);
      ctx.bezierCurveTo(c - 15, c - 21, c - 15, c - 6, c, c - 10);
      ctx.moveTo(c, c - 10);
      ctx.bezierCurveTo(c + 15, c - 21, c + 15, c - 6, c, c - 10);
      stroke(GOLD, 3);
      ctx.beginPath();
      ctx.rect(c - 14, c - 4, 28, 20);
      fill(RED);
      stroke("#7d2020", 2);
      ctx.beginPath();
      ctx.rect(c - 16, c - 10, 32, 7);
      fill("#ef6464");
      stroke("#7d2020", 2);
      ctx.beginPath();
      ctx.rect(c - 2.5, c - 10, 5, 26);
      fill(GOLD);
      break;
    case "fire":
      ctx.moveTo(c, c - 18);
      ctx.quadraticCurveTo(c + 15, c - 3, c + 12, c + 9);
      ctx.quadraticCurveTo(c + 9, c + 18, c, c + 18);
      ctx.quadraticCurveTo(c - 9, c + 18, c - 12, c + 9);
      ctx.quadraticCurveTo(c - 14, c, c - 6, c - 7);
      ctx.quadraticCurveTo(c - 5, c, c - 1, c);
      ctx.quadraticCurveTo(c - 3, c - 10, c, c - 18);
      ctx.closePath();
      fill("#ff7a2f");
      ctx.beginPath();
      ctx.moveTo(c, c - 2);
      ctx.quadraticCurveTo(c + 8, c + 6, c + 6, c + 11);
      ctx.quadraticCurveTo(c + 4, c + 16, c, c + 16);
      ctx.quadraticCurveTo(c - 4, c + 16, c - 6, c + 11);
      ctx.quadraticCurveTo(c - 7, c + 5, c, c - 2);
      ctx.closePath();
      fill(GOLD2);
      break;
    case "medal":
    case "medal1":
    case "medal2":
    case "medal3": {
      const disc = name === "medal2" ? "#d9dfee" : name === "medal3" ? "#d08a52" : GOLD;
      ctx.moveTo(c - 11, c - 18);
      ctx.lineTo(c - 4, c - 18);
      ctx.lineTo(c + 2, c - 5);
      ctx.lineTo(c - 5, c - 5);
      ctx.closePath();
      fill(TURQ);
      ctx.beginPath();
      ctx.moveTo(c + 11, c - 18);
      ctx.lineTo(c + 4, c - 18);
      ctx.lineTo(c - 2, c - 5);
      ctx.lineTo(c + 5, c - 5);
      ctx.closePath();
      fill(RED);
      ctx.beginPath();
      ctx.arc(c, c + 6, 11.5, 0, Math.PI * 2);
      fill(disc);
      stroke(DEEP, 2);
      star(ctx, c, c + 6, 6, 2.6);
      fill("rgba(122,74,20,0.45)");
      break;
    }
    case "music":
      ctx.moveTo(c + 5, c + 9);
      ctx.lineTo(c + 5, c - 16);
      ctx.quadraticCurveTo(c + 15, c - 12, c + 14, c - 3);
      stroke(GOLD2, 3);
      ctx.beginPath();
      ctx.ellipse(c - 1, c + 10, 7, 5.5, 0, 0, Math.PI * 2);
      fill(GOLD2);
      break;
    case "sound":
    case "mute":
      ctx.moveTo(c - 16, c - 6);
      ctx.lineTo(c - 9, c - 6);
      ctx.lineTo(c - 1, c - 13);
      ctx.lineTo(c - 1, c + 13);
      ctx.lineTo(c - 9, c + 6);
      ctx.lineTo(c - 16, c + 6);
      ctx.closePath();
      fill(CREAM);
      ctx.beginPath();
      if (name === "sound") {
        ctx.arc(c + 1, c, 7, -0.8, 0.8);
        ctx.moveTo(c + 1 + Math.cos(-0.8) * 13, c + Math.sin(-0.8) * 13);
        ctx.arc(c + 1, c, 13, -0.8, 0.8);
        stroke(CREAM, 3);
      } else {
        ctx.moveTo(c + 5, c - 6);
        ctx.lineTo(c + 16, c + 6);
        ctx.moveTo(c + 16, c - 6);
        ctx.lineTo(c + 5, c + 6);
        stroke(RED, 3.5);
      }
      break;
    case "pencil":
      ctx.moveTo(c - 14, c + 10);
      ctx.lineTo(c + 8, c - 12);
      ctx.lineTo(c + 14, c - 6);
      ctx.lineTo(c - 8, c + 16);
      ctx.closePath();
      fill(GOLD);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c - 14, c + 10);
      ctx.lineTo(c - 8, c + 16);
      ctx.lineTo(c - 17, c + 19);
      ctx.closePath();
      fill("#f3d2b5");
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c + 8, c - 12);
      ctx.lineTo(c + 11, c - 15);
      ctx.lineTo(c + 17, c - 9);
      ctx.lineTo(c + 14, c - 6);
      ctx.closePath();
      fill("#ff9ad5");
      stroke(DEEP, 2);
      break;
    case "trash":
      ctx.moveTo(c - 12, c - 8);
      ctx.lineTo(c + 12, c - 8);
      ctx.lineTo(c + 10, c + 17);
      ctx.lineTo(c - 10, c + 17);
      ctx.closePath();
      fill(STEEL);
      stroke(INK, 2);
      ctx.beginPath();
      ctx.moveTo(c - 5, c - 3);
      ctx.lineTo(c - 4, c + 12);
      ctx.moveTo(c + 5, c - 3);
      ctx.lineTo(c + 4, c + 12);
      stroke("rgba(43,45,64,0.55)", 2);
      ctx.beginPath();
      ctx.roundRect(c - 4, c - 17, 8, 5, 1.5);
      stroke(INK, 2);
      ctx.beginPath();
      ctx.roundRect(c - 15, c - 13, 30, 5, 2);
      fill("#e3e8f4");
      stroke(INK, 2);
      break;
    case "help":
      ctx.arc(c, c, 16, 0, Math.PI * 2);
      fill(TURQ);
      ctx.beginPath();
      ctx.moveTo(c - 6, c - 5);
      ctx.quadraticCurveTo(c - 6, c - 11, c, c - 11);
      ctx.quadraticCurveTo(c + 7, c - 11, c + 7, c - 5);
      ctx.quadraticCurveTo(c + 7, c, c, c + 2);
      ctx.lineTo(c, c + 4);
      stroke(CREAM, 3.5);
      ctx.beginPath();
      ctx.arc(c, c + 10, 2.3, 0, Math.PI * 2);
      fill(CREAM);
      break;
    case "chart":
      ctx.roundRect(c - 16, c - 16, 32, 32, 6);
      fill(CREAM);
      stroke(INK, 2);
      ctx.beginPath();
      ctx.rect(c - 10, c + 2, 5, 9);
      fill(TURQ);
      ctx.beginPath();
      ctx.rect(c - 2.5, c - 8, 5, 19);
      fill(GOLD);
      ctx.beginPath();
      ctx.rect(c + 5, c - 2, 5, 13);
      fill(RED);
      break;
    case "refresh": {
      const a1 = 5.55;
      ctx.arc(c, c, 12, 0.7, a1);
      stroke(TURQ, 3.5);
      const px = c + Math.cos(a1) * 12;
      const py = c + Math.sin(a1) * 12;
      const dx = -Math.sin(a1);
      const dy = Math.cos(a1);
      ctx.beginPath();
      ctx.moveTo(px + dx * 6, py + dy * 6);
      ctx.lineTo(px - dx * 2 - dy * 6, py - dy * 2 + dx * 6);
      ctx.lineTo(px - dx * 2 + dy * 6, py - dy * 2 - dx * 6);
      ctx.closePath();
      fill(TURQ);
      stroke(TURQ, 1.5);
      break;
    }
    case "external":
      ctx.roundRect(c - 15, c - 9, 24, 24, 4);
      stroke(CREAM, 3);
      ctx.beginPath();
      ctx.moveTo(c - 3, c + 3);
      ctx.lineTo(c + 14, c - 14);
      ctx.moveTo(c + 3, c - 14);
      ctx.lineTo(c + 14, c - 14);
      ctx.lineTo(c + 14, c - 3);
      stroke(GOLD2, 3.5);
      break;
    case "copy":
      ctx.roundRect(c - 13, c - 14, 26, 31, 4);
      fill("#a8794a");
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.rect(c - 9, c - 9, 18, 22);
      fill(CREAM);
      ctx.beginPath();
      for (const y of [-3, 2, 7]) {
        ctx.moveTo(c - 5, c + y);
        ctx.lineTo(c + 5, c + y);
      }
      stroke("rgba(43,45,64,0.4)", 2);
      ctx.beginPath();
      ctx.roundRect(c - 6, c - 18, 12, 6, 2);
      fill(STEEL);
      stroke(INK, 1.5);
      break;
    case "sparkle":
      sparkle(ctx, c - 2, c + 2, 15);
      fill(GOLD2);
      sparkle(ctx, c + 12, c - 12, 6);
      fill(CREAM);
      break;
    case "bolt":
      ctx.moveTo(c + 4, c - 18);
      ctx.lineTo(c - 10, c + 3);
      ctx.lineTo(c - 1, c + 3);
      ctx.lineTo(c - 4, c + 18);
      ctx.lineTo(c + 10, c - 3);
      ctx.lineTo(c + 1, c - 3);
      ctx.closePath();
      fill(GOLD2);
      stroke(DEEP, 1.5);
      break;
    case "infinity":
      ctx.moveTo(c, c);
      ctx.bezierCurveTo(c + 6, c - 10, c + 17, c - 10, c + 17, c);
      ctx.bezierCurveTo(c + 17, c + 10, c + 6, c + 10, c, c);
      ctx.bezierCurveTo(c - 6, c - 10, c - 17, c - 10, c - 17, c);
      ctx.bezierCurveTo(c - 17, c + 10, c - 6, c + 10, c, c);
      stroke(TURQ, 3.5);
      break;
    case "palette":
      ctx.moveTo(c + 2, c - 16);
      ctx.bezierCurveTo(c + 14, c - 16, c + 18, c - 6, c + 16, c + 2);
      ctx.bezierCurveTo(c + 14, c + 8, c + 6, c + 4, c + 6, c + 10);
      ctx.bezierCurveTo(c + 6, c + 16, c - 2, c + 17, c - 8, c + 14);
      ctx.bezierCurveTo(c - 17, c + 9, c - 18, c - 16, c + 2, c - 16);
      ctx.closePath();
      fill("#e8d2a8");
      stroke(DEEP, 2);
      for (const [x, y, col] of [[-8, -6, RED], [0, -10, GOLD], [8, -6, TURQ], [-9, 3, "#4f9d69"]] as [number, number, string][]) {
        ctx.beginPath();
        ctx.arc(c + x, c + y, 3.2, 0, Math.PI * 2);
        fill(col);
      }
      break;
    case "mountain":
      ctx.moveTo(c - 18, c + 14);
      ctx.lineTo(c - 5, c - 11);
      ctx.lineTo(c + 3, c + 2);
      ctx.lineTo(c + 9, c - 5);
      ctx.lineTo(c + 18, c + 14);
      ctx.closePath();
      fill("#6c7bb5");
      ctx.beginPath();
      ctx.moveTo(c - 10, c - 2);
      ctx.lineTo(c - 5, c - 11);
      ctx.lineTo(c, c - 2);
      ctx.lineTo(c - 3, c - 4);
      ctx.lineTo(c - 6, c - 1);
      ctx.closePath();
      fill(CREAM);
      ctx.beginPath();
      ctx.moveTo(c + 6, c - 1);
      ctx.lineTo(c + 9, c - 5);
      ctx.lineTo(c + 12, c);
      ctx.closePath();
      fill(CREAM);
      break;
    case "ornament":
      // koshkar-muiz (ram's horn), the curl used on felt and doors
      ctx.moveTo(c, c + 15);
      ctx.lineTo(c, c + 2);
      ctx.quadraticCurveTo(c, c - 10, c - 8, c - 10);
      ctx.quadraticCurveTo(c - 15, c - 10, c - 15, c - 3);
      ctx.quadraticCurveTo(c - 15, c + 2, c - 10, c + 2);
      ctx.quadraticCurveTo(c - 6, c + 2, c - 6, c - 3);
      ctx.moveTo(c, c + 2);
      ctx.quadraticCurveTo(c, c - 10, c + 8, c - 10);
      ctx.quadraticCurveTo(c + 15, c - 10, c + 15, c - 3);
      ctx.quadraticCurveTo(c + 15, c + 2, c + 10, c + 2);
      ctx.quadraticCurveTo(c + 6, c + 2, c + 6, c - 3);
      stroke(GOLD, 3.5);
      break;
    case "basket":
      ctx.arc(c, c - 2, 11, Math.PI, 0);
      stroke(DEEP, 2.5);
      ctx.beginPath();
      ctx.moveTo(c - 16, c - 2);
      ctx.lineTo(c + 16, c - 2);
      ctx.lineTo(c + 11, c + 16);
      ctx.lineTo(c - 11, c + 16);
      ctx.closePath();
      fill("#c8955a");
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c - 14, c + 4);
      ctx.lineTo(c + 14, c + 4);
      ctx.moveTo(c - 12, c + 10);
      ctx.lineTo(c + 12, c + 10);
      stroke("rgba(122,74,20,0.55)", 2);
      break;
    case "books":
      ctx.rect(c - 16, c - 12, 8, 28);
      fill(RED);
      stroke(INK, 1.5);
      ctx.beginPath();
      ctx.rect(c - 7, c - 16, 8, 32);
      fill(TURQ);
      stroke(INK, 1.5);
      ctx.beginPath();
      ctx.moveTo(c + 3, c - 12);
      ctx.lineTo(c + 10, c - 14);
      ctx.lineTo(c + 17, c + 14);
      ctx.lineTo(c + 10, c + 16);
      ctx.closePath();
      fill(GOLD);
      stroke(INK, 1.5);
      break;
    case "tap":
      ctx.arc(c, c - 13, 8, Math.PI * 1.1, Math.PI * 1.9);
      stroke(GOLD2, 2.5);
      ctx.beginPath();
      ctx.roundRect(c - 10, c - 1, 20, 18, 7);
      fill(SKIN);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.roundRect(c - 4, c - 15, 8, 22, 4);
      fill(SKIN);
      stroke(DEEP, 2);
      break;
    case "cards":
      ctx.roundRect(c - 15, c - 15, 19, 27, 3);
      fill(STEEL);
      stroke(INK, 2);
      ctx.beginPath();
      ctx.roundRect(c - 5, c - 10, 20, 27, 3);
      fill("#ffffff");
      stroke(INK, 2);
      star(ctx, c + 5, c + 3.5, 6, 2.6);
      fill(RED);
      break;
    case "hook":
      ctx.arc(c + 2, c - 15, 3, 0, Math.PI * 2);
      ctx.moveTo(c + 2, c - 12);
      ctx.lineTo(c + 2, c + 3);
      ctx.arc(c - 5, c + 3, 7, 0, Math.PI * 0.95);
      ctx.lineTo(c - 10, c - 1);
      stroke(STEEL, 3.5);
      break;
    case "ruler":
      ctx.moveTo(c - 15, c - 16);
      ctx.lineTo(c - 15, c + 15);
      ctx.lineTo(c + 16, c + 15);
      ctx.closePath();
      fill(GOLD);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c - 9, c - 3);
      ctx.lineTo(c - 9, c + 9);
      ctx.lineTo(c + 3, c + 9);
      ctx.closePath();
      stroke(DEEP, 1.5);
      ctx.beginPath();
      for (const y of [-10, -4, 2, 8]) {
        ctx.moveTo(c - 15, c + y);
        ctx.lineTo(c - 12, c + y);
      }
      stroke(DEEP, 1.5);
      break;
    case "clover":
      ctx.moveTo(c + 2, c + 6);
      ctx.quadraticCurveTo(c + 8, c + 13, c + 12, c + 18);
      stroke("#3f8f5a", 2.5);
      for (const [x, y] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
        ctx.beginPath();
        ctx.arc(c + x, c + y, 6.2, 0, Math.PI * 2);
        fill("#4fd08a");
      }
      ctx.beginPath();
      ctx.arc(c, c, 2.2, 0, Math.PI * 2);
      fill("#3f8f5a");
      break;
    case "moneybag":
      ctx.moveTo(c - 6, c - 10);
      ctx.quadraticCurveTo(c - 18, c + 2, c - 14, c + 12);
      ctx.quadraticCurveTo(c - 12, c + 17, c, c + 17);
      ctx.quadraticCurveTo(c + 12, c + 17, c + 14, c + 12);
      ctx.quadraticCurveTo(c + 18, c + 2, c + 6, c - 10);
      ctx.lineTo(c + 9, c - 16);
      ctx.lineTo(c - 9, c - 16);
      ctx.closePath();
      fill("#c8955a");
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.moveTo(c - 7, c - 10);
      ctx.lineTo(c + 7, c - 10);
      stroke(DEEP, 3);
      ctx.beginPath();
      ctx.arc(c, c + 5, 5.5, 0, Math.PI * 2);
      fill(GOLD);
      stroke(DEEP, 1.5);
      break;
    case "up":
      ctx.moveTo(c, c - 14);
      ctx.lineTo(c + 14, c + 10);
      ctx.lineTo(c - 14, c + 10);
      ctx.closePath();
      fill(RED);
      stroke(RED, 3);
      break;
    case "cloud":
      ctx.moveTo(c - 7 + 8, c + 3);
      ctx.arc(c - 7, c + 3, 8, 0, Math.PI * 2);
      ctx.moveTo(c + 2 + 10, c - 3);
      ctx.arc(c + 2, c - 3, 10, 0, Math.PI * 2);
      ctx.moveTo(c + 10 + 7, c + 4);
      ctx.arc(c + 10, c + 4, 7, 0, Math.PI * 2);
      ctx.rect(c - 7, c + 3, 17, 8);
      fill("#e8eefc");
      break;
    case "key":
      ctx.arc(c - 8, c - 7, 7, 0, Math.PI * 2);
      ctx.moveTo(c - 3, c - 2);
      ctx.lineTo(c + 14, c + 15);
      ctx.moveTo(c + 7, c + 8);
      ctx.lineTo(c + 11, c + 4);
      ctx.moveTo(c + 11, c + 12);
      ctx.lineTo(c + 15, c + 8);
      stroke(GOLD, 3.5);
      break;
    case "city":
      ctx.arc(c + 12, c - 12, 4.5, 0, Math.PI * 2);
      fill(CREAM);
      ctx.beginPath();
      ctx.rect(c - 17, c - 2, 10, 19);
      ctx.rect(c - 6, c - 11, 11, 28);
      ctx.rect(c + 6, c - 4, 11, 21);
      fill("#6c7bb5");
      ctx.beginPath();
      for (const [x, y] of [[-14, 2], [-14, 8], [-3, -7], [1, -7], [-3, 0], [1, 6], [9, 0], [13, 6]]) ctx.rect(c + x, c + y, 2.6, 3);
      fill(GOLD2);
      break;
    case "crown":
      ctx.moveTo(c - 16, c + 9);
      ctx.lineTo(c - 16, c - 8);
      ctx.lineTo(c - 8, c);
      ctx.lineTo(c, c - 14);
      ctx.lineTo(c + 8, c);
      ctx.lineTo(c + 16, c - 8);
      ctx.lineTo(c + 16, c + 9);
      ctx.closePath();
      fill(GOLD2);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.rect(c - 16, c + 9, 32, 6);
      fill(GOLD);
      stroke(DEEP, 2);
      ctx.beginPath();
      ctx.arc(c, c + 3, 2.6, 0, Math.PI * 2);
      fill(RED);
      break;
    case "toolbox":
      ctx.moveTo(c - 7, c - 6);
      ctx.lineTo(c - 7, c - 12);
      ctx.lineTo(c + 7, c - 12);
      ctx.lineTo(c + 7, c - 6);
      stroke(INK, 3);
      ctx.beginPath();
      ctx.roundRect(c - 17, c - 6, 34, 22, 3);
      fill(RED);
      stroke("#7d2020", 2);
      ctx.beginPath();
      ctx.moveTo(c - 17, c + 1);
      ctx.lineTo(c + 17, c + 1);
      stroke("#7d2020", 2);
      ctx.beginPath();
      ctx.rect(c - 3, c - 1, 6, 5);
      fill(GOLD);
      break;
    case "dotGreen":
    case "dotGray":
      ctx.arc(c, c, 8, 0, Math.PI * 2);
      fill(name === "dotGreen" ? GREEN : "#b9b0cf");
      break;
    case "square":
      ctx.roundRect(c - 10, c - 10, 20, 20, 4);
      fill(GREEN);
      break;
    case "starEmpty":
      star(ctx, c, c, 17, 7);
      stroke(GOLD2, 2.5);
      break;
    // ── totems for player avatars (steppe animals, on the faculty-coloured medallion) ──
    case "eagle":
      ctx.moveTo(c - 12, c + 18);
      ctx.quadraticCurveTo(c - 15, c - 3, c - 5, c - 12);
      ctx.quadraticCurveTo(c + 5, c - 19, c + 12, c - 9);
      ctx.lineTo(c + 18, c - 4);
      ctx.quadraticCurveTo(c + 15, c + 2, c + 9, c + 1);
      ctx.quadraticCurveTo(c + 5, c + 8, c + 4, c + 18);
      ctx.closePath();
      fill(CREAM);
      stroke(DEEP, 1.5);
      ctx.beginPath();
      ctx.moveTo(c + 10, c - 9);
      ctx.quadraticCurveTo(c + 20, c - 8, c + 17, c + 3);
      ctx.quadraticCurveTo(c + 15, c - 2, c + 9, c - 2);
      ctx.closePath();
      fill(GOLD);
      ctx.beginPath();
      ctx.arc(c + 4, c - 8, 2.1, 0, Math.PI * 2);
      fill(INK);
      ctx.beginPath();
      ctx.moveTo(c - 9, c + 6);
      ctx.quadraticCurveTo(c - 3, c + 2, c, c + 8);
      ctx.moveTo(c - 10, c + 12);
      ctx.quadraticCurveTo(c - 4, c + 8, c - 1, c + 14);
      stroke("rgba(122,74,20,0.5)", 1.8);
      break;
    case "horse":
      ctx.moveTo(c - 10, c + 18);
      ctx.lineTo(c - 8, c - 2);
      ctx.quadraticCurveTo(c - 6, c - 13, c + 2, c - 15);
      ctx.lineTo(c + 3, c - 20);
      ctx.lineTo(c + 7, c - 14);
      ctx.quadraticCurveTo(c + 12, c - 10, c + 16, c + 2);
      ctx.quadraticCurveTo(c + 18, c + 9, c + 11, c + 8);
      ctx.quadraticCurveTo(c + 6, c + 6, c + 4, c + 2);
      ctx.lineTo(c + 4, c + 18);
      ctx.closePath();
      fill(CREAM);
      stroke(DEEP, 1.5);
      ctx.beginPath();
      ctx.moveTo(c - 8, c - 1);
      ctx.quadraticCurveTo(c - 13, c - 11, c + 1, c - 16);
      ctx.moveTo(c - 9, c + 6);
      ctx.quadraticCurveTo(c - 13, c - 2, c - 8, c - 6);
      stroke(DEEP, 3);
      ctx.beginPath();
      ctx.arc(c + 6, c - 7, 1.9, 0, Math.PI * 2);
      ctx.moveTo(c + 15.2, c + 4);
      ctx.arc(c + 14, c + 4, 1.2, 0, Math.PI * 2);
      fill(INK);
      break;
    case "leopard": {
      ctx.moveTo(c - 10 + 4.5, c - 9);
      ctx.arc(c - 10, c - 9, 4.5, 0, Math.PI * 2);
      ctx.moveTo(c + 10 + 4.5, c - 9);
      ctx.arc(c + 10, c - 9, 4.5, 0, Math.PI * 2);
      ctx.moveTo(c + 13, c + 2);
      ctx.arc(c, c + 2, 13, 0, Math.PI * 2);
      fill(CREAM);
      stroke(DEEP, 1.5);
      ctx.beginPath();
      for (const [x, y, r] of [[-8, -6, 1.8], [-3, -9, 1.6], [3, -9, 1.6], [8, -6, 1.8], [-10, 4, 1.7], [10, 4, 1.7], [-6, 10, 1.5], [6, 10, 1.5]]) {
        ctx.moveTo(c + x + r, c + y);
        ctx.arc(c + x, c + y, r, 0, Math.PI * 2);
      }
      fill("#7b7790");
      ctx.beginPath();
      ctx.ellipse(c - 5, c - 1, 2.6, 2, 0, 0, Math.PI * 2);
      ctx.moveTo(c + 7.6, c - 1);
      ctx.ellipse(c + 5, c - 1, 2.6, 2, 0, 0, Math.PI * 2);
      fill(TURQ);
      ctx.beginPath();
      ctx.moveTo(c - 2.5, c + 4);
      ctx.lineTo(c + 2.5, c + 4);
      ctx.lineTo(c, c + 7);
      ctx.closePath();
      fill("#ff9ad5");
      ctx.beginPath();
      ctx.moveTo(c, c + 7);
      ctx.quadraticCurveTo(c - 2, c + 10, c - 5, c + 9);
      ctx.moveTo(c, c + 7);
      ctx.quadraticCurveTo(c + 2, c + 10, c + 5, c + 9);
      stroke(DEEP, 1.4);
      break;
    }
    case "owl":
      ctx.moveTo(c - 13, c - 13);
      ctx.lineTo(c - 6, c - 8);
      ctx.lineTo(c + 6, c - 8);
      ctx.lineTo(c + 13, c - 13);
      ctx.quadraticCurveTo(c + 17, c + 12, c, c + 18);
      ctx.quadraticCurveTo(c - 17, c + 12, c - 13, c - 13);
      ctx.closePath();
      fill("#c8955a");
      stroke(DEEP, 1.5);
      ctx.beginPath();
      ctx.moveTo(c - 6 + 5.5, c - 1);
      ctx.arc(c - 6, c - 1, 5.5, 0, Math.PI * 2);
      ctx.moveTo(c + 6 + 5.5, c - 1);
      ctx.arc(c + 6, c - 1, 5.5, 0, Math.PI * 2);
      fill(CREAM);
      ctx.beginPath();
      ctx.moveTo(c - 6 + 2.6, c - 1);
      ctx.arc(c - 6, c - 1, 2.6, 0, Math.PI * 2);
      ctx.moveTo(c + 6 + 2.6, c - 1);
      ctx.arc(c + 6, c - 1, 2.6, 0, Math.PI * 2);
      fill(INK);
      ctx.beginPath();
      ctx.moveTo(c - 2, c + 4);
      ctx.lineTo(c + 2, c + 4);
      ctx.lineTo(c, c + 8);
      ctx.closePath();
      fill(GOLD);
      ctx.beginPath();
      for (const y of [11, 14]) {
        ctx.moveTo(c - 6, c + y);
        ctx.lineTo(c - 3, c + y + 2);
        ctx.lineTo(c, c + y);
        ctx.lineTo(c + 3, c + y + 2);
        ctx.lineTo(c + 6, c + y);
      }
      stroke("rgba(122,74,20,0.6)", 1.5);
      break;
    case "wolf":
      ctx.moveTo(c - 14, c - 17);
      ctx.lineTo(c - 6, c - 8);
      ctx.lineTo(c + 6, c - 8);
      ctx.lineTo(c + 14, c - 17);
      ctx.lineTo(c + 14, c - 2);
      ctx.lineTo(c + 6, c + 10);
      ctx.lineTo(c, c + 17);
      ctx.lineTo(c - 6, c + 10);
      ctx.lineTo(c - 14, c - 2);
      ctx.closePath();
      fill("#b9b0cf");
      stroke(INK, 1.5);
      ctx.beginPath();
      ctx.moveTo(c - 6, c + 2);
      ctx.lineTo(c, c - 2);
      ctx.lineTo(c + 6, c + 2);
      ctx.lineTo(c, c + 17);
      ctx.closePath();
      fill(CREAM);
      ctx.beginPath();
      ctx.moveTo(c - 9, c - 3);
      ctx.lineTo(c - 4, c - 2);
      ctx.lineTo(c - 7, c);
      ctx.closePath();
      ctx.moveTo(c + 9, c - 3);
      ctx.lineTo(c + 4, c - 2);
      ctx.lineTo(c + 7, c);
      ctx.closePath();
      fill(GOLD2);
      ctx.beginPath();
      ctx.arc(c, c + 13, 2.3, 0, Math.PI * 2);
      fill(INK);
      break;
    case "deer":
      ctx.moveTo(c - 4, c - 5);
      ctx.lineTo(c - 10, c - 16);
      ctx.moveTo(c - 8, c - 12);
      ctx.lineTo(c - 16, c - 13);
      ctx.moveTo(c - 9, c - 15);
      ctx.lineTo(c - 6, c - 20);
      ctx.moveTo(c + 4, c - 5);
      ctx.lineTo(c + 10, c - 16);
      ctx.moveTo(c + 8, c - 12);
      ctx.lineTo(c + 16, c - 13);
      ctx.moveTo(c + 9, c - 15);
      ctx.lineTo(c + 6, c - 20);
      stroke("#e8d2a8", 2.6);
      ctx.beginPath();
      ctx.ellipse(c - 10, c - 3, 5, 2.6, 0, 0, Math.PI * 2);
      ctx.moveTo(c + 15, c - 3);
      ctx.ellipse(c + 10, c - 3, 5, 2.6, 0, 0, Math.PI * 2);
      ctx.moveTo(c + 8, c + 5);
      ctx.ellipse(c, c + 5, 8, 12, 0, 0, Math.PI * 2);
      fill("#c8955a");
      stroke(DEEP, 1.5);
      ctx.beginPath();
      ctx.ellipse(c, c + 12, 4.5, 3.5, 0, 0, Math.PI * 2);
      fill(CREAM);
      ctx.beginPath();
      ctx.arc(c, c + 11, 2, 0, Math.PI * 2);
      ctx.moveTo(c - 3 + 1.6, c + 1);
      ctx.arc(c - 3, c + 1, 1.6, 0, Math.PI * 2);
      ctx.moveTo(c + 3 + 1.6, c + 1);
      ctx.arc(c + 3, c + 1, 1.6, 0, Math.PI * 2);
      fill(INK);
      break;
  }
}

// ── SVG recorder: replays the canvas drawing as <path> elements ─────────────

const n = (v: number) => String(Math.round(v * 100) / 100);
const TAU = Math.PI * 2;

class SvgPen implements Pen {
  lineCap: CanvasLineCap = "butt";
  lineJoin: CanvasLineJoin = "miter";
  lineWidth = 1;
  fillStyle: string | CanvasGradient | CanvasPattern = "#000";
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000";
  readonly out: string[] = [];
  private d = "";
  private has = false;

  beginPath(): void {
    this.d = "";
    this.has = false;
  }
  closePath(): void {
    if (!this.has) return;
    this.d += "Z";
  }
  moveTo(x: number, y: number): void {
    this.d += `M${n(x)} ${n(y)}`;
    this.has = true;
  }
  lineTo(x: number, y: number): void {
    if (!this.has) return this.moveTo(x, y);
    this.d += `L${n(x)} ${n(y)}`;
  }
  quadraticCurveTo(qx: number, qy: number, x: number, y: number): void {
    if (!this.has) this.moveTo(qx, qy);
    this.d += `Q${n(qx)} ${n(qy)} ${n(x)} ${n(y)}`;
  }
  bezierCurveTo(ax: number, ay: number, bx: number, by: number, x: number, y: number): void {
    if (!this.has) this.moveTo(ax, ay);
    this.d += `C${n(ax)} ${n(ay)} ${n(bx)} ${n(by)} ${n(x)} ${n(y)}`;
  }
  ellipse(x: number, y: number, rx: number, ry: number, _rot: number, a0: number, a1: number, ccw = false): void {
    const px = (a: number) => x + Math.cos(a) * rx;
    const py = (a: number) => y + Math.sin(a) * ry;
    const sweepFlag = ccw ? 0 : 1;
    let sweep = ccw ? a0 - a1 : a1 - a0;
    const full = sweep >= TAU - 1e-9;
    if (!full) sweep = ((sweep % TAU) + TAU) % TAU;
    if (this.has) this.lineTo(px(a0), py(a0));
    else this.moveTo(px(a0), py(a0));
    if (full) {
      const mid = a0 + (ccw ? -Math.PI : Math.PI);
      this.d += `A${n(rx)} ${n(ry)} 0 0 ${sweepFlag} ${n(px(mid))} ${n(py(mid))}`;
      this.d += `A${n(rx)} ${n(ry)} 0 0 ${sweepFlag} ${n(px(a0))} ${n(py(a0))}`;
    } else if (sweep > 0) {
      const end = ccw ? a0 - sweep : a0 + sweep;
      this.d += `A${n(rx)} ${n(ry)} 0 ${sweep > Math.PI ? 1 : 0} ${sweepFlag} ${n(px(end))} ${n(py(end))}`;
    }
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false): void {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y);
    this.d += `h${n(w)}v${n(h)}h${n(-w)}Z`;
  }
  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.d +=
      `H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}` +
      `V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}` +
      `H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}` +
      `V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`;
  }
  fill(): void {
    if (this.d) this.out.push(`<path d="${this.d}" fill="${String(this.fillStyle)}"/>`);
  }
  stroke(): void {
    if (!this.d) return;
    this.out.push(
      `<path d="${this.d}" fill="none" stroke="${String(this.strokeStyle)}" stroke-width="${n(this.lineWidth)}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"/>`,
    );
  }
}

const innerCache = new Map<IconName, string>();

/** The icon drawing as SVG elements (no <svg> wrapper), cached. */
function iconInner(name: IconName): string {
  let s = innerCache.get(name);
  if (!s) {
    const pen = new SvgPen();
    drawIcon(pen, name);
    s = pen.out.join("");
    innerCache.set(name, s);
  }
  return s;
}

/** The icon as an inline SVG string. */
export function iconSvg(name: IconName): string {
  return `<svg class="ico ico-${name}" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}" aria-hidden="true" focusable="false">${iconInner(name)}</svg>`;
}

let artSeq = 0;

/** Empty-state illustration: the icon on a felt medallion with a stitched ring and sparkles. */
export function emptyArt(name: IconName): string {
  const id = `ea${++artSeq}`;
  const spark = (x: number, y: number, r: number, col: string) => {
    const pen = new SvgPen();
    sparkle(pen, x, y, r);
    pen.fillStyle = col;
    pen.fill();
    return pen.out.join("");
  };
  return (
    `<svg class="empty-svg" viewBox="0 0 120 100" aria-hidden="true" focusable="false">` +
    `<defs><radialGradient id="${id}" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#3d3486"/><stop offset="1" stop-color="#1e1b44"/></radialGradient></defs>` +
    `<ellipse cx="60" cy="91" rx="36" ry="5" fill="rgba(0,0,0,0.3)"/>` +
    `<circle cx="60" cy="48" r="38" fill="url(#${id})"/>` +
    `<circle cx="60" cy="48" r="38" fill="none" stroke="#f2b84b" stroke-opacity="0.6" stroke-width="1.6" stroke-dasharray="0.1 5" stroke-linecap="round"/>` +
    `<circle cx="60" cy="48" r="31" fill="none" stroke="#f2b84b" stroke-opacity="0.2" stroke-width="1"/>` +
    `<g class="empty-icon"><svg x="34" y="21" width="52" height="52" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}">${iconInner(name)}</svg></g>` +
    spark(20, 24, 6, "#ffd75e") +
    spark(101, 30, 4, "rgba(255,243,214,0.8)") +
    spark(98, 74, 5, "rgba(255,215,94,0.7)") +
    `</svg>`
  );
}

const templates = new Map<IconName, SVGElement>();

/** A fresh <svg> element for the icon (sized by CSS: 1.3em by default). */
export function iconEl(name: IconName): SVGElement {
  let t = templates.get(name);
  if (!t) {
    const holder = document.createElement("template");
    holder.innerHTML = iconSvg(name);
    t = holder.content.firstElementChild as SVGElement;
    templates.set(name, t);
  }
  return t.cloneNode(true) as SVGElement;
}

/** Icon for an emoji/symbol, if it is part of the set. */
export function iconForEmoji(ch: string): IconName | null {
  return EMOJI_ICON[ch.replace(/️/g, "")] ?? null;
}
