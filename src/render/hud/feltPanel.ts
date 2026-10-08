// HUD counterparts of the menu theme («Кийіз», ui/theme.css): a felt panel whose gold stitch is
// drawn at the real size (a 9-slice texture would stretch the dashes into a line), and a round
// felt medallion button.

import { Container, Graphics, NineSliceSprite, Sprite, TilingSprite, type FederatedPointerEvent } from "pixi.js";
import { icon, type IconName } from "../../design/icons";
import { PANEL, type Skin } from "../../design/skin";

/** Dashed rounded rectangle traced along its perimeter (straight runs + quarter arcs). */
function stitch(g: Graphics, x: number, y: number, w: number, h: number, r: number, dash = 5, gap = 4): void {
  r = Math.min(r, w / 2, h / 2);
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * (sw + sh) + 4 * arc;
  // position along the perimeter, clockwise from the top-left end of the top edge
  const at = (s: number): [number, number] => {
    s = ((s % total) + total) % total;
    const segs: [number, (t: number) => [number, number]][] = [
      [sw, (t) => [x + r + t, y]],
      [arc, (t) => { const a = -Math.PI / 2 + t / r; return [x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]; }],
      [sh, (t) => [x + w, y + r + t]],
      [arc, (t) => { const a = t / r; return [x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; }],
      [sw, (t) => [x + w - r - t, y + h]],
      [arc, (t) => { const a = Math.PI / 2 + t / r; return [x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; }],
      [sh, (t) => [x, y + h - r - t]],
      [arc, (t) => { const a = Math.PI + t / r; return [x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]; }],
    ];
    for (const [len, fn] of segs) {
      if (s <= len) return fn(s);
      s -= len;
    }
    return [x + r, y];
  };
  const step = dash + gap;
  const n = Math.max(1, Math.round(total / step));
  const k = total / n; // spread the remainder so the pattern closes evenly
  for (let i = 0; i < n; i++) {
    const s0 = i * k;
    const [x0, y0] = at(s0);
    g.moveTo(x0, y0);
    for (let s = s0 + 1.5; s < s0 + dash; s += 1.5) {
      const [px, py] = at(s);
      g.lineTo(px, py);
    }
    const [x1, y1] = at(s0 + dash);
    g.lineTo(x1, y1);
  }
}

export class FeltPanel extends Container {
  private readonly base: NineSliceSprite;
  private readonly fibre: TilingSprite;
  private readonly seam = new Graphics();
  private pw = 0;
  private ph = 0;

  constructor(skin: Skin, private readonly seamAlpha = 0.42) {
    super();
    this.base = new NineSliceSprite({ texture: skin.panel, leftWidth: PANEL.slice, rightWidth: PANEL.slice, topHeight: PANEL.slice, bottomHeight: PANEL.slice });
    this.fibre = new TilingSprite({ texture: skin.felt, width: 10, height: 10 });
    this.addChild(this.base, this.fibre, this.seam);
  }

  setSize(w: number, h: number): void {
    w = Math.round(w);
    h = Math.round(h);
    if (w === this.pw && h === this.ph) return;
    this.pw = w;
    this.ph = h;
    this.base.width = w;
    this.base.height = h;
    this.fibre.position.set(4, 4);
    this.fibre.width = Math.max(0, w - 8);
    this.fibre.height = Math.max(0, h - 8);
    this.seam.clear();
    stitch(this.seam, 6, 6, w - 12, h - 12, 11);
    this.seam.stroke({ width: 1.4, color: 0xf2b84b, alpha: this.seamAlpha, cap: "round" });
  }

  get panelWidth(): number {
    return this.pw;
  }

  get panelHeight(): number {
    return this.ph;
  }
}

/** Round felt medallion button with an icon (the in-round pause). */
export class MedalButton extends Container {
  private readonly disc: Sprite;
  private readonly glyph: Sprite;
  onTap: (() => void) | null = null;

  constructor(skin: Skin, iconName: IconName, private readonly size = 46) {
    super();
    this.disc = new Sprite(skin.medal);
    this.disc.anchor.set(0.5);
    this.disc.width = size;
    this.disc.height = size;
    this.glyph = new Sprite(icon(iconName));
    this.glyph.anchor.set(0.5);
    this.glyph.width = size * 0.5;
    this.glyph.height = size * 0.5;
    this.disc.position.set(size / 2, size / 2);
    this.glyph.position.set(size / 2, size / 2);
    this.addChild(this.disc, this.glyph);
    this.eventMode = "static";
    this.cursor = "pointer";
    const press = (on: boolean) => {
      const k = on ? 0.92 : 1;
      this.disc.scale.set((size / this.disc.texture.width) * k);
      this.glyph.scale.set(((size * 0.5) / this.glyph.texture.width) * k);
    };
    this.on("pointerdown", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      press(true);
    });
    this.on("pointerup", () => press(false));
    this.on("pointerupoutside", () => press(false));
    this.on("pointerout", () => press(false));
    this.on("pointertap", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.onTap?.();
    });
  }

  get buttonWidth(): number {
    return this.size;
  }

  get buttonHeight(): number {
    return this.size;
  }
}
