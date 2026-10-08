// Pre-baked BitmapFont atlases for everything that changes every frame in the WebGL HUD
// (no layout work in the frame loop: text updates only re-map glyph quads).

import { BitmapFont } from "pixi.js";
import { readTokens } from "../../design/skin";

export const FONT_CHARS = [
  ["a", "z"],
  ["A", "Z"],
  ["0", "9"],
  ["А", "я"],
  "ЁёҚқҒғҮүҰұӘәҢңӨөІіҺһ",
  " !?.,:;+-–—×%«»()/$№*'\"…#↑→←☆★·",
];

export const HUD_BOLD = "ShHudBold";
export const HUD_TEXT = "ShHudText";
/** Display face (Montserrat Alternates) for the big numbers and titles. */
export const HUD_DISPLAY = "ShHudDisplay";

let installed = false;

export function installHudFonts(): void {
  if (installed) return;
  installed = true;
  const tokens = readTokens();
  const family = tokens.font;
  BitmapFont.install({
    name: HUD_BOLD,
    style: { fontFamily: family, fontSize: 56, fontWeight: "800", fill: "#ffffff", stroke: { color: "#140f2e", width: 7, join: "round" } },
    chars: FONT_CHARS,
    resolution: 2,
  });
  BitmapFont.install({
    name: HUD_DISPLAY,
    style: { fontFamily: tokens.fontDisplay, fontSize: 56, fontWeight: "800", fill: "#ffffff", stroke: { color: "#140f2e", width: 7, join: "round" } },
    chars: FONT_CHARS,
    resolution: 2,
  });
  BitmapFont.install({
    name: HUD_TEXT,
    style: { fontFamily: family, fontSize: 28, fontWeight: "600", fill: "#ffffff" },
    chars: FONT_CHARS,
    resolution: 2,
  });
}
